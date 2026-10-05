/**
 * Ten years of a forty home association, kept for a human to click through.
 *
 * The five year run (verify-five-years.mjs) proved the books hold past the
 * API's thousand row page. Ten years is where a real self managed HOA lives:
 * a decade of dues at five different rates, two special assessments, a roof
 * and a repaving paid out of reserves, four homes sold, three changes of
 * officer, forty past meetings with minutes, an election every December, and
 * owners at every rung of the collections ladder today.
 *
 * Everything goes through what the product itself calls: create_association,
 * issue_assessment for each month's dues, record_payment for each payment,
 * levy_special_assessment, transfer_home, transfer_presidency, cast_votes,
 * rsvp_meeting, start_owner_thread, and the same table writes the board's
 * screens make for vendors, notices, requests, meetings, documents and posts.
 * The only thing done behind the product's back is the calendar: a row written
 * today is moved to the day in the past it stands for.
 *
 *   node scripts/seed-ten-years.mjs             found "QA Ten Year Ridge" and keep it
 *   node scripts/seed-ten-years.mjs --remove    delete every association and user
 *                                                this script ever made
 *
 * The association carries settings.qa = "ten-year" and every person this
 * script makes carries user_metadata.qa = "ten-year", which is how --remove
 * finds them again. Every email is a +qa10y tag on the owner's own address,
 * so nothing this script does can reach anyone else. Nothing else in the
 * project is touched.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const argv = process.argv.slice(2);
const REMOVE = argv.includes("--remove");
const QA = "ten-year";
const NAME = "QA Ten Year Ridge";
const MAILBOX = "monishnaidu18";
const email = (tag) => `${MAILBOX}+qa10y-${tag}@gmail.com`;

const PASSWORD = "Ridge-owner-" + Math.random().toString(36).slice(2, 10) + "A1";
const results = [];
let failures = 0;
const check = (n, p, d = "") => {
  results.push({ n, p, d });
  if (!p) failures++;
  if (!p) console.log(`FAIL  ${n}${d ? `  (${d})` : ""}`);
};

const money = (c) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toFixed(2)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The first of the month, n months before this one. */
function monthStart(n) {
  const d = new Date(`${TODAY.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}
const dayOf = (first, day) => `${first.slice(0, 8)}${String(day).padStart(2, "0")}`;
const addDays = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Deterministic, so two runs tell the same ten years. */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(2016);
const pick = (list) => list[Math.floor(random() * list.length)];

/** Every row, not the first page. Ten years is several thousand of most things. */
async function all(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

/** Runs fn over items, n at a time. */
async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    }),
  );
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/** A signed in client, retried through the auth rate limit rather than failing on it. */
async function signIn(address, password) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const client = anon();
    const { error } = await client.auth.signInWithPassword({ email: address, password });
    if (!error) return client;
    if (!/rate|too many/i.test(error.message)) throw new Error(`${address}: ${error.message}`);
    console.log(`  auth rate limit for ${address}, waiting a minute`);
    await new Promise((r) => setTimeout(r, 60_000));
  }
  throw new Error(`${address}: still rate limited`);
}

const created = { users: [], association: null };
async function makeUser(name, address) {
  const { data, error } = await admin.auth.admin.createUser({
    email: address, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name, qa: QA },
  });
  if (error) throw new Error(`${name}: ${error.message}`);
  created.users.push(data.user.id);
  return { client: await signIn(address, PASSWORD), id: data.user.id, email: address, name };
}

/** Deletes an association the way the other scripts do: the President rule first. */
async function deleteAssociation(id) {
  await admin.from("memberships").update({ role: "resident" })
    .eq("association_id", id).eq("role", "president");
  const { data: files } = await admin.storage.from("documents").list(id, { limit: 1000 });
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${id}/${f.name}`));
  const { error } = await admin.from("associations").delete().eq("id", id);
  return error;
}

async function qaUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    users.push(...(data?.users ?? []).filter((u) => u.user_metadata?.qa === QA));
    if ((data?.users ?? []).length < 1000) return users;
  }
}

if (REMOVE) {
  const { data: kept } = await admin.from("associations").select("id, name").eq("settings->>qa", QA);
  for (const a of kept ?? []) {
    // A delete that failed leaves the association in the live project with
    // the dues cron still billing it. Say so and stop, before its people
    // are deleted and nobody is left who can open it.
    const error = await deleteAssociation(a.id);
    if (error) {
      console.error(`could not remove ${a.name} ${a.id}: ${error.message}`);
      process.exit(1);
    }
    console.log(`removed ${a.name} ${a.id}`);
  }
  const users = await qaUsers();
  for (const u of users) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  console.log(`removed ${users.length} people`);
  process.exit(0);
}

/* -------------------------------------------------------------- the cast */

const MONTHS = 120;
/**
 * Two kinds of home. Lots 1 to 28 are single family; units 29 to 40 are
 * condos over the clubhouse and pay for the building's insurance on top.
 * Dues rose five times in ten years, every two or three years.
 */
const LOT_DUES = {
  2016: 21_000, 2017: 21_000,
  2018: 22_500, 2019: 22_500,
  2020: 24_000, 2021: 24_000, 2022: 24_000,
  2023: 26_000, 2024: 26_000,
  2025: 28_500, 2026: 28_500,
};
const CONDO_PREMIUM = 6_500;
const kindOf = (unit) => (Number(unit) <= 28 ? "single-family" : "condos");
const duesFor = (date, unit = "1") =>
  (LOT_DUES[Number(date.slice(0, 4))] ?? 28_500) + (kindOf(unit) === "condos" ? CONDO_PREMIUM : 0);
const duesByType = (date) => ({ "single-family": duesFor(date, "1"), condos: duesFor(date, "40") });

const STREETS = ["Ridge Road", "Ridge Road", "Larkspur Court", "Basalt Lane"];
const addressOf = (unit) =>
  Number(unit) <= 28
    ? `${1400 + Number(unit) * 2} ${STREETS[Number(unit) % 3]}`
    : `1500 Ridge Road, Unit ${Number(unit) - 28}`;

const SURNAMES = [
  "Abara", "Birch", "Castillo", "Dunmore", "Eckert", "Fong", "Garza", "Holloway", "Ibsen", "Jaramillo",
  "Kowalski", "Lindqvist", "Moreau", "Nakamura", "Okafor", "Petrov", "Quinlan", "Rasmussen", "Sato", "Tremblay",
  "Underwood", "Valdez", "Whitaker", "Xu", "Yilmaz", "Zamora", "Albrecht", "Bishop", "Cordova", "Dale",
  "Ellery", "Fitzgerald", "Greer", "Haddad", "Ivers", "Jensen", "Keller", "Lowe", "Marsh", "Nunes",
];
const FIRST = [
  "Alex", "Bri", "Carmen", "Dev", "Elena", "Frank", "Grace", "Hugo", "Iris", "Jon", "Kira", "Luis",
  "Maya", "Noah", "Olive", "Pete", "Quinn", "Rosa", "Seth", "Tess", "Uma", "Vince", "Wren", "Yara",
  "Zeke", "Ana", "Ben", "Cleo", "Dan", "Eve", "Finn", "Gia", "Hal", "Ivy", "Jude", "Kai", "Lena", "Milo", "Nell", "Otto",
];

/**
 * Forty homes. Most pay on time. The rest are the cases a board actually
 * argues about, one at each rung of the collections ladder today.
 */
const HOMES = Array.from({ length: 40 }, (_, i) => {
  const unit = String(i + 1);
  return {
    unit, name: `${FIRST[i]} ${SURNAMES[i]}`, email: email(`home${unit}`),
    account: i < 16 || [18, 22, 26, 30, 35].includes(i), pays: "normal", rail: i % 5 === 0 ? "card" : "ach",
  };
});
const home = (unit) => HOMES[Number(unit) - 1];
Object.assign(home("1"), { name: "Pat Founder", email: email("founder") });
Object.assign(home("2"), { name: "Theo Books", email: email("theo") });          // treasurer 2016-2020
Object.assign(home("3"), { name: "Sam Steady", email: email("sam"), autopay: true }); // the current resident persona
Object.assign(home("4"), { name: "Dora Owing", email: email("dora"), pays: "stops" }); // counsel, the delinquent persona
Object.assign(home("5"), { name: "Sonia Minutes", email: email("sonia") });       // secretary 2016-2023
Object.assign(home("7"), { name: "Priya Chair", email: email("president") });     // president since 2022
Object.assign(home("11"), { name: "Tara Ledger", email: email("tara") });         // treasurer since 2021
Object.assign(home("14"), { name: "Sam Quill", email: email("quill") });          // secretary since 2024
Object.assign(home("17"), { name: "Larry Late", email: email("larry"), pays: "late" });
Object.assign(home("19"), { name: "Len Longgone", email: "", account: false, pays: "gone" }); // counsel, no account, three years
Object.assign(home("23"), { name: "Dan Demand", email: email("dan"), account: true, pays: "demand" });
Object.assign(home("27"), { name: "Nina Notice", email: email("nina"), account: true, pays: "notice" });
Object.assign(home("31"), { name: "Rey Reminder", email: email("rey"), account: true, pays: "reminder" });
Object.assign(home("36"), { name: "Fay Fades", email: email("fay"), account: true, pays: "fades" });
// No account and no email either: the board records their checks.
for (const u of ["38", "39", "40"]) { home(u).email = ""; home(u).account = false; }

