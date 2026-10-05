/**
 * Empties the project and seeds two associations that cannot see each other.
 *
 *   pnpm db:seed                      # wipes, then seeds
 *   SEED_PASSWORD=... pnpm db:seed    # same, with a password you choose
 *
 * Everything goes: associations (cascading to every table under them),
 * accounts, uploaded files. Then two associations are founded through the
 * same create_association RPC the wizard calls, each by its own President,
 * with residents who have real (plus-addressed) accounts so anyone can sign
 * in as any of them. One shared password, printed at the end.
 *
 * Two associations rather than one because the thing worth proving is the
 * wall between them, and one association has no wall to prove.
 *
 * Refuses to run unless every lock /api/dev/reset has is open, for the same
 * reason: this deletes other people's data. The rules live in
 * src/app/api/dev/guard.ts and are repeated here because a script cannot
 * import that file. Change one, change the other.
 *
 *   1. ALLOW_TEST_RESET=true in .env.local.
 *   2. TEST_RESET_PROJECT_REF, in .env.local or on the command line, names
 *      the Supabase project NEXT_PUBLIC_SUPABASE_URL points at. .env.local
 *      has pointed at the only project there is; naming it is a person
 *      saying "this one is safe to empty".
 *   3. No association in the project has a subscription or online payments
 *      switched on. Checked against the database before anything is deleted.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
    }),
);

if (env.ALLOW_TEST_RESET !== "true") {
  console.error("Refusing: ALLOW_TEST_RESET is not true in .env.local.");
  process.exit(1);
}

/** "abcd" for https://abcd.supabase.co; the host name for anything else. */
function projectRef(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host) return null;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : host;
  } catch {
    return null;
  }
}

const namedRef = (process.env.TEST_RESET_PROJECT_REF ?? env.TEST_RESET_PROJECT_REF ?? "").trim().toLowerCase();
const actualRef = projectRef(env.NEXT_PUBLIC_SUPABASE_URL);
if (!namedRef) {
  console.error(
    "Refusing: TEST_RESET_PROJECT_REF is not set. It must name the Supabase project this script may empty.",
  );
  process.exit(1);
}
if (!actualRef || namedRef !== actualRef) {
  console.error(
    "Refusing: TEST_RESET_PROJECT_REF does not name the project in NEXT_PUBLIC_SUPABASE_URL. Nothing was touched.",
  );
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

const PASSWORD =
  process.env.SEED_PASSWORD ?? `Expresshoa-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8)}`;

const OWNER = "monishnaidu18@gmail.com";
const plus = (tag) => OWNER.replace("@", `+${tag}@`);
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const today = iso(new Date());

/* ------------------------------------------------------------------ wipe */

/** Rows an association did not own, in child-before-parent order. */
const ORPHAN_TABLES = [
  "payment_allocations", "payments", "ledger_entries", "charges", "bank_accounts",
  "votes", "ballot_options", "ballots", "meetings", "requests", "documents", "posts",
  "announcements", "vendors", "amenities", "email_log", "email_optouts",
  "setup_dismissals", "memberships", "units",
];

/**
 * The last lock, and the only one that looks at the data. One association
 * with a subscription or online payments switched on means this is not a
 * project with nothing to lose. A check that cannot be made is a refusal.
 */
async function refuseNextToLiveData() {
  const { data, error } = await admin
    .from("associations")
    .select("name")
    .or("billing_subscription_id.not.is.null,stripe_charges_enabled.eq.true")
    .limit(1);
  if (error) {
    console.error(`Refusing: could not check for live associations (${error.message}). Nothing was touched.`);
    process.exit(1);
  }
  if (data && data.length > 0) {
    console.error(
      `Refusing: this project holds an association with a subscription or online payments switched on (${data[0].name}). Nothing was touched.`,
    );
    process.exit(1);
  }
}

async function wipe() {
  // First, always: nothing below this line can be undone.
  await refuseNextToLiveData();
  const { data: associations } = await admin.from("associations").select("id, name");
  for (const a of associations ?? []) {
    const { error } = await admin.from("associations").delete().eq("id", a.id);
    if (error) throw new Error(`delete ${a.name}: ${error.message}`);
  }
  for (const table of ORPHAN_TABLES) {
    await admin.from(table).delete().not("id", "is", null);
  }
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of users?.users ?? []) {
    await admin.auth.admin.deleteUser(user.id);
  }
  await admin.from("profiles").delete().not("id", "is", null);
  for (const bucket of ["community", "documents"]) {
    const { data: folders } = await admin.storage.from(bucket).list();
    for (const folder of folders ?? []) {
      const { data: files } = await admin.storage.from(bucket).list(folder.name);
      if (files?.length) {
        await admin.storage.from(bucket).remove(files.map((f) => `${folder.name}/${f.name}`));
      }
    }
  }
  return { associations: (associations ?? []).length, users: (users?.users ?? []).length };
}

