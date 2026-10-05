# Launch readiness

Written 2026-09-25 against the code, not the roadmap. What is missing before
the first paying HOA, what can wait, and the first thirty days. Each item
names the file or setting so it can be ticked off.

Priorities: **Blocker** = before money moves for a real association.
**Month 1** = before the first dues cycle closes. **Month 3** = before the
trial converts. **Later** = when a board asks.

## 1. Blockers before the first paying customer

| # | Item | Why | Where |
| --- | --- | --- | --- |
| 1 | **Stripe live keys.** Run `pnpm stripe:setup` with the live key, replace the five values in Vercel. | Everything is test mode; the yellow "Test mode" box shows on Settings and Pay. | `docs/design/payments.md` |
| 2 | **Connect platform review.** Stripe asks for: business description, a site with pricing and terms, fund flow (direct charges, HOA is merchant of record), refund and dispute policy, support email and URL, the platform's legal entity. A few days. | Live connected accounts cannot take cards until approved. | Stripe > Settings > Connect |
| 3 | **Verify yourhoasis.com in Resend; set `EMAIL_FROM` and `RESEND_WEBHOOK_SECRET`; rerun `pnpm email:setup`.** Production has `EMAIL_FROM=""`; the fallback sender reaches only Monish. | No resident can receive a confirmation, invite, bill or receipt. Nothing else matters until this is done. | `docs/email.md`, `src/lib/email/sender.ts` |
| 4 | **Terms and Privacy pages.** Neither exists under `src/app`; `MarketingFooter` links only the nav and Log in. Add `/terms`, `/privacy`; link from footer, `/signin`, `/start`, Checkout. | Stripe review fails without them; a treasurer asks on day one. | `src/components/app/marketing-chrome.tsx` |
| 5 | **Refund and cancellation policy in words.** Code already does both (`record_refund`, migration 0049; Danger zone cancel keeps data). Say: dues refunds are the treasurer's call from Stripe; software fee monthly, cancel any time, no proration. | Stripe asks; boards ask. | `src/components/app/danger-zone.tsx` |
| 6 | **Data processing description.** What is stored, where (Supabase US East, Vercel, Stripe, Resend), retention (soft delete 30 days), who sees it (RLS per association; Monish via service role). | Boards forward it to their attorney. Seeds the privacy page. | `docs/tenancy.md` (in progress) |
| 7 | **Supabase Pro.** Free tier pauses after a week idle (2026-09-19, looked deleted), has no backups worth the name. Pro ($25/mo) gives 7-day backups; PITR add-on (~$100/mo) at the first paying customer. | A ledger with no restore path is not a product. | `docs/scale.md` §5 |
| 8 | **Vercel Pro.** Hobby is non-commercial, 60s functions, no log retention. | Licence terms and support logs. | `vercel.json`, `src/lib/cron.ts` |
| 9 | **Support inbox and status page.** No support address anywhere in code. `support@yourhoasis.com` (Cloudflare Email Routing), on `/terms`, footer, billing wall, `error.tsx`. Free Instatus page. | Stripe asks for a support URL; a locked-out president needs somewhere to write. | `src/app/error.tsx`, `billing-gate.tsx` |
| 10 | **Demo text a customer can reach.** (a) `add-method.tsx` says "This prototype has no payment processor" and `pay-flow.tsx:514` renders it inside the `isRemote` branch; delete it there. (b) `invoice-inbox.tsx` shows a vendor forwarding address that is "not wired yet". (c) Landing lists Apple Pay and Google Pay; `applePayDomains.create` is unbuilt. (d) `robots.ts` blocks indexing "for the prototype". (e) Remote bank card reads "matched through today, 0 unreconciled" from constants at `remote.ts:452`. (f) `/about` is placeholder copy. | Each is the word "prototype" or an invented number in front of a customer. | files as named |
| 11 | **Late fees promised, never charged.** Pay page and policy describe one; nothing books it. Charge on the grace day in the assessments cron, or cut the copy. | Books that ignore the board's own policy. | `src/app/api/assessments/run/route.ts` |
| 12 | **Done 2026-10-04.** `/api/dev/reset`, `/api/dev/associations` and `pnpm db:seed` share four locks: not production, `ALLOW_TEST_RESET=true`, `TEST_RESET_PROJECT_REF` equal to the project in `NEXT_PUBLIC_SUPABASE_URL`, and no association with a subscription or live charges. Still owed: delete `ALLOW_TEST_RESET=true` from the laptop's `.env.local`. | It was one env var away from emptying every customer. | `src/app/api/dev/guard.ts`, `scripts/seed-demo.mjs` |
| 13 | **Landing overclaims:** knowledge center, instant vendor messaging, video calls with vendors. | First ticket: "where is the thing on your homepage". | `src/app/page.tsx` |

