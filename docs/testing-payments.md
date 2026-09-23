# Testing payments (test mode)

Stripe is in test mode, so everything below behaves exactly like real money
without moving any. Two people are needed, or one person switching between
the Board and Resident views at the top of the screen.

Both screens that matter (board Settings and the resident Pay page) show a
yellow "Test mode" box with these same numbers while the test key is
deployed. It disappears by itself when live keys go in.

## 1. The board connects the HOA to Stripe (once per community)

1. Sign in as a board member with the finances role and open **Settings**.
2. Under **Payments**, press **Set up payments**. Stripe's onboarding form opens.
3. Fill Stripe's form with test values: any business name, EIN `00-0000000`,
   phone `000 000 0000` (code `000000`), date of birth `01/01/1901`, SSN
   last four `0000`, address line `address_full_match`. Bank `110000000` /
   `000123456789`. Press **Agree and submit**.
4. The row reads **Payments are live** once Stripe switches the account on,
   usually within a minute. Reload if it still says **Resume setup**.

## 2. A homeowner pays

1. Switch to **Resident** at the top, open **Payments**.
2. Pick **New bank account** or **New card**, press **Continue to pay**. The
   exact fee is itemised on the next step before anything is charged.
3. Stripe's form collects the details. For a bank, choose **Enter bank details
   manually** and use a pair from the table. Press **Pay**.
4. A card settles while you watch and shows "Payment received". A bank shows
   "Payment initiated" and sits as processing; in test mode Stripe settles it
   within a couple of minutes and the account updates.
5. Back on the Board view, **Finances** shows the payment on the ledger and the
   owner's balance has dropped.

## 3. Saving a method and autopay

1. On the Pay page press **Add a payment method** and save a bank or card. A
   micro-deposit bank shows as **Verifying** with a **Verify** link; the two
   amounts are `32` and `45`.
2. Turn on **Autopay** and pick a day. Every day at 14:30 UTC the cron charges
   any home whose day has come and whose balance is above zero, once per month,
   and emails a receipt or a decline.

## 4. What runs on its own

Three jobs run every day on Vercel. None need a person.

| Time (UTC) | Job                    | What it does                                             |
| ---------- | ---------------------- | -------------------------------------------------------- |
| 13:00      | `/api/assessments/run` | Bills each home its dues on the due day, once per period |
| 14:00      | `/api/billing/sweep`   | Trials ending, our own subscription                      |
| 14:30      | `/api/autopay/run`     | Charges homes with autopay on and a balance owing        |

Add `?dry=1` with the `CRON_SECRET` bearer to see what a run would do
without doing it.

## 5. Setting up a new community to test with

1. Sign out, open yourhoasis.com, **Get started**, answer the founding
   questions. Give at least one other home an owner with an email you can
   read.
2. Walk the plan. Dues set here are billed by the cron on the due day; the
   Collections page names the first bill date.
3. The invited owner signs in with that email (magic link). Their seat is
   claimed on sign-in and the home appears on their dashboard.
4. An empty home on **Homeowners** has an **Add owner** button.

## Numbers Stripe accepts

| What                  | Value                 | Result                              |
| --------------------- | --------------------- | ----------------------------------- |
| Routing number        | `110000000`           | Use with every account below        |
| Bank, instant         | `000123456789`        | Verifies at once, payment succeeds  |
| Bank, micro-deposits  | `000222222227`        | Confirm amounts `32` and `45` later |
| Bank, fails           | `000111111113`        | The payment is returned             |
| Card, works           | `4242 4242 4242 4242` | Any future date, CVC and ZIP        |
| Card, declines        | `4000 0000 0000 0002` | Shows the decline path              |

## Seeing what Stripe saw

dashboard.stripe.com, **YourHOAsis sandbox**. Connected accounts are under
Connect, each HOA by name. Payments made by residents live on the connected
account, not the platform. Developers > Webhooks shows every event delivered
to yourhoasis.com and whether it was accepted.

## Going live later

A live key pair from the dashboard, `pnpm stripe:setup` run once with the
live secret key in `.env.local`, and the five values replaced in Vercel.
No code changes. The test-mode boxes vanish on their own.
