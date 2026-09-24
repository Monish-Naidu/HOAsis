# What is left

Handoff updated 2026-08-27. Everything not listed here is built, tested and
pushed. Test suite at the time of writing: **440 unit, 122 end to end, 198
database checks**, all green.

Playwright now runs four workers and the suite takes about two minutes rather
than five. `fullyParallel` stays off, because several specs found an
association in one test and read it back in the next.

## 2026-09-24 overnight: mixed communities, the overhaul, five years

Monish's six asks, all built. **Committed locally, not pushed**: he wants to
try it on localhost first. Migrations 0036, 0040, 0041, 0042 are already on
the production database (all additive; the deployed site keeps working).

1. **Mixed communities.** Onboarding asks the kinds of home (pick one to
   three) before dues; dues can differ by kind; each lot range carries its
   kind; the founder's kind comes from the range their number is in. Each
   unit stores `home_type`, the association `home_types` and `dues_by_type`
   (0036); `issue_assessment` bills each home its kind's amount. Read per
   home dues only through `src/lib/home-types.ts`. Homeowners filters and
   edits by kind; Settings has a **Dues** card (dues could not be changed
   after founding at all before tonight); resident cards show the kind.
2. **Mobile.** 65 routes x 8 widths audited; every break fixed (landing
   phone section, board header at 320, resident tab bar at 320/360, squeezed
   rows, wide tables stacked below sm, notifications panel, wizard footer,
   16px fields on touch). No page scrolls sideways at 320 to 1440.
3. **Overhaul.** Cool neutrals, no card hairlines, one button scale
   (`sm md lg xl`, `hero` for marketing), `Segmented` `Select` `Checkbox`,
   one filled button per screen, landing rebuilt (flat browser frame with
   light and dark captures, fewer glossy tiles, no seams, no overclaiming
   copy), About linked, wizard survives a reload.
4. **Board tabs, 13 rows to 9** plus Setting up: Finances (Overview,
   Transactions, Collections, Reserves), Requests (From owners, Notices),
   Messages (Inbox, Announcements, Community), Meetings (Meetings, Voting).
   URLs unchanged; routes carry `parent`/`tab`; `section-tabs.tsx` in the
   board layout. Numbers that disagreed now agree (reserves, vendor counts,
   transaction totals, collections labels). Dashboard lost its chart, quick
   actions and action items; Settings lists officers plus a picker.
5. See 4.
6. **Five years, forty homes.** Juniper Hollow was founded through /start
   and filled by `scripts/verify-five-years.mjs` (townhomes 1-24, condos
   25-40 at a higher amount). Write-up: `docs/qa-2026-09-24-five-years.md`.
   Biggest finds, fixed: every real association past about two years read only
   its newest 1000 statement rows; buyer closing payments never hit the
   books; the second request number collided; owners saw $0 for association
   funds (`association_funds`, 0041); two seat elections took one pick per
   home and halved turnout (`cast_votes`, 0042).

Sign in to Juniper: `monishnaidu18+fiveyear@gmail.com` (password in the QA
write-up). Owners `qa5y-*@example.com`. Remove it with
`node scripts/verify-five-years.mjs --remove`.

**Still open, his call:** late fees are promised on the pay page but never
charged; no way to record a reserve transfer or any ledger line besides dues
and vendor payments; a buyer sees the seller's payment history; Budget and
Trends stay off; Resend domain still unverified (nobody but Monish can sign
up until it is). `scripts/verify-ranked-list.mjs` signs in with Monish's
seed password, which no longer works.

## 2026-09-23: Stripe live in test mode, full overnight QA

Write-up in `docs/qa-2026-09-23.md`. Payments work end to end on Oakview.
Two large holes closed: dues were never billed for real associations
(`/api/assessments/run`, migration 0034) and invited owners never received
their seat on sign-in (`claim_my_seats`, migration 0035). Open from that
run: the SetupIntent "Add a payment method" form needs a human click test,
Link extras in the Stripe form, Radar Pro on Oakview, officers still need a
login, and the Resend domain below.

## Still open, as of 2026-09-19

The short list. Everything below it is history of what was built.

1. **Dues letters are not emailed.** "Send reminders" on Homeowners puts
   each household's letter on its thread; the resident's copy does not go
   out by email. `DuesMailer` on Communications still sends the fixed API
   wording. Merge: `/api/email/send` takes a subject and body per household,
   `RemindersComposer` posts to it, `DuesMailer` goes away.
2. **Landing copy overclaims.** "Knowledge center" (nowhere in the app),
   "Message homeowners and vendors instantly" and "video call with board
   members or vendors" (vendors cannot be messaged or called). Cut the words
   or build the thing.
3. **Resident calendar shows only upcoming meetings.** Board Meetings keeps
   the past; a resident's search hit for an ended meeting lands on a calendar
   that does not list it. Add a Past meetings card to `MeetingRsvps` or the
   calendar page.
4. **Resend domain.** yourhoasis.com is not verified, so mail still goes
   from Resend's test sender and bulk invites fail for everyone but the
   account owner. Monish adds the domain and DKIM/SPF, then sets
   `EMAIL_FROM` on Vercel.
5. **Anchors under the narrow board header.** Search deep links use
   `scroll-mt-24`; below `lg` the board header is two rows tall and the
   target row lands partly under it.

## 2026-09-19, late: one search for the whole association

Monish asked what happens in year three, when every tab holds years of
records. Answer built: one search field, not a filter bar on twelve tabs.

- **`SearchPalette`** (`search-palette.tsx`): ⌘K / Ctrl+K anywhere in either
  shell, or the Search button in the top bar (icon alone on the phone
  header). Mounted once per shell; buttons call `openSearch()`, so two
  headers never register the shortcut twice.
- **`src/lib/search.ts`** builds the index from the records already in
  memory: households, transactions, documents, threads, meetings, ballots,
  requests, notices, vendors, announcements, forum posts, action items.
  Every typed word must match; title beats subtitle beats hidden keywords;
  ties go to the newest. Grouped by tab, five per group.
- **Gating.** Board hits pass the route table (`BOARD_ROUTES` need and
  module), so a Treasurer without `communications` never sees threads.
  Residents get documents not marked board-only, meetings, owner ballots,
  their own requests and notices, announcements, published posts.