/* ------------------------------------------------------------------ seed */

async function makeUser(name, email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw new Error(`create ${email}: ${error.message}`);
  // The signup trigger writes the profile; make sure of it either way.
  await admin.from("profiles").upsert({ id: data.user.id, full_name: name, email });
  return { id: data.user.id, email, name };
}

async function signedIn(email) {
  const client = anon();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return client;
}

/**
 * One association, founded the way the wizard founds it, then filled in.
 *
 * `people` is the roster: the first is the founder and President. Everyone
 * with an email gets an account and claims their seat, so the invited_email
 * memberships the RPC wrote become real memberships.
 */
async function found(spec) {
  const [founder, ...rest] = spec.people;
  const president = await makeUser(founder.name, founder.email);
  const client = await signedIn(president.email);

  const { data: associationId, error } = await client.rpc("create_association", {
    p_name: spec.name,
    p_city: spec.city,
    p_state: spec.state,
    p_dues_cents: spec.duesCents,
    p_dues_cadence: "monthly",
    p_due_day: 1,
    p_founder_name: founder.name,
    p_founder_unit: founder.unit,
    p_founder_address: founder.address ?? null,
    p_households: rest.map((p) => ({ name: p.name, email: p.email ?? null, unit: p.unit })),
    p_property_type: spec.propertyType,
    p_origin: spec.origin,
    p_collects: spec.collects ?? [],
    p_shared_spaces: spec.sharedSpaces ?? [],
    p_previously: spec.previously ?? null,
  });
  if (error) throw new Error(`found ${spec.name}: ${error.message}`);

  // Accounts for everyone else, claiming the seats the RPC reserved.
  const accounts = [president];
  for (const p of rest) {
    if (!p.email) continue;
    const user = await makeUser(p.name, p.email);
    accounts.push(user);
    await admin
      .from("memberships")
      .update({ profile_id: user.id, invited_email: null })
      .eq("association_id", associationId)
      .eq("invited_email", p.email);
    if (p.role) {
      await admin
        .from("memberships")
        .update({ role: p.role, capabilities: p.capabilities ?? [] })
        .eq("association_id", associationId)
        .eq("profile_id", user.id);
    }
  }

  // Unsold lots exist as homes with nobody in them yet.
  for (const label of spec.emptyUnits ?? []) {
    await admin.from("units").insert({ association_id: associationId, label });
  }

  // Founding date and the trial that follows from it.
  const foundedOn = spec.foundedDaysAgo ? daysAgo(spec.foundedDaysAgo) : new Date();
  const trialEnds = new Date(foundedOn.getTime() + 90 * 86_400_000);
  await admin
    .from("associations")
    .update({
      created_at: foundedOn.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      subscription_status: "trialing",
      billing_notices: spec.noticesSent ?? [],
      setup_completed_at: spec.setupDone ? foundedOn.toISOString() : null,
    })
    .eq("id", associationId);

  // A first month of dues, so the ledger is not blank.
  const { error: billError } = await client.rpc("issue_assessment", {
    p_association_id: associationId,
    p_label: "September assessment",
    p_due_on: `${today.slice(0, 7)}-01`,
  });
  if (billError) throw new Error(`bill ${spec.name}: ${billError.message}`);

  await client.from("bank_accounts").insert({
    association_id: associationId,
    kind: "operating",
    institution: spec.bank,
    mask: spec.bankMask,
  });

  const { error: postError } = await client.from("announcements").insert({
    association_id: associationId,
    author_name: `${founder.name}, Board President`,
    category: "Notice",
    title: `Welcome to ${spec.name}`,
    body: spec.welcome,
    pinned: true,
    posted_on: iso(foundedOn),
  });
  if (postError) throw new Error(`welcome ${spec.name}: ${postError.message}`);

  for (const v of spec.vendors ?? []) {
    const { error: vendorError } = await client
      .from("vendors")
      .insert({ association_id: associationId, ...v });
    if (vendorError) throw new Error(`vendor ${v.name}: ${vendorError.message}`);
  }

  return { id: associationId, accounts, trialEndsOn: iso(trialEnds), foundedOn: iso(foundedOn) };
}

