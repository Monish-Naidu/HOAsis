/**
 * Everything one association has, written to a folder: every row of every
 * table that belongs to it, the rows that hang off those (votes, ballot
 * options, payment allocations, post likes, shared cost shares, email
 * opt-outs), and every file in its storage folders. The Terms promise a
 * complete export; this is it, run by support until there is a button.
 *
 *   node scripts/export-association.mjs <association id or slug>
 *   ENV_FILE=../.env.staging node scripts/export-association.mjs mehr-meadows
 *
 * Reads with the service role, so row level security does not apply; the
 * folder holds personal data and goes to the association's board only.
 * Output: exports/<slug>-<date>/<table>.json and .csv, files/<bucket>/...,
 * and README.txt with the counts. The exports folder is gitignored.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const key = process.argv[2];
if (!key) {
  console.error("Say which association: node scripts/export-association.mjs <id or slug>");
  process.exit(1);
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Tables with an association_id column, in a reading order. */
const OWN = [
  "units",
  "memberships",
  "board_terms",
  "charges",
  "payments",
  "ledger_entries",
  "payment_instruments",
  "autopay_runs",
  "payouts",
  "bank_accounts",
  "budget_lines",
  "reserve_components",
  "special_assessments",
  "shared_costs",
  "shared_cost_bills",
  "documents",
  "governing_articles",
  "forms",
  "message_templates",
  "announcements",
  "threads",
  "posts",
  "post_replies",
  "requests",
  "action_items",
  "meetings",
  "ballots",
  "vendors",
  "violations",
  "violation_reports",
  "amenities",
  "join_requests",
  "setup_dismissals",
  "email_log",
  "activity",
  "app_errors",
];
/** Tables reached through a parent: [table, column, parent table, parent column (id)]. */
const THROUGH = [
  // A profile is a person, who may belong to several associations; the
  // ones here are those with a seat.
  ["profiles", "id", "memberships", "profile_id"],
  ["ballot_options", "ballot_id", "ballots"],
  ["votes", "ballot_id", "ballots"],
  ["payment_allocations", "payment_id", "payments"],
  ["post_likes", "post_id", "posts"],
  ["shared_cost_shares", "bill_id", "shared_cost_bills"],
  ["email_optouts", "profile_id", "profiles"],
];
const BUCKETS = ["documents", "community", "attachments"];

async function all(table, column, value) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = admin
      .from(table)
      .select("*")
      .range(from, from + 999);
    q = Array.isArray(value) ? q.in(column, value) : q.eq(column, value);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function csv(rows) {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    const s =
      v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n"
  );
}

// Which association: an id, or a slug.
const isId = /^[0-9a-f-]{36}$/i.test(key);
const { data: assoc, error: findError } = await admin
  .from("associations")
  .select("*")
  .eq(isId ? "id" : "slug", key)
  .maybeSingle();
if (findError) throw findError;
if (!assoc) {
  console.error(`No association with ${isId ? "id" : "slug"} ${key}`);
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const dir = join("exports", `${assoc.slug ?? assoc.id}-${date}`);
mkdirSync(join(dir, "files"), { recursive: true });
const counts = [];
function write(name, rows) {
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(rows, null, 2));
  writeFileSync(join(dir, `${name}.csv`), csv(rows));
  counts.push([name, rows.length]);
}

write("associations", [assoc]);
const byTable = {};
for (const table of OWN) {
  byTable[table] = await all(table, "association_id", assoc.id);
  write(table, byTable[table]);
}
for (const [table, column, parent, parentColumn = "id"] of THROUGH) {
  const ids = [...new Set((byTable[parent] ?? []).map((r) => r[parentColumn]).filter(Boolean))];
  const rows = [];
  for (let i = 0; i < ids.length; i += 200)
    rows.push(...(await all(table, column, ids.slice(i, i + 200))));
  byTable[table] = rows;
  write(table, rows);
}

// Files: each bucket keeps an association's objects under its id.
let files = 0;
async function walk(bucket, prefix) {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (!item.id) {
      await walk(bucket, path);
      continue;
    }
    const { data: blob, error: dl } = await admin.storage.from(bucket).download(path);
    if (dl) throw new Error(`download ${bucket}/${path}: ${dl.message}`);
    const target = join(dir, "files", bucket, path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, Buffer.from(await blob.arrayBuffer()));
    files += 1;
  }
}
for (const bucket of BUCKETS) await walk(bucket, assoc.id);
counts.push(["files", files]);

const readme = [
  `${assoc.name} (${assoc.id}), exported ${new Date().toISOString()}`,
  `From ${env.NEXT_PUBLIC_SUPABASE_URL}`,
  "",
  "Every table is here twice, as JSON (exact) and CSV (for a spreadsheet).",
  "Money columns ending in _cents are integer cents. Dates are YYYY-MM-DD.",
  "files/ holds the uploaded documents, photos and attachments by bucket.",
  "This folder holds personal data: names, addresses, emails, balances.",
  "",
  ...counts.map(([n, c]) => `${String(c).padStart(6)}  ${n}`),
].join("\n");
writeFileSync(join(dir, "README.txt"), readme + "\n");
console.log(readme);
console.log(`\nWritten to ${dir}`);
