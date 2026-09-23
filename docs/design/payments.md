# Paying dues, end to end

Built 2026-09-02 (Stripe Connect, the pay panel, saved methods) and finished
2026-09-23 (autopay that runs, banks that verify, methods that detach). This
is the flow as it stands, and what still waits on keys.

## The shape

Every association is a Stripe **connected account** with the "Stripe handles
pricing" controller: Stripe bills the HOA its own processing fees, carries
the payment losses, and gives the treasurer the full dashboard. Dues settle
to the association's own bank account, never to us; our margin is the
`application_fee_amount` on each intent, derived from the same
`computePaymentCost` the pay screen shows.

Every home is a Stripe **Customer** on that connected account
(`units.stripe_customer_id`, migration 0023). Saved methods live there, and
the payment-method id rides in `payment_instruments.detail.token`.

The **webhook** (`/api/stripe/webhook`, a Connect endpoint) is the only
writer of settled money. `record_payment` (migration 0022) is idempotent on
the intent id, settles a pending row in place, and treats settled as
terminal. Nothing in the browser can record a real payment.

## Paying by hand

`/resident/pay` in remote mode renders `StripePayPanel`. Saved methods list
first with their default badge and a small menu (make default, remove), then
"New bank account" and "New card". The client names an amount and a method;
`/api/stripe/payment-intent` prices it and returns the intent, and the client
confirms exactly that intent. A card settles while they watch (the panel
polls for the webhook's row); ACH shows a pending receipt for the four days
it takes.

Removing a method goes through `DELETE /api/stripe/instruments`, which
detaches the method from the Customer before deleting the row. A detached
method cannot come back, so there is no undo in remote mode; the demo keeps
its undo because nothing there is real.

## Adding a bank account

The Payment Element on a SetupIntent, with Financial Connections asking for
the `payment_method` permission only (the free one). Two outcomes:

- **Instant.** The owner signs in to their bank, the SetupIntent succeeds,
  `/api/stripe/instruments` writes the row. Chargeable at once.
- **Micro-deposits.** The bank is not in Financial Connections, or the owner
  typed a routing number. The SetupIntent sits in `requires_action` with a
  hosted verification page. The row is written anyway, marked
  `detail.status = "verifying"` with the `verifyUrl`, so the account is
  still there when the owner comes back in two days. The panel shows it
  disabled with a **Verify** link; `/api/stripe/payment-intent` refuses to
  charge it; autopay skips past it. `setup_intent.succeeded` clears the mark,
  `setup_intent.setup_failed` deletes the row.

## Autopay

The plan lives on the membership (`memberships.autopay`, migration 0029):
day of month, optional cap, optional skipped month, the instrument, and
`startMonth`, set when it is switched on so a plan made on the 20th does not
take the balance the next morning when the screen promised next month.

`/api/autopay/run` is a daily Vercel cron (14:30 UTC, after the billing
sweep). For every current membership with a plan it calls `decideAutopay`
(`src/lib/payments/autopay.ts`, pure, tested):

| Today is                                  | Does                                   |
| ----------------------------------------- | -------------------------------------- |
| before the chosen day, or before `startMonth` | nothing, no row                    |
| the skipped month                         | one `skipped` row                      |
| nothing due                               | nothing, no row, tries again tomorrow  |
| balance within the cap, or no cap         | charges the balance                    |
| balance above the cap                     | charges regular dues only              |

A charge is one `autopay_runs` row (migration 0033, unique on unit and
month), claimed **before** Stripe is called so a second run of the same day
finds it and stops. Then an off-session, confirmed PaymentIntent on the
connected account with the saved method, carrying the same metadata as a
manual payment so the webhook and `record_payment` cannot tell them apart.
A decline is one `failed` row and one email; autopay tries again next
month, and the balance is theirs to pay by hand meanwhile. Receipts and
declines both go out through `sendAutopayNotice` and land in `email_log`.

Add `?dry=1` to see what a run would do.

## What still waits on Monish

Three values from the Stripe dashboard and one script:

1. `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test keys)
   into `.env.local`.
2. `pnpm stripe:setup` creates both webhook endpoints against
   yourhoasis.com and writes their secrets plus a `CRON_SECRET`.
3. The same five values into Vercel, then redeploy.

Locally, `stripe login` once, then
`stripe listen --forward-connect-to localhost:3000/api/stripe/webhook`
prints a secret for `.env.local`. Test-mode Connect onboarding has a
"skip this form" shortcut; test bank `000123456789` with routing
`110000000` verifies instantly, and micro-deposit amounts are `32` and `45`.

Not built: Apple Pay and Google Pay domain registration on each connected
account (`applePayDomains.create`, one call per account, once the domain is
live on Stripe), refunds flowing back from the dashboard into the books
(`charge.refunded` is acknowledged and ignored), and the `STRIPE_E2E`
Playwright spec, which is pointless until a key exists.
