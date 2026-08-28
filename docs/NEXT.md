# What is left

Handoff updated 2026-08-27. Everything not listed here is built, tested and
pushed. Test suite at the time of writing: **440 unit, 122 end to end, 198
database checks**, all green.

Playwright now runs four workers and the suite takes about two minutes rather
than five. `fullyParallel` stays off, because several specs found an
association in one test and read it back in the next.

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

## Asked for on 2026-08-28, queued in this order

1. **Setup to-do flow.** A compact status banner on the dashboard while
   setup is unfinished, linking to `/admin/setup` as its own landing page:
   each step either done in place or a link to the screen, which brings the
   board back to the list when done. Leavable to the dashboard at any time;
   the banner goes when the list is empty. The pieces exist (the plan page,
   `SetupReturnBar`); the shape is what changes.
2. **Onboarding verbiage and the three origins.** Monish's read: a builder
   creating the association and an owner taking over from the builder are
   the same association at two moments, so the handover should be an action
   in the product, not a separate front door. `transfer_presidency` and
   `transfer_home` already exist. Collapse the wizard to two situations and
   put the handover where the roster is.
3. **Home transfer on the Homeowners page.** A "Transfer this home" action
   that seats the buyer and ends the seller's seat, showing any balance and
   asking how it was settled at closing. Show "Opening balances" only when
   the association said it is an established one; for a new build every home
   starts at zero and the screen is noise.
4. **Money, simplified.** One bank account, not several. Dues land in it,
   vendor payments and ACH leave it, and the ledger shows both. Bank
   connection should look like a real Plaid or Stripe link. Remove the
   thirty year reserve projection for now; trends undecided.

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
2. **The full-resolution hero render.** `public/marketing/hero-community.jpg`
   is the screenshot's text-free right side, upscaled. It loses the left half
   of the ring road, which is the part of the composition that reads as a
   neighbourhood rather than as a lake.
3. **A daylight version of the same scene**, at
   `public/marketing/hero-community-day.png`. The light theme currently lifts
   the night render with `brightness-[1.28] saturate-[.82]`. It reads as an
   overcast morning, which works, but it is a stand-in for a real day render
   and swapping it in is a source change, not a layout change.

Remember `rm -rf .next/cache/images` when any of them lands.

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
