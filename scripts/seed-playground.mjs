/**
 * A persisted community to play in: Mehr Meadows, fully furnished.
 *
 *   pnpm db:playground
 *
 * Adds one association to the live project without touching anything else.
 * Twenty-four homes, a year of dues and payments with four homes behind, a
 * budget against a real ledger, reserves, vendors and an invoice inbox,
 * documents, meetings with action items, an open ballot with votes, a forum,
 * violations at three stages, requests at six, messages, a join request.
 * Monish's own account is President; the rest of the board and ten owners
 * get plus-addressed accounts (monishnaidu18+mm-*) with one printed password;
 * eight owners are on the register with no account yet, so the invite flow
 * has somebody to invite.
 *
 * Runs again cleanly: the previous Mehr Meadows and its mm- accounts are
 * removed first. Nothing else is.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const OWNER = "monishnaidu18@gmail.com";
const MM = OWNER.split("@")[0] + "+mm-";
const plus = (tag) => `${MM}${tag}@${OWNER.split("@")[1]}`;
const PASSWORD = process.env.SEED_PASSWORD ?? `Meadows-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8)}`;
const NAME = "Mehr Meadows";
const DUES = 28_500;

const iso = (d) => d.toISOString().slice(0, 10);
const now = new Date();
const days = (n) => { const d = new Date(now); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monthStart = (back) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)); return iso(d); };
const monthName = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const ts = (date, hour = 10) => `${date}T${String(hour).padStart(2, "0")}:00:00Z`;
const must = (label) => ({ error }) => { if (error) throw new Error(`${label}: ${error.message}`); };

/* ------------------------------------------------------------- roster */

const PEOPLE = [
  // Board. Monish founds it and is President.
  { unit: "7",  name: "Monish Naidu",     email: OWNER,          role: "president", address: "1428 Mehr Meadows Lane" },
  { unit: "3",  name: "Dana Whitcomb",    email: plus("dana"),   role: "treasurer",      caps: ["finances", "vendors", "requests"] },
  { unit: "11", name: "Sofia Bergman",    email: plus("sofia"),  role: "secretary",      caps: ["communications", "documents", "voting", "requests"] },
  { unit: "5",  name: "Arya Mehr",        email: plus("arya"),   role: "vice-president", caps: ["requests", "compliance", "communications", "forum"] },
  // Owners with accounts.
  { unit: "12", name: "Owen Brady",       email: plus("owen") },
  { unit: "15", name: "Rhea Calloway",    email: plus("rhea") },
  { unit: "4",  name: "Nina Okafor",      email: plus("nina") },
  { unit: "8",  name: "Priya Ellison",    email: plus("priya") },
  { unit: "10", name: "Theo Lindqvist",   email: plus("theo") },
  { unit: "16", name: "Maya Castellanos", email: plus("maya") },
  { unit: "20", name: "Jules Fontaine",   email: plus("jules") },
  // On the register, not signed up: the invite flow needs somebody to invite.
  { unit: "1",  name: "Harold Finch",      email: "harold.finch@example.com" },
  { unit: "2",  name: "Grace Adeyemi",     email: "grace.adeyemi@example.com" },
  { unit: "6",  name: "Ben Ortiz",         email: "ben.ortiz@example.com" },
  { unit: "9",  name: "Lena Hartmann",     email: "lena.hartmann@example.com" },
  { unit: "13", name: "Sam Whitaker",      email: "sam.whitaker@example.com" },
  { unit: "14", name: "Chloe Nguyen",      email: "chloe.nguyen@example.com" },
  { unit: "17", name: "Derek Hall",        email: "derek.hall@example.com" },
  { unit: "18", name: "Elena Rossi",       email: "elena.rossi@example.com" },
  { unit: "19", name: "Sandhill Property Holdings LLC", email: "ops@sandhillholdings.example.com" },
  { unit: "21", name: "Farid Khan",        email: "farid.khan@example.com" },
  { unit: "22", name: "Gina Lee",          email: "gina.lee@example.com" },
  { unit: "23", name: "Hugo Brandt",       email: "hugo.brandt@example.com" },
  { unit: "24", name: "Isla Murphy",       email: "isla.murphy@example.com" },
];
const addressOf = (p) => p.address ?? `${1400 + Number(p.unit) * 2} Mehr Meadows Lane`;
const byUnit = Object.fromEntries(PEOPLE.map((p) => [p.unit, p]));

// Who is behind, and by how many months. Unit 9 pays by card.
const BEHIND = { "12": 1, "15": 2, "19": 3, "22": 4 };
const CARD = new Set(["9", "16"]);

/* ------------------------------------------------------------ cleanup */

const { data: previous } = await admin.from("associations").select("id, settings").eq("name", NAME);
for (const a of previous ?? []) {
  if (a.settings && a.settings.playground) {
    await admin.from("associations").delete().eq("id", a.id);
    console.log("removed the previous playground");
  }
}
const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
for (const u of users?.users ?? []) {
  if (u.email?.startsWith(MM)) await admin.auth.admin.deleteUser(u.id);
}

/* ------------------------------------------------------------ people */

async function makeUser(name, email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw new Error(`create ${email}: ${error.message}`);
  await admin.from("profiles").upsert({ id: data.user.id, full_name: name, email });
  return data.user.id;
}

