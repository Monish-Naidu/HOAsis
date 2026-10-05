/**
 * A buyer does not read what the seller did while they owned the home (0089).
 *
 * Founds a throwaway association with an owner on home 2 (the seller), who
 * files a request, starts a thread with the board, votes, and is sent a rule
 * notice. The seller's rows are backdated forty days, then the board records a
 * sale of the home closing ten days ago and the buyer signs in. The buyer must
 * read none of the seller's requests, threads, messages, votes or notices, can
 * still file and read their own, and still reads the home's charges. The
 * president reads everything; a second owner added to the buyer's home reads
 * the household's history from the earliest current seat; the seller, with no
 * seat left, reads nothing. Pure Supabase; cleaned up at the end.
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
const PASSWORD = "salepriv-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };
const day = (o) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };
const noon = (o) => `${day(o)}T12:00:00Z`;

async function makeUser(who, email = `${who}-salepriv-${stamp}@example.com`) {
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
  const sellerEmail = `seller-salepriv-${stamp}@example.com`;
  const buyerEmail = `buyer-salepriv-${stamp}@example.com`;
  const secondEmail = `second-salepriv-${stamp}@example.com`;
  const closing = day(-10);

  const president = await makeUser("president");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Sale Privacy Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Sam Seller", email: sellerEmail, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await admin.from("associations").update({ billing_starts_on: day(-60) }).eq("id", associationId);

  const seller = await makeUser("seller", sellerEmail);
  const { data: sellerUnits } = await seller.client.rpc("my_unit_ids");
  const unit2 = sellerUnits?.[0];
  check("the seller claims the seat on home 2", Boolean(unit2), String(sellerUnits));
  // The seller has owned it for a long while, so the sale can close in the past.
  await admin.from("memberships").update({ starts_on: day(-90) }).eq("unit_id", unit2).is("ends_on", null);

  // Money on the home, billed before the buyer's closing date.
  const { data: billed } = await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Test dues", p_due_on: day(-40) });
  check("both homes were billed forty days ago", billed === 2, String(billed));

  // The seller's side of the story.
  const { error: reqError } = await seller.client.from("requests").insert({
    association_id: associationId, unit_id: unit2, filed_by: seller.id,
    reference: "REQ-SELL-1", kind: "maintenance", title: "Seller: leaking gutter",
  });
  check("the seller files a request", !reqError, reqError?.message ?? "");
  const { data: sellerThreadId, error: threadError } = await seller.client.rpc("start_owner_thread", {
    p_unit_id: unit2, p_subject: "Seller: private question", p_body: "A private word with the board", p_tag: "General",
  });
  check("the seller starts a thread with the board", !threadError && Boolean(sellerThreadId), threadError?.message ?? "");
  const { error: replyError } = await president.client.rpc("reply_as_board", { p_thread_id: sellerThreadId, p_body: "The board answers the seller" });
  check("the board answers it", !replyError, replyError?.message ?? "");

  const { data: ballot } = await admin.from("ballots").insert({
    association_id: associationId, title: "Renew the landscaper", status: "open",
    opens_on: day(-45), closes_on: day(14), quorum_required: 1,
  }).select().single();
  const { data: options } = await admin.from("ballot_options").insert([
    { ballot_id: ballot.id, label: "For", position: 0 },
    { ballot_id: ballot.id, label: "Against", position: 1 },
  ]).select().order("position");
  const { error: voteError } = await seller.client.rpc("cast_votes", { p_ballot_id: ballot.id, p_option_ids: [options[0].id] });
  check("the seller votes For", !voteError, voteError?.message ?? "");

  const { error: noticeError } = await president.client.from("violations").insert({
    association_id: associationId, reference: "VIO-SELL-1", unit_id: unit2, unit_label: "2",
    owner_name: "Sam Seller", rule: "Trash bins", rule_citation: "Rule 4",
  });
  check("the board sends the seller a rule notice", !noticeError, noticeError?.message ?? "");

  // Backdate the seller's rows so they are unambiguously before the closing.
  await admin.from("requests").update({ submitted_on: day(-40) }).eq("unit_id", unit2);
  await admin.from("threads").update({ created_at: noon(-40), updated_on: day(-40) }).eq("unit_id", unit2);
  await admin.from("votes").update({ cast_at: noon(-40) }).eq("ballot_id", ballot.id).eq("unit_id", unit2);
  await admin.from("violations").update({ opened_on: day(-40) }).eq("unit_id", unit2);

  const { data: sellerOwn } = await seller.client.from("requests").select("id").eq("unit_id", unit2);
  check("requests: before the sale the seller reads their own request", (sellerOwn ?? []).length === 1, String((sellerOwn ?? []).length));
  const { data: sellerOwnVotes } = await seller.client.from("votes").select("option_id").eq("ballot_id", ballot.id);
  check("votes: before the sale the seller reads their own vote", (sellerOwnVotes ?? []).length === 1, String((sellerOwnVotes ?? []).length));

  // The sale.
  const { error: saleError } = await president.client.rpc("transfer_home", {
    p_unit_id: unit2, p_new_name: "Bea Buyer", p_new_email: buyerEmail, p_closing_date: closing,
  });
  check("the board records the sale", !saleError, saleError?.message ?? "");
  const buyer = await makeUser("buyer", buyerEmail);
  const { data: buyerUnits } = await buyer.client.rpc("my_unit_ids");
  check("the buyer claims the seat", buyerUnits?.[0] === unit2, String(buyerUnits));

  const { data: sinceBuyer } = await buyer.client.rpc("unit_owned_since", { p_unit_id: unit2 });
  check("unit_owned_since gives the buyer the closing date", sinceBuyer === closing, String(sinceBuyer));

  // The buyer reads none of the seller's rows.
  const { data: bReq } = await buyer.client.from("requests").select("id").eq("unit_id", unit2);
  check("requests: the buyer reads none of the seller's", (bReq ?? []).length === 0, String((bReq ?? []).length));
  const { data: bThreads } = await buyer.client.from("threads").select("id, messages").eq("unit_id", unit2);
  check("threads: the buyer reads none of the seller's", (bThreads ?? []).length === 0, String((bThreads ?? []).length));
  const messageCount = (bThreads ?? []).reduce((n, t) => n + (t.messages?.length ?? 0), 0);
  check("threads: so none of the messages inside them either", messageCount === 0, String(messageCount));
  const { data: bVotes } = await buyer.client.from("votes").select("option_id").eq("ballot_id", ballot.id);
  check("votes: the buyer cannot read how the seller voted", (bVotes ?? []).length === 0, String((bVotes ?? []).length));
  const { data: bNotices } = await buyer.client.from("violations").select("id").eq("unit_id", unit2);
  check("violations: the buyer reads none of the seller's notices", (bNotices ?? []).length === 0, String((bNotices ?? []).length));

  // Money is untouched: the old charges are the buyer's to owe.
  const { data: adminCharges } = await admin.from("charges").select("id").eq("unit_id", unit2);
  const { data: bCharges } = await buyer.client.from("charges").select("id").eq("unit_id", unit2);
  check("charges: the buyer still reads the home's whole ledger", (adminCharges ?? []).length > 0 && (bCharges ?? []).length === (adminCharges ?? []).length, `${(bCharges ?? []).length} of ${(adminCharges ?? []).length}`);
  const { data: bBalance } = await buyer.client.from("unit_balances").select("balance_cents").eq("unit_id", unit2);
  check("unit_balances: the buyer still sees what the home owes", (bBalance ?? []).length === 1 && bBalance[0].balance_cents > 0, JSON.stringify(bBalance));

  // The buyer's own rows work.
  const { error: buyerReqError } = await buyer.client.from("requests").insert({
    association_id: associationId, unit_id: unit2, filed_by: buyer.id,
    reference: "REQ-BUY-1", kind: "maintenance", title: "Buyer: sticking gate",
  });
  check("requests: the buyer can file their own", !buyerReqError, buyerReqError?.message ?? "");
  // Dated five days ago, after the closing and before a later second owner's own start.
  await admin.from("requests").update({ submitted_on: day(-5) }).eq("unit_id", unit2).eq("title", "Buyer: sticking gate");
  const { data: bOwnReq } = await buyer.client.from("requests").select("title").eq("unit_id", unit2);
  check("requests: and read it, and only it", (bOwnReq ?? []).length === 1 && bOwnReq[0].title === "Buyer: sticking gate", JSON.stringify(bOwnReq));

  const { data: buyerThreadId, error: buyerThreadError } = await buyer.client.rpc("start_owner_thread", {
    p_unit_id: unit2, p_subject: "Buyer: a question", p_body: "Hello from the new owner", p_tag: "General",
  });
  check("threads: the buyer can start their own", !buyerThreadError && Boolean(buyerThreadId), buyerThreadError?.message ?? "");
  const { data: bOwnThreads } = await buyer.client.from("threads").select("subject").eq("unit_id", unit2);
  check("threads: and read it, and only it", (bOwnThreads ?? []).length === 1 && bOwnThreads[0].subject === "Buyer: a question", JSON.stringify(bOwnThreads));

  // Voting still works for the buyer; they start unvoted and the seller's choice stays hidden.
  const { data: buyerReceipt, error: buyerVoteError } = await buyer.client.rpc("cast_votes", { p_ballot_id: ballot.id, p_option_ids: [options[1].id] });
  check("votes: the buyer can cast for the home", !buyerVoteError && Boolean(buyerReceipt), buyerVoteError?.message ?? "");
  const { data: bVotesAfter } = await buyer.client.from("votes").select("option_id").eq("ballot_id", ballot.id);
  check("votes: and reads only their own choice", (bVotesAfter ?? []).length === 1 && bVotesAfter[0].option_id === options[1].id, JSON.stringify(bVotesAfter));
  const { data: tally } = await president.client.from("ballot_tallies").select("votes").eq("ballot_id", ballot.id);
  check("ballot_tallies: the home still counts once", (tally ?? []).reduce((n, t) => n + (t.votes ?? 0), 0) === 1, JSON.stringify(tally));

  // The board reads everything, as before.
  const { data: pReq } = await president.client.from("requests").select("title").eq("unit_id", unit2);
  const titles = (pReq ?? []).map((r) => r.title);
  check("requests: the president reads both owners' requests", titles.includes("Seller: leaking gutter") && titles.includes("Buyer: sticking gate"), JSON.stringify(titles));
  const { data: pThreads } = await president.client.from("threads").select("subject, messages").eq("unit_id", unit2);
  const sellerThread = (pThreads ?? []).find((t) => t.subject === "Seller: private question");
  check("threads: the president reads both owners' threads and the messages in them", (pThreads ?? []).length === 2 && (sellerThread?.messages?.length ?? 0) >= 2, `${(pThreads ?? []).length} threads, ${sellerThread?.messages?.length ?? 0} messages`);
  const { data: pNotices } = await president.client.from("violations").select("id").eq("unit_id", unit2);
  check("violations: the president reads the seller's notice", (pNotices ?? []).length === 1, String((pNotices ?? []).length));

  // A second owner added to the buyer's home sees the household's history.
  const { error: addError } = await president.client.rpc("add_second_owner", { p_unit_id: unit2, p_name: "Sue Second", p_email: secondEmail });
  check("the board adds a second owner to the buyer's home", !addError, addError?.message ?? "");
  const second = await makeUser("second", secondEmail);
  const { data: sinceSecond } = await second.client.rpc("unit_owned_since", { p_unit_id: unit2 });
  check("unit_owned_since gives the second owner the earliest current seat, the closing date", sinceSecond === closing, String(sinceSecond));
  const { data: sReq } = await second.client.from("requests").select("title").eq("unit_id", unit2);
  check("requests: the second owner reads the buyer's request filed before they joined", (sReq ?? []).length === 1 && sReq[0].title === "Buyer: sticking gate", JSON.stringify(sReq));
  const { data: sThreads } = await second.client.from("threads").select("subject").eq("unit_id", unit2);
  check("threads: and the buyer's thread, but not the seller's", (sThreads ?? []).length === 1 && sThreads[0].subject === "Buyer: a question", JSON.stringify(sThreads));
  const { data: sVotes } = await second.client.from("votes").select("option_id").eq("ballot_id", ballot.id);
  check("votes: and the home's current vote", (sVotes ?? []).length === 1 && sVotes[0].option_id === options[1].id, JSON.stringify(sVotes));
  const { data: sNotices } = await second.client.from("violations").select("id").eq("unit_id", unit2);
  check("violations: but not the seller's notice", (sNotices ?? []).length === 0, String((sNotices ?? []).length));

  // The seller, with no seat, reads none of it.
  const { data: sellerSince } = await seller.client.rpc("unit_owned_since", { p_unit_id: unit2 });
  check("unit_owned_since gives a caller with no seat no lower bound to read from", sellerSince === "infinity", String(sellerSince));
  const { data: xReq } = await seller.client.from("requests").select("id");
  const { data: xThreads } = await seller.client.from("threads").select("id");
  const { data: xVotes } = await seller.client.from("votes").select("option_id");
  const { data: xNotices } = await seller.client.from("violations").select("id");
  check("requests: the seller reads none after the sale", (xReq ?? []).length === 0, String((xReq ?? []).length));
  check("threads: the seller reads none after the sale", (xThreads ?? []).length === 0, String((xThreads ?? []).length));
  check("votes: the seller reads none after the sale", (xVotes ?? []).length === 0, String((xVotes ?? []).length));
  check("violations: the seller reads none after the sale", (xNotices ?? []).length === 0, String((xNotices ?? []).length));

  // The same-day edge, stated honestly: the rule compares dates, inclusive, so
  // a row dated on the closing day itself is the buyer's to read.
  const { error: edgeError } = await admin.from("requests").insert({
    association_id: associationId, unit_id: unit2, filed_by: seller.id,
    reference: "REQ-EDGE-1", kind: "maintenance", title: "Seller: filed on the closing day", submitted_on: closing,
  });
  check("an edge request dated the closing day is inserted", !edgeError, edgeError?.message ?? "");
  const { data: edgeSeen } = await buyer.client.from("requests").select("title").eq("title", "Seller: filed on the closing day");
  check("requests: DOCUMENTED EDGE, a seller's row dated on the closing day is visible to the buyer (inclusive date rule)", (edgeSeen ?? []).length === 1, String((edgeSeen ?? []).length));
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
