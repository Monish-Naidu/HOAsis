# Observability

How to find bugs and read logs, for one person running this on Azure.
Written 2026-09-25 against Vercel and Sentry, rewritten 2026-10-15 for
Azure Monitor, which is what runs now. Short on purpose: the decisions are
made, the queries are here, nothing to click to set it up.

## The one habit

Every server request carries an id. It is minted in `src/proxy.ts`, sent on
the `x-request-id` header both ways, printed on every JSON log line as
`requestId`, stored in `app_errors.reference`, and shown to a person on the
error screens as **Reference K7QM2X4P** (eight readable characters, no
I, L, O, 0 or 1). When a resident emails "it broke", ask for the reference,
then:

1. `/admin`, **Latest errors**, find the reference. That gives route, message
   and association.
2. Azure portal, `log-hoasis`, **Logs**, the "one reference" query below.
   That gives every line the request wrote, in order, with timings
   (`durationMs`), and the `traceId` of the request.
3. Azure portal, `appi-hoasis`, **Transaction search**, paste the reference
   (it is on the exception as `requestId`). That gives the request, the
   calls it made to the database, Stripe and Resend with their timings, and
   the stack.

A server error that Next caught also gets a `digest`; the error page shows
the digest as the reference when it has one, so the same lookup works.

## What runs, and what it costs

All of it is in `infra/platform.bicep` and `infra/apps.bicep`, deployed by
`scripts/azure/provision.sh`. Nothing is set up by hand in the portal.

| What                                                   | Where                                                                       | Notes                                                                                                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console of every container                             | Log Analytics workspace `log-hoasis`, table `ContainerAppConsoleLogs_CL`    | Every `console.*` line from the web app, the five jobs and the Supabase services. Ours are JSON (`src/lib/log.ts`), read with `parse_json(Log_s)`. 30 days. Capped at 1 GB a day. |
| Requests, dependencies, exceptions, metrics, live view | Application Insights `appi-hoasis` (workspace-based, same workspace)        | Sent by the app itself (`telemetry.mjs`): every request Next handles, every call to Supabase, Stripe and Resend, every warn and error line, CPU and memory. 90 days.              |
| Uptime                                                 | `uptime-hoasis`, a standard web test on `/api/health` from three US regions | Every five minutes. `alert-hoasis-down` emails after two regions fail in a row.                                                                                                   |
| Errors inside the app                                  | `alert-hoasis-errors`, a log alert on the workspace                         | Any line at level `error` in fifteen minutes. One email per quiet-to-firing change (auto-mitigates).                                                                              |
| Server failures                                        | `alert-hoasis-failures`, a log alert on the workspace                       | Three or more answers of 500 and up in fifteen minutes.                                                                                                                           |
| Who gets the email                                     | Action group `ag-hoasis-owner`                                              | `BUDGET_EMAIL` in `.env.azure`.                                                                                                                                                   |
| Spend                                                  | Budget `budget-hoasis`                                                      | Emails at half, most and a forecast over the credit (docs/azure-migration-plan.md).                                                                                               |
| This app, `email_log`                                  | Database                                                                    | Every email we sent, per association, with Resend's id and status. Board sees theirs under Communications.                                                                        |
| This app, `autopay_runs`, `payments`, `cron_runs`      | Database                                                                    | One row per decision, per payment, per job run. `payments.state = pending` past five days is a missed webhook.                                                                    |
| This app, `app_errors`                                 | Database                                                                    | What the server and the browsers caught, with the reference. Service role only.                                                                                                   |
| This app, `/api/health`                                | Route                                                                       | 200 when the database answers and the Stripe, Resend and cron keys are present; 503 with the missing name otherwise. Says whether Application Insights is on.                     |
| This app, `/admin`                                     | Page, gated on `PLATFORM_OWNER_EMAILS`                                      | All of the above for the last seven days on one page.                                                                                                                             |
| Daily digest                                           | `/api/ops/digest`, 15:00 UTC                                                | One email to `PLATFORM_OWNER_EMAILS` when a count is non-zero.                                                                                                                    |
| Stripe, **Developers**, **Events** and **Webhooks**    | Stripe dashboard                                                            | Every event with its payload; every delivery attempt with our status code and a **Resend** button. 30 days.                                                                       |
| Resend, **Emails**                                     | Resend dashboard                                                            | Every send, its status ladder, the rendered message.                                                                                                                              |

