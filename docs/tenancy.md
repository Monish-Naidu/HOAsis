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
