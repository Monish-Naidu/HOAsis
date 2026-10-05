# Paying dues, end to end

Built 2026-09-02 (Stripe Connect, the pay panel, saved methods), finished
2026-09-23 (autopay that runs, banks that verify, methods that detach), and
proven 2026-09-25 (a card payment driven through the product end to end
with the webhook settling the books). This is the flow as it stands.

## The shape

Every association is a Stripe **connected account**, created with Accounts
v2 (Stripe refuses v1 for platforms onboarded from 2026) carrying a merchant
configuration with card and ACH debit capabilities, `fees_collector` and
`losses_collector` both `stripe`, and the full dashboard: Stripe bills the
HOA its own processing fees, carries the payment losses, collects the
onboarding requirements, and gives the treasurer the full dashboard. The id
is still `acct_…`, so every v1 call made on its behalf is unchanged. Dues settle
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

## Keys and endpoints (done 2026-09-23)

The Stripe account is the "YourHOAsis sandbox" in test mode. Both keys are
in `.env.local` and in Vercel (Production and Preview), `pnpm stripe:setup`
registered both webhook endpoints against yourhoasis.com and wrote their
secrets plus a `CRON_SECRET`. Going live is a live key pair, the script run
again with the live key, and the five values replaced in Vercel.

Locally, `stripe login` once, then
`stripe listen --forward-connect-to localhost:3000/api/stripe/webhook`
prints a secret for `.env.local`. Test-mode Connect onboarding has a
"skip this form" shortcut; test bank `000123456789` with routing
`110000000` verifies instantly, and micro-deposit amounts are `32` and `45`.

## Live associations (test mode)

Oakview Commons and Mehr Meadows both have finished Connect onboarding
(Mehr Meadows on 2026-09-26, Stripe login monishnaidu18+mehrmeadows@gmail.com,
payouts manual to STRIPE TEST BANK ••6789). Both took a real test card
payment through the product with the webhook settling the books.

## Proven 2026-09-25

Driven through the product on Oakview Commons in test mode, with the CLI
forwarding events: a $250 card payment settled with the real processor fee
in `payments`, a statement line, and a ledger entry on the operating
account; a card saved for later; a payment with the saved card; autopay
switched on. `tests/e2e/13-payments.spec.ts` repeats this, gated on
`STRIPE_E2E=1`. Financial Connections (signing in to a bank) opens Stripe's
own modal, which does not run under automation, so that path stays a hand
click; the manual routing-number path was proven on 2026-09-23.

Added the same night:

- **Stripe's own facts, cached.** `associations.stripe_charges_enabled`,
  `stripe_payout_bank`, `stripe_payout_last4` (migration 0049), written by
  `syncAccountStatus` in `src/lib/stripe/account-status.ts` from the connect
  route, the `account.updated` webhook, and `/api/stripe/status` (any
  member; the pay screen asks it once when the column says "not yet"). The
  pay screen renders the Stripe panel only when charges are enabled; an
  account that exists but is unfinished shows "your board hasn't finished
  payment setup". The payout bank fills the operating row in
  `bank_accounts` when the board never typed one, and Settings says
  "Dues are paid out to STRIPE TEST BANK ••6789".
- **Refunds.** `charge.refunded` calls `record_refund` (0049, rewritten in
  0070): the owner's statement gets back what came back as a charge, and
  the ledger loses the same amount. The payment flips to refunded only once
  the whole of it has been returned; a partial refund leaves it settled.
  Idempotent on the intent and the running total; refused to any
  signed-in caller. `verify-stripe.mjs` covers it (12 checks).
- **The webhook checks the account.** A `payment_intent.*` event only
  touches a unit whose association owns `event.account`.
- **The form looks like the product.** `src/lib/stripe/appearance.ts`
  reads the theme and tokens at mount; the element shows one rail with
  Link's wallet off, so a dues payment is not an accordion of Klarna.
- **Wallets.** `public/.well-known/apple-developer-merchantid-domain-association`
  is served; `pnpm stripe:setup` registers the domain on every connected
  account and the connect route does it for a new one. Validation only
  passes once the domain is deployed.
- **Local webhooks.** `STRIPE_WEBHOOK_SECRET_LOCAL` holds the secret
  `stripe listen` prints; the route accepts either secret.

**Late fees (2026-09-26).** `assess_late_fees` (migration 0058) posts one
`late_fee` charge per unpaid dues line once it is past the board's
`lateNoticeDay` (settings.collectionPolicy, default 30 days, $25), labelled
"Late fee, <period>" so it can never post twice. The daily dues run calls it
for every association before billing. `scripts/verify-late-fees.mjs` (8
checks) is in `db:verify`. A policy with a zero fee posts nothing.

**Disputes (2026-09-26).** `charge.dispute.created` and `.closed` are
registered on the Connect endpoint and land in `app_errors` (so /admin
shows them) with the amount, reason, association and unit. The payment row
keeps its state: contested money is not failed money. Telling the treasurer
by email is the next step.
