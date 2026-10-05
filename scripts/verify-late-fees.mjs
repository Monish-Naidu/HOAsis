/**
 * Late fees post once, only when owed, only past the policy's notice day.
 *
 * Founds a throwaway association, bills a period forty days ago, and runs
 * assess_late_fees the way the cron does. Then pays one home and runs it
 * again. Pure Supabase; cleaned up at the end.
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
const PASSWORD = "latefee-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };
const day = (o) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };

async function makeUser(who) {
  const email = `${who}-latefee-${stamp}@example.com`;
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
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Late Fee Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Robin Owner", email: `robin-latefee-${stamp}@example.com`, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  // Books start early enough that a bill dated forty days ago is allowed.
  await admin.from("associations").update({ billing_starts_on: day(-60) }).eq("id", associationId);

  const { data: billed } = await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Test dues", p_due_on: day(-40) });
  check("two homes were billed forty days ago", billed === 2, String(billed));

  const { data: units } = await admin.from("units").select("id, label").eq("association_id", associationId).order("label");
  const unitA = units[0].id, unitB = units[1].id;

  // Before the notice day: nothing.
  const { data: early } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(-20) });
  check("no fee before the notice day", early === 0, String(early));

  // Past it: one fee per unpaid home, once.
  const { data: first, error: firstError } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("one fee per unpaid home past the notice day", !firstError && first === 2, firstError?.message ?? String(first));
  const { data: again } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("a second run the same day posts nothing", again === 0, String(again));
  const { data: fees } = await admin.from("charges").select("unit_id, label, amount_cents, category").eq("association_id", associationId).eq("category", "late_fee");
  check("fees are $25 lines labelled after the period", (fees ?? []).length === 2 && fees.every((f) => f.amount_cents === 2500 && f.label === "Late fee, Test dues"), JSON.stringify(fees));

  // A home that paid before the notice day gets no fee. Bill a fresh period
  // and pay one home in full, then run past the notice day.
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Second dues", p_due_on: day(-35) });
  await admin.rpc("record_payment", { p_unit_id: unitA, p_amount_cents: 22500, p_rail: "ach", p_processor_fee_cents: 0 });
  const { data: second } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  const { data: feesB } = await admin.from("charges").select("unit_id").eq("association_id", associationId).eq("category", "late_fee").eq("label", "Late fee, Second dues");
  check("only the unpaid home gets the second period's fee", second === 1 && (feesB ?? []).length === 1 && feesB[0].unit_id === unitB, `${second}, ${JSON.stringify(feesB)}`);

  // A home that paid ahead owes nothing when the bill arrives, and gets no
  // fee. The payment was made before the line existed, so nothing was ever
  // applied to it; reading "unpaid" off those rows fined a paid up home
  // every month its credit lasted (fixed in 0062).
  await admin.rpc("record_payment", { p_unit_id: unitA, p_amount_cents: 10000, p_rail: "ach", p_processor_fee_cents: 0 });
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Fourth dues", p_due_on: day(-31) });
  const { data: ahead } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  const { data: feesD } = await admin.from("charges").select("unit_id").eq("association_id", associationId).eq("category", "late_fee").eq("label", "Late fee, Fourth dues");
  check("a home that paid ahead gets no fee", ahead === 1 && (feesD ?? []).length === 1 && feesD[0].unit_id === unitB, `${ahead}, ${JSON.stringify(feesD)}`);

  // A bank payment still clearing holds the fee off until it lands or fails.
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Fifth dues", p_due_on: day(-30) });
  const { data: pendingRow } = await admin.from("payments").insert({
    association_id: associationId, unit_id: unitB, amount_cents: 47500, rail: "ach", state: "pending",
  }).select("id").single();
  const { data: held } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  const { data: feesE } = await admin.from("charges").select("unit_id").eq("association_id", associationId).eq("category", "late_fee").eq("label", "Late fee, Fifth dues");
  check("a payment still clearing holds the fee off", (feesE ?? []).every((f) => f.unit_id !== unitB), `${held}, ${JSON.stringify(feesE)}`);
  await admin.from("payments").update({ state: "failed" }).eq("id", pendingRow?.id ?? "");
  const { data: after } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("and it posts once that payment fails", after === 1, String(after));

  // The board's own policy is honoured: no fee when it says zero.
  const { error: policyError } = await admin.from("associations").update({ settings: { collectionPolicy: { lateFeeCents: 0 } } }).eq("id", associationId);
  check("the policy change is saved", !policyError, policyError?.message ?? "");
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Third dues", p_due_on: day(-45) });
  const { data: none } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("a policy with no fee posts none", none === 0, String(none));

  // A resident cannot run it.
  const resident = await makeUser("resident");
  const { error: refused } = await resident.client.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("someone without finances is refused", Boolean(refused), refused?.message ?? "allowed");
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
