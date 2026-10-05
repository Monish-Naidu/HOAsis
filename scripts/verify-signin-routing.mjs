/**
 * Where each kind of person lands after confirming their email.
 *
 * Three states, three destinations, and the one that matters most is the
 * resident whose board already added them: they should arrive at their own
 * balance without anyone explaining anything to them.
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
const PASSWORD = "route-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };

/** The same decision the callback route makes, so the test covers the rule. */
function destinationFor(memberships) {
  if (!memberships.length) return "/start";
  return memberships.some((m) => m.role !== "resident") ? "/board" : "/resident";
}

async function makeUser(who, email) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: who },
  });
  if (error) throw new Error(`${who}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  return { client, id: data.user.id };
}

try {
  // 1. Somebody brand new, belonging to nothing.
  const founder = await makeUser("Founder", `founder-${stamp}@example.com`);
  let { data: mine } = await founder.client.rpc("my_associations");
  check("a new signup with no association goes to setup",
    destinationFor(mine ?? []) === "/start", destinationFor(mine ?? []));

  // 2. They found one, so now they run a board.
  const residentEmail = `resident-${stamp}@example.com`;
  const { data: associationId } = await founder.client.rpc("create_association", {
    p_name: "Routing HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Founder", p_founder_unit: "1",
    p_households: [{ name: "Pre Added Pat", email: residentEmail, unit: "2" }],
  });
  cleanup.associations.push(associationId);

  ({ data: mine } = await founder.client.rpc("my_associations"));
  check("the founder then goes to the board workspace",
    destinationFor(mine ?? []) === "/board", destinationFor(mine ?? []));

  // 3. The household the board pre-added, signing up for the first time.
  const resident = await makeUser("Pre Added Pat", residentEmail);
  const { data: theirs } = await resident.client.rpc("my_associations");
  check("a pre-added household is already in the association on first signup",
    (theirs ?? []).length === 1, `${(theirs ?? []).length} associations`);
  check("and lands on the resident side, not on setup",
    destinationFor(theirs ?? []) === "/resident", destinationFor(theirs ?? []));

  // 4. They can see their own home immediately, with nothing to configure.
  const { data: units } = await resident.client.rpc("my_unit_ids");
  check("with their own home attached", (units ?? []).length === 1, `${(units ?? []).length} homes`);

  const { data: association } = await resident.client
    .from("associations").select("name").eq("id", associationId).single();
  check("and can see the association they belong to",
    association?.name === "Routing HOA", association?.name ?? "none");

  // 5. Somebody who signs up with an address nobody invited stays unattached.
  const stranger = await makeUser("Stranger", `stranger-${stamp}@example.com`);
  const { data: none } = await stranger.client.rpc("my_associations");
  check("an uninvited signup joins nothing", (none ?? []).length === 0, `${(none ?? []).length}`);
  check("and is sent to found their own",
    destinationFor(none ?? []) === "/start", destinationFor(none ?? []));
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
