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
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
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

  const { data: paymentId, error: payError } = await resident.client.rpc("record_payment", {
    p_unit_id: myUnit, p_amount_cents: 6000, p_rail: "ach", p_processor_fee_cents: 35,
  });
  check("a resident can pay their own assessment", !payError && Boolean(paymentId), payError?.message ?? "");

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

  // A treasurer recording a cheque that arrived in the post.
  const { error: boardPayError } = await president.client.rpc("record_payment", {
    p_unit_id: neighborUnit.id, p_amount_cents: 6000, p_rail: "ach",
  });
  check("a finance holder can record a payment for any home", !boardPayError, boardPayError?.message ?? "");
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) await admin.from("associations").delete().eq("id", id);
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
