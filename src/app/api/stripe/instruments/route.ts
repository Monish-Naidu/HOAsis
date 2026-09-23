import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { supabaseServer } from "@/lib/supabase/server";
import { BRAND_LABEL, type CardBrand } from "@/lib/payments/instruments";

/**
 * Turns a SetupIntent into a payment_instruments row, and takes one away.
 *
 * The row is inserted under the caller's own session, so the same RLS policy
 * that guards every other instrument write guards this one; the route's only
 * privilege is asking Stripe what was saved. The payment-method id goes in
 * detail.token, the slot the instrument type has always reserved for a
 * processor token, which is exactly what it is.
 *
 * A bank that chose micro-deposits is saved too, marked `verifying` with
 * Stripe's hosted page for confirming the amounts, so the owner who comes back
 * in two days finds the account they started rather than nothing. The webhook
 * clears the mark when Stripe says the deposits matched.
 *
 * DELETE detaches the method from the Stripe Customer before the row goes,
 * because a row deleted from our table alone would leave the bank on file
 * with Stripe, chargeable by anything that still held its id.
 */
export async function POST(request: NextRequest) {
  let body: { associationId?: string; unitId?: string; setupIntentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const { associationId, unitId, setupIntentId } = body;
  if (!associationId || !unitId || !setupIntentId) {
    return NextResponse.json(
      { error: "associationId, unitId and setupIntentId are all required" },
      { status: 400 },
    );
  }

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const { data: association } = await supabase
    .from("associations")
    .select("stripe_account_id")
    .eq("id", associationId)
    .single();
  if (!association?.stripe_account_id) {
    return NextResponse.json({ error: "Payments are not set up" }, { status: 409 });
  }

  const intent = await stripe().setupIntents.retrieve(
    setupIntentId,
    { expand: ["payment_method"] },
    { stripeAccount: association.stripe_account_id },
  );
  if (intent.metadata?.unit_id !== unitId) {
    return NextResponse.json({ error: "That setup does not belong to this home" }, { status: 403 });
  }
  const microdeposits =
    intent.status === "requires_action" &&
    intent.next_action?.type === "verify_with_microdeposits"
      ? intent.next_action.verify_with_microdeposits
      : null;
  if ((intent.status !== "succeeded" && !microdeposits) || !intent.payment_method) {
    return NextResponse.json(
      { error: "That payment method has not finished verifying" },
      { status: 409 },
    );
  }

  const pm = intent.payment_method as Stripe.PaymentMethod;
  const added = new Date().toISOString().slice(0, 10);
  let row;
  if (pm.type === "us_bank_account" && pm.us_bank_account) {
    const bank = pm.us_bank_account;
    const accountType = bank.account_type === "savings" ? "savings" : "checking";
    row = {
      kind: "ach",
      label: `${bank.bank_name ?? "Bank"} ${accountType}`,
      mask: bank.last4 ?? "",
      detail: {
        institution: bank.bank_name ?? "Bank",
        accountType,
        token: pm.id,
        ...(microdeposits
          ? {
              status: "verifying",
              verifyUrl: microdeposits.hosted_verification_url ?? undefined,
              setupIntentId: intent.id,
            }
          : {}),
      },
    };
  } else if (pm.type === "card" && pm.card) {
    const brand = (
      ["visa", "mastercard", "amex", "discover"].includes(pm.card.brand)
        ? pm.card.brand
        : "unknown"
    ) as CardBrand;
    row = {
      kind: "card",
      label: BRAND_LABEL[brand],
      mask: pm.card.last4,
      detail: {
        brand,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        token: pm.id,
      },
    };
  } else {
    return NextResponse.json({ error: "Unsupported payment method type" }, { status: 400 });
  }

  // Coming back from a bank redirect can post the same SetupIntent twice.
  // One method, one row.
  const { data: already } = await supabase
    .from("payment_instruments")
    .select("id")
    .eq("unit_id", unitId)
    .eq("detail->>token", pm.id)
    .maybeSingle();
  if (already) {
    return NextResponse.json({ id: already.id });
  }

  // The first method a home saves becomes its default, matching the demo:
  // a pay screen with nothing selected is a dead end.
  const { count } = await supabase
    .from("payment_instruments")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", unitId);

  const { data: inserted, error } = await supabase
    .from("payment_instruments")
    .insert({
      association_id: associationId,
      unit_id: unitId,
      profile_id: auth.user.id,
      kind: row.kind,
      label: row.label,
      mask: row.mask,
      is_default: (count ?? 0) === 0,
      added_on: added,
      detail: row.detail,
    })
    .select("id")
    .single();
  if (error) {
    // RLS refusals land here: someone saving to a home that is not theirs.
    return NextResponse.json({ error: "Could not save the payment method" }, { status: 403 });
  }

  return NextResponse.json({ id: inserted.id });
}

export async function DELETE(request: NextRequest) {
  let body: { associationId?: string; instrumentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const { associationId, instrumentId } = body;
  if (!associationId || !instrumentId) {
    return NextResponse.json(
      { error: "associationId and instrumentId are required" },
      { status: 400 },
    );
  }

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  // RLS answers whether the caller may see this row at all.
  const { data: instrument } = await supabase
    .from("payment_instruments")
    .select("id, unit_id, is_default, detail")
    .eq("id", instrumentId)
    .eq("association_id", associationId)
    .maybeSingle();
  if (!instrument) {
    return NextResponse.json({ error: "No such payment method" }, { status: 404 });
  }

  const { data: association } = await supabase
    .from("associations")
    .select("stripe_account_id")
    .eq("id", associationId)
    .single();
  const token = (instrument.detail as { token?: string } | null)?.token;
  if (token?.startsWith("pm_") && association?.stripe_account_id) {
    try {
      await stripe().paymentMethods.detach(token, {}, { stripeAccount: association.stripe_account_id });
    } catch (problem) {
      // Already detached, or gone: the row still has to go.
      const code = (problem as { code?: string }).code;
      if (code !== "resource_missing") {
        return NextResponse.json({ error: "Stripe could not remove it" }, { status: 502 });
      }
    }
  }

  const { error } = await supabase.from("payment_instruments").delete().eq("id", instrumentId);
  if (error) {
    return NextResponse.json({ error: "Could not remove the payment method" }, { status: 403 });
  }

  // The household keeps a default as long as it has anything at all.
  if (instrument.is_default) {
    const { data: successor } = await supabase
      .from("payment_instruments")
      .select("id")
      .eq("unit_id", instrument.unit_id)
      .order("added_on")
      .limit(1)
      .maybeSingle();
    if (successor) {
      await supabase.from("payment_instruments").update({ is_default: true }).eq("id", successor.id);
    }
  }

  return NextResponse.json({ removed: instrumentId });
}
