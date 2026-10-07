import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { createFakeSupabase } from "../helpers/fake-supabase";

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

// record_refund answers with the payment it booked against, or null when no
// payment carries the intent. The default is a payment that was found.
// The account check reads the unit's association; the fixture belongs to
// the account every event here is sent from. A test that needs a different
// answer (a failed lookup, the payment behind a dispute) queues it once.
// setup_intent handling reads verifying rows by their SetupIntent id.
const fake = createFakeSupabase({
  rpc: { data: "payment-1", error: null },
  "units.select": { data: { associations: { stripe_account_id: "acct_test" } }, error: null },
  "payment_instruments.select": {
    data: [{ id: "inst-1", detail: { token: "pm_1", status: "verifying", verifyUrl: "u", setupIntentId: "seti_1" } }],
  },
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => fake.client,
}));

/** What the webhook asked of the database, by kind. */
const rpcCalls = (name?: string) =>
  name ? fake.callsTo(`rpc:${name}`) : fake.calls.filter((call) => call.target.startsWith("rpc:"));
const tableCalls = () => fake.calls.filter((call) => !call.target.startsWith("rpc:"));
const withMethod = (method: string) => fake.calls.filter((call) => call.has(method));

// What /admin would show. Mocked so a recorded error is an assertion here
// and not a write to a table the fake database does not have.
const recordAppError = vi.fn(async () => "REF");
vi.mock("@/lib/app-errors", () => ({ recordAppError }));

// The email to the people who hold finances. Mocked: what is tested here is
// when the webhook asks for it and that a failure never becomes a 500.
const sendDisputeNotice = vi.fn<(input: object) => Promise<{ sent: number; failed: number }>>(async () => ({
  sent: 1,
  failed: 0,
}));
vi.mock("@/lib/email/dispute", () => ({ sendDisputeNotice }));

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
  fake.reset();
});

