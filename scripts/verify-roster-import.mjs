/**
 * Proves the roster import and the first-bill guard against the real database.
 *
 * A founder founds an association, imports a roster with names, emails,
 * phones and opening balances, and the register, seats and statements come
 * out right. Then the daily run's RPC is asked to bill a period the opening
 * balances already cover, and refuses per home; a later period bills every
 * home once. Finally an import dated after a period this product billed is
 * refused, because that balance would count the period twice.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL(process.env.ENV_FILE ?? "../.env.local", import.meta.url), "utf8")
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
const PASSWORD = "roster-" + Math.random().toString(36).slice(2) + "A1";
const results = [];
let failures = 0;
const check = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  if (!passed) failures++;
};
const cleanup = { users: [], associations: [] };

async function signUp(email, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`signup ${email}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw new Error(`sign in ${email}: ${signInError.message}`);
  return { client, userId: data.user.id };
}

try {
  const founderEmail = `founder-${stamp}@example.com`;
  const knownEmail = `known-${stamp}@example.com`;
  const founder = await signUp(founderEmail, "Dana Whitcomb");
  // Somebody who already has an account before the roster names them.
  const known = await signUp(knownEmail, "Rosa Lind");

  const { data: associationId, error: createError } = await founder.client.rpc("create_association", {
    p_name: "Roster Import HOA",
    p_city: "Bothell",
    p_state: "WA",
    p_dues_cents: 10000,
    p_dues_cadence: "monthly",
    p_due_day: 1,
    p_founder_name: "Dana Whitcomb",
    p_founder_unit: "1",
    p_households: [{ name: "", email: "", unit: "2" }],
  });
  check("founded", !createError && Boolean(associationId), createError?.message ?? "");
  if (associationId) cleanup.associations.push(associationId);

  // 1. The import: a new home, a home already on the register, a home for
  //    somebody with an account, and a blank row.
  const { data: outcome, error: importError } = await founder.client.rpc("import_households", {
    p_association_id: associationId,
    p_as_of: "2026-09-20",
    p_rows: [
      { unit: "2", name: "Marcus Bell", email: `marcus-${stamp}@example.com`, phone: "425-555-0114", address: "1432 Willow Creek Lane", opening_balance_cents: 18500 },
      { unit: "3", name: "Rosa Lind", email: knownEmail, phone: "", address: "", opening_balance_cents: -2000 },
      { unit: "4", name: "", email: "", phone: "", address: "1440 Willow Creek Lane" },
      { unit: "", name: "Nobody", email: "", phone: "", address: "" },
    ],
  });
  check("import_households runs", !importError, importError?.message ?? "");
  check("counts what it did", outcome?.created === 2 && outcome?.updated === 1 && outcome?.balances === 2 && outcome?.skipped === 1, JSON.stringify(outcome));

  const { data: units } = await founder.client.from("units").select("id, label, address").eq("association_id", associationId).order("label");
  check("four homes on the register", (units ?? []).length === 4, String((units ?? []).length));
  const unit2 = (units ?? []).find((u) => u.label === "2");
  const unit3 = (units ?? []).find((u) => u.label === "3");
  const unit4 = (units ?? []).find((u) => u.label === "4");
  check("an existing home took the address", unit2?.address === "1432 Willow Creek Lane", unit2?.address);

  const { data: seats } = await admin.from("memberships").select("unit_id, full_name, invited_email, phone, profile_id").eq("association_id", associationId).is("ends_on", null);
  const seat2 = (seats ?? []).find((m) => m.unit_id === unit2?.id);
  const seat3 = (seats ?? []).find((m) => m.unit_id === unit3?.id);
  check("the existing empty seat took the name, email and phone", seat2?.full_name === "Marcus Bell" && seat2?.invited_email === `marcus-${stamp}@example.com` && seat2?.phone === "425-555-0114", JSON.stringify(seat2));
  check("a person with an account is seated at once", seat3?.profile_id === known.userId, seat3?.profile_id ?? "none");
  check("one seat per home", (seats ?? []).filter((m) => m.unit_id === unit2?.id).length === 1);

  const { data: charges } = await founder.client.from("charges").select("unit_id, kind, label, amount_cents, due_on").eq("association_id", associationId);
  const bf2 = (charges ?? []).find((c) => c.unit_id === unit2?.id);
  const bf3 = (charges ?? []).find((c) => c.unit_id === unit3?.id);
  check("an opening balance is one dated charge line", bf2?.label === "Balance brought forward" && bf2?.kind === "charge" && bf2?.amount_cents === 18500 && bf2?.due_on === "2026-09-20", JSON.stringify(bf2));
  check("a credit balance is a credit line", bf3?.kind === "credit" && bf3?.amount_cents === -2000, JSON.stringify(bf3));
  check("a home with no balance column has no line", !(charges ?? []).some((c) => c.unit_id === unit4?.id));

  // 2. Re-import replaces the opening line rather than stacking it.
  await founder.client.rpc("import_households", {
    p_association_id: associationId, p_as_of: "2026-09-20",
    p_rows: [{ unit: "2", name: "", email: "", phone: "", address: "", opening_balance_cents: 20000 }],
  });
  const { data: after } = await founder.client.from("charges").select("amount_cents").eq("unit_id", unit2.id).eq("label", "Balance brought forward");
  check("re-importing replaces the opening balance", (after ?? []).length === 1 && after[0].amount_cents === 20000, JSON.stringify(after));

  // 3. The guard: a period the opening balances cover is not billed to those homes.
  //    The association was founded today, so the books are told to start
  //    earlier first; otherwise nothing before today bills at all, which is
  //    the founding-date rule the run has always had.
  await admin.from("associations").update({ billing_starts_on: "2026-08-01" }).eq("id", associationId);
  const { data: billed1, error: issue1 } = await founder.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "September 2026 dues", p_due_on: "2026-09-01",
  });
  check("a period inside the opening balances skips those homes", !issue1 && billed1 === 2, issue1?.message ?? `billed ${billed1}`);
  const { data: sept } = await founder.client.from("charges").select("unit_id").eq("association_id", associationId).eq("label", "September 2026 dues");
  check("only the homes without an opening balance got it", (sept ?? []).every((c) => c.unit_id !== unit2.id && c.unit_id !== unit3.id));

  // 4. billing_starts_on holds the run back.
  await admin.from("associations").update({ billing_starts_on: "2026-11-01" }).eq("id", associationId);
  const { data: billedOct } = await founder.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "October 2026 dues", p_due_on: "2026-10-01",
  });
  check("nothing bills before billing_starts_on", billedOct === 0, `billed ${billedOct}`);
  const { data: billedNov } = await founder.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "November 2026 dues", p_due_on: "2026-11-01",
  });
  check("the first period on or after it bills every home once", billedNov === 4, `billed ${billedNov}`);
  const { data: billedNovAgain } = await founder.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "November 2026 dues", p_due_on: "2026-11-01",
  });
  check("and never twice", billedNovAgain === 0, `billed ${billedNovAgain}`);

  // 5. An opening balance dated after a period billed here is refused.
  const { error: lateImport } = await founder.client.rpc("import_households", {
    p_association_id: associationId, p_as_of: "2026-11-15",
    p_rows: [{ unit: "4", name: "", email: "", phone: "", address: "", opening_balance_cents: 5000 }],
  });
  check("an opening balance that would double count a billed period is refused", /already billed/.test(lateImport?.message ?? ""), lateImport?.message ?? "no error");

  // 6. A resident cannot import.
  const { error: residentImport } = await known.client.rpc("import_households", {
    p_association_id: associationId, p_rows: [{ unit: "9", name: "X" }],
  });
  check("a resident cannot import the roster", Boolean(residentImport), residentImport?.message?.slice(0, 40) ?? "no error");
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

for (const r of results) {
  console.log(`${r.passed ? "  ok  " : "FAIL  "}${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
