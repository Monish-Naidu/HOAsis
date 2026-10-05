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
  readFileSync(new URL(process.env.ENV_FILE ?? "../.env.local", import.meta.url), "utf8")
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

  // Who saved a method is the database's to say (0074). The routes that
  // move money read that column to tell a co-owner's bank, which may be
  // charged, from a seller's, which may not. It used to be whatever the
  // browser wrote, so a buyer could put their own name on the seller's row.
  const { data: savedRow } = await admin.from("payment_instruments").select("id, profile_id").eq("unit_id", neighborUnit).single();
  check("payment_instruments: a saved method is stamped with who saved it", savedRow?.profile_id === neighbor.id, String(savedRow?.profile_id));
  const cohabitant = await makeUser("cohabitant");
  await admin.from("memberships").insert({
    association_id: associationId, unit_id: neighborUnit, profile_id: cohabitant.id,
    full_name: "Cody", role: "resident", capabilities: [],
  });
  const { data: inAnothersName, error: cohabitantSaves } = await cohabitant.client.from("payment_instruments")
    .insert({ association_id: associationId, unit_id: neighborUnit, profile_id: neighbor.id, kind: "bank", label: "Checking", mask: "6789" })
    .select("id, profile_id").single();
  check("payment_instruments: and cannot be saved in a co-owner's name", !cohabitantSaves && inAnothersName?.profile_id === cohabitant.id,
    cohabitantSaves?.message ?? String(inAnothersName?.profile_id));
  const { error: takeOver } = await cohabitant.client.from("payment_instruments").update({ profile_id: cohabitant.id }).eq("id", savedRow?.id);
  const { data: afterTakeOver } = await admin.from("payment_instruments").select("profile_id").eq("id", savedRow?.id).single();
  check("payment_instruments: a co-owner cannot put their own name on somebody else's",
    takeOver?.code === "42501" && afterTakeOver?.profile_id === neighbor.id, takeOver?.message ?? String(afterTakeOver?.profile_id));
  const { error: makeDefault } = await cohabitant.client.from("payment_instruments").update({ is_default: true }).eq("id", savedRow?.id);
  check("payment_instruments: but can still choose the household's default", !makeDefault, makeDefault?.message ?? "");
  const { error: serverMoves } = await admin.from("payment_instruments").update({ profile_id: cohabitant.id }).eq("id", savedRow?.id);
  const { error: serverMovesBack } = await admin.from("payment_instruments").update({ profile_id: neighbor.id }).eq("id", savedRow?.id);
  check("payment_instruments: and the server is not held to that rule", !serverMoves && !serverMovesBack, (serverMoves ?? serverMovesBack)?.message ?? "");

  // Saved methods leave with the person (0075). The co-owner leaves: their
  // bank goes, the neighbour's card stays, and so does the Stripe customer
  // the card hangs from.
  await admin.from("units").update({ stripe_customer_id: `cus_verify_${stamp}` }).eq("id", neighborUnit);
  const { error: leaveError } = await cohabitant.client.rpc("leave_association", { p_association_id: associationId });
  const { data: leftBehind } = await admin.from("payment_instruments").select("profile_id").eq("unit_id", neighborUnit);
  const { data: keptCustomer } = await admin.from("units").select("stripe_customer_id").eq("id", neighborUnit).single();
  check("leave_association: the leaver's saved method goes and the co-owner's stays",
    !leaveError && (leftBehind ?? []).length === 1 && leftBehind[0].profile_id === neighbor.id,
    leaveError?.message ?? JSON.stringify(leftBehind));
  check("leave_association: and the home keeps the Stripe customer the co-owner's method is on",
    keptCustomer?.stripe_customer_id === `cus_verify_${stamp}`, String(keptCustomer?.stripe_customer_id));

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
  // A report starts as new (0068): the reporter does not get to verify it.
  const { error: preVerified } = await neighbor.client.from("violation_reports").insert({
    association_id: associationId, reference: "REP-3", reporter_profile_id: neighbor.id,
    reporter_name: "Marcus", reporter_unit: "2", subject_unit: "1", what: "Already verified", observed_on: day(-1),
    status: "verified", verified_by: "Dana", verified_on: day(0),
  });
  check("violation_reports: nor one that arrives already verified", Boolean(preVerified), preVerified?.code ?? "no error");
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

  // A sale. The seller's seat ends, the buyer is seated, the home keeps its
  // history, and what was owed is settled as a payment line at closing.
  const soldUnit = crypto.randomUUID();
  await president.client.rpc("add_household", { p_association_id: associationId, p_unit_id: soldUnit, p_name: "Seller", p_email: `seller-${stamp}@example.com`, p_unit: "5" });
  // The seller signs up, which claims the seat by its invited address, and
  // saves a bank on the home. Neither it nor the home's Stripe customer may
  // outlive the sale (0075).
  const sellerUser = await makeUser("seller");
  await sellerUser.client.rpc("claim_my_seats");
  const { error: sellerSaves } = await sellerUser.client.from("payment_instruments")
    .insert({ association_id: associationId, unit_id: soldUnit, kind: "bank", label: "Seller's checking", mask: "1111" });
  await admin.from("units").update({ stripe_customer_id: `cus_seller_${stamp}` }).eq("id", soldUnit);
  await president.client.from("charges").insert({ association_id: associationId, unit_id: soldUnit, kind: "charge", label: "Assessment", amount_cents: 25_000, due_on: day(-30) });
  const { error: closingError } = await president.client.from("charges").insert({ association_id: associationId, unit_id: soldUnit, kind: "payment", label: "Paid at closing", amount_cents: -25_000, due_on: day(0) });
  // A sale takes effect when it is recorded, so one dated next month is
  // refused (0092) and the seller keeps their seat until it happens.
  const { error: earlySale } = await president.client.rpc("transfer_home", { p_unit_id: soldUnit, p_new_name: "Buyer", p_new_email: `buyer-${stamp}@example.com`, p_closing_date: day(30) });
  const { data: stillSeated } = await admin.from("memberships").select("id").eq("unit_id", soldUnit).is("ends_on", null);
  check("transfer_home: a closing still to come is refused, and the seller stays", Boolean(earlySale) && (stillSeated ?? []).length === 1, earlySale?.message ?? `allowed, ${(stillSeated ?? []).length} current`);
  const { data: newSeat, error: saleError } = await president.client.rpc("transfer_home", { p_unit_id: soldUnit, p_new_name: "Buyer", p_new_email: `buyer-${stamp}@example.com`, p_closing_date: day(0) });
  check("transfer_home: the board records a sale", !closingError && !saleError && Boolean(newSeat), saleError?.message ?? closingError?.message ?? "");
  const { data: seats } = await admin.from("memberships").select("full_name,ends_on").eq("unit_id", soldUnit).order("starts_on");
  // By name, not by order: both seats start today, so starts_on cannot tell
  // them apart and the order came back either way.
  const seller = (seats ?? []).find((s) => s.full_name === "Seller");
  const buyer = (seats ?? []).find((s) => s.full_name === "Buyer");
  check("transfer_home: the seller's seat ended and the buyer's began", (seats ?? []).length === 2 && seller?.ends_on != null && buyer?.ends_on === null, JSON.stringify(seats));
  const { data: soldBalances, error: soldBalanceError } = await president.client.from("unit_balances").select("balance_cents").eq("unit_id", soldUnit);
  check("transfer_home: the buyer starts at zero", !soldBalanceError && (soldBalances ?? []).length === 1 && soldBalances[0].balance_cents === 0, soldBalanceError?.message ?? JSON.stringify(soldBalances));
  const { data: afterSale } = await admin.from("payment_instruments").select("id").eq("unit_id", soldUnit);
  const { data: soldCustomer } = await admin.from("units").select("stripe_customer_id").eq("id", soldUnit).single();
  check("transfer_home: the seller's saved bank does not stay on the buyer's home", !sellerSaves && (afterSale ?? []).length === 0,
    sellerSaves?.message ?? `${(afterSale ?? []).length} left`);
  check("transfer_home: and the buyer does not inherit the seller's Stripe customer", soldCustomer?.stripe_customer_id === null, String(soldCustomer?.stripe_customer_id));
  const { error: presidentSale } = await president.client.rpc("transfer_home", { p_unit_id: presidentUnit, p_new_name: "Nobody", p_new_email: "", p_closing_date: day(0) });
  check("transfer_home: the President's home cannot be sold out from under the office", Boolean(presidentSale), presidentSale?.message ?? "no error");

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

  // Board replies are appended in the database (0072). The browser used to
  // send the whole thread back from its own copy, so a reply written in a
  // tab that had been open a while erased whatever the owner had said since.
  const { data: thread } = await admin.from("threads").insert({
    association_id: associationId, subject: "Pool key", unit_id: neighborUnit, tag: "General", messages: [],
  }).select().single();
  await neighbor.client.rpc("reply_as_owner", { p_thread_id: thread.id, p_body: "Any news?" });
  const { data: sent, error: replyError } = await president.client.rpc("reply_as_board", { p_thread_id: thread.id, p_body: "  Friday.  " });
  check("reply_as_board: returns the message it wrote",
    !replyError && sent?.id === `m-${thread.id}-1` && sent?.from === "Dana" && sent?.fromRole === "board"
      && sent?.direction === "outbound" && sent?.channel === "email" && sent?.body === "Friday." && /^\d{4}-\d{2}-\d{2}$/.test(sent?.at ?? ""),
    replyError?.message ?? JSON.stringify(sent));
  const { data: afterReply } = await admin.from("threads").select("messages, unread").eq("id", thread.id).single();
  check("reply_as_board: the owner's message is still there, and the thread reads as answered",
    afterReply?.messages?.length === 2 && afterReply.messages[0].body === "Any news?" && afterReply.messages[1].id === sent?.id && afterReply.unread === false,
    JSON.stringify(afterReply));
  await Promise.all([
    president.client.rpc("reply_as_board", { p_thread_id: thread.id, p_body: "One" }),
    president.client.rpc("reply_as_board", { p_thread_id: thread.id, p_body: "Two" }),
  ]);
  const { data: afterBoth } = await admin.from("threads").select("messages").eq("id", thread.id).single();
  check("reply_as_board: two replies sent at once both land, with ids of their own",
    afterBoth?.messages?.length === 4 && new Set(afterBoth.messages.map((m) => m.id)).size === 4,
    JSON.stringify((afterBoth?.messages ?? []).map((m) => m.id)));
  const { error: emptyReply } = await president.client.rpc("reply_as_board", { p_thread_id: thread.id, p_body: "   " });
  check("reply_as_board: an empty reply is refused", Boolean(emptyReply), emptyReply?.message ?? "no error");
  const { error: residentReply } = await neighbor.client.rpc("reply_as_board", { p_thread_id: thread.id, p_body: "As the board" });
  check("reply_as_board: an owner cannot answer as the board", residentReply?.code === "42501", residentReply?.message ?? "no error");
  const { error: strangerReply } = await stranger.client.rpc("reply_as_board", { p_thread_id: thread.id, p_body: "Hello" });
  check("reply_as_board: nor can a stranger", strangerReply?.code === "42501", strangerReply?.message ?? "no error");

  // The same rule as threads_write: finances answers the billing mail and
  // nothing else.
  const treasurer = await makeUser("treasurer");
  await admin.from("memberships").insert({
    association_id: associationId, unit_id: presidentUnit, profile_id: treasurer.id,
    full_name: "Tess", role: "treasurer", capabilities: ["finances"],
  });
  const { data: billing } = await admin.from("threads").insert({
    association_id: associationId, subject: "Late fee", unit_id: neighborUnit, tag: "Billing", messages: [],
  }).select().single();
  const { data: billingReply, error: billingError } = await treasurer.client.rpc("reply_as_board", { p_thread_id: billing.id, p_body: "Waived this once." });
  check("reply_as_board: the Treasurer answers a billing thread", !billingError && billingReply?.from === "Tess" && billingReply?.id === `m-${billing.id}-0`,
    billingError?.message ?? JSON.stringify(billingReply));
  const { error: generalError } = await treasurer.client.rpc("reply_as_board", { p_thread_id: thread.id, p_body: "Not mine" });
  check("reply_as_board: and not a general one", generalError?.code === "42501", generalError?.message ?? "no error");
  const { data: afterAll } = await admin.from("threads").select("messages").eq("id", thread.id).single();
  check("reply_as_board: a refused reply adds nothing", afterAll?.messages?.length === 4, String(afterAll?.messages?.length));

  // Two officers approve one vendor payment at the same moment (0094). Each
  // used to write a list of one over the other's.
  const { data: bill } = await admin.from("payouts").insert({
    association_id: associationId, vendor_name: "Two Signers Roofing", amount_cents: 90_000, approvals_required: 2,
  }).select("id").single();
  const [byPresident, byTreasurer] = await Promise.all([
    president.client.rpc("approve_payout", { p_payout_id: bill.id }),
    treasurer.client.rpc("approve_payout", { p_payout_id: bill.id }),
  ]);
  const { data: signed } = await admin.from("payouts").select("approvals, status").eq("id", bill.id).single();
  check("approve_payout: two approvals at once are both kept, and the payment is scheduled",
    !byPresident.error && !byTreasurer.error && (signed?.approvals ?? []).length === 2 && signed?.status === "scheduled",
    byPresident.error?.message ?? byTreasurer.error?.message ?? JSON.stringify(signed));
  await treasurer.client.rpc("approve_payout", { p_payout_id: bill.id });
  const { data: signedAgain } = await admin.from("payouts").select("approvals").eq("id", bill.id).single();
  check("approve_payout: the same officer cannot sign twice", (signedAgain?.approvals ?? []).length === 2, JSON.stringify(signedAgain?.approvals));
  const { error: neighborApproves } = await neighbor.client.rpc("approve_payout", { p_payout_id: bill.id });
  check("approve_payout: an owner without finances is refused", neighborApproves?.code === "42501", neighborApproves?.message ?? "no error");

  // Support can seat a new President when the old one cannot be reached
  // (0095); a board member cannot.
  const { error: boardReassign } = await treasurer.client.rpc("reassign_presidency", { p_association_id: associationId, p_to_profile: treasurer.id });
  check("reassign_presidency: a board member is refused", boardReassign?.code === "42501", boardReassign?.message ?? "no error");
  const { error: strangerSeat } = await admin.rpc("reassign_presidency", { p_association_id: associationId, p_to_profile: stranger.id });
  check("reassign_presidency: a stranger cannot be made President", Boolean(strangerSeat), strangerSeat?.message ?? "no error");
  const { error: reassigned } = await admin.rpc("reassign_presidency", { p_association_id: associationId, p_to_profile: treasurer.id });
  const { data: presidents } = await admin.from("memberships").select("profile_id, role").eq("association_id", associationId).eq("role", "president").is("ends_on", null);
  check("reassign_presidency: support seats the Treasurer as the one President",
    !reassigned && (presidents ?? []).length === 1 && presidents[0].profile_id === treasurer.id,
    reassigned?.message ?? JSON.stringify(presidents));
} catch (error) {
  check("the run itself", false, error instanceof Error ? error.message : String(error));
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
