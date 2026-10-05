import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { logger } from "@/lib/log";

/**
 * Starts saving a payment method for later dues.
 *
 * A saved method lives on a Stripe Customer, and the Customer belongs to the
 * unit: one home, one association, one customer, created here on first use.
 * Only a current member of the home can do this; the board's finances
 * capability deliberately does not extend to saving someone else's bank.
 */
export async function POST(request: NextRequest) {
  const log = logger("stripe/setup-intent", request);
  let body: { associationId?: string; unitId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const { associationId, unitId } = body;
  if (!associationId || !unitId) {
    return NextResponse.json({ error: "associationId and unitId are required" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  const { data: membership } = await supabase
    .from("memberships")
    .select("full_name")
    .eq("unit_id", unitId)
    .eq("profile_id", auth.user.id)
    .is("ends_on", null)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "That is not your home" }, { status: 403 });
  }

  const { data: association } = await supabase
    .from("associations")
    .select("stripe_account_id")
    .eq("id", associationId)
    .single();
  if (!association?.stripe_account_id) {
    return NextResponse.json(
      { error: "This association has not set up online payments" },
      { status: 409 },
    );
  }
  const account = association.stripe_account_id;

  const { data: unit } = await supabase
    .from("units")
    .select("stripe_customer_id, label, association_id")
    .eq("id", unitId)
    .single();
  if (!unit) {
    return NextResponse.json({ error: "No such home" }, { status: 404 });
  }
  // The customer is created on the named association's Stripe account and
  // kept on the unit, so the home has to be one of that association's.
  if (unit.association_id !== associationId) {
    log.warn("unit is not in the named association", { associationId, unitId });
    return NextResponse.json({ error: "That home is not part of this association" }, { status: 400 });
  }

  let customerId = unit.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe().customers.create(
      {
        name: membership.full_name,
        metadata: { unit_id: unitId, association_id: associationId },
      },
      { stripeAccount: account },
    );
    customerId = customer.id;
    log.info("stripe customer created", { customerId, associationId, unitId });
    const { error } = await supabaseAdmin()
      .from("units")
      .update({ stripe_customer_id: customerId })
      .eq("id", unitId);
    if (error) {
      return NextResponse.json({ error: "Could not save the customer" }, { status: 500 });
    }
  }

  const intent = await stripe().setupIntents.create(
    {
      customer: customerId,
      payment_method_types: ["card", "us_bank_account"],
      payment_method_options: {
        us_bank_account: {
          financial_connections: { permissions: ["payment_method"] },
        },
      },
      metadata: { association_id: associationId, unit_id: unitId },
    },
    { stripeAccount: account },
  );
  log.info("setup intent created", { intentId: intent.id, associationId, unitId });

  return NextResponse.json({ clientSecret: intent.client_secret, stripeAccountId: account });
}
