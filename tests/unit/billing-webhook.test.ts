import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fake-supabase";
import Stripe from "stripe";

/**
 * The billing webhook's contract, with no Stripe network and no database:
 * signatures are enforced; a database failure at any required read or write
 * is a retryable 500, never an acknowledgment; subscription events apply the
 * subscription's CURRENT provider state through the conditional canonical
 * write (0127), so replays, out-of-order deliveries and old subscriptions
 * cannot move the association backwards.
 */

const SECRET = "whsec_billing_test";
process.env.STRIPE_SECRET_KEY = "sk_test_unit";
process.env.STRIPE_BILLING_WEBHOOK_SECRET = SECRET;

// Real signature checking, fake object APIs: constructEvent must genuinely
// verify, but no test here may touch the network.
const stripeApi = {
  setupIntents: { retrieve: vi.fn() },
  subscriptions: { create: vi.fn(), retrieve: vi.fn() },
  paymentMethods: { retrieve: vi.fn() },
  prices: { list: vi.fn(), create: vi.fn() },
};

vi.mock("@/lib/stripe/server", async () => {
  const { default: RealStripe } = await import("stripe");
  const real = new RealStripe("sk_test_unit");
  return { stripe: () => ({ webhooks: real.webhooks, ...stripeApi }) };
});

// The customer fallback read finds an association; the conditional writes
// answer "applied" until a test says otherwise.
const fake = createFakeSupabase({
  "associations.select": { data: { id: "assoc-by-customer" } },
  "rpc:apply_billing_subscription": { data: "applied" },
  "rpc:apply_billing_invoice": { data: "applied" },
  "billing_operations.update": { data: [{ id: "op-1" }] },
});

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));

/** Every conditional subscription application, as its rpc arguments. */
const subscriptionApplies = () =>
  fake
    .callsTo("rpc:apply_billing_subscription")
    .map((call) => call.args[1] as Record<string, unknown>);
const invoiceApplies = () =>
  fake.callsTo("rpc:apply_billing_invoice").map((call) => call.args[1] as Record<string, unknown>);
const operationWrites = () =>
  fake.callsTo("billing_operations").filter((call) => call.has("update"));

const { POST } = await import("@/app/api/billing/webhook/route");
const signer = new Stripe("sk_test_unit");

function signed(event: object): Request {
  const payload = JSON.stringify(event);
  const signature = signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature },
  });
}

function subscription(over: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: "trialing",
    default_payment_method: null,
    metadata: { association_id: "assoc-1" },
    ...over,
  };
}

function invoice(over: Record<string, unknown> = {}) {
  return {
    id: "in_1",
    object: "invoice",
    customer: "cus_1",
    parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } },
    ...over,
  };
}

function subscriptionEvent(type: string, over: Record<string, unknown> = {}) {
  return signed({ id: `evt_${type}`, type, data: { object: subscription(over) } }) as never;
}

/** A fresh request for the same event: a replayed delivery is a new POST of
 * the same payload, not the same Request object (a body reads only once). */
function deliver(event: object) {
  return POST(signed(event) as never);
}

beforeEach(() => {
  fake.reset();
  vi.clearAllMocks();
  stripeApi.prices.list.mockResolvedValue({ data: [{ id: "price_1" }] });
  // By default Stripe answers a retrieve with the subscription as the event
  // described it; tests that need drift override this.
  stripeApi.subscriptions.retrieve.mockImplementation(async (id: string) => subscription({ id }));
});