## 2. Product gaps by persona

| Persona | Gap | Today | When | Why |
| --- | --- | --- | --- | --- |
| Treasurer | Bank reconciliation | `bank_accounts` table, no feed; "cleared" never set. Plaid ruled out 2026-09-02. | **Month 1**: CSV statement import, match by amount and date. Plaid: Later. | Month-end close is the job; Stripe payouts land as lumps that must tie out. |
| Treasurer | Year-end statements (P&L, balance sheet, reserves) as PDF | CSV export only. | Month 3 | Annual meeting packet and the CPA. |
| Treasurer | CPA / audit export | Transactions CSV. | Month 3 | FL, CA, NV, WA require a review or audit above size thresholds. |
| Treasurer | 1099-NEC | W-9 flag; `vendor-tax-forms` off. | Month 3, before January | Any vendor paid over $600 by ACH. |
| Treasurer | Budget approval | Lines exist; `money-budget` off. | Month 3 | Budget season is Oct to Dec. Add "approved on". |
| President / Secretary | Meeting minutes | Agenda, attendance, action items; no minutes body or approval. | **Month 1** | The one record every state requires. A text field plus approval date. |
| President / Secretary | Certified mail | Print only; `delivery-panel` off. | Later (Lob) | Only lien notices need it; those go through the attorney. |
| President / Secretary | Violation letters with state language | One template, no variance. | Month 3, launch states | TX 209.006, FL 720.305 prescribe cure periods and hearing rights. |
| President / Secretary | Architectural review queue | Type and tag exist; no queue or deadline. | Month 3 | Most states deem a request approved if unanswered in 30 to 60 days. |
| Resident | Statement PDF | CSV. | Month 1 | Refinance and closings ask for it. |
| Resident | Email receipt for manual payments | Autopay only. | **Month 1** | Without it the question is "did it go through". Hook `payment_intent.succeeded`. |
| Resident | Two owners, two logins | `members: string[]`; one membership claims the seat. | Month 3 | Spouses both want the balance. |
| Resident | Tenants | Not modelled. | Later | Launch HOAs are owner-occupied. |
| Resident | Estoppel / resale letter | `documents-disclosure` off. | Month 3 | FL caps the fee and sets 10 days. |
| Mgmt company | Several associations per user | Done (`my_associations`, `/c/<slug>`). | Done | |
| Mgmt company | White label | No. | Later | Not the launch customer. |

## 3. Engineering

