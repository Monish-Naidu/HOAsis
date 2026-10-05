# Work tracker

Started 2026-10-04. One list, in priority order, so the work can stop and
start again without losing its place. Update the status column when
something lands; do not start a lower section while a higher one has open
rows unless the row says it is waiting on Monish.

Sources: the code audit (115 findings) and the onboarding and navigation
review (257 findings, seven walkers). Both are summarised here; the full
findings were session files and are not in the repo, so anything worth
keeping is written into a row below.

Status words: **done** (in the working tree and checked), **doing**,
**next**, **waiting** (on Monish), **later** (not for launch).

## 0. Land what is already built

| Item | Status |
| --- | --- |
| Audit fixes, round one (money functions closed, late fees, dues email, magic links) | done, live since 4d157ca |
| Audit fixes, round two (view-only seats, column guards, refunds, write queue, wizard parked rows, email pacing) | done in the tree, migrations 0063 to 0078 applied |
| Design pass: two-tone icons, colour by meaning, aerial photo back in the closing band | done in the tree, Monish said yes |
| Full check on the tree: `pnpm check`, `pnpm e2e`, `pnpm db:verify` | done 2026-10-04: 1,237 unit, 134 browser, every database suite bar `EMAIL_FROM` |
| Commit locally, push as a branch, open a pull request so GitHub runs the checks and Vercel builds a preview | done: branch `round-two`, pull request #1. GitHub Actions still fails to start on the account (not the workflow file); Vercel builds the preview |
| Monish reads the preview, then merge (that is the push to production) | #1 merged 2026-10-04 (first commit only, it beat the second by two seconds); #2 carries the second commit and is waiting on Monish |

How a change reaches production from here on: branch, pull request, the
checks pass on GitHub, a look at the Vercel preview, merge. Nothing goes
straight to `main`.

## 1. Things the screens say that are not true

The worst kind: a board acts on them. Each is small.

| Item | Where | Status |
| --- | --- | --- |
| Wizard's last step takes routing and account numbers, discards them, then says "Connected" and "You can already take payments" | `src/app/start/setup-wizard.tsx`, `src/lib/setup-plan.ts` | next |
| "Invite your neighbors" shows done when nobody was invited | `src/lib/setup-plan.ts` | next |
| Adding a vendor says "W-9 requested by email"; nothing is sent | `src/app/board/vendors/` | done |
| New request screen promises reply times nobody set (2 business days, 30 days, 3 days) | `src/app/resident/requests/new/form.tsx` | done |
| Real pay screen still mentions a payment fee | `src/app/resident/pay/` | done |
| "Add photos or documents" on a request: the file never leaves the browser | resident requests and forms | done: hidden for a real association until upload is real |
| "Both can change in Settings" and "you get told before it lapses" in the wizard and plan | setup wizard, setup plan | first done; the insurance line is next |
| Wizard asks "Anything billed besides dues?" and, for a real association, the builder's name; nothing reads either | setup wizard | next: remove |
| Setup and Reserves point at the Budget page, which is switched off | setup plan, reserves screen | next: remove the four mentions |
| "Paid up" badge beside a $285 balance; "View home details" opens the statement | resident home | badge done ("Not late"); the link label is next |
| Demo-only controls shown to a real association: live meeting room and attendance, emailed-in vendor bills, Pay by ACH, bank picker, "Public" document setting, "Match transactions" | board screens | next |
| Real sign-in page is headed with the demo association's name for every real homeowner | `src/app/signin/` | done |

## 2. Onboarding: the founder