- **Deep links.** Households `?q=`, transactions `?q=&from=&to=` (the
  entry's own year, not this month), documents `?q=` (both sides), threads
  `?thread=` (Communications and both Documents pages now wrap in Suspense
  for it), and `#id` anchors with `scroll-mt-24` on meetings, ballots,
  requests, vendors, forum posts.
- **Meetings keep their past.** Board Meetings has "Past meetings": date,
  attendance, agenda, who was in the room, newest first. Ended meetings
  used to vanish. Resident calendar still shows only upcoming; a resident's
  meeting hit lands on the calendar page.
- Tests: `tests/unit/search.test.ts`, `tests/e2e/12-search.spec.ts`.

## 2026-09-19, late: one send, the right letter for each household

Monish: Homeowners said "5 behind" but the composer previewed one
person's name over a "Send to 5" button. It also asked the board to pick
one template for the whole group, when the five stood on four different
rungs of the collection ladder.

- **`RemindersComposer`** (`reminders-composer.tsx`) replaces
  `TemplateComposer`. The policy places each household on the ladder
  (`collectionsLadder`), `src/lib/letters.ts` maps the rung to a letter
  (reminder, late notice, notice of intent) and fills it from that record.
  Left column: who, balance, days late, which letter. Right: that person's
  letter as they will read it, with "Edit the letter" for the wording.
  Households behind but under the reminder day are listed muted with
  "Reminder in N days" and are not sent. Opens from "Send reminders" on
  Homeowners and from the ladder's "Send reminders" on Collections
  (`/board/homeowners?remind=1`, page wrapped in Suspense for it).
- **The household panel has one composer.** A note continues the latest
  thread; "Start from the {letter}" drops the filled-in letter into the
  same textarea and sends it on its own thread under its own subject.
- **Sends are real now.** `messageOwner` in app-state creates the thread
  locally or in `threads`; the old composer only toasted. The inbox keeps
  paragraphs (`whitespace-pre-wrap`).
- **Still two paths for dues mail.** `DuesMailer` on Communications sends
  the fixed API wording by real email for a live association; the letters
  above land on the thread and are not emailed yet. Merging them needs
  `/api/email/send` to take a subject and body per household.
- **Dashboard crash fixed.** A board that skipped every setup task had no
  phases, `SetupPlanSummary` read `phases[0]` and the dashboard showed
  "This page did not load". `allDone` is now true when nothing is left.
  Found because `scripts/product-shots.mjs` skips every task.
- **Resident live meeting row** dropped its `ring-pulse` (the rings drew
  from an unpositioned tile and read as a green flash). Calm tile, green
  "Live now".
- **Landing captures regenerated** from the current product (`pnpm shots`).
  The monitor and phone were a year of design behind.

## 2026-09-19, night: the join code makes the account

Monish: "when you use the join code, shouldn't it let you create an
account in the community? The flow doesn't make sense." It did not: /join
took a code and a name, put a row in the board's queue, and promised an
email that never came; the person then had to find /signin and create an
account with the same address and hope. Now:

- **`/join` is two steps: the code, then the account.** The code names the
  association (`association_by_join_code`), and the second screen creates
  the account inside it: name, email, password, home. `signUp` then
  `request_to_join`, one button. Signed in already, the form is just the
  home. An invitation link (`/join?invite=CODE&email=`) is the same screen
  with the address filled in and locked and no request, because the seat
  already exists; the confirmation email is what claims it. The demo
  `?c=&o=&k=` path is unchanged.
- **Waiting is a state with a screen.** `my_join_requests()` (migration
  0031) answers by the signed in email. The auth callback and
  `destinationAfterSignIn` send somebody with no membership and a pending
  request to `/resident`, where `NoAssociationYet` says "Waiting on the
  board of X" with a Check again button (`loadRemote`, not `refreshRemote`,
  which no-ops without an active association). Declined says so. Everybody
  else gets Set up and "I have a join code".
- **Letting them in seats them on the spot.** `add_household` already
  linked a profile by email; `approveJoinRequest` now also posts to
  `/api/email/invite` with `kind: "welcome"`, which sends a magic link to
  `/resident`.
- **Invitations, for real associations.** `remoteInviteUrl()` in
  invitations.ts; Homeowners "Copy invite link" uses it when `isRemote`,
  each household row has "Email invite" (or "Email sign-in link" once they
  have an account), and the header offers "Invite N not signed up".
  `/api/email/invite` checks `settings` or `communications`, mints a magic
  link for people with accounts and the join link for everyone else, logs
  every attempt under the new `invite` category (migration 0032).
- **Officers can be named before they sign up.** Settings > Who is on the
  board lists every home with a named owner, signed up or not (`setHomeRole`
  updates the membership by `unit_id`); the presidency still needs a person.
- **Proof.** `scripts/verify-join-flow.mjs` (in `db:verify`, 21 checks):
  founder, thirteen households, three officers named blind, treasurer seated
  as treasurer on sign up, added owner seated, newcomer asks with the code,
  waits, is seated the moment the board adds the home, resident cannot
  self-promote. And a Playwright walk of the whole thing in the browser
  (founder through the wizard by address, officers in Settings, bulk
  invite, copy link, six arrivals by link, five by sign up, two by code and
  approval, treasurer sees Finances): 28 of 28 with one caveat below.

**Caveat, still owed:** Resend's test sender refuses every address but the
account owner's, plus-addressed ones included, so the bulk invite logged
eleven failures ("Invalid `to` field"). The route, the log and the links are
right; delivery needs the yourhoasis.com domain verified in Resend and
`EMAIL_FROM` set on Vercel, as noted above. The browser walk simulated the
confirmation email by intercepting `/api/auth/signup` and creating the user
confirmed through the admin API, which fires the same trigger.

## 2026-09-19, late: the clean pass

Monish, as principal designer: every tab, section and flow, make it look
clean. Held to `docs/design/ui-baseline.md`. The structural moves:

- **The photo banner is the front door, not a masthead.** It shows on the
  board dashboard and the resident dashboard only (`BoardHero` in
  community-hero.tsx, a pathname check in resident-shell.tsx). Every other
  page opens with its own title. The resident top bar now names the
  association and the home, since the banner no longer does on inner pages.
- **One theme button.** The four-icon radio group in every top bar is a
  single button that cycles light, evenings, system, dark, with the mode in
  the tooltip. `ThemeToggle expanded` keeps the full group for a settings
  surface.
- **Every page header the same:** title, one line under 90 characters,
  one primary action. Eyebrows that restated the sidebar label are gone.
- **Rhythm on the 4pt grid:** mt-6 between cards, 16 or 20 inside, rows 12
  to 14. Ad hoc type sizes folded into the 28/22/17/15/13/11 scale.
- **Fewer tiles, no decorative icons.** Dashboard stats four not five;
  Homeowners and Requests lose tiles that duplicated a count on the same
  page; card headers lose icons that did not aid recognition.
- **Plain words on screen:** collections ladder steps and standings
  (Current, In grace, Late, In collections; Final notice, Attorney), "dues"
  not "assessment" in resident copy, chart legend in sentence case.
- **Resident:** the two dashboard banners are one "today" card; Recent
  activity caps at four; the Statement button actually downloads a CSV;
  inputs are 44px on phones; sign-in hides the two extra theme options
  below sm.

## 2026-09-19, night: Your HOAsis at yourhoasis.com

Monish took the name back. The product is Your HOAsis; the domain is
yourhoasis.com. Done the same night:

- Code and copy renamed everywhere user-facing (wordmark "Your" + "HOAsis",
  titles, emails, fixtures, package name, brand doc now
  `docs/design/brand-yourhoasis.md`). Storage keys already said hoasis.
