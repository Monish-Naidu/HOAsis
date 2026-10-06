# Tenancy: how communities stay apart

Written 2026-09-25 against the code. Monish asked: "I don't want communities
colliding. We can edit community names, and set them when creating them. How
do we keep communities separate and data separate?"

## Identity, label, address

Three different things, and they must not be confused:

- **The uuid is the identity.** `associations.id`. Every row in every table
  points at it. It never changes.
- **The name is a label.** `associations.name`. Two associations may share
  one (a Maple Ridge in Bothell, WA and a Maple Ridge in Plano, TX are both
  real). Renaming changes nothing but the label.
- **The slug is the address.** `associations.slug`. Made once from the name
  (migration 0047), unique, kept on rename. `/c/maple-ridge` and
  `/c/maple-ridge-2` are two associations; the links in emails and on letters
  never move.

What is unique today, from the constraints and indexes:

| Thing | Unique? | Where |
|---|---|---|
| `associations.id` | yes | primary key |
| `associations.slug` | yes | `associations_slug_key` (0047) |
| `associations.join_code` | yes | `associations_join_code` (0029) |
| `associations.stripe_account_id` | yes | 0001 |
| `associations.name` | **no, on purpose** | indexed for the lookup only (0051) |
| `units (association_id, label)` | yes, within one association | 0001 |
| one President per association | yes | `one_president_per_association` |
| one operating account per association | yes | 0001 |
| `payments.stripe_payment_intent_id` | yes | 0001 |
| `autopay_runs (unit_id, month)` | yes | 0033 |

## Data separation

**Row level security.** Every table has RLS on since 0001 and every policy
scopes through `memberships`: `is_member_of(association_id)` for reads,
`has_capability(association_id, ...)` for board writes, `my_unit_ids()` for
an owner's own home. There is no query that says "all associations". The
service-role function `tables_without_rls()` (0025) asks Postgres which
public tables have it off; the answer is none.

**The proof.** `node scripts/verify-isolation.mjs` founds two associations
through the same RPC the wizard uses, signs in as the President of one, and
tries every table and view that carries an `association_id` (found by
reading the generated types, so a new table with no policy fails the same
day) against the other. Tonight: **84/84 checks passed** (79 before this
work, five added below).

**Service-role paths that bypass RLS**, and how each stays inside one
association:

- *Stripe webhook* (`src/app/api/stripe/webhook/route.ts`): the association
  and unit come from the PaymentIntent's metadata, which our own server
  wrote when it made the intent on that association's connected account.
  `record_payment` derives the association from the unit. See risk 1.
- *Crons* (`assessments/run`, `billing/sweep`, `autopay/run`): walk
  `associations` a page at a time (`src/lib/cron.ts`) and call one RPC per
  association with `p_association_id`. Each row is independent; a failure
  in one is caught and reported per row, and the loop moves on.
- *Email* (`src/lib/email/send.ts`, `notify.ts`): the recipient list comes
  from `email_recipients(p_association_id, ...)`, which filters
  `memberships` by that id. Links carry `/c/<slug>`.
- *Invite* (`api/email/invite`): refuses a caller without the capability in
  that association before it touches the service role; reads members
  filtered by `association_id`.

**Browser storage.** Demo data lives under `hoasis-community` slices keyed
by demo community id; a real association is never in localStorage, only
`hoasis:last-association` (the uuid of the one to reopen). The two worlds
are picked once in `app-state.tsx`: `remote.community` is either the whole
world or none of it.

**Search.** `src/lib/search/records.ts` builds its index from the active
`Community` object in memory. Switching association rebuilds it; nothing is
indexed across associations.

**Stripe.** One connected account per association
(`associations.stripe_account_id`, unique). One customer per home
(`units.stripe_customer_id`), created on that association's account. A card
saved for a home in one association does not exist in another.

**Home in two associations.** Memberships are per association. Somebody
invited under one email to two boards gets two `memberships` rows;
`claim_my_seats` claims every open seat under the verified address, in
whichever association. `my_associations()` lists them; the switcher
switches without signing out.

