/**
 * Seeing without touching, and the record of who did what.
 *
 * Founds a throwaway association, seats a viewer, and proves: a seat with
 * `views` reads the books and cannot write them; a seat with neither sees
 * nothing; every board action lands in `activity`; nobody can edit or delete
 * an activity row. Then the statements (0064): a viewer reads every home's
 * charges, payments and balance and the real account balance, an owner
 * still reads only their own, and the overview's two corrected figures.
 * Pure Supabase, cleaned up at the end.
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
const PASSWORD = "access-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };
const day = (o) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };

async function makeUser(who) {
  const email = `${who}-access-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: who } });
  if (error) throw new Error(`${who}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw new Error(`sign in ${who}: ${e2.message}`);
  return { client, id: data.user.id, email };
}

try {
  const president = await makeUser("president");
  const viewer = await makeUser("viewer");
  const nobody = await makeUser("nobody");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Access Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [
      { name: "Vic Viewer", email: viewer.email, unit: "2" },
      { name: "Nell Nobody", email: nobody.email, unit: "3" },
    ],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await viewer.client.rpc("claim_my_seats");
  await nobody.client.rpc("claim_my_seats");

  const { data: bank } = await admin.from("bank_accounts").insert({ association_id: associationId, kind: "operating", institution: "Test CU", mask: "1234" }).select("id").single();
  await admin.from("ledger_entries").insert({ association_id: associationId, bank_account_id: bank?.id ?? null, occurred_on: "2026-09-01", description: "Opening", counterparty: "", category: "Assessments", amount_cents: 500, confirmed_at: new Date().toISOString() });

  // 1. A resident with neither list sees no books.
  const { data: hidden } = await viewer.client.from("ledger_entries").select("id").eq("association_id", associationId);
  check("an owner with no access sees no ledger", (hidden ?? []).length === 0, String((hidden ?? []).length));

  // 2. The President gives a viewer's seat: finances to see, nothing to change.
  const { error: grantError } = await president.client.from("memberships")
    .update({ role: "treasurer", capabilities: [], views: ["finances"] })
    .eq("association_id", associationId).eq("profile_id", viewer.id).is("ends_on", null);
  check("the President can hand out a viewer's seat", !grantError, grantError?.message ?? "");

  const { data: seen } = await viewer.client.from("ledger_entries").select("id").eq("association_id", associationId);
  check("a viewer reads the ledger", (seen ?? []).length === 1, String((seen ?? []).length));
  const { data: banks } = await viewer.client.from("bank_accounts").select("id").eq("association_id", associationId);
  check("a viewer reads the bank accounts", (banks ?? []).length === 1, String((banks ?? []).length));

  const { data: wrote, error: writeError } = await viewer.client.from("ledger_entries")
    .insert({ association_id: associationId, occurred_on: "2026-09-02", description: "Sneak", counterparty: "", category: "Assessments", amount_cents: 1 }).select("id");
  check("a viewer cannot write the ledger", Boolean(writeError) || (wrote ?? []).length === 0, writeError?.message ?? "wrote a row");
  const { data: canView } = await viewer.client.rpc("can_view", { target: associationId, area: "finances" });
  const { data: hasCap } = await viewer.client.rpc("has_capability", { target: associationId, needed: "finances" });
  check("can_view says yes and has_capability says no", canView === true && hasCap === false, `${canView}/${hasCap}`);

  // 3. Still nothing for the owner with neither.
  const { data: still } = await nobody.client.from("ledger_entries").select("id").eq("association_id", associationId);
  check("an owner with neither list still sees nothing", (still ?? []).length === 0, String((still ?? []).length));

  // 4. Activity recorded the seat change, with the President's name.
  const { data: rows } = await admin.from("activity").select("actor_name, subject_kind, summary").eq("association_id", associationId).order("at", { ascending: false });
  const seatRows = (rows ?? []).filter((r) => r.subject_kind === "seat");
  check("the seat change is on the record", seatRows.some((r) => /Vic Viewer is now treasurer/.test(r.summary)), JSON.stringify(seatRows.map((r) => r.summary)));
  check("the record names who did it", seatRows.every((r) => r.actor_name === "Pat Founder"), JSON.stringify([...new Set(seatRows.map((r) => r.actor_name))]));
  check("the bank account connection is on the record", (rows ?? []).some((r) => r.subject_kind === "bank_account" && /connected/.test(r.summary)), "");

  // 5. Settings-viewers read it; owners without Settings do not; nobody edits it.
  const { data: viewerSees } = await viewer.client.from("activity").select("id").eq("association_id", associationId);
  check("a seat without Settings cannot read the record", (viewerSees ?? []).length === 0, String((viewerSees ?? []).length));
  const { data: presidentSees } = await president.client.from("activity").select("id").eq("association_id", associationId);
  check("the President reads the record", (presidentSees ?? []).length >= 2, String((presidentSees ?? []).length));
  const { data: deleted } = await president.client.from("activity").delete().eq("association_id", associationId).select("id");
  const { data: updated } = await president.client.from("activity").update({ summary: "x" }).eq("association_id", associationId).select("id");
  const { count: after } = await admin.from("activity").select("id", { count: "exact", head: true }).eq("association_id", associationId);
  check("nobody can delete or rewrite the record", (deleted ?? []).length === 0 && (updated ?? []).length === 0 && (after ?? 0) >= 2, `deleted ${(deleted ?? []).length}, updated ${(updated ?? []).length}, left ${after}`);

  // 6. The statements. Until 0064 a viewer got the bank rows with no
  // balances and every home but their own as paid up, because charges,
  // payments, the balance view and the overview still asked for the change
  // right. The viewer sits at unit 2; unit 3 belongs to the owner with
  // neither list.
  const { data: homes } = await admin.from("units").select("id, label").eq("association_id", associationId);
  const unit2 = (homes ?? []).find((u) => u.label === "2")?.id;
  const unit3 = (homes ?? []).find((u) => u.label === "3")?.id;
  await admin.from("charges").insert({ association_id: associationId, unit_id: unit3, kind: "charge", category: "dues", label: "September dues", amount_cents: 10000, due_on: day(-10) });
  const { error: paidError } = await admin.rpc("record_payment", { p_unit_id: unit3, p_amount_cents: 4000, p_rail: "ach", p_paid_by: nobody.id });
  if (paidError) throw new Error(`record_payment: ${paidError.message}`);
  await admin.from("autopay_runs").insert({ association_id: associationId, unit_id: unit3, month: "2026-09", state: "skipped", reason: "verify" });
  const { data: owed3 } = await admin.from("charges").select("amount_cents").eq("unit_id", unit3).lte("due_on", day(0));
  const balance3 = (owed3 ?? []).reduce((t, c) => t + c.amount_cents, 0);

  const { data: theirCharges } = await viewer.client.from("charges").select("unit_id").eq("unit_id", unit3);
  check("a viewer reads another home's statement", (theirCharges ?? []).length >= 2, String((theirCharges ?? []).length));
  const { data: theirPayments } = await viewer.client.from("payments").select("id").eq("unit_id", unit3);
  check("a viewer reads another home's payments", (theirPayments ?? []).length === 1, String((theirPayments ?? []).length));
  const { data: theirAllocations } = await viewer.client.from("payment_allocations").select("amount_cents");
  check("and what each payment cleared", (theirAllocations ?? []).length === 1 && theirAllocations[0].amount_cents === 4000, JSON.stringify(theirAllocations));
  const { data: theirRuns } = await viewer.client.from("autopay_runs").select("id").eq("unit_id", unit3);
  check("a viewer reads another home's autopay runs", (theirRuns ?? []).length === 1, String((theirRuns ?? []).length));
  const { data: viewerBalances } = await viewer.client.from("unit_balances").select("unit_id, balance_cents").eq("association_id", associationId);
  check("a viewer sees every home's balance, and the true one",
    (viewerBalances ?? []).length === 3 && (viewerBalances ?? []).find((b) => b.unit_id === unit3)?.balance_cents === balance3 && balance3 > 0,
    JSON.stringify(viewerBalances));
  const { error: viewerCharge } = await viewer.client.from("charges").insert({ association_id: associationId, unit_id: unit3, kind: "credit", label: "Sneak", amount_cents: -100, due_on: day(0) });
  check("a viewer still cannot write a statement line", Boolean(viewerCharge), viewerCharge?.code ?? "wrote a row");
  const { error: viewerPay } = await viewer.client.rpc("record_payment", { p_unit_id: unit3, p_amount_cents: 100, p_rail: "ach" });
  check("nor record a payment", viewerPay?.code === "42501", viewerPay?.message?.slice(0, 50) ?? "no error");

  const { data: viewerOverview, error: overviewError } = await viewer.client.rpc("association_overview", { p_association_id: associationId, p_from: day(-365) });
  const viewerUnits = viewerOverview?.units ?? [];
  const viewerAccounts = viewerOverview?.ledger?.accounts ?? [];
  check("the overview gives a viewer every home", !overviewError && viewerUnits.length === 3 && Number(viewerUnits.find((u) => u.unit_id === unit3)?.balance_cents) === balance3,
    overviewError?.message ?? JSON.stringify(viewerUnits.map((u) => u.balance_cents)));
  // The opening line and the payment the server just recorded, both confirmed.
  check("and the real balance of the bank account, not zero", viewerAccounts.length === 1 && Number(viewerAccounts[0].balance_cents) === 4500,
    JSON.stringify(viewerAccounts));

  // The owner with neither list keeps their own statement and gains nothing.
  const { data: ownCharges } = await nobody.client.from("charges").select("unit_id");
  check("an owner still reads their own statement, and only theirs",
    (ownCharges ?? []).length >= 2 && (ownCharges ?? []).every((c) => c.unit_id === unit3), JSON.stringify((ownCharges ?? []).map((c) => c.unit_id === unit3)));
  const { data: ownBalances } = await nobody.client.from("unit_balances").select("unit_id, balance_cents");
  check("and their own balance, with no row for a neighbour",
    (ownBalances ?? []).length === 1 && ownBalances[0].unit_id === unit3 && ownBalances[0].balance_cents === balance3, JSON.stringify(ownBalances));
  const { data: ownOverview } = await nobody.client.rpc("association_overview", { p_association_id: associationId, p_from: day(-365) });
  check("the overview gives an owner their own home and no accounts",
    (ownOverview?.units ?? []).length === 1 && ownOverview.units[0].unit_id === unit3 && (ownOverview?.ledger?.accounts ?? []).length === 0,
    `${(ownOverview?.units ?? []).length} homes, ${(ownOverview?.ledger?.accounts ?? []).length} accounts`);

  // 7. Late fees owed never exceed what the home owes. Unit 2 was billed
  // $300 and a $25 fee and paid $310: it owes $15, so $15 of fees at most.
  const { error: feeRowsError } = await admin.from("charges").insert([
    { association_id: associationId, unit_id: unit2, kind: "charge", category: "dues", label: "August dues", amount_cents: 30000, due_on: day(-40) },
    { association_id: associationId, unit_id: unit2, kind: "charge", category: "late_fee", label: "Late fee, August dues", amount_cents: 2500, due_on: day(-9) },
    // Every row names its category: a bulk insert sends null for a key one
    // row leaves out, and the column refuses null.
    { association_id: associationId, unit_id: unit2, kind: "payment", category: "dues", label: "Bank payment", amount_cents: -31000, due_on: day(-2) },
  ]);
  // 8. A line waiting on review stays out of the month sums. Both lines sit
  // before the window asked for, so the server sums them.
  await admin.from("ledger_entries").insert([
    { association_id: associationId, bank_account_id: bank?.id ?? null, occurred_on: "2020-01-15", description: "Held", counterparty: "", category: "Landscaping", amount_cents: -999 },
    { association_id: associationId, bank_account_id: bank?.id ?? null, occurred_on: "2020-01-16", description: "Confirmed", counterparty: "", category: "Landscaping", amount_cents: -700, confirmed_at: new Date().toISOString() },
  ]);
  const { data: boardOverview, error: boardOverviewError } = await president.client.rpc("association_overview", { p_association_id: associationId, p_from: "2021-01-01" });
  const home2 = (boardOverview?.units ?? []).find((u) => u.unit_id === unit2);
  check("the statement for the fee case is written", !feeRowsError, feeRowsError?.message ?? "");
  check("late fees owed are capped at the balance", !boardOverviewError && Number(home2?.balance_cents) === 1500 && Number(home2?.late_fees_owed_cents) === 1500,
    boardOverviewError?.message ?? `balance ${home2?.balance_cents}, fees ${home2?.late_fees_owed_cents}`);
  const january = (boardOverview?.ledger?.months ?? []).filter((m) => m.month === "2020-01");
  check("a line waiting on review is left out of the month sums",
    january.length === 1 && Number(january[0].out_cents) === 700 && Number(january[0].count) === 1, JSON.stringify(january));
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
