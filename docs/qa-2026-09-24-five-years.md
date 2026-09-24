# Five years, forty homes, 2026-09-24

Monish asked for a brand new community founded through the real onboarding,
forty homes, run as if it had existed for five years: dues every month, the
usual life of an association, and every screen checked against the database.
Everything found is listed here. Fixed items name the files; nothing is
pushed.

Juniper Hollow is kept so it can be looked at. Sign in as
`monishnaidu18+fiveyear@gmail.com` (password in the handoff message).
Owners sign in with `qa5y-<home>@example.com` or the named ones
(`qa5y-sam@`, `qa5y-dora@`, `qa5y-bea@`, `qa5y-tara@`, `qa5y-sofia@`) and
the owner password the script prints.

## What was driven

- **Onboarding in a headless browser**: account step (see open item 1),
  then every question: name, Bend OR, $325 monthly on the 1st, detached,
  pool + clubhouse + playground, "we already run it, from another
  platform", special assessment, founder's home 1, homes 1 to 40 by number
  with three owners typed in, bank connected, created.
- **The plan at /start/plan**: CC&Rs uploaded, a landscaping budget line,
  insurance (Cascade Mutual CM-44120), a vendor, cover photo. Invites and
  officers skipped, as a board would on day one.
- **Five years of history** with `scripts/verify-five-years.mjs`, through
  the product's own RPCs and table writes: 60 months of `issue_assessment`
  (2,400 dues bills), 2,323 `record_payment`s, `levy_special_assessment`
  for a $60,000 pool resurfacing approved by ballot, two sales through
  `transfer_home` (one settled at closing), 151 vendor payments, monthly
  reserve transfers, 20 quarterly meetings with 238 RSVPs through
  `rsvp_meeting`, five two-seat elections and a pool vote through
  `cast_vote`, 20 notices, 30 requests, 39 collection letters, 17
  announcements, 15 forum posts. Midway it became a **mixed community**:
  homes 1 to 24 townhomes ($275 rising to $325), 25 to 40 condos ($75
  more), billed per kind by 0036's `issue_assessment`. 39 of 39 checks pass,
  including every home's balance every month, dues per kind per year to the
  cent, bank = collections net of fees less vendors less reserve funding,
  RLS isolation, and seller/buyer access after a sale.
- **Board, as Monish**: Dashboard, Setting up, Finances (Overview,
  Transactions with This year / Last year, Collections), Budget and Trends
  (switched off), Homeowners, Reserve Study, Notices, Vendors, Requests,
  Communications, Community, Meetings, Voting, Documents, Settings, and ⌘K
  for records from 2022 and 2023.
- **Residents**: Sam Steady (current, autopay), Dora Delinquent ($9,950,
  876 days), Bea Buyer (bought home 12 in 2024): dashboard, account and
  statement, pay, funds, vote, calendar, notices, requests (filed one each),
  documents, community.
- **Dues cron** dry run: Juniper quiet today; Oct 1 bills "October 2026
  dues", $14,200 across the two kinds.

Figures that agree across screens and the database: cash $324,211 operating
and $136,500 reserve, past due $15,470 in 2 households, 2026 money in
$121,693, 38 of 40 current, every statement's running balance ends at the
owner's balance.

## Fixed

