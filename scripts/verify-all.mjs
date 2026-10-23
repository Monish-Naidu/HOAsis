/**
 * Every database check, every time.
 *
 * `pnpm db:verify` used to chain the scripts with &&, so the first one to fail
 * hid everything after it. For a week one stale script kept fifteen others
 * from running, and a trigger that refused three kinds of settings change sat
 * in production unnoticed. Each script now runs whatever the one before it
 * did, and the last lines say which failed.
 *
 * These talk to the Supabase project in the env file (ENV_FILE, read by each
 * script, or .env.local). They create their own associations and users and
 * remove them when they finish. Only a local stack is accepted unless
 * VERIFY_REMOTE_HOST names the remote host (scripts/lib/verify-target.mjs);
 * `pnpm db:verify:staging` points every script at .env.staging and still
 * needs that name.
 */
import { spawnSync } from "node:child_process";
import { loadVerifyEnv } from "./lib/verify-target.mjs";

const SUITES = [
  "rls",
  "isolation",
  "onboarding",
  "money",
  "stripe",
  "community-life",
  "email",
  "email-webhook",
  "signin-routing",
  "safety",
  "scale",
  "a-year",
  "three-years",
  "profile",
  "board-actions",
  "ranked-list",
  "join-flow",
  "roster-import",
  "late-fees",
  "dues-change",
  "access",
  "sale-privacy",
  "owners",
  "two-homes",
  "billing-lock",
  "billing-checkout",
  "billing-webhook",
  "append-only",
  "rollups",
  "fiscal-years",
  "attachments",
  "meetings",
  "voting",
  "fines",
  "sign-out",
];

console.log(`Database checks write to ${loadVerifyEnv().NEXT_PUBLIC_SUPABASE_URL}`);

const only = process.argv.slice(2);
const unknown = only.filter((suite) => !SUITES.includes(suite));
if (unknown.length) {
  console.error(`No such suite: ${unknown.join(", ")}`);
  process.exit(1);
}
const failed = [];
for (const suite of SUITES) {
  if (only.length && !only.includes(suite)) continue;
  console.log(`\n=== verify-${suite}`);
  const run = spawnSync(
    process.execPath,
    [new URL(`./verify-${suite}.mjs`, import.meta.url).pathname],
    { stdio: "inherit" },
  );
  if (run.status !== 0) failed.push(suite);
}

console.log(
  failed.length
    ? `\nFAILED: ${failed.map((s) => `verify-${s}`).join(", ")}`
    : "\nEvery database check passed.",
);
process.exit(failed.length ? 1 : 0);
