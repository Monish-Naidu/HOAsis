# The ninety days, and what comes after

Built 2026-09-04. The front page had promised "90 days free, no card to
start" since August and nothing tracked it: every association sat at
`subscription_status = 'active'` forever. This is the flow that makes the
promise true and then charges.

## The shape

One clock, one column. `associations.trial_ends_at` is set to founding plus
ninety days by default (migration 0025) and can be edited by hand for a board
that asked for longer. Everything else is derived from that date and from
`subscription_status`, by `src/lib/billing.ts`, which is pure arithmetic:

| Phase        | When                                              | Board sees                                |
| ------------ | ------------------------------------------------- | ----------------------------------------- |
| `trialing`   | Before `trial_ends_at`, no subscription           | One quiet line: free until, days left     |
| closing      | Last 14 days of that                              | Amber callout with "Add a card"           |
| `ended`      | After the date, no subscription, first 14 days    | Red callout; everything still works       |
| locked       | 14 days past the date, still nothing on file      | Billing wall on every board page but Settings |
| `active`     | Stripe subscription exists                        | Nothing. Settings shows the card          |
| `past_due`   | Stripe said an invoice failed                     | Red callout, "Update the card"            |
| `canceled`   | Board cancelled on Settings                       | Nothing; Settings says so                 |

The resident side is never touched by any of this. An owner's statement is
theirs whatever the board has or has not paid, and a board that comes back
after a lapse finds nothing missing.

The demo association (Willow Creek Estates) has no `trialEndsOn` and never sees a
banner. Only real associations do.

## Charging

Two Stripe things that must not be confused:

- **The connected account** (`stripe_account_id`, from 2026-09-02) is how
  residents pay the association. Dues settle there, never to us.
- **The platform subscription** (`billing_customer_id`,
  `billing_subscription_id`, migration 0025) is how the association pays us.
  Per home per month at `PRICE_PER_HOME_CENTS`, quantity = every unit, sold
  or not.

"Add a card" on Settings posts to `/api/billing/checkout`, which opens a
hosted Stripe Checkout for a monthly subscription. The remaining free days
ride along as a Stripe `trial_end`, so a card added on day 20 is first
charged on day 91. Stripe refuses a trial under two days, so with less than
that left the subscription simply starts. Nobody types a card into our page.

`/api/billing/webhook` is the only writer of the subscription columns. It is
a **separate endpoint with its own secret** (`STRIPE_BILLING_WEBHOOK_SECRET`)
because `/api/stripe/webhook` is a Connect endpoint listening on every
association's account, and this one listens on ours. Register it as a plain
account endpoint for `checkout.session.completed`,
`customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`.

"Manage billing" opens Stripe's billing portal (`/api/billing/portal`):
change the card, see invoices, cancel. We rebuild none of that.

## The daily sweep

`vercel.json` runs `/api/billing/sweep` once a day at 14:00 UTC. Vercel
sends `Authorization: Bearer $CRON_SECRET`; nothing else gets in. For every
live association without a subscription it:

1. sends the one trial notice due today (14 days out, 3 days out, or the
   day itself) to the sitting President, logged to `email_log` under
   `billing`, and records the key in `billing_notices` so it never repeats;
2. moves a trial past its date from `trialing` to `ended`.

A sweep that missed a week sends one email, not three. The lock after the
grace period is not a state the sweep sets; the banner and the gate read the
date, so the row and the screen cannot disagree.

`?dry=1` builds and logs everything and sends nothing.

## What has to exist for money to move

None of these are in `.env.local` yet (2026-09-04):

| Variable                        | Where                               |
| ------------------------------- | ----------------------------------- |
| `STRIPE_SECRET_KEY`             | Both webhooks, checkout, portal     |
| `STRIPE_BILLING_WEBHOOK_SECRET` | The billing endpoint above          |
| `CRON_SECRET`                   | Vercel sets and sends it; also put it in env so the route can compare |

Until then: "Add a card" toasts "Could not reach Stripe", the sweep still
moves trials to `ended` and logs the notice attempt with an error, and the
banner counts down correctly regardless.

## Tests

- `tests/unit/billing.test.ts`: phases, grace, notices, checkout trial end.
- `tests/unit/billing-webhook.test.ts`: signed events, status folding,
  cancel clears the card, failed invoice marks past due once.
- `scripts/verify-isolation.mjs` (in `db:verify`): unrelated to billing but
  landed the same day; see below.

## Isolation between associations

Asked the same day: "set up Kong or some way so each community's data
doesn't get cross contaminated". Supabase already fronts Postgres with Kong;
the wall is row level security, which every table has had since 0001. What
was missing was proof that holds for tables nobody thought to check.

`scripts/verify-isolation.mjs` reads the generated types, finds every table
and view carrying `association_id`, founds two associations through the
wizard's own RPC, and as the President of one tries to read each of those
scoped to the other (zero rows or refused), rename it, add a home, post an
announcement, bill it, seize its presidency, and list its document files.
It also asks the database for `tables_without_rls()` (service role only,
migration 0025) and expects none. 71 checks, all green on 2026-09-04.

`pnpm db:seed` wipes the project and seeds two associations for exactly this
reason: one association has no wall to prove.