- Cloudflare zone `yourhoasis.com`: A @ 76.76.21.21 and CNAME www
  cname.vercel-dns.com, both DNS only. Vercel project has yourhoasis.com and
  www; www, expresshoa.com and www.expresshoa.com all 308 to the apex.
- Supabase Auth site_url is https://yourhoasis.com; the allow list keeps
  expresshoa.com and localhost and Vercel previews.

**Owed:** Resend does not know yourhoasis.com yet. The API key on this
machine is send-only (403 on /domains), so add the domain in the Resend
dashboard, add its DKIM and SPF records to the Cloudflare zone, then set
`EMAIL_FROM="Your HOAsis <hello@yourhoasis.com>"` on Vercel. Until then
the code default sends from Resend's test address, which works but says
resend.dev.

## 2026-09-19, evening: the full-flow pass

Monish: principal PM and principal designer, go through the whole flow on
both sides, find what is janky or does not work, fix it. Driven in Chrome
at desktop width and with Playwright at 390px for the resident side. What
changed:

- **Setup comes back to the question you left.** Every "Open Documents"
  style link out of a setup question now carries `?from=setup&task=<key>`
  (`setupLink()` in setup-plan.tsx). The return bar reads it and says
  "Back to the question" with the question's label, linking to
  `/start/plan?task=<key>`; when the task completes on that screen it
  pushes to the next open question, or the overview when none is left.
- **Dashboard leads with "Needs you today":** transactions to confirm,
  requests waiting, invoices to approve, join requests, owner-says-fixed
  notices, overdue action items, each a row with a count and a link,
  omitted at zero. Header is role + "Dashboard"; the year pills sit in
  the chart card header.
- **Duplicates removed:** the money-tabs caption that repeated every
  finance page's description; the second "New announcement" button; the
  "On the clock" card that showed each request a second time with two
  more verbs; the My Home card on Account that repeated the banner.
- **Jargon and grammar:** policy citation lines on requests are now
  "Answer by Sep 3"; "1 updates" pluralised; vendor payouts say "Approve"
  and "Approved by Dana" instead of a 1/2 quorum counter; the governing
  tile is "Your governing documents"; meetings show one "Next meeting"
  line instead of a lone stat tile.
- **Broken things:** the request form's "Add photos or documents" button
  did nothing; it now opens a picker and lists what was chosen (names and
  sizes go on the request; bytes wait for request storage). The "Cheapest"
  badge showed on a tie. The landing header's Get started wrapped to two
  lines on phones. The roster's contact column drifted per row; it is a
  fixed grid now. Phones showed the community name three times; the hero
  title is screen-reader-only below lg on the resident side.

Still worth doing, not done here: a real image upload for request
attachments (needs a `request-files` bucket and a column), and the
resident dashboard's Recent activity mixes charges and request updates
that the Requests tab already shows.

## 2026-09-19, later: homes by address, and amenities the board names

Monish, from the Homes step of setup: not every community numbers its
homes, some only have street addresses, and Continue only lit up once
number ranges were typed. Also: the amenities picker only offered the six
chips.

- **Homes step has two ways in.** "By address" is the default for owners
  who already run detached homes: a list with Address, Owner, Email, an
  Add a home button and a Paste a list box (one address per line). The
  founder's own home is the first row, from the previous screen, so
  Continue is always enabled; the rest can come from the roster. "By home
  number" is the old ranges screen, default for a builder or a condo. The
  address is the register key (`DraftHousehold.unit` = the address,
  `address` carried alongside), so a home that was never numbered is one
  row with one balance and one vote. `founderUnit()` falls back to the
  founder's address when the number is blank; `finalizeDraft()` settles
  the key and drops blank rows before either creator runs.
- **The founder's number is optional** unless a builder is involved, and
  says so on the field.
- **Amenities:** `customSpaces` on the draft, a text box under the chips,
  and `amenitiesFromSpaces(spaces, custom)` makes each one a reservable
  amenity in demo and remote alike.
- **Reserve study as a file** (`reserve-study-card.tsx`, on the Reserve
  Study tab in both states): the date on the study plus an upload; the file
  lands under Documents as Financial, `settings.reserveStudy` (jsonb, no
  migration) points at it, and the card says when the next one is due
  (three years). Extraction of components from the PDF was discussed and
  parked: a reviewed Claude extraction is a day behind an API key.
- **The bird moves.** `page-transition.tsx` rises every board and resident
  page in on route change; `hummingbird.tsx` gives a hovering-bird loader
  (used while a session resolves, in place of a blank) and an arriving bird
  on the setup Finished screen; the sidebar mark lifts on hover. All
  respect reduced motion. Keyframes in globals.css.
- **Migration 0030** (`0030_homes_by_address.sql`): `create_association`
  reads `address` from each household. Same signature. Pushed 2026-09-19
  once the project was back.
- **The project was paused, not deleted.** The free tier pauses a project
  after a week without traffic; the hostname stops resolving and the
  pooler says "tenant not found", which reads exactly like deletion. The
  management API says `INACTIVE`, and `POST /v1/projects/<ref>/restore`
  brings it back in about four minutes with every row intact. That is what
  happened on 2026-09-19. Check status before assuming anything:
  `npx supabase projects list`. The pause repeats until the project is on
  a paid plan or gets weekly traffic; the daily billing cron on Vercel
  hits it, so it should stay awake now that the deploys are current.
- `scripts/rebuild-supabase.sh` exists for the day it really is gone:
  create, link, push, seed, auth URLs, Vercel keys, verify, one command.
  It needs a fresh `SUPABASE_ACCESS_TOKEN` in `.env.local`, which is also
  what `db:push` and `db:types` need; the token from August had expired.
- `homeLabel()` and the new `placeLabel()` in `lib/wording.ts` leave an
  address alone instead of printing "Lot 1 Alder Way".
- Tests: `tests/unit/new-community.test.ts`; `07-onboarding` fills the
  address list when no ranges are offered.

## 2026-09-19: the launch scope, cut to what month one needs

Monish, with customers about to onboard: simplify everything, grey out what
is too complicated, keep Vendors, Reserves, Documents, Settings and Forum,
lose Compliance, explain or simplify Shared costs, make Voting and
Violations plain. Then, as principal PM: go through both sides and decide
what truly needs to be there. Two audits (board, resident) drove the cuts.

**One switch.** `src/lib/modules.ts` lists every module, whole pages and
pieces of pages, with `on: true|false` and a note saying why it waits.
Board routes carry a `module` key, resident tabs and `/resident/report`
do too, and both navs filter through `moduleOn()`. A page whose module is
off renders `ModuleOff` ("... is not switched on for this association yet")
in both shells, so a typed URL gets the same answer as the sidebar. Turning
something back on is one line. Per-association overrides are a settings
column later.