Cost: Log Analytics and Application Insights bill per gigabyte ingested
(about $2.76 a GB after the first five a month, which this app does not
reach) and the two log alerts about $1.50 a month between them. The daily
cap on the workspace is the backstop against a page that loops.

## Queries

Azure portal, `log-hoasis`, **Logs**. Every line the app writes is one row
of `ContainerAppConsoleLogs_CL` with the JSON in `Log_s`.

One reference, every line, in order:

```kusto
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "ca-hoasis-web"
| extend line = parse_json(Log_s)
| where tostring(line.requestId) == "K7QM2X4P"
| project TimeGenerated, level = tostring(line.level), route = tostring(line.route),
          msg = tostring(line.msg), durationMs = toint(line.durationMs), traceId = tostring(line.traceId), Log_s
| order by TimeGenerated asc
```

Errors by route, last day:

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(1d) and ContainerAppName_s == "ca-hoasis-web"
| extend line = parse_json(Log_s)
| where tostring(line.level) == "error"
| summarize n = count(), last = max(TimeGenerated), sample = any(tostring(line.msg)) by route = tostring(line.route)
| order by n desc
```

What each job did this morning:

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(1d) and ContainerAppName_s startswith "ca-hoasis-web"
| extend line = parse_json(Log_s)
| where tostring(line.route) in ("assessments/run", "autopay/run", "billing/sweep", "email/bills", "ops/digest")
| project TimeGenerated, route = tostring(line.route), msg = tostring(line.msg), Log_s
| order by TimeGenerated desc
```

Slowest requests, last day (Application Insights, same workspace):

```kusto
AppRequests
| where TimeGenerated > ago(1d)
| summarize p50 = percentile(DurationMs, 50), p95 = percentile(DurationMs, 95), n = count() by Name
| order by p95 desc
```

Exceptions with their reference:

```kusto
AppExceptions
| where TimeGenerated > ago(1d)
| project TimeGenerated, OuterMessage, route = tostring(Properties.route), reference = tostring(Properties.requestId), OperationId
| order by TimeGenerated desc
```

Every call the app made to Stripe or Supabase that took over a second:

```kusto
AppDependencies
| where TimeGenerated > ago(1d) and DurationMs > 1000
| project TimeGenerated, Target, Name, ResultCode, DurationMs, OperationId
| order by DurationMs desc
```

`OperationId` is the trace: paste it into **Transaction search** on
`appi-hoasis` to see the request, its dependencies and its exception as one
timeline. A call to Supabase shows twice, nested: Next's own `fetch` span
and the undici one under it with the result code; count `AppDependencies`
by `DependencyType == "HTTP"` when the number matters. The **Live metrics** blade on the same resource shows requests
and failures as they happen, useful for the minute after a deploy.

## What is in the code

- `src/lib/log.ts`: `logger(route, request)` returns `info/warn/error`; each
  call prints one JSON line (`ts`, `level`, `msg`, `requestId`, `route`,
  `durationMs`, `associationId`, plus fields). `scrubFields` masks emails to
  `m***@gmail.com` and redacts keys and values that look like secrets
  (`token`, `client_secret`, `sk_`, `whsec_`, `re_`, JWTs, card fields).
  `errorBody(log, message)` is the `{ error, reference }` shape for JSON
  errors. `consoleSink` is where lines go by default; `setLogSink` swaps it.
  Tests: `tests/unit/log.test.ts`.
