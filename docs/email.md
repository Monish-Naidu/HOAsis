# Email

What the product emails, through which route, and what it takes to deliver
to anyone other than the Resend account owner. Audited 2026-09-25.

Every send runs on the server through Resend and writes one row to
`email_log` (success and failure alike). The recipient list always comes
from the `email_recipients` RPC, which owns the opt-out rule. Statutory
categories (`assessment`, `delinquency`, `meeting`, `ballot`) carry no
unsubscribe link and the database refuses to record an opt-out for them.
Optional categories carry a signed one-click unsubscribe link
(`src/lib/email/tokens.ts`). Demo mode (no Supabase) never reaches the
network: the `fetch` calls only run when a remote community is loaded.

## What sends, remote mode

| Moment (where the UI says it went)                                                                      | Before 2026-09-25                      | Now                                                              | Route                                             | `email_log` category            | Opt out  |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- | ------------------------------- | -------- |
| Dues run, "Send" on Finances (`DuesMailer`)                                                             | Emailed                                | Emailed                                                          | `POST /api/email/send`                            | `assessment` / `delinquency`    | No       |
| Dues letters per rung, "Send reminders" (`RemindersComposer`) and "Start from the letter" on Homeowners | Thread only, not emailed               | Emailed to that home                                             | `POST /api/email/notify` kind `letter`            | `delinquency`                   | No       |
| Note to one household from Homeowners ("Sent by email to ...")                                          | Thread only                            | Emailed                                                          | `notify` kind `message`                           | `message`                       | Yes      |
| Board reply on a Messages thread ("Reply sent to ...")                                                  | Thread only                            | Emailed to the thread's home (`letter` if the thread is Billing) | `notify` kind `message` / `letter`                | `message` / `delinquency`       | Yes / No |
| Announcement posted (Communications)                                                                    | Home screen only                       | Emailed to every home                                            | `notify` kind `announcement`                      | `community`                     | Yes      |
| Meeting "Send notice" ("Notice sent ...")                                                               | Announcement + date recorded, no email | Emailed to every home, statutory                                 | `notify` kind `meeting`                           | `meeting`                       | No       |
| Ballot opened to owners (New ballot)                                                                    | Nothing                                | Emailed to every home, statutory                                 | `notify` kind `ballot`                            | `ballot`                        | No       |
| Request approved / denied / marked fixed                                                                | Nothing                                | Emailed to the home that filed it                                | `notify` kind `request`                           | `request`                       | Yes      |
| Invite a household, "Email invite" / "Email sign-in link"                                               | Emailed                                | Emailed                                                          | `POST /api/email/invite` kind `invite`            | `invite`                        | Yes      |
| Join request approved ("you're in")                                                                     | Emailed                                | Emailed                                                          | `/api/email/invite` kind `welcome`                | `invite`                        | Yes      |
| Sign up confirmation                                                                                    | Emailed                                | Emailed                                                          | `POST /api/auth/signup`                           | not logged (no association yet) | n/a      |
| Autopay receipt / decline (cron)                                                                        | Emailed                                | Emailed                                                          | `/api/autopay/run` via `src/lib/email/autopay.ts` | `assessment`                    | No       |
| Trial notices to the President (cron)                                                                   | Emailed                                | Emailed                                                          | `/api/billing/sweep` via `src/lib/email/trial.ts` | `billing`                       | No       |
| Daily dues cron (`/api/assessments/run`)                                                                | Bills, does not email                  | Unchanged: the board presses Send on Finances                    |                                                   |                                 |          |
| Violation "Send notice" (Notices)                                                                       | Portal + print only                    | Unchanged, on purpose: the delivery panel says these go on paper |                                                   |                                 |          |
| Amendment "Send to owners" (Governing documents)                                                        | Local state only, no row               | Unchanged: nothing is persisted remotely yet                     |                                                   |                                 |          |
| Owner writes to the board / owner reply                                                                 | Thread, unread badge for the board     | Unchanged: the board is not emailed                              |                                                   |                                 |          |

