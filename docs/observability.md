# Observability

How to find bugs and read logs, for one person running this on Vercel and
Supabase. Written 2026-09-25 against the code. Short on purpose: the
decisions are made, the click paths are here, do them in order.

## The one habit

Every server request carries an id. It is minted in `src/proxy.ts`, sent on
the `x-request-id` header both ways, printed on every JSON log line as
`requestId`, stored in `app_errors.reference`, and shown to a person on the
error screens as **Reference K7QM2X4P** (eight readable characters, no
I, L, O, 0 or 1). When a resident emails "it broke", ask for the reference,
then:

1. `/admin`, **Latest errors**, find the reference. That gives route, message
   and association.
2. Vercel, Project, **Logs**, search the reference. That gives every line
   the request wrote, in order, with timings (`durationMs`).
3. Sentry (once set up), search `reference:K7QM2X4P`. That gives the stack
   with source maps.

A server error that Next caught also gets a `digest`; the error page shows
the digest as the reference when it has one, so the same lookup works.

## What exists already, for free

| Where | What | Limits |
| --- | --- | --- |
| Vercel, Project, **Logs** | Every `console.*` line from route handlers, server components and crons. Ours are JSON (`src/lib/log.ts`), so filter by `route`, `level`, `requestId`, `associationId`. | Hobby: 1 hour of runtime logs. Pro: 1 day. Then gone. Hence the log drain below. |
| Vercel, Project, **Deployments**, a deployment, **Functions** | Per-function invocations, errors, duration, cold starts. | Same retention. |
| Vercel, Project, **Speed Insights** and **Web Analytics** | Core Web Vitals per page; page views. Enable with one click each; both have a free tier. | Sampling on Hobby. |
| Vercel, Project, **Settings**, **Crons** | Whether each of the three crons fired and what status it got. | Last few runs only. Our `cron_runs` table keeps the history. |
| Supabase, Project, **Logs** | Postgres logs (slow queries, errors), API logs (every PostgREST call with status), Auth logs (sign-ins, failures). Logs Explorer takes SQL. | Free: 1 day. Pro: 7 days. |
| Supabase, Project, **Reports** | Query performance, index usage, connection count. Where "the page got slow" gets answered. | |
| Stripe, **Developers**, **Events** | Every event with its payload. **Webhooks**, an endpoint, an event: every delivery attempt, our status code and response body, with a **Resend** button. | 30 days. |
| Resend, **Emails** | Every send, its status ladder (sent, delivered, bounced), the rendered message. **Webhooks** shows deliveries to `/api/email/webhook`. | Free: 1 day of detail (was 3); check the current plan. |
| This app, `email_log` | Every email we sent, per association, with Resend's id and status. Board sees theirs under Communications. | Capped at 300 per load on the board side; `/admin` reads failures directly. |
| This app, `autopay_runs` | One row per home per month the autopay cron decided: charged, skipped, failed, with the reason. | |
| This app, `payments` | `pending` is money Stripe has not settled yet. ACH takes about four days; pending past five is a missed webhook. | |
| This app, `app_errors` (new) | What the server and the browsers caught, with the reference. Service role only. | |
| This app, `cron_runs` (new) | One row per cron call with a summary (`checked`, `charged`, `errors`...). | |
| This app, `/api/health` (new) | 200 when the database answers and the Stripe, Resend and cron keys are present; 503 with the missing name otherwise. | |
| This app, `/admin` (new) | All of the above for the last seven days on one page. See below. | |

## What to add, in order

### 1. Sentry (errors and traces, server and client)

Free tier: 5k errors and 10k spans a month, one person. Enough.

Already wired in the code: `sentry.server.config.ts`, `sentry.edge.config.ts`,
`src/instrumentation.ts` (`register` + `onRequestError`),
`src/instrumentation-client.ts`, `withSentryConfig` in `next.config.ts`,
`Sentry.captureException` in `src/app/global-error.tsx`. With no DSN the SDK
is `enabled: false`: no network, no console noise, no source map upload.
Do not run the Sentry wizard; it would duplicate these files.

Click path:

1. sentry.io, **Create project**, platform **Next.js**, name `your-hoasis`.
   Copy the DSN.
2. Vercel, Project, **Settings**, **Integrations**, **Browse Marketplace**,
   **Sentry**, **Add integration**, pick this project, link it to the Sentry
   project. This sets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`
   on the Vercel project, which is what makes the build upload source maps.
3. Vercel, Project, **Settings**, **Environment Variables**, add for
   Production and Preview:
   - `NEXT_PUBLIC_SENTRY_DSN` = the DSN (browser, and the server falls back to it)
   - `SENTRY_DSN` = the same DSN (server and edge)
4. Redeploy. Sentry, project, **Alerts**, **Create alert**, "Issues", "a new
   issue is created", action **Send an email to** you. One alert, that is all.
5. Sentry, **Settings**, **Projects**, the project, **Client Keys**, add
   `yourhoasis.com` to allowed domains so nobody else can post to your DSN.

Locally, leave the three unset. To test once, put the DSN in `.env.local`,
open a page that throws, delete it again.

### 2. A log drain (logs that outlive an hour)

Vercel forgets Hobby runtime logs after an hour. A drain copies every line
to somewhere searchable. **Axiom** (free: 500 GB a month, 30 days) or
**Better Stack Logs** (free: 1 GB, 3 days). Take Axiom for the retention.

1. axiom.co, sign up, **Datasets**, **New dataset** `vercel`.
2. Vercel, **Integrations**, **Browse Marketplace**, **Axiom**, **Add
   integration**, pick this project, pick the dataset. Vercel starts sending.
   (Axiom's integration is a log drain; nothing to add to the code and no env
   var.)
3. In Axiom, the JSON on each line is already parsed: `['vercel'] | where
   requestId == "K7QM2X4P"` or `| where level == "error" | summarize count()
   by route`. Save the second one as a dashboard panel.
4. Axiom, **Monitors**, new monitor on `level == "error"` count over 10 in 15
   minutes, notify by email. One monitor.

If Better Stack instead: Vercel, Project, **Settings**, **Log Drains**,
**Add**, choose JSON, paste the HTTP endpoint and token Better Stack shows.

### 3. Uptime checks

Two checks: `https://yourhoasis.com/` (200, contains "HOAsis") and
`https://yourhoasis.com/api/health` (200; the body says what failed on a
503). **Better Stack Uptime** (free: 10 monitors, 3 minute interval, email and
phone call) or **UptimeRobot** (free: 50 monitors, 5 minute). Either. Email
alert only; phone calls for one person's side project are a way to hate it.