| Item | Status |
| --- | --- |
| Reorder the wizard: name, place, who is setting this up, kind of homes, homes and owners, dues, when the books start, your home. "Who is setting this up?" was seventh and shapes every later screen | next |
| Drop the bank step; "Turn on online payments" (Stripe) is the first step after Create, and nothing says payments are on until Stripe says so | next (Monish said go, 2026-10-04) |
| One list after Create instead of three (go-live list, plan, advice card), in order: homes and owners, what each home owes, online payments, first bill date, invite owners | next (Monish said go, 2026-10-04) |
| Opening balances become a step for a switching association | next, with the row above |
| Late fee: a new association starts with none and is asked on the dues step (today $25 at 30 days, unasked) | next (Monish said go, 2026-10-04) |
| Bug: a condo or townhome founder who leaves the unit number blank becomes an extra home that is billed | next |
| Bug: "balances as of" defaults to tomorrow on a US evening | next (the UTC "today" problem; see section 7) |
| A turnover board's neighbours are filed as "Not sold yet" under the builder; an established association's unnamed homes show "Unsold" | next: "No owner listed" |
| A look-around copy is never carried into the real association | later |
| A draft held for email confirmation only comes back on the same device | later |

## 3. Onboarding: everyone else

| Item | Status |
| --- | --- |
| "Let them in" is disabled for any home already on the roster, which after the wizard is every home; a mistyped home creates a duplicate | next: a home picker with the right action for an empty home, a sold home and a co-owner |
| A person with an account and no home is sent to the founder's wizard with no way to "join"; waiting screens have no sign out | next: one fork screen (join code first, signed in as, sign out) |
| The board cannot correct a household's email | next |
| The board is never told somebody is waiting; the join code is buried in Settings | next: show it on Homeowners |
| A second owner of the same home with their own sign-in | next (Monish said go, 2026-10-04) |
| Printable letter or flyer with the join code | later |
| Emails say "reply to this email" with no reply address set | next: a board contact address in Settings; emails say "reply" only once it is set (approved) |
| Confirmation link has no resend | next |
| Sign-in links in emails last one hour | next: raise to 24 hours (approved) |
| Renters, and a board seat with no office | later |

## 4. Board: what a real year needs

| Item | Status |
| --- | --- |
| Record an owner's check or cash payment, and a credit or waived fee | next (needs a small migration: `record_manual_payment`, rails `check` and `cash`) |
| Open a request: read it in full, reply in words, deny with a reason | next |
| Vendor payments all land as "Repairs & maintenance"; ask for a category | next |
| Opening bank balances | next |
| Association switcher menu is clipped by the photo band on inner pages | next |
| Names drift: tabs say "From owners / To owners" over pages titled Requests and Notices; Settings uses three vocabularies for the same access areas | next |
| Rail and tabs as recommended: Dashboard; Setting up; Finances (Overview, Transactions, Past due, Reserves); Homeowners; Vendors; Requests (Requests, Notices); Messages (Inbox, Announcements, Community); Meetings (Meetings, Voting); Documents; Settings | next: names only, the set is already right |

## 5. Resident

| Item | Status |
| --- | --- |
| Announcements are cut at two lines, cannot be opened, and only three ever show | next |
| A notice or fine against your home appears only inside Requests | next: dashboard and bell |
| One navigation, same names on the website rail, the phone bar and More: Home, Payments (Pay, Statement), Requests (Requests, Messages), Documents, Meetings (Meetings, Voting), Community, Association funds, Settings | next |
| Phone bar: swap Account for Meetings (Monish set the current bar on 2026-09-24) | next (Monish said go, 2026-10-04) |
| Rail counts that match nothing on the page | next |
| Real photo and file upload on requests | later, after section 1 hides the control |

## 6. Left open from the audit rounds

Small, known, and not blocking a push. Each was found by a reviewer.

