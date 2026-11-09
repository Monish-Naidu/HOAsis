---
name: qa-web
description: Diff-selected browser QA for Your HOAsis in the runner-owned isolated local demo. Use for visible flows, fixture role boundaries, and visual evidence, not signed-in integration proof.
---

# Web QA

## Run contract and boundaries

From the repository root, start a run with an explicit comparison ref:

```bash
python3 scripts/qa/run.py run --base <explicit-ref>
```

The runner starts a fresh QA-owned isolated local demo from the branch, excludes
`.env*`, passes an environment allowlist, launches the QA agent, and finalizes
the run. Do not start another server, reuse a developer server, install
dependencies, or change the target URL. Never use port 3000 as a fallback.

Inside the agent, require `QA_BASE_URL`, `QA_RUN_ID`, `QA_BROWSER_PROFILE`,
`QA_RESULTS_DIR`, `QA_DIFF_BASE`, and `QA_DIFF_HEAD`. Missing context or isolation
is BLOCKED. Use only the supplied loopback origin for PR QA. Use exactly one
run-scoped browser profile, `QA_BROWSER_PROFILE`, across persona switches. Do
not attach to personal profiles. Keep evidence inside `QA_RESULTS_DIR`; close
only this run's browser resources. The runner owns server and workspace cleanup.
Do not kill unrelated processes or clear another profile's storage.

Read `.factory/skills/qa/config.yaml` at runtime, including `video_evidence`
and `droid_control.compose`. Missing or invalid config is BLOCKED, not permission
to guess defaults.

Do not run automated suites during runtime QA: no `pnpm check`, lint, vitest,
Playwright, API verification, SQL verification, or database reset. Existing
tests are scenario references, not commands to execute. Do not edit app code,
commit, post comments, upload media, or change service credentials.

## Select a small scenario set

Inspect the diff between `QA_DIFF_BASE` and `QA_DIFF_HEAD`, then read the affected
routes, components, selectors, fixtures, and relevant test cases. Include shared
code's affected consumers. Name selected menu rows, the changed behavior each
proves, persona, visible success condition, and one adjacent negative case
before interacting. This is a MENU, not a mandatory full-product checklist.
Unrelated rows are out of scope; record them as not selected, not passed.

Use existing app demo data as the target product, not a substitute mock for a
real integration. Do not inject a passing result, bypass a capability gate, or
seed a fake authenticated session. Browser-only demo mutations are allowed in
this isolated copy. Supabase, Stripe, Resend, webhook, cron, and signed-in writes
are BLOCKED even if a screen offers them. Inspect the mutation branch before
an uncertain action; stop if it can reach an external service.

## Personas and actual fixture permissions

Read `src/lib/data/accounts.ts` fresh. Enter via `/demo?as=<account-id>` on
`QA_BASE_URL`, and verify the visible identity and landing page before acting.
The default QA resident is Monish, not the bare `/demo` entry's president.

| Persona                      | Account ID / home ID      | Actual seeded change access                                     |
| ---------------------------- | ------------------------- | --------------------------------------------------------------- |
| Monish Naidu, resident       | `acct-monish` / `own-042` | No board capabilities or views.                                 |
| Arya Mehr, president         | `acct-arya` / `own-007`   | All grantable areas and `permissions`.                          |
| Dana Whitcomb, treasurer     | `acct-dana` / `own-019`   | Finances, vendors, requests, documents, compliance.             |
| Sofia Bergman, secretary     | `acct-sofia` / `own-031`  | Documents, communications, voting, requests, compliance, forum. |
| Ellis Wright, vice president | `acct-ellis` / `own-071`  | Requests, voting, communications, forum.                        |
| Nina Sharma, resident        | `acct-nina` / `own-015`   | No board capabilities or views.                                 |

All four officers have views of every grantable area. View access is not change
access. Only Arya grants capabilities or transfers presidency. All six also own
homes and can use the resident side. Do not paste real emails, passwords, tokens,
or credentials. Use names and IDs for seat selection; if a local-only form
requires contact data, use synthetic `example.com` data.

## Diff-selected scenario menu

Read the referenced tests and current UI for exact labels; do not replay every
test. Each selected row needs an observed outcome, not just a page opening.

