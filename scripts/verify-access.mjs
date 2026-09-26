/**
 * Seeing without touching, and the record of who did what.
 *
 * Founds a throwaway association, seats a viewer, and proves: a seat with
 * `views` reads the books and cannot write them; a seat with neither sees
 * nothing; every board action lands in `activity`; nobody can edit or delete
 * an activity row. Pure Supabase, cleaned up at the end.
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
const PASSWORD = "access-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };

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

  await admin.from("bank_accounts").insert({ association_id: associationId, kind: "operating", institution: "Test CU", mask: "1234" });
  await admin.from("ledger_entries").insert({ association_id: associationId, occurred_on: "2026-09-01", description: "Opening", counterparty: "", category: "Assessments", amount_cents: 500, confirmed_at: new Date().toISOString() });

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
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) await admin.from("associations").delete().eq("id", id);
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