## Where collisions could happen, ranked

1. **Stripe webhook trusts metadata alone.** *Open, narrow.* A board with
   dashboard access on its own connected account could create a
   PaymentIntent by hand whose metadata names a home in another
   association. On `succeeded`, `record_payment` would post a payment in
   that other association's books. It needs the other home's uuid, and the
   money still lands with the maker, so this is fraud against the books
   rather than a data read. The fix is one check in the webhook: look up
   the unit's association and refuse when its `stripe_account_id` is not
   `event.account`. That file belongs to the payments agent tonight, so
   it is left for them; the trigger in 2 already stops the sloppier
   version (metadata whose unit and association disagree).
2. **A home row across the line.** *Closed tonight (0051).* `memberships`,
   `charges`, `payments`, `requests`, `violations`, `threads`,
   `autopay_runs`, `payment_instruments` and `email_log` carry both
   `unit_id` and `association_id`, and `memberships_write` had no
   with-check, so a President could seat themselves at a home in another
   association; `my_unit_ids()` then opened that home's charges, payments
   and requests to them. Every such table now has a trigger that refuses a
   unit outside its association, for every role including the service
   role. Three checks added to `verify-isolation.mjs`.
3. **Founding a second association landed you in the old one.** *Closed.*
   After the wizard, `loadRemote` chose the remembered association, not the
   new one. `preferRemoteAssociation(id)` now wins for that one load.
4. **Two of your associations with one name.** *Closed.* The switcher, and
   the invite email, show the town when two of a person's associations
   share a name. The join page already showed name and town.
5. **Creating or renaming to a name that exists.** *Closed, softly.* The
   wizard's name step and Settings ask `/api/join/lookup?name=` (rate
   limited, anon, answers name, town and slug only) and show one line:
   "There is already a Maple Ridge in Bothell, WA. If that is yours, join
   it instead." Never blocked: duplicates are legal.
6. **Join codes.** *Closed already.* Unique, six characters from a uuid,
   looked up through a rate-limited route (30 a minute per address).
7. **Slugs on rename.** *Closed already.* The trigger in 0047 sets the slug
   on insert and only rewrites it if somebody clears it. A rename keeps the
   address; a clash takes a numeric suffix.
8. **Demo and real data in one browser.** *Closed already.* Different keys,
   and a signed in person never reads the demo slices. The demo never
   writes to Postgres.
9. **Cron routes and one bad row.** *Closed already.* Per-row try/catch,
   per-association RPCs, bounded pages, idempotent on retry.
10. **Deep links and emails.** *Closed already.* Every emailed link is
    `/c/<slug>/...`; opening it as a member of two switches to the right
    one; a stranger lands on the join page for that slug.

## What to keep true

- Never make `name` unique. Warn, offer join, let them proceed.
- Never rewrite `slug` from a rename.
- A table that carries both `unit_id` and `association_id` gets the
  `unit_in_association` trigger (copy the loop in 0051).
- A new service-role path scopes by `association_id` from the first line,
  and never by a name.
- `node scripts/verify-isolation.mjs` after any migration.

## Files

- `supabase/migrations/0051_tenancy_guards.sql`
- `scripts/verify-isolation.mjs` (checks 4b, 4c)
- `src/lib/community-links.ts` (`normalizeAssociationName`,
  `sameAssociationName`, `placeLabel`), `tests/unit/community-links.test.ts`
- `src/components/app/same-name-note.tsx`, used by
  `src/app/start/setup-wizard.tsx` and `src/app/board/settings/settings-screen.tsx`
- `src/app/api/join/lookup/route.ts` (`?name=`)
- `src/lib/data/remote.ts` (place on the summary),
  `src/lib/data/remote-store.ts` (`preferRemoteAssociation`),
  `src/lib/app-state.tsx` (place and slug on `communities`)
- `src/components/app/community-hero.tsx` (town on twins)
- `src/app/api/email/invite/route.ts`, `src/lib/email/templates.ts`
  (`associationPlace`)