**Off at launch:** Compliance, Shared costs (utility bills the association
pays on everyone's behalf and splits across homes, only for master-metered
communities), Budget and Trends sub-tabs, the full enforcement queue, Report
a neighbour, the phone-preview toggle, the deposit-insurance warning, year
against year, the notice delivery panel, vendor tax paperwork (W-9, 1099),
new-owner disclosure, the capability grid, autopay cap and skip, records
requests.

**Rebuilt simple:**

- **Notices** (`notices-board.tsx`, route still `/board/violations`): Open
  and Resolved, New notice (which home, what needs fixing, the rule if you
  want to name it), Print letter, Mark resolved. Owner says fixed still
  lands at the top. `addNotice()` writes a board-sourced violation at the
  courtesy stage. The old `EnforcementQueue` is intact behind
  `enforcement-full`.
- **Voting**, board: ask, count, close. `new-ballot.tsx` is the question,
  the choices and the day voting ends (kind poll, no quorum, "Most votes
  wins"). `ballot-card.tsx` shows votes in, the result when it ends, and
  Close now (`closeBallot()`). Closed ballots are one line each with
  `resultLine()`.
- **Voting**, resident: one card per open ballot, tapping a choice is the
  vote, "You voted", change until it ends. Closed show the result line.
  Meeting RSVPs moved to the Meetings tab (`meeting-rsvps.tsx`).
- **Board trims:** dashboard ships Quick Actions layout A with no A/B
  toggle, the donut and Compare years are behind `money-compare`, the
  Requests tile no longer carries the notice count, the meeting tile says
  Schedule one when there is nothing to join. Finances overview loses the
  comparison and budget-pace cards. Transactions loses the Direction filter
  and the Running column. Requests has two stats and no second work-order
  card. Meetings has one stat and no fixture note. Communications: New
  announcement, three stats, no category select. Vendors: insurance
  certificate spelled out, tax paperwork behind a flag. Documents: no
  "once that page ships" callout. Settings: capability grid and board-change
  counts behind `settings-advanced`. `setup-hub.tsx` (dead) deleted.
- **Resident trims:** three quick actions, Docs on the phone tab bar and
  Vote web-only (the dashboard banner links an open ballot), no association
  cost economics anywhere the owner reads, no "Tell the board about
  something" link, Records category off, Appeal this is Ask the board.
- **Landing page** no longer leads with Compliance and lists Notices, not
  Violations.

**Tests:** `tests/unit/modules.test.ts` proves nav and layout read the same
switch and that the scope Monish set (Vendors, Reserves, Documents,
Settings, Forum on; Compliance, shared costs off) holds.
`tests/e2e/09-enforcement.spec.ts` covers the simple Notices page; the
specs for the full queue, shared costs, compliance and the delivery panel
skip themselves while those modules are off, naming the switch.

**Not done, on purpose:** Setup checklist still has every task (cutting
structural and maintenance-matrix touches `setup-plan.ts` and its tests;
do it with the first customer's answers in hand). Collections ladder and
policy card unchanged (Monish asked for them on 2026-09-03). Amenity rules
editor unchanged.

## 2026-09-06: the ranked list, built

The nine things the competitor comparison (`docs/research/`) said every
serious product has and this one did not. All nine ship in this pass, in
demo and remote mode, on migration 0029 (`0029_ranked_list.sql`), proved by
`scripts/verify-ranked-list.mjs` (21 checks, in `db:verify`).

- **Autopay with a cap and a skipped month.** The owner's plan lives on
  their membership (`memberships.autopay`, `set_my_autopay()`); the pay
  screen starts from it, saves every change, and derives the next run date
  from the association's own next charge date. Still a standing instruction
  until Stripe runs it, but one the roster can already see.
- **Owner says fixed.** Two columns on the violation and
  `mark_violation_fixed()`, which lets a home write only those two on its
  own notices. The resident's notice gets "I have fixed this" with a note;
  the board's queue shows "Owner says fixed" first.
- **Work orders** hang off a maintenance request (`requests.work_order`):
  vendor, scheduled date, estimate, actual cost, done. What changed is said
  in the request thread, so the owner reads it too.
- **Amenity fees, deposits and blackouts** are booking rules (jsonb, no
  migration). A blacked-out day offers no slot and says why; the fee is on
  the picker and in the request summary.
- **Meeting RSVP.** `rsvp_meeting()` replaces the caller's own entry in
  `meetings.rsvps`. Residents answer from the vote page; the board sees
  counts and names under Upcoming.
- **Print a notice as a letter.** `notice-letter.tsx`, a print-only sheet
  from the violation and the association, opened from the violation detail.
- **Email delivery tracking.** `/api/email/webhook` takes Resend's signed
  events and writes `email_log.status`. The dues mailer shows what was
  sent and what became of it. **Needs `RESEND_WEBHOOK_SECRET` and a
  webhook in the Resend dashboard pointed at that route.**
- **Board action items** (`action_items`, board members read, voting
  capability writes): who agreed to do what, by when, from which meeting.
  On the dashboard and under Meetings.
- **Request to join.** Every association has a six-character `join_code`
  (Settings shows it with a copy link). `/join` without a token is the ask
  form, callable signed out through `request_to_join()`. The board's
  Homeowners page has the queue; letting somebody in is `add_household`,
  so nothing new can seat a person.

`database.types.ts` is hand-patched again for 0029: `gen types` needs
either the access token or Docker, and neither is available here.

**Still owed by Monish, as of 2026-09-06:**

1. In the Resend dashboard, add a webhook pointed at
   `https://expresshoa.com/api/email/webhook` (all `email.*` events) and
   put its signing secret in Vercel as `RESEND_WEBHOOK_SECRET`. Until
   then every sent email stays "on its way".
2. Verify `expresshoa.com` in Resend and set `EMAIL_FROM` to an address
   on it (in `.env.local` and Vercel). The shared `onboarding@resend.dev`
   sender only delivers to Monish's own inbox, so signup and dues mail
   cannot reach real residents yet.
3. `supabase login` (fresh `SUPABASE_ACCESS_TOKEN`), then `pnpm db:types`
   to replace the hand-patched `database.types.ts`. Also a fresh Vercel
   CLI token.
4. Stripe: `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` from
   the dashboard into `.env.local`, then `pnpm stripe:setup` registers both
   webhook endpoints and writes `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_BILLING_WEBHOOK_SECRET` and `CRON_SECRET`; copy all five into
   Vercel. Autopay runs daily once these exist (2026-09-23,
   `docs/design/payments.md`).

## 2026-09-05: every screen driven in Chrome, both modes, and what it turned up

Monish asked for the onboarding, every board tab and every resident tab to be
run from a real browser, deletes included, fixed where broken, and improved
against the competitors. Done as a throwaway builder association (Quinn Ridge
Estates, 24 lots, since deleted through its own Settings), then Oakview as a
resident, then the browser-only demo. Everything below is pushed.

**Fixed, in order of how much it mattered.**

- **Dues email reached nobody.** `email_recipients()` gated on
  `has_capability()`, which reads `auth.uid()`; the server sends with the
  service role, which has no user, so every dues run "sent" zero emails and
  reported success. Migration 0027 lets the service role through (the API
  route already checks the capability itself). Preview and Send now count
  the real list.
- **Signup email.** Supabase's built-in mailer was refusing signups (it is
  rate-limited and testing-only). `/api/auth/signup` now mints the confirm
  link with the admin API and sends it through Resend from our own template,
  rolling the user back if the send fails. **Delivery to anyone but Monish's
  own address still needs `expresshoa.com` verified in Resend and
  `EMAIL_FROM` set to it.** The key in `.env.local` is send-only.
- **City notices lost their source.** The violations table had no column for
  source, agency, case number or resolved date, so a logged city notice came
  back as a board notice. Migration 0026 adds them; the mapper and the three
  write sites carry them.
- **Real associations ran on the demo clock.** `setToday()` was fed the demo
  community's date even in remote mode, so a closing date defaulted to
  August and the database refused it as earlier than the tenure. The clock
  now follows the remote association. The sale toast also fired before the
  write, so a refusal showed two answers; it waits now.
- **Resident/Board switch lit the wrong side** (stored session view, not the
  page). Derived from the pathname.
- **A resident typing a board URL saw the board chrome.** `BoardOnly` in the
  board layout sends them home.
- **Enter did not submit** vendor, ballot, meeting, payment, shared cost,
  city notice, announcement, report, request or signup panels. `Card` can be
  a form (`as="form"`), and `Button` defaults to `type="button"` so a Cancel
  inside a form no longer submits it.
- **Stubs removed or made real:** Communications "New message" (opened
  nothing, now opens the composer), recipient and attachment pickers
  (toasts, gone), a hardcoded "Board (4)", the Documents callout claiming a
  public records page was live, the sign-in card publishing a password for
  an account that no longer existed (now "Look around first").
- **Remote leaks:** demo "uploaded" forms and the Reset demo data button
  showed on real associations; placeholder homes read "Unit 1 · Unit 1 ·
  Unit 1" (now "Not yet sold" for a builder, "No owner yet" otherwise);
  wizard amenities never reached the amenities table; the mocked bank
  picker showed to real founders; Preview on the dues mailer lit the Send
  button as "Sending".
- **Compliance marks did not persist** in remote mode (jsonb key was not
  read back). Fixed alongside the feature below.

**Built from the competitor comparison** (PayHOA, AppFolio, Buildium,
Condo Control; notes in `docs/research/`).

- **Schedule a meeting** (`schedule-meeting.tsx`). The page could list and
  show a live meeting but nobody could create one; `addMeeting` had no
  caller. Residents see it on their calendar at once.
- **Mark an obligation done** on Compliance, with undo, stored as
  `settings.complianceDone` (jsonb, no migration). An annual duty falls due
  again once the mark is a year old. **Insurance renewal** is an obligation
  when Settings knows the date, as Settings always promised.
- **Forum replies persist** (migration 0028, `post_replies`, RLS: members
  read, members write their own, forum capability or author removes).
- **Owners keep their own phone and mailing address** (0028 adds both to
  `memberships`; `update_my_contact()` touches nothing else). Contact card
  on Account, shown on the board roster.
- Fifty states in the founder's state picker (`US_STATES`; the 12-state
  `STATES` list still drives the library), and "Lot" versus "Unit" wording
  follows the property type on the roster, account menu and dashboard.