// Monish signs in through a magic link minted here, so no password is needed
// and none is changed.
let ownerUser = (users?.users ?? []).find((u) => u.email === OWNER);
let ownerPasswordNote = "your existing password";
if (!ownerUser) {
  await makeUser("Monish Naidu", OWNER);
  ownerPasswordNote = `the seed password below (the account was created just now)`;
}
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: OWNER });
if (linkError) throw new Error(`magic link: ${linkError.message}`);
const me = anon();
const { error: otpError } = await me.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (otpError) throw new Error(`sign in as owner: ${otpError.message}`);

/* ---------------------------------------------------------- association */

const founder = PEOPLE[0];
const { data: associationId, error: foundError } = await me.rpc("create_association", {
  p_name: NAME, p_city: "Brier", p_state: "WA",
  p_dues_cents: DUES, p_dues_cadence: "monthly", p_due_day: 1,
  p_founder_name: founder.name, p_founder_unit: founder.unit, p_founder_address: addressOf(founder),
  p_households: PEOPLE.slice(1).map((p) => ({ name: p.name, email: p.email, unit: p.unit, address: addressOf(p) })),
  p_property_type: "single-family", p_origin: "existing", p_previously: "manager",
  p_collects: ["dues"], p_shared_spaces: ["clubhouse", "pool", "trail"],
});
if (foundError) throw new Error(`found: ${foundError.message}`);
const A = associationId;

const foundedOn = monthStart(13);
await admin.from("associations").update({
  created_at: ts(foundedOn, 9),
  trial_ends_at: ts(monthStart(10), 9),
  subscription_status: "active",
  setup_completed_at: ts(foundedOn, 15),
  fiscal_year_start: "01-01",
  insurance_carrier: "Evergreen Group",
  insurance_policy_no: "EG-4471-HOA",
  insurance_expires_on: days(104),
  photo_url: "https://yourhoasis.com/community/mehr-meadows.jpg",
  settings: { playground: true, displayName: NAME, residentHomeLayout: "calendar", residentsSeeFunds: true, forumEnabled: true },
}).eq("id", A).then(must("association"));

const { data: unitRows } = await admin.from("units").select("id, label").eq("association_id", A);
const unitId = Object.fromEntries(unitRows.map((u) => [u.label, u.id]));
await admin.from("units").update({ address: addressOf(founder) }).eq("id", unitId["7"]);

// Accounts, claiming seats; roles for the board.
const accounts = [{ name: founder.name, email: OWNER }];
const profileId = {};
for (const p of PEOPLE.slice(1)) {
  if (p.email.startsWith(MM)) {
    const id = await makeUser(p.name, p.email);
    profileId[p.unit] = id;
    accounts.push({ name: p.name, email: p.email });
    await admin.from("memberships").update({ profile_id: id }).eq("association_id", A).eq("unit_id", unitId[p.unit]);
  }
  if (p.role) {
    await admin.from("memberships").update({ role: p.role, capabilities: p.caps ?? [] }).eq("association_id", A).eq("unit_id", unitId[p.unit]).then(must(`role ${p.name}`));
  }
  await admin.from("memberships").update({ phone: `(425) 555-01${p.unit.padStart(2, "0")}`, starts_on: monthStart(13 + (Number(p.unit) % 30)) }).eq("association_id", A).eq("unit_id", unitId[p.unit]);
}

/* -------------------------------------------------------------- banks */

const { data: banks } = await admin.from("bank_accounts").insert([
  { association_id: A, kind: "operating", institution: "BECU", mask: "4417", verified_at: ts(foundedOn) },
  { association_id: A, kind: "reserve", institution: "BECU", mask: "8891", verified_at: ts(foundedOn) },
]).select("id, kind");
const operating = banks.find((b) => b.kind === "operating").id;
const reserve = banks.find((b) => b.kind === "reserve").id;

/* --------------------------------------------------------- dues, a year */

const months = Array.from({ length: 12 }, (_, i) => monthStart(11 - i)); // oldest first
for (const due of months) {
  await me.rpc("issue_assessment", { p_association_id: A, p_label: `${monthName(due)} dues`, p_due_on: due }).then(must(`assessment ${due}`));
}
const { data: chargeRows } = await admin.from("charges").select("id, unit_id, due_on").eq("association_id", A).eq("kind", "charge");