/** Four sales, one of them settled at closing. */
const SALES = [
  { unit: "12", month: 30, day: 10, buyer: "Bea Buyer", email: email("bea") },
  { unit: "33", month: 62, day: 15, buyer: "Cal Closing", email: email("cal"), settleAtClosing: true },
  { unit: "8", month: 95, day: 22, buyer: "Hana Newcomer", email: email("hana") },
  { unit: "22", month: 113, day: 6, buyer: "Nick Newman", email: email("nick") },
];

/** The lean years and the fat ones: what the reserve got each month. */
const reserveMonthly = (year) => (year < 2019 ? 2_250_00 : year < 2023 ? 2_750_00 : 3_500_00);

try {
  /* ------------------------------------------------------ the association */

  const { data: already } = await admin.from("associations").select("id").eq("settings->>qa", QA);
  if (already?.length) throw new Error(`${NAME} already exists (${already[0].id}). Run --remove first.`);

  const founder = await makeUser("Pat Founder", email("founder"));
  const hoa = await must("founding", founder.client.rpc("create_association", {
    p_name: NAME, p_city: "Spokane", p_state: "WA",
    p_dues_cents: 28_500, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: HOMES.slice(1).map((h) => ({ unit: h.unit, name: "", email: "" })),
    p_property_type: "single-family", p_origin: "existing",
    p_shared_spaces: ["pool", "clubhouse", "playground"], p_collects: ["special-assessment"],
    p_previously: "fresh",
  }));
  created.association = hoa;
  console.log(`${NAME} ${hoa}`);

  // Ten years old. Every tenure starts at the founding, which is what lets a
  // sale in year three end one.
  const FOUNDED = addDays(monthStart(MONTHS - 1), -16);
  const { data: assocRow } = await admin.from("associations").select("settings").eq("id", hoa).single();
  await must("backdating the association", admin.from("associations").update({
    created_at: `${FOUNDED}T17:00:00Z`,
    settings: { ...(assocRow.settings ?? {}), qa: QA, showFundsToResidents: true },
    dues_cents: duesFor(monthStart(MONTHS - 1)),
    dues_by_type: duesByType(monthStart(MONTHS - 1)),
    property_type: null, home_types: ["single-family", "condos"],
    insurance_carrier: "Inland Northwest Mutual", insurance_policy_no: "INM-2016-0441",
    insurance_expires_on: `${Number(TODAY.slice(0, 4)) + 1}-03-01`,
    setup_completed_at: `${FOUNDED}T18:00:00Z`,
    subscription_status: "active",
  }).eq("id", hoa));
  await admin.from("units").update({ created_at: `${FOUNDED}T17:00:00Z` }).eq("association_id", hoa);
  await admin.from("memberships").update({ starts_on: FOUNDED }).eq("association_id", hoa).is("ends_on", null);

  /**
   * Terms of office are written by a trigger as of today; move the ones a
   * turnover just opened or closed to the day it stands for, as every other
   * row is moved.
   */
  const dateTerms = async (date) => {
    const today = new Date().toISOString().slice(0, 10);
    await admin.from("board_terms").update({ ends_on: date }).eq("association_id", hoa).eq("ends_on", today);
    await admin.from("board_terms").update({ starts_on: date }).eq("association_id", hoa).eq("starts_on", today);
  };

  const unitRows = await must("units", admin.from("units").select("id, label").eq("association_id", hoa));
  const unitOf = Object.fromEntries(unitRows.map((u) => [u.label, u.id]));
  const unitLabel = Object.fromEntries(unitRows.map((u) => [u.id, u.label]));
  check("forty homes on the register", unitRows.length === 40, `${unitRows.length}`);

  // Each home's kind and address, set the way Homeowners sets them.
  for (const u of unitRows) {
    await must(`home ${u.label}`, founder.client.from("units")
      .update({ home_type: kindOf(u.label), address: addressOf(u.label) }).eq("id", u.id));
  }

  // The roster, the way Homeowners fills it: the empty seat the wizard left
  // on each home takes the name and email.
  for (const h of HOMES.slice(1)) {
    await must(`owner of ${h.unit}`, founder.client.from("memberships")
      .update({ full_name: h.name, invited_email: h.email || null })
      .eq("unit_id", unitOf[h.unit]).is("profile_id", null).is("ends_on", null));
  }

  const people = { "1": founder };
  const accountHomes = HOMES.filter((h) => h.unit !== "1" && h.account && h.email);
  for (const h of accountHomes) people[h.unit] = await makeUser(h.name, h.email);
  const { count: seated } = await admin.from("memberships").select("*", { count: "exact", head: true })
    .eq("association_id", hoa).not("profile_id", "is", null).is("ends_on", null);
  check("every owner who signed up took their own seat", seated === accountHomes.length + 1,
    `${seated} seated, ${accountHomes.length + 1} with accounts`);

  /** Officers, appointed the way Settings does it. Reassigned at each turnover. */
  let president = founder;
  let treasurer = people["2"];
  let secretary = people["5"];
  const TREASURER_CAPS = ["finances", "vendors", "documents"];
  const SECRETARY_CAPS = ["documents", "communications", "voting", "compliance", "forum"];
  const appoint = (profileId, role, capabilities) => president.client.from("memberships")
    .update({ role, capabilities }).eq("association_id", hoa).eq("profile_id", profileId)
    .is("ends_on", null).neq("role", "president");
  await must("treasurer", appoint(treasurer.id, "treasurer", TREASURER_CAPS));
  await must("secretary", appoint(secretary.id, "secretary", SECRETARY_CAPS));
  // The founding board's terms start with the association.
  await dateTerms(FOUNDED);

  await must("autopay", people["3"].client.rpc("set_my_autopay", {
    p_association_id: hoa, p_autopay: { day: 1, startMonth: monthStart(MONTHS - 1).slice(0, 7) },
  }));

  const operating = await must("operating", treasurer.client.from("bank_accounts").insert({
    association_id: hoa, kind: "operating", institution: "Inland Northwest Credit Union", mask: "2016",
  }).select().single());
  const reserve = await must("reserve account", treasurer.client.from("bank_accounts").insert({
    association_id: hoa, kind: "reserve", institution: "Inland Northwest Credit Union", mask: "7710",
  }).select().single());

  // What the developer handed over: the books open with cash already there.
  const OPENING = { operating: 18_500_00, reserve: 62_000_00 };
  await must("opening balances", treasurer.client.from("ledger_entries").insert([
    { association_id: hoa, bank_account_id: operating.id, occurred_on: FOUNDED, description: "Opening balance", counterparty: "Inland Northwest Credit Union", category: "Opening balance", amount_cents: OPENING.operating, confirmed_at: `${FOUNDED}T18:00:00Z` },
    { association_id: hoa, bank_account_id: reserve.id, occurred_on: FOUNDED, description: "Opening balance", counterparty: "Inland Northwest Credit Union", category: "Opening balance", amount_cents: OPENING.reserve, confirmed_at: `${FOUNDED}T18:00:00Z` },
  ]));

  /* ------------------------------------------------------------ vendors */

  const VENDORS = [
    { name: "Palouse Landscaping", service: "Mowing, beds and snow removal", category: "Landscaping" },
    { name: "Clearwater Pool Service", service: "Pool chemistry and cleaning", category: "Repairs & maintenance" },
    { name: "Avista Utilities", service: "Common area power and water", category: "Utilities" },
    { name: "Inland Northwest Mutual", service: "Association insurance", category: "Insurance" },
    { name: "Ridge & Co CPA", service: "Annual review and tax return", category: "Legal & professional" },
    { name: "Spokane HOA Law", service: "Collections and governance counsel", category: "Legal & professional" },
    { name: "Summit Roofing", service: "Clubhouse roof replacement", category: "Repairs & maintenance" },
    { name: "Basalt Paving", service: "Street repaving", category: "Repairs & maintenance" },
    { name: "Reserve Advisors NW", service: "Reserve study", category: "Legal & professional" },
    { name: "Dependable Handyman", service: "Small repairs", category: "Repairs & maintenance" },
  ];
  const vendorOf = {};
  for (const v of VENDORS) {
    const row = await must(`vendor ${v.name}`, treasurer.client.from("vendors").insert({
      association_id: hoa, name: v.name, service: v.service, default_category: v.category,
      w9_on_file: v.name !== "Dependable Handyman", ach_enabled: v.name !== "Dependable Handyman",
      coi_expires_on: v.name === "Palouse Landscaping" ? addDays(TODAY, 20) : v.name === "Dependable Handyman" ? addDays(TODAY, -40) : `${Number(TODAY.slice(0, 4)) + 1}-01-31`,
    }).select().single());
    vendorOf[v.name] = row.id;
  }

  /** A vendor payment, written the way Vendors writes one: the payout and its ledger line. */
  let vendorPaid = 0;
  let invoiceSeq = 1000;
  async function payVendor(name, cents, date, bank = operating.id, method = "ach") {
    const v = VENDORS.find((x) => x.name === name);
    const invoice = `INV-${date.slice(0, 4)}-${invoiceSeq++}`;
    await must(`paying ${name}`, treasurer.client.from("payouts").insert({
      id: randomUUID(), association_id: hoa, vendor_id: vendorOf[name], vendor_name: name,
      invoice_number: invoice, amount_cents: cents, method, status: "paid",
      issued_on: date, expected_on: addDays(date, 2),
      approvals: [{ name: treasurer.name, at: date }], approvals_required: 1,
      created_at: `${date}T17:00:00Z`,
    }));
    await must(`booking ${name}`, treasurer.client.from("ledger_entries").insert({
      association_id: hoa, bank_account_id: bank, occurred_on: date,
      description: `${name}, ${invoice}`, counterparty: name, category: v.category,
      amount_cents: -cents, confirmed_at: `${date}T18:00:00Z`,
    }));
    vendorPaid += cents;
  }

  /** Money moved between the association's own accounts: two lines, net zero. */
  let reserveFunded = 0;
  async function transfer(fromBank, toBank, cents, date, description) {
    await must("transfer", treasurer.client.from("ledger_entries").insert([
      { association_id: hoa, bank_account_id: fromBank, occurred_on: date, description, counterparty: "Internal transfer", category: "Reserve transfer", amount_cents: -cents, confirmed_at: `${date}T18:00:00Z` },
      { association_id: hoa, bank_account_id: toBank, occurred_on: date, description, counterparty: "Internal transfer", category: "Reserve transfer", amount_cents: cents, confirmed_at: `${date}T18:00:00Z` },
    ]));
    if (toBank === reserve.id) reserveFunded += cents;
    else reserveFunded -= cents;
  }

  /** Interest the reserve account earned, posted quarterly by the credit union. */
  let interestEarned = 0;
  async function interest(date, cents) {
    await must("interest", treasurer.client.from("ledger_entries").insert({
      association_id: hoa, bank_account_id: reserve.id, occurred_on: date,
      description: "Interest, reserve money market", counterparty: "Inland Northwest Credit Union",
      category: "Interest income", amount_cents: cents, confirmed_at: `${date}T18:00:00Z`,
    }));
    interestEarned += cents;
  }

  /* ------------------------------------------------------------- payments */

  const expected = new Map(unitRows.map((u) => [u.id, 0]));
  let paidTotal = 0;
  let feesTotal = 0;
  let paymentCount = 0;
  let closingPaid = 0;
  let lateFeesCharged = 0;
  let finesCharged = 0;

  /** One payment, through record_payment, moved to the day it stands for. */
  async function pay(unit, cents, date, by) {
    if (cents <= 0) return;
    const h = home(unit);
    const rail = h.rail;
    const fee = rail === "card" ? Math.round(cents * 0.029) + 30 : Math.min(Math.round(cents * 0.008), 500);
    // An owner's payment is settled the way the webhook settles it; an owner
    // cannot write their own (0062). A named board member still records by hand.
    const paymentId = await must(`payment for ${unit} on ${date}`, by
      ? by.rpc("record_payment", {
          p_unit_id: unitOf[unit], p_amount_cents: cents, p_rail: rail, p_processor_fee_cents: fee,
        })
      : admin.rpc("record_payment", {
          p_unit_id: unitOf[unit], p_amount_cents: cents, p_rail: rail, p_processor_fee_cents: fee,
          p_paid_by: people[unit]?.id ?? null,
        }));
    await Promise.all([
      admin.from("payments").update({ created_at: `${date}T15:00:00Z`, settled_at: `${date}T15:00:00Z` }).eq("id", paymentId),
      admin.from("ledger_entries").update({ occurred_on: date }).eq("payment_id", paymentId),
      admin.from("charges").update({ due_on: date }).eq("unit_id", unitOf[unit])
        .eq("kind", "payment").eq("due_on", TODAY).neq("label", "Paid at closing"),
    ]);
    expected.set(unitOf[unit], expected.get(unitOf[unit]) - cents);
    paidTotal += cents;
    feesTotal += fee;
    paymentCount++;
  }

  /** A late fee or a fine, written to the statement the way the board would. */
  async function charge(unit, category, label, cents, date) {
    await must(`${label} for ${unit}`, treasurer.client.from("charges").insert({
      association_id: hoa, unit_id: unitOf[unit], kind: "charge", category, label,
      amount_cents: cents, due_on: date, created_at: `${date}T09:00:00Z`,
    }));
    expected.set(unitOf[unit], expected.get(unitOf[unit]) + cents);
    if (category === "late_fee") lateFeesCharged += cents;
    else finesCharged += cents;
  }

  /* ----------------------------------------------------- community life helpers */

  const accountUnits = () => Object.keys(people).filter((u) => people[u]);
  let violationSeq = 0;
  let requestSeq = 100;
  let meetingCount = 0;
  let ballotCount = 0;
  let votesCast = 0;
  let rsvpCount = 0;
  let letters = 0;
  let documentCount = 0;
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  );
  async function fileDocument(name, category, visibility, date, by = secretary) {
    const id = randomUUID();
    const path = `${hoa}/${id}.pdf`;
    const { error } = await by.client.storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
    if (error) throw new Error(`uploading ${name}: ${error.message}`);
    await must(`filing ${name}`, by.client.from("documents").insert({
      id, association_id: hoa, name, category, visibility, storage_path: path, size_label: `${40 + Math.floor(random() * 900)} KB`,
      updated_on: date, created_at: `${date}T16:00:00Z`,
    }));
    documentCount++;
  }

  const MINUTES_BODY = {
    annual: ["Call to order", "Proof of notice and quorum", "Treasurer's report", "Election results", "Owner forum", "Adjourn"],
    board: ["Call to order", "Approve prior minutes", "Financials", "Architectural requests", "Collections", "Open forum", "Adjourn"],
  };
  async function holdMeeting(date, kind, title, extra = {}) {
    const meeting = await must("meeting", secretary.client.from("meetings").insert({
      id: randomUUID(), association_id: hoa, title, held_on: date, held_at: "6:30 PM",
      location: "Ridge Clubhouse", dial_in: "https://meet.example.com/ridge", status: "ended", kind,
      agenda: MINUTES_BODY[kind] ?? MINUTES_BODY.board,
      notice_sent_on: addDays(date, -14), created_at: `${addDays(date, -21)}T16:00:00Z`,
      ...extra,
    }).select().single());
    meetingCount++;
    const coming = accountUnits().filter(() => random() < 0.45);
    await pool(coming, 6, async (u) => {
      const { error } = await people[u].client.rpc("rsvp_meeting", { p_meeting_id: meeting.id, p_response: random() < 0.85 ? "yes" : "no" });
      if (!error) rsvpCount++;
    });
    if (random() < 0.6) {
      await secretary.client.from("action_items").insert({
        association_id: hoa, meeting_id: meeting.id, created_by: secretary.id,
        title: pick(["Get three bids for the fence", "Post pool rules", "Send the budget to owners", "Follow up on the streetlight", "Review the reserve study", "Renew the clubhouse lease", "Ask the city about the storm drain"]),
        owner_name: pick([president.name, treasurer.name, secretary.name]),
        due_on: addDays(date, 30), done_on: random() < 0.85 ? addDays(date, 21) : null, created_at: `${date}T20:00:00Z`,
      });
    }
    await fileDocument(`Minutes, ${title}`, "Meetings", "owners", addDays(date, 14));
    return meeting;
  }

  async function runBallot({ title, kind, body, options, opens, closes, voters, favour, meetingId, leaveOpen = false, seats = 1 }) {
    const id = randomUUID();
    // A vote is refused once the closing date is more than a day gone
    // (0076), and most of these ballots closed years ago. So each is held
    // with a closing date still ahead while the homes vote, and given its
    // real one afterwards.
    const votingUntil = closes > TODAY ? closes : addDays(TODAY, 7);
    await must(`ballot ${title}`, secretary.client.from("ballots").insert({
      id, association_id: hoa, title, body, kind, audience: "owners", status: "open",
      opens_on: opens, closes_on: votingUntil, seats, quorum_required: 10,
      threshold_label: kind === "special-assessment" ? "Two thirds of votes cast" : kind === "election" ? "Most votes" : "Simple majority",
      meeting_id: meetingId ?? null, live_results_visible: false, created_at: `${addDays(opens, -7)}T16:00:00Z`,
    }));
    const opts = await must("options", secretary.client.from("ballot_options").insert(
      options.map((label, position) => ({ ballot_id: id, label, position })),
    ).select());
    const sorted = opts.sort((a, b) => a.position - b.position);
    await pool(voters, 6, async (u) => {
      // One pick per seat, through cast_votes: a two seat election takes two names.
      const picks = new Set();
      while (picks.size < Math.min(seats, sorted.length)) {
        const choice = random() < favour ? sorted[0] : sorted[1 + Math.floor(random() * (sorted.length - 1))];
        picks.add(choice.id);
      }
      const { error } = await people[u].client.rpc("cast_votes", { p_ballot_id: id, p_option_ids: [...picks] });
      if (error) throw new Error(`vote by ${u}: ${error.message}`);
      votesCast++;
    });
    if (!leaveOpen) {
      await must("certify", secretary.client.from("ballots").update({
        status: "certified", closes_on: closes, certified_by: secretary.name, certified_on: addDays(closes, 2),
      }).eq("id", id));
    } else if (votingUntil !== closes) {
      await must("the real closing date", secretary.client.from("ballots").update({ closes_on: closes }).eq("id", id));
    }
    ballotCount++;
    return { id, options: sorted };
  }

  const ARCH = [
    ["Six foot cedar fence along the back line", "architectural"],
    ["Solar panels on the south roof", "architectural"],
    ["Repaint the house in Sage Green", "architectural"],
    ["Replace the front deck with composite", "architectural"],
    ["Add a detached shed", "architectural"],
    ["Hot tub on the back patio", "architectural"],
    ["Streetlight out on the corner", "maintenance"],
    ["Pool gate latch is sticking", "maintenance"],
    ["Pothole at the mailboxes", "maintenance"],
    ["Copy of the last two years of minutes", "records"],
    ["Reserve the clubhouse for a birthday", "amenity"],
  ];
  async function fileRequest(unit, date, status) {
    const [title, kind] = pick(ARCH);
    const reference = `REQ-${date.slice(0, 4)}-${requestSeq++}`;
    const id = randomUUID();
    await must(`request by ${unit}`, people[unit].client.from("requests").insert({
      id, association_id: hoa, unit_id: unitOf[unit], filed_by: people[unit].id, reference, kind, title,
      body: `${title}. Submitted with photos and a sketch.`, status: "submitted", submitted_on: date,
      attachments: [], thread: [], created_at: `${date}T15:00:00Z`,
    }));
    // The database stamps a request with the day it arrives (0077), so the
    // day in the past it stands for is set behind the product's back, like
    // the payments.
    await must("dating the request", admin.from("requests").update({ submitted_on: date }).eq("id", id));
    if (status === "submitted") return;
    const decision = status ?? (kind === "architectural" ? (random() < 0.78 ? "approved" : "denied") : "closed");
    const decidedOn = addDays(date, 12 + Math.floor(random() * 20));
    await must("decision", president.client.from("requests").update({
      status: decision, decided_on: decision === "in-review" ? null : decidedOn, decided_by: decision === "in-review" ? null : president.name,
      decided_note: decision === "denied" ? "Does not meet Article 7 height limits." : null,
      thread: decision === "in-review"
        ? [{ id: `rt-${id}-0`, at: decidedOn, actor: president.name, actorRole: "board", body: "Thanks, the committee will look at this at the next meeting.", kind: "note" }]
        : [{ id: `rt-${id}-0`, at: decidedOn, actor: president.name, actorRole: "board", body: `Status changed to ${decision}.`, kind: "status" }],
    }).eq("id", id));
  }

  const RULES = [
    ["Trash cans left at the curb", "CC&R 8.2"],
    ["Boat parked in the driveway", "CC&R 8.5"],
    ["Lawn not maintained", "CC&R 6.1"],
    ["Unapproved exterior paint", "CC&R 7.3"],
    ["Holiday lights up after February 1", "Rules 4.4"],
    ["Short term rental advertised", "CC&R 9.1"],
  ];
  async function sendNotice(unit, date, forced) {
    violationSeq++;
    const [rule, citation] = pick(RULES);
    const roll = random();
    const stage = forced ?? (roll < 0.65 ? "cured" : roll < 0.8 ? "first-notice" : roll < 0.9 ? "hearing" : "fined");
    const resolved = stage === "cured" ? addDays(date, 10 + Math.floor(random() * 25)) : null;
    await must("notice", secretary.client.from("violations").insert({
      id: randomUUID(), association_id: hoa, reference: `VIO-${date.slice(0, 4)}-${100 + violationSeq}`,
      unit_id: unitOf[unit], unit_label: unit, owner_name: home(unit).name, rule, rule_citation: citation,
      stage, opened_on: date, next_action_on: addDays(date, 14),
      resolved_on: resolved,
      photos: [], fine_cents: stage === "fined" ? 100_00 : 0, report_id: null, source: "board",
      created_at: `${date}T16:00:00Z`,
    }));
    return stage;
  }

  async function letter(unit, date, subject, body) {
    await must("letter", president.client.from("threads").insert({
      id: randomUUID(), association_id: hoa, subject, unit_id: unitOf[unit],
      participants: [home(unit).name, president.name], tag: "Billing", updated_on: date, unread: false,
      messages: [{ id: `m-${randomUUID().slice(0, 8)}`, at: date, from: president.name, fromRole: "board", direction: "outbound", channel: "email", body }],
      created_at: `${date}T16:00:00Z`,
    }));
    letters++;
  }

  async function announce(date, title, body, category = "Notice", pinned = false) {
    await must("announcement", president.client.from("announcements").insert({
      id: randomUUID(), association_id: hoa, author_name: `${president.name}, Board President`,
      category, title, body: body.join("\n\n"), pinned, posted_on: date, created_at: `${date}T16:00:00Z`,
    }));
  }

  async function post(unit, date, category, title, body, replies) {
    const id = randomUUID();
    // An owner's post waits for a moderator; one that arrives published is
    // refused (0068). So it is filed pending and the President approves it,
    // which is what the forum does.
    await must("post", people[unit].client.from("posts").insert({
      id, association_id: hoa, author_id: people[unit].id, author_name: home(unit).name,
      unit_label: unit, category, title, body, status: "pending", created_at: `${date}T18:00:00Z`,
    }));
    await must("approving the post", president.client.from("posts")
      .update({ status: "published", moderated_by: president.name }).eq("id", id));
    for (let i = 0; i < replies; i++) {
      const who = pick(accountUnits());
      await people[who].client.from("post_replies").insert({
        association_id: hoa, post_id: id, author_id: people[who].id, author_name: home(who).name,
        unit_label: who, body: pick(["Thanks for posting.", "Same here.", "I can help Saturday.", "Great idea.", "Count us in."]),
        created_at: `${addDays(date, i + 1)}T18:00:00Z`,
      });
    }
  }

  /* -------------------------------------------------- the governing papers */

  await fileDocument("Declaration of Covenants, Conditions and Restrictions", "Governing", "owners", FOUNDED, founder);
  await fileDocument("Bylaws", "Governing", "owners", FOUNDED, founder);
  await fileDocument("Articles of Incorporation", "Governing", "owners", FOUNDED, founder);
  await fileDocument("Rules and Regulations (2016)", "Governing", "owners", addDays(FOUNDED, 40), founder);
  await fileDocument("Reserve study, 2016", "Financial", "owners", addDays(FOUNDED, 60), founder);

  /* ------------------------------------------------ a hundred and twenty months */

  const lastLetter = new Map();
  const t0 = Date.now();

  for (let m = 0; m < MONTHS; m++) {
    const first = monthStart(MONTHS - 1 - m);
    const next = monthStart(MONTHS - 2 - m);
    const year = Number(first.slice(0, 4));
    const month = Number(first.slice(5, 7));
    const label = `${MONTH_NAMES[month - 1]} ${year} dues`;
    const last = m === MONTHS - 1;
    // Nothing is dated after today, including in the current month.
    const clampDay = (d) => (last ? Math.min(d, Number(TODAY.slice(8, 10)) - 1 || 1) : d);

    /* ---- board turnover, done the way the product does it */
    if (year === 2021 && month === 1) {
      // Theo hands the books to Tara after the 2021 annual meeting.
      await must("old treasurer steps down", appoint(treasurer.id, "resident", []));
      await must("new treasurer", appoint(people["11"].id, "treasurer", TREASURER_CAPS));
      await dateTerms(first);
      treasurer = people["11"];
      await announce(dayOf(first, 20), "Tara Ledger is our new Treasurer",
        ["Theo Books stepped down after four years keeping the books. Tara Ledger takes over from the January meeting. Thank you, Theo."], "Governance");
    }
    if (year === 2022 && month === 1) {
      // Pat hands the presidency to Priya, through transfer_presidency.
      await must("presidency handed over", president.client.rpc("transfer_presidency", { p_to_profile: people["7"].id }));
      await dateTerms(first);
      president = people["7"];
      await announce(dayOf(first, 18), "Priya Chair elected President",
        ["After six years as founding President, Pat Founder handed the gavel to Priya Chair at the annual meeting. Pat stays on as an owner and on the landscaping committee."], "Governance", false);
    }
    if (year === 2024 && month === 1) {
      await must("old secretary steps down", appoint(secretary.id, "resident", []));
      await must("new secretary", appoint(people["14"].id, "secretary", SECRETARY_CAPS));
      await dateTerms(first);
      secretary = people["14"];
    }

    /* ---- January: the new year's dues, set the way Settings sets them */
    if (month === 1) {
      const rose = duesFor(first, "1") !== duesFor(addDays(first, -1), "1");
      await must("new dues", president.client.from("associations")
        .update({ dues_cents: duesFor(first), dues_by_type: duesByType(first) }).eq("id", hoa));
      if (rose) {
        await announce(addDays(first, -20), `${year} dues: ${money(duesFor(first, "1"))} lots, ${money(duesFor(first, "40"))} condos`,
          [`The board adopted the ${year} budget. Monthly dues are ${money(duesFor(first, "1"))} for a lot and ${money(duesFor(first, "40"))} for a condo from January.`, "The increase covers insurance and the reserve contribution recommended in the reserve study."], "Governance");
      }
      await fileDocument(`Budget ${year}`, "Financial", "owners", addDays(first, -25), treasurer);
      if (year > 2016) await fileDocument(`Year end financials ${year - 1}`, "Financial", "owners", dayOf(first, 28), treasurer);
    }

    const issued = await must(`issuing ${label}`, treasurer.client.rpc("issue_assessment", {
      p_association_id: hoa, p_label: label, p_due_on: first,
    }));
    if (issued !== 40) check(`${label} billed every home`, false, `${issued} bills`);

    // What each home was charged this month, dues and any instalment.
    const monthCharges = await must("this month", admin.from("charges").select("unit_id, amount_cents, category")
      .eq("association_id", hoa).eq("kind", "charge").gte("due_on", first).lt("due_on", next));
    const newByUnit = new Map();
    for (const c of monthCharges) {
      newByUnit.set(c.unit_id, (newByUnit.get(c.unit_id) ?? 0) + c.amount_cents);
      // Instalments entered the balance the day they were levied: the balance
      // view counts what is due by the real today, and in this compressed
      // history every instalment already is. Owners still pay them monthly.
      if (c.category === "dues") expected.set(c.unit_id, expected.get(c.unit_id) + c.amount_cents);
    }

    /* ---- a sale this month: the seller's last day, then the buyer's first */
    for (const sale of SALES.filter((s) => s.month === m)) {
      const closing = dayOf(first, sale.day);
      const unitId = unitOf[sale.unit];
      if (!sale.settleAtClosing) await pay(sale.unit, newByUnit.get(unitId) ?? 0, dayOf(first, Math.max(1, sale.day - 3)));
      if (sale.settleAtClosing) {
        // What Homeowners does with "settle the balance at closing" ticked.
        const { data: bal } = await president.client.from("unit_balances").select("balance_cents").eq("unit_id", unitId).single();
        const owed = bal.balance_cents;
        if (owed > 0) {
          await must("paid at closing", president.client.from("charges").insert({
            association_id: hoa, unit_id: unitId, kind: "payment", label: "Paid at closing",
            amount_cents: -owed, due_on: closing,
          }));
          await must("paid at closing, booked", president.client.from("ledger_entries").insert({
            association_id: hoa, bank_account_id: operating.id, occurred_on: closing,
            description: `Paid at closing, ${addressOf(sale.unit)}`, counterparty: home(sale.unit).name,
            category: "Assessments", amount_cents: owed, confirmed_at: `${closing}T18:00:00Z`,
          }));
          expected.set(unitId, expected.get(unitId) - owed);
          closingPaid += owed;
        }
      }
      await must(`sale of ${sale.unit}`, president.client.rpc("transfer_home", {
        p_unit_id: unitId, p_new_name: sale.buyer, p_new_email: sale.email, p_closing_date: closing,
      }));
      const buyer = await makeUser(sale.buyer, sale.email);
      people[sale.unit] = buyer;
      home(sale.unit).name = sale.buyer;
      home(sale.unit).email = sale.email;
      home(sale.unit).pays = "buyer";
      home(sale.unit).firstMonth = m + 1;
      home(sale.unit).account = true;
    }

    /* ---- payments: each home settles the month its own way */
    await pool(HOMES, 8, async (h) => {
      const unitId = unitOf[h.unit];
      const due = newByUnit.get(unitId) ?? 0;
      const balance = expected.get(unitId);
      const day = clampDay(2 + Math.floor(random() * 12));
      const on = dayOf(first, day);
      switch (h.pays) {
        case "normal":
          return pay(h.unit, due, on);
        case "buyer":
          return m >= h.firstMonth ? pay(h.unit, due, on) : undefined;
        case "late":
          // Larry pays two months at a time, late, every other month.
          if (m % 2 === 0) return pay(h.unit, balance, dayOf(first, clampDay(24)));
          return;
        case "stops":
          // Dora paid for years, then stopped in early 2025 and stayed stopped.
          if (m < 100) return pay(h.unit, due, on);
          if (m === 108) return pay(h.unit, 500_00, on); // one token payment after the demand
          return;
        case "gone":
          // Len stopped in mid 2023; the file is with counsel.
          if (m < 80) return pay(h.unit, due, on);
          return;
        case "demand":
          // Dan has not paid since June: three months, on the demand rung today.
          if (m < MONTHS - 3) return pay(h.unit, due, on);
          return;
        case "notice":
          // Nina paid through August; a fine in August and September dues are open.
          if (m < MONTHS - 1) return pay(h.unit, due, on);
          return;
        case "reminder":
          // Rey missed this month only.
          if (m < MONTHS - 1) return pay(h.unit, due, on);
          return;
        case "fades":
          if (m < 100) return pay(h.unit, due, on);
          if (m % 3 === 0) return pay(h.unit, duesFor(first, h.unit), on);
          return;
        case "sells":
          return;
        default:
          return;
      }
    });
    // The seller of 33 stops paying two months before closing; the closing settles it.
    if (m === 59) home("33").pays = "sells";

    /* ---- late fees on the homes that stay behind, the way the policy promises */
    for (const unit of ["4", "19"]) {
      const behind = expected.get(unitOf[unit]);
      if (behind >= duesFor(first, unit) && (unit === "4" ? m > 100 : m > 80)) {
        await charge(unit, "late_fee", "Late fee", 25_00, dayOf(first, clampDay(15)));
      }
    }
    // Nina's fine, from a notice that went to a hearing.
    if (last) {
      await sendNotice("27", dayOf(addDays(first, -31), 4), "fined");
      await charge("27", "fine", "Fine, VIO short term rental", 100_00, dayOf(addDays(first, -31), 20));
    }

    /* ---- the ladder: a letter at each rung a household reaches */
    for (const unit of ["4", "17", "19", "23", "27", "31", "36"]) {
      const behind = expected.get(unitOf[unit]);
      const months = Math.floor(behind / duesFor(first, unit));
      const rung = months >= 6 ? "counsel" : months >= 3 ? "demand" : months >= 2 ? "late-notice" : months >= 1 ? "reminder" : null;
      if (rung && lastLetter.get(unit) !== rung) {
        const subjects = {
          reminder: "A friendly reminder about your dues",
          "late-notice": "Late notice: your account is past due",
          demand: "Demand for payment and a payment plan offer",
          counsel: "Your account has been referred to counsel",
        };
        await letter(unit, dayOf(first, clampDay(18)), subjects[rung], `Your balance is ${money(behind)}. Pay online or reply here to arrange a plan.`);
      }
      lastLetter.set(unit, rung);
    }

    /* ---- vendors, in season */
    const payDay = dayOf(first, clampDay(20));
    if (month >= 4 && month <= 10) await payVendor("Palouse Landscaping", 2_650_00 + (year - 2016) * 90_00, payDay);
    if (month === 12 || month <= 2) await payVendor("Palouse Landscaping", 1_400_00 + (year - 2016) * 40_00, payDay);
    if (month >= 5 && month <= 9) await payVendor("Clearwater Pool Service", 980_00 + (year - 2016) * 30_00, payDay);
    await payVendor("Avista Utilities", 820_00 + month * 20_00 + (year - 2016) * 25_00, payDay);
    if (month === 3) await payVendor("Inland Northwest Mutual", 7_800_00 + (year - 2016) * 520_00, payDay);
    if (month === 2) await payVendor("Ridge & Co CPA", 1_250_00 + (year - 2016) * 50_00, payDay, operating.id, "check");
    if (year >= 2023 && month % 3 === 0) await payVendor("Spokane HOA Law", 650_00, payDay);
    if (m % 7 === 3) await payVendor("Dependable Handyman", 180_00 + Math.floor(random() * 6) * 45_00, dayOf(first, clampDay(11)), operating.id, "check");

    /* ---- reserves: funded every month, interest every quarter */
    await transfer(operating.id, reserve.id, reserveMonthly(year), dayOf(first, clampDay(16)), "Reserve transfer, monthly funding");
    if ([3, 6, 9, 12].includes(month) && !last) {
      // Roughly what a money market paid, on roughly what was in it.
      const rate = year <= 2021 ? 0.006 : year === 2022 ? 0.015 : 0.041;
      const held = OPENING.reserve + reserveFunded + interestEarned;
      await interest(dayOf(first, 28), Math.max(1_00, Math.round((held * rate) / 4)));
    }

    /* ---- the two big reserve spends */
    if (m === 33) {
      // Summer 2019: the clubhouse roof.
      await transfer(reserve.id, operating.id, 86_000_00, dayOf(first, 3), "Reserve draw, clubhouse roof");
      await payVendor("Summit Roofing", 43_000_00, dayOf(first, 5));
      await payVendor("Summit Roofing", 43_000_00, dayOf(first, 26));
      await announce(dayOf(first, 6), "Clubhouse roof replacement starts July 8",
        ["Summit Roofing replaces the clubhouse roof over two weeks. The pool stays open; the clubhouse is closed weekdays.", "Paid from reserves, as planned in the 2016 reserve study. No assessment."], "Maintenance", false);
    }
    if (m === 92) {
      // Summer 2024: the streets, from reserves plus the shortfall assessment.
      await transfer(reserve.id, operating.id, 80_000_00, dayOf(first, 3), "Reserve draw, street repaving");
      await payVendor("Basalt Paving", 55_000_00, dayOf(first, 10));
      await payVendor("Basalt Paving", 55_000_00, dayOf(first, 27));
      await announce(dayOf(first, 1), "Repaving June 10 to 21: where to park",
        ["Basalt Paving grinds and overlays Ridge Road and Larkspur Court. Park on Basalt Lane on the days posted on the sign at the entrance.", "Cost is $110,000: $80,000 from reserves and the $30,000 special assessment owners approved in March."], "Maintenance", false);
    }

    /* ---- special assessments, approved by the owners */
    if (m === 47) {
      // Autumn 2020: the storm drain under Larkspur Court.
      const voters = accountUnits().filter(() => random() < 0.85);
      const ballot = await runBallot({
        title: "Special assessment: storm drain repair", kind: "special-assessment",
        body: ["The storm drain under Larkspur Court collapsed in the spring. The city's engineer quoted $40,000.00 to replace it.", "Four monthly instalments of $250.00 a home from October."],
        options: ["Approve the assessment", "Reject"], opens: dayOf(first, 1), closes: dayOf(first, 21),
        voters, favour: 0.82,
      });
      await must("levy", treasurer.client.rpc("levy_special_assessment", {
        p_association_id: hoa, p_title: "Storm drain repair", p_reason: "Collapsed drain under Larkspur Court; approved by owners in September 2020",
        p_total_cents: 40_000_00, p_allocation: "equal", p_installments: 4,
        p_first_due_on: next, p_ballot_id: ballot.id,
      }));
      const instalments = await must("instalments", admin.from("charges").select("unit_id, amount_cents")
        .eq("association_id", hoa).eq("category", "special_assessment").gte("due_on", next));
      for (const c of instalments) expected.set(c.unit_id, expected.get(c.unit_id) + c.amount_cents);
      await announce(dayOf(first, 23), "Storm drain assessment approved",
        ["Owners approved the storm drain repair. $250.00 a month is added to October through January statements."], "Governance", false);
      await payVendor("Basalt Paving", 40_000_00, dayOf(monthStart(MONTHS - 3 - m), 15));
    }
    if (m === 89) {
      // Spring 2024: the paving shortfall.
      const voters = accountUnits().filter(() => random() < 0.85);
      const ballot = await runBallot({
        title: "Special assessment: street repaving shortfall", kind: "special-assessment",
        body: ["Repaving is quoted at $110,000.00. Reserves hold $80,000.00 for it.", "Three monthly instalments of $250.00 a home from April cover the rest."],
        options: ["Approve the assessment", "Reject"], opens: dayOf(first, 1), closes: dayOf(first, 22),
        voters, favour: 0.74,
      });
      await must("levy", treasurer.client.rpc("levy_special_assessment", {
        p_association_id: hoa, p_title: "Street repaving shortfall", p_reason: "Repaving quoted above the reserve; approved by owners in March 2024",
        p_total_cents: 30_000_00, p_allocation: "equal", p_installments: 3,
        p_first_due_on: next, p_ballot_id: ballot.id,
      }));
      const instalments = await must("instalments", admin.from("charges").select("unit_id, amount_cents")
        .eq("association_id", hoa).eq("category", "special_assessment").gte("due_on", next));
      for (const c of instalments) expected.set(c.unit_id, expected.get(c.unit_id) + c.amount_cents);
      await announce(dayOf(first, 24), "Repaving assessment approved",
        ["Owners approved the repaving assessment. $250.00 a month is added to April through June statements."], "Governance", false);
    }

    /* ---- community life */
    if ([1, 4, 7, 10].includes(month) && !last) {
      const held = dayOf(first, 15);
      await holdMeeting(held, month === 1 ? "annual" : "board",
        month === 1 ? `Annual meeting ${year}` : `Board meeting, ${MONTH_NAMES[month - 1]} ${year}`);
    }
    if (month === 12) {
      const voters = accountUnits().filter(() => random() < 0.78);
      const names = new Set();
      while (names.size < 3) names.add(`${pick(FIRST)} ${pick(SURNAMES)}`);
      await runBallot({
        title: `Board election ${year + 1}`, kind: "election", seats: 2,
        body: [`Two seats on the board for ${year + 1} and ${year + 2}.`, "Pick up to two."],
        options: [...names],
        opens: dayOf(first, 1), closes: dayOf(first, 28), voters, favour: 0.55,
      });
    }
    if (month === 5) await announce(dayOf(first, 20), "The pool opens Memorial Day weekend", ["Hours are 8am to 9pm. Wristbands at the clubhouse."], "Event");
    if (month === 12) await announce(dayOf(first, 3), "Snow removal", ["Plows run when accumulation passes two inches. Please keep cars off the street."], "Maintenance");
    if (month === 3) await fileDocument(`Certificate of insurance ${year}`, "Insurance", "owners", dayOf(first, 22), treasurer);
    if (year === 2019 && month === 2) await fileDocument("Reserve study, 2019 update", "Financial", "owners", dayOf(first, 12), treasurer);
    if (year === 2019 && month === 2) await payVendor("Reserve Advisors NW", 3_200_00, dayOf(first, 12));
    if (year === 2024 && month === 2) await fileDocument("Reserve study, 2024 update", "Financial", "owners", dayOf(first, 14), treasurer);
    if (year === 2024 && month === 2) await payVendor("Reserve Advisors NW", 3_900_00, dayOf(first, 14));
    if (year === 2021 && month === 6) await fileDocument("Rules and Regulations (2021 revision)", "Governing", "owners", dayOf(first, 16));
    if (year === 2023 && month === 9) await fileDocument("Architectural guidelines", "Governing", "owners", dayOf(first, 8));

    // Requests and notices, a few a quarter, from homes that can file them.
    if (m % 2 === 0) await fileRequest(pick(accountUnits()), dayOf(first, clampDay(6 + Math.floor(random() * 10))));
    if (m % 3 === 1) await sendNotice(String(1 + Math.floor(random() * 40)), dayOf(first, clampDay(9)));
    if (m % 4 === 2) {
      const [category, title, body] = pick([
        ["Recommendations", "Anyone know a good roofer?", "Looking for a roofer who has worked in the neighborhood."],
        ["Lost and found", "Found a set of keys by the mailboxes", "Toyota key and a small brass key."],
        ["Events", "Block party in August", "Who is in for a potluck on the green?"],
        ["Safety", "Car break-ins on Ridge Road", "Lock your cars, two were opened last night."],
        ["For sale", "Kayak for sale", "Two person kayak, $300."],
        ["General", "Garbage day moved to Tuesday", "The city changed our route. Cans out Monday night."],
      ]);
      await post(pick(accountUnits()), dayOf(first, clampDay(11)), category, title, body, Math.floor(random() * 4));
    }

    /* ------------------------------------------------ this month's invariants */

    const { data: balances, error: balanceError } = await president.client
      .from("unit_balances").select("unit_id, balance_cents").eq("association_id", hoa);
    if (balanceError) throw new Error(balanceError.message);
    const wrong = balances.filter((b) => b.balance_cents !== expected.get(b.unit_id));
    if (wrong.length || balances.length !== 40) {
      check(`${first.slice(0, 7)}: every home's balance is what it was billed less what it paid`, false,
        `${wrong.length} homes off, e.g. ${wrong.slice(0, 2).map((w) => `${unitLabel[w.unit_id]} ${money(w.balance_cents)} vs ${money(expected.get(w.unit_id))}`).join(", ")}`);
    }
    if (month === 12 || last) {
      const charges = await all(() => admin.from("charges").select("amount_cents").eq("association_id", hoa));
      const sumCharges = charges.reduce((t, c) => t + c.amount_cents, 0);
      const sumBalances = balances.reduce((t, b) => t + b.balance_cents, 0);
      check(`${year}: the balances add up to the statements, to the cent`, sumCharges === sumBalances,
        `${money(sumBalances)} owed, ${charges.length} statement lines`);
      console.log(`  ${first.slice(0, 7)} done, ${paymentCount} payments so far, ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }

  /* --------------------------------------------------------- today's desk */

  // A meeting coming up, and a vote still open.
  const upcoming = await must("next meeting", secretary.client.from("meetings").insert({
    id: randomUUID(), association_id: hoa, title: `Board meeting, ${MONTH_NAMES[(Number(TODAY.slice(5, 7))) % 12]} ${Number(TODAY.slice(5, 7)) === 12 ? Number(TODAY.slice(0, 4)) + 1 : TODAY.slice(0, 4)}`,
    held_on: addDays(TODAY, 20), held_at: "6:30 PM", location: "Ridge Clubhouse", dial_in: "https://meet.example.com/ridge",
    status: "scheduled", kind: "board", agenda: [`${Number(TODAY.slice(0, 4)) + 1} budget`, "Collections report", "Pool heater bids", "Open forum"],
    notice_sent_on: addDays(TODAY, -3),
  }).select().single());
  const openVoters = accountUnits().filter((u) => !["3", "4", "12", "33"].includes(u)).slice(0, 11);
  await runBallot({
    title: `Adopt the ${Number(TODAY.slice(0, 4)) + 1} budget`, kind: "budget",
    body: [`Dues of ${money(duesFor(TODAY, "1") + 15_00)} a month for lots and ${money(duesFor(TODAY, "40") + 15_00)} for condos from January.`, "Reserve funding rises to $4,000.00 a month, as the 2024 reserve study recommends."],
    options: ["Adopt", "Do not adopt"], opens: addDays(TODAY, -8), closes: addDays(TODAY, 15),
    voters: openVoters, favour: 0.75, meetingId: upcoming.id, leaveOpen: true,
  });
  await announce(addDays(TODAY, -2), `Vote on the ${Number(TODAY.slice(0, 4)) + 1} budget by ${MONTH_NAMES[Number(addDays(TODAY, 15).slice(5, 7)) - 1]} ${Number(addDays(TODAY, 15).slice(8, 10))}`,
    ["The ballot is open on the Voting tab. The board meets in three weeks to adopt it."], "Governance", true);

  // Two invoices on the treasurer's desk, and one scheduled.
  await must("invoice waiting", treasurer.client.from("payouts").insert([
    { id: randomUUID(), association_id: hoa, vendor_id: vendorOf["Clearwater Pool Service"], vendor_name: "Clearwater Pool Service", invoice_number: "CP-2026-0931", amount_cents: 1_840_00, method: "ach", status: "needs-approval", issued_on: addDays(TODAY, -4), expected_on: addDays(TODAY, 10), approvals: [], approvals_required: 2 },
    { id: randomUUID(), association_id: hoa, vendor_id: vendorOf["Dependable Handyman"], vendor_name: "Dependable Handyman", invoice_number: "DH-1188", amount_cents: 415_00, method: "check", status: "scheduled", issued_on: addDays(TODAY, -6), expected_on: addDays(TODAY, 4), approvals: [{ name: treasurer.name, at: addDays(TODAY, -5) }, { name: president.name, at: addDays(TODAY, -4) }], approvals_required: 2 },
  ]));

  // Requests open on the board's desk today.
  await fileRequest("3", addDays(TODAY, -6), "submitted");
  await fileRequest("12", addDays(TODAY, -12), "in-review");
  await fileRequest("22", addDays(TODAY, -2), "submitted");

  // A notice open on a home, and one at a hearing.
  await sendNotice("9", addDays(TODAY, -9), "first-notice");
  await sendNotice("36", addDays(TODAY, -25), "hearing");

  // Owners writing to the board, through the product's own inbox.
  const t1 = await must("owner thread", people["3"].client.rpc("start_owner_thread", {
    p_unit_id: unitOf["3"], p_subject: "Autopay receipt for September", p_body: "My bank shows September's dues went out on the 1st but I never got the receipt email. Can you confirm it landed?", p_tag: "Billing",
  }));
  await people["4"].client.rpc("start_owner_thread", {
    p_unit_id: unitOf["4"], p_subject: "Payment plan", p_body: "I lost my job in February. I can do $150 a month starting October if the board will accept a plan and hold off on the attorney.", p_tag: "Billing",
  });
  await people["22"].client.rpc("start_owner_thread", {
    p_unit_id: unitOf["22"], p_subject: "Fence approval from the previous owner", p_body: "We bought in March. The seller said the fence was approved in 2022. Can you send the approval letter?", p_tag: "Architectural",
  });
  await must("board reply", admin.from("threads").update({
    messages: [
      { id: `m-${randomUUID().slice(0, 8)}`, at: addDays(TODAY, -3), from: home("3").name, fromRole: "resident", direction: "inbound", channel: "app", body: "My bank shows September's dues went out on the 1st but I never got the receipt email. Can you confirm it landed?" },
      { id: `m-${randomUUID().slice(0, 8)}`, at: addDays(TODAY, -2), from: treasurer.name, fromRole: "board", direction: "outbound", channel: "email", body: "Landed on the 2nd, applied to September. The receipt went to your old address; I have updated it." },
    ], updated_on: addDays(TODAY, -2), unread: false,
  }).eq("id", t1));

  // The reserve study components, as the 2024 update listed them.
  await must("reserve components", treasurer.client.from("reserve_components").insert([
    ["Clubhouse roof (replaced 2019)", 30, 23, 9_800_00 * 10, 2_400_00 * 10, "Replaced by Summit Roofing, July 2019. Architectural shingle, 30 year."],
    ["Street overlay, Ridge Road and Larkspur Court (2024)", 18, 16, 12_500_00 * 10, 1_900_00 * 10, "Overlay by Basalt Paving, June 2024."],
    ["Pool resurfacing", 12, 2, 5_400_00 * 10, 4_100_00 * 10, "Plaster is at end of life. Bids due before the spring."],
    ["Pool heater", 10, 0, 1_900_00 * 10, 1_900_00 * 10, "Failed August. Bids on the October agenda."],
    ["Clubhouse HVAC", 15, 6, 1_600_00 * 10, 900_00 * 10, null],
    ["Perimeter fence and entry gate", 18, 5, 3_400_00 * 10, 1_800_00 * 10, null],
    ["Playground equipment", 15, 4, 2_100_00 * 10, 1_200_00 * 10, "Inspected annually by the insurer."],
    ["Storm drain, Larkspur Court (2020)", 40, 34, 4_000_00 * 10, 400_00 * 10, "Replaced 2020 by special assessment."],
  ].map(([name, useful_life_years, remaining_life_years, replacement_cost_cents, funded_cents, note]) => ({
    association_id: hoa, name, useful_life_years, remaining_life_years, replacement_cost_cents, funded_cents, note, last_inspection: "2024-02-14",
  }))));

  // This year's budget, line by line.
  const thisYear = Number(TODAY.slice(0, 4));
  await must("budget", treasurer.client.from("budget_lines").insert([
    ["Assessments", "income", duesFor(TODAY, "1") * 28 * 12 + duesFor(TODAY, "40") * 12 * 12],
    ["Late fees", "income", 60_000],
    ["Interest income", "income", 5_200_00],
    ["Landscaping", "expense", 27_500_00],
    ["Utilities", "expense", 15_800_00],
    ["Insurance", "expense", 13_000_00],
    ["Repairs & maintenance", "expense", 9_500_00],
    ["Legal & professional", "expense", 4_800_00],
    ["Reserve transfer", "expense", 42_000_00],
  ].map(([category, kind, annual_cents], position) => ({ association_id: hoa, category, kind, annual_cents, position }))));

  await must("amenities", president.client.from("amenities").insert([
    { association_id: hoa, name: "Clubhouse", detail: "Seats 40. Kitchen and side door with a code.", reservable: true, status: "open", max_hours: 4, rules: null },
    { association_id: hoa, name: "Pool", detail: "Heater is out; the water is unheated until the board picks a bid.", reservable: false, status: "open", max_hours: null, rules: null },
    { association_id: hoa, name: "Playground", detail: "Dawn to dusk.", reservable: false, status: "open", max_hours: null, rules: null },
  ]));

  await fileDocument(`Welcome packet for new owners (${thisYear})`, "Other", "owners", addDays(TODAY, -60));
  await fileDocument("Pool rules", "Notices", "owners", addDays(TODAY, -120));
  await fileDocument("Board policies: collections, fines and hearings", "Governing", "board", addDays(TODAY, -300));

  /* -------------------------------------------------------- ten years, checked */

  const charges = await all(() => admin.from("charges")
    .select("unit_id, kind, category, amount_cents, due_on, label").eq("association_id", hoa));
  const dues = charges.filter((c) => c.kind === "charge" && c.category === "dues");
  check("a hundred and twenty months of dues billed to forty homes", dues.length === 4800, `${dues.length} dues bills`);
  const duesExpected = Array.from({ length: MONTHS }, (_, i) => duesFor(monthStart(MONTHS - 1 - i), "1") * 28 + duesFor(monthStart(MONTHS - 1 - i), "40") * 12).reduce((a, b) => a + b, 0);
  const misbilled = dues.filter((c) => c.amount_cents !== duesFor(c.due_on, unitLabel[c.unit_id]));
  check("every dues bill is its kind's amount for its year, lot or condo", misbilled.length === 0,
    misbilled.length ? `${misbilled.length} wrong, e.g. ${unitLabel[misbilled[0].unit_id]} ${misbilled[0].due_on} ${money(misbilled[0].amount_cents)}` : "4800 bills, 3360 lots, 1440 condos");
  const duesBilled = dues.reduce((t, c) => t + c.amount_cents, 0);
  check("and the dues total is the ten years of rates, to the cent", duesBilled === duesExpected, `${money(duesBilled)} against ${money(duesExpected)}`);
  const levied = charges.filter((c) => c.category === "special_assessment").reduce((t, c) => t + c.amount_cents, 0);
  check("the two special assessments were levied exactly", levied === 70_000_00, money(levied));
  const lateFees = charges.filter((c) => c.category === "late_fee").reduce((t, c) => t + c.amount_cents, 0);
  const fines = charges.filter((c) => c.category === "fine").reduce((t, c) => t + c.amount_cents, 0);
  check("late fees and fines are on the statements", lateFees === lateFeesCharged && fines === finesCharged, `${money(lateFees)} late fees, ${money(fines)} fines`);

  const { data: balances } = await president.client.from("unit_balances").select("unit_id, balance_cents").eq("association_id", hoa);
  const outstanding = balances.reduce((t, b) => t + b.balance_cents, 0);
  const billed = charges.filter((c) => c.kind === "charge").reduce((t, c) => t + c.amount_cents, 0);
  const credited = charges.filter((c) => c.kind !== "charge").reduce((t, c) => t + c.amount_cents, 0);
  check("what is owed is billed less paid, to the cent, after ten years", outstanding === billed + credited, `${money(outstanding)} owed of ${money(billed)} billed`);
  check("and the payments on the statements are every payment recorded, plus the one at closing",
    -credited === paidTotal + closingPaid, `${money(-credited)} against ${money(paidTotal + closingPaid)}`);

  const byUnit = new Map(balances.map((b) => [b.unit_id, b.balance_cents]));
  const behind = balances.filter((b) => b.balance_cents > 0).map((b) => unitLabel[b.unit_id]).sort((a, b) => a - b);
  check("one home at each rung of the ladder, and the two with counsel",
    ["4", "17", "19", "23", "27", "31", "36"].every((u) => byUnit.get(unitOf[u]) > 0),
    ["4", "17", "19", "23", "27", "31", "36"].map((u) => `${home(u).name} ${money(byUnit.get(unitOf[u]))}`).join(", "));
  check("and only the homes that were meant to be", behind.every((u) => ["4", "17", "19", "23", "27", "31", "36"].includes(u)), `behind: ${behind.join(", ")}`);
  check("the home sold with a balance was settled at closing", byUnit.get(unitOf["33"]) === 0, money(byUnit.get(unitOf["33"])));

  const ledger = await all(() => president.client.from("ledger_entries")
    .select("amount_cents, category, bank_account_id, payment_id").eq("association_id", hoa));
  const assessmentsBooked = ledger.filter((e) => e.category === "Assessments").reduce((t, e) => t + e.amount_cents, 0);
  check("the bank shows every payment net of the processor, and the closing payment",
    assessmentsBooked === paidTotal - feesTotal + closingPaid, `${money(assessmentsBooked)} against ${money(paidTotal - feesTotal + closingPaid)}`);
  const operatingBalance = ledger.filter((e) => e.bank_account_id === operating.id).reduce((t, e) => t + e.amount_cents, 0);
  const reserveBalance = ledger.filter((e) => e.bank_account_id === reserve.id).reduce((t, e) => t + e.amount_cents, 0);
  check("operating cash is the opening balance plus collections less vendors less reserve funding",
    operatingBalance === OPENING.operating + paidTotal - feesTotal + closingPaid - vendorPaid - reserveFunded,
    `${money(operatingBalance)} operating, ${money(reserveBalance)} reserve`);
  check("the reserve holds the opening balance plus what was put in plus interest, less the roof and the paving",
    reserveBalance === OPENING.reserve + reserveFunded + interestEarned, `${money(reserveBalance)}, ${money(interestEarned)} of it interest`);
  check("the ledger is several pages long", ledger.length > 3000, `${ledger.length} lines`);
  check("operating cash never went negative", operatingBalance > 0, money(operatingBalance));

  const { data: activity } = await president.client.from("monthly_activity").select("month, category, billed_cents").eq("association_id", hoa);
  const duesMonths = (activity ?? []).filter((a) => a.category === "dues");
  check("the trend view has a dues figure for all hundred and twenty months", duesMonths.length === MONTHS, `${duesMonths.length}`);

  /* ------------------------------------------------- who is who, ten years on */

  const { data: officers } = await admin.from("memberships").select("full_name, role").eq("association_id", hoa).is("ends_on", null).neq("role", "resident");
  check("the board today is Priya, Tara and Sam Quill",
    officers.length === 3 && officers.some((o) => o.role === "president" && o.full_name === "Priya Chair"),
    officers.map((o) => `${o.full_name} ${o.role}`).join(", "));
  const { data: tenures } = await admin.from("memberships").select("id").eq("association_id", hoa);
  check("ten years on, the association can say who owned each home when", (tenures ?? []).length === 44, `${(tenures ?? []).length} tenures`);

  const sam = people["3"];
  const samCharges = await all(() => sam.client.from("charges").select("unit_id").eq("association_id", hoa));
  check("an owner reads only their own statement", samCharges.length > 0 && samCharges.every((c) => c.unit_id === unitOf["3"]), `${samCharges.length} lines, all theirs`);
  const nick = people["22"];
  const nickCharges = await all(() => nick.client.from("charges").select("id").eq("unit_id", unitOf["22"]));
  check("the buyer of 22 inherits the home's whole statement", nickCharges.length >= MONTHS, `${nickCharges.length} lines`);
  const { data: history } = await president.client.rpc("home_history", { p_unit_id: unitOf["22"] });
  check("and the board can see who owned 22 before", (history ?? []).length === 2, (history ?? []).map((h) => `${h.full_name} ${h.starts_on} to ${h.ends_on ?? "now"}`).join("; "));

  const counts = {};
  for (const table of ["meetings", "ballots", "violations", "requests", "announcements", "posts", "documents", "payouts", "threads", "votes", "special_assessments", "reserve_components"]) {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq(table === "votes" ? "ballot_id" : "association_id", table === "votes" ? "00000000-0000-0000-0000-000000000000" : hoa);
    counts[table] = count;
  }
  check("a community's ten years of records", counts.meetings === meetingCount + 1 && counts.ballots === ballotCount && counts.documents === documentCount,
    Object.entries(counts).filter(([k]) => k !== "votes").map(([k, v]) => `${v} ${k}`).join(", "));
  check("votes and RSVPs went through the product's own functions", votesCast > 150 && rsvpCount > 150, `${votesCast} ballots cast, ${rsvpCount} RSVPs, ${letters} collection letters`);

  console.log(`\n${paymentCount} payments, ${money(paidTotal)} collected, ${money(vendorPaid)} to vendors, ${money(outstanding)} outstanding`);
  console.log(`\nSign in (password ${PASSWORD}, or a magic link from the admin API):`);
  console.log(`  President   ${people["7"].email}`);
  console.log(`  Treasurer   ${people["11"].email}`);
  console.log(`  Secretary   ${people["14"].email}`);
  console.log(`  Resident    ${people["3"].email}   (Sam Steady, home 3, current, autopay)`);
  console.log(`  Delinquent  ${people["4"].email}   (Dora Owing, home 4, with counsel)`);
  console.log(`  Buyer       ${people["22"].email}   (Nick Newman, home 22, bought March)`);
} catch (error) {
  check("seed ran to completion", false, error.stack?.split("\n").slice(0, 3).join(" | ") ?? error.message);
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
console.log(`\nKept: ${created.association}. Remove with: node scripts/seed-ten-years.mjs --remove`);
process.exit(failures ? 1 : 0);
