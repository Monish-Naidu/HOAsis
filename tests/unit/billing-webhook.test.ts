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

// The lookup by customer is the only read; every update answers success.
const fake = createFakeSupabase({ "associations.select": { data: { id: "assoc-by-customer" } } });

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));

/** Each update as the table, the values set and the filters that picked the row. */
const writes = () =>
  fake.writes().map((call) => ({ table: call.target, values: call.argsOf("update")![0] as Record<string, unknown>, filters: call.chain }));

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
      signed({ id: "evt_1", type: "customer.subscription.created", data: { object: subscription() } }) as never,
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
      signed({ id: "evt_2", type: "customer.subscription.updated", data: { object: subscription({ status: "active" }) } }) as never,
    );
    expect(writes()[0].values).toMatchObject({ subscription_status: "active", billing_subscription_id: "sub_1" });
  });

  it("clears the card and marks canceled when the subscription is deleted", async () => {
    await POST(
      signed({ id: "evt_3", type: "customer.subscription.deleted", data: { object: subscription({ status: "canceled" }) } }) as never,
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
      signed({ id: "evt_4", type: "customer.subscription.updated", data: { object: subscription({ metadata: {} }) } }) as never,
    );
    expect(writes()[0].filters).toContainEqual(["eq", "id", "assoc-by-customer"]);
  });

  it("marks past due on a failed invoice, keyed by customer, only once", async () => {
    await POST(
      signed({ id: "evt_5", type: "invoice.payment_failed", data: { object: { id: "in_1", object: "invoice", customer: "cus_1" } } }) as never,
    );
    expect(writes()[0].values).toMatchObject({ subscription_status: "past_due" });
    expect(writes()[0].values.past_due_since).toBeTruthy();
    expect(writes()[0].filters).toContainEqual(["eq", "billing_customer_id", "cus_1"]);
    expect(writes()[0].filters).toContainEqual(["is", "past_due_since", null]);
  });

  it("returns to active on a paid invoice, but only for a row with a subscription", async () => {
    await POST(
      signed({ id: "evt_6", type: "invoice.paid", data: { object: { id: "in_2", object: "invoice", customer: "cus_1" } } }) as never,
    );
    expect(writes()[0].values).toEqual({ subscription_status: "active", past_due_since: null });
    expect(writes()[0].filters).toContainEqual(["not", "billing_subscription_id", "is", null]);
  });

  it("ignores events it does not handle", async () => {
    const response = await POST(
      signed({ id: "evt_7", type: "customer.created", data: { object: { id: "cus_9", object: "customer" } } }) as never,
    );
    expect(response.status).toBe(200);
    expect(writes()).toHaveLength(0);
  });
});