| Area and routes                                                                                                                                                                                                                           | Visible success                                                                                                                                                                                                                                                    | Adjacent negative or boundary                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo entry: `/`, `/demo`, `/demo?as=acct-monish`, `/demo?as=acct-arya`, `/signin`                                                                                                                                                         | Demo entry lands on the selected seat's resident or board workspace with matching identity and usable navigation. Bare `/demo` opens Arya's board; explicit Monish opens `/resident`.                                                                              | Unknown `as` falls back to president; a resident typing `/board/money` or `/board/settings` must not see board figures or editing controls. Viewing sign-in is allowed; submitting authentication is BLOCKED.                                                                                        |
| Setup and imports: `/start`, `/start/plan`, `/board/setup`, `/board/homeowners/import`, `/board/homeowners/opening-balances`, `/board/documents/import`                                                                                   | Use “Look around first”, not account creation. Walk only the changed situation/property path; required steps advance, preview shows imported rows, and accepted browser-only records appear in their destination. Setup progress reflects what actually completed. | Blank required answers, malformed or duplicate roster rows, invalid balances, reversed lot ranges, and back/forward preservation as relevant. Online payments in the look-around copy remain unavailable, not falsely completed.                                                                     |
| Roles: `/board`, `/board/settings`, affected board area, `/resident`                                                                                                                                                                      | Arya can change the selected area; the intended officer can read or change it according to actual fixtures. A successful demo change survives navigation/reload where supported.                                                                                   | Dana can change requests but only view communications; Ellis can change communications and voting but only view finances and settings; Sofia can change documents but only view finances. Monish and Nina cannot use board tools. Check a direct URL as well as navigation for the changed boundary. |
| Finances: `/board/money`, `/board/money/transactions`, `/board/money/collections`, `/board/money/budget`, `/board/money/statements`, `/board/shared-costs`, `/board/reserves`, `/resident/pay`, `/resident/account`, `/resident/finances` | As Dana or Arya, exercise the changed browser-only bookkeeping action; compare the resulting row, balance, status, and relevant summary. As Monish, match displayed payable amount and own statement.                                                              | Zero, negative, huge amount, same amount twice, cancel, or repeat confirmation as relevant. Sofia/Ellis must not gain finance change controls. Stop before Stripe, bank linking, saved instruments, autopay, or real payment actions; those are BLOCKED.                                             |
| Home ownership: `/board/homeowners`, `/board/homeowners/import`, `/board/homeowners/opening-balances`, resident home switcher                                                                                                             | Arya's local ownership/roster edit appears on the correct home; a demo sale replaces the seller with the buyer and preserves the closing statement trail. A home switch updates the selected home's figures.                                                       | Required buyer fields, cancel without change, duplicate owner, two owners on one home, one person with two homes, or ended seat as applicable. Never assume home ID is person ID. If fixture/UI cannot reach an edge, mark that edge BLOCKED rather than inventing a seat.                           |
| Requests and files: `/resident/requests`, `/resident/requests/new`, `/resident/requests/[reference]`, `/resident/report`, `/board/requests`                                                                                               | Monish creates a local request with synthetic content; detail shows the correct reference, status, and attachment. Dana/Sofia/Ellis can perform the selected request action. Reopen the attachment and verify its content, not only its filename.                  | Empty required content, rejected type/size, cancel, invalid reference, duplicate click, and Nina's separate resident view as relevant. A failure must not leave a success toast or orphan visible record. Demo checks do not prove private storage authorization.                                    |
| Documents and forms: `/resident/documents`, `/resident/documents/governing`, `/resident/documents/what-you-agreed-to`, `/resident/documents/forms/[formId]`, `/board/documents`, `/board/documents/governing`, `/board/settings`          | Sofia/Arya can make the changed local record; Monish can find it, read exact wording or cited summary, open the form, or download actual uploaded content. Search can find governing-document body text, not only titles.                                          | No-match search, missing form ID, required form fields, invalid upload, cancel, and read-only officer controls as relevant. Do not accept a renamed placeholder as proof of uploaded bytes. External storage persistence remains BLOCKED.                                                            |
| Messages and notices: `/resident/messages`, `/resident/notices`, `/board/communications`, `/board/communications/announcements`                                                                                                           | Sofia/Ellis/Arya can create the selected browser-only reply or announcement; the intended resident sees the thread/notice, matching content and unread state. “Mine” filters by office, not all board conversations.                                               | Empty reply, wrong recipient/audience, cancellation, duplicate send, and Dana's view-only communications access. Any real email delivery, invite, or notification send is BLOCKED; a demo toast is not delivery proof.                                                                               |
| Meetings and voting: `/board/meetings`, `/board/voting`, `/resident/calendar`, `/resident/calendar/[id]`, `/resident/vote`                                                                                                                | Sofia/Ellis/Arya's changed local meeting, minutes, RSVP, or ballot action appears in the matching resident view with correct phase and tally. Distinguish rules from covenant amendment thresholds when changed.                                                   | Closed/future ballot, duplicate vote for one home, cancelled meeting, invalid date, and Dana's view-only voting access as relevant. Do not join external calls or send real meeting notices.                                                                                                         |
| Settings: `/board/settings`, `/resident/settings`                                                                                                                                                                                         | Arya's local association or capability change affects the intended screen. Monish's theme, text size, or contact edit visibly persists at the supported local scope.                                                                                               | Non-president cannot grant capabilities; officer view-only settings do not expose edits. Invalid contact values, cancel, and theme/text-size overflow as relevant. Do not trigger account deletion, invitations, billing, or external writes.                                                        |

