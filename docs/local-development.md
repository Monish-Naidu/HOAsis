# Local development services

The signed-out demo needs only Node.js and pnpm. It uses fixture data and works without `.env.local`.
Use the local Supabase stack only when developing signed-in data and Auth flows.

## Start Supabase locally

Docker must be running. From the repository root:

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase status --output env
```

The checked-in `supabase/config.toml` supplies local Postgres, Auth, Storage, Studio, and an email
capture service. `db reset` applies the numbered migrations. It does not seed product fixtures:
demo data stays in the signed-out browser path.

Copy the local API URL, anon key, and service-role key from `supabase status --output env` into
`.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`. Keep `.env.local` untracked. Do not point local reset or verification
commands at a production project.

Then start the app with `pnpm dev`. Local Auth emails are captured by the Supabase email service;
open the local Studio URL printed by `supabase status` to inspect them and the database.

Stripe and Resend are not needed for the demo. Payment and outbound-email integrations still need
their respective test credentials; never copy production secrets into a local environment.

## Run interactive checks

- Demo path: `pnpm dev`, open `http://localhost:3000`, choose the sample account, then exercise
  board or resident screens.
- Browser suite: keep the app running, then run `pnpm e2e`. Set `E2E_BASE` to use a different
  local port. Do not use port 3000 if it belongs to another running development server.
- Database checks: `pnpm db:verify` reads the project in `.env.local`, or the file `ENV_FILE`
  names. The checks write test users and associations, so they refuse any host other than
  `127.0.0.1`, `localhost` or `[::1]`. To verify a remote project on purpose, set
  `VERIFY_REMOTE_HOST` to its exact hostname for that one command. Never do that for production.

## Run integration checks against the isolated local stack

On the main machine `.env.local` points at production. Integration work there uses an isolated
stack with its own ignored env file instead, and loads it explicitly in the same command as the
action:

```bash
. scripts/.qa/readiness-20261022/tools.env &&
  set -a && . scripts/.qa/readiness-20261022/local.env && set +a &&
  node scripts/.qa/readiness-20261022/guard.mjs &&
  node scripts/verify-all.mjs rls isolation
```

The guard refuses unless `ENV_FILE` names that local file, the API is `http://127.0.0.1:54321`,
any direct database URL is `127.0.0.1:54322`, Stripe keys are test keys and production telemetry
and test logins are blank. The stack keeps every port on loopback: API 54321, database 54322,
Mailpit (local Auth email) 54324. The signed-in app runs on `127.0.0.1:3100`, a frozen demo build
on `127.0.0.1:3101`; port 3000 belongs to the everyday dev server and is left alone.

The demo test suites remove backend variables before they load (`tests/demo-env.ts`), so
`pnpm test` and `pnpm check` test the signed-out demo even in a shell with that file loaded. Run
one build or full test gate at a time on this machine, and at most two browser sessions.
