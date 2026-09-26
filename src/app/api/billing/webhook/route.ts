import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { statusFromStripe } from "@/lib/billing";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/log";

/**
 * The only writer of the platform subscription.
 *
 * A separate endpoint from /api/stripe/webhook on purpose: that one is a
 * Connect endpoint listening to every association's own account, and this
 * one listens to ours. Register it as a plain account endpoint with its own
 * signing secret (STRIPE_BILLING_WEBHOOK_SECRET) for:
 *
 *   checkout.session.completed
 *   customer.subscription.created / updated / deleted
 *   invoice.paid / invoice.payment_failed
 *
 * Every write is keyed on the subscription's association_id metadata, with
 * the customer id as a fallback, and every write is idempotent: a replayed
 * event sets the same columns to the same values.
 */
export const runtime = "nodejs";

type Admin = ReturnType<typeof supabaseAdmin>;

async function associationFor(
  admin: Admin,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.association_id;
  if (fromMetadata) return fromMetadata;
  const customer =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { data } = await admin
    .from("associations")
    .select("id")
    .eq("billing_customer_id", customer)
    .maybeSingle();
  return data?.id ?? null;
}

/** Brand and last four of whatever the subscription charges. Best effort. */
async function cardOn(subscription: Stripe.Subscription) {
  const method = subscription.default_payment_method;
  if (!method) return { brand: null, last4: null };
  try {
    const pm =
      typeof method === "string" ? await stripe().paymentMethods.retrieve(method) : method;
    if (pm.card) return { brand: pm.card.brand, last4: pm.card.last4 };
    if (pm.us_bank_account) {
      return { brand: pm.us_bank_account.bank_name ?? "bank", last4: pm.us_bank_account.last4 };
    }
  } catch {
    // A card we cannot describe is still a card. The status is what matters.
  }
  return { brand: null, last4: null };
}

async function writeSubscription(admin: Admin, subscription: Stripe.Subscription) {
  const associationId = await associationFor(admin, subscription);
  if (!associationId) return;
  const status = statusFromStripe(subscription.status);
  const card = await cardOn(subscription);
  const gone = status === "canceled";
  await admin
    .from("associations")
    .update({
      billing_subscription_id: gone ? null : subscription.id,
      billing_customer_id:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      billing_brand: gone ? null : card.brand,
      billing_last4: gone ? null : card.last4,
      subscription_status: status,
      ...(status === "past_due" ? {} : { past_due_since: null }),
      ...(gone ? { canceled_at: new Date().toISOString() } : {}),
    })
    .eq("id", associationId);
}

export async function POST(request: NextRequest) {
  const log = logger("billing/webhook", request);
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  if (!secret) {
    log.error("billing webhook secret is not configured");
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    log.warn("bad signature");
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  log.info("event", { type: event.type, eventId: event.id });

  const admin = supabaseAdmin();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.subscription) break;
      const id =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const subscription = await stripe().subscriptions.retrieve(id);
      await writeSubscription(admin, subscription);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await writeSubscription(admin, event.data.object);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customer =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customer) break;
      await admin
        .from("associations")
        .update({ subscription_status: "past_due", past_due_since: new Date().toISOString() })
        .eq("billing_customer_id", customer)
        .is("past_due_since", null);
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      const customer =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customer) break;
      await admin
        .from("associations")
        .update({ subscription_status: "active", past_due_since: null })
        .eq("billing_customer_id", customer)
        .not("billing_subscription_id", "is", null);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