- Autopay card date can be a cycle early for an owner who carried a balance into a month where the due day is later than their autopay day. Needs this month's `autopay_runs` row loaded.
- A started and abandoned bank payment holds late fees and autopay off for up to 14 days.
- The join page still tells a person "ask the board" once after the board has already fixed their email; "Go to my home" then works.
- A co-owner can copy another co-owner's saved payment token while both are on the home. Needs saved methods written only by the server.
- `emailNotice` does not say why when a send stops on a failed log write; the reason is on `/admin` only.
- Selling a home as an officer who has settings but not finances cannot settle the balance in the same step.
- `verify-five-years --remove` demotes the President before a delete that may fail.
- Recipient lists over 1,000 rows are read in one unpaged call.
- A meeting's notice date is written even when homes were left unreached or the announcement itself was refused (a seat with voting but not communications). Write it only when nothing remains and the post landed.
- Raising a notice from a report: if the connection drops between the claim and the insert, the report keeps a link to a notice that does not exist. Needs one database function.
- Two quick edits to different amenities or forms before the screen re-reads can revert the first.

## 7. Decisions for Monish

| Question | Recommendation |
| --- | --- |
| A time zone per association (everything runs on UTC, so US evenings are a day ahead) | Add one, asked in the wizard from the state, changeable in Settings |
| Which "percent funded" the Reserves screen shows (41% or about 61% for the demo) | The accrued-liability figure the library describes |
| Re-sending the same notice within an hour is skipped as a duplicate | Keep, and say so on screen |
| Test logins on the live sign-in page (kept "for now" on 2026-09-26) | Remove from the live site, keep on localhost |
| "Join with a code" link on the landing header and footer | Add it |
| Signed-out demo shows features a paying board does not get | Hide them |
| Vacant lots as a kind of home; condo dues by ownership share; a builder's representative as President without a lot | Later: each changes the data model |

## 8. Infrastructure

| Item | Status |
| --- | --- |
| GitHub Actions runs the checks on every push and pull request | workflow is in; GitHub will not start it: "recent account payments have failed or your spending limit needs to be increased". Monish to look at GitHub > Settings > Billing and plans. Actions itself is free for this use (2,000 minutes a month on a private repo; a run here is about ten) |
| Stripe billing page with cancellation on (`pnpm stripe:setup` now creates it) | done in test mode; run again with the live key |
| Resend: verify yourhoasis.com, set `EMAIL_FROM` on Vercel | parked by Monish 2026-10-04, pick up below |
| A staging copy: second Supabase project, Vercel preview pointed at it, Stripe test keys. Test associations move there and production holds only real ones | waiting on one click from Monish, see below |
| `ALLOW_TEST_RESET` removed from `.env.local` | done by Monish |

### Picking up Resend

Nothing reaches an owner's inbox until this is done; boards see a toast
saying so on every send. `docs/email.md` has the full walk. Two ways:

1. By hand, about ten minutes: Resend > Domains > Add `yourhoasis.com`
   (accept the `send` subdomain), copy the three DNS records into
   Cloudflare with the cloud grey, press Verify, then set `EMAIL_FROM` on
   Vercel to `Your HOAsis <hello@send.yourhoasis.com>` and redeploy.
2. Two tokens in `.env.local`, then Claude does the rest:
   `RESEND_ADMIN_KEY` (Resend > API Keys, full access) and
   `CLOUDFLARE_API_TOKEN` (Cloudflare, "Edit zone DNS" for yourhoasis.com).

Afterwards: `pnpm email:setup` again, `node scripts/send-test-email.mjs
someone-else@example.com`, and `pnpm db:verify` goes fully green.

### Picking up staging

The Supabase token on this machine cannot create a project (it sees the
existing project and no organisation), so the project itself is one manual
step:

1. supabase.com > New project: name `yourhoasis-staging`, region West US
   (Oregon), free plan. Keep the database password.
2. Settings > API: copy the Project URL, the anon key and the service_role
   key into `.env.staging` (the file is already there with the four names,
   and is never committed), with the password.

Then Claude: pushes every migration to it, sets the three Supabase values
on Vercel for Preview only, seeds a test association, and runs
`pnpm db:verify:staging` (already wired: every script reads `ENV_FILE`).
From then on `pnpm db:verify` against production is for a release, not for
day to day.
