/**
 * The email rules, against the real database.
 *
 * The one that matters: an owner cannot unsubscribe from being told they owe
 * money. That is not a checkbox somewhere in a form, it is a constraint, so it
 * holds even when a bug or a forged link tries to write the row directly.
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
const PASSWORD = "mail-" + Math.random().toString(36).slice(2) + "A1";
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
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  return { client, id: data.user.id, email };
}

try {
  const behindEmail = `behind-${stamp}@example.com`;
  const president = await makeUser("president");
  const { data: associationId } = await president.client.rpc("create_association", {
    p_name: "Mailer HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Dana", p_founder_unit: "1",
    p_households: [
      { name: "Behind Bob", email: behindEmail, unit: "2" },
      { name: "No Email Nan", email: "", unit: "3" },
    ],
  });
  cleanup.associations.push(associationId);
  await president.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "Assessment", p_due_on: day(-5),
  });

  // The president pays theirs; unit 2 stays behind; unit 3 has no address.
  const { data: presUnits } = await president.client.rpc("my_unit_ids");
  await president.client.rpc("record_payment", {
    p_unit_id: presUnits[0], p_amount_cents: 6000, p_rail: "ach",
  });

  const { data: everyone } = await president.client.rpc("email_recipients", {
    p_association_id: associationId, p_category: "assessment", p_only_past_due: false,
  });
  check("an assessment run reaches every household we can reach",
    (everyone ?? []).length === 2, `${(everyone ?? []).length} recipients`);
  check("a household with no address is left out rather than failing the run",
    !(everyone ?? []).some((r) => !r.email), JSON.stringify((everyone ?? []).map((r) => r.unit_label)));

  const { data: behind } = await president.client.rpc("email_recipients", {
    p_association_id: associationId, p_category: "delinquency", p_only_past_due: true,
  });
  check("a past due run reaches only homes that owe",
    (behind ?? []).length === 1 && behind[0].unit_label === "2",
    JSON.stringify((behind ?? []).map((r) => `${r.unit_label}:${r.balance_cents}`)));

  // Opting out.
  const behindUser = await makeUser("behind");
  const { error: optionalError } = await behindUser.client
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "newsletter" });
  check("an owner can unsubscribe from the newsletter", !optionalError, optionalError?.message ?? "");

  const { error: statutoryError } = await behindUser.client
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "delinquency" });
  check("and cannot unsubscribe from being told they owe money",
    Boolean(statutoryError), statutoryError?.code ?? "no error");

  // Even with the service role, which is what a forged link would reach.
  const { error: adminForced } = await admin
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "assessment" });
  check("not even a server side write can switch off a statutory notice",
    Boolean(adminForced), adminForced?.code ?? "no error");

  const other = await makeUser("other");
  const { error: crossError } = await other.client
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "community" });
  check("nobody can unsubscribe somebody else", Boolean(crossError), crossError?.code ?? "no error");

  // A resident cannot pull the roster's addresses.
  const { data: residentList } = await behindUser.client.rpc("email_recipients", {
    p_association_id: associationId, p_category: "assessment", p_only_past_due: false,
  });
  check("a resident cannot pull the association's address list",
    (residentList ?? []).length === 0, `${(residentList ?? []).length} rows`);
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) await admin.from("associations").delete().eq("id", id);
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
