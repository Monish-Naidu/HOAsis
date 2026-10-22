import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { statusFromStripe } from "@/lib/billing";
import { platformPriceId } from "@/lib/stripe/platform-price";
import { stripe } from "@/lib/stripe/server";
import type { BillingOperation } from "@/lib/stripe/billing-operation";
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
 * Stripe delivers at least once, unordered, and a snapshot can be old by the
 * time it arrives. So every subscription event is reconciled against what
 * Stripe says now, and every write goes through the conditional functions
 * of 0127, which apply it only when it concerns the association's canonical
 * subscription under the row lock. A delayed deletion for a replaced
 * subscription is acknowledged as history and changes nothing.
 *
 * A database error at any required read or write is a 500, so Stripe
 * retries: acknowledging an event whose effect was never committed would
 * be a billing state nobody saved. The writes are idempotent, so the
 * retried delivery lands the same columns a second time and no harm is done.
 */
export const runtime = "nodejs";

type Admin = ReturnType<typeof supabaseAdmin>;

/** What the conditional writes of 0127 answer. */
type ApplyOutcome =
  | "applied"
  | "stale-subscription"
  | "customer-mismatch"
  | "no-such-association"
  | "unknown-customer"
  | "no-subscription";

async function associationFor(
  admin: Admin,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.association_id;
  if (fromMetadata) return fromMetadata;
  const customer =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { data, error } = await admin
    .from("associations")
    .select("id")
    .eq("billing_customer_id", customer)
    .maybeSingle();
  // A lookup that failed is not "no association": the delivery must retry.
  if (error) throw new Error(`could not find the association: ${error.message}`);
  return data?.id ?? null;
}

/** Brand and last four of whatever the subscription charges. Best effort. */
async function cardOn(subscription: Stripe.Subscription) {
  const method = subscription.default_payment_method;
  if (!method) return { brand: null, last4: null };
  try {
    const pm = typeof method === "string" ? await stripe().paymentMethods.retrieve(method) : method;
    if (pm.card) return { brand: pm.card.brand, last4: pm.card.last4 };
    if (pm.us_bank_account) {
      return { brand: pm.us_bank_account.bank_name ?? "bank", last4: pm.us_bank_account.last4 };
    }
  } catch {
    // A card we cannot describe is still a card. The status is what matters.
  }
  return { brand: null, last4: null };
}

/**
 * The conditional, serialized write (0127). The database decides whether
 * this subscription is the association's canonical one; an answer other
 * than "applied" is a deliberately skipped stale or foreign event, and a
 * database error throws so the delivery is retried.
 */
async function applySubscription(
  admin: Admin,
  associationId: string,
  subscription: Stripe.Subscription,
): Promise<ApplyOutcome> {
  const card = await cardOn(subscription);
  const { data, error } = await admin.rpc("apply_billing_subscription", {
    p_association_id: associationId,
    p_subscription_id: subscription.id,
    p_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    p_status: statusFromStripe(subscription.status),
    p_brand: card.brand,
    p_last4: card.last4,
  });
  if (error) throw new Error(`could not apply the subscription: ${error.message}`);
  return data as ApplyOutcome;
}

/**
 * The subscription as Stripe sees it now. The event's snapshot may be old —
 * an updated event replayed after the card cleared still says past_due — so
 * the current object is what gets applied. A subscription Stripe can no
 * longer find is over, whatever the snapshot claimed.
 */
async function currentSubscription(snapshot: Stripe.Subscription): Promise<Stripe.Subscription> {
  if (snapshot.status === "canceled") return snapshot;
  try {
    return await stripe().subscriptions.retrieve(snapshot.id);
  } catch (caught) {
    if ((caught as { code?: string } | null)?.code === "resource_missing") {
      return { ...snapshot, status: "canceled" };
    }
    throw caught;
  }
}

/** The subscription an invoice belongs to, where the current API keeps it. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

async function applyInvoice(
  admin: Admin,
  invoice: Stripe.Invoice,
  outcome: "paid" | "failed",
): Promise<ApplyOutcome> {
  const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customer) return "unknown-customer";
  const { data, error } = await admin.rpc("apply_billing_invoice", {
    p_customer_id: customer,
    p_subscription_id: invoiceSubscriptionId(invoice),
    p_outcome: outcome,
  });
  if (error) throw new Error(`could not apply the invoice: ${error.message}`);
  return data as ApplyOutcome;
}

/**
 * A setup Checkout that was completed: the card is on file and the
 * subscription has to be made here, with the exact trial end the operation
 * promised. Checkout refuses a trial ending under 48 hours out, which is the
 * whole reason the short tail arrives this way; the subscriptions API takes
 * the end down to the second. If the trial ran out while the treasurer was
 * typing, no new trial is invented: the subscription starts and the first
 * invoice is simply the first invoice, as the billing copy already says.
 */