| Item | Today | Do | Why |
| --- | --- | --- | --- |
| CI | **Done 2026-10-04:** `.github/workflows/ci.yml` runs `pnpm check` (lint, `tsc`, `vitest`, `next build`) on every push and PR, with no secrets. | Still to do: Playwright nightly against the preview URL. `db:verify` stays manual, it hits prod. | A broken build should not reach Vercel. |
| Payments e2e | `STRIPE_E2E` spec never written. | Write against a second test account and staging; nightly. | The webhook is the only writer of settled money. |
| Staging | None; `db push` from laptop to prod. | Second Supabase project (free), Vercel Preview pointed at it with test keys; push there first. | 0043 to 0050 hit prod before review on localhost. |
| Migrations | Personal token, hand-patched `database.types.ts`. | Run from CI on merge; no drops or renames without two steps; generate types. | The one incident with no undo. |
| Secrets | All keys on one laptop plus Vercel. | Password manager; rotate the Supabase token (expired once) and use a restricted Stripe key; confirm `.gitignore` covers `.env*`. | One laptop is one point of failure. |
| Dependencies | Next 16.3, Stripe 22, Supabase 2.112. | Dependabot weekly, security auto-merge. | Stripe and Supabase ship breaking auth changes. |
| Rate limits | In-memory per instance: sign-up 10/h, join lookup 30/min. | Fine to launch. `/api/email/invite` is capped at 600 messages per association per hour since 2026-10-04 (`src/lib/email/invite-limit.ts`). Move to Postgres when Vercel runs more than one instance. | A script can burn the 3,000/mo Resend quota. |
| Observability | Nothing. `docs/observability.md` in progress. | Sentry free tier; Vercel log drain; alerts on webhook 5xx, cron non-200, `email_log` failures over 5/hour. | Today a customer finds the outage. |
| Accessibility statement | Text-size pass done; no page. | `/accessibility`: WCAG 2.1 AA target, known gaps, support address. | HOAs are quasi-public; ADA complaints exist. |
| Performance budget | `loadCommunity` reads every ledger row (`docs/scale.md` §3). | Budget: first paint under 3s at 250 homes, 5 years. Window the ledger to 12 months before the first 250-home customer. | The five-year QA found truncation; the next find is time. |
| Export and deletion | Soft delete 30 days; transactions CSV. | "Export everything" zip on Settings; person-level erasure path. | CCPA reaches a California board's vendor; export is how a board leaves without hating you. |
| RLS cadence | `verify-rls`, `verify-isolation` (71 checks), `tables_without_rls()`. | Nightly in CI against staging; policy review on every migration adding a table. | RLS is the only wall between associations. |
| DR drill | `rebuild-supabase.sh`, never run from a backup. | Restore a backup into staging, sign in, read a ledger, time it, write the number down. | An untested backup is a hope. |

## 4. Support and operations

- **Reaching you.** `support@yourhoasis.com` on footer, Settings, billing wall, `error.tsx`. Promise one business day, same day for "money moved wrong". No chat widget; a mailbox is easier to keep honest.
- **Help center, first ten** (on `/library`, already public with 43 guides): connecting the bank to Stripe; inviting homeowners and what they receive; setting dues and the due day; how an owner pays and what ACH pending means; autopay day, cap, declines; reminders and the collections ladder; recording a check; reading Finances and payout timing; what each role sees; cancelling and exporting.
- **Onboarding.** First five boards get a 30-minute call and Monish watches the founding. Self-serve stays the default.
- **Bank verification fails.** Micro-deposit accounts sit "Verifying"; autopay skips them. Answer: enter the two amounts within 10 days; after that Stripe expires it, `setup_intent.setup_failed` removes the row, add it again.
- **Refunds.** Treasurer refunds from the Stripe dashboard; `charge.refunded` reverses the books. Software fee: billing portal, first month always refunded.
- **Chargebacks.** `losses_collector: stripe` means Stripe debits the HOA, not the platform. The webhook ignores `charge.dispute.*`, so the books keep a payment the bank clawed back. Month 1: treat `charge.dispute.created` like a refund with a disputed flag and email the treasurer, who submits evidence.
- **Inspecting an association.** `/admin` does not exist. Requirements: a `platform_admins` table, read-only by default, every view written to `admin_audit`, no impersonation of a person. Never run the service role key from a laptop against production once customers exist.
- **SLA.** Do not sign one. State a 99.5% target; payments availability is Stripe's. Link the status page from `/terms`.

Runbook, top five:

| Incident | Detect | Do |
| --- | --- | --- |
| Stripe webhook down | Failed deliveries in the dashboard; payments pending past a day | Fix deploy or secret; Stripe retries 3 days; older ones, Resend from the dashboard. `record_payment` is idempotent. |
| Supabase paused | Loader forever; `npx supabase projects list` says INACTIVE | `POST /v1/projects/<ref>/restore`, four minutes. Never rebuild first. Pro removes the cause. |
| Email not delivered | `email_log.status` failing; Resend dashboard | Check `EMAIL_FROM`, domain status, monthly quota; single address, look for an opt-out row. |
| Cron missed | No Vercel cron log; no row for the date | Call the route with the `CRON_SECRET` bearer, `?dry=1` first; resumes with `?after=<id>`. |
| Bad deploy | Sentry spike or a board writes in | Vercel > Promote previous deployment. Never roll a migration back; forward-fix. |

