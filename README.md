# Your HOAsis

Community management for self-managed HOAs, live at yourhoasis.com. Signed-in people run on
Supabase (Postgres with row level security), Stripe and Resend. Signed out, the same screens
run a demo on fixture data, which is what the sample on the sign-in page opens.

Two experiences share one system of record:

- **`/resident`** is the homeowner portal. It runs two ways from the same screens: a normal
  responsive website with a sidebar (how most owners will sign in) and an app preview inside a
  device frame, switched from the top bar. Below `lg` the two are identical. Rendered inside a device frame on desktop
  because it's designed at phone width and is meant to become the native app.
- **`/board`** is the board workspace: finances, collections, reserves, homeowners, vendors,
  requests, voting and meetings. (`/admin` is the operator's page: errors and cron runs
  across every association.)
- **`/`**, `/pricing`, `/about`, and `/library` are the public marketing site. No account
  needed, and the library is deliberately free with no email gate.
- **`/start`** is onboarding. Four steps produce a real association: name and location, what
  each home pays, the roster, and who else sits on the board. It creates a working community
  with no ledger, no vendors, no documents, and no history, which is what a board's first day
  actually looks like.
- **`/join`** is how a person gets into an existing association. With a join code, typed or on
  a link, they create their account inside the community and the board confirms their home
  under Homeowners; until then the resident side says "Waiting on the board of X". With an
  invitation link (`?invite=CODE&email=`) the board already put the household on the register,
  and signing up with that email claims the seat when the address is confirmed. The demo's
  `?c=&o=&k=` link signs a fixture household straight in.
