---
name: qa-backend
description: Diff-selected safe local HTTP QA for Your HOAsis. Use for public responses, redirects, headers, and credential-free error behavior; block signed-in and external integration writes.
---

# Backend QA

## Run contract

From the repository root:

```bash
python3 scripts/qa/run.py run --base <explicit-ref>
```

The runner starts a fresh QA-owned isolated local demo from the branch, excludes
`.env*`, passes an environment allowlist, launches the agent, and finalizes.
The agent must receive `QA_BASE_URL`, `QA_RUN_ID`, `QA_BROWSER_PROFILE`,
`QA_RESULTS_DIR`, `QA_DIFF_BASE`, and `QA_DIFF_HEAD`. Require these and a loopback
`QA_BASE_URL`; otherwise report BLOCKED. Do not start a server, change URL,
borrow port 3000, load `.env*`, inject secrets, or reuse a developer session.

Read `.factory/skills/qa/config.yaml` at runtime, including `video_evidence`
and `droid_control.compose`. Missing/invalid config is BLOCKED. Use the single
run-owned `QA_BROWSER_PROFILE` for any browser work and keep evidence under
`QA_RESULTS_DIR`. Clean up only owned client resources. The runner owns server
and workspace cleanup.

No automated suites in runtime QA. Do not run `pnpm check`, lint, unit tests,
Playwright, `pnpm api:verify`, `pnpm db:verify`, migrations, verification scripts,
or reset tools. Do not install dependencies, edit app code, commit, post
findings, or upload media.

## Select requests from the diff

Read the changed handler, relevant middleware/config, and called helpers before
sending any request. Compare `QA_DIFF_BASE` and `QA_DIFF_HEAD`; choose only
affected safe HTTP behavior and its adjacent negative case. This is a menu,
not a full API sweep. State method, path, expected status/body/header, and why
the request cannot mutate a database or call an external service. Method names
are not a safety guarantee: a GET can send mail or run a cron job.

Make only bounded, credential-free requests to the supplied local origin.
Do not follow redirects automatically; inspect each Location and stay within
the allowed origin. Use a few explicit cases, not fuzzing, load tests, or
rate-limit saturation. Do not infer a handler's expected status from its name.

| Safe local menu                                                                                     | Visible/HTTP success                                                                                                                                                                                                | Adjacent negative or limit                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public GET/HEAD for changed `/`, `/about`, `/pricing`, `/library`, `/privacy`, `/terms`, or `/demo` | Expected content type, status, rendered public content, and applicable headers match the current implementation.                                                                                                    | A unique nonexistent public path returns a genuine not-found response rather than leaked diagnostics. A client-rendered demo redirect is browser behavior, not an HTTP Location guarantee.                                                            |
| Redirects from `next.config.ts`                                                                     | `/admin/<existing-board-subpath>` has the configured permanent redirect to `/board/<same-subpath>`; inspect Location without following.                                                                             | Bare `/admin` must not be swept into the legacy `/admin/:path+` redirect. Do not enter or test private admin operations.                                                                                                                              |
| Security/cache headers on selected public responses                                                 | Inspect exact headers from current config: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, Permissions-Policy, and CSP directives where applicable. | Compare a selected error response as well as a success. Current CSP is limited to base/object/frame ancestry; its presence does not prove a complete script policy or eliminate XSS.                                                                  |
| `GET /api/health` in the secret-free demo                                                           | Expect HTTP 503, `Cache-Control: no-store`, JSON `ok: false`, and named checks for supabase, stripe, resend, cron, and telemetry. Missing credentials are reported without secret values.                           | Optional telemetry absence is healthy; missing integrations are not. A configured database/key in an allegedly isolated run is a boundary problem: stop, do not connect to diagnose it. This response proves only graceful missing-service reporting. |
| Unsupported methods or malformed input on a changed local handler                                   | Only if fresh code inspection proves rejection happens before auth clients, external calls, logging/database writes, or jobs: send one harmless invalid request and compare exact implemented response.             | Use one adjacent malformed/missing field case if equally safe. If order or side effects are uncertain, mark BLOCKED. Do not assume every API rejects with 400 or 401.                                                                                 |

For a changed API with no safe case, report it BLOCKED rather than manufacturing
coverage through a different endpoint. Inspecting code is not an HTTP pass.

## Hard blocked operations

These remain BLOCKED even if test mode, missing secrets, or an error response
seems likely:

- Signed-in Supabase operations, SQL/RLS checks, service-role requests, storage
  writes, real account creation, login submission, OTP exchange, magic links,
  membership claims, and auth callback requests. `/auth/callback` constructs a
  Supabase client before its missing-code rejection; do not use it as a harmless
  malformed-link probe.
- Stripe payment intents, setup intents, instruments, Connect, billing checkout,
  portal, saved methods, and autopay. Do not run `13-payments.spec.ts`, use test
  cards, or forward Stripe events.
- Resend/mail, invitations, office messages, join notifications, and all other
  notification sends. Do not submit signup or resend forms.
- Webhook delivery/replay, even fake or invalid signatures, on
  `/api/stripe/webhook`, `/api/billing/webhook`, or `/api/email/webhook`.
- Cron/job execution, including GETs: `/api/assessments/run`,
  `/api/autopay/run`, `/api/billing/sweep`, and `/api/ops/digest`.
- `/api/dev/reset`, `/dev/reset`, database resets, migrations, production writes,
  telemetry/error ingestion writes such as a successful `POST /api/log`, and
  any endpoint whose side effects are not understood.

Missing-service responses do not prove those integrations work. Do not broaden
the environment, provide credentials, or switch to a remote target to unblock
them. Safe browser-only business-flow checks belong to `qa-web`.

## Evidence and reporting

Record the selected request method/path, status, relevant headers, sanitized
response excerpt, expected result, observed result, and PASS/FAIL/BLOCKED.
Preserve local evidence under `QA_RESULTS_DIR`. Include run ID and diff refs.
Do not print cookies, authorization headers, tokens, or environment values.

When browser evidence is needed, invoke installed `droid-control` and use its
web target route with Browser-use, Capture, and Verify atoms. Defer all driver
commands and recording mechanics to that plugin. Use only the provided
`QA_BASE_URL`, run ID, profile, and results directory. Honor runtime
`video_evidence`; Compose is loaded/used only if both `video_evidence` and
`droid_control.compose` are enabled, with literal props `{"preset":"factory"}`.
No Compose otherwise, no dependency installation, and no media uploads.
Missing evidence tooling is BLOCKED. HTTP-only observations need not invent
a browser video.

Return concise findings and evidence paths to the caller, not a posted report.
List selected cases and blocked integration requirements separately. Do not
describe a 503 from this intentionally secret-free demo as a production outage.

## Known failure modes

- Supabase absent is expected here. Demo behavior and UI capability controls
  are not authentication, tenant isolation, SQL RLS, or persistence proof.
- Demo `TODAY` is pinned to `2026-08-20`; it is not the host date or service time.
- Fixtures in `src/lib/data/accounts.ts` differ from role defaults. For linked
  browser work use `qa-web`'s exact personas and actual view/change distinctions,
  never real emails or credentials.
- Unavailable Supabase, Stripe, Resend, webhook, or cron behavior is BLOCKED,
  not passed by receiving any error.
- Only an explicit user request permits separate read-only public checks on
  `https://www.yourhoasis.com`. Never use live checks as PR proof or fallback;
  no login, posts, form submission, payments, private routes, or remote writes.
