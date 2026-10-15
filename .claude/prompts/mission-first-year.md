# Mission: what a board needs in its first year

Paste this into a Factory Mission (Mission mode, Extra Usage on). It is
the plan to agree with the orchestrator before any worker starts. Push
back on it in planning; do not start until the milestones and their checks
are agreed with Monish.

The rules are `AGENTS.md` and `CLAUDE.md`. The open work is
`docs/work-tracker.md`; each feature below names its row. When a feature
lands, its tracker row says "done", the date and the pull request.

## Ground rules for every worker

- Work in a worktree on its own branch (the `Your HOAsis` setup profile).
  One pull request per milestone, against `main`. Never merge.
- Mutations live in `src/lib/app-state/`. Only one worker at a time edits
  that folder; the orchestrator sequences them.
- A worker may write a new migration and its `scripts/verify-*.mjs` suite.
  No worker applies a migration or runs a database suite: `.env.local`
  points at production. Monish or the main session applies each one, in
  order, against a target Monish names.
- Every email goes through `src/lib/email/` and is logged. No real send to
  a real person; the unit test of the template is the check.
- Finish every feature with the `ship-change` skill. Do not call a feature
  done without its check's output.
- Copy is plain, short, sentence case, no em dashes. One thing has one name.

## Milestone 1: meetings and joining

Owners and boards hit these in the first month.

| Feature                                                                                                      | Tracker row                  | Done means                                                                                                |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| A meeting detail page for owners: date, place, agenda, one call link, dial-in only when it is a phone number | section 16, owner on a phone | Tapping a meeting anywhere on the resident side opens it; the calendar opens on the next meeting's month  |
| An email to every home when a meeting is moved or cancelled                                                  | section 15, meetings row     | Moving or cancelling sends one email per reachable home, logged, once; a second press does not send again |
| The board is emailed when somebody asks to join                                                              | section 3                    | Every officer who can manage homeowners gets one email per request, with a link to the request            |
| Resend the confirmation email from the sign-in page and the wizard                                           | section 3                    | Same control and wording as the join page (`ResendLine` in `src/app/join/join-panel.tsx`)                 |
| A welcome email for a second owner added from a join request                                                 | section 3                    | Same welcome a first owner gets                                                                           |

Validation for milestone 1:

- `pnpm check` passes.
- Unit tests for every new selector and email template.
- `scripts/verify-meetings.mjs` and `scripts/verify-join-flow.mjs` extended
  for the new SQL, if any. Written, not run.
- A browser walk of the signed-out demo at 390 and 1440, light and dark:
  open a meeting from Home, Calendar and Meetings; move one and cancel one
  as the board and see the owner side agree. Screenshots in the pull
  request.

## Milestone 2: budget season and the annual meeting

Budget season is October to December, and the annual meeting follows.

| Feature                                                                                        | Tracker row               | Done means                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| New dues with a date they take effect                                                          | section 16, budget season | The board sets a new rate and a start date; the dues job bills the old rate before the date and the new one from it; owners see the change coming |
| Budget against actual switched on, reworked to the monthly rollups                             | section 21, step 5        | `money-budget` on in `src/lib/modules.ts`; figures match Finances for the same period                                                             |
| Quorum on a ballot, paper and proxy votes entered by the board, "dues must be current" to vote | section 15                | A ballot says whether quorum was met; a board-entered vote counts once per home and is marked as entered                                          |
| Seat the winners from a closed ballot, and a results email                                     | section 16, the election  | One action seats the winners in their offices; every home gets the result once                                                                    |

Validation for milestone 2:

- `pnpm check` passes.
- Edge cases written into the tests: a start date of today, of the first of
  next month, in the past; two rate changes queued; a tie; quorum missed by
  one; a home with two owners voting; a home that is behind on dues.
- New or extended verify suites for the dues job and voting. Written, not
  run.
- A browser walk: set a new rate for January, open a ballot, enter a paper
  vote, close it, seat the winner, and check Settings shows the new officer.

## Milestone 3: records a board is asked for

Terms promises a complete export; an auditor or an owner's records request
asks for one.

| Feature                                                | Tracker row                   | Done means                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Export everything for one association                  | section 16                    | One download from Settings: every table the association owns, as CSV files in one zip, with a readme naming each file                        |
| An "Annual records" screen with CSVs per area and year | section 16, section 21 step 6 | Pick a year; download charges, payments, vendor payments with approvals, ballots, meetings and minutes, requests, the email log and activity |
| Vendor 1099 list for January                           | section 15                    | `vendor-tax-forms` on; vendors paid $600 or more in the year, with whether a W-9 is on file                                                  |

Validation for milestone 3:

- `pnpm check` passes.
- Unit tests that each export's row count and totals match the screen
  showing the same records for the same year.
- A year with no records, a year with one, and the five-year demo history.
- A browser walk: download each file, open it, and compare its totals with
  Finances.

## Cost and size

Roughly one worker run per feature and two validator runs per milestone:
12 features and 3 milestones is about 18 runs before any fix-up work. Run
the workers on a Droid Core model where the work is screens and tests, and
on a heavier model for SQL and money.
