/**
 * The three onboarding answers, kept.
 *
 * They were asked, answered, then discarded on the server path, so a real
 * board got the generic plan. That is the one outcome the questions exist to
 * prevent, and it only happened for signed in users, which is everybody real.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

const stamp = Date.now();
const PASSWORD = "profile-" + Math.random().toString(36).slice(2) + "A1";
const results = [];
let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };

try {
  const email = `founder-${stamp}@example.com`;
  const { data: created } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Pat Founder" },
  });
  cleanup.users.push(created.user.id);
  const client = anon();
  await client.auth.signInWithPassword({ email, password: PASSWORD });

  const { data: id, error } = await client.rpc("create_association", {
    p_name: "Harbor Point Condominiums", p_city: "Kirkland", p_state: "WA",
    p_dues_cents: 41_000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "101",
    p_households: [{ name: "Marcus Bell", email: `m-${stamp}@example.com`, unit: "102" }],
    p_property_type: "condos",
    p_origin: "leaving-manager",
    p_collects: ["utilities"],
    p_shared_spaces: ["pool", "gym"],
  });
  check("an association can be founded with its profile", !error && Boolean(id), error?.message ?? "");
  if (id) cleanup.associations.push(id);

  const { data: back } = await client
    .from("associations")
    .select("property_type, origin, collects, shared_spaces")
    .eq("id", id).single();

  check("the property type survives", back?.property_type === "condos", back?.property_type ?? "null");
  check("where they came from survives", back?.origin === "leaving-manager", back?.origin ?? "null");
  check("what they collect survives", JSON.stringify(back?.collects) === '["utilities"]', JSON.stringify(back?.collects));
  check("the shared spaces survive", JSON.stringify(back?.shared_spaces) === '["pool","gym"]', JSON.stringify(back?.shared_spaces));

  // Founding without answers still has to work: the browser path lets somebody
  // explore before signing up, and an older client will not send them.
  const { data: bare, error: bareError } = await client.rpc("create_association", {
    p_name: "Bare Minimum HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 9_000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
  });
  check("founding without a profile still works", !bareError && Boolean(bare), bareError?.message ?? "");
  if (bare) cleanup.associations.push(bare);

  const { data: empty } = await client
    .from("associations").select("property_type, collects").eq("id", bare).single();
  check(
    "and leaves the profile empty rather than guessing",
    empty?.property_type === null && JSON.stringify(empty?.collects) === "[]",
    `${empty?.property_type} ${JSON.stringify(empty?.collects)}`,
  );

  const { data: units } = await admin
    .from("units").select("label").eq("association_id", id).order("label");
  check("the roster is unaffected by the new arguments", units?.length === 2, `${units?.length} units`);
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) {
    await admin.from("memberships").update({ role: "resident" })
      .eq("association_id", id).eq("role", "president");
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
