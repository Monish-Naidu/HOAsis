# First HOA readiness

The working checklist for onboarding the first real association, started
2026-10-22. It separates what is checked from what is still open. A row says
"passed" only when a command, test or browser walk on that date produced the
result named in its evidence. Test-mode Stripe success is not live payment
readiness, and nothing here is legal or business sign-off.

Evidence paths under `scripts/.qa/readiness-20261022/` are local and ignored by
git (`.gitignore`, `scripts/.qa/`). They hold logs and screenshots with no
secrets; the env files in that folder hold secrets and are never shared.

Status words: **Working** (checked, evidence named), **Fixing** (a defect is
confirmed and a fix is assigned), **Untested** (no check has run yet),
**Owner gate** (needs Monish or an outside party; code cannot close it).

## Test and environment foundation

| Item                                    | Status  | Evidence                                                                                                                                                                                                                                                                                        | Next action                                                                             |
| --------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Demo suites ignore a configured backend | Working | Before the fix, with the local stack env loaded, three demo tests failed (screens, app-state, review-fixes: 3 failed, 120 passed). `tests/demo-env.ts` now removes backend variables before any module loads; the same command with the same env passed 129/129 including the new target tests. | None.                                                                                   |
| Database checks refuse a remote target  | Working | `scripts/lib/verify-target.mjs`; `tests/unit/verify-target.test.ts`. `node scripts/verify-all.mjs` with the default `.env.local` (production) exits 1 with "Refusing" and runs no suite. With the readiness env and guard it prints the local target `http://127.0.0.1:54321`.                  | Owner: set `VERIFY_REMOTE_HOST` only when deliberately verifying a remote project.      |
| Readiness local stack                   | Working | 120 migrations applied unchanged to the isolated local stack; 8/8 Auth, database and Storage checks (`verify-local.mjs`). Ports: API 54321, database 54322, Mailpit 54324, app 3100, frozen demo 3101.                                                                                          | Remove the scratch `auto_expose_new_tables` flag before the CLI drops it on 2026-10-30. |
| Integration and release droids mirrored | Working | `.factory/droids/` and `.claude/agents/` copies of `integrations-engineer` and `release-operator`; `pnpm agents:verify` reports 7 agents and skills match.                                                                                                                                      | None.                                                                                   |
| Full gate (`pnpm check`)                | Working | 2026-10-22 on this branch with backend variables cleared: exit 0; formatting, lint, types, agent docs (7 mirrored), 31 module flags, API reference, knip and duplicates passed; Vitest 168 files, 2,304 tests; build 142/142 pages.                                                             | Run before every commit.                                                                |
| Fresh demo build                        | Working | 142/142 pages generated from a credential-cleared build (`build-fresh.log`). The older frozen artifact had production test logins baked in and is not used.                                                                                                                                     | Rebuild before each browser regression run.                                             |

## Onboarding

