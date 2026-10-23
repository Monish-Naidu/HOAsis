/**
 * The billing webhook's conditional writes (0127): retryable faults aside,
 * this is the ordering and identity contract the database itself keeps.
 *
 * A president founds an association. As the service role,
 * apply_billing_subscription and apply_billing_invoice are exercised through
 * the lives a subscription actually lives: first application and its replay,
 * a stale subscription refused, a customer mismatch refused, a replacement
 * becoming canonical, the old subscription's late deletion and failure
 * unable to clobber it, past_due keeping its first failure date, recovery
 * after cancellation, and concurrent same-second deliveries converging.
 * Pure Supabase; cleaned up at the end.
 */
import { randomUUID } from "node:crypto";
import { createHarness } from "./lib/harness.mjs";

const { admin, anon, check, makeUser, cleanup, cleanupAll, report } = createHarness({
  passwordPrefix: "billwh-",
  emailTag: "billwh",
});

const BILLING_COLUMNS =
  "billing_customer_id, billing_subscription_id, subscription_status, past_due_since, billing_brand, billing_last4, canceled_at";

let associationId;

const applySubscription = (client, params) =>
  client.rpc("apply_billing_subscription", {
    p_association_id: associationId,
    p_brand: null,
    p_last4: null,
    ...params,
  });
const applyInvoice = (client, params) =>
  client.rpc("apply_billing_invoice", { p_subscription_id: null, ...params });
const row = async () =>
  (await admin.from("associations").select(BILLING_COLUMNS).eq("id", associationId).single()).data;

/** A completed operation that produced a subscription, at a chosen instant. */
const recordOperation = (subscriptionId, createdAt) =>
  admin.from("billing_operations").insert({
    id: randomUUID(),
    association_id: associationId,
    status: "completed",
    mode: "subscription",
    quantity: 2,
    customer_name: "Webhook Guards Test HOA",
    return_origin: "http://127.0.0.1:3100",
    customer_key: `bill-cus-${randomUUID()}`,
    session_key: `bill-sess-${randomUUID()}`,
    subscription_key: `bill-sub-${randomUUID()}`,
    subscription_id: subscriptionId,
    created_at: createdAt,
  });

const sameRow = (before, after) => JSON.stringify(before) === JSON.stringify(after);

