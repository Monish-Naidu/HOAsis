import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

/**
 * The webhook route's contract, with no Stripe network and no database:
 * signatures are enforced, events dispatch to the right writes, and garbage
 * (bad signature, missing metadata) writes nothing. Payloads are signed with
 * the SDK's own test helper, so what is tested is real signature verification,
 * not a mock of it.
 */

const SECRET = "whsec_test_secret";
process.env.STRIPE_SECRET_KEY = "sk_test_unit";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;

const rpc = vi.fn(async () => ({ error: null }));
const upsert = vi.fn(async () => ({ error: null }));
const secondEq = vi.fn(async () => ({ error: null }));
const firstEq = vi.fn(() => ({ eq: secondEq }));
const update = vi.fn(() => ({ eq: firstEq }));
const from = vi.fn(() => ({ upsert, update }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from, rpc }),
}));

const { POST } = await import("@/app/api/stripe/webhook/route");

const signer = new Stripe("sk_test_unit");

function signedRequest(event: object): Request {
  const payload = JSON.stringify(event);
  const signature = signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature },
  });
}

const METADATA = {
  association_id: "assoc-1",
  unit_id: "unit-1",
  paid_by: "profile-1",
  assessment_cents: "6000",
  platform_fee_cents: "150",
  platform_fee_paid_by: "owner",
  rail: "ach",
};

function intentEvent(type: string, intent: object) {
  return {
    id: "evt_1",
    object: "event",
    type,
    account: "acct_test",
    data: { object: { object: "payment_intent", id: "pi_1", metadata: METADATA, ...intent } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the webhook route", () => {
  it("rejects a payload whose signature does not verify", async () => {
    const request = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify(intentEvent("payment_intent.succeeded", {})),
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("records a succeeded intent through record_payment", async () => {
    // latest_charge null: the actual-fee lookup is skipped, so no network.
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: null })) as never,
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_payment", {
      p_unit_id: "unit-1",
      p_amount_cents: 6000,
      p_rail: "ach",
      p_processor_fee_cents: 0,
      p_platform_fee_cents: 150,
      p_platform_fee_paid_by: "owner",
      p_stripe_payment_intent_id: "pi_1",
      p_paid_by: "profile-1",
    });
  });

  it("stores a processing intent as a pending row that never overwrites", async () => {
    const response = await POST(
      signedRequest(intentEvent("payment_intent.processing", {})) as never,
    );
    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("payments");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ state: "pending", stripe_payment_intent_id: "pi_1" }),
      { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
    );
  });

  it("fails only pending rows on payment_failed", async () => {
    const response = await POST(
      signedRequest(intentEvent("payment_intent.payment_failed", {})) as never,
    );
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ state: "failed" });
    expect(firstEq).toHaveBeenCalledWith("stripe_payment_intent_id", "pi_1");
    expect(secondEq).toHaveBeenCalledWith("state", "pending");
  });

  it("writes nothing for an intent missing its metadata", async () => {
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { metadata: {}, latest_charge: null })) as never,
    );
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("acknowledges event types it does not handle", async () => {
    const response = await POST(signedRequest(intentEvent("charge.refunded", {})) as never);
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
