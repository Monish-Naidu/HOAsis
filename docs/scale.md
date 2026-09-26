# Scale

Written 2026-09-25 against the code, not the roadmap. Two questions: how
associations are addressed, and what breaks first as they multiply.

## Subdomains?

**No, not as the primary scheme. The canonical address is a path:
`yourhoasis.com/c/<slug>`. `<slug>.yourhoasis.com` works as a vanity alias
that resolves to the same thing.** Built tonight; the reasons, from the code:

- **One person, several associations.** `memberships` is many to many and
  `my_associations()` already returns a list; the switcher in the header
  exists because of it. A subdomain per association makes every one of those
  a separate site with a separate session, and a treasurer who sits on two
  boards signs in twice.
- **Cookies are per host.** `@supabase/ssr` writes the session cookie for
  the host that set it. `oakview-commons.yourhoasis.com` does not see a
  session made on `yourhoasis.com` unless the cookie domain is set to
  `.yourhoasis.com`, and then every association's host can read every
  session, which is fine only because row level security is what actually
  scopes data. Subdomains do not add isolation; RLS already provides it
  (`scripts/verify-isolation.mjs`).
- **Links in email.** Every link the app sends comes from `siteOrigin()` on
  the request. Under subdomains, a magic link's `redirectTo` has to name the
  right host or the session lands on the wrong one. Under the path scheme
  it is `/c/<slug>/resident/pay` on the one host, and works whoever opens it.
- **Neighbours forward links.** A path link to a board page a stranger opens
  goes to sign-in with the link kept, then to the join page with the
  association named. The same on a subdomain needs the cookie domain set
  first, or the person signs in and lands on an empty site.
- **Infrastructure.** Subdomains need a wildcard domain on Vercel, a
  wildcard CNAME on Cloudflare (with proxying off, or Vercel's certificate
  does not issue), and the cookie domain env in two places. The path scheme
  needs nothing. Vanity hosts are worth having for the board that wants to
  print `oakview-commons.yourhoasis.com` on a letter, which is why the alias
  is there, but nothing depends on them.
- **SEO** is irrelevant; everything is behind sign-in.
- **The market.** PayHOA, Buildium, AppFolio and HOALife all sign in at one
  host and switch between portfolios inside; Slack and Shopify use a
  subdomain per tenant because their tenants are the product boundary. An
  HOA officer with two boards is a real case here, not an edge.

What was built: `associations.slug` (migration 0047, from the name, unique,
stable on rename), `/c/<slug>` and `/c/<slug>/<page>` as the entry point
(`src/app/c/[slug]/[[...rest]]`, `src/components/app/community-entry.tsx`),
the vanity host in the proxy (`src/proxy.ts`, root rewritten to the path, the
client reads the host for any deeper page), and slug links in the invite,
trial and autopay emails. Every existing route is unchanged. The
`community-links.ts` helpers are the only place the scheme is spelled out.

## What breaks first

Ranked by the size at which it breaks, not by how hard it is.

1. **Cron time limits (a few hundred associations).** All three crons read
   every live row and walked the lot in one call. Vercel Hobby stops a
   function at 60 seconds; autopay with Stripe in the loop is a second or
   two per home. Rows past the cut-off were never visited and the response
   did not say so. **Fixed:** `src/lib/cron.ts` walks in id order a page at
   a time with a 40 second budget; a run that runs out answers with
   `complete: false, next: <id>` and schedules itself with `?after=<id>`
   through `after()`. Each route was already idempotent per row.
2. **Missing indexes (a few hundred associations sharing the tables).**
   `units`, `payments`, `documents`, `meetings`, `ballots`, `threads`,
   `payouts`, `violations` and a dozen more had no index on
   `association_id`; `memberships` had none on `profile_id`, which every
   RLS policy hits through `has_capability` and `my_unit_ids` on every row.
   Fine when a scan of the table is the whole table; not at ten years of
   ledger. **Fixed:** migration 0048, forty indexes matching the filters and
   sort orders in `remote.ts` and the crons.
