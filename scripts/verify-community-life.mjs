/**
 * Requests, documents, votes and the forum, against the real database.
 *
 * The rule under test is the same one the money tables established: anything
 * filed against a home is private to that home and the board, and anything a
 * neighbor writes is visible only once somebody approved it.
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
const PASSWORD = "life-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [], files: [] };
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

  const { data: boardSees } = await president.client.from("requests").select("title");
  check("the board sees requests from every home", (boardSees ?? []).length === 1, String((boardSees ?? []).length));

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

  // Forum moderation.
  const { data: post } = await neighbor.client.from("posts").insert({
    association_id: associationId, author_id: neighbor.id, author_name: "Marcus",
    title: "Anyone have a ladder?", body: "Need one for a weekend.",
  }).select().single();
  check("a new post is held for review", post?.status === "pending", post?.status);

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
  for (const id of cleanup.associations) await admin.from("associations").delete().eq("id", id);
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
