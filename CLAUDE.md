@AGENTS.md

# Your HOAsis, working notes

An HOA management product at yourhoasis.com (renamed from HOAsis and ExpressHOA
in September 2026; storage keys keep the `hoasis-` prefix on purpose, renaming
them signs every browser out). Signed-in users run on Supabase (Postgres with
row level security), Stripe and Resend; the fixtures serve only the signed-out
demo. Trust the code and `docs/tenancy.md` over `README.md`. This file is only
what cannot be read from the code. Workflows live in `.claude/skills/`,
reviewers in `.claude/agents/`, the priority list in `docs/work-tracker.md`.

## How work is done here

- **Explore, plan, then code** for anything that touches more than one file,
  a migration or a flow. A change you can describe in one sentence goes
  straight in. Say the plan before editing; Monish reads it.
- **Every change ships with its check**, and the output is shown, not
  asserted: a unit test for pure logic, a `scripts/verify-*.mjs` suite for
  SQL, the browser suite for a flow, a screenshot for a screen. If it cannot
  be checked, it does not ship.
- **Walk the edge cases before calling it done.** For money and dates: zero,
  negative, a huge number, the same amount twice, the same day, a future date,
  UTC midnight. For people: two owners on one home, one person with two homes,
  the seat that ended, nobody signed in. For writes: delivered twice, two
  people at once, the demo path and the signed-in path (every mutation in
  `app-state.tsx` has both).
- **Fix the cause, not the symptom.** A test that fails once under load is
  re-run alone before it is believed; a lint rule is satisfied, not disabled.
- **Branch, pull request, checks, merge.** The pull request says what
  changes in plain words, what was checked (suite counts, migrations applied)
  and what was not clicked through. Merge only when Monish says so, and push
  everything before saying it is ready. Vercel deploys `main` by itself.
- **Delete what is unused.** No dead files, no commented-out code, no second
  way of doing a thing kept "just in case".

## Where things go

| Kind of code | Lives in | Rule |
| --- | --- | --- |
| Routes and pages | `src/app/` | Server components; thin: read selectors, render, hand off to a client component only for real interaction |
| Shared screen pieces | `src/components/app/` | One component per concern; `src/components/ui/primitives.tsx` for anything used three times |
| Pure logic and selectors | `src/lib/*.ts` | No React, no fetch, no `new Date()`; every exported function has a unit test |
| Data layer | `src/lib/data/` | `index.ts` is the only import screens use; `remote.ts` maps Supabase rows; fixtures are the demo |
| Mutations | `src/lib/app-state.tsx` | Signed-in branch calls one SQL function through `remoteWrite`; demo branch edits local state the same way the database would |
| Money, email, meetings | `src/lib/payments/`, `src/lib/email/`, `src/lib/meetings/` | Server-only where a key is involved |
| Server routes and jobs | `src/app/api/` | Authorised with `CRON_SECRET` or a webhook signature; log with `logger()`; record a cron run |
| Database | `supabase/migrations/NNNN_name.sql` | Numbered, never edited once applied; redefine a function by copying it whole into a new file; grants explicit; every change proven by a `scripts/verify-*.mjs` suite |
| Tests | `tests/unit`, `tests/integration`, `tests/e2e` | Pure logic, screens with the fake server, the signed-out demo in a browser |
| Notes for people | `docs/` | Decisions, the tracker, go-live steps; not a second copy of the code |

## Rules that matter

- **UI changes follow the `frontend-design` skill**: ground the design in the
  subject, plan, review the plan against the brief, build, critique from
  screenshots. `docs/design/ui-baseline.md` holds this product's tokens and
  patterns; where the two differ, the skill wins. A restyle Monish has not
  seen goes to a pull request with a preview, not to `main`.
- **Screens import from `@/lib/data` only.** Never a fixture file directly.
- **Derive, don't hardcode.** If a number can be computed from the records,
  compute it in a selector. Two screens showing different values for one
  concept is the failure this product is positioned against.
- **Money is integer cents** (`Cents`), formatted with `money()`. Never floats.
- **Dates are `YYYY-MM-DD` strings.** `formatDate`, `relativeDays`,
  `daysFromToday`. The demo's `TODAY` is pinned to 2026-08-20. No `new Date()`
  in rendering: it breaks prerendering and makes the demo drift.
- **Colors come from semantic tokens** (`bg-surface`, `text-fg-muted`,
  `border-border`). Raw ramp values only for deliberately fixed surfaces.
  **Both themes, always.** A palette change touches `src/app/globals.css`
  and `src/lib/tokens.ts`.
- **Copy:** short, plain, sentence case, no em dashes; a button says what
  happens; one thing has one name everywhere; nothing promised that the code
  does not keep.
- **Comments explain why**, in full sentences, like the neighbours. Code
  reads like the code around it.
- **No new dependency when twenty lines do.** The stack is Next.js 16 app
  router, React 19, Tailwind 4 tokens, Supabase with row level security and
  SQL functions for anything that moves money, Stripe Connect, Resend,
  Playwright and vitest. Reach for a library only when it replaces real
  complexity, and say so in the pull request.

## Two shells, one set of screens