describe("signature and routing", () => {
  it("rejects a bad signature and touches nothing", async () => {
    const response = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=nope" },
      }) as never,
    );
    expect(response.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it("rejects a missing signature", async () => {
    const response = await POST(
      new Request("http://localhost/api/billing/webhook", { method: "POST", body: "{}" }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("ignores events it does not handle", async () => {
    const response = await POST(
      signed({
        id: "evt_other",
        type: "customer.created",
        data: { object: { id: "cus_9" } },
      }) as never,
    );
    expect(response.status).toBe(200);
    expect(subscriptionApplies()).toHaveLength(0);
    expect(invoiceApplies()).toHaveLength(0);
  });

  it("acknowledges a subscription that belongs to nobody, writing nothing", async () => {
    fake.on("associations.select", { data: null });
    const response = await POST(
      subscriptionEvent("customer.subscription.created", { metadata: {} }),
    );
    expect(response.status).toBe(200);
    expect(subscriptionApplies()).toHaveLength(0);
  });
});

describe("subscription events apply current provider state conditionally", () => {
  it("applies a new trialing subscription to the association in its metadata", async () => {
    const response = await POST(subscriptionEvent("customer.subscription.created"));
    expect(response.status).toBe(200);
    expect(subscriptionApplies()).toEqual([
      {
        p_association_id: "assoc-1",
        p_subscription_id: "sub_1",
        p_customer_id: "cus_1",
        p_status: "trialing",
        p_brand: null,
        p_last4: null,
      },
    ]);
  });

  it("finds the association by customer when metadata is missing", async () => {
    const response = await POST(
      subscriptionEvent("customer.subscription.updated", { metadata: {} }),
    );
    expect(response.status).toBe(200);
    expect(subscriptionApplies()[0].p_association_id).toBe("assoc-by-customer");
  });

  it("applies what Stripe says now, not the replayed snapshot's stale status", async () => {
    // The delayed snapshot says trialing; the subscription has since gone active.
    stripeApi.subscriptions.retrieve.mockResolvedValue(subscription({ status: "active" }));
    const response = await POST(subscriptionEvent("customer.subscription.created"));
    expect(response.status).toBe(200);
    expect(stripeApi.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(subscriptionApplies()[0].p_status).toBe("active");
  });

  it("treats a subscription Stripe can no longer find as canceled", async () => {
    stripeApi.subscriptions.retrieve.mockRejectedValue({ code: "resource_missing" });
    const response = await POST(subscriptionEvent("customer.subscription.updated"));
    expect(response.status).toBe(200);
    expect(subscriptionApplies()[0].p_status).toBe("canceled");
  });

  it("does not retrieve a deleted subscription: its snapshot is the final truth", async () => {
    const response = await POST(
      subscriptionEvent("customer.subscription.deleted", { status: "canceled" }),
    );
    expect(response.status).toBe(200);
    expect(stripeApi.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(subscriptionApplies()[0]).toMatchObject({
      p_subscription_id: "sub_1",
      p_status: "canceled",
    });
  });

  it("accepts a stale-subscription answer without error: the old event is done", async () => {
    // An old subscription's late deletion after its replacement became
    // canonical. The database refuses the write; the event is still processed.
    fake.on("rpc:apply_billing_subscription", { data: "stale-subscription" });
    const response = await POST(
      subscriptionEvent("customer.subscription.deleted", { id: "sub_old", status: "canceled" }),
    );
    expect(response.status).toBe(200);
    expect(subscriptionApplies()[0].p_subscription_id).toBe("sub_old");
  });

  it("passes the card on file through to the conditional write", async () => {
    stripeApi.subscriptions.retrieve.mockResolvedValue(
      subscription({ status: "active", default_payment_method: "pm_1" }),
    );
    stripeApi.paymentMethods.retrieve.mockResolvedValue({ card: { brand: "visa", last4: "4242" } });
    const response = await POST(subscriptionEvent("customer.subscription.updated"));
    expect(response.status).toBe(200);
    expect(subscriptionApplies()[0]).toMatchObject({ p_brand: "visa", p_last4: "4242" });
  });
});

describe("database faults are retryable, never acknowledged", () => {
  it("a failed association lookup answers 500 and applies nothing", async () => {
    fake.on("associations.select", { data: null, error: { message: "connection reset" } });
    const response = await POST(
      subscriptionEvent("customer.subscription.updated", { metadata: {} }),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).not.toMatchObject({ received: true });
    expect(subscriptionApplies()).toHaveLength(0);
  });

  it("a failed conditional write answers 500, and the retry applies it once", async () => {
    fake.once("rpc:apply_billing_subscription", { data: null, error: { message: "deadlock" } });
    const event = {
      id: "evt_retry",
      type: "customer.subscription.updated",
      data: { object: subscription() },
    };

    const first = await deliver(event);
    expect(first.status).toBe(500);

    const replay = await deliver(event);
    expect(replay.status).toBe(200);
    // Same event, same arguments: the retried delivery converges on the one
    // conditional write instead of a second effect.
    expect(subscriptionApplies()).toHaveLength(2);
    expect(subscriptionApplies()[0]).toEqual(subscriptionApplies()[1]);
  });

  it("a Stripe outage while reconciling answers 500 so the delivery is retried", async () => {
    stripeApi.subscriptions.retrieve.mockRejectedValue(new Error("socket hangup"));
    const response = await POST(subscriptionEvent("customer.subscription.updated"));
    expect(response.status).toBe(500);
    expect(subscriptionApplies()).toHaveLength(0);
  });

  it("a failed operation close after a subscription Checkout answers 500 and applies nothing", async () => {
    stripeApi.subscriptions.retrieve.mockResolvedValue(subscription());
    fake.once("billing_operations.update", { data: null, error: { message: "connection reset" } });
    const response = await POST(
      signed({
        id: "evt_close",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_1",
            object: "checkout.session",
            mode: "subscription",
            subscription: "sub_1",
            client_reference_id: "op-1",
          },
        },
      }) as never,
    );
    expect(response.status).toBe(500);
    // Until the operation names its subscription, the canonical guard would
    // refuse it, so the apply must not run ahead of the close.
    expect(subscriptionApplies()).toHaveLength(0);
  });
});

describe("checkout.session.completed", () => {
  it("closes the durable operation, then applies the subscription", async () => {
    stripeApi.subscriptions.retrieve.mockResolvedValue(subscription());
    const response = await POST(
      signed({
        id: "evt_checkout",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_1",
            object: "checkout.session",
            mode: "subscription",
            subscription: "sub_1",
            client_reference_id: "op-1",
          },
        },
      }) as never,
    );
    expect(response.status).toBe(200);
    const opWrite = operationWrites()[0];
    expect(opWrite.argsOf("update")![0]).toMatchObject({
      status: "completed",
      session_id: "cs_1",
      subscription_id: "sub_1",
    });
    expect(opWrite.chain).toContainEqual(["eq", "status", "open"]);
    expect(subscriptionApplies()[0]).toMatchObject({
      p_association_id: "assoc-1",
      p_subscription_id: "sub_1",
    });
    // The close landed first: without it the canonical guard would refuse.
    expect(fake.calls.indexOf(opWrite)).toBeLessThan(
      fake.calls.indexOf(fake.callsTo("rpc:apply_billing_subscription")[0]),
    );
  });

  it("a completed setup session starts the subscription at the exact promised end", async () => {
    const trialEnd = Math.floor(Date.now() / 1000) + 36 * 3600;
    fake.on("billing_operations.select", {
      data: {
        id: "op-1",
        association_id: "assoc-1",
        status: "open",
        mode: "setup",
        quantity: 3,
        trial_end_ts: trialEnd,
        subscription_key: "bill-sub-op-1",
      },
    });
    stripeApi.setupIntents.retrieve.mockResolvedValue({ payment_method: "pm_1" });
    stripeApi.subscriptions.create.mockResolvedValue(
      subscription({ default_payment_method: "pm_1" }),
    );
    stripeApi.paymentMethods.retrieve.mockResolvedValue({
      card: { brand: "visa", last4: "4242" },
    });

    const response = await POST(
      signed({
        id: "evt_setup",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_setup_1",
            object: "checkout.session",
            mode: "setup",
            customer: "cus_1",
            setup_intent: "seti_1",
            client_reference_id: "op-1",
            metadata: { association_id: "assoc-1" },
          },
        },
      }) as never,
    );
    expect(response.status).toBe(200);

    const [params, options] = stripeApi.subscriptions.create.mock.calls[0];
    expect(params).toMatchObject({
      customer: "cus_1",
      default_payment_method: "pm_1",
      trial_end: trialEnd,
      metadata: { association_id: "assoc-1" },
    });
    expect(params.items[0]).toMatchObject({ price: "price_1", quantity: 3 });
    expect(options).toEqual({ idempotencyKey: "bill-sub-op-1" });

    expect(operationWrites()[0].argsOf("update")![0]).toMatchObject({
      status: "completed",
      subscription_id: "sub_1",
    });
    expect(subscriptionApplies()[0]).toMatchObject({
      p_association_id: "assoc-1",
      p_subscription_id: "sub_1",
      p_status: "trialing",
      p_brand: "visa",
      p_last4: "4242",
    });
  });

  it("invents no new trial when the promise ran out during setup", async () => {
    fake.on("billing_operations.select", {
      data: {
        id: "op-1",
        association_id: "assoc-1",
        status: "open",
        mode: "setup",
        quantity: 1,
        trial_end_ts: Math.floor(Date.now() / 1000) - 60,
        subscription_key: "bill-sub-op-1",
      },
    });
    stripeApi.setupIntents.retrieve.mockResolvedValue({ payment_method: "pm_1" });
    stripeApi.subscriptions.create.mockResolvedValue(
      subscription({ status: "active", default_payment_method: "pm_1" }),
    );
    stripeApi.paymentMethods.retrieve.mockResolvedValue({
      card: { brand: "visa", last4: "4242" },
    });

    const response = await POST(
      signed({
        id: "evt_setup_late",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_setup_2",
            object: "checkout.session",
            mode: "setup",
            customer: "cus_1",
            setup_intent: "seti_1",
            metadata: { association_id: "assoc-1" },
          },
        },
      }) as never,
    );
    expect(response.status).toBe(200);
    expect(stripeApi.subscriptions.create.mock.calls[0][0].trial_end).toBeUndefined();
  });

  it("a lost result write after creating the subscription retries without a duplicate", async () => {
    fake.on("billing_operations.select", {
      data: {
        id: "op-1",
        association_id: "assoc-1",
        status: "open",
        mode: "setup",
        quantity: 2,
        trial_end_ts: null,
        subscription_key: "bill-sub-op-1",
      },
    });
    stripeApi.setupIntents.retrieve.mockResolvedValue({ payment_method: "pm_1" });
    stripeApi.subscriptions.create.mockResolvedValue(subscription({ status: "active" }));
    // The subscription reached Stripe; writing its id down did not.
    fake.once("billing_operations.update", { data: null, error: { message: "connection reset" } });

    const event = {
      id: "evt_setup_retry",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_setup_3",
          object: "checkout.session",
          mode: "setup",
          customer: "cus_1",
          setup_intent: "seti_1",
          metadata: { association_id: "assoc-1" },
        },
      },
    };

    expect(await deliver(event)).toMatchObject({ status: 500 });
    const replay = await deliver(event);
    expect(replay.status).toBe(200);

    // The provider saw one logical subscription: both attempts carried the
    // operation's one idempotency key and identical parameters, so Stripe
    // answered the retry with the first attempt's subscription.
    const creates = stripeApi.subscriptions.create.mock.calls;
    expect(creates).toHaveLength(2);
    expect(creates[0][1]).toEqual({ idempotencyKey: "bill-sub-op-1" });
    expect(creates[0]).toEqual(creates[1]);
    // And the conditional close ran under "still open" both times, so a
    // winning first attempt makes the second a no-op rather than a rewrite.
    for (const write of operationWrites()) {
      expect(write.chain).toContainEqual(["eq", "status", "open"]);
    }
  });
});