- `telemetry.mjs`: starts Microsoft's OpenTelemetry distro when
  `APPLICATIONINSIGHTS_CONNECTION_STRING` is set and adds the `fetch`
  (undici) instrumentation the distro lacks. The container loads it before
  Next (`node --import ./telemetry.mjs server.js`, in the Dockerfile),
  because the hooks only see `http` and `fetch` if they are in place before
  Next creates its server; started from inside Next they miss the incoming
  requests. With no connection string nothing runs, so local dev, the unit
  tests and the browser suite never touch the network.
- `src/instrumentation.node.ts`: imports `telemetry.mjs`, which carries its
  packages into the standalone output (the Dockerfile adds the top-level
  link pnpm would have made) and, under a plain `next start`, starts the
  late and partial version; then swaps the log sink for `telemetrySink`.
  The sink lives on `globalThis` (`src/lib/log.ts`) because the server
  bundle holds more than one copy of the log module.
- `src/lib/telemetry.ts`: `telemetrySink` prints the line with the active
  `traceId` and `spanId` on it, then sends warn and error lines on as log
  records; a line with `err` arrives as an exception. Info lines stay on
  the console. Tests: `tests/unit/telemetry.test.ts`.
- `next.config.ts`: `serverExternalPackages` keeps the telemetry packages
  out of the server bundle, so the require hooks and the single global
  OpenTelemetry API instance work.
- Logged routes: `stripe/webhook`, `billing/webhook`, `stripe/connect`,
  `stripe/payment-intent`, `stripe/setup-intent`, `stripe/instruments`,
  `autopay/run`, `assessments/run`, `billing/sweep`, `email/bills`,
  `email/invite`, `email/notify`, `email/send`, `email/webhook`,
  `ops/digest`, `auth/signup`, `join/lookup`, `log`. One line per
  meaningful step.
- `src/proxy.ts`: mints or keeps `x-request-id`, forwards it to the route,
  returns it on the response.
- `src/instrumentation.ts`: `onRequestError` writes every server error to
  the log (hence to Application Insights) and to `app_errors`.
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
  days.
- `supabase/migrations/0052_app_errors_and_cron_runs.sql`: the two tables,
  RLS on, no policies, so only the service role reads them.

## Env vars

| Name                                    | Where                                                               | Value                                                    |
| --------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Set on the web app by `infra/apps.bicep` from the platform's output | Never in `.env.local`: local runs send nothing           |
| `OTEL_SERVICE_NAME`                     | Set on the web app by `infra/apps.bicep`                            | `hoasis-web`, the cloud role name on the application map |
| `PLATFORM_OWNER_EMAILS`                 | `.env.azure` and `.env.local`                                       | `monishnaidu18@gmail.com`; comma separated for more      |
| `BUDGET_EMAIL`                          | `.env.azure`                                                        | Where every alert and budget email goes                  |
| `UPTIME_URL`                            | `.env.azure`                                                        | What the web test calls; empty turns all of this off     |

## Not yet

- **Browser-side telemetry** (the Application Insights JavaScript SDK). The
  error pages already post what the browser caught to `/api/log`; page
  timings can wait until someone says a page is slow.
- **Session replay.** It records screens with balances and addresses on
  them. Stays off.
- **PagerDuty or on-call.** Three alert emails; the phone is for family.
- **A logging library** (pino, winston). `src/lib/log.ts` is ninety lines
  and prints JSON; that is the whole job.

## Reading a log line

```json
{
  "ts": "2026-10-15T14:30:02.118Z",
  "level": "warn",
  "msg": "autopay charge failed",
  "requestId": "K7QM2X4P",
  "route": "autopay/run",
  "durationMs": 8412,
  "associationId": "8a4f…",
  "unitId": "c1d2…",
  "month": "2026-10",
  "rail": "ach",
  "reason": "Insufficient funds",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7"
}
```

`durationMs` is since the route started, so the last line of a request is
its total. `route` is a fixed name, never a path with ids, so a filter on it
matches every call. Emails never appear whole; ids do, because ids are how
you get from a line to a row. `traceId` is on the line only when
Application Insights is on; it is the `OperationId` there.
