/**
 * Five years of a forty home association, kept for a human to look at.
 *
 * The three year run proves the books keep adding up while an association
 * changes. Five years at forty homes is the size where the product's own
 * screens have to hold up: more than two thousand dues bills, more than two
 * thousand payments, twenty meetings, five elections, a special assessment,
 * two homes sold, and two owners who stop paying and stay stopped. Anything
 * that reads the first thousand rows and calls it the whole is found here.
 *
 * Everything goes through what the product itself calls: issue_assessment for
 * each month's dues, record_payment for each payment, levy_special_assessment,
 * transfer_home, cast_vote and rsvp_meeting, and the same table writes the
 * board's screens make for vendors, notices, requests, meetings and posts.
 * The only thing done behind the product's back is the calendar: a payment
 * recorded today is moved to the day in the past it stands for.
 *
 *   node scripts/verify-five-years.mjs                      found a fresh one, delete it after
 *   node scripts/verify-five-years.mjs --keep               found a fresh one, keep it
 *   node scripts/verify-five-years.mjs --association <id> --keep
 *                                                            fill one founded through /start
 *   node scripts/verify-five-years.mjs --remove             delete every association and user
 *                                                            this script ever kept
 *
 * A kept association carries settings.qa = "five-year" and every person this
 * script made carries user_metadata.qa = "five-year", which is how --remove
 * finds them again. Nothing else in the project is touched.
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
const KEEP = argv.includes("--keep");
const REMOVE = argv.includes("--remove");
const GIVEN = argv.includes("--association") ? argv[argv.indexOf("--association") + 1] : null;
const QA = "five-year";

const stamp = Date.now();
const PASSWORD = "Juniper-owner-" + Math.random().toString(36).slice(2, 10) + "A1";
const results = [];
let failures = 0;
const check = (n, p, d = "") => {
  results.push({ n, p, d });
  if (!p) failures++;
  if (!p) console.log(`FAIL  ${n}${d ? `  (${d})` : ""}`);
};
const created = { users: [], association: null };

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

/** Deterministic, so two runs tell the same five years. */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(2021);
const pick = (list) => list[Math.floor(random() * list.length)];

/** Every row, not the first page. Five years here is several thousand of most things. */
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
async function signIn(email, password) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const client = anon();
    const { error } = password
      ? await client.auth.signInWithPassword({ email, password })
      : await (async () => {
          const { data, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
          if (linkError) return { error: linkError };
          return client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
        })();
    if (!error) return client;
    if (!/rate|too many/i.test(error.message)) throw new Error(`${email}: ${error.message}`);
    console.log(`  auth rate limit for ${email}, waiting a minute`);
    await new Promise((r) => setTimeout(r, 60_000));
  }
  throw new Error(`${email}: still rate limited`);
}

async function makeUser(name, email) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name, qa: QA },
  });
  if (error) throw new Error(`${name}: ${error.message}`);
  created.users.push(data.user.id);
  return { client: await signIn(email, PASSWORD), id: data.user.id, email, name };
}

/** Deletes an association the way the other scripts do: the President rule first. */
async function deleteAssociation(id) {
  await admin.from("memberships").update({ role: "resident" })
    .eq("association_id", id).eq("role", "president");
  const { data: files } = await admin.storage.from("documents").list(id, { limit: 1000 });
  if (files?.length) await admin.storage.from("documents").remove(files.map((f) => `${id}/${f.name}`));
  await admin.from("associations").delete().eq("id", id);
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
    await deleteAssociation(a.id);
    console.log(`removed ${a.name}`);
  }
  const users = await qaUsers();
  for (const u of users) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  console.log(`removed ${users.length} people`);
  process.exit(0);
}

/* -------------------------------------------------------------- the cast */

const MONTHS = 60;
/** Dues by calendar year, rising each January to the $325 the board set today. */
/**
 * Two kinds of home, each paying its own amount: townhomes 1 to 24 rising to
 * the $325 the board set today, condos 25 to 40 over the clubhouse at $75
 * more. issue_assessment bills each home its kind's amount.
 */
const TOWNHOME_DUES = { 2021: 27_500, 2022: 28_500, 2023: 29_500, 2024: 30_500, 2025: 31_500, 2026: 32_500 };
const CONDO_PREMIUM = 7_500;
const kindOf = (unit) => (Number(unit) <= 24 ? "townhomes" : "condos");
const duesFor = (date, unit = "1") =>
  (TOWNHOME_DUES[Number(date.slice(0, 4))] ?? 32_500) + (kindOf(unit) === "condos" ? CONDO_PREMIUM : 0);
const duesByType = (date) => ({ townhomes: duesFor(date, "1"), condos: duesFor(date, "40") });

const SURNAMES = [
  "Abara", "Birch", "Castillo", "Dunmore", "Eckert", "Fong", "Garza", "Holloway", "Ibsen", "Jaramillo",
  "Kowalski", "Lindqvist", "Moreau", "Nakamura", "Okafor", "Petrov", "Quinlan", "Rasmussen", "Sato", "Tremblay",
  "Underwood", "Valdez", "Whitaker", "Xu", "Yilmaz", "Zamora", "Albrecht", "Bishop", "Cordova", "Dale",
  "Ellery", "Fitzgerald", "Greer", "Haddad", "Ivers", "Jensen",
];
const FIRST = [
  "Alex", "Bri", "Carmen", "Dev", "Elena", "Frank", "Grace", "Hugo", "Iris", "Jon", "Kira", "Luis",
  "Maya", "Noah", "Olive", "Pete", "Quinn", "Rosa", "Seth", "Tess", "Uma", "Vince", "Wren", "Yara",
  "Zeke", "Ana", "Ben", "Cleo", "Dan", "Eve", "Finn", "Gia", "Hal", "Ivy", "Jude", "Kai",
];