async function completeSetup(admin: Admin, session: Stripe.Checkout.Session): Promise<void> {
  const associationId = session.metadata?.association_id;
  if (!associationId) return;
  const { data: row, error: readError } = await admin
    .from("billing_operations")
    .select("*")
    .eq("association_id", associationId)
    .eq("status", "open")
    .eq("mode", "setup")
    .maybeSingle();
  if (readError) throw new Error(`could not read the billing operation: ${readError.message}`);
  const op = row as BillingOperation | null;
  // No open operation: this delivery already ran to completion. Replays end here.
  if (!op) return;

  const client = stripe();
  const setupIntentId =
    typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
  if (!setupIntentId) throw new Error("completed setup session has no setup intent");
  const setupIntent = await client.setupIntents.retrieve(setupIntentId);
  const paymentMethod =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customer) throw new Error("completed setup session has no customer");

  const subscription = await client.subscriptions.create(
    {
      customer,
      items: [{ price: await platformPriceId(client), quantity: op.quantity }],
      default_payment_method: paymentMethod ?? undefined,
      ...(op.trial_end_ts && op.trial_end_ts * 1000 > Date.now()
        ? { trial_end: op.trial_end_ts }
        : {}),
      metadata: { association_id: associationId },
    },
    // The operation's own key, so a redelivered event or a lost answer
    // continues the same subscription instead of opening a second one.
    { idempotencyKey: op.subscription_key },
  );

  // The operation closes before the state applies: until its
  // subscription_id is on the row, the canonical guard has not heard of
  // this subscription and would refuse it. A failed close throws, the
  // delivery is retried, and the idempotency key above makes the second
  // create return the first attempt's subscription rather than a duplicate.
  const { error: closeError } = await admin
    .from("billing_operations")
    .update({ status: "completed", session_id: session.id, subscription_id: subscription.id })
    .eq("id", op.id)
    .eq("status", "open");
  if (closeError) throw new Error(`could not close the billing operation: ${closeError.message}`);
  await applySubscription(admin, associationId, subscription);
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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "setup") {
          await completeSetup(admin, session);
          break;
        }
        if (session.mode !== "subscription" || !session.subscription) break;
        const id =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe().subscriptions.retrieve(id);
        // The operation this session belonged to is done with it. It closes
        // first: the canonical guard applies only what the newest operation
        // produced, and until the row says so that is not yet this one.
        if (session.client_reference_id) {
          const { error } = await admin
            .from("billing_operations")
            .update({ status: "completed", session_id: session.id, subscription_id: id })
            .eq("id", session.client_reference_id)
            .eq("status", "open");
          if (error) throw new Error(`could not close the billing operation: ${error.message}`);
        }
        const associationId =
          session.metadata?.association_id ?? (await associationFor(admin, subscription));
        if (!associationId) break;
        await applySubscription(admin, associationId, subscription);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const snapshot = event.data.object;
        const associationId = await associationFor(admin, snapshot);
        if (!associationId) break;
        const outcome = await applySubscription(
          admin,
          associationId,
          await currentSubscription(snapshot),
        );
        if (outcome !== "applied") {
          log.info("event did not apply", {
            type: event.type,
            outcome,
            subscription: snapshot.id,
          });
        }
        break;
      }
      case "invoice.payment_failed":
      case "invoice.paid": {
        const outcome = await applyInvoice(
          admin,
          event.data.object,
          event.type === "invoice.paid" ? "paid" : "failed",
        );
        if (outcome !== "applied") log.info("event did not apply", { type: event.type, outcome });
        break;
      }
      default:
        break;
    }
  } catch (caught) {
    // Anything short of a durable write is a failure Stripe must retry.
    log.error("webhook processing failed", {
      type: event.type,
      eventId: event.id,
      err: caught instanceof Error ? caught.message : "unknown error",
    });
    return NextResponse.json(
      { error: "Could not process the event", reference: log.requestId },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
