# Financial reporting: the plan

Written 2026-10-07 for Monish, who asked: as associations with years of
history come on, how do we keep that history, show trends, and give boards
filters and views that are actually helpful? This is the design, grounded
in what the product holds today, with the order to build it in.

## What a treasurer actually asks

Everything below serves eight questions. If a screen does not answer one of
them, it does not belong.

1. How much do we have, and where (operating, reserves)?
2. Did everyone pay this month? Who did not, since when, how much?
3. What did we spend it on, and was that the plan (budget)?
4. Are we better or worse off than last year at this point?
5. Will we run out (months of cover, the reserve study)?
6. What happened to one home, one vendor, one account, over time?
7. What do I hand the accountant, the auditor, the buyer's title company?
8. What changed since I last looked, and who changed it?

A board member is a volunteer with an hour on a Tuesday evening. The
reporting layer has to be read in minutes, from a phone, by somebody who
has never seen a general ledger.

## What we hold today, and how long

The records are already shaped for reporting; the limits are in how far back
the screens reach.

| Record | Where | Kept | Loaded by the screens |
| --- | --- | --- | --- |
| Every bill, payment, credit, late fee, reversal on a home | `charges`, `payments`, `payment_allocations` | forever, append-only since 0106 | the last two years of lines; earlier years as monthly sums from `association_overview` |
| Every bank line: deposits, vendor payments, transfers, fees | `ledger_entries` | forever, append-only, corrections as opposite lines | the last two years; earlier as monthly sums by category; "load earlier" on Transactions |
| Vendor payments and their approvals | `payouts` | forever | all |
| Budget lines | `budget_lines` | per fiscal year | all (screen switched off for launch) |
| Reserve components and the study | `reserve_components` | current | all |
| Who did what | `activity` | forever, every board write since 0103 | the last 100 rows |
| Emails sent | `email_log` | forever | the last 300 rows |

Two gaps shape the plan:

- **History before us.** An association that moves over after fifteen
  years arrives with starting balances per home (one line each) and nothing
  else. Its trends start at month one with us. The first year with a
  customer, "how does this compare to last year" has no answer unless we
  take their history in.
- **Monthly sums are computed on the fly** by `association_overview` over
  every row. Fine at 88 homes and two years; at 500 associations with ten
  years each it is the first query to slow down.

## The design

### 1. Keep history, and take it in

- **Append-only stays the rule.** A reversal or a refund is a new line. The
  past never changes, so a report run in March and again in June agree
  about January.
- **Year-end close.** On the first day of a fiscal year, write one row per
  association per year to a new `fiscal_years` table: opening balances per
  account, income and spend by category, the ending balance, closed by whom
  and when. A closed year is read from that row, not recomputed. The board
  can reopen it (logged) to post a correction, which re-closes it.
- **Monthly rollups.** A `ledger_months` table (association, month, account,
  category, in, out, count) and a `statement_months` table (association,
  month, kind, cents, count), maintained by a trigger on insert (append-only
  makes this safe: there are no updates to track). `association_overview`
  reads those instead of summing rows. This is what keeps every report
  under a second at any size.
- **History import.** Two shapes, both through the existing roster-import
  pattern (a template, a preview, a dry run, then apply):
  - *Statement history*: a CSV of past charges and payments per home
    (date, home, kind, label, amount). Lands as real `charges` rows dated in
    the past, marked `source = 'import'`, below a "balance brought forward"
    cut-over date. Late fees are never assessed on imported lines.
  - *Ledger history*: a CSV of bank lines (date, description, category,
    amount, account), the shape every bank and QuickBooks can export.
    Lands as `ledger_entries` marked imported, categorised by a mapping the
    board confirms once ("Cascade Grounds Co." is Landscaping).
  - Imported months roll up like any other, so trends begin where the
    association's own records begin, not where ours do.
- **Load on demand, by year.** The screens keep loading two years of lines.
  A year further back loads when a filter asks for it, one year at a time,
  the way "load earlier" works on Transactions today.

### 2. One reporting layer, many views

Every number on every screen comes from one set of selectors over the
rollups and the loaded lines (`src/lib/metrics.ts` today). A view is a
selector plus a period plus filters; a trend is the same selector run per
month. Nothing is computed twice in two places.

The views, by the question they answer:

