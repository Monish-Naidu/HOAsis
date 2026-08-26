/**
 * Three years of a townhome association that bills more than dues.
 *
 * One year proves the books add up. Three years proves they keep adding up
 * while the association changes: rates rise, a roof fails and gets paid for by
 * special assessment, homes change hands, and a shared water bill is split
 * thirty-six times in a row.
 *
 * The invariant that matters here is unglamorous. Every time a bill is split
 * across homes, the shares have to sum to the bill exactly. A tenth of a cent
 * of drift a month is a reconciliation question nobody can answer by year
 * three, and it is the specific reason utility billing is normally sold as a
 * separate product with separate books.
 *
 * Everything is deleted at the end, including on failure.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
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
const PASSWORD = "three-" + Math.random().toString(36).slice(2) + "A1";
const results = [];
let failures = 0;
const check = (n, p, d = "") => {
  results.push({ n, p, d });
  if (!p) failures++;
};
const cleanup = { users: [], associations: [] };

const monthsAgo = (n) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n, 1);
  return d.toISOString().slice(0, 10);
};
const money = (c) => `$${(c / 100).toFixed(2)}`;

/**
 * Reads every row rather than the first page.
 *
 * Three years of dues, three utilities and an assessment is over a thousand
 * charges, and a single request stops at the server's page limit. A test that
 * silently reads 1000 of 1008 rows reports a discrepancy that is not there.
 */