describe("the webhook route", () => {
  it("ignores a succeeded intent sent from an account that is not the unit's", async () => {
    const event = { ...intentEvent("payment_intent.succeeded", { latest_charge: null }), account: "acct_other" };
    const response = await POST(signedRequest(event) as never);
    expect(response.status).toBe(200);
    expect(rpcCalls()).toHaveLength(0);
    expect(withMethod("upsert")).toHaveLength(0);
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
    fake.once("units.select", { data: null, error: { message: "fetch failed" } });
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: null })) as never,
    );
    expect(response.status).toBe(500);
    expect(rpcCalls()).toHaveLength(0);
    // Not a mismatch: nothing to tell the owner yet, Stripe will be back.
    expect(recordAppError).not.toHaveBeenCalled();
  });

  it("asks for a processing intent again too when the lookup fails", async () => {
    fake.once("units.select", { data: null, error: { message: "fetch failed" } });
    const response = await POST(signedRequest(intentEvent("payment_intent.processing", {})) as never);
    expect(response.status).toBe(500);
    expect(withMethod("upsert")).toHaveLength(0);
  });

  it("does not ask for a retry over a unit id that can never match", async () => {
    // Postgres refusing the id as a uuid is a permanent no, not an outage.
    fake.once("units.select", { data: null, error: { message: "invalid input syntax for type uuid", code: "22P02" } });
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: null })) as never,
    );
    expect(response.status).toBe(200);
    expect(rpcCalls()).toHaveLength(0);
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
    expect(rpcCalls()).toHaveLength(0);
    expect(tableCalls()).toHaveLength(0);
  });

  it("records a succeeded intent through record_payment", async () => {
    // latest_charge null: the actual-fee lookup is skipped, so no network.
    const response = await POST(
      signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: null })) as never,
    );
    expect(response.status).toBe(200);
    expect(rpcCalls("record_payment")[0].args).toEqual(["record_payment", {
      p_unit_id: "unit-1",
      p_amount_cents: 6000,
      p_rail: "ach",
      p_processor_fee_cents: 0,
      p_platform_fee_cents: 150,
      p_platform_fee_paid_by: "owner",
      p_stripe_payment_intent_id: "pi_1",
      p_paid_by: "profile-1",
    }]);
    expect(recordAppError).not.toHaveBeenCalled();
  });

  it("answers 500 when record_payment fails, so the settlement is tried again", async () => {
    fake.once("rpc", { error: { message: "deadlock detected" } });
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
    expect(rpcCalls("record_payment")[0].args).toEqual([
      "record_payment",
      expect.objectContaining({ p_processor_fee_cents: 258, p_rail: "ach" }),
    ]);
  });

  it("names the wallet when a card payment came through one", async () => {
    vi.spyOn(stripe().charges, "retrieve").mockResolvedValue(
      chargeWith({ payment_method_details: { type: "card", card: { wallet: { type: "apple_pay" } } } }) as never,
    );
    await POST(signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: "ch_1" })) as never);
    expect(rpcCalls("record_payment")[0].args).toEqual(["record_payment", expect.objectContaining({ p_rail: "apple-pay" })]);

    vi.spyOn(stripe().charges, "retrieve").mockResolvedValue(
      chargeWith({ payment_method_details: { type: "card", card: { wallet: { type: "google_pay" } } } }) as never,
    );
    await POST(signedRequest(intentEvent("payment_intent.succeeded", { latest_charge: "ch_1" })) as never);
    expect(rpcCalls("record_payment").at(-1)!.args).toEqual(["record_payment", expect.objectContaining({ p_rail: "google-pay" })]);
  });

  it("stores a processing intent as a pending row that never overwrites", async () => {
    const response = await POST(
      signedRequest(intentEvent("payment_intent.processing", {})) as never,
    );
    expect(response.status).toBe(200);
    expect(fake.callsTo("payments")).toHaveLength(1);
    expect(fake.callsTo("payments")[0].argsOf("upsert")).toEqual([
      expect.objectContaining({ state: "pending", stripe_payment_intent_id: "pi_1" }),
      { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
    ]);
  });

  it("asks for a processing intent again when its pending row could not be written", async () => {
    // The pending row is what holds autopay and late fees off money in
    // flight. Losing it with a 200 lets the same dues be pulled twice.
    fake.once("payments.upsert", { error: { message: "fetch failed" } });
    const response = await POST(
      signedRequest(intentEvent("payment_intent.processing", {})) as never,
    );
    expect(response.status).toBe(500);
  });

  it("acknowledges a pending row that can never be written, and says so on /admin", async () => {
    fake.once("payments.upsert", {
      error: { message: "violates foreign key constraint", code: "23503" },
    } );
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
    expect(withMethod("upsert")[0].argsOf("upsert")).toEqual([
      expect.objectContaining({ state: "pending", stripe_payment_intent_id: "pi_1" }),
      { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
    ]);
  });

  it("fails only pending rows on payment_failed", async () => {
    const response = await POST(
      signedRequest(intentEvent("payment_intent.payment_failed", {})) as never,
    );
    expect(response.status).toBe(200);
    const failed = withMethod("update")[0];
    expect(failed.target).toBe("payments");
    expect(failed.argsOf("update")).toEqual([{ state: "failed" }]);
    expect(failed.chain).toContainEqual(["eq", "stripe_payment_intent_id", "pi_1"]);
    expect(failed.chain).toContainEqual(["eq", "state", "pending"]);
  });

  it("fails only pending rows on a canceled intent as well", async () => {
    const response = await POST(signedRequest(intentEvent("payment_intent.canceled", {})) as never);
    expect(response.status).toBe(200);
    const failed = withMethod("update")[0];
    expect(failed.target).toBe("payments");
    expect(failed.argsOf("update")).toEqual([{ state: "failed" }]);
    expect(failed.chain).toContainEqual(["eq", "stripe_payment_intent_id", "pi_1"]);
    expect(failed.chain).toContainEqual(["eq", "state", "pending"]);
  });

  it("answers 500 when the pending row could not be failed, so it does not stand forever", async () => {
    fake.once("payments.update", { error: { message: "fetch failed" } });
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
    expect(rpcCalls()).toHaveLength(0);
    expect(tableCalls()).toHaveLength(0);
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
    expect(tableCalls()).toHaveLength(0);
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
    const [read, cleared] = fake.callsTo("payment_instruments");
    expect(read.chain).toContainEqual(["eq", "detail->>setupIntentId", "seti_1"]);
    expect(cleared.argsOf("update")).toEqual([{ detail: { token: "pm_1" } }]);
    expect(cleared.chain).toContainEqual(["eq", "id", "inst-1"]);
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
    expect(withMethod("delete")).toHaveLength(1);
    expect(withMethod("delete")[0].chain).toContainEqual(["eq", "detail->>setupIntentId", "seti_1"]);
  });

  it("asks for a succeeded SetupIntent again when the verifying bank could not be read", async () => {
    // Stripe says the deposits matched once. A 200 here would leave the
    // bank marked verifying for good.
    fake.once("payment_instruments.select", { data: null, error: { message: "fetch failed" } });
    const response = await POST(
      signedRequest(objectEvent("setup_intent.succeeded", { object: "setup_intent", id: "seti_1" })) as never,
    );
    expect(response.status).toBe(500);
    expect(withMethod("update")).toHaveLength(0);
  });

  it("asks for a succeeded SetupIntent again when the verifying mark could not be cleared", async () => {
    fake.once("payment_instruments.update", { error: { message: "fetch failed" } });
    const response = await POST(
      signedRequest(objectEvent("setup_intent.succeeded", { object: "setup_intent", id: "seti_1" })) as never,
    );
    expect(response.status).toBe(500);
    expect(withMethod("update")[0].argsOf("update")).toEqual([{ detail: { token: "pm_1" } }]);
  });

  it("asks for a failed SetupIntent again when the bank could not be removed", async () => {
    fake.once("payment_instruments.delete", { error: { message: "fetch failed" } });
    const response = await POST(
      signedRequest(objectEvent("setup_intent.setup_failed", { object: "setup_intent", id: "seti_1" })) as never,
    );
    expect(response.status).toBe(500);
    // A canceled one takes the same path.
    fake.once("payment_instruments.delete", { error: { message: "fetch failed" } });
    const canceled = await POST(
      signedRequest(objectEvent("setup_intent.canceled", { object: "setup_intent", id: "seti_1" })) as never,
    );
    expect(canceled.status).toBe(500);
  });

  it("acknowledges event types it does not handle", async () => {
    const response = await POST(
      signedRequest(objectEvent("customer.created", { object: "customer", id: "cus_1" })) as never,
    );
    expect(response.status).toBe(200);
    expect(rpcCalls()).toHaveLength(0);
    expect(tableCalls()).toHaveLength(0);
  });
});