## 5. Business and legal

- **Money transmission.** Direct charges with the HOA as merchant of record and settlement to the HOA's own account keep you out of the flow of funds; Stripe is the licensed party. What would put you in: a platform balance that holds dues and pays out later (destination or separate charges), paying vendors from a pooled balance, floating late payments. Keep `application_fee_amount` the only money that touches the platform.
- **PCI.** Payment Element in an iframe plus Checkout: SAQ A, attested from the Stripe dashboard. Never add a card field of your own; the demo `add-method.tsx` form is the one to delete.
- **State law.** Library covers 12 states (`STATES`, `src/lib/data/library.ts`); the founder picker offers 50. Claim **WA, TX, FL, AZ, CA** at launch, "guides for 12 states, software works everywhere". No statutory-letter compliance claim until section 2 exists.
- **Insurance.** Tech E&O plus cyber, $1M/$2M, Vouch or Embroker, roughly $2k to $4k a year. A board's attorney asks for the certificate before the bank connects.
- **Entity.** LLC, EIN and a business bank account before Stripe goes live; Stripe verifies the platform entity and pays fees into it. Move Vercel, Supabase, Resend and Stripe off Gmail.
- **Pricing.** $4/home/month flat, no per-transaction charge since 2026-10-04, 90-day trial (`src/lib/pricing.ts`). PayHOA runs about $50 to $200 a month per association in bands plus payment fees; at 88 homes you are $352 a month, the expensive option above about 40 homes. The page compares to a management company, which is right for self-managed boards, but expect the objection; consider a cap around $250 a month before the first 100-home prospect.
- **Customer agreement.** Two-page order form the president can bring to a meeting: customer is the association, fee, trial, data is theirs, termination and export, liability cap. A click-through is not enough for a board.
- **Metric.** Monthly: associations that ran a dues cycle and took at least one online payment, and how many are still doing so 90 days later. Secondary: share of dues collected online versus recorded by hand; under 50% after two cycles means the resident side is not landing.

## 6. The first 30 days

| Days | Do |
| --- | --- |
| 1 to 3 | Resend domain, `EMAIL_FROM`, webhook secret (3). Supabase Pro, Vercel Pro (7, 8). LLC and bank account started. Support inbox and footer links (9). |
| 4 to 7 | Terms, privacy, refund policy, data description, accessibility page (4 to 6). Delete demo surfaces in the remote branch, fix landing claims (10, 13). Late fees: charge or cut (11). Remove `/dev` from prod (12). Sentry plus one alert. |
| 8 to 10 | Stripe live keys, entity verification, submit the Connect review (1, 2). Staging project and CI. DR drill, timed. |
| 11 to 14 | Month-1 product: manual-payment receipt, minutes field, PDF statement, dispute handling. Ten help articles. |
| 15 to 21 | First association onboards on a call, ideally in WA. Watch founding, bank connect, first invite; fix same day. Insurance bound. |
| 22 to 30 | Second and third boards, self-serve with a call offered. Start CSV bank import. Read the metric. Decide the price cap with real objections in hand. |

## Added 2026-09-26

View versus change access per area, and an append-only board activity record, both compared against PayHOA, Buildium and AppFolio in the session that built them. Details in docs/design/ui-baseline.md under "Board offices".

## Added 2026-10-04

An 18 agent audit of the whole product (115 findings, 114 confirmed on a second read) and the first two rounds of fixes. Closed that day: signed-out callers could bill an association and record payments (migration 0062), an owner could settle their own dues, late fees landed on paid-up homes, dues emails read every balance as zero, emailed sign-in links did not sign anyone in, and the callback could be bent into an open redirect. The per-payment fee was removed: the price is the monthly rate and nothing else. `pnpm db:verify` now runs all nineteen suites and lists the failures instead of stopping at the first. What is still open is tracked in the session notes and the audit file, not here; the items above marked done are the ones this document had listed.