describe("invoice events", () => {
  it("marks past due through the conditional write, keyed by customer and subscription", async () => {
    const response = await POST(
      signed({
        id: "evt_failed",
        type: "invoice.payment_failed",
        data: { object: invoice() },
      }) as never,
    );
    expect(response.status).toBe(200);
    expect(invoiceApplies()).toEqual([
      { p_customer_id: "cus_1", p_subscription_id: "sub_1", p_outcome: "failed" },
    ]);
  });

  it("clears past due on a paid invoice", async () => {
    const response = await POST(
      signed({ id: "evt_paid", type: "invoice.paid", data: { object: invoice() } }) as never,
    );
    expect(response.status).toBe(200);
    expect(invoiceApplies()[0]).toMatchObject({ p_outcome: "paid" });
  });

  it("a failed invoice for an old subscription is acknowledged but not applied", async () => {
    fake.on("rpc:apply_billing_invoice", { data: "stale-subscription" });
    const response = await POST(
      signed({
        id: "evt_stale_invoice",
        type: "invoice.payment_failed",
        data: {
          object: invoice({
            parent: {
              type: "subscription_details",
              subscription_details: { subscription: "sub_old" },
            },
          }),
        },
      }) as never,
    );
    expect(response.status).toBe(200);
    expect(invoiceApplies()[0].p_subscription_id).toBe("sub_old");
  });

  it("a failed invoice write answers 500 so the delivery is retried", async () => {
    fake.once("rpc:apply_billing_invoice", { data: null, error: { message: "deadlock" } });
    const response = await POST(
      signed({
        id: "evt_inv_retry",
        type: "invoice.payment_failed",
        data: { object: invoice() },
      }) as never,
    );
    expect(response.status).toBe(500);
  });

  it("an invoice with no customer touches nothing", async () => {
    const response = await POST(
      signed({
        id: "evt_nocus",
        type: "invoice.paid",
        data: { object: invoice({ customer: null }) },
      }) as never,
    );
    expect(response.status).toBe(200);
    expect(invoiceApplies()).toHaveLength(0);
  });
});

