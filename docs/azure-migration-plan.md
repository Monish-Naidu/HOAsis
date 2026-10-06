# Moving Your HOAsis to Azure: the plan

Written 2026-10-06 for Monish, who asked for a migration plan. It says what
runs where today, what each piece would become on Azure, in what order, what
it would cost in time and money, and whether to do it. Prices are the
published list prices as I know them; check the Azure pricing calculator
before committing, they change.

## Where things run today

| Piece | Today | What it does |
| --- | --- | --- |
| The site and app | Vercel (Next.js, one project, `main` deploys itself) | Pages, the API routes, the three daily jobs (dues, autopay, billing sweep) run as Vercel cron |
| Database and sign-in | Supabase (Postgres with row level security, Supabase Auth, one free-tier project) | Every table, every policy, every SQL function in `supabase/migrations/`, magic links and passwords |
| Payments | Stripe (Connect for the associations' money, Billing for ours) | Unchanged by any of this |
| Email | Resend (domain not yet verified) | Unchanged by any of this |
| Errors | Sentry, plus our own `app_errors` table and `/admin` | See `docs/telemetry.md` |
| DNS | Cloudflare | yourhoasis.com |

Two of those six would move. Stripe, Resend, Sentry and Cloudflare stay
whatever we do.

## What each piece becomes

### The app: Vercel to Azure

Three ways to run Next.js on Azure. One fits.

| Option | Fit | Why |
| --- | --- | --- |
| **Azure Container Apps** (recommended) | Good | Runs the app as a container built from the repo's `Dockerfile` (to be added; Next.js has a standalone output mode for exactly this). Scales to zero when nobody is on it, so a quiet night costs nearly nothing. Has its own cron ("jobs") for the three daily runs. HTTPS and a custom domain are built in. |
| Azure Static Web Apps | Poor | Meant for mostly static sites; its Next.js support runs the server parts as Azure Functions with limits that bite (request size, run time, no cron of its own). Our app is mostly server routes and signed-in pages. |
| Azure App Service | Fine, costlier | A plain Linux web app running `next start`. Simpler than containers, but it never scales to zero, so the cheapest always-on plan is about $13 a month before we have a customer. |

Cost on Container Apps at our size: the consumption plan gives a monthly
free grant (the first 180,000 vCPU-seconds and 360,000 GiB-seconds, and
two million requests), which a pre-launch product does not exhaust. Expect
$0 to $15 a month until there is real traffic. Vercel's hobby plan is $0
today and would be $20 a month on Pro once we need a team or more than the
hobby limits.

### The database and sign-in: Supabase to Azure

This is the hard half, and the reason to think twice.

| Piece | Becomes | Effort |
| --- | --- | --- |
| Postgres, every table and policy | **Azure Database for PostgreSQL, Flexible Server** | Low. It is the same Postgres. The 99 migrations apply as they are, minus the Supabase-only parts below. Cheapest burstable tier is about $13 a month plus storage; a production tier with high availability is $100 or more. Supabase free is $0 and Pro is $25. |
| Supabase Auth (sign-up, magic links, password reset, the `auth.users` table) | One of: keep Supabase Auth as a hosted service; or **Microsoft Entra External ID** (Azure's customer sign-in); or run the open-source Supabase Auth server (GoTrue) ourselves in Container Apps | Medium to high. Our SQL leans on `auth.uid()` and `auth.role()` in every policy and function, and on triggers on `auth.users` (0003, 0090). Entra would mean replacing those with a JWT claim mapping and rewriting the sign-in, join, invite and email-change flows. Running GoTrue ourselves keeps every policy as it is but adds a service to operate. |
| PostgREST (the browser talks to the database through it) | Keep the open-source PostgREST in a container, or move every browser read and write behind our own API routes | Medium. The app's data layer (`src/lib/data/remote.ts`, `src/lib/app-state.tsx`) uses the Supabase client everywhere. Self-hosting PostgREST keeps that code; dropping it is a rewrite. |
| Realtime, storage | Not used | None. |

The honest shape of it: **moving the app is a day; moving the database is a
week if we keep the Supabase pieces running in containers, and a month if
we replace them.** Supabase is open source, so "Supabase on Azure" is a real
option: Postgres on Flexible Server, GoTrue and PostgREST in Container Apps,
our app beside them. Everything in the repo would work unchanged.

## The order, if we do it

1. **Prepare, no move yet (1 to 2 days).** Add `output: "standalone"` and a
   `Dockerfile`. Make the three cron routes callable from a job runner (they
   already take `CRON_SECRET`). Put every environment variable in one list
   (`docs/go-live-monish.md` has most). Add a health route.
2. **App on Azure, database stays on Supabase (half a day).** Container
   Apps environment, the app as one container, the three jobs on Container
   Apps jobs with cron triggers, secrets in the environment, custom domain
   `staging.yourhoasis.com` pointed at it from Cloudflare. The app talks to
   Supabase exactly as now. Run the browser suite against it. This is a
   complete, reversible step on its own: it proves the hosting and costs
   nothing to undo.
3. **Decide the database.** Three paths, in order of my preference:
   a. **Stay on Supabase** for the database and sign-in, app on Azure.
      Cheapest and least risky. Supabase Pro at $25 a month is what we
      would pay for backups and no pausing anyway.
   b. **Supabase on Azure:** Flexible Server plus GoTrue and PostgREST in
      containers. Keeps the code, adds operations. One to two weeks
      including the data move, a rehearsal and a cut-over night.
   c. **Replace sign-in with Entra External ID** and put PostgREST behind
      our API. A month. Only worth it if Azure sign-in is required for a
      reason outside the product (an enterprise customer, a credit program
      that demands it).
4. **Cut over (one evening).** Freeze writes (the billing gate can show
   "back in an hour"), `pg_dump` from Supabase, restore to Flexible Server,
   point the app's environment at it, run `pnpm db:verify` against it,
   flip DNS. Keep Supabase for thirty days as the fallback.

## What does not change

Stripe (Connect accounts, webhooks, the subscription), Resend, Sentry,
Cloudflare, GitHub Actions, the repo, the migrations, the tests. Stripe's
webhook URL and Resend's sending domain would be re-pointed, that is all.

## Risks, plainly

- **Sign-in is the one thing that can lock everybody out.** Any path that
  changes it needs a rehearsal with real accounts on staging first.
- **Row level security is the product's security model.** It survives
  paths a and b untouched; path c has to prove every policy again.
- **The free tiers differ.** Supabase free pauses after a week idle (it has
  bitten us once, 2026-09-19); Azure does not pause but does bill.
- **Two clouds for a while.** Step 2 leaves the app on Azure and the data
  on Supabase; that is fine (they talk over HTTPS as now) but it is two
  dashboards to watch.

## My recommendation

Do step 1 now (it is good hygiene regardless) and step 2 when there is a
reason: Azure credits, a customer who asks, or Vercel's limits. Leave the
database on Supabase and pay for Pro when the first real association signs
up. Revisit the database question when there are more than a few
associations or when a compliance need (data residency, a signed BAA, an
auditor) names a requirement Supabase cannot meet.

If the reason is Azure credits, note that Flexible Server, Container Apps
and Entra External ID all draw on them, so path b becomes nearly free in
cash and costs mostly time.
