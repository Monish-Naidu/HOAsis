# Onboarding a real HOA

Written 2026-09-26 against the code. A board president lands on
yourhoasis.com and wants their association running with residents paying
dues. This walks that path step by step, says what works today, what works
only for Monish, and what does not exist, then lists what is missing to take
a real association end to end, ranked. The last section is what Monish does
by hand for the first ten customers.

Three words used throughout:

- **Works**: a stranger can do it today on production.
- **Monish only**: the code runs, but a setting or an outside account means
  it only works for Monish's own addresses or in Stripe test mode.
- **Missing**: no code, or a code path that ends in a dead end.

## 1. The path, as it exists

| # | Step | State | Where |
| --- | --- | --- | --- |
| 1 | **Landing page.** Reads, links to pricing and `/start`. Claims Apple Pay and Google Pay, a knowledge center, vendor messaging and video calls with vendors that are not built. | Works, overclaims | `src/app/page.tsx` |
| 2 | **Pricing.** $4 per home per month and nothing per payment, 90 days free, no card. One dial, computed from `src/lib/pricing.ts`. | Works | `src/app/pricing/page.tsx` |
| 3 | **Sign up.** First question of `/start`. Name, email, password. `POST /api/auth/signup` creates the user with the admin API and emails the confirmation link through Resend. Nothing in setup waits on the click. | **Monish only.** Production has `EMAIL_FROM=""`, so the sender falls back to `onboarding@resend.dev`, which Resend delivers to the account owner and refuses for everyone else. A stranger sees "We could not send the confirmation email on our side." | `src/app/api/auth/signup/route.ts`, `src/lib/email/sender.ts`, `docs/email.md` |
| 4 | **Email confirmation.** `/auth/callback` exchanges the token, claims any seats under that email, and routes to `/start`, `/board` or `/resident`. | Works once the email arrives | `src/app/auth/callback/route.ts` |
| 5 | **The wizard.** Name, place, kind of homes, dues and due day, shared spaces, who is setting up, extras billed, **when the books start** (new tonight), which home is yours, the builder, the homes, the bank. `create_association` founds it; the founder is President with every capability. Progress survives a reload; a draft finished before the email is confirmed is held on the device and offered back. | Works | `src/app/start/setup-wizard.tsx`, migration 0036 |
| 5a | **The homes.** Number ranges from a plat, a pasted list of addresses, or (new tonight) **a CSV of the roster** with name, email, unit or lot, address, phone and opening balance, previewed row by row. | Works | `src/app/start/roster-import.tsx`, `src/lib/roster/csv.ts` |
| 5b | **The bank.** "Where should dues land" takes an institution and last four for the operating account row. It is a label; it does not move money. Real settlement is the Stripe connected account in step 9. | Works, cosmetic | `src/app/start/bank-step.tsx` |
| 6 | **The plan.** `/start/plan` asks the remaining setup questions one at a time (bank, documents, budget, officers, insurance, reserves, vendors, amenities, photo). `/board/setup` is the status page and, from tonight, carries the **go-live checklist**. | Works | `src/components/app/setup-plan.tsx`, `src/app/board/setup/` |
| 7 | **Invite households.** Homeowners has "Invite N not signed up" and a per home "Email invite" / "Copy invite link". The join code (six characters, on Settings and the invite email) lets a neighbour ask to join; the board approves under Homeowners. | **Monish only** for email (same sender problem as step 3). The copied link works for anyone. | `src/app/api/email/invite/route.ts`, `src/app/join/join-panel.tsx` |
| 8 | **Resident signs up.** From the invite link or the join code. Signing up with the invited email claims the seat when the address is confirmed (`claim_my_seats`). Two owners on one home share one seat. | Works once the confirmation email arrives (step 3 again) | `src/app/join/join-panel.tsx`, migration 0035 |
| 9 | **Stripe onboarding.** Settings > Payments > "Connect Stripe" creates an Accounts v2 connected account and opens Stripe's hosted onboarding; `account.updated` writes `stripe_charges_enabled` and the payout bank. | **Monish only.** Keys are the test-mode sandbox; live keys, the Connect platform review and a legal entity are not done. In test mode it works end to end (Oakview Commons, Mehr Meadows). | `src/app/api/stripe/connect/route.ts`, `src/lib/stripe/account-status.ts`, `docs/design/payments.md` |
| 10 | **First assessment.** `/api/assessments/run` (Vercel cron, daily) bills every home on the due day through `issue_assessment`, once per due date. From tonight it also respects `associations.billing_starts_on` and skips a home whose opening balance already covers the period. The board presses Send on Finances to email the bills. | Works (billing). Emailing the bills: Monish only. | `src/app/api/assessments/run/route.ts`, migrations 0056, 0057 |
| 11 | **Resident pays.** `/resident/pay` renders the Stripe Payment Element when `stripe_charges_enabled` is true; card settles while they watch, ACH shows pending for four days; the Connect webhook is the only writer of settled money (`record_payment`, idempotent). Autopay runs daily. | Works in test mode; live needs step 9 | `src/app/resident/pay/*`, `src/app/api/stripe/webhook/route.ts` |
| 12 | **Board sees money.** Finances shows collected, outstanding, payouts; the payout bank fills the operating row; Homeowners shows each balance and standing. Manual payment receipts to the resident are not emailed. | Works | `src/app/board/money/*` |
| 13 | **Trial ends.** `trial_ends_at` = founding + 90 days. Daily sweep emails the President at 14 days, 3 days, and the day (Monish only, sender). Banner counts down; 14 days after the end the board side locks behind a billing wall; residents never lose their statements. | Works (Monish only for the emails) | `src/lib/billing.ts`, `src/app/api/billing/sweep/route.ts` |
| 14 | **Billing.** "Add a card" opens Stripe Checkout for a per home monthly subscription with the remaining free days as a Stripe trial; the billing webhook writes the status; "Manage billing" opens the portal. | **Monish only.** Same test-mode keys; `STRIPE_BILLING_WEBHOOK_SECRET` is registered against the sandbox. | `src/app/api/billing/*` |

