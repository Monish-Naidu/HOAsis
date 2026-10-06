# Work tracker

Started 2026-10-04. One list, in priority order, so the work can stop and
start again without losing its place. Update the status column when
something lands; do not start a lower section while a higher one has open
rows unless the row says it is waiting on Monish.

Sources: the code audit (115 findings) and the onboarding and navigation
review (257 findings, seven walkers). Both are summarised here; the full
findings were session files and are not in the repo, so anything worth
keeping is written into a row below.

**Where it stands (end of 2026-10-05):** pull requests #7, #8 and #9 are
merged and live; migrations through 0094 are applied. Every row marked
done in sections 9 to 13 is on production. Next: the open rows of section
12 (owners with several homes, an unreachable president, autopay failures
on Past due), the notice title field, the hydration error on `/start`, and
the decisions waiting on Monish. Earlier note follows.

**Where it stood (2026-10-05, night):** sections 0, 2 to 5, 9, 10 and most
of 11 are on production (pull request #7 merged, main at 41597a9), with the
first half of section 12: one-off charges, undoing a payment recorded by
hand, sale privacy, autopay retry, no late fee on a starting balance.
Migrations through 0091 are applied to the live database. On branch
`first-year`, not yet merged: removing one of two owners, an owner changing
their own email, and late fees after a reversed payment. Next: section 13
(what the browser walk found), then the rest of section 12. Waiting on
Monish: search engines (section 11), automatic dues email (section 12),
staging and Resend (section 8), the wording questions in section 10.

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
| `units.dues_cents`, `issue_assessment` bills by the rule, `set_home_dues` (migration 0084) | done 2026-10-05 (branch dues-by-home; migration 0084 applied) |
| Wizard: "Different by home" on the dues step; an amount per range or per row; a "Dues" column in the spreadsheet | done 2026-10-05 (branch dues-by-home; migration 0084 applied) |
| Homeowners: "Change dues" on a household; the import column; the export | done 2026-10-05 (branch dues-by-home; migration 0084 applied) |
| Every screen and email that states a dues amount uses the rule | done 2026-10-05 (branch dues-by-home; migration 0084 applied) |

## 10. Wording pass

Asked for by Monish on 2026-10-05: check every button and description in
the product and simplify. Rules: short, plain, sentence case, no em dashes;
a button says what happens; the same thing has the same name everywhere;
nothing promised that is not there. The landing page's deck headlines stay
as Monish brought them.

| Area | Status |
| --- | --- |
| Marketing, sign-in, join, setup wizard and setup list | done 2026-10-05 (branch dues-by-home): 45 strings in 21 files |
| Resident side | done 2026-10-05 (branch dues-by-home): 58 strings in 20 files |
| Board side | done 2026-10-05 (branch dues-by-home): about 175 strings across pages, shared components and the letters |

Left for Monish to decide, because rewording would not make them true. Each
is a line on a screen that nothing in the code keeps:

| Where | What it says | Status |
| --- | --- | --- |
| Settings, forms | "Upload your own forms" button stores no file | waiting: hide it or build the upload |
| Notices | "Send notice" posts the notice in the owner's app and emails nobody | waiting: email it too (the route can already send a letter to one home), or say "Post notice" |
| Delivery panel | Describes text message opt in and opt out; there are no texts | waiting: remove until texts exist |
| About page | "Dual approval is the default here" | waiting: true only for vendor payments over the limit |
| Pricing, included list | Read against `modules.ts` 2026-10-05: every item is on. Two are Monish's to confirm: "Live support from the people who built it" (support is email to him) and "Accounting" (it is dues, vendor payments and reserves, not a general ledger) | waiting |
| Resident report form | "Your name goes to the board and to nobody else", "The board will not share the outcome with you" | waiting: policy call |
| Notices, stages | "Fix it by the date below and there is no fine" | waiting: policy call, the app does not issue fines |
| Assistant | "reminder emails stop while autopay is running", "comes out on the 1st" | done 2026-10-05: neither was true (the dues email goes to every home; the owner picks the day), so the answer now says dues are paid for you when they come due |
| Names | "roster", "register" and "Homeowners" for one list; letters and some screens hardcode "unit" | waiting: pick one name; "unit" should follow the home kind |
| `feature-tabs.tsx` | Unused file with old landing claims | done 2026-10-05: deleted |

## 11. Landing page and the demo

Asked for by Monish on 2026-10-05: make the landing page more engaging and
get people to sign up. Deck headlines, hero art and the aerial photo stay.

| Item | Status |
| --- | --- |
| "Try the demo" opens the sample association in one click (`/demo`, `/demo?as=owner`) | done 2026-10-05 (pull request #7) |
| The demo says it is one and links to setup | done 2026-10-05 (pull request #7) |
| Price slider in place of the flat price band; price in the hero | done 2026-10-05 (pull request #7) |
| Three setup steps; six questions boards ask | done 2026-10-05 (pull request #7) |
| `src/app/robots.ts` tells every search engine to stay away from the whole site | waiting: Monish says when the site should be findable; then allow `/`, `/pricing`, `/about`, `/library` and add a sitemap |
| No proof from real associations (quotes, a count) | later: nothing to show until there are customers; do not invent any |
| A short screen recording of setup in the hero or the steps row | later |

## 12. What a real association hits in its first years

From a read of the code against thirty situations on 2026-10-05. Most likely
and most damaging first. "Handled" situations are not listed; they were
proven against the verify scripts (sale of a home, two owners, join
requests, partial and over payments, refunds, dues by home, quarterly and
annual dues, month ends, the dues job running twice, view-only seats).

| Situation | What happens today | Status |
| --- | --- | --- |
| Dues post and nobody is told | The daily job bills and adds late fees but sends no email; owners not on autopay hear nothing unless the board presses the dues mailer | next: send the bill email from the job (decision: automatic, or a dashboard row "bill posted, send it") |
| A one-off charge or special assessment | No screen posts one; the SQL exists (`levy_special_assessment`) but nothing calls it | done 2026-10-05 (branch first-year, migration 0086 applied): "Add a charge" on a household, "Charge every home" under Dues in Settings; category `other`, so no late fee and not counted as dues |
| A check recorded twice, or against the wrong home | No undo; only "Add a credit", which leaves collected and the bank balance overstated | done 2026-10-05 (branch first-year, migration 0088 applied): "Payments recorded by hand" on a household lists them with Reverse; the payment form warns on the same amount and date. Stripe payments are still refunded in Stripe |
| One of two owners leaves; a second owner added by mistake | No way to end one seat; only a fake sale, which wipes the other owner's autopay and saved bank | done 2026-10-05 (branch first-year, migration 0090 applied, `verify-owners` 22/22): each person on a two-owner home has "Remove"; only their saved methods and autopay go. Not yet clicked through in a browser: the demo has no second seat to show it on |
| A signed-in owner changes or loses their email | Nothing in the resident account page; the board is refused | done 2026-10-05 (branch first-year, migration 0090 applied): "Email" card in resident Settings sends a confirmation link to the new address; a trigger copies a confirmed change to the profile and the seat, so dues email follows. Needs one real try once Resend can deliver |
| The buyer of a home reads the seller's history | Payments, request threads, board messages and votes are readable by anyone with a current seat on the home, with no date filter | done 2026-10-05 for requests, threads, votes and rule notices (branch first-year, migration 0089 applied, `verify-sale-privacy`): hidden from the buyer where a previous household owned the home. The money ledger stays whole on purpose: the balance is summed from it |
| A credit balance at sale | Carries to the buyer without a word; the sale dialog only settles money owed | done 2026-10-05 (branch first-year): the sale form says the credit stays with the home unless the board settles it with the seller first |
| Autopay fails once | Never retried that month, even after the owner fixes the card; the board is not told | done 2026-10-05 for the retry (branch first-year, migration 0085 applied): tried again only when the owner has added a method since, never twice a day, three times a month at most. Done 2026-10-06 (pull request #11): "Autopay did not go through" on Past due with the reason and tries, and an "Autopay failed" chip on the home |
| Stripe restricts the association's account | Autopay still tries and owners get "problem with your payment method" | done 2026-10-05 for the wait (branch first-year): autopay holds off while Stripe has charges off. Done 2026-10-05 (pull request #9): finance holders are emailed, once a day, with what Stripe is waiting for |
| An owner with two or three homes | Sees, pays and votes for one home only | done 2026-10-06 (pull request #11, migration 0096 applied, `verify-two-homes` 24/24): a home switcher in the resident header, one vote per home held, autopay set per home |
| The president cannot be reached | Only the sitting president can name the next one | done 2026-10-05 for support (migration 0095 applied): `node scripts/reassign-president.mjs <slug> <email>` seats a new President who already holds a seat; only the service role can call it. Later: a vote of officers in the app |
| A lost card dispute or a late bank return | Finance holders are emailed; the owner's statement still says paid | done 2026-10-05 (pull request #9, migration 0093 applied): booked like a refund, once per dispute; the email says so |
| Two officers approve the same vendor payment at once | One approval can be lost (the whole list is written from the browser) | done 2026-10-05 (pull request #9, migration 0094 applied): added under a row lock, once per account |
| A home that should not be billed (builder lots) | No exempt flag; zero means "not set" | later, with vacant lots |
| A home added mid-period | Waits for the next bill; no proration | later: say so on the add-home form |
| A home removed or two lots merged after the first bill | Refused; it keeps being billed | next: allow when the balance is zero |
| Deleting the association | Members lose sight of it at once, nothing is purged, Stripe is untouched; the screen promises a 30 day window | done 2026-10-05 for the wording (branch first-year): the screen says nobody can sign in once it is deleted and that support restores it for thirty days. Later: a restore button, a purge job, what happens to Stripe |
| Votes | No quorum field, no "dues must be current", no paper or proxy votes entered by the board | later |
| Year end | Owner statement CSV and board transactions CSV only; no printable statement, no all-homes statement run | later |
| Documents | No versions; a new upload sits beside the old one | later |
| A late fee on a starting balance | Confirmed on the live database: a balance as of months ago drew a late fee on the first morning | done 2026-10-05 (branch first-year, migration 0087 applied): a brought-forward line never draws a fee; dues billed here still do |
| A sale with a closing date in the future | Checked 2026-10-05: the sale takes effect the moment it is recorded, whatever the date, so the seller is locked out early | done 2026-10-05 in the form and in `transfer_home` (migration 0092 applied) |
| A check that bounces after dues read as paid | Reversing the payment puts the money back on the balance, but `assess_late_fees` reads the old dues line as covered (the reversal is a later charge), so no late fee follows; a Stripe refund has the same gap | done 2026-10-05 (branch first-year, migration 0091 applied, `verify-late-fees` 21/21) |

## 13. What the browser walk found

A walk of every signed-out screen on 2026-10-05 (front door, the setup
wizard three ways, the board and resident demo, phone and dark mode).
Walked and clean: every link, back and refresh in the wizard, 1 to 300
homes, every setup task, twenty board actions and six resident actions that
confirmed and survived a reload, 390px on about forty pages.

| Where | What happens | Status |
| --- | --- | --- |
| Dark mode on `/start`, `/board/setup`, `/board` | A hydration error drops the dark theme and the page renders light | done 2026-10-05 for what the visitor sees (pull request #8): the theme is put back on every mount, checked on ten loads. Still open: the hydration error itself. It fires at random on about half of loads of `/start` in the production build only, in light mode too; after React recovers, the page matches the server except the theme icon. Not yet found: no direct browser reads in the wizard or the question flow |
| Wizard, homes by number | Preview says 5 homes and $1,000; the association is made with 4 and $800, the founder's home merged into a range | done 2026-10-05 (pull request #8): the preview counts the way creation does, so both say 4 and $800, and the founder's home takes the kind its range has. Still open: the list on that step does not show which home became the founder's |
| Resident pay, "Other amount" | -5 reads "Pay $5.00"; 99999 on a $285 balance has no warning; 0 disables the button without saying why | done 2026-10-05 (pull request #8): refused with a reason; an overpayment says the extra stays as credit; the server already refused bad amounts |
| Resident settings, phone | "abc" saves | done 2026-10-05 (pull request #8) |
| Wizard | Dues of 0 erased silently, no upper limit; founder email "notanemail" accepted; pasted list keeps "3 Founder Way" and "3 founder way" as two homes; Continue disabled with no reason in four places | done 2026-10-05 (pull request #8): each field says what is wrong; dues cap $100,000; name cap 80; a paste says how many were added and skipped |
| Meetings, schedule | Time "banana" accepted; the notice adds a video link the board never entered | done 2026-10-05 for the time (pull request #8). The link is left: every meeting gets a video room in the app ("Join the call"), so the notice matches it. Waiting on Monish: keep a room on every meeting, or only when the board asks for one |
| Demo only: a dues change | Past bills and "dues collected" move with it, against what Settings says; Home says $310 while the September line says $285 | done 2026-10-05 (pull request #9): billed is the sum of the dues lines on the statements, in the demo and signed in. Left: months before the loaded history still use the rate (`association_overview` would need dues-only monthly sums); the autopay "usually" line needs the same "next bill is already $285" note |
| Demo only: vendor payment recorded | Cash on hand, the vendor's total and Transactions do not move | done 2026-10-05 (pull request #9); signed in it already moved |
| Demo only: counts | Hero says 88 homes after a household is added (89 elsewhere); Voting mixes "of 88" and "of 89" | done 2026-10-05 (pull request #9): one count from the register; a ballot keeps the count it opened with and says so when it differs |
| Demo only: resident pays by bank | Statement says $285.00, the board ledger +$282.72 | checked 2026-10-05: that is what the real path records too (the deposit is net of Stripe's processing fee, which sits on the payment row and nowhere on the ledger). Waiting on Monish: show the fee as its own ledger line, which is a database change |
| Resident home, paid up | Shows the next bill as the current balance before it is due | done 2026-10-05 (pull request #9): "Next bill, due September 1" and "Pay early"; the Homeowners badge says "Not due yet" |
| Setup list | "Add every home and its owner" cannot attach an owner to a listed home; counts disagree ("1 of 9", "2 of 10", "Step 1 of 8"); copy says "Getting started", the nav says "Setting up" | done 2026-10-05 (pull request #9): one `setupCounts` for every screen, the owner of a listed home can be named there, one name |
| Finances overview | "Total spent" includes reserve transfers, "Money out" does not | done 2026-10-05 (pull request #9): moving money to reserves is not spending; shown on its own line. Trends left them out too, later the same day |
| Requests | Approve acts with no note and the toast names the number, not the title | done 2026-10-05 for the toast (pull request #9) |
| Settings | Access grid and toggles save without a word; first click removes access | done 2026-10-05 (pull request #9) |
| Resident add card | Copy for developers ("Use the test number 4242...") | done 2026-10-05 (pull request #9) |
| Small | `/about` linked from nowhere; 404's main button is "Back to sign in"; pinned announcement under a newer one; "Change dues" field empty; notice title shows the fix, not the rule; no maximum on the association name; weekday names wrong in demo copy; "An admin can turn it back on" | done 2026-10-05 (pull request #9), except the notice title: the form has no title field, so the fix text is the title. Done 2026-10-06 (pull request #11, migration 0097 applied): the form asks for the rule in a few words and what needs fixing; both show to the owner |

