# What is left

Handoff written 2026-08-26. Everything not listed here is built, tested and
pushed. Test suite at the time of writing: **321 unit, 101 end to end, 198
database checks**, all green.

Run all three before and after any change:

```bash
pnpm lint && npx tsc --noEmit && pnpm build
npx vitest run
(pnpm start -p 3000 &) ; sleep 9 ; npx playwright test    # needs a server, it does not start one
pnpm db:verify                                            # hits the real Supabase project
```

---

## The five open items, in the order to do them

These came from one list of ten. Five are done: the collections ladder, the
actionable past-due card, roster pagination, the ballot builder, and recording
a vendor payment on a date the board picks.

### 10. Bylaws, CC&Rs, templates, and parsing an uploaded document

**Do this one first.** It is the most valuable, and 4 and 5 depend on it,
because a violation cites the documents this item structures.

What was asked: explain the difference between bylaws and CC&Rs, decide whether
to ship a template, let a board upload their existing documents and parse them,
and give a new owner a way to understand what they are buying into.

Research already in hand, from `docs/research/` and the agent reports:

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

Open question that still needs its own research, and the agent covering it died
mid-run: **whether to auto-detect violations from a parsed document.** The
honest instinct is no. Telling a board "this owner is in violation" on a
machine reading of their CC&Rs invites a false positive that becomes a fine,
a hearing and a lawsuit. The safe version is extract and index for search, so
an owner can find the fence rule, and a board can cite the right section in a
notice. Decide this deliberately before building it.

Already built and reusable: `src/lib/data/bylaws.ts` holds structured articles
with both the governing text and a plain reading;
`src/components/app/bylaw-reader.tsx` renders and searches them;
`src/components/app/amendment-diff.tsx` shows what an amendment changes.

### 4. Violations, and where they come from

Map a violation to the rule it breaks. `Violation.ruleCitation` already carries
strings like `CC&Rs Art. IX §2(b)`, but they are text, not links. Now that
bylaws are structured, make the citation resolve.

Whether residents can report violations is the sensitive half. Research that
did land, from a survey of what other platforms ship:

- Management company and law firm guidance converges on one rule: **a complaint
  is an input to an investigation, never a basis for enforcement.** Evidence
  gets gathered before any notice is issued.
- One source is blunter: a board "can't act on a complaint unless the
  complainant signs it."
- HOALife ships resident reporting and does not market it. Forty-four blog
  posts, none about neighbor complaints, anonymity or selective enforcement.
  Their own enforcement post describes it as manager-driven only. That is a
  positioning vacuum.
- No state statute bans anonymous HOA complaints. Florida's ban binds municipal
  code inspectors, not associations. CAI has published no position.

Recommendation to implement: a resident can report, the report goes to the
board privately, the board must verify independently before any notice, and the
reporter is never named to the accused. Track who reported so a pattern of one
owner repeatedly reporting one neighbor is visible to the board, because that
pattern is a fair housing problem waiting to happen.

### 5. Violation photos

Click through the photos rather than showing a count. Due process says the
accused owner should see the evidence against them, so build it so they can.
The privacy question is real: photographing into a home, over a fence, or by
drone is different from photographing a trash can at the curb.

### 7. Compliance

The question asked was whether the tab earns its place, and what it means for a
brand new association. It currently reads from `complianceItems`, which is a
placeholder register for Washington with chapter-level citations and a note in
the fixture saying not to deepen it without a legal pass. The library now has
that legal pass for twelve states, with citations. Either wire the register to
the library research or cut the tab.

### 8. Communications

Email works and is wired to Resend. Text and in-app do not exist. The research
agent covering TCPA consent and 10DLC registration died before reporting, so
that needs redoing before any SMS is built. What is known already: some notices
must legally go by mail and cannot be satisfied by email or text, and which
ones differ by state.

---

## Also open, from earlier in the session

- **Balance import.** The self-managing porting plan tells a board to set an
  opening balance per home and then points at the roster, where there is no way
  to do it. This is the step that makes a real migration work end to end.
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