`/api/health` costs one select and reads no secrets, so a check every three
minutes is fine. It also keeps the Supabase free project awake, which is a
side effect worth knowing.

### 4. A daily "something failed" email

Not built yet, on purpose: `/admin` answers the same question when you look,
and the crons already log a summary line each morning. Build it when a week
goes by without opening `/admin`. The cheapest shape: a fourth cron
(`/api/ops/digest`, 15:00 UTC, after autopay) that runs `loadOpsReport()`
from `src/lib/ops.ts` and sends one email through Resend to
`PLATFORM_OWNER_EMAILS` only when a count is non-zero. Supabase
**Database Webhooks** on `app_errors` insert is the other shape (Supabase,
**Database**, **Webhooks**, insert on `app_errors`, POST to a route), but it
fires per error, which is noise the moment one page loops.

### Not yet

- **Datadog, New Relic, Grafana Cloud.** Real, and a second job to run.
- **OpenTelemetry.** Sentry's traces cover the question "which query was
  slow" for now.
- **Session replay.** It records screens with balances and addresses on
  them. Off in `instrumentation-client.ts` and stays off.
- **PagerDuty or on-call.** One email alert from Sentry and one from
  uptime; the phone is for family.
- **Supabase Pro** for the sake of logs alone. Buy it when the project
  pausing or the 60-connection pooler bites, both in `docs/scale.md`.
- **A logging library** (pino, winston). `src/lib/log.ts` is ninety lines
  and prints JSON; that is the whole job.

## What is in the code

- `src/lib/log.ts`: `logger(route, request)` returns `info/warn/error`; each
  call prints one JSON line (`ts`, `level`, `msg`, `requestId`, `route`,
  `durationMs`, `associationId`, plus fields). `scrubFields` masks emails to
  `m***@gmail.com` and redacts keys and values that look like secrets
  (`token`, `client_secret`, `sk_`, `whsec_`, `re_`, JWTs, card fields).
  `errorBody(log, message)` is the `{ error, reference }` shape for JSON
  errors. Tests: `tests/unit/log.test.ts`.
- Logged routes: `stripe/webhook`, `billing/webhook`, `stripe/connect`,
  `stripe/payment-intent`, `stripe/setup-intent`, `stripe/instruments`,
  `autopay/run`, `assessments/run`, `billing/sweep`, `email/invite`,
  `email/notify`, `email/send`, `email/webhook`, `auth/signup`,
  `join/lookup`, `log`. One line per meaningful step.
- `src/proxy.ts`: mints or keeps `x-request-id`, forwards it to the route,
  returns it on the response.
- `src/instrumentation.ts`: `onRequestError` sends every server error to
  Sentry, the log, and `app_errors`.
- `src/app/error.tsx`, `src/app/global-error.tsx`: calm message plus the
  reference; both post to `/api/log`. `ErrorReporter` (root layout) posts
  unhandled promise rejections and window errors, five per page at most.
- `src/app/api/log/route.ts`: 30 posts a minute per address; the body is
  trusted only for its length.
- `src/app/api/health/route.ts`, `src/lib/health.ts`.
- `src/app/admin/page.tsx`, `src/lib/ops.ts`: the ops page, gated on
  `PLATFORM_OWNER_EMAILS`, 404 for everyone else. Health, latest cron run
  per job (stale after 26 hours), errors grouped by message, latest 50
  errors, email failures, autopay failures, payments pending more than five
  days. Note: `/admin` used to 308 to `/board`; a browser that cached that
  redirect needs a hard reload or a private window the first time.
- `supabase/migrations/0052_app_errors_and_cron_runs.sql`: the two tables,
  RLS on, no policies, so only the service role reads them.

## Env vars

| Name | Where | Value |
| --- | --- | --- |
| `PLATFORM_OWNER_EMAILS` | Vercel (Production, Preview) and `.env.local` | `monishnaidu18@gmail.com`; comma separated for more |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel (Production, Preview) | the project DSN |
| `SENTRY_DSN` | Vercel (Production, Preview) | the same DSN |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | set by the Vercel Sentry integration | do not type these by hand |

Vercel: Project, **Settings**, **Environment Variables**, **Add**, then
**Redeploy** (env changes do not reach a running deployment).

## Reading a Vercel log line

```json
{"ts":"2026-09-25T14:30:02.118Z","level":"warn","msg":"autopay charge failed","requestId":"K7QM2X4P","route":"autopay/run","durationMs":8412,"associationId":"8a4f…","unitId":"c1d2…","month":"2026-09","rail":"ach","reason":"Insufficient funds"}
```

`durationMs` is since the route started, so the last line of a request is
its total. `route` is a fixed name, never a path with ids, so a filter on it
matches every call. Emails never appear whole; ids do, because ids are how
you get from a line to a row.
