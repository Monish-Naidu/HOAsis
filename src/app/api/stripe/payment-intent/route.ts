import { NextResponse, type NextRequest } from "next/server";
import { costFor, stripe } from "@/lib/stripe/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { currentMemberIds, savedByCurrentMember } from "@/lib/stripe/saved-method-owner";
import { logger } from "@/lib/log";

/**
 * Creates the PaymentIntent a resident is about to confirm.
 *
 * The price is computed here, from the association's own fee columns, with the
 * same computePaymentCost the pay screen uses. The client renders the returned
 * cost and confirms this intent, so the number shown and the number charged
 * cannot drift apart; whatever a tampered request claims, the charge is what
 * this route derived.
 *
 * Nothing is written to the database. An abandoned intent is Stripe's to
 * garbage-collect; our books only ever hear from the webhook.
 */
export async function POST(request: NextRequest) {
  const log = logger("stripe/payment-intent", request);
  let body: {
    associationId?: string;
    unitId?: string;
    amountCents?: number;
    rail?: "ach" | "card";
    /** A saved payment_instruments row to charge instead of collecting anew. */
    instrumentId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const { associationId, unitId, amountCents, instrumentId } = body;
  let rail = body.rail;
  if (!associationId || !unitId || !amountCents || (!rail && !instrumentId)) {
    return NextResponse.json(
      { error: "associationId, unitId, amountCents and a rail or instrumentId are required" },
      { status: 400 },
    );
  }
  if (rail && rail !== "ach" && rail !== "card") {
    return NextResponse.json({ error: "Unknown rail" }, { status: 400 });
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "The amount has to be a positive whole number of cents" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  // The same rule record_payment enforces: your own home, or the finances
  // capability. Asked under the caller's session so RLS answers it.
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("unit_id", unitId)
    .eq("profile_id", auth.user.id)
    .is("ends_on", null)
    .maybeSingle();
  if (!membership) {
    const { data: allowed } = await supabase.rpc("has_capability", {
      target: associationId,
      needed: "finances",
    });
    if (!allowed) {
      return NextResponse.json({ error: "You cannot pay for that home" }, { status: 403 });
    }
  }

  const { data: association } = await supabase
    .from("associations")
    .select("stripe_account_id, dues_cents")
    .eq("id", associationId)
    .single();
  if (!association) {
    return NextResponse.json({ error: "No such association" }, { status: 404 });
  }
  if (!association.stripe_account_id) {
    return NextResponse.json(
      { error: "This association has not set up online payments" },
      { status: 409 },
    );
  }
  // The home has to be one of this association's. The intent is created on
  // the named association's Stripe account with the unit in its metadata, and
  // the webhook refuses to settle a unit from an account that is not its
  // own, so a mismatch here is money taken that the books never show.
  const { data: home } = await supabase
    .from("units")
    .select("association_id")
    .eq("id", unitId)
    .maybeSingle();
  if (!home || home.association_id !== associationId) {
    log.warn("unit is not in the named association", { associationId, unitId });
    return NextResponse.json({ error: "That home is not part of this association" }, { status: 400 });
  }
  // A fat-fingered amount should fail here, not become a refund conversation.
  // Two years of dues covers any realistic catch-up payment.
  if (amountCents > Math.max(association.dues_cents * 24, 500_000)) {
    return NextResponse.json({ error: "That amount looks too large" }, { status: 400 });
  }

  // A saved instrument supplies the method and the rail; RLS means the lookup
  // itself proves the caller may see it, and the unit check that it is this
  // home's. Rows from before Stripe carry demo tokens and cannot be charged.
  let paymentMethodId: string | undefined;
  let customerId: string | undefined;
  if (instrumentId) {
    const { data: instrument } = await supabase
      .from("payment_instruments")
      .select("unit_id, profile_id, kind, detail")
      .eq("id", instrumentId)
      .maybeSingle();
    if (!instrument || instrument.unit_id !== unitId) {
      return NextResponse.json({ error: "No such payment method" }, { status: 404 });
    }
    const detail = instrument.detail as { token?: string; status?: string } | null;
    const token = detail?.token;
    if (!token || !token.startsWith("pm_")) {
      return NextResponse.json(
        { error: "That saved method predates online payments. Add it again to use it." },
        { status: 409 },
      );
    }
    if (detail?.status === "verifying") {
      return NextResponse.json(
        { error: "That bank account is still verifying. Confirm the deposits first." },
        { status: 409 },
      );
    }
    // Saved methods are shared by the home, but only among the people who
    // hold it today. One left behind by a previous owner is on the home's
    // list and is not this household's to charge.
    let members: string[];
    try {
      members = await currentMemberIds(supabaseAdmin(), unitId);
    } catch (problem) {
      log.error("could not read the home's members", { err: problem, unitId, instrumentId });
      return NextResponse.json({ error: "Could not check that payment method. Try again." }, { status: 500 });
    }
    if (!savedByCurrentMember(instrument.profile_id, members)) {
      log.warn("saved method belongs to nobody on the home", { unitId, instrumentId });
      return NextResponse.json(
        { error: "That payment method belongs to someone no longer at this home. Remove it and add your own." },
        { status: 409 },
      );
    }
    paymentMethodId = token;
    rail = instrument.kind === "ach" ? "ach" : "card";
    const { data: unit } = await supabase
      .from("units")
      .select("stripe_customer_id")
      .eq("id", unitId)
      .single();
    if (!unit?.stripe_customer_id) {
      return NextResponse.json(
        { error: "That saved method predates online payments. Add it again to use it." },
        { status: 409 },
      );
    }
    customerId = unit.stripe_customer_id;
  }
  if (!rail) {
    return NextResponse.json({ error: "Unknown rail" }, { status: 400 });
  }

  const cost = costFor(rail, amountCents);

  const intent = await stripe().paymentIntents.create(
    {
      amount: cost.residentPaysCents,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      // Stripe emails its own receipt to the person paying when the money
      // settles, which for a bank payment is days after this screen. Without
      // it a payment made by hand ended in silence, while a neighbour on
      // autopay got an email. Autopay intents are made elsewhere and send
      // their own notice, so nobody gets two.
      receipt_email: auth.user.email ?? undefined,
      payment_method_types: rail === "ach" ? ["us_bank_account"] : ["card"],
      payment_method_options:
        rail === "ach"
          ? {
              us_bank_account: {
                // payment_method is the only free permission. Asking for
                // balances, ownership or transactions turns Financial
                // Connections into a per-call paid product.
                financial_connections: { permissions: ["payment_method"] },
              },
            }
          : undefined,
      metadata: {
        association_id: associationId,
        unit_id: unitId,
        paid_by: auth.user.id,
        assessment_cents: String(cost.amountCents),
        platform_fee_cents: String(cost.platformCents),
        platform_fee_paid_by: "owner",
        rail,
      },
    },
    { stripeAccount: association.stripe_account_id },
  );
  log.info("payment intent created", { intentId: intent.id, associationId, unitId, rail, amountCents: cost.residentPaysCents, saved: Boolean(instrumentId) });

  return NextResponse.json({
    clientSecret: intent.client_secret,
    stripeAccountId: association.stripe_account_id,
    cost,
  });
}
