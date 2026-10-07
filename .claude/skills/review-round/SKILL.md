---
name: review-round
description: Runs a review round on Your HOAsis the way the October 2026 rounds were run: walkers in a browser and a scenario reviewer against the code, findings verified and turned into rows in docs/work-tracker.md, then worked top down with one helper per chunk. Use when Monish asks for a review, a walk, "find what is wrong", or "do that again".
---

# A review round

The product improves in rounds: look, write down what is wrong in priority
order, fix from the top, show, merge. This is the recipe that produced
tracker sections 1 to 5 (the onboarding review, seven walkers), 12 (thirty
situations) and 13 (the signed-out walk) in October 2026. Each round is
three steps.

## 1. Look

Serve a frozen build the reviewers cannot disturb: `npx next build`, copy
`.next` (minus `dev` and `cache`), `package.json`, `next.config.ts`, and
symlinks to `node_modules`, `public` and `.env.local` into a scratch
folder, then `npx next start -p 3101` there. Port 3000 is Monish's own dev
server; 3100 is for the main session's own screenshots.

Then launch, in the background, in one message:

- **Walkers** (`.claude/agents/walker.md`): one per kind of person, each
  with a hard scope so they do not overlap. The ones that have earned their
  keep: a founder setting up a brand-new association; a treasurer moving an
  existing one over (balances, import); an officer running the board for a
  month (every board tab, one real action each); an owner on a phone (pay,
  autopay, request, vote, RSVP, notice, document); the join flow (code,
  invite link, wrong home); dark mode and 390px across everything. Signed
  out, they use `/demo` and `/demo?as=owner`. Signed in, give them a test
  login from `.env.local`'s `NEXT_PUBLIC_TEST_LOGINS` and the test
  association only; never a real customer.
- **The scenario reviewer** (`.claude/agents/scenario-reviewer.md`) with a
  numbered list of situations. Write the list for the stage the product is
  at: first year (sale, two owners, partial payment, bounced check, dispute,
  dues change, autopay failure, Stripe restricted, president leaves) was
  2026-10-05; year two is elections, budget season, an audit, a management
  company taking over, a board that stops paying, a lawsuit, a storm.

Brief each one with: the URL, who they are, what to cover, what never to do
(no real sign-ups, no outside services, no edits in the repo, no ports 3000
or 3100), where to write, and the report shape. The agent files carry the
rest.

## 2. Write it down

Read every report. Reproduce anything that matters before believing it; a
walker's "wrong" is sometimes the demo being the demo. Then add a tracker
section: `## N. <what this round looked at>`, a sentence on method, a table
with Where, What happens, Status. Findings that need Monish's call go in a
"waiting" row with the question stated; promises nothing keeps go to a
table of their own (section 10's pattern). Mark what was walked and clean.

## 3. Fix from the top

One helper per chunk (`model: sonnet`, written spec: files it may edit,
exact wording, what not to run), two at once only with a hard file boundary
(app-state.tsx, metrics.ts and data/ to one; screens to the other). SQL
goes in a new numbered migration the helper writes and does not apply; the
main session applies it in order with the matching `scripts/verify-*`
suite, then runs `pnpm check`, the browser suite against a fresh
`next start`, and clicks through the demo at localhost:3100 with a
Playwright script that screenshots.

Then a pull request with: what changes in plain words, what was checked
(suite counts, migrations applied), what was not clicked through and why.
Functional fixes are merged when Monish says so (he has said "merge" each
time so far). A restyle waits for him to look at the preview: one he had
not seen was rolled back on 2026-09-24.

## Traps that cost a round once
- Monish merged a pull request minutes before the next commit was pushed to
  its branch (twice). Push everything before saying it is ready.
- The local browser suite times out at random when the code indexer has
  the machine at full load; re-run the failed tests alone before believing
  a failure.
- A walker given too broad a brief drops half of it; one given a demo-only
  symptom reports it as a product bug. Say which is which in the brief.
- Agents that share `src/lib/app-state.tsx` overwrite each other. Boundary
  or sequence, never both at once.
- A stacked pull request (base = another branch) is closed by GitHub, not
  retargeted, when its base branch is deleted on merge. Open stacked work
  against main after the first merge, or merge without `--delete-branch`.
- A walker's test association can be left locked (subscription cancelled)
  by an earlier billing test. Check `association_writable` on it before
  a signed-in walk, and put it back on a trial afterwards.
