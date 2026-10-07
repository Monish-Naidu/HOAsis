/**
 * An owner of two homes in one association votes once for each (0096).
 *
 * Founds a throwaway association whose homes 2 and 3 name the same email, so
 * one person holds both. That person signs in and claims; claim_my_seats must
 * take both seats. They read both homes' charges through my_unit_ids, cast a
 * vote (both homes get a row and the tally shows 2), change it (still two
 * rows, both the new option), and cast once more (the home count stays 2).
 * Autopay is set for one home and must leave the other alone. Pure Supabase;
 * cleaned up at the end.
 */
import { createHarness, day } from "./lib/harness.mjs";

const {
  admin, stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "twohomes-",
  emailTag: "twohomes",
  claimSeats: true,
});

try {
  const ownerEmail = `owner-twohomes-${stamp}@example.com`;
  const president = await makeUser("president");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Two Homes Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [
      { name: "Olive Owner", email: ownerEmail, unit: "2" },
      { name: "Olive Owner", email: ownerEmail, unit: "3" },
    ],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await admin.from("associations").update({ billing_starts_on: day(-60) }).eq("id", associationId);

  const owner = await makeUser("owner", ownerEmail);
  // Signing up with the invited address claims the seats on the way in, so
  // claim_my_seats finds nothing left to claim; the seats themselves are
  // what is checked below.
  const { data: held } = await admin.from("memberships").select("unit_id").eq("association_id", associationId).eq("profile_id", owner.id).is("ends_on", null);
  const units = (held ?? []).map((m) => m.unit_id);
  check("the owner holds two seats on two different homes", units.length === 2 && new Set(units).size === 2, String(units.length));

  const { data: mine } = await owner.client.rpc("my_unit_ids");
  check("my_unit_ids lists both homes", (mine ?? []).length === 2 && units.every((u) => (mine ?? []).includes(u)), String(mine));

  const { data: billed } = await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Test dues", p_due_on: day(-40) });
  check("all three homes were billed", billed === 3, String(billed));
  const { data: charges } = await owner.client.from("charges").select("unit_id").eq("association_id", associationId);
  const chargeUnits = new Set((charges ?? []).map((c) => c.unit_id));
  check("the owner reads the charges of both homes", units.every((u) => chargeUnits.has(u)), String(chargeUnits.size));
  check("and of no other home", chargeUnits.size === 2, String(chargeUnits.size));

  const { data: ballot } = await admin.from("ballots").insert({
    association_id: associationId, title: "Renew the landscaper", status: "open",
    opens_on: day(-1), closes_on: day(14), quorum_required: 1,
  }).select().single();
  const { data: options } = await admin.from("ballot_options").insert([
    { ballot_id: ballot.id, label: "For", position: 0 },
    { ballot_id: ballot.id, label: "Against", position: 1 },
  ]).select().order("position");
  const tallyOf = async (optionId) => {
    const { data } = await owner.client.from("ballot_tallies").select("option_id, votes").eq("ballot_id", ballot.id);
    return (data ?? []).find((t) => t.option_id === optionId)?.votes;
  };
  const voteRows = async () => {
    const { data } = await admin.from("votes").select("unit_id, option_id, receipt").eq("ballot_id", ballot.id);
    return data ?? [];
  };
  const homesVoted = async () => {
    const { data } = await owner.client.from("ballot_turnout").select("homes_voted").eq("ballot_id", ballot.id);
    return data?.[0]?.homes_voted;
  };

  const { data: receipt, error: castError } = await owner.client.rpc("cast_votes", { p_ballot_id: ballot.id, p_option_ids: [options[0].id] });
  check("the owner casts a vote", !castError && typeof receipt === "string", castError?.message ?? "");
  let rows = await voteRows();
  check("both homes have a vote row", rows.length === 2 && units.every((u) => rows.some((r) => r.unit_id === u)), String(rows.length));
  check("both rows are the first option", rows.every((r) => r.option_id === options[0].id));
  check("ballot_tallies shows 2 for the choice", (await tallyOf(options[0].id)) === 2, String(await tallyOf(options[0].id)));
  check("two homes have voted", (await homesVoted()) === 2, String(await homesVoted()));
  check("the returned receipt is one of the homes' receipts", rows.some((r) => r.receipt === receipt));

  const firstReceipts = Object.fromEntries(rows.map((r) => [r.unit_id, r.receipt]));
  const { error: changeError } = await owner.client.rpc("cast_votes", { p_ballot_id: ballot.id, p_option_ids: [options[1].id] });
  check("the owner changes the vote", !changeError, changeError?.message ?? "");
  rows = await voteRows();
  check("still two rows after the change", rows.length === 2, String(rows.length));
  check("both rows are the new option", rows.every((r) => r.option_id === options[1].id));
  check("each home keeps its own receipt", rows.every((r) => r.receipt === firstReceipts[r.unit_id]));
  check("the old choice has no votes left", (await tallyOf(options[0].id)) === 0, String(await tallyOf(options[0].id)));
  check("the new choice shows 2", (await tallyOf(options[1].id)) === 2, String(await tallyOf(options[1].id)));

  await owner.client.rpc("cast_votes", { p_ballot_id: ballot.id, p_option_ids: [options[1].id] });
  check("a second cast of the same choice leaves two rows", (await voteRows()).length === 2, String((await voteRows()).length));
  check("and the home count in the tally is still 2", (await tallyOf(options[1].id)) === 2 && (await homesVoted()) === 2, String(await homesVoted()));

  const stranger = await makeUser("stranger");
  const { error: strangerError } = await stranger.client.rpc("cast_votes", { p_ballot_id: ballot.id, p_option_ids: [options[0].id] });
  check("someone who holds no home here cannot vote", Boolean(strangerError), strangerError?.message ?? "");
  check("and adds no rows", (await voteRows()).length === 2);

  // Autopay for one home leaves the other as it was.
  const plan = { day: 3, capCents: 50000 };
  const { error: autopayError } = await owner.client.rpc("set_my_home_autopay", { p_association_id: associationId, p_unit_id: units[0], p_autopay: plan });
  check("autopay is set for one home", !autopayError, autopayError?.message ?? "");
  const { data: seats } = await admin.from("memberships").select("unit_id, autopay").eq("association_id", associationId).eq("profile_id", owner.id);
  const withPlan = (seats ?? []).filter((m) => m.autopay);
  check("only that home has the plan", withPlan.length === 1 && withPlan[0].unit_id === units[0], String(withPlan.length));
  const { error: otherError } = await stranger.client.rpc("set_my_home_autopay", { p_association_id: associationId, p_unit_id: units[1], p_autopay: plan });
  check("someone who does not hold the home cannot set its autopay", Boolean(otherError), otherError?.message ?? "");
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
