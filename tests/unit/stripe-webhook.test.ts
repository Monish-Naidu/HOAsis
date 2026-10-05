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

const rpc = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
const upsert = vi.fn(async () => ({ error: null }));
const secondEq = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
const firstEq = vi.fn(() => ({ eq: secondEq }));
const update = vi.fn(() => ({ eq: firstEq }));
// setup_intent handling reads verifying rows by their SetupIntent id.
const verifyingRows = {
  data: [{ id: "inst-1", detail: { token: "pm_1", status: "verifying", verifyUrl: "u", setupIntentId: "seti_1" } }],
};
// The account check reads the unit's association; the fixture belongs to
// the account every event here is sent from. A test that needs a different
// answer (a failed lookup, the payment behind a dispute) queues it once.
type Lookup = { data: unknown; error?: { message: string; code?: string } | null };
const maybeSingle = vi.fn(
  async (): Promise<Lookup> => ({ data: { associations: { stripe_account_id: "acct_test" } }, error: null }),
);
const selectEq = vi.fn(() => ({
  then: (resolve: (v: typeof verifyingRows) => unknown) => Promise.resolve(verifyingRows).then(resolve),
  maybeSingle,
}));
const select = vi.fn(() => ({ eq: selectEq }));
const deleteEq = vi.fn(async () => ({ error: null }));
const del = vi.fn(() => ({ eq: deleteEq }));
const from = vi.fn(() => ({ upsert, update, select, delete: del }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from, rpc }),
}));

// What /admin would show. Mocked so a recorded error is an assertion here
// and not a write to a table the fake database does not have.
const recordAppError = vi.fn(async () => "REF");
vi.mock("@/lib/app-errors", () => ({ recordAppError }));

const syncAccountStatus = vi.fn(async () => undefined);
vi.mock("@/lib/stripe/account-status", () => ({ syncAccountStatus }));

const { POST } = await import("@/app/api/stripe/webhook/route");
const { stripe } = await import("@/lib/stripe/server");

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

/** A charge, dispute or account event: the object is whatever the test says. */
function objectEvent(type: string, object: object) {
  return { id: "evt_9", object: "event", type, account: "acct_test", data: { object } };
}