## Since 0051

Migrations 0052 to 0101, one line each, from each file's own header comment. Numbers 0037
to 0039 and 0046 never existed; the sequence skips them.

- 0052 `app_errors` and `cron_runs`: what went wrong and when the crons last ran, read by `/admin`.
- 0053 `association_overview`: the figures a screen needs, summed in the database instead of in the browser.
- 0054 `board_terms`: who held which office and when, written by a trigger on memberships.
- 0055 `association_overview` scoped once, as security definer, instead of once per row.
- 0056 Roster import: many homes at once with their balances, and a date the books start here.
- 0057 `import_households` with the charge kind cast, fixing 0056's first real import.
- 0058 Late fees that actually get charged, from the collection policy, once per dues line.
- 0059 Viewer seats (`views`) alongside `capabilities`, and an append-only `activity` record.
- 0060 Activity wording says what a seat was granted and mentions see-only areas only when there are any.
- 0061 Fixes three settings changes that failed since 0059 (a text[] append read as an array).
- 0062 The money functions answer only to the right callers; late fees read the statement.
- 0063 Activity triggers no longer block deleting an association with a bank account or document.
- 0064 A seat that may view Finances sees the real numbers, and two overview figures agree with the screens.
- 0065 A settings holder can no longer rewrite the columns that say who is paid and whether the association pays.
- 0066 A person cannot change the email on their own profile, which seating matches on.
- 0067 Votes are written only through `cast_votes`, not straight into the table.
- 0068 Insert policies on requests, posts and violation reports require a new row to start at the beginning.
- 0069 One dues run at a time: a lock per association so overlapping runs cannot double-bill.
- 0070 Refunds are booked for the difference, once, and never as a bill for a fee.
- 0071 Cancelling a subscription goes through Stripe when one is on file.
- 0072 `reply_as_board` appends a board reply in the database instead of from a browser's copy of the thread.
- 0073 Deleting and restoring an association keeps the bill honest and stops a card still being charged.
- 0074 A trigger keeps the person who saved a payment method honest.
- 0075 Saved methods leave the home with the owner who saved them.
- 0076 Votes stop on the closing date, with one day of slack for UTC.
- 0077 A new request or post can claim only what its writer is allowed to (thread, date, name).
- 0078 A refund waits for its payment when Stripe delivers events out of order.
- 0079 No late fee until the board sets one; the fallback is zero.
- 0080 Seat a person on a home already on the register, add a second owner, and correct an owner's email.
- 0081 A sale ends every owner's seat on the home, not only the newest.
- 0082 `check` and `cash` added to the payment rails.
- 0083 `record_manual_payment`: a board can put an owner's check or cash on the books.
- 0084 Dues that differ home by home, with one order of precedence (`unit_dues_cents`).
- 0085 Autopay tries a failed month again once the owner has fixed what failed.
- 0086 `add_charge`: a one-off charge billed to a home.
- 0087 No late fee on a balance brought forward.
- 0088 A board can reverse a check or cash payment it recorded by mistake.
- 0089 A buyer does not read what the seller did while they owned the home.
- 0090 `remove_owner` ends one owner's seat on a two-owner home, and a changed sign-in email stays in step on the register.
- 0091 A reversed or refunded payment leaves the dues unpaid and late.
- 0092 A sale cannot be recorded before its closing date.
- 0093 `record_dispute_loss`: a lost card dispute is booked like a refund.
- 0094 `approve_payout` adds an approval under a row lock, so two officers cannot lose one.
- 0095 `reassign_presidency`: support can reassign the presidency when the President cannot be reached.
- 0096 A person who owns two homes in one association votes once for each.
- 0097 A rule notice has a title and its own "what needs fixing" text.
- 0098 A board contact address that emails carry as their reply-to.
- 0099 `retire_home`: a home that is no longer a home is retired and its records kept.
- 0100 A switch for the bill that goes out by email the day it posts.
- 0101 The processing fee is its own line on the ledger.