describe("replayed and concurrent deliveries", () => {
  it("a duplicated event applies the same conditional write twice, harmlessly", async () => {
    const event = {
      id: "evt_dup",
      type: "customer.subscription.updated",
      data: { object: subscription() },
    };
    expect((await deliver(event)).status).toBe(200);
    expect((await deliver(event)).status).toBe(200);
    expect(subscriptionApplies()).toHaveLength(2);
    expect(subscriptionApplies()[0]).toEqual(subscriptionApplies()[1]);
  });

  it("same-second created and updated both converge on current state", async () => {
    stripeApi.subscriptions.retrieve.mockResolvedValue(subscription({ status: "active" }));
    const [created, updated] = await Promise.all([
      POST(subscriptionEvent("customer.subscription.created")),
      POST(subscriptionEvent("customer.subscription.updated")),
    ]);
    expect(created.status).toBe(200);
    expect(updated.status).toBe(200);
    // Neither trusts its own snapshot: both write what Stripe says now.
    expect(subscriptionApplies().map((a) => a.p_status)).toEqual(["active", "active"]);
  });

  it("an old subscription's deletion racing the replacement's creation cannot win", async () => {
    // The database answers per identity: the replacement applies, the old
    // subscription's deletion is stale. Order of arrival does not matter.
    fake.on("rpc:apply_billing_subscription", (call) => {
      const params = call.args[1] as { p_subscription_id: string };
      return { data: params.p_subscription_id === "sub_new" ? "applied" : "stale-subscription" };
    });
    stripeApi.subscriptions.retrieve.mockImplementation(async (id: string) =>
      subscription({ id, status: "active" }),
    );
    const [oldGone, replacement] = await Promise.all([
      POST(
        subscriptionEvent("customer.subscription.deleted", { id: "sub_old", status: "canceled" }),
      ),
      POST(subscriptionEvent("customer.subscription.created", { id: "sub_new" })),
    ]);
    expect(oldGone.status).toBe(200);
    expect(replacement.status).toBe(200);
    expect(
      subscriptionApplies()
        .map((a) => a.p_subscription_id)
        .sort(),
    ).toEqual(["sub_new", "sub_old"]);
  });

  it("a duplicated setup completion creates one logical subscription", async () => {
    fake.on("billing_operations.select", {
      data: {
        id: "op-1",
        association_id: "assoc-1",
        status: "open",
        mode: "setup",
        quantity: 2,
        trial_end_ts: null,
        subscription_key: "bill-sub-op-1",
      },
    });
    stripeApi.setupIntents.retrieve.mockResolvedValue({ payment_method: "pm_1" });
    stripeApi.subscriptions.create.mockResolvedValue(subscription({ status: "active" }));

    const event = {
      id: "evt_setup_twice",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_setup_4",
          object: "checkout.session",
          mode: "setup",
          customer: "cus_1",
          setup_intent: "seti_1",
          metadata: { association_id: "assoc-1" },
        },
      },
    };
    const [one, two] = await Promise.all([deliver(event), deliver(event)]);
    expect(one.status).toBe(200);
    expect(two.status).toBe(200);
    const keys = stripeApi.subscriptions.create.mock.calls.map((call) => call[1].idempotencyKey);
    expect(new Set(keys)).toEqual(new Set(["bill-sub-op-1"]));
  });
});