The new route (`src/app/api/email/notify/route.ts`) follows the dues route:
the caller's own session answers `has_capability` (communications; finances
for letters and messages; requests for request updates; voting for
ballots). The words of an announcement, meeting, ballot or request are read
back from the row on the server, not taken from the request body. The
sender module is `src/lib/email/notify.ts`; templates are in
`src/lib/email/templates.ts` (table layout, one link, tested in
`tests/unit/email-templates.test.ts`).

Migration `0045_message_and_request_email.sql` adds `message` and `request`
to `email_category`, both optional.

## The sender, and why nothing reaches residents yet

Every sender reads `emailSender()` in `src/lib/email/sender.ts`. It treats a
blank `EMAIL_FROM` as unset and falls back to `Your HOAsis
<onboarding@resend.dev>`, which Resend delivers to the account owner only.

Found during the audit (2026-09, on Vercel then): production had `EMAIL_FROM=""` (empty).
Every route did `process.env.EMAIL_FROM ?? fallback`, which keeps the empty
string, so production posted `from: ""` and Resend refused every message.
Fixed in code by the shared `emailSender()`; the env var still needs setting
(below). `pnpm db:verify` (`scripts/verify-email.mjs`) reads the
production value from `.env.azure` and fails when it is empty or a
`resend.dev` address.

`RESEND_API_KEY` is a sending-only key: it cannot read or add domains
(403 on `/domains`). No Cloudflare or Resend full-access credential exists
on this machine (`~/.wrangler`, `~/.cloudflare`, env, `.env.local` checked),
so the domain has to be verified by hand.

### yourhoasis.com in Resend (done 2026-10-15)

The domain is verified in Resend (US East, id
`499117f1-d72a-4d5d-a68a-35e249c95c85`) on the root, so mail comes from
`hello@yourhoasis.com`. These are the records in Cloudflare, all **DNS
only** (grey cloud). Resend issues the CNAME targets and the DKIM value;
the DKIM value is unique to the account, so a new Resend account means a
new record.

| Type  | Name                | Value                                   | Purpose                  |
| ----- | ------------------- | --------------------------------------- | ------------------------ |
| TXT   | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEB...` (218 chars) | DKIM                     |
| CNAME | `send`              | `send.forge.rmta.net`                   | SPF and the return path  |
| CNAME | `rsend`             | `rsend.forge.rmta.net`                  | Resend's bounce handling |
| TXT   | `_dmarc`            | `v=DMARC1; p=none;`                     | DMARC, monitor only      |

Resend's "Auto configure" button is an OAuth grant to Cloudflare; the
records were added by hand instead. Tightening DMARC to `p=quarantine`
is a later step, once a month of sends shows nothing else uses the
domain.

A webhook (Resend, Webhooks) posts every `email.*` event to
`https://yourhoasis.com/api/email/webhook`; its signing secret is
`RESEND_WEBHOOK_SECRET` in `.env.azure`, loaded into Key Vault by
`scripts/azure/secrets.sh`. The route returns 500 and logs an error
while that secret is missing, which also fires the errors alert.

`EMAIL_FROM` in `.env.azure` is `Your HOAsis <hello@yourhoasis.com>`.
A change to either value is applied with:

```bash
scripts/azure/secrets.sh
APPS_ONLY=true scripts/azure/provision.sh
```

Replies go to `hello@yourhoasis.com`; route it in Cloudflare Email
Routing or set a `reply_to` before boards start writing back.

The auth service on Azure sends its own mail (sign-up confirmations,
magic links, password resets, email-change links) through Resend's SMTP
with the address and name taken from `EMAIL_FROM` by `infra/apps.bicep`,
so there is nothing to run after a change beyond the two commands above.

## Proving it sends today

`node scripts/send-test-email.mjs monishnaidu18@gmail.com` on 2026-09-25:
Resend id `01a0db98-8cd9-7478-b586-654d7a1b67cd`, from the shared sender,
delivered to the account owner.