const payments = [], paymentCharges = [], allocations = [], ledger = [];
let paidCount = 0;
for (const p of PEOPLE) {
  const uid = unitId[p.unit];
  const behind = BEHIND[p.unit] ?? 0;
  const card = CARD.has(p.unit);
  months.forEach((due, i) => {
    const unpaid = i >= months.length - behind;
    if (unpaid) return;
    const charge = chargeRows.find((c) => c.unit_id === uid && c.due_on === due);
    if (!charge) return;
    const paidOn = (() => { const d = new Date(due + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1 + ((Number(p.unit) * 7 + i) % 9)); return iso(d); })();
    const paymentId = crypto.randomUUID();
    const fee = card ? Math.round(DUES * 0.029) + 30 : 0;
    payments.push({ id: paymentId, association_id: A, unit_id: uid, amount_cents: DUES, rail: card ? "card" : "ach", state: "settled", processor_fee_cents: fee, platform_fee_cents: 0, settled_at: ts(paidOn, 14), created_at: ts(paidOn, 14) });
    paymentCharges.push({ association_id: A, unit_id: uid, kind: "payment", category: "dues", label: card ? "Card payment" : "Bank payment", amount_cents: -DUES, due_on: paidOn, created_at: ts(paidOn, 14) });
    allocations.push({ payment_id: paymentId, charge_id: charge.id, amount_cents: DUES });
    ledger.push({ association_id: A, bank_account_id: operating, occurred_on: paidOn, description: `Assessment payment, unit ${p.unit}`, counterparty: p.name, category: "Assessments", amount_cents: DUES - fee, confirmed_at: ts(paidOn, 15), payment_id: paymentId, created_at: ts(paidOn, 14) });
    paidCount++;
  });
}
for (const [table, rows] of [["payments", payments], ["charges", paymentCharges], ["payment_allocations", allocations], ["ledger_entries", ledger]]) {
  for (let i = 0; i < rows.length; i += 200) {
    await admin.from(table).insert(rows.slice(i, i + 200)).then(must(table));
  }
}
// Late fees for anyone two or more months behind.
await admin.from("charges").insert(
  Object.entries(BEHIND).filter(([, n]) => n >= 2).map(([unit]) => ({
    association_id: A, unit_id: unitId[unit], kind: "charge", category: "late_fee", label: "Late fee", amount_cents: 2_500, due_on: monthStart(0), created_at: ts(monthStart(0), 9),
  })),
).then(must("late fees"));

/* ------------------------------------------------------- the ledger */

const VENDORS = [
  { name: "Cascade Grounds Co.", service: "Landscaping", default_category: "landscaping", ach_enabled: true, w9_on_file: true, coi_expires_on: days(212) },
  { name: "Northsound Pool Service", service: "Pool maintenance", default_category: "amenities", ach_enabled: true, w9_on_file: true, coi_expires_on: days(26) },
  { name: "Evergreen Group", service: "Insurance", default_category: "insurance", ach_enabled: false, w9_on_file: true, coi_expires_on: null },
  { name: "Puget Sound Energy", service: "Electricity, common areas", default_category: "utilities", ach_enabled: true, w9_on_file: false, coi_expires_on: null },
  { name: "Harbor Roofing", service: "Roofing", default_category: "repairs", ach_enabled: false, w9_on_file: true, coi_expires_on: days(-12) },
  { name: "Lindgren & Park LLP", service: "Association counsel", default_category: "legal", ach_enabled: false, w9_on_file: true, coi_expires_on: null },
];
const { data: vendorRows } = await admin.from("vendors").insert(VENDORS.map((v) => ({ association_id: A, ...v }))).select("id, name");
const vendorId = Object.fromEntries(vendorRows.map((v) => [v.name, v.id]));