/**
 * Forty homes. Most pay on time. A handful are here to be the cases a board
 * actually argues about: two long-term delinquents, a chronic late payer, two
 * sales, and a few owners who never make an account and mail a check.
 */
const HOMES = Array.from({ length: 40 }, (_, i) => {
  const unit = String(i + 1);
  const base = { unit, name: `${FIRST[i % FIRST.length]} ${SURNAMES[i % SURNAMES.length]}`, email: `qa5y-${unit}@example.com`, account: i < 24, pays: "normal", rail: "ach" };
  return base;
});
const home = (unit) => HOMES[Number(unit) - 1];
Object.assign(home("2"), { name: "Tara Treasurer", email: "qa5y-tara@example.com", rail: "card" });
Object.assign(home("3"), { name: "Sam Steady", email: "qa5y-sam@example.com", autopay: true });
Object.assign(home("4"), { name: "Dora Delinquent", email: "qa5y-dora@example.com", pays: "stops" });
Object.assign(home("5"), { name: "Sofia Secretary", email: "qa5y-sofia@example.com" });
Object.assign(home("9"), { rail: "card" });
Object.assign(home("12"), { name: "Oscar Original", email: "qa5y-oscar@example.com" });
Object.assign(home("17"), { name: "Larry Late", email: "qa5y-larry@example.com", pays: "late" });
Object.assign(home("29"), { name: "Lena Long", email: "qa5y-lena@example.com", account: true, pays: "fades" });
Object.assign(home("33"), { name: "Sal Seller", email: "qa5y-sal@example.com", account: true, pays: "sells" });
// No account, and no email either: the board records their checks.
for (const u of ["38", "39", "40"]) home(u).email = "";

const SALES = [
  { unit: "12", month: 32, day: 10, buyer: "Bea Buyer", email: "qa5y-bea@example.com" },
  { unit: "33", month: 56, day: 15, buyer: "Nick Newman", email: "qa5y-nick@example.com", settleAtClosing: true },
];

