/**
 * Moves board seats that still carry the pre-2026-09-26 role defaults to
 * the new ones. A seat a President has adjusted by hand is left alone: only
 * an exact match on the old default set is touched. Safe to run twice.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const GRANTABLE = ["finances", "requests", "documents", "communications", "voting", "vendors", "compliance", "forum", "settings"];
const NEW = {
  "vice-president": GRANTABLE,
  treasurer: ["finances", "vendors", "documents", "communications", "compliance"],
  secretary: ["documents", "communications", "voting", "requests", "compliance", "forum"],
};
const OLD = {
  "vice-president": ["requests", "documents", "communications", "voting", "forum"],
  treasurer: ["finances", "vendors", "documents"],
  secretary: ["documents", "communications", "voting", "compliance", "forum"],
};
const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

const { data: seats, error } = await admin
  .from("memberships").select("id, full_name, role, capabilities, associations(name)")
  .in("role", Object.keys(NEW)).is("ends_on", null);
if (error) { console.error(error.message); process.exit(1); }

let moved = 0;
for (const seat of seats ?? []) {
  const caps = seat.capabilities ?? [];
  if (!same(caps, OLD[seat.role])) { console.log(`  kept  ${seat.associations?.name}: ${seat.full_name} (${seat.role}, adjusted by hand)`); continue; }
  const { error: e } = await admin.from("memberships").update({ capabilities: NEW[seat.role] }).eq("id", seat.id);
  if (e) { console.log(`  FAIL  ${seat.full_name}: ${e.message}`); continue; }
  moved++;
  console.log(`  moved ${seat.associations?.name}: ${seat.full_name} (${seat.role}) to the new default`);
}
console.log(`\n${moved} seat${moved === 1 ? "" : "s"} moved`);