- **`/signin`** is sign in and create account, through Supabase Auth. The sample on the same
  page picks one of the seeded demo accounts so you can see the product from that person's
  chair without an account.

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest, unit and integration
pnpm build      # production build
pnpm check      # lint, typecheck, test, build. Run this before pushing.
pnpm e2e        # Playwright, against a server already running (E2E_BASE to point elsewhere)
pnpm db:verify  # every database check, against the Supabase project in .env.local
```

`pnpm check` also runs on every push (`.github/workflows/ci.yml`). `.env.example` lists the
keys; with none set the app builds and serves the demo only.

## Two modes, one set of screens

- **Signed in.** Data lives in Postgres. Every table is scoped to an association by row level
  security, and money moves through database functions the browser cannot call on its own
  say-so (`docs/tenancy.md`, `supabase/migrations`). Payments are Stripe direct charges into
  the association's own account; email goes through Resend. `src/lib/data/remote.ts` loads an
  association and `src/lib/app-state.tsx` writes to it.
- **Signed out (the demo).** Domain data is TypeScript fixtures, and anything the demo lets
  you change is written to `localStorage` through the store layer below. It reaches the
  resident side in the same browser and nobody else.

Capability checks in the UI hide and lock screens. For a signed-in person the database
enforces the same rules again; the UI is not the guard.

## What the product is arguing

Positioning comes from `docs/research/payhoa-competitive-teardown.md`. Three claims drive
the design:

1. **Books that tie out.** Reconciliation status is a first-class, always-visible concept.
   Transactions that need a human decision are held *out* of every report until confirmed,
   and the dashboard says so instead of quietly averaging them in. Nothing is auto-categorized:
   suggestions carry a confidence score and require a click.
2. **An app residents use.** Pay, look something up, file a request. Payment methods quote
   their real processing cost before you commit, and every payment shows which charges it
   paid off, oldest first.
3. **Voting people finish.** Ballots carry paragraphs, not one unformatted block. Tallies,
   quorum, and threshold are visible without opening each ballot. Owners get a receipt code;
   the secretary gets a tally that reconciles to the receipts. Meetings carry a call and a
   dial-in, so a vote can happen while everyone is on the line.
4. **Reserves that earn.** Balance, blended yield, interest earned, deposit insurance
   exposure, and what moving the balance to a better rate would be worth.
5. **Compliance as a feature.** Obligations are dated, cited, assigned, and carry the
   evidence a board would need to produce if challenged: reserve study cadence, budget
   ratification, records requests, corporate good standing.

## Roles

Every account is a resident first. `president`, `vice-president`, `treasurer`, and `secretary`
wrap that with a set of capabilities, so an admin can switch to the resident view from the
header without signing out, and sees their own unit and balance when they do.

The President holds `permissions`, the one capability that cannot be granted away, and their
own row in the capability matrix is locked. An association that can strip its President of
access has no way back in.

A seat has two lists: what it may change and what it may only see. The UI asks both, and for
a signed-in person Postgres asks again on every read and write.

## Admin owned settings

`/board/settings` writes to the shared app state, so a change there shows up on the resident
side immediately. It owns the community name and photo, whether the resident home shows a
calendar or a single hand written banner, whether residents can see association funds, whether
ballot tallies are visible before a ballot closes, the last day of the month autopay can be
scheduled before an assessment is late, the amenity list that feeds the resident request
dropdown, and the architectural forms that feed the other one.

## Core layer

`src/lib/core` holds the parts that have nothing to do with HOAs:

- **`errors.ts`** is an abstract `HoasisError` with a stable `code` per subclass, so a
  boundary can tell deliberate failures from bugs with one `instanceof` and never has to
  match on a message.
- **`circuit-breaker.ts`** is a closed / open / half-open breaker with an injectable clock.
  It guards `localStorage`, which genuinely fails in private mode, on a full quota, and when
  a browser blocks site data. It is also what an HTTP client should use once there is an API.
- **`store.ts`** is an abstract `Store<T>` with two subclasses, `MemoryStore` and
  `PersistedStore`. They differ in exactly one axis, how a value loads and saves, and agree
  on subscription, snapshot caching, and notification. That is what makes inheritance the
  right tool here rather than composition.
- **`guards.ts`** holds runtime type guards. Stored JSON was written by an older build and
  is not trustworthy.

Corrupt stored data falls back to the seed and does **not** trip the circuit, because that
is a data fault rather than a storage fault. Repeated write failures do trip it, and every
store then behaves like a `MemoryStore` until the cooldown elapses.

## Tests

Four layers, each with its own command:

- **Unit** (`tests/unit`, 98 files, 1,298 tests): pure logic. The breaker and the stores
  including their failure paths, money and date formatting, the calendar grid, every derived
  financial figure, the email templates, the data mapping in `remote.ts`, and the checks the
  forms share.
- **Integration** (`tests/integration`, 10 files, 290 tests): screens rendered against a fake
  server. Sign in, view switching, the capability matrix including the President being
  unstrippable, admin settings reaching the resident side, and the error boundary containing a
  failure to its own region. `pnpm test` runs these two layers.
- **Browser** (`tests/e2e`, 13 specs, about 115 tests): Playwright against the signed-out demo,
  with `pnpm e2e` pointed at a server that is already running. CI runs it on every push.
- **Database** (`scripts/verify-*.mjs`, 23 suites): run against the real Supabase project
  in `.env.local` with `pnpm db:verify`. They prove row level security, the money functions,
  onboarding, joining, email and the rest, and every migration is expected to come with one.

`pnpm coverage` reports line coverage for `src/lib` (about 78% when it was added, with no
threshold). The stores are module singletons, which is right for the app and hostile to tests,
so `tests/setup.ts` calls `resetAllStores()` between tests.

## Architecture

The directories under `src/` (two levels deep):

```
src
src/app
src/app/about
src/app/admin
src/app/api
src/app/auth
src/app/board
src/app/c
src/app/demo
src/app/dev
src/app/join
src/app/library
src/app/pricing
src/app/privacy
src/app/resident
src/app/signin
src/app/start
src/app/terms
src/app/unsubscribe
src/components
src/components/app
src/components/ui
src/lib
src/lib/core
src/lib/data
src/lib/email
src/lib/meetings
src/lib/payments
src/lib/roster
src/lib/search
src/lib/stripe
src/lib/supabase
```

`CLAUDE.md` has a "Where things go" table that says what belongs in each of them and the
rule for it. A few files carry the weight: `src/lib/types.ts` is the domain model,
`src/lib/data/index.ts` is what screens import, `src/lib/app-state.tsx` is every mutation,
`src/lib/utils.ts` is money, date and `cn`, and `src/components/ui/primitives.tsx` is the
shared UI.

**The repository layer is the seam.** Screens never touch a fixture file directly; they call
selectors in `src/lib/data/index.ts`, and the same screens read a real association loaded by
`src/lib/data/remote.ts`.

**Derived numbers are computed, never stored.** Collection rate, percent funded, budget pace,
payout speed, and compliance score all derive from the underlying records, so the figure on
the dashboard cannot drift from the figure on the detail page.

**Money is integer cents. Dates are `YYYY-MM-DD` strings.** The clock is pinned rather than
read from the wall, so relative dates ("in 5 days") read identically on every machine, and it is
pinned **per association**: each community carries an `asOf`, and `setToday` follows the active
one. Reading a community whose books sit in 2027 against a 2026 clock renders an overdue item as
"in 133 days".

## Design system

Navy carries brand and hierarchy; warm neutrals carry surfaces and text. Tokens live in two
places that must stay in sync:

- `src/app/globals.css` holds CSS custom properties, mapped into Tailwind v4 via `@theme inline`.
  Semantic names (`--bg`, `--surface`, `--fg`, `--brand`) are redefined under `.dark`, so
  components use `bg-surface` / `text-fg` and never a raw ramp value.
- `src/lib/tokens.ts` holds the same palette as plain TypeScript, for the React Native app.

Theme has three states (light / dark / system), toggled via `ThemeToggle` and applied
pre-paint by an inline script so there's no flash on reload.

## Associations

Which associations exist depends on who is looking. Signed in, a person belongs to the
associations their account was seated in, and what they see is that association's rows from
Postgres; nothing else is reachable. Signed out, the demo has three, and the switcher in the
board header moves between them. Switching signs you out on purpose: an account belongs to
one association, so carrying a session across would leave the President of one holding
capabilities in another.

Demo associations:

- **Mehr Meadows**, 88 units, the rich demo described below.
- **Test Community #1**, five homes, quarterly meetings, no amenities, no reserve study. It
  exists to keep the product honest about small associations, and building it is what exposed
  most of the empty-state bugs.
- **Anything built through `/start`**, which persists separately from the fixtures in
  `created-communities.ts`. Keeping invented data and real data apart is what makes "reset the
  demo" safe to offer.

## Fixture data

A fictional 88-unit Washington HOA (Mehr Meadows, Brier). Fourteen households are hand-written
because the prototype tells stories about them; the remaining 76 are generated
deterministically so roster-wide rates are honest.

**The compliance register is parked.** Mehr Meadows was recorded in 2015, so RCW 64.38 governs
rather than WUCIOA (RCW 64.90), which covers communities created on or after July 1, 2018. The
entries there are chapter level placeholders: the chapter is right, the deadline math is not
verified, and the screen says so. Do not deepen them without a legal pass.

## Not built yet

The native app, a bank feed, and a video call of our own.

Video meetings are real but borrowed. `src/lib/meetings/video.ts` derives one room name per
meeting that everyone computes the same way, and `src/lib/meetings/jitsi.ts` loads Jitsi
Meet's public IFrame API from `meet.jit.si`, so there is no account, key or cost, and the
call itself is theirs. What is not built is a call of our own. Swapping to Daily, LiveKit or Twilio later means
replacing those two files.

**On a board app.** Worth doing, but not as a shrunken version of this workspace. The board
work that is genuinely phone-shaped is approvals, votes, a balance check, and answering an
owner. Reconciliation, budgets, and reports stay on a desktop. The board screens here are
responsive down to phone width for that reason, but the native board app should ship as that
short list, not the whole sidebar.
