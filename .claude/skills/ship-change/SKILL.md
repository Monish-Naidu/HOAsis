---
name: ship-change
description: Finishes a change in Your HOAsis so it can go to a pull request: picks the check that proves each kind of change, walks the edge cases, runs the gate, and writes the pull request text. Use before saying a change is done, before a commit, or when a Mission milestone is validated. Not for review rounds (use review-round).
---

# Ship a change

A change is done when its check has run and the output is shown. This is
the order to get there. The rules themselves are in `CLAUDE.md`; this is
the procedure.

## 1. Name what changed

Run `git status --short` and `git diff --stat main...HEAD`. Sort every
changed file into the kinds below. A change usually has more than one.

## 2. Run the check for each kind

| Kind                               | Check that proves it                                                                                                                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic in `src/lib/*.ts`       | A unit test in `tests/unit/`, then `pnpm vitest run tests/unit/<file>`                                                                                                                                                  |
| A screen with the fake server      | A test in `tests/integration/`                                                                                                                                                                                          |
| A flow a browser spec drives       | `pnpm e2e` against a server you started on a free port (never 3000), with `E2E_BASE` pointing at it. A wizard step change also updates the helpers in `tests/e2e/07-onboarding.spec.ts` and `08-complete-setup.spec.ts` |
| A screen that looks different      | Screenshots at 1440 and 390, light and dark, read against `docs/design/ui-baseline.md`                                                                                                                                  |
| A new migration                    | A `scripts/verify-*.mjs` suite. Write the migration and the suite; do not apply either. The main session applies migrations one at a time, in order, against a target Monish has named                                  |
| A mutation in `src/lib/app-state/` | Both branches: the demo path in a browser, the signed-in path through its SQL function and suite                                                                                                                        |
| An email                           | The template's unit test, and the send path's log row; never a real send to a real person                                                                                                                               |
| A route under `src/app/api/`       | `pnpm api:verify` (regenerate with `pnpm api:generate` if the route list changed) and a unit test of its handler logic                                                                                                  |

If a change cannot be checked by any of these, it does not ship. Say so.

## 3. Walk the edge cases

Before running the gate, try the ones that apply and write down what
happened:

- Money and dates: zero, negative, a huge number, the same amount twice,
  the same day, a future date, UTC midnight.
- People: two owners on one home, one person with two homes, the seat that
  ended, nobody signed in.
- Writes: delivered twice, two people at once, the demo path and the
  signed-in path.

## 4. Run the gate

`pnpm check`. It runs format, lint, types, the doc and flag and API checks,
knip, the duplication scan, the unit tests and the production build, in
about two minutes. A test that fails once under load is re-run alone
before it is believed. A lint rule is satisfied, not disabled.

## 5. Write the pull request

Plain short sentences. Three parts:

- **What changes**, in words a board member would follow.
- **What was checked**: suite names and counts, migrations written (and
  that none were applied), screenshots taken.
- **What was not clicked through**, and why.

Push everything before saying it is ready. Merge only when Monish says so.