What that adds up to: **the software path is complete in test mode. Two
outside facts stop a stranger today: the sending domain (every email but
Monish's is refused, and sign-up is an email) and Stripe live mode.** Fix
those two and steps 3 to 14 work for anyone.

## 2. Missing to onboard a real HOA, ranked

1. **Owner roster import.** Built tonight. CSV with name, email, unit or
   lot, address, phone, opening balance; preview names each row's problem
   (bad email, duplicate home, bad amount); template download; on `/start`
   and from Homeowners > Import roster; `import_households` creates homes
   and seats, fills blanks on homes already there, seats anyone who already
   has an account, writes each opening balance as one dated "Balance
   brought forward" line. Parser unit tested; RPC verified against the
   database (`scripts/verify-roster-import.mjs`, 19 checks).
2. **Opening ledger and reserve balances.** Per home balances: built (above,
   and `/board/homeowners/opening-balances` already existed). **Bank
   balances are still missing**: the operating and reserve rows start at
   zero and only ledger lines move them. A treasurer moving from a
   spreadsheet needs "the operating account held $12,400 and the reserve
   $86,000 on the switch date" as two confirmed ledger lines. One small
   form on Finances, or two fields on the wizard's bank question. Not built:
   `bank-connect.tsx` and the money screens are outside tonight's boundary.
3. **Fiscal year and first assessment date without double billing.** Built
   tonight: the wizard asks the fiscal year month, the first dues bill date
   (defaults to the next due day, saved to `associations.billing_starts_on`),
   and for an established association the day the balances are true.
   `issue_assessment` refuses a due date before `billing_starts_on` and
   skips a home whose opening balance is dated on or after the due date;
   `import_households` refuses an as-of date that would count a period
   already billed here. **One line still belongs in the cron route**, see
   section 4.
4. **A go-live checklist the board can see.** Built tonight on
   `/board/setup`: roster in, dues set, Stripe live, first assessment
   scheduled, invitations sent, a resident signed in, card on file before
   the trial ends. Derived from the records (`src/lib/go-live.ts`, unit
   tested), each row linking to its fix, urgent in red in the last two weeks.
5. **Invitation email delivery.** Not code. Verify `yourhoasis.com` in
   Resend, set `EMAIL_FROM`, redeploy, rerun `pnpm email:setup`
   (`docs/email.md` has the exact records). Until then nobody but Monish
   can even confirm a sign-up. This is the first thing in the runbook.
6. **The Stripe login confusion.** A treasurer who clicks Connect Stripe
   with an email that already has a Stripe account (their own business,
   their day job) is asked by Stripe for that account's password and lands
   in the wrong dashboard. The fix is words, not code: the connect step
   should say "use the association's own email, the one on its bank
   account, not yours", and the runbook says it on the call. Settings is
   outside tonight's boundary, so the sentence is written in section 4
   for whoever owns `settings-screen.tsx`.
7. **Support contact.** Built tonight: `src/lib/support.ts`
   (`support@yourhoasis.com`), a Help item in the account menu with the
   association in the subject, the address on the error page, the Terms and
   the Privacy pages. **The mailbox itself does not exist yet**: Cloudflare
   Email Routing, `support@` forwarding to Monish, five minutes.
8. **Terms and Privacy.** Built tonight as honest plain-language drafts
   marked for a lawyer, linked from the footer, the sign-up form and the
   wizard's account step. Stripe's Connect review asks for both.
9. **Data export.** Half there: the roster and the transactions export as
   CSV. Missing: one "Export everything" (owners, statements, ledger,
   documents list, meetings, votes) as a zip on Settings, and a per person
   erasure path. Boards ask before they sign; California boards' attorneys
   ask twice.
10. **Per customer runbook.** Section 5.

Also found, not ranked because they are already on `docs/launch-readiness.md`:
late fees promised and never charged; manual payment receipts not emailed;
disputes ignored by the webhook; `/api/dev/reset` gated by one env var;
Supabase and Vercel on free tiers.

## 3. What was built tonight

| Piece | Files |
| --- | --- |
| Roster CSV parser, template, summary | `src/lib/roster/csv.ts`, `src/lib/roster/template.ts`, `tests/unit/roster-csv.test.ts` (13 tests) |
| Preview with row problems | `src/components/app/roster-preview.tsx` |
| Import on the wizard's homes question | `src/app/start/roster-import.tsx`, `src/app/start/setup-wizard.tsx` |
| "When do the books start?" question, follow-up call after founding | `src/app/start/books.ts`, `src/app/start/setup-wizard.tsx`, `src/lib/roster/apply.ts`, `tests/unit/books.test.ts` |
| Import from Homeowners | `src/app/board/homeowners/import/page.tsx`, `import-screen.tsx`; entry point in `homeowners-screen.tsx` (Import roster, settings holders) |
| `import_households` RPC, `billing_starts_on`, the two guards in `issue_assessment` | `supabase/migrations/0056_roster_import.sql`, `0057_roster_import_kind.sql` (applied; types regenerated) |
| Go-live checklist | `src/lib/go-live.ts`, `src/app/board/setup/go-live-checklist.tsx`, `src/app/board/setup/page.tsx`, `tests/unit/go-live.test.ts` |
| Terms, Privacy, links | `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `marketing-chrome.tsx` footer, `sign-in-panel.tsx`, `account-step.tsx` |
| Support address | `src/lib/support.ts`, `account-menu.tsx` (Help), `error.tsx` |
| Database proof | `scripts/verify-roster-import.mjs` (19 checks, all green 2026-09-26) |

## 4. Two changes outside tonight's boundary

**`src/app/api/assessments/run/route.ts`.** The RPC now refuses a due date
before `billing_starts_on`, so nothing bills wrongly, but the route's dry
run still reports "would bill" for a period the RPC will refuse, and the
route does an RPC call it does not need. Two lines:

```ts
        .select("id, name, dues_cents, dues_cadence, due_day, fiscal_year_start, created_at, billing_starts_on")
```

and, where `duesToIssue` is called:

```ts
        since: a.billing_starts_on ?? a.created_at,
```

`duesToIssue` already drops a period whose due date is before `since`.

**`src/app/board/settings/settings-screen.tsx`, the Connect Stripe step.**
One sentence above the button:

> Stripe will ask for an email. Use the association's own address, the one on
> its bank account, not a personal one. If Stripe asks for a password you do
> not know, that email already has a Stripe account; go back and use the
> association's.

## 5. Runbook, the first ten customers

What Monish does by hand, in order, per association. Ten lines.

1. Before anyone: verify the Resend domain and set `EMAIL_FROM`; create
   `support@yourhoasis.com` in Cloudflare Email Routing; swap Stripe to live
   keys and submit the Connect review with `/terms` and `/privacy`.
2. Thirty minute call. Ask for their roster as a CSV (name, email, unit or
   address, phone, balance owed today), the dues amount and due day, the
   fiscal year, and the association's own email address and EIN.
3. Watch them sign up at `/start`. If the confirmation email does not land
   in two minutes, check `email_log` and the Resend dashboard, then resend
   from Homeowners once they are in.
4. On the homes question, import the CSV together. Read the preview aloud:
   every red row is a question for them, not a bug.
5. On "When do the books start?", set the first bill to the next due date
   the old system has not already billed. Balances as of today.
6. Once founded, open `/board/setup` and read the go-live list top to bottom.
7. Settings > Payments > Connect Stripe, with the association's email, not
   the treasurer's. Stay on the call until `stripe_charges_enabled` is true
   (`select name, stripe_charges_enabled from associations`).
8. Homeowners > "Invite N not signed up". Watch `email_log` for the first
   delivered row. Ask one resident on the call to sign up and pay $1 by
   card; refund it from their Stripe dashboard the same day.
9. The next morning, check the cron ran (`cron_runs`) and that the first
   period billed once per home; open one resident statement and read it.
10. Day 76: the 14 day trial notice goes to the President. Call them that
    week; the card goes on file from Settings > Billing.

## 6. Checks run tonight

`npx tsc --noEmit` clean. `pnpm lint` clean (three pre-existing warnings in
`scripts/`). `pnpm vitest run`: 48 files, 742 tests, all passing.
`node scripts/verify-onboarding.mjs`: 10/10. `node
scripts/verify-roster-import.mjs`: 19/19. `/terms`, `/privacy`, `/start`,
`/board/setup`, `/board/homeowners/import` render on a sibling dev server.
`pnpm build` not run, per instructions.