async function all(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function makeUser(label, email) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: label },
  });
  if (error) throw new Error(`${label}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  return { client, id: data.user.id, email, name: label };
}

const MONTHS = 36;
const DUES_YEAR_1 = 22_500;

/* Six townhomes of deliberately different size, because an equal split of a
   water bill across a studio and a four bedroom is the complaint that starts
   most utility arguments. */
const HOMES = [
  { unit: "101", name: "Priya President", sqft: 1_450, beds: 3, people: 4 },
  { unit: "102", name: "Tom Treasurer",   sqft: 1_450, beds: 3, people: 2 },
  { unit: "103", name: "Sam Steady",      sqft: 980,   beds: 2, people: 1 },
  { unit: "104", name: "Sofia Seller",    sqft: 980,   beds: 2, people: 2 },
  { unit: "105", name: "Leo Laggard",     sqft: 2_100, beds: 4, people: 5 },
  { unit: "106", name: "Nina North",      sqft: 1_450, beds: 3, people: 3 },
];

try {
  /* ------------------------------------------------------------ year one */

  const emails = Object.fromEntries(
    HOMES.map((h) => [h.unit, `${h.unit}-${stamp}@example.com`]),
  );
  const president = await makeUser(HOMES[0].name, emails["101"]);
  const { data: hoa, error: foundError } = await president.client.rpc("create_association", {
    p_name: "Alder Court Townhomes", p_city: "Kirkland", p_state: "WA",
    p_dues_cents: DUES_YEAR_1, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: HOMES[0].name, p_founder_unit: "101",
    p_households: HOMES.slice(1).map((h) => ({ name: h.name, email: emails[h.unit], unit: h.unit })),
  });
  if (foundError) throw new Error(foundError.message);
  cleanup.associations.push(hoa);
  check("the association is founded", Boolean(hoa));

  const people = { "101": president };
  for (const h of HOMES.slice(1)) people[h.unit] = await makeUser(h.name, emails[h.unit]);

  // Three years old, so tenures start three years back.
  await admin.from("memberships").update({ starts_on: monthsAgo(MONTHS) }).eq("association_id", hoa);

  const { data: unitRows } = await admin
    .from("units").select("id, label").eq("association_id", hoa);
  const unitOf = Object.fromEntries(unitRows.map((u) => [u.label, u.id]));

  // The board records what each home is, which is what any split other than
  // equal has to be based on.
  for (const h of HOMES) {
    await admin.from("units")
      .update({ square_feet: h.sqft, bedrooms: h.beds, occupants: h.people })
      .eq("id", unitOf[h.unit]);
  }

  const { data: treasurerRow } = await admin
    .from("memberships").select("id").eq("association_id", hoa)
    .eq("profile_id", people["102"].id).single();
  await admin.from("memberships").update({
    role: "treasurer", capabilities: ["finances", "vendors", "documents"],
  }).eq("id", treasurerRow.id);
  const treasurer = people["102"];

  await president.client.from("bank_accounts").insert([
    { association_id: hoa, kind: "operating", institution: "Alder Credit Union", mask: "8801" },
    { association_id: hoa, kind: "reserve", institution: "Alder Credit Union", mask: "8802" },
  ]);

  /* -------------------------------------------- the shared costs are switched on */

  // A simple association never creates any of these and never sees them. This
  // one is a townhome development on a single master water meter, which is the
  // case that has no good answer in any competing product.
  const { data: water } = await treasurer.client.from("shared_costs").insert({
    association_id: hoa, name: "Water and sewer", provider: "Kirkland Public Utilities",
    account_ref: "KPU-4471-0", allocation: "occupants", markup_percent: 0,
  }).select().single();
  const { data: trash } = await treasurer.client.from("shared_costs").insert({
    association_id: hoa, name: "Trash and recycling", provider: "Waste Management",
    account_ref: "WM-88213", allocation: "equal", markup_percent: 0,
  }).select().single();
  const { data: gas } = await treasurer.client.from("shared_costs").insert({
    association_id: hoa, name: "Common area gas", provider: "Puget Sound Energy",
    account_ref: "PSE-3390", allocation: "square_feet", markup_percent: 0,
  }).select().single();
  check("shared costs can be defined", Boolean(water && trash && gas), "");

  const { error: residentDefines } = await people["103"].client.from("shared_costs").insert({
    association_id: hoa, name: "Sneaky", provider: "Nobody",
  });
  check("a resident cannot invent a shared cost", Boolean(residentDefines),
    residentDefines?.message?.slice(0, 45) ?? "no error");

  /* -------------------------------------------- thirty-six months of billing */

  let duesBilled = 0;
  const waterBills = [];

  for (let m = MONTHS; m >= 1; m--) {
    const due = monthsAgo(m);
    const yearIndex = Math.floor((MONTHS - m) / 12); // 0, 1, 2

    // Dues rise 5% a year, which is what a board that reads its reserve study
    // actually does.
    const dues = Math.round(DUES_YEAR_1 * Math.pow(1.05, yearIndex));
    if (dues !== DUES_YEAR_1) {
      await admin.from("associations").update({ dues_cents: dues }).eq("id", hoa);
    }
    await president.client.rpc("issue_assessment", {
      p_association_id: hoa, p_label: `Dues ${due.slice(0, 7)}`, p_due_on: due,
    });
    duesBilled += dues * HOMES.length;

    // The water bill is seasonal and creeps up year on year, the way real
    // utility bills do.
    const season = 1 + 0.25 * Math.sin(((MONTHS - m) % 12) / 12 * 2 * Math.PI);
    const waterTotal = Math.round(41_000 * season * Math.pow(1.07, yearIndex));
    const { data: billId, error: billError } = await treasurer.client.rpc("post_shared_cost_bill", {
      p_shared_cost_id: water.id,
      p_period_start: due,
      p_period_end: monthsAgo(m - 1),
      p_total_cents: waterTotal,
      p_due_on: monthsAgo(m - 1),
      p_usage_amount: Math.round(waterTotal / 84),
      p_usage_unit: "hundred cubic feet",
    });
    if (billError) { check(`water bill for ${due} posts`, false, billError.message); break; }
    waterBills.push({ id: billId, total: waterTotal, due });

    await treasurer.client.rpc("post_shared_cost_bill", {
      p_shared_cost_id: trash.id, p_period_start: due, p_period_end: monthsAgo(m - 1),
      p_total_cents: 18_900 + yearIndex * 900, p_due_on: monthsAgo(m - 1),
    });
    await treasurer.client.rpc("post_shared_cost_bill", {
      p_shared_cost_id: gas.id, p_period_start: due, p_period_end: monthsAgo(m - 1),
      p_total_cents: Math.round(12_500 * season), p_due_on: monthsAgo(m - 1),
    });
  }

  check("thirty-six water bills were posted", waterBills.length === MONTHS, `${waterBills.length}`);

  /* ---------------------------------------- the invariant the whole thing rests on */

  const allShares = await all(() =>
    admin.from("shared_cost_shares").select("bill_id, unit_id, share_cents, basis"));
  const byBill = new Map();
  for (const s of allShares ?? []) {
    byBill.set(s.bill_id, (byBill.get(s.bill_id) ?? 0) + s.share_cents);
  }
  const drifted = waterBills.filter((b) => byBill.get(b.id) !== b.total);
  check(
    "every one of the thirty-six splits adds up to the bill, to the cent",
    drifted.length === 0,
    drifted.length ? `${drifted.length} months drifted` : `${waterBills.length} months exact`,
  );

  const { data: allBills } = await admin
    .from("shared_cost_bills").select("id, total_cents").eq("association_id", hoa);
  const anyDrift = (allBills ?? []).filter((b) => (byBill.get(b.id) ?? 0) !== b.total_cents);
  check(
    "and so does every trash and gas split",
    anyDrift.length === 0,
    anyDrift.length ? `${anyDrift.length} of ${allBills.length} drifted` : `${allBills.length} bills exact`,
  );

  /* -------------------------------------------------- the split is actually fair */

  const lastWater = waterBills.at(-1);
  const lastShares = allShares.filter((s) => s.bill_id === lastWater.id);
  const shareFor = (unit) => lastShares.find((s) => s.unit_id === unitOf[unit])?.share_cents ?? 0;

  // Five people in 105, one in 103. Water allocated by occupants should say so.
  check(
    "a five person home pays more water than a one person home",
    shareFor("105") > shareFor("103") * 4,
    `${money(shareFor("105"))} against ${money(shareFor("103"))}`,
  );

  const { data: gasBills } = await admin
    .from("shared_cost_bills").select("id").eq("shared_cost_id", gas.id).order("period_start");
  const lastGasShares = allShares.filter((s) => s.bill_id === gasBills.at(-1).id);
  const gasFor = (unit) => lastGasShares.find((s) => s.unit_id === unitOf[unit])?.share_cents ?? 0;
  check(
    "gas splits by floor area, so the largest home carries the most",
    gasFor("105") > gasFor("101") && gasFor("101") > gasFor("103"),
    `${money(gasFor("105"))} / ${money(gasFor("101"))} / ${money(gasFor("103"))}`,
  );

  const { data: trashBills } = await admin
    .from("shared_cost_bills").select("id").eq("shared_cost_id", trash.id).order("period_start");
  const lastTrashShares = allShares.filter((s) => s.bill_id === trashBills.at(-1).id);
  const trashAmounts = new Set(lastTrashShares.map((s) => s.share_cents));
  check(
    "trash is split equally, so every home pays the same",
    trashAmounts.size === 1,
    `${trashAmounts.size} different amounts`,
  );

  /* ---------------------------------------------------- what an owner can see */

  const owner = people["103"];
  const myShares = await all(() =>
    owner.client.from("shared_cost_shares").select("unit_id, share_cents"));
  check(
    "an owner sees their own share of every bill",
    myShares.length > 0 && myShares.every((s) => s.unit_id === unitOf["103"]),
    `${myShares.length} shares, all their own`,
  );

  const { data: providers } = await owner.client
    .from("shared_costs").select("name, provider, markup_percent");
  check(
    "and can see who the association actually pays",
    (providers ?? []).length === 3 &&
      providers.some((p) => p.provider === "Kirkland Public Utilities"),
    JSON.stringify((providers ?? []).map((p) => p.provider)),
  );

  const { data: ownerHistory } = await owner.client
    .from("shared_cost_history").select("name, period_start, total_cents, homes, average_share_cents")
    .eq("shared_cost_id", water.id).order("period_start");
  check(
    "an owner can see three years of what water has cost the community",
    (ownerHistory ?? []).length === MONTHS,
    `${(ownerHistory ?? []).length} periods`,
  );
  check(
    "and the cost per home is the community total divided by the homes",
    ownerHistory?.at(-1)?.homes === HOMES.length,
    `${ownerHistory?.at(-1)?.homes} homes`,
  );

  const { error: ownerPosts } = await owner.client.rpc("post_shared_cost_bill", {
    p_shared_cost_id: water.id, p_period_start: monthsAgo(0), p_period_end: monthsAgo(0),
    p_total_cents: 1, p_due_on: monthsAgo(0),
  });
  check("an owner cannot post a bill to the community", Boolean(ownerPosts),
    ownerPosts?.message?.slice(0, 45) ?? "no error");

  /* ----------------------------------------- year two: the roof, and the vote */

  const ROOF = 21_000_00;
  // Ballots belong to whoever holds the voting capability, which the treasurer
  // deliberately does not. Money and elections are separate jobs.
  const { data: roofBallot, error: ballotError } = await president.client.from("ballots").insert({
    association_id: hoa,
    title: "Special assessment for roof replacement",
    body: [
      "The 2027 reserve study found the roofs at the end of their service life.",
      `Replacement is quoted at ${money(ROOF)}, and reserves cover less than half.`,
      "This would levy the balance across the six homes over twelve months.",
    ],
    kind: "amendment", status: "open",
    opens_on: monthsAgo(19), closes_on: monthsAgo(18),
    quorum_required: 4, threshold_label: "Two thirds of votes cast",
  }).select().single();
  check("only an officer with the voting capability can open a ballot", !ballotError,
    ballotError?.message ?? "");
  const { data: roofOptions } = await president.client.from("ballot_options").insert([
    { ballot_id: roofBallot.id, label: "Approve the assessment", position: 0 },
    { ballot_id: roofBallot.id, label: "Reject", position: 1 },
  ]).select();

  for (const unit of ["101", "102", "103", "104", "106"]) {
    await people[unit].client.rpc("cast_vote", {
      p_ballot_id: roofBallot.id, p_option_id: roofOptions[0].id,
    });
  }
  await people["105"].client.rpc("cast_vote", {
    p_ballot_id: roofBallot.id, p_option_id: roofOptions[1].id,
  });

  const { data: roofTally } = await president.client
    .from("ballot_tallies").select("*").eq("ballot_id", roofBallot.id);
  check(
    "the assessment carries five to one",
    roofTally.find((t) => t.option_id === roofOptions[0].id)?.votes === 5,
    JSON.stringify(roofTally.map((t) => t.votes)),
  );

  const { data: assessmentId, error: levyError } = await treasurer.client
    .rpc("levy_special_assessment", {
      p_association_id: hoa,
      p_title: "Roof replacement",
      p_reason: "2027 reserve study, roofs at end of service life",
      p_total_cents: ROOF,
      p_allocation: "square_feet",
      p_installments: 12,
      p_first_due_on: monthsAgo(17),
      p_ballot_id: roofBallot.id,
    });
  check("the board levies what the owners approved", !levyError, levyError?.message ?? "");

  const assessmentCharges = await all(() =>
    admin.from("charges").select("unit_id, amount_cents, label")
      .eq("association_id", hoa).eq("category", "special_assessment"));
  const levied = assessmentCharges.reduce((t, c) => t + c.amount_cents, 0);
  check(
    "the twelve instalments across six homes add up to the assessment exactly",
    levied === ROOF,
    `${money(levied)} against ${money(ROOF)}`,
  );
  check(
    "which is seventy-two instalments",
    assessmentCharges.length === 72,
    `${assessmentCharges.length}`,
  );

  const byUnit = new Map();
  for (const c of assessmentCharges ?? []) {
    byUnit.set(c.unit_id, (byUnit.get(c.unit_id) ?? 0) + c.amount_cents);
  }
  check(
    "the largest home carries the largest share, because the roof is bigger",
    byUnit.get(unitOf["105"]) > byUnit.get(unitOf["101"]) &&
      byUnit.get(unitOf["101"]) > byUnit.get(unitOf["103"]),
    `${money(byUnit.get(unitOf["105"]))} / ${money(byUnit.get(unitOf["101"]))} / ${money(byUnit.get(unitOf["103"]))}`,
  );

  const { data: assessmentRow } = await owner.client
    .from("special_assessments").select("title, reason, ballot_id, total_cents").eq("id", assessmentId).single();
  check(
    "an owner can see the assessment, why it was levied, and the vote that authorised it",
    assessmentRow?.ballot_id === roofBallot.id && assessmentRow.reason.length > 10,
    assessmentRow?.reason ?? "",
  );

  const { error: ownerLevies } = await owner.client.rpc("levy_special_assessment", {
    p_association_id: hoa, p_title: "Pay for my fence", p_reason: "",
    p_total_cents: 100_00, p_allocation: "equal", p_installments: 1,
    p_first_due_on: monthsAgo(0), p_ballot_id: null,
  });
  check("an owner cannot levy an assessment on their neighbours", Boolean(ownerLevies),
    ownerLevies?.message?.slice(0, 45) ?? "no error");

  const { error: zeroLevy } = await treasurer.client.rpc("levy_special_assessment", {
    p_association_id: hoa, p_title: "Nothing", p_reason: "",
    p_total_cents: 0, p_allocation: "equal", p_installments: 1,
    p_first_due_on: monthsAgo(0), p_ballot_id: null,
  });
  check("an assessment for nothing is refused", Boolean(zeroLevy),
    zeroLevy?.message?.slice(0, 45) ?? "no error");

  /* -------------------------------------------------- everybody pays, mostly */

  const openCharges = await all(() =>
    admin.from("charges").select("unit_id, amount_cents")
      .eq("association_id", hoa).eq("kind", "charge"));
  const owedByUnit = new Map();
  for (const c of openCharges ?? []) {
    owedByUnit.set(c.unit_id, (owedByUnit.get(c.unit_id) ?? 0) + c.amount_cents);
  }

  // Everyone settles in full except 105, who pays nothing towards the roof and
  // falls behind on the last four months of dues.
  let paymentsMade = 0;
  for (const h of HOMES) {
    const total = owedByUnit.get(unitOf[h.unit]) ?? 0;
    const paying = h.unit === "105" ? Math.round(total * 0.55) : total;
    if (paying <= 0) continue;
    // Split into realistic monthly payments rather than one wire.
    const chunks = 12;
    const each = Math.floor(paying / chunks);
    for (let i = 0; i < chunks; i++) {
      const amount = i === chunks - 1 ? paying - each * (chunks - 1) : each;
      if (amount <= 0) continue;
      const { error } = await people[h.unit].client.rpc("record_payment", {
        p_unit_id: unitOf[h.unit], p_amount_cents: amount,
        p_rail: "ach", p_processor_fee_cents: 35,
      });
      if (error) { check(`unit ${h.unit} could pay`, false, error.message); break; }
      paymentsMade++;
    }
  }
  check("payments were recorded across the three years", paymentsMade > 60, `${paymentsMade} payments`);

  /* ------------------------------------------------------------ the trend view */

  const { data: activity } = await treasurer.client
    .from("monthly_activity").select("month, category, billed_cents").eq("association_id", hoa);
  const categories = new Set((activity ?? []).map((a) => a.category));
  check(
    "the trend view separates dues from shared costs from the assessment",
    categories.has("dues") && categories.has("shared_cost") && categories.has("special_assessment"),
    JSON.stringify([...categories]),
  );

  const duesRows = (activity ?? []).filter((a) => a.category === "dues");
  check(
    "there is a dues figure for every one of the thirty-six months",
    duesRows.length === MONTHS,
    `${duesRows.length} months`,
  );
  const duesTotal = duesRows.reduce((t, r) => t + Number(r.billed_cents), 0);
  check(
    "and the three year dues total is what was billed",
    duesTotal === duesBilled,
    `${money(duesTotal)} against ${money(duesBilled)}`,
  );

  const sortedDues = [...duesRows].sort((a, b) => a.month.localeCompare(b.month));
  check(
    "the trend shows dues rising year on year",
    Number(sortedDues.at(-1).billed_cents) > Number(sortedDues[0].billed_cents),
    `${money(Number(sortedDues[0].billed_cents))} to ${money(Number(sortedDues.at(-1).billed_cents))}`,
  );

  const waterByYear = [0, 1, 2].map((y) =>
    waterBills.slice(y * 12, y * 12 + 12).reduce((t, b) => t + b.total, 0),
  );
  check(
    "water cost the community more each year, and the product can show it",
    waterByYear[2] > waterByYear[1] && waterByYear[1] > waterByYear[0],
    waterByYear.map(money).join(" then "),
  );

  /* -------------------------------------- a home changes hands in year three */

  const buyerEmail = `buyer-${stamp}@example.com`;
  const { error: saleError } = await president.client.rpc("transfer_home", {
    p_unit_id: unitOf["104"], p_new_name: "Bea Buyer", p_new_email: buyerEmail,
    p_closing_date: monthsAgo(5),
  });
  check("a home sells in year three", !saleError, saleError?.message ?? "");

  const buyer = await makeUser("Bea Buyer", buyerEmail);
  const buyerShares = await all(() =>
    buyer.client.from("shared_cost_shares").select("share_cents"));
  check(
    "and the new owner inherits the home's whole utility history, not a blank page",
    buyerShares.length >= MONTHS,
    `${buyerShares.length} shares visible`,
  );

  const seller104 = await all(() =>
    people["104"].client.from("shared_cost_shares").select("share_cents"));
  check(
    "while the seller can no longer read the home's bills",
    seller104.length === 0,
    `${seller104.length}`,
  );

  /* ------------------------------------------------ the books, after three years */

  const charges = await all(() =>
    admin.from("charges").select("kind, amount_cents").eq("association_id", hoa));
  const billedAll = charges.filter((c) => c.kind === "charge").reduce((t, c) => t + c.amount_cents, 0);
  const paidAll = charges.filter((c) => c.kind !== "charge").reduce((t, c) => t + c.amount_cents, 0);

  const { data: balances } = await treasurer.client
    .from("unit_balances").select("balance_cents").eq("association_id", hoa);
  const outstanding = balances.reduce((t, b) => t + b.balance_cents, 0);
  check(
    "what is still owed is exactly what was billed less what was paid",
    outstanding === billedAll + paidAll,
    `${money(outstanding)} against ${money(billedAll + paidAll)}`,
  );

  const ledger = await all(() =>
    treasurer.client.from("ledger_entries").select("amount_cents, category")
      .eq("association_id", hoa));
  const banked = ledger.filter((e) => e.category === "Assessments").reduce((t, e) => t + e.amount_cents, 0);
  check(
    "and the bank shows every payment, net of the processor's cut",
    banked === -paidAll - paymentsMade * 35,
    `${money(banked)} against ${money(-paidAll - paymentsMade * 35)}`,
  );

  check(
    "one household is behind, and it is the one that voted against the roof",
    balances.filter((b) => b.balance_cents > 0).length === 1,
    `${balances.filter((b) => b.balance_cents > 0).length} behind`,
  );

  const { data: tenures } = await admin
    .from("memberships").select("full_name, starts_on, ends_on").eq("association_id", hoa);
  check(
    "three years on, the association can still say who lived where and when",
    (tenures ?? []).length === HOMES.length + 1,
    `${(tenures ?? []).length} tenures across ${HOMES.length} homes`,
  );
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) {
    await admin.from("memberships").update({ role: "resident" })
      .eq("association_id", id).eq("role", "president");
    await admin.from("associations").delete().eq("id", id);
  }
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