/** The charge Stripe would return for the fee lookup, with no network. */
function chargeWith(extra: object) {
  return {
    id: "ch_1",
    object: "charge",
    balance_transaction: {
      id: "txn_1",
      object: "balance_transaction",
      fee: 458,
      fee_details: [
        { type: "stripe_fee", amount: 258 },
        { type: "application_fee", amount: 200 },
      ],
    },
    ...extra,
  };
}

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
  it("ignores a succeeded intent sent from an account that is not the unit's", async () => {
    const event = { ...intentEvent("payment_intent.succeeded", { latest_charge: null }), account: "acct_other" };
    const response = await POST(signedRequest(event) as never);
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    // Acknowledged, since a retry cannot fix it, but on the record.
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        route: "stripe/webhook",
        message: "Settled payment not recorded",
        extra: expect.objectContaining({ intentId: "pi_1", account: "acct_other", unitId: "unit-1" }),
      }),
    );
  });

  it("answers 500, so Stripe sends it again, when the account lookup itself fails", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } });
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: null })) as never,
    );
    expect(response.status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
    // Not a mismatch: nothing to tell the owner yet, Stripe will be back.
    expect(recordAppError).not.toHaveBeenCalled();
  });

  it("asks for a processing intent again too when the lookup fails", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } });
    const response = await POST(signedRequest(intentEvent("payment_intent.processing", {})) as never);
    expect(response.status).toBe(500);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not ask for a retry over a unit id that can never match", async () => {
    // Postgres refusing the id as a uuid is a permanent no, not an outage.
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "invalid input syntax for type uuid", code: "22P02" } });
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: null })) as never,
    );
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(recordAppError).toHaveBeenCalledTimes(1);
  });

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
    expect(recordAppError).not.toHaveBeenCalled();
  });

  it("answers 500 when record_payment fails, so the settlement is tried again", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "deadlock detected" } });
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: null })) as never,
    );
    expect(response.status).toBe(500);
  });

  it("records Stripe's own fee, not the application fee on the same transaction", async () => {
    const retrieve = vi
      .spyOn(stripe().charges, "retrieve")
      .mockResolvedValue(chargeWith({ payment_method_details: { type: "us_bank_account" } }) as never);
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: "ch_1" })) as never,
    );
    expect(response.status).toBe(200);
    expect(retrieve).toHaveBeenCalledWith("ch_1", { expand: ["balance_transaction"] }, { stripeAccount: "acct_test" });
    expect(rpc).toHaveBeenCalledWith(
      "record_payment",
      expect.objectContaining({ p_processor_fee_cents: 258, p_rail: "ach" }),
    );
  });

  it("names the wallet when a card payment came through one", async () => {
    vi.spyOn(stripe().charges, "retrieve").mockResolvedValue(
      chargeWith({ payment_method_details: { type: "card", card: { wallet: { type: "apple_pay" } } } }) as never,
    );
    await POST(signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: "ch_1" })) as never);
    expect(rpc).toHaveBeenCalledWith("record_payment", expect.objectContaining({ p_rail: "apple-pay" }));

    vi.spyOn(stripe().charges, "retrieve").mockResolvedValue(
      chargeWith({ payment_method_details: { type: "card", card: { wallet: { type: "google_pay" } } } }) as never,
    );
    await POST(signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: "ch_1" })) as never);
    expect(rpc).toHaveBeenLastCalledWith("record_payment", expect.objectContaining({ p_rail: "google-pay" }));
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

  it("asks for a processing intent again when its pending row could not be written", async () => {
    // The pending row is what holds autopay and late fees off money in
    // flight. Losing it with a 200 lets the same dues be pulled twice.
    upsert.mockResolvedValueOnce({ error: { message: "fetch failed" } } as never);
    const response = await POST(
      signedRequest(intentEvent("payment_intent.processing", {})) as never,
    );
    expect(response.status).toBe(500);
  });

  it("acknowledges a pending row that can never be written, and says so on /admin", async () => {
    upsert.mockResolvedValueOnce({
      error: { message: "violates foreign key constraint", code: "23503" },
    } as never);
    const response = await POST(
      signedRequest(intentEvent("payment_intent.processing", {})) as never,
    );
    expect(response.status).toBe(200);
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Pending payment not recorded" }),
    );
  });

  it("holds a pending row for a bank still verifying its deposits", async () => {
    const response = await POST(
      signedRequest(intentEvent("payment_intent.requires_action", {})) as never,
    );
    expect(response.status).toBe(200);
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

  it("fails only pending rows on a canceled intent as well", async () => {
    const response = await POST(signedRequest(intentEvent("payment_intent.canceled", {})) as never);
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ state: "failed" });
    expect(firstEq).toHaveBeenCalledWith("stripe_payment_intent_id", "pi_1");
    expect(secondEq).toHaveBeenCalledWith("state", "pending");
  });

  it("answers 500 when the pending row could not be failed, so it does not stand forever", async () => {
    secondEq.mockResolvedValueOnce({ error: { message: "fetch failed" } });
    const response = await POST(
      signedRequest(intentEvent("payment_intent.payment_failed", {})) as never,
    );
    expect(response.status).toBe(500);
  });

  it("writes nothing for an intent missing its metadata", async () => {
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { metadata: {}, latest_charge: null })) as never,
    );
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    // Money settled that the books cannot place: said out loud on /admin.
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", message: "Settled payment not recorded", associationId: null }),
    );
  });

  it("says nothing on /admin about an unfinished intent with no metadata", async () => {
    const response = await POST(
      signedRequest(intentEvent("payment_intent.processing", { metadata: {} })) as never,
    );
    expect(response.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
    expect(recordAppError).not.toHaveBeenCalled();
  });

  it("clears the verifying mark when a SetupIntent succeeds", async () => {
    const event = {
      id: "evt_2",
      object: "event",
      type: "setup_intent.succeeded",
      account: "acct_test",
      data: { object: { object: "setup_intent", id: "seti_1" } },
    };
    const response = await POST(signedRequest(event) as never);
    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("payment_instruments");
    expect(selectEq).toHaveBeenCalledWith("detail->>setupIntentId", "seti_1");
    expect(update).toHaveBeenCalledWith({ detail: { token: "pm_1" } });
    expect(firstEq).toHaveBeenCalledWith("id", "inst-1");
  });

  it("removes a bank whose deposits never matched", async () => {
    const event = {
      id: "evt_3",
      object: "event",
      type: "setup_intent.setup_failed",
      account: "acct_test",
      data: { object: { object: "setup_intent", id: "seti_1" } },
    };
    const response = await POST(signedRequest(event) as never);
    expect(response.status).toBe(200);
    expect(del).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("detail->>setupIntentId", "seti_1");
  });

  it("acknowledges event types it does not handle", async () => {
    const response = await POST(
      signedRequest(objectEvent("customer.created", { object: "customer", id: "cus_1" })) as never,
    );
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("refunds", () => {
  const refunded = { object: "charge", id: "ch_1", payment_intent: "pi_1", amount: 6150, amount_refunded: 6000 };

  it("hands a refund to record_refund with the amount actually refunded", async () => {
    const response = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_refund", {
      p_stripe_payment_intent_id: "pi_1",
      p_amount_cents: 6000,
    });
  });

  it("answers 500 when record_refund fails, so the refund is tried again", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "deadlock detected" } });
    const response = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
    expect(response.status).toBe(500);
  });

  it("writes nothing for a refund event with nothing refunded, or no intent behind it", async () => {
    await POST(signedRequest(objectEvent("charge.refunded", { ...refunded, amount_refunded: 0 })) as never);
    await POST(signedRequest(objectEvent("charge.refunded", { ...refunded, payment_intent: null })) as never);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("chargebacks", () => {
  const dispute = { object: "dispute", id: "dp_1", payment_intent: "pi_1", amount: 6000, reason: "fraudulent", status: "lost" };
  const payment = { data: { association_id: "assoc-1", unit_id: "unit-1", amount_cents: 6000 }, error: null };

  it("puts an opened chargeback on /admin as an error, against the payment's association", async () => {
    maybeSingle.mockResolvedValueOnce(payment);
    const response = await POST(signedRequest(objectEvent("charge.dispute.created", dispute)) as never);
    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("payments");
    expect(selectEq).toHaveBeenCalledWith("stripe_payment_intent_id", "pi_1");
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        route: "stripe/webhook",
        message: "Chargeback opened for $60.00 (fraudulent)",
        associationId: "assoc-1",
        extra: expect.objectContaining({ disputeId: "dp_1", intentId: "pi_1", unitId: "unit-1" }),
      }),
    );
    // The money is contested, not gone: the payment keeps its state.
    expect(update).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("notes a closed chargeback as a warning with how it ended", async () => {
    maybeSingle.mockResolvedValueOnce(payment);
    await POST(signedRequest(objectEvent("charge.dispute.closed", dispute)) as never);
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", message: "Chargeback closed: lost", associationId: "assoc-1" }),
    );
  });
});

describe("account.updated", () => {
  it("refreshes the cached status of the association that owns the account", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "assoc-1" }, error: null });
    const response = await POST(
      signedRequest(objectEvent("account.updated", { object: "account", id: "acct_test" })) as never,
    );
    expect(response.status).toBe(200);
    expect(selectEq).toHaveBeenCalledWith("stripe_account_id", "acct_test");
    expect(syncAccountStatus).toHaveBeenCalledWith("assoc-1", "acct_test");
  });
});
