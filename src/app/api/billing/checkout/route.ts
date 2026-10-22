import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { checkoutPlan, subscriptionLine } from "@/lib/billing";
import { requestOrigin } from "@/app/auth/callback/next-path";
import { stripe } from "@/lib/stripe/server";
import { quantityFor } from "@/lib/stripe/subscription-quantity";
import type { BillingOperation } from "@/lib/stripe/billing-operation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { logger } from "@/lib/log";

/**
 * Adding a card, which is the whole of "after the trial".
 *
 * POST opens a hosted Stripe Checkout priced per active home, on the platform
 * account (what the association pays us, not the connected account residents
 * pay into). The promised trial end rides along: a card added on day 20 is
 * first charged on day 91, which is what the front page promised. When less
 * than 48 hours remain, Checkout will not take a trial that short, so the
 * session only collects the card (mode "setup") and the webhook creates the
 * subscription ending at the exact promised second.
 *
 * The operation is durable before Stripe is ever called (0126): two officers
 * pressing together, a repeated click and a retry after a lost answer all
 * continue the same billing_operations row with the same frozen parameters
 * and idempotency keys, so Stripe sees one customer and one usable session.
 * Before anything new is created, what an uncertain earlier attempt may have
 * left behind is looked up and adopted. The webhook, not this route, writes
 * the result: Checkout can be abandoned after this returns.
 *
 * Authorization mirrors the connect route: the caller's own session answers
 * has_capability('settings'), so nobody adds a card to somebody else's board.
 */

type Admin = ReturnType<typeof supabaseAdmin>;

/** Remember the customer on the operation; a racer's answer wins the tie. */
async function storeCustomerId(
  admin: Admin,
  op: BillingOperation,
  customerId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("billing_operations")
    .update({ customer_id: customerId })
    .eq("id", op.id)
    .eq("status", "open")
    .is("customer_id", null)
    .select("customer_id");
  if (data?.length) return customerId;
  const { data: again } = await admin
    .from("billing_operations")
    .select("customer_id")
    .eq("id", op.id)
    .single();
  return again?.customer_id ?? null;
}

/** The session id belongs to the first to store it; the rest expire theirs. */
async function storeSessionId(
  admin: Admin,
  op: BillingOperation,
  sessionId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("billing_operations")
    .update({ session_id: sessionId })
    .eq("id", op.id)
    .eq("status", "open")
    .is("session_id", null)
    .select("id");
  return Boolean(data?.length);
}

async function readOperation(admin: Admin, id: string): Promise<BillingOperation | null> {
  const { data } = await admin.from("billing_operations").select("*").eq("id", id).single();
  return (data as BillingOperation | null) ?? null;
}

/** The operation ran its course; keep the outcome on the row. */
async function markCompleted(
  admin: Admin,
  op: BillingOperation,
  sessionId: string,
  subscriptionId: string | null,
): Promise<void> {
  await admin
    .from("billing_operations")
    .update({ status: "completed", session_id: sessionId, subscription_id: subscriptionId })
    .eq("id", op.id)
    .eq("status", "open");
}

/** The Checkout parameters, built only from what the operation froze. */
function sessionParams(
  op: BillingOperation,
  customerId: string,
): Stripe.Checkout.SessionCreateParams {
  const shared = {
    customer: customerId,
    // The durable handle an uncertain attempt is reconciled by.
    client_reference_id: op.id,
    metadata: { association_id: op.association_id },
    success_url: `${op.return_origin}/board/settings?billing=added`,
    cancel_url: `${op.return_origin}/board/settings?billing=cancelled`,
  };
  if (op.mode === "setup") {
    return {
      ...shared,
      mode: "setup",
      // Setup mode collects no money, but Stripe still wants the currency
      // the eventual subscription will charge in.
      currency: "usd",
      setup_intent_data: {
        metadata: { association_id: op.association_id, billing_operation_id: op.id },
      },
    };
  }
  return {
    ...shared,
    mode: "subscription",
    payment_method_collection: "always",
    line_items: [subscriptionLine(op.quantity)],
    subscription_data: {
      metadata: { association_id: op.association_id },
      ...(op.trial_end_ts ? { trial_end: op.trial_end_ts } : {}),
    },
  };
}

