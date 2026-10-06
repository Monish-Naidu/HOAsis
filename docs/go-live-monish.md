# What Monish does to go live

Everything the code cannot do for you, in the order to do it. Each item says
where to click and what it unlocks. Written 2026-09-26; strike lines as you go.

## Before the first stranger signs up

1. **Resend domain.** resend.com → Domains → Add `yourhoasis.com`. Copy the
   three records (MX and TXT on the `send` subdomain, DKIM TXT on
   `resend._domainkey`) into Cloudflare → yourhoasis.com → DNS, proxy off.
   Click Verify in Resend. Until this is done every email except yours is
   silently dropped: sign-up confirmations, invites, bills, receipts.
   `EMAIL_FROM` is already set in Vercel to `Your HOAsis <hello@yourhoasis.com>`.
2. **Support mailbox.** Cloudflare → Email → Email Routing → route
   `support@yourhoasis.com` to your inbox. The Help item in every account
   menu, the error page, and the Terms and Privacy pages already point at it.
3. **Stripe live mode.** dashboard.stripe.com → toggle off test mode →
   Developers → API keys. Then, from the repo:
   `pnpm stripe:setup https://yourhoasis.com` with the live secret key in
   `.env.local`. Replace `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `STRIPE_BILLING_WEBHOOK_SECRET` in Vercel
   (Production). Redeploy. The script also registers `yourhoasis.com` for
   Apple Pay and Google Pay on every connected account.
4. **Stripe Connect platform review.** Stripe asks before the first live
   payout: a live site with pricing (`/pricing`), terms (`/terms`), privacy
   (`/privacy`), a refund and dispute policy (add a paragraph to `/terms`), a
   support address, and the platform's legal entity. Have the LLC formed
   first.
5. **Stripe dashboard settings.** Settings → Payment methods → turn Link off
   (it clutters the pay form). Settings → Public details → support email
   `support@yourhoasis.com`.
6. **Supabase plan.** supabase.com → project → Settings → Billing → Pro,
   and add Point-in-Time Recovery. The free tier pauses when idle and has no
   usable backups. It paused once already, on 2026-09-19.
7. **Vercel plan and env.** Hobby is non-commercial and keeps logs an hour;
   move to Pro before the first paying HOA. Environment variables still to
   add: `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` after creating a Sentry
   project (free tier) and installing the Vercel Sentry integration.
   Already set: `EMAIL_FROM`, `PLATFORM_OWNER_EMAILS`,
   `NEXT_PUBLIC_TEST_LOGIN_EMAIL`, `NEXT_PUBLIC_TEST_LOGIN_PASSWORD`.
8. **Lawyer pass** on `/terms` and `/privacy`. Both are marked DRAFT on the
   page; remove the callout in `src/app/terms/page.tsx` and
   `src/app/privacy/page.tsx` when reviewed.
9. **Insurance and entity.** LLC, business bank account, E&O and cyber
   policies. Stripe review asks for the entity; customers ask for the
   insurance.

## Added 2026-10-06, after the overnight list

Monish asked "is there anything else I need to wire up?" Beyond the nine
above, in the order they matter:

10. **Supabase auth emails through your own domain.** Sign-up confirmations,
    magic links, password resets and the new email-change links are sent by
    Supabase's own mailer today, limited to a few an hour and from a
    Supabase address. Once Resend's domain is verified (item 1):
    supabase.com → project → Authentication → SMTP Settings → enable custom
    SMTP with Resend's host (`smtp.resend.com`, port 465), username
    `resend`, password a Resend API key, sender `Your HOAsis
    <hello@yourhoasis.com>`. Then Authentication → URL Configuration: Site
    URL `https://yourhoasis.com`, and add `https://yourhoasis.com/auth/callback`
    and `https://*.vercel.app/auth/callback` to the redirect list, so a link
    opened from a preview still signs in.
11. **Sentry DSN** (item 7) and **one uptime check**: betterstack.com or
    uptimerobot.com, free, pointed at `https://yourhoasis.com/api/health`
    every five minutes, email you on failure. The daily digest
    (`/api/ops/digest`, since 2026-10-06) tells you what failed; the uptime
    check tells you when the site is down and cannot send it.
12. **Search engines.** `src/app/robots.ts` still blocks every crawler, from
    the prototype days. When you want to be found: allow `/`, `/pricing`,
    `/about`, `/library`, keep `/board`, `/resident`, `/admin`, `/api`
    blocked, add a sitemap, then Google Search Console → add
    `yourhoasis.com` (DNS record in Cloudflare). Nobody finds the site until
    this is done.
13. **Staging database.** Accept the Supabase terms once in Vercel
    (https://vercel.com/monish-naidus-projects/~/integrations/accept-terms/supabase?source=cli),
    then `pnpm staging:setup` does the rest. Until then every database check
    runs against the live project with throwaway associations it deletes.
14. **Stripe live-mode billing portal.** `pnpm stripe:setup` (item 3) also
    creates the portal configuration in live mode; it exists in test mode
    only today.
15. **Vercel crons are four now** (`vercel.json`): dues, billing sweep,
    autopay, digest. Vercel → project → Settings → Crons shows whether each
    fired. `CRON_SECRET` is set.
16. **Backups you can restore.** Supabase Pro (item 6) gives daily backups;
    Point-in-Time Recovery is the add-on that makes "undo the last hour"
    possible. Until then, `pg_dump` by hand before anything risky.

## Deploy, then check

10. Push `main` and let Vercel deploy. Then:
    - Open `/api/health` on yourhoasis.com: every check `ok`.
    - Open `/admin` signed in as yourself: cron runs listed, no errors.
    - Run `pnpm stripe:setup https://yourhoasis.com` once more so Stripe
      re-validates the Apple Pay file now that it is served.
    - Pay page in Safari on an iPhone: Apple Pay button present. Chrome with
      a saved card: Google Pay present.
    - Sign in with the test treasurer on the sign-in page; it lands on Mehr
      Meadows.

## Test logins

The sign-in page shows a "Test logins" card with three one-click seats on
your real Mehr Meadows: Treasurer (Taylor Test, Lot 7), Vice president (Arya
Mehr, Lot 5) and Resident (Nina Okafor, Lot 4). Sign in as one, sign out
from the card at the foot of the rail, sign in as the next: that is how to
walk a flow from the board side to the owner side. Anyone who finds the
card can see that association, which is your call for now (2026-09-26).
The list lives in `NEXT_PUBLIC_TEST_LOGINS` (JSON) in `.env.local` and in
Vercel; passwords are also in the gitignored `scripts/.qa/test-logins.md`.
To remove the card, delete the variable in Vercel and redeploy; to rotate a
password, set it in Supabase Auth and update the variable.

## Optional

- Vanity subdomains (`oakview-commons.yourhoasis.com`): Vercel → Domains →
  add `*.yourhoasis.com`; Cloudflare `CNAME * cname.vercel-dns.com` with
  proxy off; Vercel env `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yourhoasis.com`.
  The path form `/c/<slug>` works today without any of this.
- Better Stack or UptimeRobot on `/` and `/api/health`.
- Axiom log drain from Vercel for logs older than Vercel keeps.

## Still open in the product

- Opening bank balances on import (two ledger lines on the switch date).
- A dispute email to the treasurer (disputes reach `/admin` today).
- Export-everything and per-person erasure.
- The per-customer runbook for the first ten HOAs is in
  `docs/customer-onboarding.md`.
