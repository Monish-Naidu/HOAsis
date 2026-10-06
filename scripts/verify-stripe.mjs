/**
 * The webhook's settlement contract, against the real database.
 *
 * Stripe delivers events at least once and out of order, so record_payment
 * must be safe to call twice with one intent id, must settle a pending row in
 * place rather than inserting a second payment, and must never let a late
 * failure event downgrade money that settled. Pure Supabase, no Stripe
 * network: this proves our side of the contract deterministically.
 */
import { createHarness, day } from "./lib/harness.mjs";

const {
  admin, stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "stripe-",
  emailTag: "stripe",
});

try {
  const president = await makeUser("president");
  const { data: associationId } = await president.client.rpc("create_association", {
    p_name: "Webhook Contract HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Dana Whitcomb", p_founder_unit: "1",
    p_households: [{ name: "Marcus Bell", email: `resident-stripe-${stamp}@example.com`, unit: "2" }],
  });
  cleanup.associations.push(associationId);

  await president.client.from("bank_accounts").insert({
    association_id: associationId, kind: "operating",
    institution: "Willow Creek CU", mask: "6789",
  });
  await president.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "Assessment", p_due_on: day(-3),
  });
  const { data: units } = await admin.from("units").select("id").eq("association_id", associationId);
  const unit = units[0].id;

  // 1. The same succeeded event delivered twice is one payment on the books.
  const intentA = `pi_verify_a_${stamp}`;
  const { data: firstId, error: firstError } = await admin.rpc("record_payment", {
    p_unit_id: unit, p_amount_cents: 6000, p_rail: "ach",
    p_processor_fee_cents: 48, p_stripe_payment_intent_id: intentA,
  });
  check("the webhook (service role, no auth.uid) can record a payment", !firstError, firstError?.message ?? "");

  const { data: secondId, error: secondError } = await admin.rpc("record_payment", {
    p_unit_id: unit, p_amount_cents: 6000, p_rail: "ach",
    p_processor_fee_cents: 48, p_stripe_payment_intent_id: intentA,
  });
  check("a redelivered event returns the same payment", !secondError && secondId === firstId,
    secondError?.message ?? `${firstId} vs ${secondId}`);

  const { data: paymentsA } = await admin.from("payments").select("id").eq("stripe_payment_intent_id", intentA);
  check("one intent is one payment row", (paymentsA ?? []).length === 1, String((paymentsA ?? []).length));

  const { data: chargeLines } = await admin.from("charges").select("id").eq("unit_id", unit).eq("kind", "payment");
  check("one intent is one statement line", (chargeLines ?? []).length === 1, String((chargeLines ?? []).length));

  const { data: ledgerA } = await admin.from("ledger_entries").select("id").eq("association_id", associationId).eq("category", "Assessments");
  // The whole payment comes in and the fee leaves as its own line (0101);
  // the two net to what the bank receives.
  const { data: feeLines } = await admin.from("ledger_entries").select("amount_cents, category").eq("payment_id", firstId);
  const gross = (feeLines ?? []).filter((l) => l.category === "Assessments").reduce((t, l) => t + l.amount_cents, 0);
  const fee = (feeLines ?? []).filter((l) => l.category === "Processing fees").reduce((t, l) => t + l.amount_cents, 0);
  check("the ledger shows the payment whole and the processing fee as its own line", gross > 0 && fee === -48, `gross ${gross}, fee ${fee}`);
  check("one intent is one ledger entry", (ledgerA ?? []).length === 1, String((ledgerA ?? []).length));

  // 2. A pending row (the `processing` event) settles in place.
  const intentB = `pi_verify_b_${stamp}`;
  const { data: pendingRow } = await admin.from("payments").insert({
    association_id: associationId, unit_id: unit, amount_cents: 2500,
    rail: "ach", state: "pending", stripe_payment_intent_id: intentB,
  }).select("id").single();

  const { data: settledId, error: settleError } = await admin.rpc("record_payment", {
    p_unit_id: unit, p_amount_cents: 2500, p_rail: "ach",
    p_processor_fee_cents: 20, p_stripe_payment_intent_id: intentB,
  });
  check("a pending payment settles in place, not as a second row",
    !settleError && settledId === pendingRow.id, settleError?.message ?? `${pendingRow.id} vs ${settledId}`);

  const { data: settledRow } = await admin.from("payments").select("state, processor_fee_cents, settled_at").eq("id", pendingRow.id).single();
  check("the settled row carries the actual fee and a settled_at",
    settledRow?.state === "settled" && settledRow?.processor_fee_cents === 20 && Boolean(settledRow?.settled_at),
    JSON.stringify(settledRow));

  // 3. A late failure event never downgrades settled money. This is the
  // webhook's own guard (update ... where state = 'pending').
  const { data: downgraded } = await admin.from("payments")
    .update({ state: "failed" })
    .eq("stripe_payment_intent_id", intentB)
    .eq("state", "pending")
    .select("id");
  const { data: stillSettled } = await admin.from("payments").select("state").eq("id", pendingRow.id).single();
  check("a late payment_failed does not touch settled money",
    (downgraded ?? []).length === 0 && stillSettled?.state === "settled",
    `updated ${(downgraded ?? []).length}, state ${stillSettled?.state}`);

  // 4. A refund from the dashboard lands in the books once, however many
  // times Stripe says so, and never from a browser session.
  const { data: refundId, error: refundError } = await admin.rpc("record_refund", {
    p_stripe_payment_intent_id: intentA, p_amount_cents: 6000,
  });
  check("the webhook can record a refund", !refundError && refundId === firstId, refundError?.message ?? `${refundId}`);
  const { data: again } = await admin.rpc("record_refund", {
    p_stripe_payment_intent_id: intentA, p_amount_cents: 6000,
  });
  check("a redelivered refund is one refund", again === firstId, String(again));
  const { data: refunded } = await admin.from("payments").select("state").eq("id", firstId).single();
  const { data: refundLines } = await admin.from("charges").select("amount_cents").eq("unit_id", unit).ilike("label", "Refund%");
  // Refund lines only: the processing fee is its own negative line since 0101.
  const { data: refundLedger } = await admin.from("ledger_entries").select("amount_cents").eq("payment_id", firstId).lt("amount_cents", 0).neq("category", "Processing fees");
  check("a refund flips the payment, adds one statement line and one ledger line",
    refunded?.state === "refunded" && (refundLines ?? []).length === 1 && refundLines[0].amount_cents === 6000 && (refundLedger ?? []).length === 1 && refundLedger[0].amount_cents === -6000,
    `${refunded?.state}, ${(refundLines ?? []).length} lines, ${(refundLedger ?? []).length} ledger`);
  const { error: browserRefund } = await president.client.rpc("record_refund", {
    p_stripe_payment_intent_id: intentA, p_amount_cents: 1,
  });
  check("a signed-in person cannot record a refund", Boolean(browserRefund), browserRefund?.message ?? "allowed");

  // 5. Partial refunds, and a refund larger than what the statement was
  // credited (0070). Stripe sends the running total refunded on the charge,
  // so each call books the difference from the last. The $25.00 payment
  // from section 2 stands for a charge of $27.00: dues plus a $2.00 fee the
  // owner paid on top, as older payments were.
  const refundsOf = async () => {
    const { data: lines } = await admin.from("charges").select("amount_cents, category").eq("unit_id", unit).ilike("label", "Refund%");
    const { data: books } = await admin.from("ledger_entries").select("amount_cents").eq("payment_id", pendingRow.id).lt("amount_cents", 0).neq("category", "Processing fees");
    const { data: row } = await admin.from("payments").select("state, refunded_cents").eq("id", pendingRow.id).single();
    return {
      // Section 4 left one $60.00 line on this home's statement.
      statement: (lines ?? []).reduce((t, l) => t + l.amount_cents, 0) - 6000,
      lines: (lines ?? []).length - 1,
      asDues: (lines ?? []).filter((l) => l.category === "dues").length,
      books: (books ?? []).reduce((t, e) => t + e.amount_cents, 0),
      state: row?.state,
      total: row?.refunded_cents,
    };
  };

  await admin.rpc("record_refund", { p_stripe_payment_intent_id: intentB, p_amount_cents: 1000 });
  const first = await refundsOf();
  check("a partial refund books what came back and leaves the payment settled",
    first.statement === 1000 && first.books === -1000 && first.state === "settled" && first.total === 1000, JSON.stringify(first));

  await admin.rpc("record_refund", { p_stripe_payment_intent_id: intentB, p_amount_cents: 1800 });
  const second = await refundsOf();
  check("a second partial refund books only the difference",
    second.statement === 1800 && second.books === -1800 && second.lines === 2 && second.state === "settled", JSON.stringify(second));

  await admin.rpc("record_refund", { p_stripe_payment_intent_id: intentB, p_amount_cents: 1800 });
  await admin.rpc("record_refund", { p_stripe_payment_intent_id: intentB, p_amount_cents: 1000 });
  const replayed = await refundsOf();
  check("a redelivered or late event books nothing",
    replayed.statement === 1800 && replayed.books === -1800 && replayed.lines === 2, JSON.stringify(replayed));

  // A lost dispute takes back the rest (0093), once, however often Stripe says so.
  const { data: payB } = await admin.from("payments").select("amount_cents").eq("stripe_payment_intent_id", intentB).single();
  const disputeId = `dp_verify_${Date.now()}`;
  const lose = () => admin.rpc("record_dispute_loss", {
    p_stripe_payment_intent_id: intentB, p_dispute_id: disputeId, p_amount_cents: payB.amount_cents - 1800,
  });
  const { error: lostError } = await lose();
  const lost = await refundsOf();
  check("a lost dispute books the rest and the payment reads refunded",
    !lostError && lost.statement === payB.amount_cents && lost.books === -payB.amount_cents && lost.state === "refunded",
    lostError?.message ?? JSON.stringify(lost));
  await lose();
  const lostAgain = await refundsOf();
  check("the same dispute delivered twice books nothing more",
    lostAgain.statement === payB.amount_cents && lostAgain.books === -payB.amount_cents && lostAgain.lines === lost.lines, JSON.stringify(lostAgain));
  const { error: browserDispute } = await president.client.rpc("record_dispute_loss", {
    p_stripe_payment_intent_id: intentB, p_dispute_id: "dp_browser", p_amount_cents: 100,
  });
  check("a browser cannot record a lost dispute", Boolean(browserDispute), browserDispute?.message ?? "allowed");

  await admin.rpc("record_refund", { p_stripe_payment_intent_id: intentB, p_amount_cents: 2700 });
  const whole = await refundsOf();
  check("a full refund never puts more on the statement than the payment took off",
    whole.statement === 2500 && whole.state === "refunded" && whole.total === 2700, JSON.stringify(whole));
  check("while the books lose everything that left the bank", whole.books === -2700, String(whole.books));
  check("and no refund line is filed as dues", whole.asDues === 0, `${whole.asDues} lines`);

  // 6. A refund that arrives before its payment (0078). charge.refunded can
  // be delivered ahead of a delayed payment_intent.succeeded, and finds the
  // pending row. Booked there, a full refund marked the row refunded, and
  // record_payment then did nothing: the refund was on the books and the
  // payment never was. It has to book nothing and answer null, which the
  // webhook turns into "send it again".
  const intentC = `pi_verify_c_${stamp}`;
  const { data: waitingRow } = await admin.from("payments").insert({
    association_id: associationId, unit_id: unit, amount_cents: 3000,
    rail: "ach", state: "pending", stripe_payment_intent_id: intentC,
  }).select("id").single();
  const booksOf = async () => {
    const { data: lines } = await admin.from("charges").select("amount_cents").eq("unit_id", unit).ilike("label", "Refund%");
    const { data: credits } = await admin.from("charges").select("amount_cents").eq("unit_id", unit).eq("kind", "payment");
    // The fee line (0101) is neither a deposit nor a refund debit.
    const { data: books } = await admin.from("ledger_entries").select("amount_cents").eq("payment_id", waitingRow.id).neq("category", "Processing fees");
    const { data: row } = await admin.from("payments").select("state, refunded_cents").eq("id", waitingRow.id).single();
    return {
      refundLines: (lines ?? []).length,
      credits: (credits ?? []).length,
      debits: (books ?? []).filter((e) => e.amount_cents < 0).reduce((t, e) => t + e.amount_cents, 0),
      deposits: (books ?? []).filter((e) => e.amount_cents > 0).length,
      state: row?.state,
      total: row?.refunded_cents,
    };
  };
  const before = await booksOf();

  const { data: early, error: earlyError } = await admin.rpc("record_refund", {
    p_stripe_payment_intent_id: intentC, p_amount_cents: 3000,
  });
  const held = await booksOf();
  check("a refund against a payment still pending books nothing and answers null",
    !earlyError && early === null && held.state === "pending" && held.total === 0
      && held.refundLines === before.refundLines && held.debits === 0,
    earlyError?.message ?? `${early}, ${JSON.stringify(held)}`);

  const { data: lateId, error: lateError } = await admin.rpc("record_payment", {
    p_unit_id: unit, p_amount_cents: 3000, p_rail: "ach",
    p_processor_fee_cents: 24, p_stripe_payment_intent_id: intentC,
  });
  const arrived = await booksOf();
  check("the payment that arrives after it is still credited",
    !lateError && lateId === waitingRow.id && arrived.state === "settled"
      && arrived.credits === before.credits + 1 && arrived.deposits === 1,
    lateError?.message ?? JSON.stringify(arrived));

  const { data: resent } = await admin.rpc("record_refund", {
    p_stripe_payment_intent_id: intentC, p_amount_cents: 3000,
  });
  const settledThenRefunded = await booksOf();
  check("and the refund, sent again, is then booked once against it",
    resent === waitingRow.id && settledThenRefunded.state === "refunded" && settledThenRefunded.total === 3000
      && settledThenRefunded.refundLines === before.refundLines + 1 && settledThenRefunded.debits === -3000,
    `${resent}, ${JSON.stringify(settledThenRefunded)}`);
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