| Files | What was wrong |
| ----- | -------------- |
| `src/lib/data/remote.ts` | **Every real association past ~2 years read a fifth of its books.** Charges, ledger, payouts, threads and replies were one unpaged read, and the API stops at 1,000 rows. Juniper has 4,964 statement lines and 2,597 ledger lines: bank balances, statements, days past due and collections were all computed from the newest thousand. Now paged. |
| `src/lib/data/remote.ts` | Budget "actual" summed every year on the books, so landscaping read five years against one year's line. Now the current fiscal year. |
| `src/lib/data/remote.ts`, `src/app/resident/account/page.tsx` | Resident statements were oldest first (2021 at the top, last payment 120 lines down), and "Paid in 2021" showed five years of payments. Newest first, and that year only. |
| `src/lib/app-state.tsx` | "Settle the balance at closing" cleared the owner's balance but wrote nothing to the ledger, so the bank and "collected" never saw the money. Now books it to operating. |
| `src/components/app/setup-plan.tsx` | Opening /start/plan directly (reload, bookmark, new tab) showed **Mehr Meadows' 88 homes** as a signed-in founder's plan: nothing on that page starts the session. Now waits for it. |
| `supabase/migrations/0040_founder_email_and_request_references.sql` | The founder's own seat had no email, so the President was "a household nobody can email", with no invites or autopay receipts. Trigger fills it from the profile. |
| `supabase/migrations/0040_founder_email_and_request_references.sql` | **The second owner to file a request got a duplicate-key error.** The form numbers from the requests the filer can see (their own), and references are unique per association. A taken number now becomes the next free one. |
| `src/app/resident/requests/new/form.tsx` | Request numbers were hardcoded `REQ-2026-`. |
| `src/lib/collections.ts` | "2 accounts passed the final notice step with no notice on record" showed for households with seven letters on record. Now checks the Billing threads. |
| `src/lib/utils.ts` | Medium dates never showed a year: five years of notices, letters, requests and posts all read "Aug 18". Other years now say so. |
| `src/lib/payments/assessments.ts` | Monthly dues were labelled "October dues" with no year, unlike quarterly and annual. Now "October 2026 dues". |
| `src/components/app/ballot-card.tsx` | A two-seat election named one winner. Names as many as seats. |
| `src/lib/search.ts` | Search showed "Unit 4 · · $9,950.00 owed" for homes without an address. |

Migration 0040 is applied to prod. Juniper's founder seat was backfilled by
hand; other associations' founders still lack the email (open item 3).

## Open, needs a human or a decision

1. **Nobody but Monish can sign up.** `/api/auth/signup` sends through
   Resend's test sender, which only delivers to the account owner, so even
   `monishnaidu18+fiveyear@` was refused, the account deleted, and the
   screen said "Check the address and try again". The QA account was made
   with the admin API. Verifying yourhoasis.com in Resend fixes it; the
   message should also stop blaming the address (`src/app/api/auth/signup/route.ts:96`).
2. **Two-seat elections record one choice per home.** `cast_vote` keeps one
   row per (ballot, home) and the resident ballot takes one pick, but the
   tally divides by seats, so 26 homes voting shows as "13 of 40". Either
   allow a pick per seat (votes key on option too, and a multi-select
   ballot) or stop dividing. The resident card also still names one
   winner (`src/app/resident/vote/ballot-vote.tsx:23-27`, being restyled).
3. **Existing founders' seats** in other associations still have no email.
   One line, if wanted:
   `update memberships m set invited_email = p.email from profiles p where m.profile_id = p.id and m.invited_email is null and p.email is not null;`
4. **Owners see $0 for association funds.** `/resident/finances` reads bank
   and ledger rows that RLS gives only to finance holders, so every real
   owner sees Operating $0, Reserves $0, Landscaping $0 of $36k, 0
   transactions, while "show funds to residents" is on. Needs a definer
   RPC returning totals, or the page hidden for real associations.
5. **"Dues collected" is net of processor fees** against gross billed, so a
   month where everyone paid reads 96%. Decide gross or net.
6. **Late fees and fines are promised, never charged.** The pay page says a
   $25 late fee applies at 30 days; a "fined" notice carries `fine_cents`.
   Neither ever becomes a charge.
7. **No way to record a reserve transfer** or any ledger line that is not a
   dues payment or a vendor payment. The script wrote them directly.
8. **Trends and Budget stay switched off** in `modules.ts` for an
   association with five years of data ("Needs a second year of data").
9. **The setup wizard loses everything on reload** (draft is component
   state only). Seen three times in this run as the dev server reloaded.
10. **A buyer sees the seller's whole payment history** on their statement
    (dates, amounts, method). Intended by the three-year script; worth a
    decision on privacy.
11. Small: Notices counts "1688 days ago"; the "Move the books here" card
    never ticks off steps already done; only one governing document can be
    uploaded in the plan step; a cover photo upload that hit a network
    error failed silently.

## How to repeat it

```bash
node scripts/verify-five-years.mjs                  # founds its own, deletes it after
node scripts/verify-five-years.mjs --keep           # keeps it
node scripts/verify-five-years.mjs --association <id> --keep   # fills one made at /start
node scripts/verify-five-years.mjs --remove         # deletes every kept association and QA user
```

About three minutes. Kept associations carry `settings.qa = "five-year"`
and QA users `user_metadata.qa = "five-year"`; `--remove` deletes both,
including Juniper Hollow and the founder account.
