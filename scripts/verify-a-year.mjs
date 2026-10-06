/**
 * A year in the life of an association.
 *
 * Founding an association is easy to get right and easy to test. What breaks
 * products in this category is the second year: a home sells, the treasurer
 * resigns, the bylaws are amended, somebody who moved out still appears on the
 * roster, and a balance follows the wrong party.
 *
 * So this runs a full year. Twelve assessments, payments that mostly land and
 * sometimes do not, a sale halfway through, a board handover, documents added
 * as they would be, a vote, and a forum. Then it checks the things that should
 * still be true, especially the ones about who owed what when.
 *
 * Everything is deleted at the end, including on failure.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  admin, stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "year-",
  strictSignIn: false,
  demotePresident: true,
});

/** Months back from today, as a date. */
const monthsAgo = (n) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n, 1);
  return d.toISOString().slice(0, 10);
};

const DUES = 25_000;

try {
  /* ------------------------------------------------ month zero: founding */

  const treasurerEmail = `treasurer-${stamp}@example.com`;
  const steadyEmail = `steady-${stamp}@example.com`;
  const sellerEmail = `seller-${stamp}@example.com`;
  const laggardEmail = `laggard-${stamp}@example.com`;

  const president = await makeUser("Priya President", `president-${stamp}@example.com`);
  const { data: hoa } = await president.client.rpc("create_association", {
    p_name: "Cedar Year HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: DUES, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Priya President", p_founder_unit: "1",
    p_households: [
      { name: "Tom Treasurer", email: treasurerEmail, unit: "2" },
      { name: "Sam Steady", email: steadyEmail, unit: "3" },
      { name: "Sofia Seller", email: sellerEmail, unit: "4" },
      { name: "Leo Laggard", email: laggardEmail, unit: "5" },
    ],
  });
  cleanup.associations.push(hoa);
  check("the association is founded", Boolean(hoa));
  // Books open on the founding day unless told otherwise (0056); this suite
  // bills periods that fell due before today.
  await admin.from("associations").update({ billing_starts_on: "2000-01-01" }).eq("id", hoa);

  const treasurer = await makeUser("Tom Treasurer", treasurerEmail);
  const steady = await makeUser("Sam Steady", steadyEmail);
  const seller = await makeUser("Sofia Seller", sellerEmail);
  const laggard = await makeUser("Leo Laggard", laggardEmail);

  // The association is a year old, so backdate every tenure to its founding.
  // A membership recorded today cannot end six months ago, and rightly so.
  await admin.from("memberships").update({ starts_on: monthsAgo(12) }).eq("association_id", hoa);

  const { data: units } = await admin
    .from("units").select("id, label").eq("association_id", hoa).order("label");
  const unitOf = Object.fromEntries(units.map((u) => [u.label, u.id]));

  await president.client.from("bank_accounts").insert({
    association_id: hoa, kind: "operating", institution: "Cedar Credit Union", mask: "4417",
  });

  // The treasurer gets the money capability, which is the first thing a real
  // President does after signing up.
  const { data: treasurerMembership } = await admin
    .from("memberships").select("id").eq("association_id", hoa)
    .eq("profile_id", treasurer.id).single();
  await admin.from("memberships").update({
    role: "treasurer", capabilities: ["finances", "vendors", "documents"],
  }).eq("id", treasurerMembership.id);

  const { data: treasurerView } = await treasurer.client.rpc("my_associations");
  check("the treasurer is appointed", treasurerView?.[0]?.role === "treasurer", treasurerView?.[0]?.role);

  /* -------------------------------------------- twelve months of billing */

  for (let month = 12; month >= 1; month--) {
    await president.client.rpc("issue_assessment", {
      p_association_id: hoa,
      p_label: `Assessment ${monthsAgo(month).slice(0, 7)}`,
      p_due_on: monthsAgo(month),
    });
  }

  const { count: charges } = await admin
    .from("charges").select("*", { count: "exact", head: true })
    .eq("association_id", hoa).eq("kind", "charge");
  check("twelve months billed to five homes", charges === 60, `${charges} charges`);

  // Everyone pays every month except Leo, who stops after four.
  const payers = [
    { who: president, unit: "1", months: 12 },
    { who: treasurer, unit: "2", months: 12 },
    { who: steady, unit: "3", months: 12 },
    { who: seller, unit: "4", months: 12 },
    { who: laggard, unit: "5", months: 4 },
  ];

  for (const payer of payers) {
    for (let i = 0; i < payer.months; i++) {
      // Settled the way the webhook settles it; an owner cannot write their
      // own payment (0062).
      const { error } = await admin.rpc("record_payment", {
        p_unit_id: unitOf[payer.unit],
        p_amount_cents: DUES,
        p_rail: "ach",
        p_processor_fee_cents: 35,
        p_paid_by: payer.who.id,
      });
      if (error) {
        check(`unit ${payer.unit} could pay month ${i + 1}`, false, error.message);
        break;
      }
    }
  }

  const { data: balances } = await president.client
    .from("unit_balances").select("unit_id, balance_cents").eq("association_id", hoa);
  const balanceOf = (label) =>
    balances.find((b) => b.unit_id === unitOf[label])?.balance_cents;

  check("a household that paid every month owes nothing", balanceOf("1") === 0, `${balanceOf("1")}`);
  check(
    "a household eight months behind owes exactly eight assessments",
    balanceOf("5") === 8 * DUES,
    `${balanceOf("5")} against ${8 * DUES}`,
  );

  /* -------------------------------------------------- a home changes hands */

  const buyerEmail = `buyer-${stamp}@example.com`;
  const closingDate = monthsAgo(6);

  // One call, the way a board would do it. Ending one tenure and starting
  // another by hand is two statements with nothing checking they line up.
  const balanceAtSale = balanceOf("4");
  const { error: saleError } = await president.client.rpc("transfer_home", {
    p_unit_id: unitOf["4"],
    p_new_name: "Bea Buyer",
    p_new_email: buyerEmail,
    p_closing_date: closingDate,
  });
  check("the sale is recorded in one step", !saleError, saleError?.message ?? "");

  const buyer = await makeUser("Bea Buyer", buyerEmail);

  const { data: buyerAssociations } = await buyer.client.rpc("my_associations");
  check("the buyer joins the association on signup", (buyerAssociations ?? []).length === 1, `${(buyerAssociations ?? []).length}`);

  const { data: buyerUnits } = await buyer.client.rpc("my_unit_ids");
  check("the buyer holds the home they bought", buyerUnits?.[0] === unitOf["4"], "");

  const { data: sellerAssociations } = await seller.client.rpc("my_associations");
  check("the seller loses access after closing", (sellerAssociations ?? []).length === 0, `${(sellerAssociations ?? []).length}`);

  const { data: sellerUnits } = await seller.client.rpc("my_unit_ids");
  check("and can no longer reach the home", (sellerUnits ?? []).length === 0, `${(sellerUnits ?? []).length}`);

  const { data: afterSale } = await president.client
    .from("unit_balances").select("balance_cents").eq("unit_id", unitOf["4"]).single();
  check(
    "the balance stays with the home rather than following the seller",
    afterSale?.balance_cents === balanceAtSale,
    `${afterSale?.balance_cents} against ${balanceAtSale} before the sale`,
  );

  const { data: history } = await president.client.rpc("home_history", {
    p_unit_id: unitOf["4"],
  });
  check(
    "the record of who owned the home when survives the sale",
    history?.length === 2 && history[0].ends_on === closingDate && history[1].is_current,
    JSON.stringify(history?.map((h) => `${h.full_name}:${h.ends_on ?? "current"}`)),
  );

  // A closing date before the seller even moved in is a typo, not a sale.
  const { error: backwards } = await president.client.rpc("transfer_home", {
    p_unit_id: unitOf["3"], p_new_name: "Too Early", p_new_email: null,
    p_closing_date: monthsAgo(24),
  });
  check("a closing date before the current tenure is refused", Boolean(backwards),
    backwards?.message?.slice(0, 55) ?? "no error");

  // Selling the President's home would leave nobody able to grant access.
  const { error: sellPresident } = await president.client.rpc("transfer_home", {
    p_unit_id: unitOf["1"], p_new_name: "Buyer Of Unit One", p_new_email: null,
    p_closing_date: monthsAgo(1),
  });
  check("the President's home cannot be sold before the office is handed over",
    Boolean(sellPresident), sellPresident?.message?.slice(0, 55) ?? "no error");

  const { error: residentSale } = await steady.client.rpc("transfer_home", {
    p_unit_id: unitOf["5"], p_new_name: "Sneaky", p_new_email: null,
  });
  check("a resident cannot record a sale", Boolean(residentSale),
    residentSale?.message?.slice(0, 45) ?? "no error");

  /* ------------------------------------------------------ the board turns over */

  const { error: handover } = await president.client.rpc("transfer_presidency", {
    p_to_profile: treasurer.id,
  });
  check("the presidency is handed to the treasurer", !handover, handover?.message ?? "");

  const { data: nowPresident } = await treasurer.client.rpc("my_associations");
  check("who is now President", nowPresident?.[0]?.role === "president", nowPresident?.[0]?.role);

  const { data: formerPresident } = await president.client.rpc("my_associations");
  check(
    "and the outgoing President stays as a resident, because they still own a home",
    formerPresident?.[0]?.role === "resident",
    formerPresident?.[0]?.role,
  );

  // The old President should no longer be able to bill the association.
  const { error: refused } = await president.client.rpc("issue_assessment", {
    p_association_id: hoa, p_label: "Sneaky", p_due_on: monthsAgo(0),
  });
  check("a former officer cannot still bill", Boolean(refused), refused?.message?.slice(0, 40) ?? "no error");

  /* ---------------------------------------------------- governing documents */

  const docs = [
    { name: "CC&Rs", category: "Governing", visibility: "owners" },
    { name: "Bylaws", category: "Governing", visibility: "owners" },
    { name: "Rules and Regulations", category: "Governing", visibility: "owners" },
    { name: "Bylaws, amended", category: "Governing", visibility: "owners" },
    { name: "Reserve study 2026", category: "Financial", visibility: "owners" },
    { name: "Counsel opinion", category: "Notices", visibility: "board" },
  ];
  await treasurer.client.from("documents").insert(
    docs.map((d) => ({ ...d, association_id: hoa })),
  );

  const { data: ownerDocs } = await steady.client.from("documents").select("name");
  check("an owner sees the governing documents", (ownerDocs ?? []).length === 5, `${(ownerDocs ?? []).length}`);
  check(
    "and not the board's legal advice",
    !(ownerDocs ?? []).some((d) => d.name === "Counsel opinion"),
    JSON.stringify((ownerDocs ?? []).map((d) => d.name)),
  );

  /* ---------------------------------------------------------- amending a bylaw */

  // The closing date is still ahead while the homes vote: a vote is refused
  // once it is more than a day gone (0076), and the first of this month
  // usually is. It is set to the first once the votes are in.
  const { data: ballot } = await treasurer.client.from("ballots").insert({
    association_id: hoa,
    title: "Amend Article VII to permit rooftop solar",
    body: ["The current article prohibits roof penetrations.", "This would permit them under conditions."],
    kind: "amendment",
    status: "open",
    opens_on: monthsAgo(1),
    closes_on: monthsAgo(-1),
    quorum_required: 3,
    threshold_label: "Two thirds of votes cast",
  }).select().single();
  const { data: options } = await treasurer.client.from("ballot_options").insert([
    { ballot_id: ballot.id, label: "For the amendment", position: 0 },
    { ballot_id: ballot.id, label: "Against", position: 1 },
  ]).select();

  for (const voter of [treasurer, steady, buyer, laggard]) {
    await voter.client.rpc("cast_vote", { p_ballot_id: ballot.id, p_option_id: options[0].id });
  }
  await president.client.rpc("cast_vote", { p_ballot_id: ballot.id, p_option_id: options[1].id });

  const { data: tally } = await treasurer.client
    .from("ballot_tallies").select("*").eq("ballot_id", ballot.id);
  const forVotes = tally.find((t) => t.option_id === options[0].id)?.votes;
  const againstVotes = tally.find((t) => t.option_id === options[1].id)?.votes;
  check("the amendment carries four votes to one", forVotes === 4 && againstVotes === 1, `${forVotes} for, ${againstVotes} against`);

  const { data: turnout } = await treasurer.client
    .from("ballot_turnout").select("*").eq("ballot_id", ballot.id).single();
  check(
    "turnout counts households and meets quorum",
    turnout?.homes_voted === 5 && turnout.homes_voted >= turnout.quorum_required,
    `${turnout?.homes_voted} of 5 voted, quorum ${turnout?.quorum_required}`,
  );

  // The seller sold six months ago and must not be able to vote on it.
  const { error: sellerVote } = await seller.client.rpc("cast_vote", {
    p_ballot_id: ballot.id, p_option_id: options[0].id,
  });
  check("somebody who sold cannot vote", Boolean(sellerVote), sellerVote?.message?.slice(0, 45) ?? "no error");
  await treasurer.client.from("ballots").update({ closes_on: monthsAgo(0) }).eq("id", ballot.id);

  /* ------------------------------------------------------------- vendors */

  await treasurer.client.from("vendors").insert([
    { association_id: hoa, name: "Bellevue Lawn", service: "Grounds", ach_enabled: true, w9_on_file: true },
    { association_id: hoa, name: "Northsound Pool", service: "Pool", ach_enabled: true, w9_on_file: false },
    { association_id: hoa, name: "Ace Gate", service: "Gates", ach_enabled: false, w9_on_file: false },
  ]);
  const { data: vendors } = await treasurer.client.from("vendors").select("name, w9_on_file");
  check("vendors are recorded", (vendors ?? []).length === 3, `${(vendors ?? []).length}`);
  check(
    "and the ones missing a W-9 are visible, because January comes",
    (vendors ?? []).filter((v) => !v.w9_on_file).length === 2,
    "",
  );

  const { data: residentVendors } = await steady.client.from("vendors").select("name");
  check("a resident cannot see who the association pays", (residentVendors ?? []).length === 0, `${(residentVendors ?? []).length}`);

  /* --------------------------------------------------------------- forum */

  const { data: post } = await buyer.client.from("posts").insert({
    association_id: hoa, author_id: buyer.id, author_name: "Bea Buyer",
    title: "New here, who does everyone use for gutters?", body: "Just moved into unit 4.",
  }).select().single();
  check("a new owner can post", Boolean(post), "");
  check("and it waits for approval", post?.status === "pending", post?.status);

  const { data: beforeApproval } = await steady.client.from("posts").select("title");
  check("neighbours do not see it yet", (beforeApproval ?? []).length === 0, `${(beforeApproval ?? []).length}`);

  await treasurer.client.from("posts").update({ status: "published", moderated_by: "Tom" }).eq("id", post.id);
  const { data: afterApproval } = await steady.client.from("posts").select("title");
  check("and do once the board publishes it", (afterApproval ?? []).length === 1, `${(afterApproval ?? []).length}`);

  /* ----------------------------------------------- the books, after a year */

  const { data: ledger } = await treasurer.client
    .from("ledger_entries").select("amount_cents, category").eq("association_id", hoa);
  const collected = ledger.filter((e) => e.category === "Assessments").reduce((t, e) => t + e.amount_cents, 0);
  // 52 payments across the year, each net of a 35 cent processor fee.
  const expected = 52 * (DUES - 35);
  check(
    "the books show every payment, net of what the processor took",
    collected === expected,
    `${collected} against ${expected}`,
  );

  const { data: allocations } = await admin
    .from("payment_allocations").select("amount_cents");
  check(
    "every payment records which charge it cleared",
    (allocations ?? []).length >= 52,
    `${(allocations ?? []).length} allocations`,
  );

  const { data: finalBalances } = await treasurer.client
    .from("unit_balances").select("unit_id, balance_cents").eq("association_id", hoa);
  const owed = finalBalances.reduce((t, b) => t + b.balance_cents, 0);
  check(
    "total outstanding is exactly what the one late household owes",
    owed === 8 * DUES,
    `${owed} against ${8 * DUES}`,
  );

  // The thing a second year turns on: can a new board reconstruct the past?
  const { data: everyMembership } = await admin
    .from("memberships").select("full_name, unit_id, starts_on, ends_on")
    .eq("association_id", hoa);
  check(
    "the association can still say who held every home, including the ones who left",
    (everyMembership ?? []).length === 6,
    `${(everyMembership ?? []).length} tenures across 5 homes`,
  );
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
