# Work tracker

Started 2026-10-04. One list, in priority order, so the work can stop and
start again without losing its place. Update the status column when
something lands; do not start a lower section while a higher one has open
rows unless the row says it is waiting on Monish.

Sources: the code audit (115 findings) and the onboarding and navigation
review (257 findings, seven walkers). Both are summarised here; the full
findings were session files and are not in the repo, so anything worth
keeping is written into a row below.

**Where it stands (2026-10-05):** sections 0 and 2 to 5 are on production
(pull request #5 merged). In progress on branch `dues-by-home`, at Monish's
ask the same day: dues that differ home by home (section 9), a pass over
every button and description in the product (section 10), and small
interface fixes. Still open: a few section 1 rows, section 6 (small known
gaps), section 7 (decisions), section 8 (staging and Resend, both waiting on
Monish). Not yet built from the reviews: changing or cancelling a meeting
and adding minutes, real file upload on requests, emailing the board when
somebody asks to join, a reply address for association emails.

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
| Wizard's last step takes routing and account numbers, discards them, then says "Connected" and "You can already take payments" | `src/app/start/setup-wizard.tsx`, `src/lib/setup-plan.ts` | done 2026-10-04 |
| "Invite your neighbors" shows done when nobody was invited | `src/lib/setup-plan.ts` | done 2026-10-04: done only when every owner with an email was invited or has signed in |
| Adding a vendor says "W-9 requested by email"; nothing is sent | `src/app/board/vendors/` | done |
| New request screen promises reply times nobody set (2 business days, 30 days, 3 days) | `src/app/resident/requests/new/form.tsx` | done |
| Real pay screen still mentions a payment fee | `src/app/resident/pay/` | done |
| "Add photos or documents" on a request: the file never leaves the browser | resident requests and forms | done: hidden for a real association until upload is real |
| "Both can change in Settings" and "you get told before it lapses" in the wizard and plan | setup wizard, setup plan | done 2026-10-04 |
| Wizard asks "Anything billed besides dues?" and, for a real association, the builder's name; nothing reads either | setup wizard | done 2026-10-04 (c9d560f, branch staging-and-onboarding) |
| Setup and Reserves point at the Budget page, which is switched off | setup plan, reserves screen | done 2026-10-04: hidden while the module is off |
| "Paid up" badge beside a $285 balance; "View home details" opens the statement | resident home | done 2026-10-05 (pull request #4): "Not late", and the home card link reads "See your statement" |
| Demo-only controls shown to a real association: live meeting room and attendance, emailed-in vendor bills, Pay by ACH, bank picker, "Public" document setting, "Match transactions" | board screens | done 2026-10-05 (pull request #5): vendor and finance controls, the pretend meeting room, attendance and "recording", and empty photograph frames on notices are gone for everyone. "Public" on documents went earlier |
| Real sign-in page is headed with the demo association's name for every real homeowner | `src/app/signin/` | done |

## 2. Onboarding: the founder

| Item | Status |
| --- | --- |
| Reorder the wizard: name, place, who is setting this up, kind of homes, homes and owners, dues, when the books start, your home. "Who is setting this up?" was seventh and shapes every later screen | done 2026-10-04 (c9d560f, branch staging-and-onboarding): account, name, place, who is setting up, kind of homes, dues, shared spaces, your home, homes, billing start |
| Drop the bank step; "Turn on online payments" (Stripe) is the first step after Create, and nothing says payments are on until Stripe says so | done 2026-10-04: "Turn on online payments" is a step in the list, done only when Stripe says charges are on |
| One list after Create instead of three (go-live list, plan, advice card), in order: homes and owners, what each home owes, online payments, first bill date, invite owners | done 2026-10-04: Get paid, Records owners can ask for, The rest; a turnover board and a builder get their own first group |
| Opening balances become a step for a switching association | done 2026-10-04 |
| Late fee: a new association starts with none and is asked on the dues step (today $25 at 30 days, unasked) | done 2026-10-04 (c9d560f, branch staging-and-onboarding), migration 0079 applied |
| Bug: a condo or townhome founder who leaves the unit number blank becomes an extra home that is billed | done 2026-10-04 (c9d560f, branch staging-and-onboarding) |
| Bug: "balances as of" defaults to tomorrow on a US evening | done 2026-10-04 (c9d560f, branch staging-and-onboarding) for the wizard; the wider UTC question is in section 7 |
| A turnover board's neighbours are filed as "Not sold yet" under the builder; an established association's unnamed homes show "Unsold" | done 2026-10-04 (c9d560f, branch staging-and-onboarding) |
| A look-around copy is never carried into the real association | later |
| A draft held for email confirmation only comes back on the same device | later |

## 3. Onboarding: everyone else

| Item | Status |
| --- | --- |
| "Let them in" is disabled for any home already on the roster, which after the wizard is every home; a mistyped home creates a duplicate | done 2026-10-05 (pull request #4): a home picker; seats the person on an empty or unclaimed home, offers "Add as a second owner" or a sale for an owned one, and only adds a home when asked to (migration 0080) |
| A person with an account and no home is sent to the founder's wizard with no way to "join"; waiting screens have no sign out | done 2026-10-05 (pull request #4): one fork screen, with "Signed in as" and sign out on every state; a founder with unfinished setup is led back to it |
| The board cannot correct a household's email | done 2026-10-05 (pull request #4) |
| The board is never told somebody is waiting; the join code is buried in Settings | done 2026-10-05 (pull request #4) for the code (shown on Homeowners with copy buttons). Emailing the board when somebody asks is still open |
| A second owner of the same home with their own sign-in | done 2026-10-05 (pull request #4): the board adds one from the household card or from a join request; a sale ends every seat on the home (migration 0081). A second owner added from a join request gets no welcome email yet |
| Printable letter or flyer with the join code | later |
| Emails say "reply to this email" with no reply address set | next: a board contact address in Settings; emails say "reply" only once it is set (approved) |
| Confirmation link has no resend | done 2026-10-05 (pull request #4) on the join page. The sign-in page's create-account notice and the wizard do not have it yet |
| Sign-in links in emails last one hour | done 2026-10-04: 24 hours, set on the live project and in `supabase/config.toml` |
| Renters, and a board seat with no office | later |

## 4. Board: what a real year needs

| Item | Status |
| --- | --- |
| Record an owner's check or cash payment, and a credit or waived fee | done 2026-10-05 (branch board-money): "Record a payment" and "Add a credit" on a household, migrations 0082 and 0083 applied |
| Open a request: read it in full, reply in words, deny with a reason | done 2026-10-05 (pull request #5): opens in place with what the owner sent, the conversation and a reply box; Deny asks for a reason the owner is shown |
| Vendor payments all land as "Repairs & maintenance"; ask for a category | done 2026-10-05 (branch board-money): the form asks what it was for |
| Opening bank balances | done 2026-10-05 (branch board-money): a "Starting balances" card on Finances, and every new association gets a plain operating account for its books |
| Association switcher menu is clipped by the photo band on inner pages | done 2026-10-05 (pull request #4) |
| Names drift: tabs say "From owners / To owners" over pages titled Requests and Notices; Settings uses three vocabularies for the same access areas | done 2026-10-05 (pull request #5): Past due, Requests and Notices, Messages; Settings uses the rail's names for access areas |
| Rail and tabs as recommended: Dashboard; Setting up; Finances (Overview, Transactions, Past due, Reserves); Homeowners; Vendors; Requests (Requests, Notices); Messages (Inbox, Announcements, Community); Meetings (Meetings, Voting); Documents; Settings | done 2026-10-05 (pull request #5) |

## 5. Resident

| Item | Status |
| --- | --- |
| Announcements are cut at two lines, cannot be opened, and only three ever show | done 2026-10-05 (pull request #4) |
| A notice or fine against your home appears only inside Requests | done 2026-10-05 (pull request #4) |
| One navigation, same names on the website rail, the phone bar and More: Home, Payments (Pay, Statement), Requests (Requests, Messages), Documents, Meetings (Meetings, Voting), Community, Association funds, Settings | done 2026-10-05 (pull request #4) |
| Phone bar: swap Account for Meetings (Monish set the current bar on 2026-09-24) | done 2026-10-05 (pull request #4): Home, Pay, Requests, Docs, Meetings, More |
| Rail counts that match nothing on the page | done 2026-10-05 (pull request #4): Meetings counts ballots you have not voted on, Requests counts open notices about your home; Payments and replies carry no count |
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
| Test logins on the live sign-in page (kept "for now" on 2026-09-26) | Done 2026-10-04: `NEXT_PUBLIC_TEST_LOGINS` removed from Vercel Production; gone from the live site at the next deploy, still on localhost |
| "Join with a code" link on the landing header and footer | Done 2026-10-04: in the phone menu and the footer (the desktop bar stays at the deck's three links) |
| Signed-out demo shows features a paying board does not get | Hide them |
| Vacant lots as a kind of home; condo dues by ownership share; a builder's representative as President without a lot | Later: each changes the data model |

## 8. Infrastructure

| Item | Status |
| --- | --- |
| GitHub Actions runs the checks on every push and pull request | done 2026-10-04: first green run on pull request #4 (check 4 minutes, browser suite 7). The browser suite runs on pull requests only, to stay inside the 2,000 free minutes a month. Nothing is billed while the account's spending limit is $0 |
| Stripe billing page with cancellation on (`pnpm stripe:setup` now creates it) | done in test mode; run again with the live key |
| Resend: verify yourhoasis.com, set `EMAIL_FROM` on Vercel | parked by Monish 2026-10-04, pick up below |
| A staging copy: second Supabase project, Vercel preview pointed at it, Stripe test keys. Test associations move there and production holds only real ones | one click left for Monish: accept Supabase's marketplace terms at https://vercel.com/monish-naidus-projects/~/integrations/accept-terms/supabase?source=cli (legal terms are his to accept). Then Claude creates the free project through Vercel and runs `pnpm staging:setup`. Supabase's own API refuses the token on this machine (tried three ways) |
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

Then one command, `pnpm staging:setup`: every migration goes in and the
three Supabase values are set on Vercel for Preview only. After it,
`pnpm db:verify:staging` runs the checks there (every script reads
`ENV_FILE`).
From then on `pnpm db:verify` against production is for a release, not for
day to day.

## 9. Dues that differ home by home

Asked for by Monish on 2026-10-05: "staggered HOA dues for condos and
townhomes with different sized units", captured in onboarding and the rest
of the app. The rule: a home pays its own amount if it has one, else its
kind's, else the association's.

| Item | Status |
| --- | --- |
| `units.dues_cents`, `issue_assessment` bills by the rule, `set_home_dues` (migration 0084) | doing |
| Wizard: "Different by home" on the dues step; an amount per range or per row; a "Dues" column in the spreadsheet | doing |
| Homeowners: "Change dues" on a household; the import column; the export | doing |
| Every screen and email that states a dues amount uses the rule | doing |

## 10. Wording pass

Asked for by Monish on 2026-10-05: check every button and description in
the product and simplify. Rules: short, plain, sentence case, no em dashes;
a button says what happens; the same thing has the same name everywhere;
nothing promised that is not there. The landing page's deck headlines stay
as Monish brought them.

| Area | Status |
| --- | --- |
| Marketing, sign-in, join, setup wizard and setup list | next, after section 9 lands |
| Resident side | next |
| Board side | next |