**Verified working, no change needed:** every board and resident route in
remote and demo mode with no console errors; add, edit and delete on
vendors, households (with undo), sale transfer, budget lines, reserve
components, shared costs and bills, announcements, posts, documents
(upload, visibility, remove), ballots and votes, requests and approvals,
neighbour reports through to a notice, settings toggles, association
delete (soft, thirty days), the `/join` page with a bad or missing token,
capability refusal for a resident.

**Still owed by Monish:** verify `expresshoa.com` in Resend and set
`EMAIL_FROM`; refresh `SUPABASE_ACCESS_TOKEN` (then `pnpm db:types`, the
types file was hand-patched for 0026 to 0028) and the Vercel CLI token;
Stripe keys as before.

**Not built, still on the list:** autopay cap and skip-a-month (autopay is
still local state), owner marks a violation fixed, work orders from
requests, amenity fees and blackouts, meeting RSVP, print a notice as a
letter, email delivery tracking, board action items, request-to-join. Home
photos and vendor invoices remain browser-only.

## 2026-09-04: the trial is real, and the wall between associations is proven

- **Ninety days, then billing.** Migration 0025 gives every association a
  `trial_ends_at` (founding + 90 days) and a `subscription_status` of
  `trialing | active | past_due | canceled | ended`. `src/lib/billing.ts`
  turns those into a phase; the board sees a banner (quiet, then amber in
  the last two weeks, then red), Settings has the "Add a card" row, and a
  billing wall closes board pages two weeks after an unpaid trial ends.
  Stripe Checkout carries the remaining free days as a `trial_end`; a
  separate billing webhook writes the result; `/api/billing/sweep` runs
  daily from `vercel.json` to send the three notices and mark ended trials.
  Full write-up in `docs/design/billing.md`. **Still blocked on Stripe
  keys** plus `STRIPE_BILLING_WEBHOOK_SECRET` and `CRON_SECRET`.
- **Isolation.** `scripts/verify-isolation.mjs` (in `db:verify`) reads the
  generated types and, as one President, tries every association-scoped
  table and view against another association. 71 checks green.
  `tables_without_rls()` is the database's own answer on coverage.
- **Seed.** `pnpm db:seed` wipes the project (needs `ALLOW_TEST_RESET=true`)
  and founds Oakview Commons (Bellevue, Monish president, 5 homes, fresh
  trial) and Cedar Hollow (Bothell, builder, 12 lots, trial ending in five
  days so the closing banner shows) through the wizard's own RPC. One shared
  password, printed at the end.

## Who this is for, as of 2026-08-26

**New communities.** A builder standing an association up before the homes
sell, and the owners who take it over at turnover. An established association
opening its books here is supported as a third path, and is not a migration:
it sets one opening balance per home and is correct from there.

Nothing imports a spreadsheet, and nothing reads an export from another
product. That was removed on purpose, not left undone. `parseRoster`, the
records demand letter, and the leaving-a-management-company plan are gone from
the tree; git history has them if the market ever comes back.

Run these before and after any change. The first four take about fifteen
seconds together; the last two take three minutes and are 97% of the wall time,
so run them when the change earns them rather than by reflex.

```bash
pnpm lint && npx tsc --noEmit && pnpm build
npx vitest run
(pnpm start -p 3000 &) ; sleep 9 ; npx playwright test    # needs a server, it does not start one
pnpm db:verify                                            # hits the real Supabase project
```

`vitest` is 3.7s for 440 tests and is never the thing slowing you down.
Playwright is 114s and `db:verify` is 88s of network round trips. Skip
Playwright unless the change drives a flow a spec covers, and skip `db:verify`
unless the change touches the data layer, the schema or SQL. Measured
2026-08-27.

