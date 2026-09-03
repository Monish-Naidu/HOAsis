# Finances

2026-09-03. Item 8 of the handoff grew into the whole section. What each tab
is for, which selector feeds it, and the calls made along the way.

## The shape

One segmented control (`src/components/app/money-tabs.tsx`) across six views.
Every view keeps its own route, so a link or a bookmark lands on it, and every
new route is a `hidden: true` entry in `src/lib/board-routes.ts` gated on
`finances`. Hidden because the control is the navigation; listed because
listing is what gates it.

| Tab | Route | What it answers | Selectors |
| --- | --- | --- | --- |
| Overview | `/board/money` | Where does the money stand today, and what is waiting on me | `cashPosition`, `insuranceExposure`, `compareYears`, `monthlyFlows`, `spendingByCategory`, `budgetVariance`, `duesCollection`, `agingBuckets`, `useReconciliation` |
| Transactions | `/board/money/transactions` | Show me the lines, filtered, totalled, exportable | `periodRange`, `filterLedger`, `ledgerTotals`, `ledgerCategories`, `ledgerAttachment` |
| Budget | `/board/money/budget` | Are we on pace, line by line | `budgetVariance` |
| Trends | `/board/money/trends` | This year against last, and the run of years | `compareYears`, `yearSummary`, `netByYear` |
| Collections | `/board/money/collections` | Who is behind, how far, what do we owe them next | `delinquency`, `agingBuckets`, `duesCollection`, `collectionsLadder` |
| Reserves | `/board/reserves` | What wears out, when, what is set aside | unchanged |

Shared pieces (a stat tile with a delta chip, the segmented control, the
period picker, a quiet select, an inline bar) live in
`src/components/app/finance-ui.tsx`, not in primitives. They carry finance
opinions the general kit should not know.

Charts live in `src/components/app/board-charts.tsx`: `YearCompareChart`
(grouped monthly bars), `NetTrendChart` (one bar per year around a zero
line) and `AgingBar` (one bar, four segments). All on the `chart-*` tokens,
each with a tooltip and an sr-only table. The selector owns the numbers, the
chart owns the pixels.

## The data

`src/lib/data/ledger.ts` was May to August 2026, which is one year and
nothing to compare. It now carries January 2024 through April 2026 as well,
built by `buildLedgerHistory()` from a monthly template rather than written
out: the same three dues batches on the same days, the same vendors, the pool
June to October, counsel and pest control quarterly, the reserve transfer
paired across both accounts on the 15th so `monthlyFlows` and
`spendingByCategory` treat the rows exactly as they treat the hand written
ones. Dues, insurance and the reserve transfer step up each year, so 2025 runs
above 2024 and 2026 is on pace above 2025. Small deterministic wobble
(a string hash, not `Math.random`) keeps twelve months from reading as one
month twelve times. Ids are `le-h{yyyy}{mm}-{nn}`; the hand written rows keep
their ids and values.

Three August rows gained a `payoutId` (`le-139` to `po-2`, `le-136` to
`po-3`, `le-124` to `po-4`) and `po-4` gained `invoiceId: "inv-1"`, so the
paperclip on Transactions has something to open. `ledgerAttachment` follows
the link in either direction, payout to invoice or invoice to payout.

## Decisions

- **Like for like, always.** `compareYears` cuts both years at the last month
  the later one has data for. In August, 2026 against 2025 is January to
  August of each, never eight months against twelve. The full year figures
  stay on each side for the footnote.
- **Reserve funding is neither income nor spend.** It follows the existing
  `monthlyFlows` rule and is reported on its own (`reserveCents`, a delta of
  its own on Trends, a row of its own in the category table marked neutral).
  Net on every tile is before reserve funding, and says so.
- **Delta chips colour by welcome, not by sign.** Income up is green, spending
  up is red, reserve funding up is neutral. A red arrow on rising income
  teaches a board to distrust the page.
- **Budget variance is signed so positive is good on both kinds of line.**
  Expense: allowance to date minus actual. Income: actual minus allowance to
  date. A line is flagged when its pace runs two points past the share of the
  year gone; the tick on each pace bar is where the year is.
- **Aging partitions the roster.** Current, 1 to 30, 31 to 60, over 60, from
  `daysPastDue` and `balanceCents`. Counts sum to every household and cents to
  every balance, which the unit test pins. Current includes balances that are
  simply not due yet.
- **Dues collection is measured against units times dues**, converted to a
  monthly figure whatever the cadence, and only for months that have any
  transaction at all, so a future month does not read as zero collected.
- **Transactions opens on this month**, except when a link asks for the
  review queue, when it opens on this year, because the oldest unreviewed
  line is rarely this month's. The running column accumulates from the oldest
  row up, so the top row carries the total a treasurer checks the statement
  against.
- **The review queue also sits on the Overview**, one line per transaction
  with Confirm and Remove, so the decisions are one click from the door and
  the e2e that confirms and undoes from `/board/money` still holds.
- **One year control above both dashboard charts**, a segmented control while
  there are four years or fewer, a select after that, with "Compare years"
  beside it into Trends. Two dropdowns off one piece of state read as two
  settings.
- **The Add a budget line action** lives on Budget, and on the Overview only
  while there is no budget at all, where it is the one thing that would fill
  the empty card.

## Left undone

- Custom period on Transactions is two date inputs, no calendar popover.
- Trends compares two calendar years; a fiscal year that does not start in
  January is not handled anywhere in the ledger selectors yet.
- Vendor `ytdPaidCents` in the fixture is not reconciled to the built history.
  Bank balances were left as they were.
