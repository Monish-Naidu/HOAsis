/**
 * Proves a real person can sign up, found an association, and that an invited
 * neighbor's seat is waiting for them when they sign up later.
 *
 * This is the path a customer actually walks, so it is worth walking with a
 * real account against the real database rather than asserting it in a unit
 * test that mocks the parts that break.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

const stamp = Date.now();
const PASSWORD = "onboard-" + Math.random().toString(36).slice(2) + "A1";
const results = [];
let failures = 0;
const check = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  if (!passed) failures++;
};

const cleanup = { users: [], associations: [] };

/**
 * Creates an account the way a person would, then signs in as them.
 *
 * Goes through the admin API rather than the public signUp endpoint, because
 * the built in email service is rate limited to a handful of messages an hour
 * and rejects several domains outright. The trigger under test fires on any
 * insert into auth.users, so this exercises the same code path a real signup
 * does without fighting the mailer.
 */
async function signUp(email, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`signup ${email}: ${error.message}`);
  cleanup.users.push(data.user.id);

  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`sign in ${email}: ${signInError.message}`);
  return { client, userId: data.user.id };
}

try {
  const founderEmail = `founder-${stamp}@example.com`;
  const neighborEmail = `neighbor-${stamp}@example.com`;

  // 1. The founder signs up.
  const founder = await signUp(founderEmail, "Dana Whitcomb");
  const { data: profile } = await admin
    .from("profiles").select("full_name, email").eq("id", founder.userId).single();
  check("signing up creates a profile", profile?.email === founderEmail, profile?.email ?? "none");
  check("the profile carries the name given at signup", profile?.full_name === "Dana Whitcomb", profile?.full_name);

  // 2. They found an association, inviting a neighbor by email.
  const { data: associationId, error: createError } = await founder.client.rpc(
    "create_association",
    {
      p_name: "Willow Creek HOA",
      p_city: "Bothell",
      p_state: "WA",
      p_dues_cents: 6000,
      p_dues_cadence: "monthly",
      p_due_day: 1,
      p_founder_name: "Dana Whitcomb",
      p_founder_unit: "1",
      p_households: [
        { name: "Marcus Bell", email: neighborEmail, unit: "2" },
        { name: "Ana Ferreira", email: "", unit: "3" },
      ],
    },
  );
  check("a signed in person can found an association", !createError && Boolean(associationId), createError?.message ?? "");
  if (associationId) cleanup.associations.push(associationId);

  // 3. The founder is President with full capabilities.
  const { data: mine } = await founder.client.rpc("my_associations");
  const found = (mine ?? []).find((m) => m.association_id === associationId);
  check("the founder is President", found?.role === "president", found?.role ?? "none");
  check("the founder holds permissions", (found?.capabilities ?? []).includes("permissions"), String(found?.capabilities));

  // 4. Every home exists, including the one with no email.
  const { data: units } = await founder.client.from("units").select("label").eq("association_id", associationId);
  check("every home is on the register", (units ?? []).length === 3, `${(units ?? []).length} units`);

  // 5. A stranger cannot found an association on somebody else's behalf.
  const { error: anonError } = await anon().rpc("create_association", {
    p_name: "Fake HOA", p_city: "X", p_state: "WA", p_dues_cents: 100,
    p_dues_cadence: "monthly", p_due_day: 1, p_founder_name: "Nobody", p_founder_unit: "1",
  });
  check("a signed out visitor cannot found an association", Boolean(anonError), anonError?.message?.slice(0, 40) ?? "no error");

  // 6. The invited neighbor signs up later and their seat is waiting.
  const neighbor = await signUp(neighborEmail, "Marcus Bell");
  const { data: theirs } = await neighbor.client.rpc("my_associations");
  check(
    "an invited neighbor lands in the association on signup",
    (theirs ?? []).some((m) => m.association_id === associationId),
    `${(theirs ?? []).length} associations`,
  );
  check(
    "and arrives as a resident, not an officer",
    (theirs ?? [])[0]?.role === "resident",
    (theirs ?? [])[0]?.role ?? "none",
  );

  // 7. They see their own home and not the founder's charges.
  const { data: neighborUnits } = await neighbor.client.rpc("my_unit_ids");
  check("the neighbor holds exactly one home", (neighborUnits ?? []).length === 1, String((neighborUnits ?? []).length));
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) await admin.from("associations").delete().eq("id", id);
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) {
  console.log(`${r.passed ? "  ok  " : "FAIL  "}${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