---

## The list of ten is done

All ten items are built. What follows is what each one turned into, and what is
still worth doing inside each area.

### 10. Bylaws, CC&Rs, templates, and parsing an uploaded document — DONE

Built 2026-08-26. What shipped:

- **The three documents are separate things in the model.** `GoverningArticle`
  carries `document: "declaration" | "bylaws" | "rules"`. `Community.bylaws`
  became `Community.governingDocs`, because a field named `bylaws` holding
  CC&Rs is the exact conflation this item existed to fix. The declaration got
  twelve articles and the board-adopted rules six, in
  `src/lib/data/governing.ts`.
- **The hierarchy is functional, not decorative.** `src/lib/governing.ts` holds
  it. Amending the declaration reads seventy-five percent and recording with
  the county out of the association's own Article XII; amending the bylaws
  reads sixty-seven percent out of theirs; a rule takes a board vote and no
  owner vote, and the amend screen says so and changes its own button. The
  reader and `DocumentHierarchy` put state law above all three.
- **Citations resolve.** `resolveCitation` turns "CC&Rs Art. IX §2(b)" into the
  article, keeps the declaration's Article VII apart from the bylaws' Article
  VII, and refuses rather than guesses. The violations list on
  `/admin/requests` links a resolved citation and flags an unresolved one,
  which is a real finding: a notice naming a provision nobody can produce.
- **The new owner screen.** `/resident/documents/what-you-agreed-to` and the
  board's `/admin/documents/new-owner`, both on the eight statutory disclosure
  topics, each answered by a confirmed provision or left blank. A word match is
  shown as a candidate to check, never as an answer.
- **Import.** `/admin/documents/import`. `src/lib/governing-extract.ts` is a
  real parser over text: it splits on the outermost heading level the document
  uses, keeps wording verbatim, borrows a title from the next line and flags
  that it did, reports preamble and empty headings as gaps, refuses a number
  the document already has, and writes no plain reading at all.
- **Templates.** Decided in `docs/decisions/shipping-document-templates.md`: no
  declaration or bylaw text, ever; four starter policies at the rules layer in
  `src/lib/data/policy-templates.ts`, offered only when the rules are selected.

Still worth doing here, none of it blocking:

- **PDF text extraction.** The import screen takes pasted text or a `.txt`
  file. A PDF is refused with an explanation, because reading one as text gives
  back its object stream. This belongs on the server.
- **Editing an imported article.** A board can import and can amend, but cannot
  write the missing plain reading directly in the reader. Right now the route
  is to amend the article, which is heavier than the job.
- **Tagging a disclosure candidate from the board screen.**
  `/admin/documents/new-owner` lists the unconfirmed candidates for a topic but
  has no tick to confirm one; the tick only exists during import.

The research that fed it, kept because the reasoning still applies:

- Three legislatures independently converged on the same short list of what a
  buyer must be warned about: **flags, solar, signs, parking, home business,
  rentals, architectural approval, and the lien consequence of nonpayment.**
  That is a defensible schema for a "what you need to know" screen, because it
  is what statute says buyers must be told. Sources: Va. Code § 55.1-2310 items
  21 to 26, Colo. Rev. Stat. § 38-35.7-102, RCW 64.90.640(z).
- **Florida § 720.303(15)(b) puts the duty on the association**, not the
  seller: "An association shall provide a physical or digital copy of the
  association's rules and covenants to every new member." Every other state
  researched puts it on the selling homeowner, who has the least incentive and
  the worst records. Florida is the compliance hook.
- Arizona § 33-1806 makes every buyer sign that they have "read and understand"
  the documents within 14 days. Nobody has read them. A product that makes that
  signature true rather than merely collected is the wedge.
- **46% of HOA homeowners have been fined, warned or cited** (LendingTree with
  QuestionPro, n=2,000, February 2026). "Everybody knows the rules" is named as
  a benefit by **6%** (Foundation for Community Association Research with
  Zogby, n=3,000, 2026). The failure is structural, not malicious: the rules
  are windows rather than prohibitions, and an owner who does not know a rule
  exists cannot request the approval that would have made the project legal.

**Standing: we index governing documents, we do not judge them.** No
auto-detection of violations from a parsed document, ever. The reasoning is in
`docs/decisions/parsing-governing-documents.md` and it is not an accuracy
argument, so a better model does not reopen it. Everything built above holds
that line, and the tests in `tests/unit/governing.test.ts` exist mostly to
catch a future change that quietly starts asserting what a provision means.

### 4, 5, 7 and 8 — DONE

Built 2026-08-26. The reasoning for 4, 5 and 8 is in
`docs/decisions/enforcement-and-delivery.md`.

**4. Violations, and where they come from.** Residents can report. A report is
a separate record from a violation and cannot become one until a board member
has gone and looked and written down what they saw: `canRaiseNotice` requires
the note, and `raiseNoticeFromReport` refuses without it in the state layer
rather than only in the screen. The reporter is named to the board and to
nothing the accused can reach. `reportingPatterns` surfaces one household
repeatedly reporting the same neighbour, which is the fair housing problem
worth seeing early. Resident side is `/resident/report`; the board queue sits
under `/admin/requests`.

**5. Violation photos.** `photoCount` became `photos`, each carrying what it
shows, when, who took it, and **where from**. `EvidenceViewer` serves the board
and the accused owner from the same component, and the owner now has a screen
at all: `/resident/notices`. `photoConcerns` flags a photograph taken over a
boundary or from the air before the notice goes out. The images themselves are
described rather than generated, following the library's photo brief rule.

**7. Compliance.** Wired, not cut. `src/lib/data/obligations.ts` holds the
obligations and `src/lib/compliance.ts` derives the register from them, with
dates worked out from the association's fiscal year. Four states carry their
own citations traced to their library article; everywhere else gets general
duties with no statute attached, and the screen says which it is looking at.
The old placeholder fixture is deleted, and the nav badge now derives from the
same selector as the page, which it did not before.

**8. Communications.** The rules, which are the hard half. `src/lib/delivery.ts`
holds which notices may travel which channel, and where paper is the notice it
says the electronic copy is a courtesy. Text is gated on two separate things,
both real: prior express consent, revocable and never overridden, and
registration with The Campaign Registry, which needs the EIN. The panel on
`/admin/communications` shows how a roster splits across channels for a chosen
notice kind, and how many households nothing reaches at all.

Still open in this area:

- **The state by state mail question.** Exactly which notices need certified
  mail differs everywhere. It belongs in the compliance register where a row
  carries a citation, not in `delivery.ts`.
- **Consent capture.** `ContactConsent` is modelled and the rules read it, but
  no screen asks an owner for it yet. Nothing texts anybody, so nothing is
  broken; it is the next thing to build here.
- **Eight more states** for the compliance register. WA, CO, FL and CA are
  written. The library has articles for all twelve.

---

## A real association saves what the board does — DONE 2026-08-28