describe("refunds", () => {
  const refunded = { object: "charge", id: "ch_1", payment_intent: "pi_1", amount: 6150, amount_refunded: 6000 };

  it("hands a refund to record_refund with the amount actually refunded", async () => {
    const response = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
    expect(response.status).toBe(200);
    expect(rpcCalls("record_refund")[0].args).toEqual([
      "record_refund",
      { p_stripe_payment_intent_id: "pi_1", p_amount_cents: 6000 },
    ]);
  });

  it("answers 500 when record_refund fails, so the refund is tried again", async () => {
    fake.once("rpc", { error: { message: "deadlock detected" } });
    const response = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
    expect(response.status).toBe(500);
  });

  it("writes nothing for a refund event with nothing refunded, or no intent behind it", async () => {
    await POST(signedRequest(objectEvent("charge.refunded", { ...refunded, amount_refunded: 0 })) as never);
    await POST(signedRequest(objectEvent("charge.refunded", { ...refunded, payment_intent: null })) as never);
    expect(rpcCalls()).toHaveLength(0);
  });

  it("does not look the intent up when the refund was booked", async () => {
    const retrieve = vi.spyOn(stripe().paymentIntents, "retrieve");
    const response = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
    expect(response.status).toBe(200);
    expect(retrieve).not.toHaveBeenCalled();
  });

  describe("when no payment carries the intent yet", () => {
    const ourIntent = { object: "payment_intent", id: "pi_1", metadata: METADATA };

    it("asks for the refund again when the intent is ours, so it is not lost", async () => {
      // The refund got here before the payment was recorded. A 200 was the
      // last Stripe would ever say about it.
      fake.once("rpc", { data: null, error: null });
      const retrieve = vi.spyOn(stripe().paymentIntents, "retrieve").mockResolvedValue(ourIntent as never);
      const response = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
      expect(response.status).toBe(500);
      // Asked of the account the event came from: these are direct charges.
      expect(retrieve).toHaveBeenCalledWith("pi_1", {}, { stripeAccount: "acct_test" });
      expect(fake.callsTo("units")[0].chain).toContainEqual(["eq", "id", "unit-1"]);
    });

    it("acknowledges a refund on a charge that was never ours", async () => {
      // No metadata of ours: some other charge on the connected account.
      fake.once("rpc", { data: null, error: null });
      vi.spyOn(stripe().paymentIntents, "retrieve").mockResolvedValue({ ...ourIntent, metadata: {} } as never);
      const response = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
      expect(response.status).toBe(200);
      expect(tableCalls()).toHaveLength(0);
    });

    it("acknowledges one whose unit is not on the account the event came from", async () => {
      fake.once("rpc", { data: null, error: null });
      vi.spyOn(stripe().paymentIntents, "retrieve").mockResolvedValue(ourIntent as never);
      fake.once("units.select", { data: { associations: { stripe_account_id: "acct_other" } }, error: null });
      const response = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
      expect(response.status).toBe(200);
    });

    it("asks again when it cannot tell: the intent or the unit could not be read", async () => {
      fake.once("rpc", { data: null, error: null });
      vi.spyOn(stripe().paymentIntents, "retrieve").mockRejectedValueOnce(new Error("Stripe is down"));
      const unread = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
      expect(unread.status).toBe(500);

      fake.once("rpc", { data: null, error: null });
      vi.spyOn(stripe().paymentIntents, "retrieve").mockResolvedValue(ourIntent as never);
      fake.once("units.select", { data: null, error: { message: "fetch failed" } });
      const unplaced = await POST(signedRequest(objectEvent("charge.refunded", refunded)) as never);
      expect(unplaced.status).toBe(500);
    });
  });
});

