/**
 * Proves the three doors into an association, against the real database.
 *
 *   node scripts/verify-join-flow.mjs
 *
 * A founder sets up Willow Creek Estates with thirteen households: three
 * who will sit on the board and ten owners. Then:
 *
 *   - the founder names the three officers before any of them has an account,
 *     and the office is waiting when the treasurer signs up;
 *   - an owner the board added signs up with the same email and is seated;
 *   - a stranger creates an account through the join code, sees that they are
 *     waiting on the board, and is seated the moment the board lets them in.
 *
 * Accounts are created through the admin API with the address pre-confirmed,
 * because the built in mailer is capped; the trigger under test fires on the
 * insert either way.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL(process.env.ENV_FILE ?? "../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

const stamp = Date.now();
const PASSWORD = "join-" + Math.random().toString(36).slice(2) + "A1";
const results = [];
let failures = 0;
const check = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  if (!passed) failures++;
};
const cleanup = { users: [], associations: [] };
const mail = (tag) => `willow-${tag}-${stamp}@example.com`;

async function signUp(email, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`signup ${email}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw new Error(`sign in ${email}: ${signInError.message}`);
  return { client, userId: data.user.id, email };
}

const BOARD = [
  { name: "Grace Okafor", tag: "treasurer", role: "treasurer", address: "102 Willow Creek Dr" },
  { name: "Tomas Reyes", tag: "secretary", role: "secretary", address: "103 Willow Creek Dr" },
  { name: "June Park", tag: "vp", role: "vice-president", address: "104 Willow Creek Dr" },
];
const OWNERS = Array.from({ length: 10 }, (_, i) => ({
  name: `Owner ${i + 1}`,
  tag: `owner${i + 1}`,
  address: `${105 + i} Willow Creek Dr`,
}));

try {
  // 1. The founder signs up and founds the association with everybody on it.
  const founder = await signUp(mail("founder"), "Dana Whitcomb");
  const households = [...BOARD, ...OWNERS].map((h) => ({
    name: h.name, email: mail(h.tag), unit: h.address, address: h.address,
  }));
  const { data: associationId, error: createError } = await founder.client.rpc("create_association", {
    p_name: "Willow Creek Estates", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 9500, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Dana Whitcomb", p_founder_unit: "101 Willow Creek Dr",
    p_households: households,
  });
  check("the founder founds the association with 13 households", !createError && Boolean(associationId), createError?.message ?? "");
  if (associationId) cleanup.associations.push(associationId);

  const { data: units } = await founder.client.from("units").select("id,label").eq("association_id", associationId);
  check("fourteen homes are on the register", (units ?? []).length === 14, `${(units ?? []).length}`);
  const unitByLabel = Object.fromEntries((units ?? []).map((u) => [u.label, u.id]));

  const { data: assoc } = await founder.client.from("associations").select("join_code").eq("id", associationId).single();
  const code = assoc?.join_code;
  check("the association has a join code", typeof code === "string" && code.length === 6, code ?? "none");

  // 2. Officers are named by home, before they exist as people.
  for (const officer of BOARD) {
    const { error } = await founder.client
      .from("memberships")
      .update({ role: officer.role, capabilities: officer.role === "treasurer" ? ["finances", "vendors"] : ["communications", "documents"] })
      .eq("association_id", associationId)
      .eq("unit_id", unitByLabel[officer.address])
      .is("ends_on", null)
      .neq("role", "president");
    check(`the founder names ${officer.name} ${officer.role} before they sign up`, !error, error?.message ?? "");
  }

  // 3. The treasurer signs up with the email the founder used: seated, as treasurer.
  const treasurer = await signUp(mail("treasurer"), "Grace Okafor");
  const { data: tMine } = await treasurer.client.rpc("my_associations");
  const tRow = (tMine ?? []).find((m) => m.association_id === associationId);
  check("the treasurer lands in the association on sign up", Boolean(tRow), `${(tMine ?? []).length}`);
  check("and holds the treasurer's office", tRow?.role === "treasurer", tRow?.role ?? "none");
  check("with the treasurer's capabilities", (tRow?.capabilities ?? []).includes("finances"), String(tRow?.capabilities));

  // 4. An owner the board added signs up and is seated as a resident.
  const owner3 = await signUp(mail("owner3"), "Owner 3");
  const { data: oMine } = await owner3.client.rpc("my_associations");
  const oRow = (oMine ?? []).find((m) => m.association_id === associationId);
  check("an added owner lands in the association on sign up", oRow?.role === "resident", oRow?.role ?? "none");
  const { data: oUnits } = await owner3.client.rpc("my_unit_ids");
  check("and holds exactly their own home", (oUnits ?? []).length === 1 && oUnits[0] === unitByLabel["107 Willow Creek Dr"], String(oUnits));

  // 5. A stranger with the code: account first, then the ask, then the wait.
  const strangerEmail = mail("newcomer");
  const { data: lookedUp } = await anon().rpc("association_by_join_code", { p_code: code.toLowerCase() });
  check("the code names the association to a visitor", lookedUp?.[0]?.name === "Willow Creek Estates", JSON.stringify(lookedUp));
  const stranger = await signUp(strangerEmail, "Nadia Bell");
  const { data: asked, error: askError } = await stranger.client.rpc("request_to_join", {
    p_code: code, p_name: "Nadia Bell", p_email: strangerEmail, p_unit: "115 Willow Creek Dr", p_note: "Closed last week",
  });
  check("a signed in newcomer asks to join with the code", asked === "Willow Creek Estates" && !askError, askError?.message ?? String(asked));
  const { data: sMine } = await stranger.client.rpc("my_associations");
  check("they belong to nothing yet", (sMine ?? []).length === 0, String((sMine ?? []).length));
  const { data: waiting } = await stranger.client.rpc("my_join_requests");
  check("and can see they are waiting on the board", waiting?.[0]?.status === "pending" && waiting[0].name === "Willow Creek Estates", JSON.stringify(waiting));
  const { data: nobody } = await anon().rpc("my_join_requests");
  check("a visitor sees no requests", (nobody ?? []).length === 0, String((nobody ?? []).length));

  // 6. The board lets them in: the same add as any household, and the seat
  //    is claimed on the spot because the account already exists.
  const { data: pending } = await founder.client.from("join_requests").select("id,email,unit_label").eq("association_id", associationId).eq("status", "pending");
  const theirs = (pending ?? []).find((j) => j.email === strangerEmail);
  check("the founder sees the request", Boolean(theirs), String((pending ?? []).length));
  const { data: newUnit, error: addError } = await founder.client.rpc("add_household", {
    p_association_id: associationId, p_unit_id: null, p_name: "Nadia Bell", p_email: strangerEmail, p_unit: theirs?.unit_label ?? "115 Willow Creek Dr",
  });
  check("the founder adds the home", !addError && Boolean(newUnit), addError?.message ?? "");
  await founder.client.from("join_requests").update({ status: "approved", decided_on: new Date().toISOString().slice(0, 10), decided_by: "Dana Whitcomb" }).eq("id", theirs?.id);
  const { data: sNow } = await stranger.client.rpc("my_associations");
  check("the newcomer is seated the moment the board says yes", (sNow ?? []).some((m) => m.association_id === associationId && m.role === "resident"), JSON.stringify(sNow));
  const { data: decided } = await stranger.client.rpc("my_join_requests");
  check("and their request reads approved", decided?.[0]?.status === "approved", decided?.[0]?.status ?? "none");

  // 7. The wall: a resident cannot name officers.
  const { error: sneak, data: sneaked } = await owner3.client
    .from("memberships").update({ role: "treasurer" }).eq("association_id", associationId).eq("unit_id", unitByLabel["107 Willow Creek Dr"]).select();
  check("a resident cannot give themselves an office", Boolean(sneak) || (sneaked ?? []).length === 0, sneak?.message ?? `${(sneaked ?? []).length} rows`);
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

for (const r of results) console.log(`${r.passed ? "  ok  " : "FAIL  "}${r.name}${r.detail ? `  (${r.detail})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
