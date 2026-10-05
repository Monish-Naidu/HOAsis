/**
 * The money loop, against the real database.
 *
 * A board founds an association, connects a bank, bills a period, and a
 * resident pays. Every place that payment has to appear is then checked, plus
 * the places it must not: a resident cannot pay for a neighbor, and billing the
 * same period twice must not double everyone's balance.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL(process.env.ENV_FILE ?? "../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const PASSWORD = "money-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };
const day = (o) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };

async function makeUser(who) {
  const email = `${who}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: who },
  });
  if (error) throw new Error(`${who}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw new Error(`sign in ${who}: ${e2.message}`);
  return { client, id: data.user.id, email };
}

try {
  const residentEmail = `resident-${stamp}@example.com`;
  const president = await makeUser("president");

  const { data: associationId } = await president.client.rpc("create_association", {
    p_name: "Money Loop HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Dana Whitcomb", p_founder_unit: "1",
    p_households: [{ name: "Marcus Bell", email: residentEmail, unit: "2" }],
  });
  cleanup.associations.push(associationId);

  // An association's books open on the day it was founded unless told
  // otherwise (0056), and this one bills a period that fell due last week.
  await admin.from("associations").update({ billing_starts_on: day(-60) }).eq("id", associationId);

  // The bank the money lands in.
  const { error: bankError } = await president.client.from("bank_accounts").insert({
    association_id: associationId, kind: "operating",
    institution: "Willow Creek CU", mask: "6789",
  });
  check("a finance holder can connect a bank account", !bankError, bankError?.message ?? "");

  // Bill the period.
  const { data: billed } = await president.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "September assessment", p_due_on: day(-3),
  });
  check("billing charges every home once", billed === 2, `${billed} homes billed`);

  const { data: again } = await president.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "September assessment", p_due_on: day(-3),
  });
  check("billing the same period twice adds nothing", again === 0, `${again} extra`);

  // The resident claims their invited seat and pays.
  const resident = await makeUser("resident");
  const { data: theirs } = await resident.client.rpc("my_associations");
  check("the invited resident is in the association", (theirs ?? []).length === 1, String((theirs ?? []).length));

  const { data: myUnits } = await resident.client.rpc("my_unit_ids");
  const myUnit = (myUnits ?? [])[0];

  const { data: before } = await resident.client.from("unit_balances").select("balance_cents").eq("unit_id", myUnit).single();
  check("the resident owes the assessment", before?.balance_cents === 6000, String(before?.balance_cents));

  // An owner cannot write their own payment: that cleared a balance with no
  // money moving (0062). A real one is written by the server when the
  // processor says it settled, which is what the admin client stands for here.
  const { error: selfPayError } = await resident.client.rpc("record_payment", {
    p_unit_id: myUnit, p_amount_cents: 6000, p_rail: "ach", p_processor_fee_cents: 35,
  });
  check("a resident cannot record their own payment", selfPayError?.code === "42501", selfPayError?.message?.slice(0, 45) ?? "no error");

  const { data: paymentId, error: payError } = await admin.rpc("record_payment", {
    p_unit_id: myUnit, p_amount_cents: 6000, p_rail: "ach", p_processor_fee_cents: 35, p_paid_by: resident.id,
  });
  check("a settled payment reaches the resident's statement", !payError && Boolean(paymentId), payError?.message ?? "");

  const { data: after } = await resident.client.from("unit_balances").select("balance_cents").eq("unit_id", myUnit).single();
  check("their balance clears", after?.balance_cents === 0, String(after?.balance_cents));

  const { data: statement } = await resident.client.from("charges").select("kind, amount_cents").eq("unit_id", myUnit);
  check("the payment shows on their statement",
    (statement ?? []).some((c) => c.kind === "payment" && c.amount_cents === -6000),
    JSON.stringify(statement));

  // The board's books, net of what the processor took.
  const { data: ledger } = await president.client.from("ledger_entries").select("amount_cents, category, confirmed_at").eq("association_id", associationId);
  check("the books show the deposit net of the processor's cut",
    (ledger ?? []).some((e) => e.amount_cents === 6000 - 35 && e.category === "Assessments"),
    JSON.stringify((ledger ?? []).map((e) => e.amount_cents)));
  check("money we moved ourselves needs no human confirmation",
    (ledger ?? [])[0]?.confirmed_at !== null, String((ledger ?? [])[0]?.confirmed_at));

  // What the payment cleared.
  const { data: allocations } = await resident.client.from("payment_allocations").select("amount_cents");
  check("the payment is allocated to the charge it cleared",
    (allocations ?? []).length === 1 && allocations[0].amount_cents === 6000,
    JSON.stringify(allocations));

  // And what must not be possible.
  const { data: allUnits } = await admin.from("units").select("id, label").eq("association_id", associationId);
  const neighborUnit = (allUnits ?? []).find((u) => u.id !== myUnit);
  const { error: neighborError } = await resident.client.rpc("record_payment", {
    p_unit_id: neighborUnit.id, p_amount_cents: 100, p_rail: "ach",
  });
  check("a resident cannot record a payment for a neighbor", Boolean(neighborError), neighborError?.message?.slice(0, 45) ?? "no error");

  const { error: billError } = await resident.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "Sneaky", p_due_on: day(-1),
  });
  check("a resident cannot bill the association", Boolean(billError), billError?.message?.slice(0, 45) ?? "no error");

  // A visitor with no session holds the public key and nothing else. Each of
  // these once took them for the server, because both have no user id.
  const nobody = anon();
  const refused = (e) => Boolean(e) && /permission denied|42501/.test(`${e.code} ${e.message}`);
  const { error: anonPay } = await nobody.rpc("record_payment", { p_unit_id: myUnit, p_amount_cents: 100, p_rail: "ach" });
  check("a signed out visitor cannot record a payment", refused(anonPay), anonPay?.message?.slice(0, 60) ?? "no error");
  const { error: anonBill } = await nobody.rpc("issue_assessment", { p_association_id: associationId, p_label: "Sneaky", p_due_on: day(-1) });
  check("a signed out visitor cannot bill the association", refused(anonBill), anonBill?.message?.slice(0, 60) ?? "no error");
  const { error: anonFees } = await nobody.rpc("assess_late_fees", { p_association_id: associationId });
  check("a signed out visitor cannot post late fees", refused(anonFees), anonFees?.message?.slice(0, 60) ?? "no error");
  const { error: anonRefund } = await nobody.rpc("record_refund", { p_stripe_payment_intent_id: "pi_nothing", p_amount_cents: 100 });
  check("a signed out visitor cannot record a refund", refused(anonRefund), anonRefund?.message?.slice(0, 60) ?? "no error");
  const { error: memberRefund } = await president.client.rpc("record_refund", { p_stripe_payment_intent_id: "pi_nothing", p_amount_cents: 100 });
  check("nor can a signed in board member", refused(memberRefund), memberRefund?.message?.slice(0, 60) ?? "no error");
  const { error: forged } = await resident.client.rpc("record_activity", {
    p_association: associationId, p_kind: "association", p_subject: associationId, p_summary: "Forged",
  });
  check("nobody can write the activity record by hand", refused(forged), forged?.message?.slice(0, 60) ?? "no error");

  // A treasurer recording a cheque that arrived in the post.
  const { error: boardPayError } = await president.client.rpc("record_payment", {
    p_unit_id: neighborUnit.id, p_amount_cents: 6000, p_rail: "ach",
  });
  check("a finance holder can record a payment for any home", !boardPayError, boardPayError?.message ?? "");

  // A check handed to the treasurer (0083). record_payment cannot take it:
  // it knows only the processor rails and stamps the line "Card payment". A
  // fresh period is billed first so the neighbor owes $60 to pay.
  await president.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "Check period", p_due_on: day(-5),
  });
  // Read as the President: the balance view answers a signed-in seat and
  // gives the service role no rows.
  const { data: owedBefore } = await president.client.from("unit_balances").select("balance_cents").eq("unit_id", neighborUnit.id).single();
  const { data: checkId, error: checkError } = await president.client.rpc("record_manual_payment", {
    p_unit_id: neighborUnit.id, p_amount_cents: 6000, p_method: "check", p_reference: "1042", p_received_on: day(-1),
  });
  check("a finance holder records a $60 check", !checkError && Boolean(checkId), checkError?.message ?? "");
  const { data: owedAfter } = await president.client.from("unit_balances").select("balance_cents").eq("unit_id", neighborUnit.id).single();
  check("the check clears the balance", owedBefore?.balance_cents === 6000 && owedAfter?.balance_cents === 0,
    `${owedBefore?.balance_cents} then ${owedAfter?.balance_cents}`);
  const { data: neighborLines } = await admin.from("charges").select("kind, label, amount_cents").eq("unit_id", neighborUnit.id);
  check("the statement line reads Check payment #1042",
    (neighborLines ?? []).some((c) => c.kind === "payment" && c.label === "Check payment #1042" && c.amount_cents === -6000),
    JSON.stringify(neighborLines));
  const { data: checkPayment } = await admin.from("payments").select("rail, state, processor_fee_cents, platform_fee_cents").eq("id", checkId).single();
  check("it is a settled payment on the check rail with no fee",
    checkPayment?.rail === "check" && checkPayment?.state === "settled" &&
      checkPayment?.processor_fee_cents === 0 && checkPayment?.platform_fee_cents === 0,
    JSON.stringify(checkPayment));
  const { data: checkLedger } = await president.client.from("ledger_entries").select("amount_cents, category, confirmed_at, occurred_on").eq("payment_id", checkId);
  check("the ledger shows $60 in, with no fee taken out, confirmed",
    (checkLedger ?? []).length === 1 && checkLedger[0].amount_cents === 6000 &&
      checkLedger[0].category === "Assessments" && checkLedger[0].confirmed_at !== null && checkLedger[0].occurred_on === day(-1),
    JSON.stringify(checkLedger));
  const { data: checkAllocations } = await admin.from("payment_allocations").select("amount_cents").eq("payment_id", checkId);
  check("the check is allocated to the charge it cleared",
    (checkAllocations ?? []).length === 1 && checkAllocations[0].amount_cents === 6000, JSON.stringify(checkAllocations));
  const { error: residentCheck } = await resident.client.rpc("record_manual_payment", {
    p_unit_id: myUnit, p_amount_cents: 100, p_method: "check", p_reference: "1", p_received_on: day(0),
  });
  check("a resident cannot record a check", residentCheck?.code === "42501", residentCheck?.message?.slice(0, 45) ?? "no error");
  const { error: anonCheck } = await nobody.rpc("record_manual_payment", {
    p_unit_id: myUnit, p_amount_cents: 100, p_method: "check", p_reference: "1", p_received_on: day(0),
  });
  check("a signed out visitor cannot record a check", refused(anonCheck), anonCheck?.message?.slice(0, 60) ?? "no error");
  const { error: futureCheck } = await president.client.rpc("record_manual_payment", {
    p_unit_id: neighborUnit.id, p_amount_cents: 100, p_method: "check", p_reference: "2", p_received_on: day(5),
  });
  check("a check cannot be dated in the future", Boolean(futureCheck), futureCheck?.message?.slice(0, 60) ?? "no error");
  const { error: badMethod } = await president.client.rpc("record_manual_payment", {
    p_unit_id: neighborUnit.id, p_amount_cents: 100, p_method: "bitcoin", p_reference: "", p_received_on: day(0),
  });
  check("a method that is not check, cash or other is refused", Boolean(badMethod), badMethod?.message?.slice(0, 60) ?? "no error");
  const { data: cashId, error: cashError } = await president.client.rpc("record_manual_payment", {
    p_unit_id: neighborUnit.id, p_amount_cents: 500, p_method: "cash", p_reference: "", p_received_on: day(0),
  });
  const { data: cashLine } = await admin.from("charges").select("label").eq("unit_id", neighborUnit.id).eq("label", "Cash payment");
  check("cash reads Cash payment with no number", !cashError && Boolean(cashId) && (cashLine ?? []).length === 1, cashError?.message ?? JSON.stringify(cashLine));

  // Runs that overlap (0069). The cron delivered twice, or a board member
  // pressing "bill dues now" while it runs: each call used to look for an
  // existing bill before the other had committed, and every home got two.
  // Six at once, last in the script so the extra period disturbs nothing
  // above. Before the lock this failed only when the calls really did
  // interleave, so a pass on an old database proves little; a failure on a
  // new one proves a lot.
  const together = await Promise.all(Array.from({ length: 6 }, () =>
    admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "August assessment", p_due_on: day(-33) })));
  const billedTogether = together.reduce((t, r) => t + (r.data ?? 0), 0);
  const { data: augustLines } = await admin.from("charges").select("unit_id")
    .eq("association_id", associationId).eq("category", "dues").eq("due_on", day(-33));
  check("six billing runs at once bill each home once",
    together.every((r) => !r.error) && billedTogether === 2 && (augustLines ?? []).length === 2,
    `${billedTogether} reported, ${(augustLines ?? []).length} lines, ${together.find((r) => r.error)?.error?.message ?? "no errors"}`);
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) {
    // A cleanup that fails leaves this association in the live project,
    // where the dues cron goes on billing it. So it fails the run.
    const { error } = await admin.from("associations").delete().eq("id", id);
    if (error) check("cleanup removed the association", false, error.message);
  }
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