export async function POST(request: NextRequest) {
  const log = logger("billing/checkout", request);
  let body: { associationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const associationId = body.associationId;
  if (!associationId) {
    return NextResponse.json({ error: "associationId is required" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_capability", {
    target: associationId,
    needed: "settings",
  });
  if (!allowed) {
    return NextResponse.json({ error: "You do not have the settings capability" }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const { data: row, error } = await admin
    .from("associations")
    .select("id, name, trial_ends_at, billing_customer_id, billing_subscription_id")
    .eq("id", associationId)
    .single();
  if (error || !row) return NextResponse.json({ error: "No such association" }, { status: 404 });
  if (row.billing_subscription_id) {
    return NextResponse.json({ error: "A card is already on file" }, { status: 409 });
  }

  // The register's count: active homes only, exactly what Settings shows.
  const { count, error: countError } = await admin
    .from("units")
    .select("*", { count: "exact", head: true })
    .eq("association_id", associationId)
    .is("retired_on", null);
  // A count that did not come back is not zero homes.
  if (countError || count === null) {
    log.error("could not count the homes", { associationId, err: countError?.message });
    return NextResponse.json({ error: "Could not count the homes" }, { status: 500 });
  }

  // The return addresses come from the origin the browser actually used, so
  // a local session on 127.0.0.1 is not lost to localhost (and back).
  const origin = requestOrigin(request.nextUrl, request.headers.get("host"));
  const plan = checkoutPlan(row.trial_ends_at?.slice(0, 10) ?? null, new Date());

  const { data: reserved, error: reserveError } = await admin
    .rpc("begin_billing_operation", {
      p_association_id: associationId,
      p_quantity: quantityFor(count),
      p_trial_end_ts: plan.trialEnd,
      p_mode: plan.mode,
      p_customer_name: row.name,
      p_customer_email: auth.user.email ?? null,
      p_return_origin: origin,
    })
    .single();
  if (reserveError || !reserved) {
    log.error("could not reserve the billing operation", {
      associationId,
      err: reserveError?.message,
    });
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
  let op = reserved as BillingOperation;
  const client = stripe();

  // One Stripe customer per association, made once with the frozen name and
  // email and kept. Before creating, adopt what the association row knows or
  // what an uncertain earlier attempt already made.
  try {
    let customerId = op.customer_id ?? row.billing_customer_id ?? null;
    if (customerId && !op.customer_id) {
      customerId = await storeCustomerId(admin, op, customerId);
    }
    if (!customerId) {
      const found = await client.customers.search({
        query: `metadata['association_id']:'${associationId}'`,
        limit: 1,
      });
      if (found.data[0]) customerId = await storeCustomerId(admin, op, found.data[0].id);
    }
    if (!customerId) {
      const customer = await client.customers.create(
        {
          name: op.customer_name,
          email: op.customer_email ?? undefined,
          metadata: { association_id: associationId },
        },
        { idempotencyKey: op.customer_key },
      );
      customerId = await storeCustomerId(admin, op, customer.id);
    }
    if (!customerId) {
      log.error("the billing operation has no customer", { associationId, op: op.id });
      return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
    }
    // The webhook finds the association by this column when metadata is lost.
    await admin
      .from("associations")
      .update({ billing_customer_id: customerId, billing_email: op.customer_email })
      .eq("id", associationId)
      .is("billing_customer_id", null);

    // One usable Checkout session per operation. A stored session is reused
    // while it is open, reported when it completed and replaced only once it
    // expired, and nothing new is made until Stripe has been asked what an
    // uncertain earlier attempt left behind.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (op.session_id) {
        const existing = await client.checkout.sessions.retrieve(op.session_id);
        if (existing.status === "open") return NextResponse.json({ url: existing.url });
        if (existing.status === "complete") {
          const subscriptionId =
            typeof existing.subscription === "string" ? existing.subscription : null;
          await markCompleted(admin, op, existing.id, subscriptionId);
          return NextResponse.json({ error: "A card is already on file" }, { status: 409 });
        }
        // Expired: the replacement must name the old row so two replacers
        // cannot both succeed, and the new key is durable before the call.
        const nextKey = `${op.session_key}-r${Date.now().toString(36)}`;
        const { data: won } = await admin
          .from("billing_operations")
          .update({ session_id: null, session_key: nextKey })
          .eq("id", op.id)
          .eq("status", "open")
          .eq("session_id", op.session_id)
          .select("id");
        if (won?.length) {
          op = { ...op, session_id: null, session_key: nextKey };
        } else {
          const again = await readOperation(admin, op.id);
          if (again) op = again;
        }
        continue;
      }

      const openAtStripe = await client.checkout.sessions.list({
        customer: customerId,
        status: "open",
        limit: 10,
      });
      const ours = openAtStripe.data.find((s) => s.client_reference_id === op.id);
      if (ours) {
        if (await storeSessionId(admin, op, ours.id)) {
          return NextResponse.json({ url: ours.url });
        }
        const again = await readOperation(admin, op.id);
        if (again) op = again;
        continue;
      }
      const doneAtStripe = await client.checkout.sessions.list({
        customer: customerId,
        status: "complete",
        limit: 10,
      });
      const finished = doneAtStripe.data.find((s) => s.client_reference_id === op.id);
      if (finished) {
        const subscriptionId =
          typeof finished.subscription === "string" ? finished.subscription : null;
        await markCompleted(admin, op, finished.id, subscriptionId);
        return NextResponse.json({ error: "A card is already on file" }, { status: 409 });
      }

      const session = await client.checkout.sessions.create(sessionParams(op, customerId), {
        idempotencyKey: op.session_key,
      });
      if (await storeSessionId(admin, op, session.id)) {
        return NextResponse.json({ url: session.url });
      }
      const again = await readOperation(admin, op.id);
      if (again) op = again;
      if (op.session_id && op.session_id !== session.id) {
        // A racer stored a different session first. Ours would be a second
        // usable checkout for the same association, so it cannot be left
        // standing. (An equal id is the same session twice over: Stripe
        // answered both retries with the idempotent replay, and expiring it
        // would close the winner.)
        await client.checkout.sessions.expire(session.id).catch((caught: unknown) => {
          log.error("could not expire a duplicate checkout session", {
            associationId,
            session: session.id,
            err: caught instanceof Error ? caught.message : "unknown error",
          });
        });
      }
    }

    log.error("checkout did not settle", { associationId, op: op.id });
    return NextResponse.json({ error: "Stripe did not settle. Try again." }, { status: 500 });
  } catch (caught) {
    // A lost answer is safe to retry: the operation row, its parameters and
    // its idempotency keys are unchanged, so the retry reconciles first.
    log.error("checkout failed", {
      associationId,
      err: caught instanceof Error ? caught.message : "unknown error",
    });
    return NextResponse.json(
      { error: "Stripe did not answer. Try again in a moment." },
      { status: 500 },
    );
  }
}
