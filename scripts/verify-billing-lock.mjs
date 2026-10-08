/**
 * A board that stops paying is read-only in the database (0105).
 *
 * A president founds an association with one resident. As admin the status
 * goes past_due with past_due_since fifteen days ago: the president's insert
 * into vendors is refused (42501), the service role can still write, and the
 * resident can still start a thread and vote. Cancelled: the same. Back to
 * active: the president writes again. Also: a past due of thirteen days is
 * not locked yet. Pure Supabase; cleaned up at the end.
 */
import { createHarness, day } from "./lib/harness.mjs";

const {
  admin, stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "billock-",
  emailTag: "billock",
  claimSeats: true,
});
const noon = (o) => `${day(o)}T12:00:00Z`;

try {
  const residentEmail = `resident-billock-${stamp}@example.com`;
  const president = await makeUser("president");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Billing Lock Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Rae Resident", email: residentEmail, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);

  const resident = await makeUser("resident", residentEmail);
  const { data: units } = await resident.client.rpc("my_unit_ids");
  const unit2 = units?.[0];
  check("the resident claims the seat on home 2", Boolean(unit2), String(units));

  // An open ballot with two options, made while the board is still paid.
  const { data: ballot } = await admin.from("ballots").insert({
    association_id: associationId, title: "Lock test vote", status: "open",
    opens_on: day(-1), closes_on: day(14), quorum_required: 1,
  }).select().single();
  const { data: options } = await admin.from("ballot_options").insert([
    { ballot_id: ballot.id, label: "For", position: 0 },
    { ballot_id: ballot.id, label: "Against", position: 1 },
  ]).select();

  let n = 0;
  const presidentAddsVendor = () => president.client.from("vendors").insert({ association_id: associationId, name: `Vendor ${++n}` });
  const setBilling = (patch) => admin.from("associations").update(patch).eq("id", associationId);

  const { error: paidError } = await presidentAddsVendor();
  check("paid up: the president adds a vendor", !paidError, paidError?.message ?? "");

  // Thirteen days past due: still inside the two weeks.
  await setBilling({ subscription_status: "past_due", past_due_since: noon(-13) });
  const { error: earlyError } = await presidentAddsVendor();
  check("past due 13 days: the president still writes", !earlyError, earlyError?.message ?? "");

  let owner = 0;
  async function lockedChecks(label) {
    const { error: refused } = await presidentAddsVendor();
    check(`${label}: the president's insert into vendors is refused with 42501`, refused?.code === "42501", `${refused?.code} ${refused?.message ?? "no error"}`);
    const { data: vendors } = await president.client.from("vendors").select("id");
    check(`${label}: the president can still read`, (vendors ?? []).length >= 1, String((vendors ?? []).length));
    const { error: serviceError } = await admin.from("vendors").insert({ association_id: associationId, name: `Service ${++n}` });
    check(`${label}: the service role can still insert`, !serviceError, serviceError?.message ?? "");
    // The functions a board acts through ask the same question (0107).
    const { error: fnRefused } = await president.client.rpc("add_charge", { p_unit_id: unit2, p_amount_cents: 100, p_label: "Locked", p_due_on: day(0) });
    check(`${label}: the president's add_charge is refused too`, fnRefused?.code === "42501", `${fnRefused?.code} ${fnRefused?.message ?? "no error"}`);

    const { data: threadId, error: threadError } = await resident.client.rpc("start_owner_thread", {
      p_unit_id: unit2, p_subject: `Question ${++owner} (${label})`, p_body: "Is anyone there?", p_tag: "General",
    });
    check(`${label}: the resident can still start a thread`, !threadError && Boolean(threadId), threadError?.message ?? "");
    // A vote is cast once per seat, so the second pass finds it already cast.
    const { error: voteError } = await resident.client.rpc("cast_votes", { p_ballot_id: ballot.id, p_option_ids: [options[0].id] });
    const voted = !voteError || /already/i.test(voteError.message);
    check(`${label}: the resident can still vote`, voted, voteError?.message ?? "");
    const { error: requestError } = await resident.client.from("requests").insert({
      association_id: associationId, unit_id: unit2, filed_by: resident.id,
      reference: `REQ-LOCK-${owner}`, kind: "maintenance", title: `Gutter ${label}`,
    });
    check(`${label}: the resident can still file a request`, !requestError, requestError?.message ?? "");

    // 0110: settings, the board's request changes and its thread edits wait
    // too; the owner's own request and the owner's own thread do not.
    const { data: filed } = await admin.from("requests").select("id").eq("reference", `REQ-LOCK-${owner}`).single();
    // An owner has no update policy on requests (filing is the owner's
    // only write), so the owner's path through the lock is the insert above.
    const { data: boardEdit, error: boardEditError } = await president.client.from("requests").update({ status: "in-review" }).eq("id", filed.id).select("id");
    check(`${label}: the president's status change is refused`, boardEditError?.code === "42501" || (boardEdit ?? []).length === 0, boardEditError?.message ?? String((boardEdit ?? []).length));
    const { data: settingsEdit, error: settingsError } = await president.client.from("associations").update({ contact_email: "board@example.org" }).eq("id", associationId).select("id");
    check(`${label}: a settings change is refused`, settingsError?.code === "42501" || (settingsEdit ?? []).length === 0, settingsError?.message ?? String((settingsEdit ?? []).length));
    const { data: threadEdit, error: threadEditError } = await president.client.from("threads").update({ tag: "Billing" }).eq("id", threadId).select("id");
    check(`${label}: the president's thread edit is refused`, threadEditError?.code === "42501" || (threadEdit ?? []).length === 0, threadEditError?.message ?? String((threadEdit ?? []).length));
    const { error: replyRefused } = await president.client.rpc("reply_as_board", { p_thread_id: threadId, p_body: "We are here" });
    check(`${label}: the president's reply is refused`, replyRefused?.code === "42501", `${replyRefused?.code} ${replyRefused?.message ?? "no error"}`);
  }

  await setBilling({ subscription_status: "past_due", past_due_since: noon(-15) });
  await lockedChecks("past due 15 days");

  await setBilling({ subscription_status: "canceled", past_due_since: null });
  await lockedChecks("cancelled");

  await setBilling({ subscription_status: "active", past_due_since: null });
  const { error: backError } = await presidentAddsVendor();
  check("active again: the president's insert works", !backError, backError?.message ?? "");
  const { data: settingsBack, error: settingsBackError } = await president.client.from("associations").update({ contact_email: "board@example.org" }).eq("id", associationId).select("id");
  check("active again: a settings change works", !settingsBackError && (settingsBack ?? []).length === 1, settingsBackError?.message ?? String((settingsBack ?? []).length));
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