Found and fixed the same day. Monish reported that "some of the pages in
admin don't work, like documents". Every admin page rendered for a real
association, and almost nothing done on one was kept: the state layer in
`src/lib/app-state.tsx` wrote each action to a browser-local slice, and a
real association (`remote.community`) read only Postgres. The demo hid it,
because every e2e test runs on the demo.

**What is in place now.** Every mutation in `app-state.tsx` branches on
`remote.community`: the demo path is unchanged, the real path writes through
`remoteWrite()` in `src/lib/data/remote-store.ts` and then re-reads the
association. A failed background write reaches the person as a toast through
`RemoteErrorToasts`, mounted in the root layout. Ids for new rows are chosen
in the browser (`src/lib/core/ids.ts`) so a screen can name what it just
created; the database takes them as given.

Migrations 0016 to 0019 carry it: the `documents` bucket (0016, 0017), ten
tables and the columns that were missing (0018: `payment_instruments`,
`payouts`, `violation_reports`, `violations`, `threads`, `governing_articles`,
`budget_lines`, `reserve_components`, `message_templates`, `forms`,
`post_likes`; `associations.settings`; request threads and decisions; post
moderation fields; ballot and meeting fields), and shared cost kind (0019).
Three functions: `add_household`, `remove_household` (refused for a home with
a statement, and for the President), `like_post` (once per person).

Checked by `scripts/verify-board-actions.mjs` (59 checks, in `db:verify`),
`verify-community-life.mjs` (22), unit tests, the demo e2e suite, and a drive
through the real screens as the Willow Creek board: vendor, budget line,
reserve component, ballot and a vote with a database receipt, household added
and removed, amenity, a setting, a forum post, a request from the resident
side. Test rows were removed afterwards.

**Still browser-only for a real association**, because no screen writes them
yet or the table is not there: amenity bookings, announcements, replies on
forum posts, a resident replying on a request thread, governing amendments,
special assessments (the `levy_special_assessment` function exists and is
verified; no screen calls it). Each is the same recipe as above.

**Two things seen on the way, not fixed:**

- Every non-fixture dashboard (`/admin` for a real association, and for a
  community made in the browser through Quick Setup) logs React error #418, a
  hydration mismatch, on a full load. Cosmetic in the console, the page
  works, the dev server does not reproduce it, so it is specific to the
  prerendered HTML. Not chased.
- The e2e onboarding specs were failing before this work: the previous
  session's last commit reworded the wizard ("lots" became "homes", "Buyer
  for" became "Owner of", an established association's phases became
  groups) and left the specs behind. Fixed in the specs.

**A community made through Quick Setup without signing in lives only in
that browser.** That is what Monish's "fads" is: it is not in the database.
Every page of it works as the demo does, and nothing done in it is anywhere
else. Signing in first, or creating an account inside Quick Setup, is what
makes an association real. Worth making unmissable in the wizard.

## Asked for on 2026-08-28 — DONE the same day

All four, plus one bug that was blocking real associations entirely.

**The bug.** `association_origin` in Postgres still held the values from
before the repositioning (`new`, `self-managed`, `leaving-manager`), while
the wizard has sent `builder`, `handover`, `existing` since 2026-08-26. Every
signed-in Quick Setup failed at the three questions with "invalid input value
for enum association_origin". Migration 0020 adds the current values. That is
also why Monish's "fads" ended up browser-only.

1. **Setup to-do flow.** `/admin/setup` is the list: one task open at a time,
   each with its reason on the row and, when open, either a form to do it
   right there (bank, document, budget line, reserve component, vendor,
   insurance, household) or a link to the screen with `?from=setup`.
   `SetupReturnBar` watches the plan and, when the task the current screen
   exists for completes with `?from=setup` on the address, toasts and sends
   the board back to the list. The dashboard carries one line
   (`SetupPlanSummary`: done count, next step, Continue) that disappears
   when the list is empty, and an honest empty state while nothing runs.
2. **Onboarding origins.** Two doors on the second screen: the builder, or
   the owners, with the owners' two answers (took over from the builder,
   already run it) inside their door. Three values are still stored, since
   the plan and the porting checklist depend on them. The builder is told the
   handover happens from Settings. `LocalCopyBanner` sits on every admin
   screen of a browser-only community saying so, with a way to sign in.
3. **Home sale.** "Record the sale" on every roster row: buyer, email,
   closing date, and if the seller owes anything, whether it was settled at
   closing (a "Paid at closing" payment line) or carries. Demo path in the
   state layer; real path writes the payment and calls `transfer_home`.
   Opening balances are offered only when the association is not a new
   build (origin is neither builder nor handover).
4. **Money, simplified.** One account card on Money (balance, reconciled
   through, feed), connect flow only when there is none, no yield or CD
   rows, no "connect another"; stats read In the bank, Money in, Money out,
   Waiting on you. Reserves is four numbers and the component table; the
   thirty year projection, sliders, chart and year-by-year are out for now
   (`src/lib/reserves.ts` keeps the maths). The dashboard's reserve stat is
   what is set aside, not a second bank.

**Every onboarding combination was driven end to end**: three origins by
three property types, through the wizard, then every item on the resulting
checklist (8 to 11 of them) until "Everything is set up", with the automatic
return checked on the board, amenity, photo and maintenance-matrix steps, and
the dashboard banner gone at the end. The drive is a Playwright script in
the session scratchpad, not in the repo; the e2e suite covers the builder
column of it in `08-complete-setup.spec.ts`.

## The landing page — DONE, on placeholder art

Rebuilt 2026-08-28 from Monish's five slide deck, slide for slide; the record
is `docs/design/landing-page.md`. The placeholder art note below still holds.

Built 2026-08-27. The friend's design is live on `/`: dark navy hero, split
layout, two-line headline with one accent word, illustration bleeding off the
right edge, and his circled palm as the mark. `docs/design/landing-page.md` has
the decisions, the measured colours and the layout notes.

The self-serve CTA into `/start` held, rather than the design's demo request
form. Nav stayed Home, Pricing, Library, About rather than the design's
Features, Solutions, Resources, because those pages do not exist and inventing
nav for them advertises a site we do not have.

**The copy decision reversed on the same day.** The plan was their look with
our new-build positioning. Monish was shown the trade-off and chose the
friend's copy word for word: "Your community. Your oasis." over "HOAsis is the
all-in-one platform that brings clarity, connection, and calm to HOA
management." The cost is that nothing above the fold now says this is for new
communities; the proof band and the showcase below still do. If the page
converts badly, test the headline first. `docs/design/landing-page.md` has it
in full.

**Both assets are placeholders cut from the design screenshot**, which is now
committed at `docs/design/landing-page-reference.png`. Three files are still
owed and each one is a drop-in:

1. **The logo as SVG.** Less urgent than it was. Monish sent a clean render on
   2026-08-27 and `src/components/app/logo.tsx` was redrawn against it by
   fitting the ring in the pixels (centre and radius by least squares, then
   every stroke read off a run-length scan in ring units) rather than by eye.
   It overlays the render closely. An actual SVG would still settle the last
   tenth of a unit. The render is at `docs/design/logo-reference.png`.