const OAKVIEW = {
  name: "Oakview Commons",
  city: "Bellevue",
  state: "WA",
  duesCents: 25_000,
  propertyType: "townhomes",
  origin: "existing",
  previously: "fresh",
  collects: ["dues"],
  sharedSpaces: ["clubhouse", "pool"],
  bank: "BECU",
  bankMask: "4417",
  setupDone: true,
  welcome:
    "The board moved our books and notices here. Statements, payments and requests all live in one place now; if something looks off, reply to this and we will sort it out.",
  people: [
    { name: "Monish Naidu", email: OWNER, unit: "1", address: "1 Oakview Ct" },
    { name: "Priya Sharma", email: plus("priya"), unit: "2", role: "treasurer", capabilities: ["finances", "vendors"] },
    { name: "Jordan Lee", email: plus("jordan"), unit: "3" },
    { name: "Sofia Alvarez", email: plus("sofia"), unit: "4" },
    { name: "Ethan Park", email: plus("ethan"), unit: "5" },
  ],
  vendors: [
    { name: "Evergreen Grounds", service: "Landscaping", default_category: "landscaping", ach_enabled: true },
    { name: "Cascade Pool Care", service: "Pool maintenance", default_category: "amenities", ach_enabled: false },
  ],
};

const CEDAR = {
  name: "Cedar Hollow",
  city: "Bothell",
  state: "WA",
  duesCents: 9_500,
  propertyType: "single-family",
  origin: "builder",
  collects: ["dues"],
  sharedSpaces: ["trail"],
  bank: "Sound Credit Union",
  bankMask: "2280",
  // Founded 85 days ago, so the trial ends in five and the closing banner
  // shows; the fourteen day notice already went out.
  foundedDaysAgo: 85,
  noticesSent: ["14-days"],
  welcome:
    "Cedar Hollow's association is set up ahead of the first closings. As lots sell, each new owner is added here and sees their own account from day one.",
  people: [
    { name: "Dana Whitfield", email: plus("cedar"), unit: "1", address: "1 Cedar Hollow Ln" },
    { name: "Marcus Bell", email: plus("marcus"), unit: "2" },
    { name: "Lena Ortiz", email: plus("lena"), unit: "3" },
  ],
  emptyUnits: ["4", "5", "6", "7", "8", "9", "10", "11", "12"],
  vendors: [
    { name: "Northwest Trail Works", service: "Trail upkeep", default_category: "landscaping", ach_enabled: true },
  ],
};

/* ------------------------------------------------------------------- run */

const removed = await wipe();
console.log(`wiped: ${removed.associations} associations, ${removed.users} accounts`);

const oakview = await found(OAKVIEW);
const cedar = await found(CEDAR);

console.log(`
Oakview Commons  ${oakview.id}
  founded ${oakview.foundedOn}, free until ${oakview.trialEndsOn}
  ${oakview.accounts.map((a) => `${a.name} <${a.email}>`).join("\n  ")}

Cedar Hollow     ${cedar.id}
  founded ${cedar.foundedOn}, free until ${cedar.trialEndsOn} (closing banner shows)
  ${cedar.accounts.map((a) => `${a.name} <${a.email}>`).join("\n  ")}

password for every account: ${PASSWORD}
`);