const expense = (occurred_on, description, counterparty, category, amount_cents, extra = {}) => ({
  association_id: A, bank_account_id: operating, occurred_on, description, counterparty, category, amount_cents: -amount_cents, confirmed_at: ts(occurred_on, 16), created_at: ts(occurred_on, 12), ...extra,
});
const spend = [];
months.forEach((m, i) => {
  const d = (n) => { const x = new Date(m + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
  spend.push(expense(d(4), "Monthly grounds contract", "Cascade Grounds Co.", "Landscaping", 185_000));
  spend.push(expense(d(9), "Common area electricity", "Puget Sound Energy", "Utilities", 58_000 + (i % 4) * 4_100));
  spend.push(expense(d(12), "Pool service and chemicals", "Northsound Pool Service", "Repairs & maintenance", 74_000));
  spend.push(expense(d(15), "Master policy, monthly installment", "Evergreen Group", "Insurance", 112_000));
  spend.push(expense(d(20), "Transfer to reserve account", "Reserve account", "Reserve transfer", 300_000));
  // The other half of the same transfer: without it the reserve account never grew.
  spend.push({ association_id: A, bank_account_id: reserve, occurred_on: d(20), description: "Transfer from operating account", counterparty: "Operating account", category: "Reserve transfer", amount_cents: 300_000, confirmed_at: ts(d(20), 16), created_at: ts(d(20), 12) });
  spend.push({ association_id: A, bank_account_id: reserve, occurred_on: d(27), description: "Interest, money market", counterparty: "BECU", category: "Interest income", amount_cents: 4_180 + i * 35, confirmed_at: ts(d(27)), created_at: ts(d(27)) });
  if (i % 3 === 2) spend.push(expense(d(18), "Retainer and covenant review", "Lindgren & Park LLP", "Legal & professional", 35_000));
});
spend.push(expense(monthStart(4).replace(/-01$/, "-14"), "Replace pool pump and filter housing", "Northsound Pool Service", "Repairs & maintenance", 230_000));
spend.push(expense(monthStart(2).replace(/-01$/, "-06"), "Storm drain clearing, Maple Lane", "Cascade Grounds Co.", "Repairs & maintenance", 48_000));
// Three recent lines the feed has not confirmed yet: the dashboard's "to confirm".
spend.push({ ...expense(days(-3), "CASCADE GROUNDS CO 4417", "Cascade Grounds Co.", "Landscaping", 185_000), confirmed_at: null });
spend.push({ ...expense(days(-2), "PSE ONLINE PMT", "Puget Sound Energy", "Utilities", 61_400), confirmed_at: null });
spend.push({ ...expense(days(-1), "HARBOR ROOFING DEPOSIT", "Harbor Roofing", "Repairs & maintenance", 420_000), confirmed_at: null });
// What each account held the day these books start, so a year of a budget
// that spends a little more than it bills does not read as an overdrawn account
// and the reserve account holds what the components say is set aside.
const booksStart = (() => { const x = new Date(months[0] + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return iso(x); })();
spend.push({ association_id: A, bank_account_id: operating, occurred_on: booksStart, description: "Opening balance", counterparty: "BECU", category: "Opening balance", amount_cents: 2_400_000, confirmed_at: ts(booksStart), created_at: ts(booksStart) });
spend.push({ association_id: A, bank_account_id: reserve, occurred_on: booksStart, description: "Opening balance", counterparty: "BECU", category: "Opening balance", amount_cents: 13_500_000, confirmed_at: ts(booksStart), created_at: ts(booksStart) });
// Nothing on the books after today: the current month's interest has not been paid yet.
const booked = spend.filter((e) => e.occurred_on <= days(0));
await admin.from("ledger_entries").insert(booked).then(must("ledger"));

await admin.from("budget_lines").insert([
  ["Assessments", "income", DUES * PEOPLE.length * 12],
  ["Late fees", "income", 60_000],
  ["Interest income", "income", 55_000],
  ["Landscaping", "expense", 2_220_000],
  ["Utilities", "expense", 780_000],
  ["Insurance", "expense", 1_344_000],
  ["Repairs & maintenance", "expense", 1_200_000],
  ["Legal & professional", "expense", 150_000],
  ["Reserve transfer", "expense", 3_600_000],
].map(([category, kind, annual_cents], position) => ({ association_id: A, category, kind, annual_cents, position }))).then(must("budget"));

await admin.from("reserve_components").insert([
  ["Clubhouse roof", 25, 4, 8_600_000, 5_100_000, "Two quotes in hand. Harbor Roofing's deposit is on the books."],
  ["Pool resurfacing", 12, 1, 4_200_000, 3_900_000, "Awarded at the special meeting; work starts in the spring."],
  ["Asphalt overlay, Mehr Meadows Lane", 20, 7, 12_500_000, 4_800_000, null],
  ["Perimeter fence and gates", 18, 6, 3_100_000, 1_650_000, null],
  ["Playground equipment", 15, 9, 1_800_000, 700_000, "Inspected annually by the insurer."],
  ["Clubhouse HVAC", 15, 3, 1_400_000, 900_000, null],
].map(([name, useful_life_years, remaining_life_years, replacement_cost_cents, funded_cents, note]) => ({ association_id: A, name, useful_life_years, remaining_life_years, replacement_cost_cents, funded_cents, note, last_inspection: monthStart(5) }))).then(must("reserves"));

await admin.from("payouts").insert([
  { association_id: A, vendor_id: vendorId["Cascade Grounds Co."], vendor_name: "Cascade Grounds Co.", invoice_number: "CG-2026-0912", amount_cents: 185_000, method: "ach", status: "needs-approval", issued_on: days(-5), expected_on: days(9), approvals: [], approvals_required: 2 },
  { association_id: A, vendor_id: vendorId["Harbor Roofing"], vendor_name: "Harbor Roofing", invoice_number: "HR-4471", amount_cents: 420_000, method: "check", status: "approved", issued_on: days(-9), expected_on: days(3), approvals: [{ name: "Dana Whitcomb", at: days(-4) }, { name: "Monish Naidu", at: days(-3) }], approvals_required: 2 },
  { association_id: A, vendor_id: vendorId["Northsound Pool Service"], vendor_name: "Northsound Pool Service", invoice_number: "NP-2288", amount_cents: 74_000, method: "ach", status: "paid", issued_on: days(-33), expected_on: days(-19), approvals: [{ name: "Dana Whitcomb", at: days(-30) }, { name: "Monish Naidu", at: days(-29) }], approvals_required: 2 },
]).then(must("payouts"));

/* ---------------------------------------------------------- documents */

await admin.from("documents").insert([
  ["Declaration of Covenants, Conditions & Restrictions", "Governing", "public", "2.4 MB", "2024-03-18"],
  ["Bylaws", "Governing", "public", "880 KB", "2024-03-18"],
  ["Articles of Incorporation", "Governing", "public", "310 KB", "2016-01-04"],
  ["Rules & Regulations", "Governing", "public", "540 KB", `${now.getUTCFullYear()}-01-15`],
  [`${now.getUTCFullYear()} Budget`, "Financial", "public", "196 KB", `${now.getUTCFullYear() - 1}-10-22`],
  [`${now.getUTCFullYear() - 1} Financial Statements`, "Financial", "owners", "1.1 MB", `${now.getUTCFullYear()}-03-24`],
  ["Reserve Study", "Financial", "owners", "3.6 MB", `${now.getUTCFullYear() - 1}-03-11`],
  [`Board Meeting Minutes, ${monthName(monthStart(1))}`, "Meetings", "public", "142 KB", monthStart(1).replace(/-01$/, "-22")],
  ["Certificate of Insurance", "Insurance", "owners", "420 KB", `${now.getUTCFullYear()}-01-02`],
].map(([name, category, visibility, size_label, updated_on]) => ({ association_id: A, name, category, visibility, size_label, updated_on }))).then(must("documents"));

/* ------------------------------------------------- announcements, meetings */

await admin.from("announcements").insert([
  { association_id: A, author_name: "Monish Naidu, Board President", category: "Maintenance", title: "Pool resurfacing begins next month", body: "The pool and deck close for resurfacing on the first Monday of next month and reopen about two weeks later, weather permitting. The spa stays open the entire time. Gate codes are unchanged.", pinned: true, posted_on: days(-2) },
  { association_id: A, author_name: "Dana Whitcomb, Treasurer", category: "Governance", title: `Budget workshop, ${new Date(days(14) + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })} at 6:30pm`, body: "Open to all owners. We will walk through the draft budget for next year and the reserve contribution, and take questions before the board votes.", pinned: false, posted_on: days(-5) },
  { association_id: A, author_name: "Mehr Meadows Board", category: "Notice", title: "Windstorm season: clear your deck before the first big one", body: "When a wind advisory goes up, stow patio furniture, planters and grills. Anything left out tends to end up in a neighbor's yard.", pinned: false, posted_on: days(-9) },
  { association_id: A, author_name: "Sofia Bergman, Secretary", category: "Event", title: "Fall cookout at the clubhouse", body: "Saturday at 4pm on the clubhouse lawn. The board brings the grill; bring a side. The forum poll picks the date.", pinned: false, posted_on: days(-12) },
]).then(must("announcements"));

const { data: meetingRows } = await admin.from("meetings").insert([
  { association_id: A, title: "Board meeting", kind: "board", status: "ended", held_on: monthStart(1).replace(/-01$/, "-15"), held_at: "19:00", location: "Clubhouse", agenda: ["Approve July minutes", "Treasurer's report", "Pool resurfacing bids", "Storm drain on Maple Lane", "Open forum"], rsvps: [], notice_sent_on: monthStart(1) },
  { association_id: A, title: "Budget workshop", kind: "workshop", status: "scheduled", held_on: days(14), held_at: "18:30", location: "Clubhouse", dial_in: "https://meet.jit.si/mehr-meadows-budget", passcode: "meadows", agenda: ["Draft operating budget", "Reserve contribution", "Questions from owners"], rsvps: [
    // The shape rsvp_meeting writes (0029), so the board count and each owner's own answer read them.
    { profileId: profileId["12"], name: "Owen Brady", unit: "12", response: "yes", at: days(-3) },
    { profileId: profileId["4"], name: "Nina Okafor", unit: "4", response: "yes", at: days(-2) },
    { profileId: profileId["15"], name: "Rhea Calloway", unit: "15", response: "no", at: days(-2) },
  ], notice_sent_on: days(-5) },
  { association_id: A, title: "Annual meeting and board election", kind: "annual", status: "scheduled", held_on: days(61), held_at: "19:00", location: "Clubhouse and video call", dial_in: "https://meet.jit.si/mehr-meadows-annual", passcode: "meadows", agenda: ["Year in review", "Election of two directors", "Ratify the budget", "Open forum"], rsvps: [] },
]).select("id, title");
const meetingId = Object.fromEntries(meetingRows.map((m) => [m.title, m.id]));

await admin.from("action_items").insert([
  { association_id: A, title: "Get two quotes for the clubhouse roof", owner_name: "Dana Whitcomb", meeting_id: meetingId["Board meeting"], due_on: days(-9), done_on: days(-11) },
  { association_id: A, title: "Call the city about the Maple Lane storm drain", owner_name: "Monish Naidu", meeting_id: meetingId["Board meeting"], due_on: days(-6), done_on: null },
  { association_id: A, title: "Send the solar amendment to counsel for the recording", owner_name: "Sofia Bergman", meeting_id: meetingId["Board meeting"], due_on: days(12), done_on: null },
  { association_id: A, title: "Post the budget workshop notice on the mailboxes", owner_name: "Arya Mehr", meeting_id: null, due_on: days(4), done_on: null },
]).then(must("action items"));

/* ------------------------------------------------------------- ballots */

const { data: ballotRows } = await admin.from("ballots").insert([
  { association_id: A, title: "Amend CC&Rs Article VII to permit rooftop solar", kind: "amendment", audience: "owners", status: "open", opens_on: days(-10), closes_on: days(9), quorum_required: 13, seats: 1, threshold_label: "Two-thirds of all homes", live_results_visible: true, meeting_id: null,
    body: ["Article VII currently requires Architectural Review Committee approval for any roof-mounted equipment and gives no standard for solar panels, so every application is decided from scratch.", "The amendment adds a section stating that roof-mounted solar panels are permitted without a variance when they lie flat against the roof plane, do not extend past the eaves, and use a frame color that matches the roof.", "Panels on street-facing roof planes still need a submission, but the committee may only condition placement, not refuse the installation."] },
  { association_id: A, title: `Ratify the ${now.getUTCFullYear()} operating budget`, kind: "budget", audience: "owners", status: "certified", opens_on: `${now.getUTCFullYear() - 1}-11-01`, closes_on: `${now.getUTCFullYear() - 1}-11-20`, quorum_required: 13, seats: 1, threshold_label: "Majority of votes cast", live_results_visible: false, certified_by: "Sofia Bergman, Secretary", certified_on: `${now.getUTCFullYear() - 1}-11-21`, meeting_id: null,
    body: ["The board adopted a budget of $82,080 in assessments, holding dues at $285 a month, with $36,000 to reserves.", "Under the bylaws the budget stands unless a majority of all homes rejects it."] },
]).select("id, title");
const solar = ballotRows.find((b) => b.kind !== "budget" && b.title.includes("solar")).id;
const budgetBallot = ballotRows.find((b) => b.title.startsWith("Ratify")).id;
const { data: optionRows } = await admin.from("ballot_options").insert([
  { ballot_id: solar, label: "For the amendment", detail: "Adopt the new solar section as written.", position: 0 },
  { ballot_id: solar, label: "Against", detail: "Keep Article VII as it is.", position: 1 },
  { ballot_id: budgetBallot, label: "Ratify", detail: null, position: 0 },
  { ballot_id: budgetBallot, label: "Reject", detail: null, position: 1 },
]).select("id, ballot_id, label");
const opt = (ballot, label) => optionRows.find((o) => o.ballot_id === ballot && o.label === label).id;
const receipt = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const votes = [];
["3", "11", "5", "12", "4", "8", "10", "16", "20"].forEach((u, i) => votes.push({ ballot_id: solar, unit_id: unitId[u], option_id: opt(solar, i < 7 ? "For the amendment" : "Against"), receipt: receipt(), cast_at: ts(days(-9 + i)) }));
PEOPLE.slice(0, 18).forEach((p, i) => votes.push({ ballot_id: budgetBallot, unit_id: unitId[p.unit], option_id: opt(budgetBallot, i < 16 ? "Ratify" : "Reject"), receipt: receipt(), cast_at: ts(`${now.getUTCFullYear() - 1}-11-${String(3 + (i % 15)).padStart(2, "0")}`) }));
await admin.from("votes").insert(votes).then(must("votes"));

/* --------------------------------------------------------------- forum */

const { data: postRows } = await admin.from("posts").insert([
  { association_id: A, author_name: "Nina Okafor", unit_label: "4", category: "Recommendations", title: "Anyone have a gutter cleaner they actually like?", body: "Ours no-showed twice. Looking for someone who will do the whole street the same week so we can split the trip charge.", status: "published", pinned: false, likes: 6, created_at: ts(days(-3)) },
  { association_id: A, author_name: "Sofia Bergman", author_role: "Secretary", unit_label: "11", category: "Events", title: "Fall cookout: which Saturday?", body: "Two options: the last Saturday of this month or the first of next. Reply with one and we will book the clubhouse lawn.", status: "published", pinned: true, likes: 11, created_at: ts(days(-6)) },
  { association_id: A, author_name: "Theo Lindqvist", unit_label: "10", category: "Lost and found", title: "Found: grey cat with a blue collar near the mailboxes", body: "Very friendly, no tag. She is in our garage with water until someone claims her.", status: "published", pinned: false, likes: 9, created_at: ts(days(-7)) },
  { association_id: A, author_name: "Maya Castellanos", unit_label: "16", category: "For sale", title: "Free: two Adirondack chairs, need a light sanding", body: "On the curb at 1432 until Sunday.", status: "published", pinned: false, likes: 2, created_at: ts(days(-11)) },
  { association_id: A, author_name: "Owen Brady", unit_label: "12", category: "Safety", title: "Car doors tried overnight on the lane", body: "Doorbell camera caught someone checking handles around 2am. Nothing taken, but lock up.", status: "published", pinned: false, likes: 14, created_at: ts(days(-14)) },
  { association_id: A, author_name: "Jules Fontaine", unit_label: "20", category: "Recommendations", title: "Selling my extra kayak, $250", body: "Ten foot sit-on-top, paddle included. Message me here.", status: "pending", pinned: false, likes: 0, created_at: ts(days(-1)) },
]).select("id, title");
const postId = (t) => postRows.find((p) => p.title.startsWith(t)).id;
await admin.from("post_replies").insert([
  { association_id: A, post_id: postId("Anyone have a gutter"), author_name: "Priya Ellison", unit_label: "8", body: "Ridgeline Gutter, ask for Sam. They did four houses on our side in one morning last fall.", created_at: ts(days(-2)) },
  { association_id: A, post_id: postId("Fall cookout"), author_name: "Owen Brady", unit_label: "12", body: "First of next month. The last Saturday is the Huskies game.", created_at: ts(days(-5)) },
  { association_id: A, post_id: postId("Found: grey cat"), author_name: "Rhea Calloway", unit_label: "15", body: "That is Pickles from unit 18. Elena is away until Thursday, I will text her.", created_at: ts(days(-7), 18) },
]).then(must("replies"));

/* ---------------------------------------------------------- violations */

const { data: reportRows } = await admin.from("violation_reports").insert([
  { association_id: A, reference: "REP-2026-018", reporter_name: "Owen Brady", reporter_unit: "12", subject_unit: "19", subject_unit_id: unitId["19"], what: "Box truck with contractor lettering parked in the driveway overnight, three nights running.", observed_on: days(-46), submitted_on: days(-45), status: "verified", verified_by: "Arya Mehr", verified_on: days(-44), verification_note: "Photographed from the sidewalk on two consecutive mornings." },
  { association_id: A, reference: "REP-2026-021", reporter_name: "Nina Okafor", reporter_unit: "4", subject_unit: "21", subject_unit_id: unitId["21"], what: "Trailer parked on the street in front of the house for over a week.", observed_on: days(-2), submitted_on: days(-1), status: "pending" },
]).select("id, reference");
const reportId = (r) => reportRows.find((x) => x.reference === r).id;
const photo = (id, brief, takenOn) => ({ id, brief, takenOn, takenBy: "Arya Mehr, Vice President", vantage: "street" });
await admin.from("violations").insert([
  { association_id: A, reference: "VIO-2026-041", unit_id: unitId["19"], unit_label: "19", owner_name: byUnit["19"].name, rule: "Commercial vehicle parked overnight in driveway", rule_citation: "CC&Rs Art. IX §2(b)", stage: "first-notice", source: "neighbor", report_id: reportId("REP-2026-018"), opened_on: days(-44), next_action_on: days(-23), fine_cents: 0, photos: [photo("v1-p1", "A box truck with contractor lettering on the driveway apron, taken at 6:40am from the public sidewalk.", days(-46)), photo("v1-p2", "The same truck in the same position the following morning.", days(-45))] },
  { association_id: A, reference: "VIO-2026-039", unit_id: unitId["15"], unit_label: "15", owner_name: byUnit["15"].name, rule: "Trash receptacles visible from the street", rule_citation: "Rules §4.2", stage: "courtesy", source: "board", opened_on: days(-8), next_action_on: days(6), fine_cents: 0, photos: [photo("v2-p1", "Two bins at the side of the garage, visible from the street on a non-collection day.", days(-8))] },
  { association_id: A, reference: "VIO-2026-037", unit_id: unitId["23"], unit_label: "23", owner_name: byUnit["23"].name, rule: "Unapproved exterior paint color", rule_citation: "CC&Rs Art. VII §1", stage: "hearing", source: "board", opened_on: days(-70), next_action_on: days(5), fine_cents: 10_000, photos: [photo("v3-p1", "Front elevation painted a dark green not on the approved palette.", days(-70))] },
  { association_id: A, reference: "VIO-2026-033", unit_id: unitId["6"], unit_label: "6", owner_name: byUnit["6"].name, rule: "Lawn not maintained", rule_citation: "Rules §3.1", stage: "resolved", source: "board", opened_on: days(-90), next_action_on: days(-60), resolved_on: days(-62), owner_fixed_on: days(-64), owner_fixed_note: "Mowed and edged; the sprinkler timer was the problem.", fine_cents: 0, photos: [] },
]).then(must("violations"));

/* ------------------------------------------------------------ requests */

const event = (id, at, actor, actorRole, body, kind = "note") => ({ id, at, actor, actorRole, body, kind });
await admin.from("requests").insert([
  { association_id: A, unit_id: unitId["12"], reference: "REQ-2026-121", kind: "maintenance", title: "Streetlight out at the trail entrance", body: "The light at the north trailhead has been out for a week. It is the only light on that stretch.", status: "submitted", submitted_on: days(-1), attachments: [], thread: [event("e1", days(-1), "Owen Brady", "resident", "Reported from the trail this morning.")] },
  { association_id: A, unit_id: unitId["4"], reference: "REQ-2026-120", kind: "architectural", title: "Pergola over the rear patio, 12 by 14 feet", body: "Cedar pergola, unstained, matching the one at unit 8. Plans and the contractor's drawing attached.", status: "in-review", submitted_on: days(-9), due_on: days(21), due_reason: "CC&Rs Art. VII §3: ARC must respond within 30 days", attachments: [{ name: "pergola-drawing.pdf", size: "640 KB" }], thread: [event("e1", days(-9), "Nina Okafor", "resident", "Submitted with the drawing."), event("e2", days(-8), "Your HOAsis", "system", `Routed to the Architectural Review Committee. 30-day response clock expires ${days(21)}.`, "status"), event("e3", days(-4), "Sofia Bergman", "board", "Committee has it. One question: will it be attached to the house or freestanding?")] },
  { association_id: A, unit_id: unitId["7"], reference: "REQ-2026-118", kind: "architectural", title: "Replace rear fence with 6' vinyl privacy fence", body: "Existing wood fence is rotting at three posts. Requesting approval to replace with white vinyl matching units 4 and 8, same footprint and height.", status: "approved", submitted_on: days(-53), due_on: days(-23), due_reason: "CC&Rs Art. VII §3: ARC must respond within 30 days", decided_on: days(-38), decided_by: "Architectural Review Committee", certificate_id: "ARC-2026-118-A7F3", attachments: [{ name: "fence-quote.pdf", size: "412 KB" }, { name: "property-survey.pdf", size: "1.8 MB" }], thread: [event("e1", days(-53), "Monish Naidu", "resident", "Submitted with contractor quote and survey."), event("e2", days(-46), "Sofia Bergman", "board", "Committee reviewed. Will the gate stay on the north side?"), event("e3", days(-45), "Monish Naidu", "resident", "Yes, same location and swing."), event("e4", days(-38), "Architectural Review Committee", "board", "Approved as submitted. Certificate ARC-2026-118-A7F3 issued.", "status")] },
  { association_id: A, unit_id: unitId["15"], reference: "REQ-2026-116", kind: "records", title: "Copy of the reserve study and last two years of financial statements", body: "For a refinance. The lender's checklist is attached.", status: "closed", submitted_on: days(-30), due_on: days(-20), due_reason: "RCW 64.38.045: records within 10 business days", decided_on: days(-24), decided_by: "Dana Whitcomb", attachments: [{ name: "lender-checklist.pdf", size: "90 KB" }], thread: [event("e1", days(-30), "Rhea Calloway", "resident", "Lender needs these by the end of the month."), event("e2", days(-24), "Dana Whitcomb", "board", "Sent all three as PDFs. They are also under Documents.", "status")] },
  { association_id: A, unit_id: unitId["8"], reference: "REQ-2026-119", kind: "amenity", title: "Clubhouse, Saturday 2 to 6pm, birthday party", body: "About twenty people. We will clean up and take the trash to the dumpster.", status: "approved", submitted_on: days(-12), decided_on: days(-11), decided_by: "Arya Mehr", attachments: [], thread: [event("e1", days(-12), "Priya Ellison", "resident", "Requested the afternoon slot."), event("e2", days(-11), "Arya Mehr", "board", "Booked. Code for the side door is on your account page.", "status")] },
  { association_id: A, unit_id: unitId["10"], reference: "REQ-2026-117", kind: "maintenance", title: "Sinkhole forming beside the sidewalk at 1420", body: "About a foot across, getting deeper after rain.", status: "info-needed", submitted_on: days(-18), attachments: [], thread: [event("e1", days(-18), "Theo Lindqvist", "resident", "Noticed after last week's storm."), event("e2", days(-15), "Monish Naidu", "board", "Is it on the common strip or inside your property line? A photo with the sidewalk in frame would settle it.", "status")] },
]).then(must("requests"));

/* ------------------------------------------------------------ messages */

await admin.from("threads").insert([
  { association_id: A, unit_id: unitId["12"], subject: "Question about the pool closure", participants: ["Owen Brady", "Monish Naidu"], tag: "Maintenance", unread: true, updated_on: days(-1), messages: [
    { id: "m1", at: days(-2), from: "Mehr Meadows Board", fromRole: "board", direction: "outbound", channel: "email", body: "The pool and deck close for resurfacing next month and reopen about two weeks later. The spa stays open throughout." },
    { id: "m2", at: days(-1), from: "Owen Brady", fromRole: "resident", direction: "inbound", channel: "email", body: "Does that include the kiddie pool? My grandkids visit that week." },
  ] },
  { association_id: A, unit_id: unitId["15"], subject: "Past due notice, unit 15", participants: ["Rhea Calloway", "Dana Whitcomb"], tag: "Billing", unread: true, updated_on: days(-3), messages: [
    { id: "m1", at: days(-6), from: "Dana Whitcomb", fromRole: "board", direction: "outbound", channel: "email", body: "Unit 15 carries a balance of two months' dues plus a late fee. If a payment is on its way, reply here and we will note it." },
    { id: "m2", at: days(-3), from: "Rhea Calloway", fromRole: "resident", direction: "inbound", channel: "email", body: "Refinance closes on the 30th. Can the late fee be waived if I pay everything then?" },
  ] },
  { association_id: A, unit_id: unitId["23"], subject: "Hearing notice, exterior paint", participants: ["Hugo Brandt", "Arya Mehr"], tag: "Compliance", unread: false, updated_on: days(-20), messages: [
    { id: "m1", at: days(-20), from: "Arya Mehr", fromRole: "board", direction: "outbound", channel: "mail", body: "A hearing on the exterior paint at unit 23 is set for the next board meeting. You may attend and speak." },
  ] },
]).then(must("threads"));

/* ---------------------------------------------------- amenities, join */

await admin.from("amenities").insert([
  { association_id: A, name: "Clubhouse", detail: "Seats 40. Kitchen and side door with a code.", reservable: true, status: "open", max_hours: 4, rules: null },
  { association_id: A, name: "Pool", detail: "Closes for resurfacing next month.", reservable: false, status: "open", max_hours: null, rules: null },
  { association_id: A, name: "Tennis court", detail: "First come, first served. Lights off at 9pm.", reservable: true, status: "open", max_hours: 2, rules: null },
]).then(must("amenities"));

await admin.from("join_requests").insert({ association_id: A, full_name: "Casey Morgan", email: "casey.morgan@example.com", unit_label: "1450 Mehr Meadows Lane", note: "We closed on the 14th. The seller said to ask here.", status: "pending", created_at: ts(days(-1), 8) }).then(must("join request"));

/* ------------------------------------------------------------- report */

const { data: assoc } = await admin.from("associations").select("join_code").eq("id", A).single();
// The view answers by capability, so ask as the President rather than as nobody.
const { data: balances } = await me.from("unit_balances").select("*").eq("association_id", A);
const owed = (balances ?? []).filter((b) => (b.balance_cents ?? 0) > 0);

console.log(`
${NAME}  ${A}
  join code ${assoc.join_code}
  ${PEOPLE.length} homes, ${paidCount} payments over 12 months, ${owed.length} homes behind
  ${VENDORS.length} vendors, 3 invoices, ${spend.length} ledger lines (3 to confirm), 9 documents, 3 meetings, 2 ballots, 6 posts, 4 violations, 6 requests

Sign in as (password: ${PASSWORD}):
  ${accounts.slice(1).map((a) => `${a.name} <${a.email}>`).join("\n  ")}

You are President as ${OWNER} with ${ownerPasswordNote}.
Not signed up yet (invite them from Homeowners): ${PEOPLE.filter((p) => !accounts.some((a) => a.email === p.email)).map((p) => p.name).join(", ")}
`);
