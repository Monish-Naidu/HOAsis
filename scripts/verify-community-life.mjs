/**
 * Requests, documents, votes and the forum, against the real database.
 *
 * The rule under test is the same one the money tables established: anything
 * filed against a home is private to that home and the board, and anything a
 * neighbor writes is visible only once somebody approved it.
 */
import { createHarness, day } from "./lib/harness.mjs";

const {
  admin, stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "life-",
  strictSignIn: false,
});
cleanup.files = [];

try {
  const neighborEmail = `neighbor-${stamp}@example.com`;
  const president = await makeUser("president");
  const { data: associationId } = await president.client.rpc("create_association", {
    p_name: "Community Life HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Dana", p_founder_unit: "1",
    p_households: [{ name: "Marcus", email: neighborEmail, unit: "2" }],
  });
  cleanup.associations.push(associationId);
  const neighbor = await makeUser("neighbor");
  const { data: myUnits } = await neighbor.client.rpc("my_unit_ids");
  const neighborUnit = myUnits[0];
  const { data: presUnits } = await president.client.rpc("my_unit_ids");

  // Requests are private to the home.
  const { error: fileError } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: neighborUnit, filed_by: neighbor.id,
    reference: "REQ-1", kind: "maintenance", title: "Gate latch sticking",
  });
  check("a resident can file a request for their own home", !fileError, fileError?.message ?? "");

  const { error: forgeError } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: presUnits[0], filed_by: neighbor.id,
    reference: "REQ-2", kind: "maintenance", title: "Filed against a neighbor",
  });
  check("and cannot file one against a neighbor's home", Boolean(forgeError), forgeError?.code ?? "no error");

  // A new request starts at the beginning (0068). The policy used to check
  // the home and nothing else, so one could arrive already approved, with a
  // certificate, and the activity record never saw a decision.
  const { error: preApproved } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: neighborUnit, filed_by: neighbor.id,
    reference: "REQ-3", kind: "architectural", title: "Fence",
    status: "approved", decided_by: "Board", certificate_id: "ARC-2026-001",
  });
  check("a request cannot arrive already approved", Boolean(preApproved), preApproved?.code ?? "no error");
  const { error: preCertified } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: neighborUnit, filed_by: neighbor.id,
    reference: "REQ-4", kind: "architectural", title: "Shed", certificate_id: "ARC-2026-002",
  });
  check("or carrying a certificate", Boolean(preCertified), preCertified?.code ?? "no error");
  const { error: otherFiler } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: neighborUnit, filed_by: president.id,
    reference: "REQ-5", kind: "maintenance", title: "Filed in the President's name",
  });
  check("or in somebody else's name", Boolean(otherFiler), otherFiler?.code ?? "no error");

  const { data: boardSees } = await president.client.from("requests").select("title");
  check("the board sees requests from every home", (boardSees ?? []).length === 1, String((boardSees ?? []).length));

  // What 0068 left the browser free to claim on a new request (0077). The
  // thread it arrives with is the owner's note and the system's line, as
  // the request form sends them, and never the board's voice.
  const ownersNote = { id: "rt-1", at: day(0), actor: "Marcus", actorRole: "resident", body: "Six foot cedar fence.", kind: "note" };
  const systemLine = { id: "rt-2", at: day(0), actor: "Your HOAsis", actorRole: "system", body: "Routed to the board.", kind: "status" };
  const { error: boardVoice } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: neighborUnit, filed_by: neighbor.id,
    reference: "REQ-6", kind: "architectural", title: "Fence, already answered",
    thread: [ownersNote, { id: "rt-9", at: day(0), actor: "Dana", actorRole: "board", body: "Approved by the President.", kind: "status" }],
  });
  check("a request cannot arrive with the board already speaking in it", Boolean(boardVoice), boardVoice?.code ?? "no error");

  // Filed the way the form files it: today, with the article's clock.
  const { error: formError } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: neighborUnit, filed_by: neighbor.id,
    reference: "REQ-7", kind: "architectural", title: "Fence", status: "submitted",
    submitted_on: day(0), due_on: day(45), due_reason: "CC&Rs 7.2. Not decided within 45 days is deemed approved.",
    attachments: [], thread: [ownersNote, systemLine], submission: null, certificate_id: null,
  });
  const { data: asFiled } = await admin.from("requests").select("submitted_on, due_on, thread")
    .eq("association_id", associationId).eq("reference", "REQ-7").maybeSingle();
  check("a request filed the way the form files it lands as sent",
    !formError && asFiled?.submitted_on === day(0) && asFiled?.due_on === day(45) && asFiled?.thread?.length === 2,
    formError?.message ?? JSON.stringify(asFiled));

  // Backdated sixty days, so its forty-five day clock reads as run out.
  // It is not refused, because a tab left open sends an old date in good
  // faith: it is dated the day it arrived and the clock keeps its length.
  const { error: backdatedError } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: neighborUnit, filed_by: neighbor.id,
    reference: "REQ-8", kind: "architectural", title: "Shed, filed long ago",
    submitted_on: day(-60), due_on: day(-15),
  });
  const { data: backdated } = await admin.from("requests").select("submitted_on, due_on")
    .eq("association_id", associationId).eq("reference", "REQ-8").maybeSingle();
  const clockDays = backdated ? Math.round((Date.parse(backdated.due_on) - Date.parse(backdated.submitted_on)) / 86_400_000) : null;
  check("a backdated request is dated the day it arrived, and its clock keeps its length",
    !backdatedError && Boolean(backdated) && backdated.submitted_on >= day(-1) && backdated.submitted_on <= day(1) && clockDays === 45,
    backdatedError?.message ?? JSON.stringify(backdated));

  // A request cannot arrive with its deadline already run out (0077).
  const { error: expiredError } = await neighbor.client.from("requests").insert({
    association_id: associationId, unit_id: neighborUnit, filed_by: neighbor.id,
    reference: "REQ-9", kind: "architectural", title: "Shed, clock already run out",
    submitted_on: day(0), due_on: day(-1),
  });
  check("a request cannot arrive with its deadline already past", Boolean(expiredError), expiredError?.message?.slice(0, 60) ?? "no error");

  // Documents respect visibility.
  await president.client.from("documents").insert([
    { association_id: associationId, name: "CC&Rs", category: "Governing", visibility: "owners" },
    { association_id: associationId, name: "Legal memo", category: "Notices", visibility: "board" },
  ]);
  const { data: residentDocs } = await neighbor.client.from("documents").select("name");
  check("an owner sees owner documents and not board ones",
    (residentDocs ?? []).length === 1 && residentDocs[0].name === "CC&Rs",
    JSON.stringify((residentDocs ?? []).map((d) => d.name)));

  // Files follow the row. The bytes live in Storage under the association's
  // folder, and the storage policy reads the row to decide who may open them.
  const stranger = await makeUser("stranger");
  const ownersDocId = crypto.randomUUID();
  const boardDocId = crypto.randomUUID();
  const ownersPath = `${associationId}/${ownersDocId}.pdf`;
  const boardPath = `${associationId}/${boardDocId}.pdf`;
  cleanup.files.push(ownersPath, boardPath);
  const pdf = new Blob(["%PDF-1.4 verify"], { type: "application/pdf" });

  const { error: putError } = await president.client.storage.from("documents")
    .upload(ownersPath, pdf, { contentType: "application/pdf" });
  check("a documents holder can upload into their association's folder", !putError, putError?.message ?? "");
  await president.client.storage.from("documents").upload(boardPath, pdf, { contentType: "application/pdf" });
  const { error: rowError } = await president.client.from("documents").insert([
    { id: ownersDocId, association_id: associationId, name: "Budget", category: "Financial", visibility: "owners", storage_path: ownersPath, size_label: "1 KB" },
    { id: boardDocId, association_id: associationId, name: "Counsel letter", category: "Notices", visibility: "board", storage_path: boardPath, size_label: "1 KB" },
  ]);
  check("and file the rows that point at the files", !rowError, rowError?.message ?? "");

  const { error: neighborPut } = await neighbor.client.storage.from("documents")
    .upload(`${associationId}/${crypto.randomUUID()}.pdf`, pdf, { contentType: "application/pdf" });
  check("a resident cannot upload", Boolean(neighborPut), neighborPut?.message ?? "no error");

  const { data: ownersLink, error: ownersLinkError } = await neighbor.client.storage.from("documents").createSignedUrl(ownersPath, 60);
  check("a resident can open a document published to owners", !ownersLinkError && Boolean(ownersLink?.signedUrl), ownersLinkError?.message ?? "");
  const { error: boardLinkError } = await neighbor.client.storage.from("documents").createSignedUrl(boardPath, 60);
  check("and cannot open a board only one", Boolean(boardLinkError), boardLinkError?.message ?? "no error");
  const { error: strangerLinkError } = await stranger.client.storage.from("documents").createSignedUrl(ownersPath, 60);
  check("a stranger cannot open anything", Boolean(strangerLinkError), strangerLinkError?.message ?? "no error");

  // Storage answers a forbidden delete with silence rather than an error, so
  // the proof is that the file is still there afterwards.
  await neighbor.client.storage.from("documents").remove([ownersPath]);
  const { data: afterResidentDelete } = await admin.storage.from("documents").list(associationId);
  check("a resident's delete removes nothing", (afterResidentDelete ?? []).some((f) => f.name === `${ownersDocId}.pdf`));
  const { error: boardDeleteError } = await president.client.storage.from("documents").remove([boardPath]);
  const { data: afterBoardDelete } = await admin.storage.from("documents").list(associationId);
  check("the board's delete does", !boardDeleteError && !(afterBoardDelete ?? []).some((f) => f.name === `${boardDocId}.pdf`), boardDeleteError?.message ?? "");

  // The app deletes the row first and the file second, so the worst outcome
  // of a failure between the two is an unreachable orphan rather than a
  // document that appears to exist. That order has to work.
  await president.client.from("documents").delete().eq("id", ownersDocId);
  const { error: rowlessDeleteError } = await president.client.storage.from("documents").remove([ownersPath]);
  const { data: afterRowlessDelete } = await admin.storage.from("documents").list(associationId);
  check("the board can remove a file whose row is already gone", !rowlessDeleteError && !(afterRowlessDelete ?? []).some((f) => f.name === `${ownersDocId}.pdf`), rowlessDeleteError?.message ?? "");

  // Voting.
  const { data: ballot } = await president.client.from("ballots").insert({
    association_id: associationId, title: "Renew the landscaper", status: "open",
    opens_on: day(-1), closes_on: day(14), quorum_required: 1,
  }).select().single();
  const { data: options } = await president.client.from("ballot_options").insert([
    { ballot_id: ballot.id, label: "For", position: 0 },
    { ballot_id: ballot.id, label: "Against", position: 1 },
  ]).select();

  const { data: receipt, error: voteError } = await neighbor.client.rpc("cast_vote", {
    p_ballot_id: ballot.id, p_option_id: options[0].id,
  });
  check("a resident can vote and gets a receipt", !voteError && /^VR-/.test(receipt ?? ""), voteError?.message ?? receipt);

  const { data: changed } = await neighbor.client.rpc("cast_vote", {
    p_ballot_id: ballot.id, p_option_id: options[1].id,
  });
  check("changing their mind keeps the same receipt", changed === receipt, `${receipt} then ${changed}`);

  const { data: tally } = await president.client.from("ballot_tallies").select("*").eq("ballot_id", ballot.id);
  const total = (tally ?? []).reduce((t, r) => t + r.votes, 0);
  check("a changed vote moves rather than adding a second", total === 1, `${total} votes counted`);

  const { data: othersVotes } = await president.client.from("votes").select("*").eq("ballot_id", ballot.id);
  check("nobody can read how a neighbor voted", (othersVotes ?? []).length === 0, `${(othersVotes ?? []).length} rows`);

  // Votes go through cast_votes and nowhere else (0067). A row written
  // straight into the table could mark every choice on a one-seat ballot,
  // or name an open ballot and a choice from a certified one.
  const { error: secondMark } = await neighbor.client.from("votes").insert({
    ballot_id: ballot.id, unit_id: neighborUnit, option_id: options[0].id, receipt: "VR-forged",
  });
  check("a second mark cannot be inserted past cast_votes", Boolean(secondMark), secondMark?.code ?? "no error");
  const { data: moved } = await neighbor.client.from("votes")
    .update({ receipt: "VR-forged" }).eq("ballot_id", ballot.id).eq("unit_id", neighborUnit).select("receipt");
  check("nor an existing vote rewritten", (moved ?? []).length === 0, `${(moved ?? []).length} rows`);

  const { data: closedBallot } = await admin.from("ballots").insert({
    association_id: associationId, title: "Last year's budget", status: "closed",
    opens_on: day(-60), closes_on: day(-30), quorum_required: 1,
  }).select().single();
  const { data: closedOptions } = await admin.from("ballot_options").insert([
    { ballot_id: closedBallot.id, label: "For", position: 0 },
  ]).select();
  const { error: crossBallot } = await neighbor.client.from("votes").insert({
    ballot_id: ballot.id, unit_id: neighborUnit, option_id: closedOptions[0].id, receipt: "VR-forged",
  });
  const { data: closedTally } = await president.client.from("ballot_tallies").select("*").eq("ballot_id", closedBallot.id);
  check("a closed ballot's count cannot be added to",
    Boolean(crossBallot) && (closedTally ?? []).reduce((t, r) => t + r.votes, 0) === 0,
    crossBallot?.code ?? `${(closedTally ?? []).reduce((t, r) => t + r.votes, 0)} votes`);

  const { data: tallyAfter } = await president.client.from("ballot_tallies").select("*").eq("ballot_id", ballot.id);
  check("the open ballot still counts the home once",
    (tallyAfter ?? []).reduce((t, r) => t + r.votes, 0) === 1, JSON.stringify((tallyAfter ?? []).map((r) => r.votes)));
  const { data: recast, error: recastError } = await neighbor.client.rpc("cast_vote", {
    p_ballot_id: ballot.id, p_option_id: options[1].id,
  });
  check("and the real way to vote still works, same receipt", !recastError && recast === receipt, recastError?.message ?? `${recast}`);

  // A ballot stops taking votes after its closing date (0076). Nothing
  // closes the row on the date, so it is still 'open' here, and a vote sent
  // by hand used to be counted. The day after closing is still allowed:
  // current_date is UTC, and that is the closing evening in most of the US.
  await president.client.from("ballots").update({ closes_on: day(-2) }).eq("id", ballot.id);
  const { error: lateVote } = await neighbor.client.rpc("cast_vote", {
    p_ballot_id: ballot.id, p_option_id: options[0].id,
  });
  const { data: lateTally } = await president.client.from("ballot_tallies").select("*").eq("ballot_id", ballot.id);
  check("a vote after the closing date is refused",
    Boolean(lateVote) && /closed/.test(lateVote.message ?? "")
      && (lateTally ?? []).find((t) => t.option_id === options[1].id)?.votes === 1
      && ((lateTally ?? []).find((t) => t.option_id === options[0].id)?.votes ?? 0) === 0,
    lateVote?.message ?? JSON.stringify((lateTally ?? []).map((t) => t.votes)));
  await president.client.from("ballots").update({ closes_on: day(-1) }).eq("id", ballot.id);
  const { data: graceVote, error: graceError } = await neighbor.client.rpc("cast_votes", {
    p_ballot_id: ballot.id, p_option_ids: [options[1].id],
  });
  check("the day after closing is still counted, for the evening UTC has left", !graceError && graceVote === receipt, graceError?.message ?? `${graceVote}`);
  await president.client.from("ballots").update({ closes_on: day(14) }).eq("id", ballot.id);

  // Forum moderation.
  const { data: post } = await neighbor.client.from("posts").insert({
    association_id: associationId, author_id: neighbor.id, author_name: "Marcus",
    title: "Anyone have a ladder?", body: "Need one for a weekend.",
  }).select().single();
  check("a new post is held for review", post?.status === "pending", post?.status);

  // A resident's post cannot arrive published, pinned or under an office
  // (0068). An officer's may be published straight away.
  const { error: selfPublished } = await neighbor.client.from("posts").insert({
    association_id: associationId, author_id: neighbor.id, author_name: "Marcus",
    title: "Skipping the queue", body: "x", status: "published",
  });
  check("a resident cannot insert a post already published", Boolean(selfPublished), selfPublished?.code ?? "no error");
  const { error: selfPinned } = await neighbor.client.from("posts").insert({
    association_id: associationId, author_id: neighbor.id, author_name: "Dana",
    title: "From the President", body: "x", pinned: true, author_role: "President",
  });
  check("or pinned under an officer's title", Boolean(selfPinned), selfPinned?.code ?? "no error");
  const { data: officerPost, error: officerPostError } = await president.client.from("posts").insert({
    association_id: associationId, author_id: president.id, author_name: "Dana",
    author_role: "President", title: "Pool hours", body: "Open at nine.", status: "published",
  }).select("id").single();
  check("an officer's post is published straight away", !officerPostError && Boolean(officerPost), officerPostError?.message ?? "");
  if (officerPost) await admin.from("posts").delete().eq("id", officerPost.id);

  // A post is signed with its author's own seat (0077), whatever name and
  // home the browser sent. Marcus holds home 2; Dana is the President in 1.
  const { data: signed } = await admin.from("posts").select("author_name, unit_label").eq("id", post?.id).maybeSingle();
  check("a post takes the home of the seat its author holds", signed?.author_name === "Marcus" && signed?.unit_label === "2", JSON.stringify(signed));
  const forgedId = crypto.randomUUID();
  const { error: forgedPostError } = await neighbor.client.from("posts").insert({
    id: forgedId, association_id: associationId, author_id: neighbor.id, author_name: "Dana", unit_label: "1",
    title: "Speaking for a neighbour", body: "x",
  });
  const { data: forgedPost } = await admin.from("posts").select("author_name, unit_label, status").eq("id", forgedId).maybeSingle();
  check("a post cannot be signed with a neighbour's name and home",
    !forgedPostError && forgedPost?.author_name === "Marcus" && forgedPost?.unit_label === "2" && forgedPost?.status === "pending",
    forgedPostError?.message ?? JSON.stringify(forgedPost));
  await admin.from("posts").delete().eq("id", forgedId);

  const other = await makeUser("bystander");
  await admin.from("memberships").insert({
    association_id: associationId, unit_id: presUnits[0], profile_id: other.id,
    full_name: "Bystander", role: "resident", capabilities: [],
  });
  const { data: bystanderSees } = await other.client.from("posts").select("title");
  check("a pending post is invisible to other neighbors", (bystanderSees ?? []).length === 0, String((bystanderSees ?? []).length));

  await president.client.from("posts").update({ status: "published", moderated_by: "Dana" }).eq("id", post.id);
  const { data: afterPublish } = await other.client.from("posts").select("title");
  check("and visible once the board publishes it", (afterPublish ?? []).length === 1, String((afterPublish ?? []).length));

  // A resident trying to reject a published post must change nothing.
  await neighbor.client.from("posts").update({ status: "rejected" }).eq("id", post.id);
  const { data: stillPublished } = await admin.from("posts").select("status").eq("id", post.id).single();
  check("a resident cannot moderate a post", stillPublished?.status === "published", stillPublished?.status);

  // An outsider cannot count another association's ballot.
  const outsider = await makeUser("outsider");
  const { data: outsiderTally } = await outsider.client.from("ballot_tallies").select("*").eq("ballot_id", ballot.id);
  check("an outsider cannot count our ballot", (outsiderTally ?? []).length === 0, String((outsiderTally ?? []).length));
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  if (cleanup.files.length) await admin.storage.from("documents").remove(cleanup.files).catch(() => {});
  await cleanupAll();
}

report();