`ResidentShell` renders the resident pages as a website (sidebar, `max-w-2xl`)
or inside a phone frame. Resident pages are authored at phone width (about
380px) so both work; board screens are dense, desktop-first, never capped in
width, with a horizontal nav under `lg`. Nav is defined once in
`resident-nav.tsx`. `"use client"` only for genuine interaction; `<details>`
for expand and collapse.

## Checks

```bash
pnpm check        # lint, tsc, vitest, build: about two minutes
pnpm e2e          # Playwright against a server already running (E2E_BASE to point elsewhere; never port 3000, that is Monish's dev server)
pnpm db:verify    # every database check, against the real Supabase project in .env.local
node scripts/verify-all.mjs money late-fees   # one or more suites by name
```

`pnpm check` before every commit. `pnpm e2e` when a change touches a flow a
spec drives. A migration is applied one at a time, in order, with its suite,
by the session, never by a helper. A change to the wizard's steps updates the
helpers in `tests/e2e/07-onboarding.spec.ts` and `08-complete-setup.spec.ts`.
`pnpm lint` is strict about `setState` in effects; use `useSyncExternalStore`
for anything reading browser state. All routes prerender.

Database traps: grant execute to `anon`, `authenticated` and `service_role`
by name; `auth.role() = 'service_role'` for the service role; `array_append`
not `||` on arrays; never a second overload of an existing function name;
`unit_balances` returns nothing to the service role, read it as a seat.

## Helpers

One sonnet helper per chunk with a written spec: files it may edit, exact
wording, what not to run. Two at once only with a hard file boundary;
`src/lib/app-state.tsx` belongs to one of them. Read the diff, apply the
SQL, run the checks, click through, then commit. When compacting, keep the
list of modified files, the migrations applied and their suite results.

## Context Engine (CCE)

This project uses Code Context Engine for intelligent code retrieval and
cross-session memory.

### Searching the codebase

**You MUST use `context_search` instead of reading files directly** when
exploring the codebase, answering questions about code, or understanding how
things work. This is a hard requirement, not a suggestion. `context_search`
returns the most relevant code chunks with confidence scores instead of whole
files, and tracks token savings automatically.

When to use `context_search`:
- Answering questions about the codebase ("how does X work?", "where is Y?")
- Exploring structure or architecture
- Finding related code, functions, or patterns
- Any time you would otherwise read a file just to understand it

When to use `Read` instead:
- You need to edit a specific file (read before editing)
- You need the exact, complete content of a known file path

Other search tools:
- `expand_chunk` — get full source for a compressed result
- `related_context` — find what calls/imports a function

### Cross-session memory — use it actively

This project has persistent memory across Claude Code sessions. **You must
use it both ways: recall before answering, record after deciding.** Memory
that is not recorded is lost; memory that is not recalled does nothing.

**Before answering a non-trivial question, call `session_recall`.**
Especially when:
- The question touches architecture, design, or naming choices
- The user asks "what / why / how did we ..."
- You are about to recommend an approach the team may have already chosen
  or already rejected

Pass a topic phrase, not a single word — e.g. `session_recall("auth flow")`,
not `session_recall("auth")`. Recall is vector-similarity-based, so paraphrases
match. If recall returns relevant entries, lead with them ("Per a prior
decision: ...") instead of re-deriving the answer.

**After making a non-obvious decision, call `record_decision`.** Especially:
- Choosing one library / pattern / approach over another
- Resolving an ambiguity in the spec or requirements
- Establishing a convention the project should follow going forward
- Anything you would not want to re-litigate next session

Format: `record_decision(decision="...", reason="...")`. Keep both fields
short and specific — they are surfaced verbatim at the start of future
sessions.

**After meaningful work in a file, call `record_code_area`.** Especially when:
- You added or substantially modified a function/class
- You traced through a non-obvious flow and want future-you to find it fast

Format: `record_code_area(file_path="...", description="...")`.

Skip recording for trivial reads, formatting changes, or one-off lookups —
the goal is durable signal, not an event log.

### Drilling deeper from a recall hit

`session_recall` results are tagged with the source session id, e.g.
`[turn sid:abc123|n:5]`. To drill in:

- `session_timeline(session_id="abc123")` — walk the per-turn summaries of
  that session in order. Use this when the user asks "what was the
  reasoning?" or "how did we get there?".
- `session_event(event_id=N)` — fetch a specific tool event's raw input
  and output (capped at 4 KB at read time). Use this when a turn summary
  references a tool result you actually need to inspect.

Both are read-only and cheap. Prefer them over re-running tool calls or
asking the user to re-paste context.

### Output style

Respond in compressed style. Drop articles (a, an, the) in prose. Use
sentence fragments over full sentences. Use short synonyms (fix not resolve,
check not investigate). Pattern: [thing] [action] [reason]. [next step].
No filler, hedging, pleasantries, trailing summaries, or restating what
the user said. One sentence if one sentence is enough.

When suggesting code changes, show only the changed lines with 3 lines of
context. Never rewrite entire files. Multiple changes in one file: show each
change separately. Never echo back unchanged code the user already has.

Code blocks, file paths, commands, error messages: always written in full.
Security warnings and destructive action confirmations: use full clarity.
<!-- /cce-block -->
