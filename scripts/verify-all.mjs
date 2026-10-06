/**
 * Every database check, every time.
 *
 * `pnpm db:verify` used to chain the scripts with &&, so the first one to fail
 * hid everything after it. For a week one stale script kept fifteen others
 * from running, and a trigger that refused three kinds of settings change sat
 * in production unnoticed. Each script now runs whatever the one before it
 * did, and the last lines say which failed.
 *
 * These talk to the real Supabase project in .env.local. They create their
 * own associations and users and remove them when they finish.
 *
 * `pnpm db:verify:staging` points every script at .env.staging instead
 * (ENV_FILE, read by each script), so the checks can run without writing to
 * the project real associations live in.
 */
import { spawnSync } from "node:child_process";

const SUITES = [
  "rls", "isolation", "onboarding", "money", "stripe", "community-life",
  "email", "signin-routing", "safety", "scale", "a-year", "three-years",
  "profile", "board-actions", "ranked-list", "join-flow", "roster-import",
  "late-fees", "access", "sale-privacy", "owners", "two-homes",
];

const only = process.argv.slice(2);
const failed = [];
for (const suite of SUITES) {
  if (only.length && !only.includes(suite)) continue;
  console.log(`\n=== verify-${suite}`);
  const run = spawnSync(process.execPath, [new URL(`./verify-${suite}.mjs`, import.meta.url).pathname], { stdio: "inherit" });
  if (run.status !== 0) failed.push(suite);
}

console.log(failed.length ? `\nFAILED: ${failed.map((s) => `verify-${s}`).join(", ")}` : "\nEvery database check passed.");
process.exit(failed.length ? 1 : 0);