| Item                                                              | Status  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Next action                                                                                                                   |
| ----------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Founder creates an association and reaches the board              | Working | Local browser walk: `/start`, founding, `/board`, `/board/settings`, `/resident` (`validation-readiness.md`, `screenshots/validation-*.png`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | None.                                                                                                                         |
| Books dates and imported balances survive a failed follow-up step | Working | The created association and the exact dates and balances are kept in `hoasis:pending-books` until both follow-ups succeed; the wizard shows what is not saved and retries without founding again (`tests/unit/wizard-books-recovery.test.tsx`, `tests/unit/founding-books.test.ts`). Demo founding keeps the same dates and cents (`tests/integration/founding-books-demo.test.tsx`). `verify-roster-import.mjs` 26/26 locally, including the same import twice: one opening line per home, total 16550 cents. Local browser walk: budget year July, first bill 2026-12-01, $185.50 and -$20.01 stored exactly, no pending books left. | None.                                                                                                                         |
| Local sign-in callback keeps the origin                           | Working | Next reports `localhost` for any loopback address, so the callback now uses the `Host` header only when it names a loopback address on the same port. A magic link opened on `127.0.0.1:3100` lands signed in at `127.0.0.1:3100/start`. A foreign host, user info, another port or an outside `next` falls back to the request origin and `/board` (`tests/unit/auth-callback.test.ts`).                                                                                                                                                                                                                                              | Other routes that build links from `nextUrl.origin` (billing, Connect) still say `localhost` locally; harmless in production. |

## Tenants, seats and permissions

| Item                                        | Status   | Evidence                                                        | Next action                                            |
| ------------------------------------------- | -------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| Row level security and isolation suites     | Untested | Not yet run against the readiness stack in this session.        | Run `rls`, `isolation`, `owners`, `two-homes` locally. |
| Invitations, approval, co-owner permissions | Untested | Demo join reachability only (`/join`); no real invitation sent. | Signed-in local walk in the notifications milestone.   |

## Money: dues through Stripe Connect

| Item                                          | Status   | Evidence                                                                                                   | Next action                                    |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Webhook signatures                            | Working  | Both webhook routes: signed no-op 200, replay 200, bad signature 400 (`validation-readiness.md`).          | None.                                          |
| Demo payment, statement and balance agree     | Working  | Demo $285 payment, statement balance $0.00 after reload, twice in fresh contexts (`browser-readiness.md`). | None.                                          |
| Connected-account onboarding, payment, refund | Untested | No connected account created yet; synthetic events prove signature handling only.                          | Stripe test-mode run in the billing milestone. |

## Software billing (the association's subscription)

| Item                                                                      | Status  | Evidence                                                                                       | Next action        |
| ------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| Hosted setup Checkout reachable                                           | Working | Test-mode setup session reached in the browser; no card submitted (`validation-readiness.md`). | None.              |
| One customer and subscription per association under retries               | Fixing  | Audit found concurrent or repeated starts can create duplicates.                               | Billing milestone. |
| Trial end preserved, including the last 48 hours                          | Fixing  | Checkout refuses trials shorter than 48 hours.                                                 | Billing milestone. |
| Webhook retries on database failure; old events cannot undo current state | Fixing  | Audit finding.                                                                                 | Billing milestone. |
| Billed quantity counts active homes only                                  | Fixing  | Audit finding.                                                                                 | Billing milestone. |

## Notifications

| Item                                                                                                 | Status   | Evidence                                                                                  | Next action                         |
| ---------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| Resend accepts a send                                                                                | Working  | One labeled message to an operator address accepted; provider id in `resend-result.json`. | None.                               |
| Inbox delivery                                                                                       | Untested | The local key is send-only; acceptance is not delivery.                                   | Owner: confirm the message arrived. |
| Board told about new requests and replies                                                            | Fixing   | Audit finding.                                                                            | Notifications milestone.            |
| Join notifications retry without duplicates; delivery webhooks retry and never move status backwards | Fixing   | Audit finding.                                                                            | Notifications milestone.            |
| Bill links open the right association and home                                                       | Fixing   | Audit finding for a person with several homes.                                            | Notifications milestone.            |

## Files

| Item                                          | Status  | Evidence                                                                     | Next action              |
| --------------------------------------------- | ------- | ---------------------------------------------------------------------------- | ------------------------ |
| Storage upload and download                   | Working | Local private bucket upload, download and cleanup (`verify-local.mjs`, 8/8). | None.                    |
| Form uploads keep the file, not only its name | Fixing  | Audit: the visible form upload path stores metadata only.                    | Notifications milestone. |

## Telemetry and job health

| Item                                                            | Status  | Evidence                                                                             | Next action                                            |
| --------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Production telemetry arrives                                    | Working | Application Insights shows recent requests; read-only check.                         | None.                                                  |
| Tokens, emails and secrets kept out of traces and stored errors | Fixing  | Audit finding: query values and embedded credentials can reach exported spans.       | Feature `private-actionable-telemetry-and-job-health`. |
| Digest flags failed, missing and stale daily jobs               | Fixing  | Five latest jobs succeeded in production, but absence and staleness are not flagged. | Same feature.                                          |

## Support and recovery

| Item                                   | Status     | Evidence                                                                     | Next action                                         |
| -------------------------------------- | ---------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| Support addresses forward              | Working    | `hello@` and `support@` route through Cloudflare (`docs/go-live-monish.md`). | None.                                               |
| Database backups exist                 | Working    | Seven retained full backups on the Azure server; read-only check.            | None.                                               |
| Backup restore                         | Owner gate | No restore has been performed.                                               | Owner: restore one backup to a scratch server once. |
| Operator alert reaches a person        | Owner gate | Alerts are configured; delivery to an inbox or phone is not shown.           | Owner: trigger a test alert and confirm receipt.    |
| Deploy proves the new revision is live | Fixing     | Audit: the deploy check can pass on the previous healthy revision.           | Release milestone.                                  |
| Scheduled security scan                | Fixing     | The scan's issue-writing step fails on permissions.                          | Release milestone.                                  |

## Legal, business and live gates

These stay open until the owner closes them. Nothing in this mission closes them.

| Gate                                              | Status     | Next action                                                                |
| ------------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| Stripe live keys and Connect platform review      | Owner gate | Submit the platform review, then switch keys (`docs/launch-readiness.md`). |
| Terms and privacy reviewed by a lawyer            | Owner gate | The pages are drafts; keep their draft notice until reviewed.              |
| Legal entity, business bank account and insurance | Owner gate | Owner decision and purchase.                                               |
| Azure subscription suitable for paying customers  | Owner gate | Confirm the current credit subscription allows commercial use.             |

## Decision log

Choices made without the owner, who asked for the recommended safe option
and a reason.

| Date       | Choice                                                                                                                                                | Reason                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-22 | Work on branch `readiness/first-hoa-2026-10-22`, never on `main`.                                                                                     | Merging `main` deploys to Azure.                                                                                                                    |
| 2026-10-22 | Run integration work against an isolated local Supabase stack in a user-owned Colima VM, with its env file and guard in the ignored readiness folder. | `.env.local` points at production; a local stack gives real SQL and Auth without writing customer data.                                             |
| 2026-10-22 | Database checks now refuse any host other than loopback unless `VERIFY_REMOTE_HOST` names it.                                                         | `pnpm db:verify` used to follow `.env.local` to production by default. Naming the host keeps a deliberate remote run possible.                      |
| 2026-10-22 | Unknown suite names passed to `verify-all.mjs` fail instead of running nothing and reporting success.                                                 | A typo used to print "Every database check passed."                                                                                                 |
| 2026-10-22 | Demo test suites remove backend variables in a first setup file rather than relying on each command to blank them.                                    | Every shell, CI job and helper gets the same demo behaviour without remembering a long prefix.                                                      |
| 2026-10-22 | Vitest runs at most four workers.                                                                                                                     | The same 18 GiB machine runs the dev server, the Docker stack and browsers; four workers kept the full suite fast without swapping.                 |
| 2026-10-22 | The new droids say who owns `src/lib/app-state/`, migration numbers and the git index, and that only one gate runs at a time.                         | Two writers there at once is the failure the repository rules warn about.                                                                           |
| 2026-10-22 | Keep pending founding books in the browser (`hoasis:pending-books`) instead of a new database table or RPC.                                           | The existing date update and `import_households` are already safe to repeat, so retrying the same input cannot duplicate homes or opening balances. |
| 2026-10-22 | The sign-in callback trusts the `Host` header only for loopback names on the same port, and never `x-forwarded-host`.                                 | Fixes the local hostname switch without opening a redirect to a host the request did not come from.                                                 |
| 2026-10-22 | Leave live Stripe, legal, entity, insurance and Azure plan questions as owner gates.                                                                  | They need the owner or an outside party; marking them done would be false.                                                                          |
