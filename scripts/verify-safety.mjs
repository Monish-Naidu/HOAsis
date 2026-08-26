/**
 * The ways an association could destroy itself, attempted.
 *
 * The bug this covers: removing yourself as the only officer worked, and left
 * the association unreachable because nobody could grant capabilities back.
 * A dialog would not have prevented it. These are database rules, so they hold
 * against this client, the next one, and a mistaken script.
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
const PASSWORD = "safety-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };

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
  const successorEmail = `successor-${stamp}@example.com`;
  const president = await makeUser("President", `president-${stamp}@example.com`);
  const { data: associationId } = await president.client.rpc("create_association", {
    p_name: "Safety HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat President", p_founder_unit: "1",
    p_households: [{ name: "Sam Successor", email: successorEmail, unit: "2" }],
  });
  cleanup.associations.push(associationId);
  const successor = await makeUser("Sam Successor", successorEmail);

  // The bug, attempted directly.
  const { data: mine } = await admin.from("memberships").select("id")
    .eq("association_id", associationId).eq("profile_id", president.id).single();

  const { error: deleteSelf } = await president.client
    .from("memberships").delete().eq("id", mine.id);
  const { data: stillThere } = await admin.from("memberships").select("role")
    .eq("id", mine.id).maybeSingle();
  check("the last President cannot delete their own membership",
    stillThere?.role === "president", deleteSelf?.message?.slice(0, 60) ?? "row survived");

  const { error: leaveError } = await president.client.rpc("leave_association", {
    p_association_id: associationId,
  });
  check("and cannot leave the association either",
    Boolean(leaveError), leaveError?.message?.slice(0, 50) ?? "no error");

  // Even the service role, which is what a bad migration or script would use.
  const { error: adminForce } = await admin.from("memberships").delete().eq("id", mine.id);
  check("not even a server side delete can remove the last President",
    Boolean(adminForce), adminForce?.message?.slice(0, 50) ?? "no error");

  // The supported path.
  const { error: transferError } = await president.client.rpc("transfer_presidency", {
    p_to_profile: successor.id,
  });
  check("the presidency can be handed over", !transferError, transferError?.message ?? "");

  const { data: roles } = await admin.from("memberships")
    .select("profile_id, role").eq("association_id", associationId).is("ends_on", null);
  const successorRole = roles.find((r) => r.profile_id === successor.id)?.role;
  const formerRole = roles.find((r) => r.profile_id === president.id)?.role;
  check("the successor is President", successorRole === "president", successorRole);
  check("the former President stays as a resident, because they still own a home",
    formerRole === "resident", formerRole);

  // Now leaving is allowed, and keeps the history.
  const { error: nowLeave } = await president.client.rpc("leave_association", {
    p_association_id: associationId,
  });
  check("the former President can now leave", !nowLeave, nowLeave?.message ?? "");
  const { data: ended } = await admin.from("memberships").select("ends_on")
    .eq("id", mine.id).single();
  check("and their record survives with an end date rather than vanishing",
    ended?.ends_on !== null, String(ended?.ends_on));

  // Deleting the association.
  const { error: wrongName } = await successor.client.rpc("request_association_deletion", {
    p_association_id: associationId, p_typed_name: "Wrong Name",
  });
  check("deleting needs the name typed correctly", Boolean(wrongName),
    wrongName?.message?.slice(0, 40) ?? "no error");

  const resident = await makeUser("Rita Resident", `resident-${stamp}@example.com`);
  await admin.from("memberships").insert({
    association_id: associationId, unit_id: (await admin.from("units").select("id")
      .eq("association_id", associationId).limit(1).single()).data.id,
    profile_id: resident.id, full_name: "Rita", role: "resident", capabilities: [],
  });
  const { error: residentDelete } = await resident.client.rpc("request_association_deletion", {
    p_association_id: associationId, p_typed_name: "Safety HOA",
  });
  check("only the President can delete an association", Boolean(residentDelete),
    residentDelete?.message?.slice(0, 40) ?? "no error");

  const { data: purgeAt, error: deleteError } = await successor.client
    .rpc("request_association_deletion", {
      p_association_id: associationId, p_typed_name: "Safety HOA",
    });
  check("the President can, with the name typed", !deleteError && Boolean(purgeAt),
    deleteError?.message ?? "");

  const { data: afterDelete } = await successor.client.rpc("my_associations");
  check("a deleted association disappears from their list",
    (afterDelete ?? []).length === 0, `${(afterDelete ?? []).length}`);

  // And is reversible.
  const { error: restoreError } = await successor.client.rpc("cancel_association_deletion", {
    p_association_id: associationId,
  });
  const { data: restored } = await successor.client.rpc("my_associations");
  check("and can be restored inside the window",
    !restoreError && (restored ?? []).length === 1, restoreError?.message ?? `${(restored ?? []).length}`);

  // Cancelling billing changes nothing but the bill.
  await successor.client.rpc("cancel_subscription", {
    p_association_id: associationId, p_reason: "Trying it out",
  });
  const { data: afterCancel } = await successor.client
    .from("associations").select("subscription_status, name").eq("id", associationId).single();
  check("cancelling stops the subscription", afterCancel?.subscription_status === "canceled",
    afterCancel?.subscription_status);
  const { data: recordsIntact } = await successor.client
    .from("units").select("id").eq("association_id", associationId);
  check("and leaves every record readable", (recordsIntact ?? []).length === 2,
    `${(recordsIntact ?? []).length} homes`);
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) {
    await admin.from("memberships").update({ role: "resident" }).eq("association_id", id).eq("role", "president");
    await admin.from("associations").delete().eq("id", id);
  }
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
