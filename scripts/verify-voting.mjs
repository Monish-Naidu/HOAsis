/**
 * The annual meeting's rules (0118): one vote per home whether it arrived
 * online or on paper, quorum counted by the database with the paper and the
 * proxy told apart, a per-ballot dues rule, seating the winners of a closed
 * election (only the President, once, nobody whose home is gone, never the
 * presidency, and whoever held the office steps back to resident), and the
 * results email stamped once. A resident can do none of the board's parts,
 * and a buyer does not read the vote the seller's home cast.
 */
import { randomUUID } from "node:crypto";
import { createHarness, day } from "./lib/harness.mjs";

const { admin, stamp, check, makeUser, cleanup, cleanupAll, report } = createHarness({
  passwordPrefix: "voting-",
  emailTag: "voting",
  claimSeats: true,
  demotePresident: true,
});

try {
  const danaEmail = `dana-voting-${stamp}@example.com`;
  const president = await makeUser("president");
  const voter1 = await makeUser("voter1");
  const voter2 = await makeUser("voter2");
  const dana = await makeUser("dana", danaEmail);
  const percy = await makeUser("percy");
  const ann = await makeUser("ann");
  const vera = await makeUser("vera");
  const seller = await makeUser("seller");
  const buyer = await makeUser("buyer");
  const { data: associationId, error: createError } = await president.client.rpc(
    "create_association",
    {
      p_name: "Voting Test HOA",
      p_city: "Bothell",
      p_state: "WA",
      p_dues_cents: 6000,
      p_dues_cadence: "monthly",
      p_due_day: 1,
      p_founder_name: "Pat Founder",
      p_founder_unit: "1",
      p_households: [
        { name: "Vic Votter", email: voter1.email, unit: "2" },
        { name: "Val Voter", email: voter2.email, unit: "3" },
        // Two homes, one email: Dana holds both, so the dues rule has to
        // leave the past-due one out and still let the other vote.
        { name: "Dana Delinquent", email: danaEmail, unit: "4" },
        { name: "Dana Delinquent", email: danaEmail, unit: "11" },
        { name: "Ann Archer", email: ann.email, unit: "5" },
        { name: "Rae Retired", email: `rae-voting-${stamp}@example.com`, unit: "8" },
        { name: "Sela Seller", email: seller.email, unit: "9" },
        { name: "Vera Voting", email: vera.email, unit: "10" },
        { name: "Percy Pastdue", email: percy.email, unit: "12" },
      ],
    },
  );
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);

  const { data: unitRows } = await admin
    .from("units")
    .select("id, label")
    .eq("association_id", associationId);
  const unit = Object.fromEntries((unitRows ?? []).map((u) => [u.label, u.id]));

  // Two homes are behind: a charge past its due date nothing has paid.
  for (const behind of ["4", "12"]) {
    const { error: chargeError } = await admin.from("charges").insert({
      association_id: associationId,
      unit_id: unit[behind],
      kind: "charge",
      label: "Unpaid dues",
      amount_cents: 6000,
      due_on: day(-10),
    });
    if (chargeError) throw new Error(chargeError.message);
  }

  // Vera holds the voting capability without being the President, which is
  // the seat the Meetings screen runs on and the one that must still not
  // be allowed to seat anybody.
  const { error: grantError } = await president.client
    .from("memberships")
    .update({ capabilities: ["voting"] })
    .eq("association_id", associationId)
    .eq("unit_id", unit["10"])
    .is("ends_on", null);
  check("the voting holder's seat is set", !grantError, grantError?.message ?? "");

  const { data: pastDue } = await president.client.rpc("unit_is_past_due", {
    p_unit_id: unit["12"],
  });
  check("a home with an unpaid, overdue charge is past due", pastDue === true, String(pastDue));
  const { data: current } = await president.client.rpc("unit_is_past_due", {
    p_unit_id: unit["5"],
  });
  check("a home that owes nothing is not past due", current === false, String(current));

  // A bill due today is owed but not late; the rule starts the day after.
  const { error: todayError } = await admin.from("charges").insert({
    association_id: associationId,
    unit_id: unit["3"],
    kind: "charge",
    label: "Dues",
    amount_cents: 6000,
    due_on: day(0),
  });
  if (todayError) throw new Error(todayError.message);
  const { data: dueToday } = await president.client.rpc("unit_is_past_due", {
    p_unit_id: unit["3"],
  });
  check("a home whose bill is due today is not past due", dueToday === false, String(dueToday));

  async function openBallot(
    title,
    { kind = "poll", audience = "owners", status = "open", seats = 1, quorum = 0, dues = false },
  ) {
    const id = randomUUID();
    const { error } = await president.client.from("ballots").insert({
      id,
      association_id: associationId,
      title,
      body: ["The question the homes were asked."],
      kind,
      audience,
      status,
      opens_on: day(-2),
      closes_on: status === "open" ? day(10) : day(-1),
      seats,
      quorum_required: quorum,
      threshold_label: "Most votes wins",
      dues_current_required: dues,
      live_results_visible: true,
    });
    if (error) throw new Error(`${title}: ${error.message}`);
    return id;
  }

  async function options(ballotId, names) {
    const rows = names.map((option, position) => ({
      ballot_id: ballotId,
      label: option.label,
      unit_id: option.unit ?? null,
      position,
    }));
    const { data, error } = await president.client.from("ballot_options").insert(rows).select("id");
    if (error) throw new Error(error.message);
    return Object.fromEntries(names.map((option, i) => [option.label, data[i].id]));
  }

  // A closed election's votes are past entering, so the count is written as
  // the tally it already was: one row per home per seat, on the real tables.
  async function castAsRows(ballotId, marks) {
    const rows = marks.map((mark, i) => ({
      ballot_id: ballotId,
      unit_id: unit[mark.home],
      option_id: mark.option,
      receipt: `VR-TEST-${i}-${ballotId.slice(0, 8)}`,
      method: mark.method ?? "online",
    }));
    const { error } = await admin.from("votes").insert(rows);
    if (error) throw new Error(error.message);
  }

  // --------------------------------------------- one vote per home, either way
  const paper = await openBallot("Paper and proxy", { quorum: 2 });
  const paperOptions = await options(paper, [{ label: "Yes" }, { label: "No" }]);

  const { data: receipt, error: castError } = await voter1.client.rpc("cast_votes", {
    p_ballot_id: paper,
    p_option_ids: [paperOptions["Yes"]],
  });
  check("a home votes online", !castError && Boolean(receipt), castError?.message ?? "");

  const { data: entered, error: enterError } = await president.client.rpc("enter_paper_vote", {
    p_ballot_id: paper,
    p_unit_id: unit["3"],
    p_option_ids: [paperOptions["Yes"]],
    p_method: "paper",
  });
  check(
    "the board enters a paper vote for another home, with a receipt",
    !enterError && /^VR-/.test(entered ?? ""),
    enterError?.message ?? String(entered),
  );

  const { data: proxied, error: proxyError } = await president.client.rpc("enter_paper_vote", {
    p_ballot_id: paper,
    p_unit_id: unit["4"],
    p_option_ids: [paperOptions["Yes"]],
    p_method: "proxy",
    p_proxy_holder: "Olive Proxyholder",
  });
  check(
    "the board enters a proxy, naming who held it",
    !proxyError && /^VR-/.test(proxied ?? ""),
    proxyError?.message ?? String(proxied),
  );

  const { error: againError } = await president.client.rpc("enter_paper_vote", {
    p_ballot_id: paper,
    p_unit_id: unit["2"],
    p_option_ids: [paperOptions["Yes"]],
    p_method: "paper",
  });
  check(
    "a home that voted online cannot get a paper vote too",
    againError?.code === "22000" && /already voted/.test(againError?.message ?? ""),
    againError?.message ?? "no error",
  );

  const { error: onlineError } = await voter2.client.rpc("cast_votes", {
    p_ballot_id: paper,
    p_option_ids: [paperOptions["No"]],
  });
  check(
    "a home whose vote the board entered cannot vote online too",
    onlineError?.code === "22000" && /board already entered/.test(onlineError?.message ?? ""),
    onlineError?.message ?? "no error",
  );

  const { error: residentEnter } = await ann.client.rpc("enter_paper_vote", {
    p_ballot_id: paper,
    p_unit_id: unit["5"],
    p_option_ids: [paperOptions["Yes"]],
    p_method: "paper",
  });
  check(
    "a resident cannot enter a vote",
    residentEnter?.code === "42501",
    residentEnter?.message ?? "no error",
  );

  const { error: badMethod } = await president.client.rpc("enter_paper_vote", {
    p_ballot_id: paper,
    p_unit_id: unit["5"],
    p_option_ids: [paperOptions["Yes"]],
    p_method: "online",
  });
  check(
    "the board enters a paper ballot or a proxy, nothing else",
    badMethod?.code === "22000" && /paper ballot or a proxy/.test(badMethod?.message ?? ""),
    badMethod?.message ?? "no error",
  );

  const { error: noHolder } = await president.client.rpc("enter_paper_vote", {
    p_ballot_id: paper,
    p_unit_id: unit["5"],
    p_option_ids: [paperOptions["Yes"]],
    p_method: "proxy",
  });
  check(
    "a proxy names who held it",
    noHolder?.code === "22000" && /Name who held/.test(noHolder?.message ?? ""),
    noHolder?.message ?? "no error",
  );

  const { error: longHolder } = await president.client.rpc("enter_paper_vote", {
    p_ballot_id: paper,
    p_unit_id: unit["5"],
    p_option_ids: [paperOptions["Yes"]],
    p_method: "proxy",
    p_proxy_holder: "x".repeat(121),
  });
  check(
    "a proxy holder's name is capped",
    longHolder?.code === "22000" && /under 120/.test(longHolder?.message ?? ""),
    longHolder?.message ?? "no error",
  );

  // Two clerks typing in the same home's paper at the same moment, each with
  // a different choice: the advisory lock lets one through and the other
  // finds that vote, so the home counts once.
  const race = await openBallot("Two clerks at once", {});
  const raceOptions = await options(race, [{ label: "Yes" }, { label: "No" }]);
  const both = await Promise.all(
    ["Yes", "No"].map((label) =>
      president.client.rpc("enter_paper_vote", {
        p_ballot_id: race,
        p_unit_id: unit["5"],
        p_option_ids: [raceOptions[label]],
        p_method: "paper",
      }),
    ),
  );
  const { count: raceRows } = await admin
    .from("votes")
    .select("unit_id", { count: "exact", head: true })
    .eq("ballot_id", race);
  check(
    "a paper vote entered twice at once counts once",
    both.filter((r) => !r.error).length === 1 &&
      both.some((r) => /already voted/.test(r.error?.message ?? "")) &&
      raceRows === 1,
    JSON.stringify(both.map((r) => r.error?.message ?? r.data)) + ` rows=${raceRows}`,
  );

  let { data: turnout } = await president.client
    .from("ballot_turnout")
    .select("homes_voted, paper_homes, proxy_homes, quorum_required")
    .eq("ballot_id", paper)
    .single();
  check(
    "the turnout counts every home, one paper and one proxy, against the quorum",
    turnout?.homes_voted === 3 &&
      turnout?.paper_homes === 1 &&
      turnout?.proxy_homes === 1 &&
      turnout?.quorum_required === 2,
    JSON.stringify(turnout),
  );

  const { data: enteredView } = await president.client
    .from("ballot_entered_votes")
    .select("*")
    .eq("ballot_id", paper);
  const byUnit = Object.fromEntries((enteredView ?? []).map((row) => [row.unit_label, row]));
  check(
    "the board reads who and how, never the choice",
    Object.keys(byUnit["3"] ?? {}).length > 0 &&
      byUnit["3"]?.method === "paper" &&
      byUnit["3"]?.entered_by_name === "Pat Founder" &&
      !("option_id" in (byUnit["3"] ?? {})) &&
      byUnit["4"]?.method === "proxy" &&
      byUnit["4"]?.proxy_holder === "Olive Proxyholder",
    JSON.stringify(byUnit),
  );
  const { data: residentView } = await ann.client
    .from("ballot_entered_votes")
    .select("*")
    .eq("ballot_id", paper);
  check(
    "a resident reads none of the entered votes",
    (residentView ?? []).length === 0,
    JSON.stringify(residentView),
  );

  // ---------------------------------------------------------- the dues rule
  const duesBallot = await openBallot("Dues must be current", { dues: true });
  const duesOptions = await options(duesBallot, [{ label: "Yes" }, { label: "No" }]);

  const { error: barredOnline } = await percy.client.rpc("cast_votes", {
    p_ballot_id: duesBallot,
    p_option_ids: [duesOptions["Yes"]],
  });
  check(
    "a past-due home cannot vote online on a ballot that needs dues current",
    barredOnline?.code === "22000" && /Dues must be current/.test(barredOnline?.message ?? ""),
    barredOnline?.message ?? "no error",
  );

  const { error: barredPaper } = await president.client.rpc("enter_paper_vote", {
    p_ballot_id: duesBallot,
    p_unit_id: unit["12"],
    p_option_ids: [duesOptions["Yes"]],
    p_method: "paper",
  });
  check(
    "its paper vote is refused too",
    barredPaper?.code === "22000" && /past due/.test(barredPaper?.message ?? ""),
    barredPaper?.message ?? "no error",
  );

  const { error: splitHomes } = await dana.client.rpc("cast_votes", {
    p_ballot_id: duesBallot,
    p_option_ids: [duesOptions["Yes"]],
  });
  const { count: currentHome } = await admin
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("ballot_id", duesBallot)
    .eq("unit_id", unit["11"]);
  const { count: pastDueHome } = await admin
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("ballot_id", duesBallot)
    .eq("unit_id", unit["4"]);
  check(
    "a person with two homes votes for the current one only",
    !splitHomes && currentHome === 1 && pastDueHome === 0,
    JSON.stringify([splitHomes?.message ?? "ok", currentHome, pastDueHome]),
  );

  const { error: offRule } = await percy.client.rpc("cast_votes", {
    p_ballot_id: paper,
    p_option_ids: [paperOptions["Yes"]],
  });
  check(
    "the same home votes where the ballot does not ask for dues",
    !offRule,
    offRule?.message ?? "no error",
  );

  // ------------------------------------------------------------- seating
  const election = await openBallot("Board election", {
    kind: "election",
    status: "closed",
    seats: 2,
  });
  const electionOptions = await options(election, [
    { label: "Pat Founder", unit: unit["1"] },
    { label: "Ann Archer", unit: unit["5"] },
    { label: "Zeke Unlinked" },
  ]);
  await castAsRows(election, [
    { home: "2", option: electionOptions["Pat Founder"] },
    { home: "3", option: electionOptions["Pat Founder"] },
    { home: "4", option: electionOptions["Pat Founder"], method: "paper" },
    { home: "9", option: electionOptions["Ann Archer"] },
    { home: "10", option: electionOptions["Ann Archer"] },
    { home: "12", option: electionOptions["Zeke Unlinked"] },
  ]);

  // A treasurer is already sitting, so seating a winner has somebody to
  // displace.
  const { error: seatTreasurer } = await president.client
    .from("memberships")
    .update({ role: "treasurer", capabilities: ["finances"], views: [] })
    .eq("association_id", associationId)
    .eq("unit_id", unit["4"])
    .is("ends_on", null);
  check("the sitting treasurer is set", !seatTreasurer, seatTreasurer?.message ?? "");

  const { error: notPresident } = await vera.client.rpc("seat_election_winners", {
    p_ballot_id: election,
    p_offices: { [electionOptions["Ann Archer"]]: "treasurer" },
  });
  check(
    "a voting holder who is not the President cannot seat anybody",
    notPresident?.code === "42501" && /Only the President/.test(notPresident?.message ?? ""),
    notPresident?.message ?? "no error",
  );
  const { error: plainResident } = await ann.client.rpc("seat_election_winners", {
    p_ballot_id: election,
    p_offices: {},
  });
  check(
    "a resident cannot seat anybody",
    plainResident?.code === "42501",
    plainResident?.message ?? "no error",
  );

  const { data: seated, error: seatError } = await president.client.rpc("seat_election_winners", {
    p_ballot_id: election,
    p_offices: { [electionOptions["Ann Archer"]]: "treasurer" },
  });
  const seatedBy = Object.fromEntries((seated ?? []).map((row) => [row.name, row]));
  check(
    "the President is passed over with the reason, the other winner is seated",
    seatedBy["Pat Founder"]?.seated === false &&
      /presidency/.test(seatedBy["Pat Founder"]?.reason ?? "") &&
      seatedBy["Ann Archer"]?.seated === true &&
      seatedBy["Ann Archer"]?.office === "treasurer",
    seatError?.message ?? JSON.stringify(seated),
  );

  const { data: after } = await admin
    .from("memberships")
    .select("role, capabilities, views")
    .eq("association_id", associationId)
    .eq("unit_id", unit["5"])
    .is("ends_on", null)
    .single();
  check(
    "the winner holds the office and its default capabilities",
    after?.role === "treasurer" &&
      (after?.capabilities ?? []).includes("finances") &&
      (after?.capabilities ?? []).includes("vendors") &&
      (after?.views ?? []).includes("finances"),
    JSON.stringify(after),
  );
  const { data: steppedDown } = await admin
    .from("memberships")
    .select("role, capabilities")
    .eq("association_id", associationId)
    .eq("unit_id", unit["4"])
    .is("ends_on", null)
    .single();
  check(
    "the office's sitting holder goes back to resident",
    steppedDown?.role === "resident" && (steppedDown?.capabilities ?? []).length === 0,
    JSON.stringify(steppedDown),
  );

  const { data: twice } = await president.client.rpc("seat_election_winners", {
    p_ballot_id: election,
    p_offices: {},
  });
  const { data: unchanged } = await admin
    .from("memberships")
    .select("role")
    .eq("association_id", associationId)
    .eq("unit_id", unit["5"])
    .is("ends_on", null)
    .single();
  check(
    "pressed again, the same record comes back and nothing changes",
    JSON.stringify(twice) === JSON.stringify(seated) && unchanged?.role === "treasurer",
    JSON.stringify(twice),
  );

  // A winner whose home has been sold out from under them: retired, so
  // not seated from here, with the reason said.
  await president.client.rpc("retire_home", { p_unit_id: unit["8"] });
  const retired = await openBallot("Retired winner", {
    kind: "election",
    status: "closed",
    seats: 2,
  });
  const retiredOptions = await options(retired, [
    { label: "Rae Retired", unit: unit["8"] },
    { label: "Val Voter", unit: unit["3"] },
  ]);
  await castAsRows(retired, [
    { home: "2", option: retiredOptions["Rae Retired"] },
    { home: "9", option: retiredOptions["Rae Retired"] },
    { home: "10", option: retiredOptions["Val Voter"] },
  ]);
  const { data: retiredSeated, error: retiredError } = await president.client.rpc(
    "seat_election_winners",
    { p_ballot_id: retired, p_offices: { [retiredOptions["Val Voter"]]: "secretary" } },
  );
  const retiredBy = Object.fromEntries((retiredSeated ?? []).map((row) => [row.name, row]));
  check(
    "a winner whose home is retired is not seated, and says why",
    !retiredError &&
      retiredBy["Rae Retired"]?.seated === false &&
      /No longer on the register/.test(retiredBy["Rae Retired"]?.reason ?? "") &&
      retiredBy["Val Voter"]?.seated === true &&
      retiredBy["Val Voter"]?.office === "secretary",
    JSON.stringify(retiredSeated ?? retiredError),
  );

  const tied = await openBallot("Tied election", {
    kind: "election",
    status: "closed",
    seats: 1,
  });
  const tiedOptions = await options(tied, [
    { label: "Ann Archer", unit: unit["5"] },
    { label: "Val Voter", unit: unit["3"] },
  ]);
  await castAsRows(tied, [
    { home: "2", option: tiedOptions["Ann Archer"] },
    { home: "9", option: tiedOptions["Val Voter"] },
  ]);
  const { error: tiedError } = await president.client.rpc("seat_election_winners", {
    p_ballot_id: tied,
    p_offices: { [tiedOptions["Ann Archer"]]: "treasurer" },
  });
  check(
    "a tie for the last seat is settled before anybody is seated",
    tiedError?.code === "22000" && /tied/.test(tiedError?.message ?? ""),
    tiedError?.message ?? "no error",
  );

  const missed = await openBallot("Missed quorum", {
    kind: "election",
    status: "closed",
    seats: 1,
    quorum: 5,
  });
  const missedOptions = await options(missed, [{ label: "Ann Archer", unit: unit["5"] }]);
  await castAsRows(missed, [{ home: "2", option: missedOptions["Ann Archer"] }]);
  const { error: missedError } = await president.client.rpc("seat_election_winners", {
    p_ballot_id: missed,
    p_offices: { [missedOptions["Ann Archer"]]: "treasurer" },
  });
  check(
    "an election that missed quorum seats nobody",
    missedError?.code === "22000" && /missed quorum/.test(missedError?.message ?? ""),
    missedError?.message ?? "no error",
  );

  // -------------------------------------------------------- the results email
  const { data: first } = await president.client.rpc("begin_results_email", {
    p_ballot_id: election,
  });
  const { data: second } = await president.client.rpc("begin_results_email", {
    p_ballot_id: election,
  });
  const { data: stamped } = await admin
    .from("ballots")
    .select("results_emailed_at")
    .eq("id", election)
    .single();
  check(
    "the results email is stamped once, and the second press is quiet",
    first === true && second === false && Boolean(stamped?.results_emailed_at),
    JSON.stringify([first, second, stamped?.results_emailed_at]),
  );

  const boardBallot = await openBallot("Board only", { audience: "board", status: "closed" });
  await options(boardBallot, [{ label: "Yes" }, { label: "No" }]);
  const { error: boardEmail } = await president.client.rpc("begin_results_email", {
    p_ballot_id: boardBallot,
  });
  check(
    "a board vote is not emailed to the homes",
    boardEmail?.code === "22000" && /not emailed/.test(boardEmail?.message ?? ""),
    boardEmail?.message ?? "no error",
  );
  const { error: openEmail } = await president.client.rpc("begin_results_email", {
    p_ballot_id: paper,
  });
  check(
    "an open ballot's results are not emailed yet",
    openEmail?.code === "22000" && /Record the result/.test(openEmail?.message ?? ""),
    openEmail?.message ?? "no error",
  );
  const { error: residentEmail } = await ann.client.rpc("begin_results_email", {
    p_ballot_id: election,
  });
  check(
    "a resident cannot send the results",
    residentEmail?.code === "42501",
    residentEmail?.message ?? "no error",
  );

  // ------------------------------------------------- a sale keeps the vote
  // The paper vote this home cast before the sale is the seller's home's
  // history, not the buyer's: dated before the closing, it disappears for
  // whoever holds the home next.
  await president.client.rpc("enter_paper_vote", {
    p_ballot_id: paper,
    p_unit_id: unit["9"],
    p_option_ids: [paperOptions["Yes"]],
    p_method: "paper",
  });
  const { error: dateError } = await admin
    .from("votes")
    .update({ cast_at: `${day(-1)}T12:00:00Z` })
    .eq("ballot_id", paper)
    .eq("unit_id", unit["9"]);
  check("the seller's vote is dated before the sale", !dateError, dateError?.message ?? "");
  const { error: saleError } = await president.client.rpc("transfer_home", {
    p_unit_id: unit["9"],
    p_new_name: "Bar Buyer",
    p_new_email: buyer.email,
  });
  check("the sale is recorded", !saleError, saleError?.message ?? "");
  await buyer.client.rpc("claim_my_seats");
  const { data: buyerReads } = await buyer.client.from("votes").select("id").eq("ballot_id", paper);
  const { data: sellerReads } = await seller.client
    .from("votes")
    .select("id")
    .eq("ballot_id", paper);
  check(
    "the buyer reads none of it, and neither does the seller",
    (buyerReads ?? []).length === 0 && (sellerReads ?? []).length === 0,
    JSON.stringify([buyerReads?.length, sellerReads?.length]),
  );

  // ------------------------------------------------------------- the log
  const { data: log } = await admin
    .from("activity")
    .select("summary")
    .eq("association_id", associationId)
    .eq("subject_kind", "ballot")
    .order("at");
  const summaries = (log ?? []).map((a) => a.summary);
  check(
    "the activity log has the entries, the proxies and the seating",
    summaries.some((s) => /Entered a paper vote for Unit 3/.test(s)) &&
      summaries.some((s) => /Entered a proxy vote for Unit 4/.test(s)) &&
      summaries.some((s) =>
        /Seated the winners of "Board election": Ann Archer as Treasurer/.test(s),
      ),
    JSON.stringify(summaries),
  );
} catch (error) {
  check("the run finished", false, error.message);
} finally {
  await cleanupAll();
}

report();