3. **Whole-association load (500 homes, 10 years).** `loadCommunity` in
   `src/lib/data/remote.ts` fires 36 queries at once and reads every row of
   `charges`, `ledger_entries`, `payouts`, `threads` and `post_replies` in
   1000-row pages until they run out (`everyRow`, added after the 1000-row
   truncation bug). 500 homes billed monthly for ten years is 60,000
   charges and about as many ledger lines, per page load, per person, and
   the whole thing is re-read after every write (`refreshRemote`). Around
   two to three years at 500 homes the first paint passes ten seconds and
   the JSON passes 20 MB. **Not fixed; this is the next real piece of work.**
   The shape of the fix: keep `Community` as the seam, but let the ledger,
   charges and email log come in by window (last 12 months by default, the
   rest on demand from the Transactions and Collections screens), let
   `unit_balances` and `association_funds` do the sums in Postgres as they
   already do for owners, and refresh only the slice a write touched.
   `email_log` is already capped at 300.
4. **Public routes with no limit.** Sign-up and the join code lookup were
   open to any script. **Fixed:** `src/lib/rate-limit.ts`, per address,
   in memory per instance: 10 sign-ups an hour, 30 join lookups a minute
   (`/api/join/lookup`, which the form now calls instead of the RPC). Sign-in
   goes straight to Supabase auth, which has its own limits. Move the counts
   to Postgres when there is more than one instance to worry about.
5. **Supabase free tier.** The project pauses after a week without traffic
   and then looks deleted (memory note; restored 2026-09-19 through the
   management API). The daily crons keep it awake now, which is a side
   effect to know about rather than a plan. The Pro tier is the fix, and it
   also lifts the pooler from 60 to 200 direct connections.
6. **Connections.** Every browser query goes through Supabase's REST layer
   (PostgREST), which pools; the crons and webhooks use the service role
   client, one connection per call, closed with the function. Not a problem
   until many functions run at once, which the cron batching makes less
   likely, not more.
7. **RLS cost.** `has_capability` and `my_unit_ids` are `security definer`
   functions called per row. With the new `memberships (profile_id)` index
   each call is an index probe. If it ever shows in `pg_stat_statements`,
   mark them `stable` (already) and wrap the policy in
   `(select has_capability(...))` so Postgres evaluates it once per query.
8. **Stripe webhook idempotency.** Already done: `record_payment` is keyed
   on the PaymentIntent, and autopay claims the month before calling Stripe.

## What Monish has to click

The path form works today with no settings changed. The vanity host needs:

1. **Vercel:** Project → Settings → Domains → add `*.yourhoasis.com`.
   Vercel will show a CNAME target.
2. **Cloudflare:** DNS → add `CNAME  *  cname.vercel-dns.com` (or the target
   Vercel showed), **proxy status off (grey cloud)** so Vercel can issue the
   wildcard certificate. Keep the existing apex and `www` records.
3. **Vercel env:** `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yourhoasis.com` on
   Production only. Without it a vanity host is its own sign-in; with it one
   session covers every host. Do not set it for Preview or locally.
   Setting it signs every browser out once, because the cookie moves.
4. **Local testing:** `oakview-commons.localhost:3000` works in Chrome and
   Safari without a hosts entry. Sessions stay per host locally.

To confirm: open `yourhoasis.com/c/oakview-commons` signed out, sign in,
land on Oakview; open `oakview-commons.yourhoasis.com` and see the same.

## Files

- `supabase/migrations/0047_association_slugs.sql`, `0048_scale_indexes.sql`
  (both applied to production 2026-09-25, types regenerated)
- `src/lib/community-links.ts`, `src/lib/cron.ts`, `src/lib/rate-limit.ts`
- `src/proxy.ts`, `src/lib/supabase/client.ts` (cookie domain)
- `src/app/c/[slug]/[[...rest]]/page.tsx`, `src/components/app/community-entry.tsx`
- `src/lib/data/remote.ts`, `src/lib/data/remote-store.ts` (slug on the
  summary, host and link choose the active association)
- `src/app/api/join/lookup/route.ts`, `src/app/api/auth/signup/route.ts`
- `src/app/api/assessments/run`, `billing/sweep`, `autopay/run`
- `src/app/api/email/invite/route.ts`, `src/app/join/join-panel.tsx`
- Tests: `tests/unit/community-links.test.ts`, `rate-limit.test.ts`,
  `cron-batch.test.ts`
