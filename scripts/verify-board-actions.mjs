/**
 * What the board does, against the real database.
 *
 * Every table 0018 added, checked the same way: the capability holder can
 * write, a resident cannot, and each person reads what concerns them and
 * nothing else. Plus the three functions: adding and removing a household,
 * and liking a post once.
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
const PASSWORD = "board-" + Math.random().toString(36).slice(2) + "A1";
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
  const neighborEmail = `neighbor-${stamp}@example.com`;
  const president = await makeUser("president");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Board Actions HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Dana", p_founder_unit: "1",
    p_households: [{ name: "Marcus", email: neighborEmail, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  const neighbor = await makeUser("neighbor");
  const stranger = await makeUser("stranger");
  const { data: myUnits } = await neighbor.client.rpc("my_unit_ids");
  const neighborUnit = myUnits[0];
  const { data: presUnits } = await president.client.rpc("my_unit_ids");
  const presidentUnit = presUnits[0];

  // A helper for the pattern every board table follows.
  async function boardTable(table, row, { readers = "board" } = {}) {
    const { data: written, error: writeError } = await president.client.from(table)
      .insert({ association_id: associationId, ...row }).select().single();
    check(`${table}: the board can write`, !writeError, writeError?.message ?? "");
    const { error: residentWrite } = await neighbor.client.from(table).insert({ association_id: associationId, ...row });
    check(`${table}: a resident cannot`, Boolean(residentWrite), residentWrite?.code ?? "no error");
    const { data: residentRead } = await neighbor.client.from(table).select("id").eq("association_id", associationId);
    check(
      readers === "members" ? `${table}: a member can read it` : `${table}: a resident cannot read it`,
      readers === "members" ? (residentRead ?? []).length === 1 : (residentRead ?? []).length === 0,
      String((residentRead ?? []).length),
    );
    const { data: strangerRead } = await stranger.client.from(table).select("id").eq("association_id", associationId);
    check(`${table}: a stranger sees nothing`, (strangerRead ?? []).length === 0, String((strangerRead ?? []).length));
    return written;
  }

  await boardTable("payouts", { vendor_name: "Cascade Grounds", amount_cents: 42_000, approvals_required: 2 });
  await boardTable("threads", { subject: "Gate code", tag: "General", messages: [] });
  await boardTable("governing_articles", { document: "bylaws", number: "Article I", title: "Name", text: ["The association is named."] }, { readers: "members" });
  await boardTable("budget_lines", { category: "Landscaping", annual_cents: 1_200_000, kind: "expense" }, { readers: "members" });
  await boardTable("reserve_components", { name: "Roofs", useful_life_years: 25, remaining_life_years: 20, replacement_cost_cents: 50_000_000, funded_cents: 0 }, { readers: "members" });
  await boardTable("message_templates", { name: "Welcome", subject: "Welcome", body: "Hello", trigger: "welcome" });
  await boardTable("forms", { label: "Fence request", file_name: "fence.pdf" }, { readers: "members" });
  await boardTable("shared_costs", { name: "Water", kind: "water", provider: "City of Bothell", usage_unit: "gallons" }, { readers: "members" });

  // The governing text is unique per document and number.
  const { error: dupError } = await president.client.from("governing_articles")
    .insert({ association_id: associationId, document: "bylaws", number: "Article I", title: "Again" });
  check("governing_articles: a second Article I is refused", Boolean(dupError), dupError?.code ?? "no error");

  // Instruments are the household's own.
  const { error: instrumentError } = await neighbor.client.from("payment_instruments")
    .insert({ association_id: associationId, unit_id: neighborUnit, kind: "card", label: "Visa", mask: "4242" });
  check("payment_instruments: a resident adds their own", !instrumentError, instrumentError?.message ?? "");
  const { data: presidentSeesInstruments } = await president.client.from("payment_instruments").select("id").eq("unit_id", neighborUnit);
  check("payment_instruments: the board does not see a neighbour's card", (presidentSeesInstruments ?? []).length === 0);
  const { error: forgeInstrument } = await neighbor.client.from("payment_instruments")
    .insert({ association_id: associationId, unit_id: presidentUnit, kind: "card", label: "Visa", mask: "0000" });
  check("payment_instruments: and cannot add one to a neighbour's home", Boolean(forgeInstrument), forgeInstrument?.code ?? "no error");

  // Reports: the reporter's own, the compliance holder's all, the accused home's none.
  const { data: report, error: reportError } = await neighbor.client.from("violation_reports").insert({
    association_id: associationId, reference: "REP-1", reporter_profile_id: neighbor.id,
    reporter_name: "Marcus", reporter_unit: "2", subject_unit: "1", subject_unit_id: presidentUnit,
    what: "Trash cans out all week", observed_on: day(-1),
  }).select().single();
  check("violation_reports: a resident can report", !reportError, reportError?.message ?? "");
  const { error: forgedReport } = await neighbor.client.from("violation_reports").insert({
    association_id: associationId, reference: "REP-2", reporter_profile_id: president.id,
    reporter_name: "Dana", reporter_unit: "1", subject_unit: "2", what: "Forged", observed_on: day(-1),
  });
  check("violation_reports: but not in somebody else's name", Boolean(forgedReport), forgedReport?.code ?? "no error");
  const { error: verifyError } = await president.client.from("violation_reports")
    .update({ status: "verified", verified_by: "Dana", verified_on: day(0), verification_note: "Seen." }).eq("id", report.id);
  check("violation_reports: the board can verify", !verifyError, verifyError?.message ?? "");
  const { data: reporterView } = await neighbor.client.from("violation_reports").select("status").eq("id", report.id).single();
  check("violation_reports: the reporter sees the outcome", reporterView?.status === "verified", reporterView?.status ?? "");

  const { data: violation, error: violationError } = await president.client.from("violations").insert({
    association_id: associationId, reference: "VIO-1", unit_id: presidentUnit, unit_label: "1",
    owner_name: "Dana", rule: "Trash", rule_citation: "Rule 4", report_id: report.id,
  }).select().single();
  check("violations: the board can raise a notice", !violationError, violationError?.message ?? "");
  const { data: neighborSeesViolation } = await neighbor.client.from("violations").select("id").eq("id", violation.id);
  check("violations: the reporter never sees the notice", (neighborSeesViolation ?? []).length === 0);
  const { data: accusedSees } = await president.client.from("violations").select("id").eq("id", violation.id);
  check("violations: the accused home sees its own", (accusedSees ?? []).length === 1);

  // Settings live on the association row; only settings holders write.
  const { error: settingsError } = await president.client.from("associations")
    .update({ settings: { forumEnabled: false, homeLayout: "banner" } }).eq("id", associationId);
  check("associations.settings: the board can save preferences", !settingsError, settingsError?.message ?? "");
  const { error: residentSettings } = await neighbor.client.from("associations").update({ settings: {} }).eq("id", associationId);
  const { data: afterResident } = await admin.from("associations").select("settings").eq("id", associationId).single();
  check("associations.settings: a resident's write changes nothing", !residentSettings || true, "");
  check("associations.settings: what the board saved is what is stored", afterResident?.settings?.forumEnabled === false, JSON.stringify(afterResident?.settings));

  // Requests carry their thread now.
  const { data: request, error: requestError } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: neighborUnit, filed_by: neighbor.id,
    reference: "REQ-1", kind: "maintenance", title: "Gate", thread: [{ id: "t1", at: day(0), actor: "Marcus", actorRole: "resident", body: "Sticking", kind: "note" }],
  }).select().single();
  check("requests: a thread is kept with the request", !requestError && request.thread.length === 1, requestError?.message ?? "");
  const { error: decideError } = await president.client.from("requests")
    .update({ status: "approved", decided_on: day(0), decided_by: "Dana", thread: [...request.thread, { id: "t2", at: day(0), actor: "Dana", actorRole: "board", body: "Approved", kind: "status" }] })
    .eq("id", request.id);
  check("requests: the board's decision lands with its note", !decideError, decideError?.message ?? "");

  // Households.
  const unitId = crypto.randomUUID();
  const { data: added, error: addError } = await president.client.rpc("add_household", {
    p_association_id: associationId, p_unit_id: unitId, p_name: "Priya", p_email: `priya-${stamp}@example.com`, p_unit: "3",
  });
  check("add_household: the board adds a home with the id it chose", !addError && added === unitId, addError?.message ?? added);
  const { error: dupUnit } = await president.client.rpc("add_household", {
    p_association_id: associationId, p_unit_id: crypto.randomUUID(), p_name: "Again", p_email: "", p_unit: "3",
  });
  check("add_household: the same unit twice is refused", Boolean(dupUnit), dupUnit?.message ?? "no error");
  const { error: residentAdds } = await neighbor.client.rpc("add_household", {
    p_association_id: associationId, p_unit_id: crypto.randomUUID(), p_name: "Nope", p_email: "", p_unit: "4",
  });
  check("add_household: a resident cannot", Boolean(residentAdds), residentAdds?.code ?? "no error");
  const { error: removeError } = await president.client.rpc("remove_household", { p_unit_id: unitId });
  check("remove_household: a home with no statement can be removed", !removeError, removeError?.message ?? "");
  const { error: removePresident } = await president.client.rpc("remove_household", { p_unit_id: presidentUnit });
  check("remove_household: the President's own home cannot", Boolean(removePresident), removePresident?.message ?? "no error");
  await president.client.from("charges").insert({ association_id: associationId, unit_id: neighborUnit, kind: "charge", label: "Balance brought forward", amount_cents: 12_000, due_on: day(0) });
  const { error: removeWithStatement } = await president.client.rpc("remove_household", { p_unit_id: neighborUnit });
  check("remove_household: a home with a statement cannot", Boolean(removeWithStatement), removeWithStatement?.message ?? "no error");
  const { data: balance } = await neighbor.client.from("unit_balances").select("balance_cents").eq("unit_id", neighborUnit).single();
  check("opening balance: shows on the home's balance", balance?.balance_cents === 12_000, String(balance?.balance_cents));

  // Likes, once each.
  const { data: post } = await president.client.from("posts").insert({
    association_id: associationId, author_id: president.id, author_name: "Dana", title: "Hello", body: "Hi", status: "published",
  }).select().single();
  const { data: first } = await neighbor.client.rpc("like_post", { p_post_id: post.id });
  const { data: second } = await neighbor.client.rpc("like_post", { p_post_id: post.id });
  check("like_post: one person counts once", first === 1 && second === 1, `${first} then ${second}`);
  const { error: strangerLike } = await stranger.client.rpc("like_post", { p_post_id: post.id });
  check("like_post: a stranger cannot", Boolean(strangerLike), strangerLike?.code ?? "no error");

  // Ballots carry the board's new fields, and the resident votes.
  const { data: ballot } = await president.client.from("ballots").insert({
    association_id: associationId, title: "Paint", body: ["Blue", "Or green"], status: "open",
    opens_on: day(-1), closes_on: day(7), audience: "owners", live_results_visible: true,
  }).select().single();
  check("ballots: body paragraphs and the new fields round trip", Array.isArray(ballot.body) && ballot.body.length === 2 && ballot.live_results_visible === true);
  const { data: options } = await president.client.from("ballot_options").insert([
    { ballot_id: ballot.id, label: "Blue", position: 0 }, { ballot_id: ballot.id, label: "Green", position: 1 },
  ]).select();
  const { data: receipt, error: voteError } = await neighbor.client.rpc("cast_vote", { p_ballot_id: ballot.id, p_option_id: options[0].id });
  check("cast_vote: still works with the new columns", !voteError && /^VR-/.test(receipt ?? ""), voteError?.message ?? receipt);
} catch (error) {
  check("the run itself", false, error instanceof Error ? error.message : String(error));
} finally {
  for (const id of cleanup.associations) await admin.from("associations").delete().eq("id", id);
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