2. ~~**The full-resolution hero render.**~~ Landed 2026-09-01: Monish brought a
   matched pair of lakeside renders. `hero-day.jpg` carries the light theme,
   `hero-night.jpg` the dark one, and the `brightness/saturate` filter hack is
   gone. It is a different scene from the ring-road screenshot, on purpose;
   `hero-community.jpg` was deleted with it.
3. ~~**A daylight version of the same scene.**~~ Same delivery; see above.

Remember `rm -rf .next/cache/images` when any of them lands.

## The account comes first, the email comes last

Changed 2026-09-03. The account used to be the last screen of `/start`, after
the roster and the bank. People who had typed eighty homes left rather than
pick a password, and a lead who leaves at the end is nobody. Monish's call: ask
for name, email and password first, verify after the rest is in.

- **Step 1 is "Account"** when nobody is signed in. `signUp` runs on Continue,
  so the row exists in Supabase whether or not they finish. Signed in people
  never see the step, and "Step N of M" counts only what is shown.
- **The confirmation email never blocks a step.** With confirmation pending the
  wizard notes it and carries on. At the end the draft goes to
  `savePendingDraft` and the "Check your email" panel shows; the "Pick up where
  you left off" callout hands it back when they return through the link.
- **"Look around first" still exists**, quiet, on the account step. It ends in
  a browser only copy and the finished screen says so in the heading.
- **An email that already has an account** gets the provider's message and a
  "Sign in instead" link.
- Specs `07-onboarding` and `08-complete-setup` click "Look around first" up
  front rather than at the end, so no test creates a Supabase user.

## Setting up reads the answers it was already given

Fixed 2026-08-27. The second screen of `/start` asks what kind of homes these
are and who is setting the association up. The third screen then ignored both
and gave everybody the builder's vocabulary: take them from the plat, who is
building it, unsold, none sold yet. A board that has run its own townhome
association since 2004 was being asked to name the developer of a community
that finished before they moved in, which reads as the wrong product.

- **`src/lib/wording.ts`** decides whether these are lots, units or homes,
  whether a run of them is a Phase or a Group, and whether a builder exists at
  all. The homes step follows it. Nothing about what gets stored changed.
- **The builder field is not rendered** when the origin is `existing`. That was
  the loudest part of the mismatch.
- **Property type earns its question.** It decides whether a reserve study is a
  statutory duty or good practice, whether the association insures the
  structures, and whether the maintenance matrix and structural tasks exist at
  all. `src/lib/setup-plan.ts` has the rules. The situation screen now says so
  above the choices, and the homes screen carries the vocabulary through.
- **"Plat" is gone from every user-facing string.** It is a real term and it is
  the right word in a title report; it is not the right word on the third
  screen of a signup. Kept in code comments, where precision is free.
- **A range nobody has finished typing is not an error.** `firstPhase` starts
  at 1 with no last number, and `phaseProblems` was reporting the untouched
  first row as backwards before the reader had typed anything.

Still open: an established association that identifies homes by street address
rather than by number has to invent numbers. The model is number ranges
throughout, so this is a real piece of work rather than a copy change.

## Onboarding has its own tab now

Added 2026-08-27, after the plan turned out to be reachable only from the
dashboard, where it dropped to one line the moment anything happened in the
association. A board that had connected a bank account and taken one payment
was two of twelve done and had lost the list.

- **`/admin/setup` is in `ADMIN_ROUTES`**, labelled "Setting up", second after
  the dashboard, with a badge counting what is left. `present` removes it the
  day the plan is complete.
- **Listing it closed a hole.** The page existed before the entry did, and a
  route absent from that table is served to any member who guesses the path,
  so the setup plan and the association profile behind it were readable by
  every resident. It needs `settings` or `finances` now: either, because the
  president configures the association and the treasurer connects the bank,
  and locking either out of the list they are working from is worse than
  showing it to both.
- **The dashboard keeps the full plan through the front half** of the list
  rather than dropping to one line at the first transaction. Past halfway it
  is one line again, and the sidebar carries it the rest of the way.

## Also open, from earlier in the session

- ~~**Balance import.**~~ Done 2026-08-26, as
  `/admin/homeowners/opening-balances`. One figure per home on one date, which
  lands on the statement as "Balance brought forward". It deliberately does not
  set standing or days past due: a typed number says what is owed and nothing
  about how long, and backdating somebody onto the collections ladder from an
  inference is what loses at a hearing.
- **Stripe.** Blocked on a Stripe account and a real domain. Apple Pay needs
  domain verification, which cannot be done on `hoasis.vercel.app`. Use Stripe
  rather than Plaid: Plaid verifies accounts, it does not move money, and
  Stripe covers ACH, card, Apple Pay and Google Pay on its own. Connect with
  one connected account per association is the right shape, and
  `associations.stripe_account_id` already exists for it.
- **Domain.** `hoasis.io` is available and saves renaming 58 files, 8 of which
  are `localStorage` keys whose rename breaks every existing browser's saved
  state. `duesbase.com` is the best genuinely available `.com`. Every English
  word and word-compound tried in `.com` is taken; verified by RDAP, not whois,
  because bulk whois rate-limits and silently returns nothing.
- **Library photography.** Seven group photographs are in and credited. The
  33 per-article briefs remain unillustrated by choice.

---

## Things worth not rediscovering

- `pnpm db:verify` runs against the live Supabase project and cleans up after
  itself, including on failure.
- Playwright does not start a server. Start one first or every test fails with
  `ERR_CONNECTION_REFUSED`.
- `clearState` in `tests/e2e/helpers.ts` installs an init script that runs
  before **every** navigation. Using it in a test that creates something wipes
  what it just created. `tests/e2e/07-onboarding.spec.ts` has a `clearOnce`
  that does it properly.
- An account id only exists inside its own association. Seeding Mehr Meadows'
  President against Test Community One produces no session at all and the app
  falls back to sign in, which makes "the tab is absent" pass for the wrong
  reason. `TC1_SEATS` exists for this.
- Next caches optimised images. After regenerating anything in
  `public/marketing`, `rm -rf .next/cache/images` or the old one keeps serving.
- The persisted slice validator falls through to "an array of records with
  ids". A slice holding a single object needs its own guard in
  `src/lib/core/guards.ts` or it silently falls back to the seed on every read.
- The governing documents were renamed on 2026-08-26. `bylaws.ts` is now
  `governing.ts`, `BylawArticle` is `GoverningArticle`, `bylaw-reader.tsx` is
  `governing-reader.tsx`, and both `/admin/documents/bylaws` and
  `/resident/documents/bylaws` are now `.../governing`. Anything written before
  that date naming the old paths is stale.
- `addGoverningArticles` drops an article whose number the document already
  has, rather than merging. The import screen warns before the click, because
  the alternative is a document with two Article VIIs and a board citing into
  the ambiguity.
