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

| Moment (where the UI says it went) | Before 2026-09-25 | Now | Route | `email_log` category | Opt out |
| --- | --- | --- | --- | --- | --- |
| Dues run, "Send" on Finances (`DuesMailer`) | Emailed | Emailed | `POST /api/email/send` | `assessment` / `delinquency` | No |
| Dues letters per rung, "Send reminders" (`RemindersComposer`) and "Start from the letter" on Homeowners | Thread only, not emailed | Emailed to that home | `POST /api/email/notify` kind `letter` | `delinquency` | No |
| Note to one household from Homeowners ("Sent by email to ...") | Thread only | Emailed | `notify` kind `message` | `message` | Yes |
| Board reply on a Messages thread ("Reply sent to ...") | Thread only | Emailed to the thread's home (`letter` if the thread is Billing) | `notify` kind `message` / `letter` | `message` / `delinquency` | Yes / No |
| Announcement posted (Communications) | Home screen only | Emailed to every home | `notify` kind `announcement` | `community` | Yes |
| Meeting "Send notice" ("Notice sent ...") | Announcement + date recorded, no email | Emailed to every home, statutory | `notify` kind `meeting` | `meeting` | No |
| Ballot opened to owners (New ballot) | Nothing | Emailed to every home, statutory | `notify` kind `ballot` | `ballot` | No |
| Request approved / denied / marked fixed | Nothing | Emailed to the home that filed it | `notify` kind `request` | `request` | Yes |
| Invite a household, "Email invite" / "Email sign-in link" | Emailed | Emailed | `POST /api/email/invite` kind `invite` | `invite` | Yes |
| Join request approved ("you're in") | Emailed | Emailed | `/api/email/invite` kind `welcome` | `invite` | Yes |
| Sign up confirmation | Emailed | Emailed | `POST /api/auth/signup` | not logged (no association yet) | n/a |
| Autopay receipt / decline (cron) | Emailed | Emailed | `/api/autopay/run` via `src/lib/email/autopay.ts` | `assessment` | No |
| Trial notices to the President (cron) | Emailed | Emailed | `/api/billing/sweep` via `src/lib/email/trial.ts` | `billing` | No |
| Daily dues cron (`/api/assessments/run`) | Bills, does not email | Unchanged: the board presses Send on Finances | | | |
| Violation "Send notice" (Notices) | Portal + print only | Unchanged, on purpose: the delivery panel says these go on paper | | | |
| Amendment "Send to owners" (Governing documents) | Local state only, no row | Unchanged: nothing is persisted remotely yet | | | |
| Owner writes to the board / owner reply | Thread, unread badge for the board | Unchanged: the board is not emailed | | | |

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

Found during the audit: Vercel production has `EMAIL_FROM=""` (empty).
Every route did `process.env.EMAIL_FROM ?? fallback`, which keeps the empty
string, so production posted `from: ""` and Resend refused every message.
Fixed in code by the shared `emailSender()`; the env var still needs setting
(below). `pnpm db:verify` (`scripts/verify-email.mjs`) now pulls the
production value through the Vercel CLI and fails when it is empty or a
`resend.dev` address.

`RESEND_API_KEY` is a sending-only key: it cannot read or add domains
(403 on `/domains`). No Cloudflare or Resend full-access credential exists
on this machine (`~/.wrangler`, `~/.cloudflare`, env, `.env.local` checked),
so the domain has to be verified by hand.

### Verify yourhoasis.com in Resend

1. Resend dashboard > Domains > Add domain. Enter `yourhoasis.com`, region
   US East. Resend suggests sending from a subdomain; accept `send` so the
   records are `send.yourhoasis.com` and the root domain's own MX and SPF
   stay untouched.
2. Add the three records Resend shows in Cloudflare (DNS > Records for
   yourhoasis.com). Proxy status must be **DNS only** (grey cloud) on all of
   them. The values below are what Resend issues for a `send` subdomain;
   copy the exact DKIM value from the dashboard, it is unique to the account.

   | Type | Name | Value | Purpose |
   | --- | --- | --- | --- |
   | MX | `send` | `feedback-smtp.us-east-1.amazonses.com`, priority 10 | Return path for bounces |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF for the return path |
   | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...` (from the dashboard) | DKIM |

   Optional, recommended once the above verifies: a DMARC record so Gmail
   stops treating the domain as unknown.

   | Type | Name | Value |
   | --- | --- | --- |
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:monishnaidu18@gmail.com` |

3. Back in Resend press Verify. It usually clears within minutes at
   Cloudflare; up to 72 hours worst case.
4. Vercel, one change: set `EMAIL_FROM` for Production to
   `Your HOAsis <hello@send.yourhoasis.com>` (any mailbox on the verified
   subdomain works; replies will go there, so either watch it or set a
   `reply_to` later). Then redeploy so the value is picked up:

   ```bash
   vercel env rm EMAIL_FROM production --yes
   vercel env add EMAIL_FROM production   # paste: Your HOAsis <hello@send.yourhoasis.com>
   vercel --prod
   ```

5. Put the same value in `.env.local` and run
   `node scripts/send-test-email.mjs someone-else@example.com` to prove
   delivery to a non-owner address. Then `pnpm db:verify` passes the
   sender check.

Supabase Auth's own emails (password reset, magic links minted by the app)
go through the same Resend SMTP credentials set by `pnpm email:setup`; the
sender name there is read from `EMAIL_FROM` at the time it runs, so run it
again after step 4.

## Proving it sends today

`node scripts/send-test-email.mjs monishnaidu18@gmail.com` on 2026-09-25:
Resend id `01a0db98-8cd9-7478-b586-654d7a1b67cd`, from the shared sender,
delivered to the account owner.