| View | Answers | Shape |
| --- | --- | --- |
| **Overview** (exists) | 1, 5 | Cash by account, months of cover, this month in one sentence, where it went |
| **Collections** (exists as Past due) | 2 | Who owes, how long, which letter is next; a monthly collected-rate line |
| **Budget versus actual** (built, switched off) | 3 | Per category: budget, actual to date, variance, projected year-end; a bar per month |
| **Year over year** (exists as Trends, switched off) | 4 | Income and spend per month, this year against last, like for like to the same month |
| **Reserve funding** | 5 | Percent funded, contributions versus the study's schedule, the next big item and the year it comes due |
| **One home, one vendor, one account** | 6 | A statement with every line, filterable by year, printable |
| **Annual records** (new) | 7 | For a chosen year: the ledger, every home's statement, vendor payments with approvals, the budget, vote tallies, notices, the activity log; each a CSV, the set a zip |
| **Activity** (exists) | 8 | Every board write, with an actor filter and a date range |

### 3. Filters that are actually helpful

The filters are in the URL (since #20), so a treasurer can bookmark "last
fiscal year, landscaping, operating account" and send it to the president.
The set, everywhere a list of money appears:

- **Period**: this month, last month, last 30 days, this fiscal year, last
  fiscal year, last 12 months, custom. Fiscal year follows
  `fiscal_year_start`, and the picker says the dates it means.
- **Account**: operating, reserve, each named account.
- **Category**: the ledger categories, with a count and a total on each chip
  so the filter is a summary before it is a filter.
- **Home**, **vendor**, **counterparty**: one of each, from a search box.
- **Status**: to confirm, confirmed, reversed, imported.
- **Compare to**: the same period a year earlier, shown beside, with the
  change in dollars and percent.
- **Saved views**: a named set of the above, per association, shared by the
  board ("Monthly close", "Landscaping this year"). Five defaults ship.

What we do not do: free-form report builders, pivot tables, charts a
treasurer has to configure. Each view is designed; the filters narrow it.

### 4. Trends that mean something

- **Twelve-month rolling** for income and spend, so a quarterly-dues
  association does not look like it earns nothing two months in three.
- **Same month last year** beside every monthly figure where a year of
  history exists; "no history yet" where it does not, never a zero.
- **Collected rate by month** (collected over billed, to date), the single
  number that says whether an association is healthy.
- **Reserve contributions against the study** as a line, with the study's
  next expense as a marker.
- **Per-home trend** on the statement: on time, late, average days late,
  twelve months back, so a board sees a pattern before it is a problem.

### 5. What the owner sees

The owner's reporting is one statement: every line, a running balance, a
year selector, "paid in {year}" at the top, a print and a CSV. Nothing else.
An owner who wants more asks the board, and the board's Annual records
answers.

## The order to build it

| Step | What | Why first | Size |
| --- | --- | --- | --- |
| 1 | Monthly rollup tables with triggers; `association_overview` reads them | Everything after needs fast sums; append-only makes it safe now | Done 2026-10-07: 0108, `ledger_months` and `statement_months`, `scripts/verify-rollups.mjs` |
| 2 | Fiscal-year close with a `fiscal_years` row, reopen logged | Closed years stop moving; the year-over-year view has a fixed base | Done 2026-10-07: 0109, closed by the daily ops job, `reopen_fiscal_year` and `close_fiscal_year` for the board, `scripts/verify-fiscal-years.mjs`; the screen that shows a closed year is still to build |
| 3 | Period filter with fiscal years and "compare to a year earlier" on Transactions and Overview; chip totals | Cheapest visible win on screens that exist | 2 days |
| 4 | Statement history import, then ledger history import | The first association with years behind it needs this on day one | 1 week |
| 5 | Switch on Budget versus actual and Trends, reworked to the rollups and the rules above | Already built; needs the pass | 3 days |
| 6 | Annual records: the exports, then the screen | The Terms promise an export; auditors and title companies ask | 1 week |
| 7 | Saved views and the five defaults | Once the filters are stable | 2 days |
| 8 | Per-home and reserve trends | Polish on top of the rest | 3 days |

Steps 1 to 3 fit in a week and change nothing a board sees except speed and
two new filters. Step 4 is the one to have ready before onboarding an
association with history. Steps 5 to 8 are the reporting platform proper.

## What this does not try to be

Not an accounting system of record for the association's CPA: no journal
entries, no chart of accounts beyond the ledger categories, no accrual
basis. The ledger is cash-basis and bank-shaped on purpose, because that is
what a volunteer board keeps and what their bank statement shows. The
export is what the accountant takes into their own tools.