describe("chargebacks", () => {
  const dispute = { object: "dispute", id: "dp_1", payment_intent: "pi_1", amount: 6000, reason: "fraudulent", status: "lost" };
  const payment = { data: { association_id: "assoc-1", unit_id: "unit-1", amount_cents: 6000 }, error: null };

  it("puts an opened chargeback on /admin as an error, against the payment's association", async () => {
    fake.once("payments.select", payment);
    const response = await POST(signedRequest(objectEvent("charge.dispute.created", dispute)) as never);
    expect(response.status).toBe(200);
    expect(fake.callsTo("payments")[0].chain).toContainEqual(["eq", "stripe_payment_intent_id", "pi_1"]);
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
    expect(withMethod("update")).toHaveLength(0);
    expect(rpcCalls()).toHaveLength(0);
  });

  it("notes a closed chargeback as a warning with how it ended", async () => {
    fake.once("payments.select", payment);
    await POST(signedRequest(objectEvent("charge.dispute.closed", dispute)) as never);
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", message: "Chargeback closed: lost", associationId: "assoc-1" }),
    );
  });

  it("emails the people who hold finances the day a chargeback opens, with the evidence deadline", async () => {
    fake.once("payments.select", payment);
    const opened = { ...dispute, status: "needs_response", evidence_details: { due_by: Date.UTC(2026, 9, 21, 23, 59, 59) / 1000 } };
    const response = await POST(signedRequest(objectEvent("charge.dispute.created", opened)) as never);
    expect(response.status).toBe(200);
    expect(sendDisputeNotice).toHaveBeenCalledTimes(1);
    expect(sendDisputeNotice).toHaveBeenCalledWith({
      associationId: "assoc-1",
      unitId: "unit-1",
      kind: "opened",
      disputeId: "dp_1",
      amountCents: 6000,
      reason: "fraudulent",
      evidenceDueOn: "2026-10-21",
    });
    // And /admin says how many were told.
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({ extra: expect.objectContaining({ emailed: 1, emailFailed: 0 }) }),
    );
  });

  it("tells them how it ended when the bank decides", async () => {
    fake.once("payments.select", payment);
    await POST(signedRequest(objectEvent("charge.dispute.closed", dispute)) as never);
    expect(sendDisputeNotice).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "lost", disputeId: "dp_1", evidenceDueOn: null }),
    );

    fake.once("payments.select", payment);
    await POST(signedRequest(objectEvent("charge.dispute.closed", { ...dispute, status: "won" })) as never);
    expect(sendDisputeNotice).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "won" }));
  });

  it("sends nothing for a closing that is neither won nor lost", async () => {
    fake.once("payments.select", payment);
    await POST(signedRequest(objectEvent("charge.dispute.closed", { ...dispute, status: "warning_closed" })) as never);
    expect(sendDisputeNotice).not.toHaveBeenCalled();
    expect(recordAppError).toHaveBeenCalledTimes(1);
  });

  it("still answers 200 and records the chargeback when the email fails", async () => {
    // A 500 would have Stripe send the event again for a problem that is ours.
    fake.once("payments.select", payment);
    sendDisputeNotice.mockRejectedValueOnce(new Error("Resend is down"));
    const response = await POST(signedRequest(objectEvent("charge.dispute.created", dispute)) as never);
    expect(response.status).toBe(200);
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Chargeback opened for $60.00 (fraudulent)",
        extra: expect.objectContaining({ emailed: 0 }),
      }),
    );
  });

  it("emails nobody when the payment behind the dispute is not ours", async () => {
    fake.once("payments.select", { data: null, error: null });
    const response = await POST(signedRequest(objectEvent("charge.dispute.created", dispute)) as never);
    expect(response.status).toBe(200);
    expect(sendDisputeNotice).not.toHaveBeenCalled();
    expect(recordAppError).toHaveBeenCalledWith(expect.objectContaining({ associationId: null }));
  });

  it("asks for the event again when the disputed payment could not be read", async () => {
    // Nothing has been sent or recorded yet, so a retry is safe.
    fake.once("payments.select", { data: null, error: { message: "fetch failed" } });
    const response = await POST(signedRequest(objectEvent("charge.dispute.created", dispute)) as never);
    expect(response.status).toBe(500);
    expect(sendDisputeNotice).not.toHaveBeenCalled();
    expect(recordAppError).not.toHaveBeenCalled();
  });
});

describe("account.updated", () => {
  it("refreshes the cached status of the association that owns the account", async () => {
    fake.once("associations.select", { data: { id: "assoc-1" }, error: null });
    const response = await POST(
      signedRequest(objectEvent("account.updated", { object: "account", id: "acct_test" })) as never,
    );
    expect(response.status).toBe(200);
    expect(fake.callsTo("associations")[0].chain).toContainEqual(["eq", "stripe_account_id", "acct_test"]);
    expect(syncAccountStatus).toHaveBeenCalledWith("assoc-1", "acct_test");
  });
});
