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
- Database checks: `pnpm db:verify` targets the project configured in `.env.local`; inspect that
  target before running because these checks perform writes.