try {
  const president = await makeUser("president");
  const { data: created, error: createError } = await president.client.rpc("create_association", {
    p_name: "Webhook Guards Test HOA",
    p_city: "Bothell",
    p_state: "WA",
    p_dues_cents: 10000,
    p_dues_cadence: "monthly",
    p_due_day: 1,
    p_founder_name: "Pat Founder",
    p_founder_unit: "1",
    p_households: [],
  });
  if (createError) throw new Error(createError.message);
  associationId = created;
  cleanup.associations.push(associationId);

  // Only the service role applies billing state.
  const { error: presidentError } = await applySubscription(president.client, {
    p_subscription_id: "sub_a",
    p_customer_id: "cus_a",
    p_status: "trialing",
  });
  check(
    "the president cannot apply billing state",
    presidentError?.code === "42501",
    presidentError?.message ?? "",
  );
  const { error: anonError } = await applySubscription(anon(), {
    p_subscription_id: "sub_a",
    p_customer_id: "cus_a",
    p_status: "trialing",
  });
  check(
    "an anonymous caller cannot apply billing state",
    anonError?.code === "42501",
    anonError?.message ?? "",
  );
  const { error: invoiceAnonError } = await applyInvoice(anon(), {
    p_customer_id: "cus_a",
    p_outcome: "paid",
  });
  check(
    "an anonymous caller cannot apply an invoice outcome",
    invoiceAnonError?.code === "42501",
    invoiceAnonError?.message ?? "",
  );

  // The first subscription lands (no operations exist yet, so the row's own
  // belief is the fallback), and a replayed delivery sets the same values.
  const first = await applySubscription(admin, {
    p_subscription_id: "sub_a",
    p_customer_id: "cus_a",
    p_status: "trialing",
    p_brand: "visa",
    p_last4: "4242",
  });
  check("the first subscription applies", first.data === "applied", first.error?.message ?? "");
  const applied = await row();
  check(
    "the row describes the subscription",
    applied?.billing_subscription_id === "sub_a" &&
      applied?.billing_customer_id === "cus_a" &&
      applied?.subscription_status === "trialing" &&
      applied?.billing_brand === "visa" &&
      applied?.billing_last4 === "4242",
    JSON.stringify(applied),
  );
  const replay = await applySubscription(admin, {
    p_subscription_id: "sub_a",
    p_customer_id: "cus_a",
    p_status: "trialing",
    p_brand: "visa",
    p_last4: "4242",
  });
  check(
    "a replayed delivery is applied and changes nothing",
    replay.data === "applied" && sameRow(applied, await row()),
    replay.error?.message ?? "",
  );

  // Identity guards: another subscription and another customer are refused.
  const stale = await applySubscription(admin, {
    p_subscription_id: "sub_x",
    p_customer_id: "cus_a",
    p_status: "active",
  });
  check(
    "an unknown subscription is stale while one is canonical",
    stale.data === "stale-subscription" && sameRow(applied, await row()),
    stale.error?.message ?? "",
  );
  const mismatch = await applySubscription(admin, {
    p_subscription_id: "sub_a",
    p_customer_id: "cus_other",
    p_status: "active",
  });
  check(
    "another customer's event cannot touch the row",
    mismatch.data === "customer-mismatch" && sameRow(applied, await row()),
    mismatch.error?.message ?? "",
  );
  const badStatus = await applySubscription(admin, {
    p_subscription_id: "sub_a",
    p_customer_id: "cus_a",
    p_status: "onfire",
  });
  check(
    "an unknown status is refused",
    badStatus.error?.code === "22000",
    badStatus.error?.message ?? "",
  );

  // Replacement: the newer operation's subscription becomes canonical, and
  // the old one's late events cannot cancel or downgrade it.
  const { error: opOldError } = await recordOperation("sub_a", "2026-10-20T00:00:00Z");
  const { error: opNewError } = await recordOperation("sub_b", "2026-10-22T00:00:00Z");
  if (opOldError || opNewError) throw new Error(opOldError?.message ?? opNewError?.message);
  const replacement = await applySubscription(admin, {
    p_subscription_id: "sub_b",
    p_customer_id: "cus_a",
    p_status: "active",
    p_brand: "visa",
    p_last4: "5555",
  });
  const replaced = await row();
  check(
    "the newer operation's subscription becomes canonical",
    replacement.data === "applied" &&
      replaced?.billing_subscription_id === "sub_b" &&
      replaced?.subscription_status === "active" &&
      replaced?.billing_last4 === "5555",
    replacement.error?.message ?? JSON.stringify(replaced),
  );
  const oldDeleted = await applySubscription(admin, {
    p_subscription_id: "sub_a",
    p_customer_id: "cus_a",
    p_status: "canceled",
  });
  check(
    "the replaced subscription's late deletion cannot cancel its replacement",
    oldDeleted.data === "stale-subscription" && sameRow(replaced, await row()),
    oldDeleted.error?.message ?? "",
  );
  const oldFailed = await applyInvoice(admin, {
    p_customer_id: "cus_a",
    p_subscription_id: "sub_a",
    p_outcome: "failed",
  });
  check(
    "the replaced subscription's late failure cannot mark its replacement past due",
    oldFailed.data === "stale-subscription" && sameRow(replaced, await row()),
    oldFailed.error?.message ?? "",
  );

  // Invoices on the canonical subscription: first failure dates itself, a
  // replayed failure keeps that date, a payment clears it.
  const failed = await applyInvoice(admin, {
    p_customer_id: "cus_a",
    p_subscription_id: "sub_b",
    p_outcome: "failed",
  });
  const pastDue = await row();
  check(
    "a failed invoice marks past due",
    failed.data === "applied" &&
      pastDue?.subscription_status === "past_due" &&
      Boolean(pastDue?.past_due_since),
    failed.error?.message ?? "",
  );
  const failedAgain = await applyInvoice(admin, {
    p_customer_id: "cus_a",
    p_subscription_id: "sub_b",
    p_outcome: "failed",
  });
  check(
    "a replayed failure keeps the first failure's date",
    failedAgain.data === "applied" && (await row())?.past_due_since === pastDue?.past_due_since,
    failedAgain.error?.message ?? "",
  );
  const paid = await applyInvoice(admin, {
    p_customer_id: "cus_a",
    p_subscription_id: "sub_b",
    p_outcome: "paid",
  });
  check(
    "a paid invoice returns the row to active",
    paid.data === "applied" &&
      (await row())?.subscription_status === "active" &&
      (await row())?.past_due_since === null,
    paid.error?.message ?? "",
  );
  const unknownCustomer = await applyInvoice(admin, {
    p_customer_id: "cus_nobody",
    p_outcome: "failed",
  });
  check(
    "an invoice for a stranger changes nothing",
    unknownCustomer.data === "unknown-customer",
    unknownCustomer.error?.message ?? "",
  );
  const badOutcome = await applyInvoice(admin, { p_customer_id: "cus_a", p_outcome: "shrugged" });
  check(
    "an unknown invoice outcome is refused",
    badOutcome.error?.code === "22000",
    badOutcome.error?.message ?? "",
  );

  // Cancellation of the canonical subscription applies; recovery through a
  // newer operation is not blocked; the old one's events stay history.
  const canceled = await applySubscription(admin, {
    p_subscription_id: "sub_b",
    p_customer_id: "cus_a",
    p_status: "canceled",
  });
  const canceledRow = await row();
  check(
    "the canonical subscription's own deletion applies",
    canceled.data === "applied" &&
      canceledRow?.billing_subscription_id === null &&
      canceledRow?.subscription_status === "canceled" &&
      Boolean(canceledRow?.canceled_at),
    canceled.error?.message ?? "",
  );
  const { error: opRecoveryError } = await recordOperation("sub_c", "2026-10-22T01:00:00Z");
  if (opRecoveryError) throw new Error(opRecoveryError.message);
  const recovered = await applySubscription(admin, {
    p_subscription_id: "sub_c",
    p_customer_id: "cus_a",
    p_status: "trialing",
  });
  const recoveredRow = await row();
  check(
    "a recovery subscription applies after cancellation",
    recovered.data === "applied" &&
      recoveredRow?.billing_subscription_id === "sub_c" &&
      recoveredRow?.subscription_status === "trialing",
    recovered.error?.message ?? "",
  );
  const lateOld = await applySubscription(admin, {
    p_subscription_id: "sub_b",
    p_customer_id: "cus_a",
    p_status: "canceled",
  });
  check(
    "a late old-subscription deletion cannot clobber the recovered one",
    lateOld.data === "stale-subscription" && sameRow(recoveredRow, await row()),
    lateOld.error?.message ?? "",
  );
  const paidWithoutCard = await applyInvoice(admin, {
    p_customer_id: "cus_a",
    p_subscription_id: "sub_b",
    p_outcome: "paid",
  });
  check(
    "a paid invoice for a dead subscription does not reactivate it",
    paidWithoutCard.data === "stale-subscription" && sameRow(recoveredRow, await row()),
    paidWithoutCard.error?.message ?? "",
  );

  // Same-second deliveries: the row lock serializes them and the canonical
  // guard decides by identity, so arrival order cannot move the row.
  const sameSecond = await Promise.all([
    applySubscription(admin, {
      p_subscription_id: "sub_c",
      p_customer_id: "cus_a",
      p_status: "active",
    }),
    applySubscription(admin, {
      p_subscription_id: "sub_b",
      p_customer_id: "cus_a",
      p_status: "canceled",
    }),
    applySubscription(admin, {
      p_subscription_id: "sub_c",
      p_customer_id: "cus_a",
      p_status: "active",
    }),
    applySubscription(admin, {
      p_subscription_id: "sub_a",
      p_customer_id: "cus_a",
      p_status: "canceled",
    }),
  ]);
  const outcomes = sameSecond.map((r) => r.data).sort();
  check(
    "concurrent canonical updates apply and stale ones are skipped",
    outcomes.join(",") === "applied,applied,stale-subscription,stale-subscription" &&
      (await row())?.billing_subscription_id === "sub_c" &&
      (await row())?.subscription_status === "active",
    JSON.stringify(outcomes),
  );

  // A foreign association id is named, not invented.
  const { data: noAssoc } = await admin.rpc("apply_billing_subscription", {
    p_association_id: "00000000-0000-0000-0000-000000000000",
    p_subscription_id: "sub_z",
    p_customer_id: "cus_z",
    p_status: "active",
    p_brand: null,
    p_last4: null,
  });
  check("an unknown association is named, not created", noAssoc === "no-such-association", "");
} finally {
  await cleanupAll();
}

report();
