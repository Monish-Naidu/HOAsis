/**
 * Taking one of two owners off a home (0090), and a changed sign-in email.
 *
 * Founds a throwaway association with an owner on home 2 who claims the seat
 * and files a request. The board adds a second owner, who claims their seat
 * and saves nothing, then removes them. The removed owner's seat has an end
 * date and reads none of the home's requests; the first owner still reads the
 * request filed before any of this (the 0089 interaction) and holds a current
 * seat. Removing the only remaining owner, the president's seat, or a seat as
 * a resident is refused. A sign-in email changed through the auth admin API
 * reaches profiles.email and the seat's invited_email. Pure Supabase; cleaned
 * up at the end.
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
const PASSWORD = "owners-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };
const day = (o) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };

async function makeUser(who, email = `${who}-owners-${stamp}@example.com`) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: who } });
  if (error) throw new Error(`${who}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw new Error(`sign in ${who}: ${e2.message}`);
  await client.rpc("claim_my_seats");
  return { client, id: data.user.id, email };
}

try {
  const firstEmail = `first-owners-${stamp}@example.com`;
  const secondEmail = `second-owners-${stamp}@example.com`;
  const changedEmail = `first-changed-owners-${stamp}@example.com`;

  const president = await makeUser("president");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Remove Owner Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Fran First", email: firstEmail, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);

  const first = await makeUser("first", firstEmail);
  const { data: firstUnits } = await first.client.rpc("my_unit_ids");
  const unit2 = firstUnits?.[0];
  check("the first owner claims the seat on home 2", Boolean(unit2), String(firstUnits));

  const { error: reqError } = await first.client.from("requests").insert({
    association_id: associationId, unit_id: unit2, filed_by: first.id,
    reference: "REQ-OWN-1", kind: "maintenance", title: "First: leaking gutter",
  });
  check("the first owner files a request", !reqError, reqError?.message ?? "");
  // The household has been there a while: the first seat began and the request
  // was filed well before the second owner was added. Without this every date
  // is today and the 0089 check below could not fail.
  await admin.from("memberships").update({ starts_on: day(-60) }).eq("unit_id", unit2).is("ends_on", null);
  await admin.from("requests").update({ submitted_on: day(-30) }).eq("unit_id", unit2);

  // The board adds a second owner, who claims their seat and saves nothing.
  const { error: addError } = await president.client.rpc("add_second_owner", { p_unit_id: unit2, p_name: "Sam Second", p_email: secondEmail });
  check("the board adds a second owner", !addError, addError?.message ?? "");
  const second = await makeUser("second", secondEmail);
  const { data: secondUnits } = await second.client.rpc("my_unit_ids");
  check("the second owner claims their seat", secondUnits?.[0] === unit2, String(secondUnits));
  const { data: secondReq } = await second.client.from("requests").select("id").eq("unit_id", unit2);
  check("before removal the second owner reads the household's request", (secondReq ?? []).length === 1, String((secondReq ?? []).length));

  const seatOf = async (email) => {
    const { data } = await admin.from("memberships").select("*").eq("unit_id", unit2).ilike("invited_email", email).single();
    return data;
  };
  const firstSeat = await seatOf(firstEmail);
  const secondSeat = await seatOf(secondEmail);
  const { data: presSeat } = await admin.from("memberships").select("id").eq("association_id", associationId).eq("role", "president").is("ends_on", null).single();

  // A resident cannot call it, whoever they are.
  const { error: residentError } = await first.client.rpc("remove_owner", { p_membership_id: secondSeat.id });
  check("a resident calling remove_owner is refused", Boolean(residentError), residentError?.message ?? "no error");
  const { data: stillOpen } = await admin.from("memberships").select("ends_on").eq("id", secondSeat.id).single();
  check("and the seat is still open", stillOpen?.ends_on === null, String(stillOpen?.ends_on));

  // The president's seat is refused, with the words the board will read.
  const { error: presError } = await president.client.rpc("remove_owner", { p_membership_id: presSeat.id });
  check("removing the president's seat is refused", Boolean(presError), presError?.message ?? "no error");

  // The board removes the second owner.
  const { data: removedUnit, error: removeError } = await president.client.rpc("remove_owner", { p_membership_id: secondSeat.id });
  check("the board removes the second owner", !removeError, removeError?.message ?? "");
  check("and is told which home", removedUnit === unit2, String(removedUnit));
  const { data: ended } = await admin.from("memberships").select("ends_on").eq("id", secondSeat.id).single();
  check("their seat has an end date, today", ended?.ends_on === day(0), String(ended?.ends_on));
  const { data: again, error: againError } = await president.client.rpc("remove_owner", { p_membership_id: secondSeat.id });
  check("removing them again is refused", Boolean(againError) && !again, againError?.message ?? "no error");

  // The removed owner reads none of the home's rows.
  const { data: goneReq } = await second.client.from("requests").select("id").eq("unit_id", unit2);
  check("the removed owner reads none of the home's requests", (goneReq ?? []).length === 0, String((goneReq ?? []).length));
  const { data: goneUnits } = await second.client.rpc("my_unit_ids");
  check("and holds no home", (goneUnits ?? []).length === 0, String(goneUnits));

  // The 0089 interaction: the seat that ended today bounds nothing.
  const { data: firstReq } = await first.client.from("requests").select("title").eq("unit_id", unit2);
  check("the first owner still reads the request filed before any of this", (firstReq ?? []).length === 1 && firstReq[0].title === "First: leaking gutter", JSON.stringify(firstReq));
  const { data: since } = await first.client.rpc("unit_owned_since", { p_unit_id: unit2 });
  check("unit_owned_since still reaches back to the first seat's start", since === "-infinity" || since <= day(-30), String(since));
  const { data: firstNow } = await admin.from("memberships").select("ends_on").eq("id", firstSeat.id).single();
  check("the first owner is still a current seat", firstNow?.ends_on === null, String(firstNow?.ends_on));

  // The only remaining owner cannot be removed.
  const { error: onlyError } = await president.client.rpc("remove_owner", { p_membership_id: firstSeat.id });
  check("removing the home's only remaining owner is refused", Boolean(onlyError) && /only owner/i.test(onlyError.message), onlyError?.message ?? "no error");

  // A changed sign-in email reaches the register (the sync_auth_email trigger).
  const { error: updateError } = await admin.auth.admin.updateUserById(first.id, { email: changedEmail, email_confirm: true });
  check("the auth email is changed", !updateError, updateError?.message ?? "");
  const { data: profile } = await admin.from("profiles").select("email").eq("id", first.id).single();
  check("profiles.email follows it", profile?.email === changedEmail, String(profile?.email));
  const { data: seatAfter } = await admin.from("memberships").select("invited_email").eq("id", firstSeat.id).single();
  check("and so does the current seat's invited_email", seatAfter?.invited_email === changedEmail, String(seatAfter?.invited_email));
  const { data: endedAfter } = await admin.from("memberships").select("invited_email").eq("id", secondSeat.id).single();
  check("while a seat that ended keeps the address it had", endedAfter?.invited_email === secondEmail, String(endedAfter?.invited_email));
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
