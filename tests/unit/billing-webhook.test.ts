import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fake-supabase";
import Stripe from "stripe";

/**
 * The billing webhook's contract, with no Stripe network and no database:
 * signatures are enforced, subscription events land on the right
 * association with the right status, a deletion clears the card, and a
 * failed invoice marks past due without touching anything else.
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

// The lookup by customer is the only read; every update answers success.
const fake = createFakeSupabase({ "associations.select": { data: { id: "assoc-by-customer" } } });

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));

/** Each update as the table, the values set and the filters that picked the row. */
const writes = () =>
  fake.writes().map((call) => ({
    table: call.target,
    values: call.argsOf("update")![0] as Record<string, unknown>,
    filters: call.chain,
  }));

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

beforeEach(() => {
  fake.reset();
  vi.clearAllMocks();
  stripeApi.prices.list.mockResolvedValue({ data: [{ id: "price_1" }] });
});

describe("billing webhook", () => {
  it("rejects a bad signature and writes nothing", async () => {
    const response = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=nope" },
      }) as never,
    );
    expect(response.status).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  it("records a new trialing subscription against the association in its metadata", async () => {
    const response = await POST(
      signed({
        id: "evt_1",
        type: "customer.subscription.created",
        data: { object: subscription() },
      }) as never,
    );
    expect(response.status).toBe(200);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].table).toBe("associations");
    expect(writes()[0].values).toMatchObject({
      billing_subscription_id: "sub_1",
      billing_customer_id: "cus_1",
      subscription_status: "trialing",
      past_due_since: null,
    });
    expect(writes()[0].filters).toContainEqual(["eq", "id", "assoc-1"]);
  });

  it("moves to active when Stripe does", async () => {
    await POST(
      signed({
        id: "evt_2",
        type: "customer.subscription.updated",
        data: { object: subscription({ status: "active" }) },
      }) as never,
    );
    expect(writes()[0].values).toMatchObject({
      subscription_status: "active",
      billing_subscription_id: "sub_1",
    });
  });

  it("clears the card and marks canceled when the subscription is deleted", async () => {
    await POST(
      signed({
        id: "evt_3",
        type: "customer.subscription.deleted",
        data: { object: subscription({ status: "canceled" }) },
      }) as never,
    );
    expect(writes()[0].values).toMatchObject({
      subscription_status: "canceled",
      billing_subscription_id: null,
      billing_brand: null,
      billing_last4: null,
    });
    expect(writes()[0].values.canceled_at).toBeTruthy();
  });

  it("finds the association by customer when metadata is missing", async () => {
    await POST(
      signed({
        id: "evt_4",
        type: "customer.subscription.updated",
        data: { object: subscription({ metadata: {} }) },
      }) as never,
    );
    expect(writes()[0].filters).toContainEqual(["eq", "id", "assoc-by-customer"]);
  });

  it("marks past due on a failed invoice, keyed by customer, only once", async () => {
    await POST(
      signed({
        id: "evt_5",
        type: "invoice.payment_failed",
        data: { object: { id: "in_1", object: "invoice", customer: "cus_1" } },
      }) as never,
    );
    expect(writes()[0].values).toMatchObject({ subscription_status: "past_due" });
    expect(writes()[0].values.past_due_since).toBeTruthy();
    expect(writes()[0].filters).toContainEqual(["eq", "billing_customer_id", "cus_1"]);
    expect(writes()[0].filters).toContainEqual(["is", "past_due_since", null]);
  });

  it("returns to active on a paid invoice, but only for a row with a subscription", async () => {
    await POST(
      signed({
        id: "evt_6",
        type: "invoice.paid",
        data: { object: { id: "in_2", object: "invoice", customer: "cus_1" } },
      }) as never,
    );
    expect(writes()[0].values).toEqual({ subscription_status: "active", past_due_since: null });
    expect(writes()[0].filters).toContainEqual(["not", "billing_subscription_id", "is", null]);
  });

  it("a subscription Checkout completion also closes its durable operation", async () => {
    stripeApi.subscriptions.retrieve.mockResolvedValue(subscription());
    const response = await POST(
      signed({
        id: "evt_8",
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
    const opWrite = writes().find((w) => w.table === "billing_operations");
    expect(opWrite?.values).toMatchObject({
      status: "completed",
      session_id: "cs_1",
      subscription_id: "sub_1",
    });
    expect(opWrite?.filters).toContainEqual(["eq", "status", "open"]);
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
        id: "evt_9",
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

    const opWrite = writes().find((w) => w.table === "billing_operations");
    expect(opWrite?.values).toMatchObject({ status: "completed", subscription_id: "sub_1" });
    const associationWrite = writes().find((w) => w.table === "associations");
    expect(associationWrite?.values).toMatchObject({
      billing_subscription_id: "sub_1",
      subscription_status: "trialing",
      billing_brand: "visa",
      billing_last4: "4242",
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
        id: "evt_10",
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
    const [params] = stripeApi.subscriptions.create.mock.calls[0];
    expect(params.trial_end).toBeUndefined();
  });

  it("ignores events it does not handle", async () => {
    const response = await POST(
      signed({
        id: "evt_7",
        type: "customer.created",
        data: { object: { id: "cus_9", object: "customer" } },
      }) as never,
    );
    expect(response.status).toBe(200);
    expect(writes()).toHaveLength(0);
  });
});