try {
  /* ------------------------------------------------------ the association */

  let hoa = GIVEN;
  let president;
  if (hoa) {
    const association = await must("the association", admin.from("associations").select("*").eq("id", hoa).single());
    const { count } = await admin.from("charges").select("*", { count: "exact", head: true })
      .eq("association_id", hoa).eq("category", "dues");
    if (count) throw new Error(`${association.name} already has ${count} dues bills. Run --remove first, or found a fresh one.`);
    const seat = await must("the president", admin.from("memberships").select("profile_id, full_name")
      .eq("association_id", hoa).eq("role", "president").is("ends_on", null).single());
    const { data: founder } = await admin.auth.admin.getUserById(seat.profile_id);
    await admin.auth.admin.updateUserById(seat.profile_id, {
      user_metadata: { ...founder.user.user_metadata, qa: QA },
    });
    president = { client: await signIn(founder.user.email), id: seat.profile_id, name: seat.full_name, email: founder.user.email };
    check("the association founded through /start is found", association.dues_cents === 32_500,
      `${association.name}, ${money(association.dues_cents)} a month`);
  } else {
    president = await makeUser("Pat President", `qa5y-president-${stamp}@example.com`);
    hoa = await must("founding", president.client.rpc("create_association", {
      p_name: "Juniper Hollow", p_city: "Bend", p_state: "OR",
      p_dues_cents: 32_500, p_dues_cadence: "monthly", p_due_day: 1,
      p_founder_name: "Pat President", p_founder_unit: "1",
      p_households: HOMES.slice(1).map((h) => ({ unit: h.unit, name: "", email: "" })),
      p_property_type: "single-family", p_origin: "existing",
      p_shared_spaces: ["pool", "clubhouse", "playground"], p_collects: ["special-assessment"],
      p_previously: "platform",
    }));
    created.association = hoa;
    await president.client.from("bank_accounts").insert({
      association_id: hoa, kind: "operating", institution: "Mid Oregon Credit Union", mask: "3456",
    });
  }
  home("1").name = president.name;
  home("1").email = president.email;

  // Five years old. Every tenure starts at the founding, which is what lets a
  // sale in year three end one.
  const FOUNDED = addDays(monthStart(MONTHS - 1), -16);
  const { data: assocRow } = await admin.from("associations").select("settings").eq("id", hoa).single();
  await must("backdating the association", admin.from("associations").update({
    created_at: `${FOUNDED}T17:00:00Z`,
    settings: { ...(assocRow.settings ?? {}), qa: QA },
    dues_cents: duesFor(monthStart(MONTHS - 1)),
    dues_by_type: duesByType(monthStart(MONTHS - 1)),
  }).eq("id", hoa));
  await admin.from("units").update({ created_at: `${FOUNDED}T17:00:00Z` }).eq("association_id", hoa);
  await admin.from("memberships").update({ starts_on: FOUNDED }).eq("association_id", hoa).is("ends_on", null);

  const unitRows = await must("units", admin.from("units").select("id, label").eq("association_id", hoa));
  const unitOf = Object.fromEntries(unitRows.map((u) => [u.label, u.id]));

  // A mixed community, set the way Settings sets it: the kinds, each home's
  // kind, and what each kind pays.
  await must("kinds", president.client.from("associations").update({
    property_type: null, home_types: ["townhomes", "condos"],
  }).eq("id", hoa));
  for (const kind of ["townhomes", "condos"]) {
    await must(`${kind}`, president.client.from("units").update({ home_type: kind })
      .in("id", unitRows.filter((u) => kindOf(u.label) === kind).map((u) => u.id)));
  }
  check("forty homes on the register", unitRows.length === 40, `${unitRows.length}`);

  // The roster, filled in the way Homeowners does it: the empty seat the
  // wizard left on each home takes the name and email.
  for (const h of HOMES.slice(1)) {
    await must(`owner of ${h.unit}`, president.client.from("memberships")
      .update({ full_name: h.name, invited_email: h.email || null })
      .eq("unit_id", unitOf[h.unit]).is("profile_id", null).is("ends_on", null));
  }

  const people = { "1": president };
  const accountHomes = HOMES.filter((h) => h.unit !== "1" && h.account && h.email);
  for (const h of accountHomes) people[h.unit] = await makeUser(h.name, h.email);
  const { count: seated } = await admin.from("memberships").select("*", { count: "exact", head: true })
    .eq("association_id", hoa).not("profile_id", "is", null).is("ends_on", null);
  check("every owner who signed up took their own seat", seated === accountHomes.length + 1,
    `${seated} seated, ${accountHomes.length + 1} with accounts`);

  // The board: a treasurer and a secretary, appointed the way Settings does.
  const appoint = (profileId, role, capabilities) => president.client.from("memberships")
    .update({ role, capabilities }).eq("association_id", hoa).eq("profile_id", profileId)
    .is("ends_on", null).neq("role", "president");
  await must("treasurer", appoint(people["2"].id, "treasurer", ["finances", "vendors", "documents"]));
  await must("secretary", appoint(people["5"].id, "secretary", ["documents", "communications", "voting", "compliance", "forum"]));
  const treasurer = people["2"];
  const secretary = people["5"];

  await must("autopay", people["3"].client.rpc("set_my_autopay", {
    p_association_id: hoa, p_autopay: { day: 1, startMonth: monthStart(MONTHS - 1).slice(0, 7) },
  }).then((r) => r));

  const banks = await must("banks", admin.from("bank_accounts").select("id, kind").eq("association_id", hoa));
  let operating = banks.find((b) => b.kind === "operating");
  if (!operating) {
    operating = await must("operating", treasurer.client.from("bank_accounts").insert({
      association_id: hoa, kind: "operating", institution: "Mid Oregon Credit Union", mask: "3456",
    }).select().single());
  }
  const reserve = await must("reserve account", treasurer.client.from("bank_accounts").insert({
    association_id: hoa, kind: "reserve", institution: "Mid Oregon Credit Union", mask: "7781",
  }).select().single());

  /* ------------------------------------------------------------ vendors */

  const VENDORS = [
    { name: "High Desert Landscaping", service: "Landscaping and snow removal", category: "Landscaping" },
    { name: "Sparkle Pool Co", service: "Pool service", category: "Repairs & maintenance" },
    { name: "Bend Water and Power", service: "Common area water and lights", category: "Utilities" },
    { name: "Cascade Mutual", service: "Association insurance", category: "Insurance" },
    { name: "Summit HOA Accounting", service: "Annual review and taxes", category: "Legal & professional" },
    { name: "Deschutes Law Group", service: "Collections counsel", category: "Legal & professional" },
    { name: "Ridgeline Pools", service: "Pool resurfacing", category: "Repairs & maintenance" },
  ];
  const existingVendors = await must("vendors", admin.from("vendors").select("id, name").eq("association_id", hoa));
  const vendorOf = Object.fromEntries(existingVendors.map((v) => [v.name, v.id]));
  for (const v of VENDORS) {
    if (vendorOf[v.name]) {
      await treasurer.client.from("vendors").update({ default_category: v.category, w9_on_file: true }).eq("id", vendorOf[v.name]);
      continue;
    }
    const row = await must(`vendor ${v.name}`, treasurer.client.from("vendors").insert({
      association_id: hoa, name: v.name, service: v.service, default_category: v.category,
      w9_on_file: v.name !== "Deschutes Law Group", ach_enabled: true, coi_expires_on: "2027-01-31",
    }).select().single());
    vendorOf[v.name] = row.id;
  }

  /** A vendor payment, written the way Vendors writes one: the payout and its ledger line. */
  let vendorPaid = 0;
  let invoiceSeq = 1000;
  async function payVendor(name, cents, date, bank = operating.id) {
    const v = VENDORS.find((x) => x.name === name);
    const invoice = `INV-${date.slice(0, 4)}-${invoiceSeq++}`;
    await must(`paying ${name}`, treasurer.client.from("payouts").insert({
      id: randomUUID(), association_id: hoa, vendor_id: vendorOf[name], vendor_name: name,
      invoice_number: invoice, amount_cents: cents, method: "ach", status: "paid",
      issued_on: date, expected_on: addDays(date, 2),
      approvals: [{ name: treasurer.name, at: date }], approvals_required: 1,
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

  /* ------------------------------------------------------------- payments */

  const expected = new Map(unitRows.map((u) => [u.id, 0]));
  let paidTotal = 0;
  let feesTotal = 0;
  let paymentCount = 0;
  let closingPaid = 0;

  /** One payment, through record_payment, moved to the day it stands for. */
  async function pay(unit, cents, date, by) {
    if (cents <= 0) return;
    const h = home(unit);
    const rail = h.rail;
    const fee = rail === "card" ? Math.round(cents * 0.029) + 30 : Math.min(Math.round(cents * 0.008), 500);
    const client = by ?? people[unit]?.client ?? treasurer.client;
    const paymentId = await must(`payment for ${unit} on ${date}`, client.rpc("record_payment", {
      p_unit_id: unitOf[unit], p_amount_cents: cents, p_rail: rail, p_processor_fee_cents: fee,
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

  /* ----------------------------------------------------- community life helpers */

  const accountUnits = () => Object.keys(people).filter((u) => people[u]);
  let violationSeq = 0;
  let requestSeq = 200;
  let meetingCount = 0;
  let ballotCount = 0;
  let votesCast = 0;
  let rsvpCount = 0;
  let letters = 0;
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  );
  async function fileDocument(name, category, visibility, date) {
    const id = randomUUID();
    const path = `${hoa}/${id}.pdf`;
    const { error } = await secretary.client.storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
    if (error) throw new Error(`uploading ${name}: ${error.message}`);
    await must(`filing ${name}`, secretary.client.from("documents").insert({
      id, association_id: hoa, name, category, visibility, storage_path: path, size_label: "1 KB",
      updated_on: date, created_at: `${date}T16:00:00Z`,
    }));
  }

  async function holdMeeting(date, kind, title) {
    const meeting = await must("meeting", secretary.client.from("meetings").insert({
      id: randomUUID(), association_id: hoa, title, held_on: date, held_at: "7:00 PM",
      location: "Juniper Hollow Clubhouse", dial_in: "https://meet.example.com/juniper", status: "ended", kind,
      agenda: kind === "annual"
        ? ["Call to order", "Treasurer's report", "Election results", "Owner forum"]
        : ["Call to order", "Financials", "Architectural requests", "Collections", "Open forum"],
      notice_sent_on: addDays(date, -10),
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
        title: pick(["Get three bids for the fence", "Post pool rules", "Send the budget to owners", "Follow up on streetlight", "Review the reserve study"]),
        owner_name: pick([president.name, treasurer.name, secretary.name]),
        due_on: addDays(date, 30), done_on: addDays(date, 21), created_at: `${date}T20:00:00Z`,
      });
    }
    await fileDocument(`Minutes, ${title}`, "Meetings", "owners", addDays(date, 14));
    return meeting;
  }

  async function runBallot({ title, kind, body, options, opens, closes, voters, favour, meetingId, leaveOpen = false, seats = 1 }) {
    const id = randomUUID();
    await must(`ballot ${title}`, secretary.client.from("ballots").insert({
      id, association_id: hoa, title, body, kind, audience: "owners", status: "open",
      opens_on: opens, closes_on: closes, seats, quorum_required: 10,
      threshold_label: kind === "special-assessment" ? "Two thirds of votes cast" : "Most votes",
      meeting_id: meetingId ?? null, live_results_visible: false,
    }));
    const opts = await must("options", secretary.client.from("ballot_options").insert(
      options.map((label, position) => ({ ballot_id: id, label, position })),
    ).select());
    const sorted = opts.sort((a, b) => a.position - b.position);
    await pool(voters, 6, async (u) => {
      const choice = random() < favour ? sorted[0] : sorted[1 + Math.floor(random() * (sorted.length - 1))];
      const { error } = await people[u].client.rpc("cast_vote", { p_ballot_id: id, p_option_id: choice.id });
      if (error) throw new Error(`vote by ${u}: ${error.message}`);
      votesCast++;
    });
    if (!leaveOpen) {
      await must("certify", secretary.client.from("ballots").update({
        status: "certified", certified_by: secretary.name, certified_on: addDays(closes, 2),
      }).eq("id", id));
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
    ["Streetlight out on the corner", "maintenance"],
    ["Pool gate latch is sticking", "maintenance"],
    ["Copy of the last two years of minutes", "records"],
  ];
  async function fileRequest(unit, date) {
    const [title, kind] = pick(ARCH);
    const reference = `REQ-${date.slice(0, 4)}-${requestSeq++}`;
    const id = randomUUID();
    await must(`request by ${unit}`, people[unit].client.from("requests").insert({
      id, association_id: hoa, unit_id: unitOf[unit], filed_by: people[unit].id, reference, kind, title,
      body: `${title}. Submitted with photos and a sketch.`, status: "submitted", submitted_on: date,
      attachments: [], thread: [], created_at: `${date}T15:00:00Z`,
    }));
    const decision = kind === "architectural" ? (random() < 0.78 ? "approved" : "denied") : "closed";
    const decidedOn = addDays(date, 12 + Math.floor(random() * 20));
    await must("decision", president.client.from("requests").update({
      status: decision, decided_on: decidedOn, decided_by: president.name,
      decided_note: decision === "denied" ? "Does not meet Article 7 height limits." : null,
      thread: [{ id: `rt-${id}-0`, at: decidedOn, actor: president.name, actorRole: "board", body: `Status changed to ${decision}.`, kind: "status" }],
    }).eq("id", id));
  }

  const RULES = [
    ["Trash cans left at the curb", "CC&R 8.2"],
    ["Boat parked in the driveway", "CC&R 8.5"],
    ["Lawn not maintained", "CC&R 6.1"],
    ["Unapproved exterior paint", "CC&R 7.3"],
    ["Holiday lights up after February 1", "Rules 4.4"],
  ];
  async function sendNotice(unit, date) {
    violationSeq++;
    const [rule, citation] = pick(RULES);
    const roll = random();
    const stage = roll < 0.7 ? "cured" : roll < 0.9 ? "cured" : "fined";
    await must("notice", secretary.client.from("violations").insert({
      id: randomUUID(), association_id: hoa, reference: `VIO-${date.slice(0, 4)}-${100 + violationSeq}`,
      unit_id: unitOf[unit], unit_label: unit, owner_name: home(unit).name, rule, rule_citation: citation,
      stage, opened_on: date, next_action_on: addDays(date, 14),
      resolved_on: stage === "cured" ? addDays(date, 10 + Math.floor(random() * 25)) : null,
      photos: [], fine_cents: stage === "fined" ? 100_00 : 0, report_id: null, source: "board",
      created_at: `${date}T16:00:00Z`,
    }));
  }

  async function letter(unit, date, subject, body) {
    await must("letter", president.client.from("threads").insert({
      id: randomUUID(), association_id: hoa, subject, unit_id: unitOf[unit],
      participants: [home(unit).name, president.name], tag: "Billing", updated_on: date, unread: false,
      messages: [{ id: `m-${stamp}-${letters}`, at: date, from: president.name, fromRole: "board", direction: "outbound", channel: "email", body }],
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
    await must("post", people[unit].client.from("posts").insert({
      id, association_id: hoa, author_id: people[unit].id, author_name: home(unit).name,
      unit_label: unit, category, title, body, status: "published", created_at: `${date}T18:00:00Z`,
    }));
    for (let i = 0; i < replies; i++) {
      const who = pick(accountUnits());
      await people[who].client.from("post_replies").insert({
        association_id: hoa, post_id: id, author_id: people[who].id, author_name: home(who).name,
        unit_label: who, body: pick(["Thanks for posting.", "Same here.", "I can help Saturday.", "Great idea."]),
        created_at: `${addDays(date, i + 1)}T18:00:00Z`,
      });
    }
  }

  /* ---------------------------------------------------------- sixty months */

  const lastLetter = new Map();
  const t0 = Date.now();

  for (let m = 0; m < MONTHS; m++) {
    const first = monthStart(MONTHS - 1 - m);
    const next = monthStart(MONTHS - 2 - m);
    const year = Number(first.slice(0, 4));
    const month = Number(first.slice(5, 7));
    const label = `${MONTH_NAMES[month - 1]} dues`;
    const last = m === MONTHS - 1;
    // Nothing is dated after today, including in the current month.
    const clampDay = (d) => (last ? Math.min(d, Number(TODAY.slice(8, 10)) - 1 || 1) : d);

    // January: the new year's dues, set the way Settings sets them.
    if (month === 1) {
      await must("new dues", president.client.from("associations")
        .update({ dues_cents: duesFor(first), dues_by_type: duesByType(first) }).eq("id", hoa));
      await announce(addDays(first, -20), `${year} dues: ${money(duesFor(first, "1"))} townhomes, ${money(duesFor(first, "40"))} condos`,
        [`The board adopted the ${year} budget. Monthly dues are ${money(duesFor(first, "1"))} for a townhome and ${money(duesFor(first, "40"))} for a condo from January.`]);
    }

    const issued = await must(`issuing ${label} ${year}`, president.client.rpc("issue_assessment", {
      p_association_id: hoa, p_label: label, p_due_on: first,
    }));
    if (issued !== 40) check(`${label} ${year} billed every home`, false, `${issued} bills`);

    // What each home was charged this month, dues and any instalment.
    const monthCharges = await must("this month", admin.from("charges").select("unit_id, amount_cents, category")
      .eq("association_id", hoa).eq("kind", "charge").gte("due_on", first).lt("due_on", next));
    const newByUnit = new Map();
    for (const c of monthCharges) {
      newByUnit.set(c.unit_id, (newByUnit.get(c.unit_id) ?? 0) + c.amount_cents);
      // Instalments entered the balance the day they were levied: the balance
      // view counts what is due by the real today, and in this compressed
      // history every instalment already is. Owners still pay them monthly.
      if (c.category !== "special_assessment") expected.set(c.unit_id, expected.get(c.unit_id) + c.amount_cents);
    }

    // A sale this month: the seller's last day, then the buyer's first.
    for (const sale of SALES.filter((s) => s.month === m)) {
      const closing = dayOf(first, sale.day);
      const unitId = unitOf[sale.unit];
      // A seller who is up to date pays the month before closing, as usual.
      if (!sale.settleAtClosing) await pay(sale.unit, newByUnit.get(unitId) ?? 0, dayOf(first, sale.day - 3));
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
            description: `Paid at closing, unit ${sale.unit}`, counterparty: home(sale.unit).name,
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
      // The seller's closing covered this month; the buyer starts next month.
      home(sale.unit).pays = "buyer";
      home(sale.unit).firstMonth = m + 1;
      home(sale.unit).account = true;
    }

    // Payments. Each home settles the month its own way.
    await pool(HOMES, 8, async (h) => {
      const unitId = unitOf[h.unit];
      const due = newByUnit.get(unitId) ?? 0;
      const balance = expected.get(unitId);
      const day = clampDay(2 + Math.floor(random() * 12));
      const on = dayOf(first, day);
      if (h.pays === "normal") return pay(h.unit, due, on);
      if (h.pays === "buyer") return m >= h.firstMonth ? pay(h.unit, due, on) : undefined;
      if (h.pays === "late") {
        // Larry pays two months at a time, late, every other month.
        if (m % 2 === 1 || last) return pay(h.unit, balance, dayOf(first, clampDay(24)));
        return;
      }
      if (h.pays === "stops") {
        if (m < 30) return pay(h.unit, due, on);
        if (m === 44) return pay(h.unit, 1_000_00, on);
        return;
      }
      if (h.pays === "fades") {
        if (m < 40) return pay(h.unit, due, on);
        if (m % 3 === 0) return pay(h.unit, duesFor(first, h.unit), on);
        return;
      }
      if (h.pays === "sells") {
        if (m >= 53) return; // behind for the three months before closing
        return pay(h.unit, due, on);
      }
    });

    // The ladder: a letter at each rung a household reaches.
    for (const unit of ["4", "17", "29"]) {
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
        await letter(unit, dayOf(first, clampDay(18)), subjects[rung], `Your balance is ${money(behind)}.`);
      }
      lastLetter.set(unit, rung);
    }

    // Vendors, in season.
    const payDay = dayOf(first, clampDay(20));
    if (month >= 4 && month <= 10) await payVendor("High Desert Landscaping", 3_150_00 + (year - 2021) * 100_00, payDay);
    if (month === 12 || month <= 2) await payVendor("High Desert Landscaping", 1_800_00, payDay);
    if (month >= 5 && month <= 9) await payVendor("Sparkle Pool Co", 1_200_00, payDay);
    await payVendor("Bend Water and Power", 1_050_00 + month * 25_00, payDay);
    if (month === 3) await payVendor("Cascade Mutual", 9_600_00 + (year - 2022) * 450_00, payDay);
    if (month === 2) await payVendor("Summit HOA Accounting", 1_500_00, payDay);
    if (year >= 2025 && month % 4 === 0) await payVendor("Deschutes Law Group", 850_00, payDay);

    // Reserves: funded every month.
    await transfer(operating.id, reserve.id, year < 2024 ? 3_000_00 : 3_500_00, dayOf(first, clampDay(16)), "Reserve transfer, monthly funding");

    // Community life.
    if ([1, 4, 7, 10].includes(month) && !last) {
      const held = dayOf(first, 15);
      await holdMeeting(held, month === 1 ? "annual" : "board",
        month === 1 ? `Annual meeting ${year}` : `Board meeting, ${MONTH_NAMES[month - 1]} ${year}`);
    }
    if (month === 12) {
      const voters = accountUnits().filter(() => random() < 0.8);
      const b = await runBallot({
        title: `Board election ${year + 1}`, kind: "election", seats: 2,
        body: [`Two seats on the board for ${year + 1} and ${year + 2}.`],
        options: [`${pick(FIRST)} ${pick(SURNAMES)}`, `${pick(FIRST)} ${pick(SURNAMES)}`, `${pick(FIRST)} ${pick(SURNAMES)}`],
        opens: dayOf(first, 1), closes: dayOf(first, 28), voters, favour: 0.55,
      });
      check(`the ${year + 1} election counted every vote`, b.options.length === 3);
    }
    if (m === 28) {
      // Year three: the pool, approved by the owners and paid by assessment.
      const voters = accountUnits().filter(() => random() < 0.9);
      const ballot = await runBallot({
        title: "Special assessment to resurface the pool", kind: "special-assessment",
        body: ["Resurfacing is quoted at $60,000.00 and reserves hold less than half.", "Six monthly instalments of $250.00 a home from April."],
        options: ["Approve the assessment", "Reject"], opens: dayOf(first, 1), closes: dayOf(first, 25),
        voters, favour: 0.8,
      });
      await must("levy", treasurer.client.rpc("levy_special_assessment", {
        p_association_id: hoa, p_title: "Pool resurfacing", p_reason: "Plaster failed; approved by owners in February",
        p_total_cents: 60_000_00, p_allocation: "equal", p_installments: 6,
        p_first_due_on: monthStart(MONTHS - 3 - m), p_ballot_id: ballot.id,
      }));
      const instalments = await must("instalments", admin.from("charges").select("unit_id, amount_cents")
        .eq("association_id", hoa).eq("category", "special_assessment"));
      for (const c of instalments) expected.set(c.unit_id, expected.get(c.unit_id) + c.amount_cents);
      await announce(dayOf(first, 27), "Pool special assessment approved",
        ["Owners approved the pool resurfacing. $250.00 a month is added to April through September statements."], "Governance", true);
    }
    if (m === 31) {
      await transfer(reserve.id, operating.id, 60_000_00, dayOf(first, 5), "Reserve draw, pool resurfacing");
      await payVendor("Ridgeline Pools", 60_000_00, dayOf(first, 8));
    }
    if (month === 5) await announce(dayOf(first, 20), `The pool opens Memorial Day weekend`, ["Hours are 8am to 9pm. Wristbands at the clubhouse."], "Event");
    if (month === 12) await announce(dayOf(first, 3), "Snow removal", ["Plows run when accumulation passes two inches. Please keep cars off the street."], "Maintenance");
    if (month === 1) await fileDocument(`Budget ${year}`, "Financial", "owners", dayOf(first, 5));
    if (month === 3) await fileDocument(`Certificate of insurance ${year}`, "Insurance", "owners", dayOf(first, 22));

    // Requests and notices, a few a quarter, from homes that can file them.
    if (m % 2 === 0) await fileRequest(pick(accountUnits()), dayOf(first, clampDay(6 + Math.floor(random() * 10))));
    if (m % 3 === 1) await sendNotice(String(1 + Math.floor(random() * 40)), dayOf(first, clampDay(9)));
    if (m % 4 === 2) {
      const [category, title, body] = pick([
        ["Recommendations", "Anyone know a good roofer?", "Looking for a roofer who has worked in the neighborhood."],
        ["Lost and found", "Found a set of keys by the mailboxes", "Toyota key and a small brass key."],
        ["Events", "Block party in August", "Who is in for a potluck on the green?"],
        ["Safety", "Car break-ins on Juniper Loop", "Lock your cars, two were opened last night."],
        ["For sale", "Kayak for sale", "Two person kayak, $300."],
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
        `${wrong.length} homes off, e.g. ${wrong.slice(0, 2).map((w) => `${money(w.balance_cents)} vs ${money(expected.get(w.unit_id))}`).join(", ")}`);
    }
    if (month === 12 || last) {
      const charges = await all(() => admin.from("charges").select("amount_cents").eq("association_id", hoa));
      const sumCharges = charges.reduce((t, c) => t + c.amount_cents, 0);
      const sumBalances = balances.reduce((t, b) => t + b.balance_cents, 0);
      const later = await must("later", admin.from("charges").select("due_on, label, amount_cents")
        .eq("association_id", hoa).gt("due_on", TODAY));
      check(`${year}: the balances add up to the statements, to the cent`, sumCharges === sumBalances,
        `${money(sumBalances)} owed, ${charges.length} statement lines` +
          (sumCharges === sumBalances ? "" : `; statements ${money(sumCharges)}, ${later.length} lines dated after today: ${later.slice(0, 3).map((c) => `${c.due_on} ${c.label} ${money(c.amount_cents)}`).join(", ")}`));
      console.log(`  ${first.slice(0, 7)} done, ${paymentCount} payments so far, ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }

  // Today: a meeting coming up, and a vote still open.
  const upcoming = await must("next meeting", secretary.client.from("meetings").insert({
    id: randomUUID(), association_id: hoa, title: "Board meeting, October 2026",
    held_on: addDays(TODAY, 21), held_at: "7:00 PM", location: "Juniper Hollow Clubhouse",
    status: "scheduled", kind: "board", agenda: ["2027 budget", "Collections", "Pool"],
    notice_sent_on: TODAY,
  }).select().single());
  const openVoters = accountUnits().filter((u) => !["3", "4", "12", "33"].includes(u)).slice(0, 12);
  await runBallot({
    title: "Adopt the 2027 budget", kind: "budget",
    body: ["Dues of $335.00 a month from January 2027.", "Reserve funding rises to $4,000.00 a month."],
    options: ["Adopt", "Do not adopt"], opens: addDays(TODAY, -9), closes: addDays(TODAY, 16),
    voters: openVoters, favour: 0.75, meetingId: upcoming.id, leaveOpen: true,
  });
  await announce(addDays(TODAY, -2), "Vote on the 2027 budget by October 10",
    ["The ballot is open on the Vote tab. The board meets October 15 to adopt it."], "Governance", true);

  /* ------------------------------------------------------ five years, checked */

  const charges = await all(() => admin.from("charges")
    .select("unit_id, kind, category, amount_cents, due_on, label").eq("association_id", hoa));
  const dues = charges.filter((c) => c.kind === "charge" && c.category === "dues");
  check("sixty months of dues billed to forty homes", dues.length === 2400, `${dues.length} dues bills`);
  const duesExpected = Array.from({ length: MONTHS }, (_, i) => duesFor(monthStart(MONTHS - 1 - i), "1") * 24 + duesFor(monthStart(MONTHS - 1 - i), "40") * 16).reduce((a, b) => a + b, 0);
  const unitLabel = Object.fromEntries(unitRows.map((u) => [u.id, u.label]));
  const misbilled = dues.filter((c) => c.amount_cents !== duesFor(c.due_on, unitLabel[c.unit_id]));
  check("every dues bill is its kind's amount for its year, townhome or condo", misbilled.length === 0,
    misbilled.length ? `${misbilled.length} wrong, e.g. unit ${unitLabel[misbilled[0].unit_id]} ${misbilled[0].due_on} ${money(misbilled[0].amount_cents)}` : "2400 bills, 1440 townhome, 960 condo");
  const duesBilled = dues.reduce((t, c) => t + c.amount_cents, 0);
  check("and the dues total is the five years of rates, to the cent", duesBilled === duesExpected,
    `${money(duesBilled)} against ${money(duesExpected)}`);
  const levied = charges.filter((c) => c.category === "special_assessment").reduce((t, c) => t + c.amount_cents, 0);
  check("the pool assessment was levied exactly", levied === 60_000_00, money(levied));
  check("the statements hold more rows than one page of the API", charges.length > 1000,
    `${charges.length} statement lines for the association`);

  const { data: firstPage } = await president.client.from("charges").select("id").eq("association_id", hoa);
  check(
    "a single unpaged read of the statements stops at the server's row limit",
    (firstPage ?? []).length < charges.length,
    `${(firstPage ?? []).length} of ${charges.length} returned, so any screen reading it that way is short`,
  );

  const { data: balances } = await president.client
    .from("unit_balances").select("unit_id, balance_cents").eq("association_id", hoa);
  const outstanding = balances.reduce((t, b) => t + b.balance_cents, 0);
  const billed = charges.filter((c) => c.kind === "charge").reduce((t, c) => t + c.amount_cents, 0);
  const credited = charges.filter((c) => c.kind !== "charge").reduce((t, c) => t + c.amount_cents, 0);
  check("what is owed is billed less paid, to the cent, after five years", outstanding === billed + credited,
    `${money(outstanding)} owed of ${money(billed)} billed`);
  check("and the payments on the statements are every payment recorded, plus the one at closing",
    -credited === paidTotal + closingPaid, `${money(-credited)} against ${money(paidTotal + closingPaid)}`);

  const byUnit = new Map(balances.map((b) => [b.unit_id, b.balance_cents]));
  const behind = balances.filter((b) => b.balance_cents > 0).map((b) => unitRows.find((u) => u.id === b.unit_id).label).sort((a, b) => a - b);
  check("the two long-term delinquents are behind", byUnit.get(unitOf["4"]) > 20 * 30_000 && byUnit.get(unitOf["29"]) > 0,
    `Dora ${money(byUnit.get(unitOf["4"]))}, Lena ${money(byUnit.get(unitOf["29"]))}`);
  check("and only the homes that were meant to be", behind.every((u) => ["4", "17", "29"].includes(u)),
    `behind: ${behind.join(", ")}`);
  check("the home sold with a balance was settled at closing", byUnit.get(unitOf["33"]) === 0, money(byUnit.get(unitOf["33"])));

  const ledger = await all(() => president.client.from("ledger_entries")
    .select("amount_cents, category, bank_account_id, payment_id").eq("association_id", hoa));
  const assessmentsBooked = ledger.filter((e) => e.category === "Assessments").reduce((t, e) => t + e.amount_cents, 0);
  check("the bank shows every payment net of the processor, and the closing payment",
    assessmentsBooked === paidTotal - feesTotal + closingPaid,
    `${money(assessmentsBooked)} against ${money(paidTotal - feesTotal + closingPaid)}`);
  const operatingBalance = ledger.filter((e) => e.bank_account_id === operating.id).reduce((t, e) => t + e.amount_cents, 0);
  const reserveBalance = ledger.filter((e) => e.bank_account_id === reserve.id).reduce((t, e) => t + e.amount_cents, 0);
  check("operating cash is collections less vendors less reserve funding",
    operatingBalance === paidTotal - feesTotal + closingPaid - vendorPaid - reserveFunded,
    `${money(operatingBalance)} operating, ${money(reserveBalance)} reserve`);
  check("the reserve holds what was put in less the pool draw", reserveBalance === reserveFunded, money(reserveBalance));
  check("the ledger is larger than one page too", ledger.length > 1000, `${ledger.length} lines`);

  const { data: activity } = await president.client
    .from("monthly_activity").select("month, category, billed_cents").eq("association_id", hoa);
  const duesMonths = (activity ?? []).filter((a) => a.category === "dues");
  check("the trend view has a dues figure for all sixty months", duesMonths.length === MONTHS, `${duesMonths.length}`);

  /* ------------------------------------------------- who can see what, five years on */

  const sam = people["3"];
  const samCharges = await all(() => sam.client.from("charges").select("unit_id").eq("association_id", hoa));
  check("an owner reads only their own statement", samCharges.length > 0 && samCharges.every((c) => c.unit_id === unitOf["3"]),
    `${samCharges.length} lines, all theirs`);
  const { data: samPayouts } = await sam.client.from("payouts").select("id").eq("association_id", hoa);
  check("and none of the board's vendor payments", (samPayouts ?? []).length === 0, `${(samPayouts ?? []).length}`);
  const { data: samThreads } = await sam.client.from("threads").select("id, unit_id").eq("association_id", hoa);
  check("and none of the collection letters to a neighbour", (samThreads ?? []).every((t) => t.unit_id === unitOf["3"]),
    `${(samThreads ?? []).length} threads`);
  const { data: elsewhere } = await sam.client.from("charges").select("id").neq("association_id", hoa).limit(5);
  check("and nothing from any other association in the project", (elsewhere ?? []).length === 0, `${(elsewhere ?? []).length}`);

  const oscar = await signIn(home("12").email || "qa5y-oscar@example.com", PASSWORD).catch(() => null);
  if (oscar) {
    const { data: oscarCharges } = await oscar.from("charges").select("id").eq("association_id", hoa);
    check("the seller of 12 no longer sees the home", (oscarCharges ?? []).length === 0, `${(oscarCharges ?? []).length}`);
  }
  const bea = people["12"];
  const beaCharges = await all(() => bea.client.from("charges").select("id").eq("unit_id", unitOf["12"]));
  check("the buyer of 12 inherits the home's whole statement", beaCharges.length >= MONTHS, `${beaCharges.length} lines`);

  const { data: tenures } = await admin.from("memberships").select("id").eq("association_id", hoa);
  check("five years on, the association can say who owned each home when", (tenures ?? []).length === 42, `${(tenures ?? []).length} tenures`);

  const counts = {};
  for (const table of ["meetings", "ballots", "violations", "requests", "announcements", "posts", "documents", "payouts", "threads"]) {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("association_id", hoa);
    counts[table] = count;
  }
  check("a community's five years of records", counts.meetings === meetingCount + 1 && counts.ballots === ballotCount,
    Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", "));
  check("votes and RSVPs went through the product's own functions", votesCast > 100 && rsvpCount > 100,
    `${votesCast} votes, ${rsvpCount} RSVPs, ${letters} collection letters`);

  console.log(`\n${paymentCount} payments, ${money(paidTotal)} collected, ${money(vendorPaid)} to vendors, ${money(outstanding)} outstanding`);
} catch (error) {
  check("suite ran to completion", false, error.stack?.split("\n").slice(0, 3).join(" | ") ?? error.message);
} finally {
  if (!KEEP) {
    if (created.association) await deleteAssociation(created.association);
    else if (GIVEN) await deleteAssociation(GIVEN);
    for (const id of created.users) await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
if (KEEP) console.log(`\nKept. Owners sign in with their qa5y-…@example.com address and the password ${PASSWORD}`);
process.exit(failures ? 1 : 0);
