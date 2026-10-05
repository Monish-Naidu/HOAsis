/**
 * Stands the staging copy up from an empty Supabase project.
 *
 * Staging is a second, free project that holds test associations, so the
 * project real associations live in is not where things get tried. Creating
 * the project itself is a click in the Supabase dashboard (the token on this
 * machine cannot); everything after that is this script.
 *
 * It needs .env.staging to carry the new project's four values:
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD.
 *
 *   node scripts/setup-staging.mjs            every migration into staging
 *   node scripts/setup-staging.mjs --vercel   and point Vercel previews at it
 *
 * Safe to run again: migrations already applied are skipped, and the Vercel
 * step replaces the Preview values only. Production values are never read
 * or written here.
 */
import { spawnSync } from "node:child_process";
import { loadEnv } from "./env.mjs";

const env = loadEnv(new URL("../.env.staging", import.meta.url));
const NEEDED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_PASSWORD",
];
const missing = NEEDED.filter((name) => !(env[name] ?? "").trim());
if (missing.length) {
  console.error(`.env.staging is missing: ${missing.join(", ")}.`);
  console.error("Create the project on supabase.com (free plan), then paste its values in. See docs/work-tracker.md.");
  process.exit(1);
}

const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const production = loadEnv();
if (production.NEXT_PUBLIC_SUPABASE_URL && new URL(production.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0] === ref) {
  console.error("Refusing: .env.staging points at the same project as .env.local. Staging has to be a different project.");
  process.exit(1);
}

const password = encodeURIComponent(env.SUPABASE_DB_PASSWORD);
const region = env.STAGING_REGION || "us-west-2";
// The direct address is IPv6 only on the free plan, so the pooled ones are
// tried after it. Which pooler a project sits behind is not in its keys.
const addresses = [
  `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`,
  `postgresql://postgres.${ref}:${password}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${ref}:${password}@aws-1-${region}.pooler.supabase.com:5432/postgres`,
];

let pushed = false;
for (const address of addresses) {
  const host = new URL(address).hostname;
  console.log(`Migrations into staging (${ref}) through ${host} ...`);
  const run = spawnSync("npx", ["supabase", "db", "push", "--db-url", address, "--yes"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  // Never echo the command or its raw output: both can carry the password.
  const said = `${run.stdout ?? ""}${run.stderr ?? ""}`.replaceAll(env.SUPABASE_DB_PASSWORD, "[hidden]").replaceAll(password, "[hidden]");
  if (run.status === 0) {
    const applied = (said.match(/Applying migration/g) ?? []).length;
    console.log(applied ? `  ${applied} migrations applied.` : "  Already up to date.");
    pushed = true;
    break;
  }
  console.log(`  could not connect that way (${said.split("\n").find((line) => /error|failed|refused|timeout/i.test(line))?.trim().slice(0, 160) ?? "no reason given"}).`);
}
if (!pushed) {
  console.error("No address worked. Check the database password in .env.staging, and set STAGING_REGION there if the project is not in us-west-2.");
  process.exit(1);
}

if (process.argv.includes("--vercel")) {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    // Remove the Preview value if there is one, then set staging's. A name
    // that had no Preview value makes the removal fail, which is fine.
    spawnSync("npx", ["vercel", "env", "rm", name, "preview", "--yes"], { stdio: "ignore" });
    const add = spawnSync("npx", ["vercel", "env", "add", name, "preview"], {
      input: env[name],
      stdio: ["pipe", "ignore", "pipe"],
      encoding: "utf8",
    });
    console.log(add.status === 0 ? `Vercel Preview: ${name} set to staging.` : `Vercel Preview: ${name} was NOT set (${(add.stderr ?? "").trim().split("\n").pop()?.slice(0, 120)}).`);
  }
  console.log("Pull request previews use staging from their next build.");
}

console.log(`
Staging is ready.
  pnpm db:verify:staging                                  every database check, against staging
  ENV_FILE=../.env.staging node scripts/seed-playground.mjs   a furnished test association there
The scripts that need Stripe or email keys read them from the same file, so
copy STRIPE_SECRET_KEY, EMAIL_TOKEN_SECRET and RESEND_API_KEY from .env.local
into .env.staging before running those.`);