Scenario references: `tests/e2e/01-marketing.spec.ts`, `02-board.spec.ts`,
`03-roles.spec.ts`, `05-forms-and-documents.spec.ts`, `07-onboarding.spec.ts`,
`08-complete-setup.spec.ts`, `10-documents.spec.ts`, and `11-home-sale.spec.ts`.
`13-payments.spec.ts` requires real test integrations and is explicitly outside
this module. Read it only to identify that boundary.

## Capture, verify, and report

Invoke the installed `droid-control` skill and follow its web target route:
load Browser-use, Capture, and Verify atoms. Defer driver commands, recording
lifecycle, waits, and verification mechanics to that plugin; do not duplicate a
raw browser-driver recipe here. Supply the runner-owned URL, run ID, profile,
and results directory. Keep navigation, popups, and downloads scoped to the
allowed run; do not follow external links.

Read `video_evidence` and `droid_control.compose` for this run. Capture video
when `video_evidence` enables it; otherwise retain screenshots and observations.
Load/use Compose only when both `video_evidence` and `droid_control.compose` are
enabled, and use the literal props `{"preset":"factory"}`. Do not compose when
either is disabled. Missing evidence tooling is BLOCKED; never install it or
claim a recording exists. Never upload recordings or screenshots.

For visual changes, read `docs/design/ui-baseline.md` and inspect screenshots
in both light and dark themes at 390px resident phone width and 1440px desktop
width for the affected surfaces. Check text size, wrapping, horizontal overflow,
focus visibility, overlays, and primary action reachability. For behavior-only
changes, capture the selected success and negative outcomes at the relevant
viewport. Observe the result after each action; recover from current evidence
before retrying, not by blindly repeating writes.

Return selected scenario, persona, route, expected/observed result, PASS/FAIL/
BLOCKED, and local evidence path. Include diff refs, run ID, URL, theme/viewport,
repro steps for failures, and untested integration boundaries. A blocked case
is not a pass. Return findings to the caller; do not publish or post them.

## Known failure modes

- Supabase absent means browser-only demo, not proof of login, tenancy, SQL RLS,
  durable writes, private file authorization, or integration delivery.
- Demo `TODAY` is pinned to `2026-08-20`. Inspect the route's date helper before
  calling a date state wrong; never advance the machine clock.
- Fixture roles are not identical to `DEFAULT_ROLE_CAPABILITIES`. Dana lacks
  communications change access; Ellis lacks finance/settings change access.
- Persona switches share local demo state. Record initial state; a previously
  changed fixture is not a clean baseline. Clear only run-owned state if needed.
- Unavailable services and unreachable fixture edge cases are BLOCKED. Do not
  add secrets, fake integration success, or retry against production.
- `https://www.yourhoasis.com` is allowed only when explicitly requested for
  separate read-only public checks, never as fallback or PR validation. No
  login, posts, form submission, payments, or private routes on the live site.
