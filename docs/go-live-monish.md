# What Monish does to go live

Everything the code cannot do for you, in the order to do it. Each item says
where to click and what it unlocks. Written 2026-09-26; strike lines as you go.

## Before the first stranger signs up

1. ~~**Resend domain.**~~ Done 2026-10-15: `yourhoasis.com` is in Resend
   (us-east-1) with its four records in Cloudflare (DKIM TXT on
   `resend._domainkey`, CNAMEs `send` and `rsend`, DMARC `p=none`), the
   webhook for `/api/email/webhook` listens to every email event, and
   `.env.azure` carries `EMAIL_FROM="Your HOAsis <hello@yourhoasis.com>"`
   and `RESEND_WEBHOOK_SECRET`. Resend's status page for the domain is the
   place to look if a send fails with a domain error.
2. **Support mailbox.** Cloudflare → Email → Email Routing → route
   `support@yourhoasis.com` to your inbox. The Help item in every account
   menu, the error page, and the Terms and Privacy pages already point at it.
3. **Stripe live mode.** dashboard.stripe.com → toggle off test mode →
   Developers → API keys. Then, from the repo:
   `pnpm stripe:setup https://yourhoasis.com` with the live secret key in
   `.env.local`. Replace `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `STRIPE_BILLING_WEBHOOK_SECRET` in `.env.azure`,
   then `scripts/azure/secrets.sh` and `scripts/azure/deploy.sh`. The script also registers `yourhoasis.com` for
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
7. **Logs and alerts.** Nothing to set up: Application Insights, the uptime
   test and the three alert emails are provisioned by `infra/platform.bicep`
   (docs/observability.md). Check that the alert emails are not landing in
   spam the first time one arrives.
8. **Lawyer pass** on `/terms` and `/privacy`. Both are marked DRAFT on the
   page; remove the callout in `src/app/terms/page.tsx` and
   `src/app/privacy/page.tsx` when reviewed.
9. **Insurance and entity.** LLC, business bank account, E&O and cyber
   policies. Stripe review asks for the entity; customers ask for the
   insurance.

## Added 2026-10-06, after the overnight list

Monish asked "is there anything else I need to wire up?" Beyond the nine
above, in the order they matter:

10. ~~**Supabase auth emails through your own domain.**~~ Nothing to click
    since 2026-10-15: the auth service on Azure sends through Resend's SMTP
    with the address in `EMAIL_FROM` (`infra/apps.bicep` derives it), so
    sign-up confirmations, magic links, password resets and email-change
    links come from `hello@yourhoasis.com` once item 1 is verified. The
    site URL and redirect list are parameters of the same template.
    three regions, every five minutes, emails you after two failures in a
    row). The daily digest (`/api/ops/digest`, since 2026-10-06) tells you
    what failed; the uptime check tells you when the site is down and
    cannot send it.
11. **Search engines.** `src/app/robots.ts` still blocks every crawler, from
    the prototype days. When you want to be found: allow `/`, `/pricing`,
    `/about`, `/library`, keep `/board`, `/resident`, `/admin`, `/api`
    blocked, add a sitemap, then Google Search Console → add
    `yourhoasis.com` (DNS record in Cloudflare). Nobody finds the site until
    this is done.
12. **Staging database.** Create a second Supabase project, put its four
    values in `.env.staging`, then `pnpm staging:setup` does the rest. Until then every database check
    runs against the live project with throwaway associations it deletes.
13. **Stripe live-mode billing portal.** `pnpm stripe:setup` (item 3) also
    creates the portal configuration in live mode; it exists in test mode
    only today.
14. **Daily jobs are five** (`infra/apps.bicep`): dues, bills email, billing
    sweep, autopay, digest. `/admin` shows the latest run of each; the Azure
    portal shows each job's execution history. `CRON_SECRET` is set.
15. **Backups you can restore.** Supabase Pro (item 6) gives daily backups;
    Point-in-Time Recovery is the add-on that makes "undo the last hour"
    possible. Until then, `pg_dump` by hand before anything risky.

16. **Azure.** Done 2026-10-15: `yourhoasis.com` is served from Azure,
    database and all (`docs/azure-migration-plan.md`). The hosted Supabase
    project is paused and the Vercel project was deleted the same day, so
    expresshoa.com no longer redirects. Still yours: delete the Supabase
    project after 2026-11-14 if nothing has needed a rollback; move `rg-hoasis` to a pay-as-you-go subscription before the first
    paying association (the credit is dev/test, with a hard stop at $150 a
    month); item 6 above (Supabase Pro) is void.

## Deploy, then check

10. Merge to `main`; GitHub Actions deploys it to Azure. Then:
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
`.env.azure`; passwords are also in the gitignored `scripts/.qa/test-logins.md`.
To remove the card, delete the variable from `.env.azure` and redeploy
(`scripts/azure/deploy.sh`); to rotate a
password, set it in Supabase Auth and update the variable.

## Optional

- Vanity subdomains (`oakview-commons.yourhoasis.com`): bind
  `*.yourhoasis.com` to the web app (`webCustomDomains` in `provision.sh`);
  Cloudflare `CNAME *` to the app's address, proxy off;
  `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yourhoasis.com` in `.env.azure`.
  The path form `/c/<slug>` works today without any of this.
- Better Stack or UptimeRobot on `/` and `/api/health`.

## Still open in the product

- Opening bank balances on import (two ledger lines on the switch date).
- A dispute email to the treasurer (disputes reach `/admin` today).
- Export-everything and per-person erasure.
- The per-customer runbook for the first ten HOAs is in
  `docs/customer-onboarding.md`.
