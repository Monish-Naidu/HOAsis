@AGENTS.md

# ExpressHOA, working notes

Renamed from HOAsis on 2026-09-01 (the domain was taken); brand system in
`docs/design/brand-expresshoa.md`. Internal storage keys keep the `hoasis-`
prefix on purpose: renaming them signs every browser out.

Clickable prototype of an HOA management product. See `README.md` for the full architecture;
this file is the short version of what to keep true when editing.

## Rules that matter

- **UI changes follow `docs/design/ui-baseline.md`.** Apple HIG applied to this product:
  one primary action per surface, semantic tokens, progressive disclosure, quiet
  interaction, 4pt spacing. Read it before touching a screen.

- **Screens import from `@/lib/data` only.** Never import a fixture file (`data/ledger.ts`,
  `data/owners.ts`, …) directly from a page. The repository layer in `data/index.ts` is the
  seam where Supabase will land.
- **Derive, don't hardcode.** If a number can be computed from the records, compute it in a
  selector. Two screens showing different values for the same concept is the exact failure
  this product is positioned against.
- **Money is integer cents** (`Cents`). Format with `money()` / `shortMoney()`. Never floats.
- **Dates are `YYYY-MM-DD` strings.** Use `formatDate` / `relativeDays` / `daysFromToday`.
  `TODAY` is pinned to 2026-08-20. Don't introduce `new Date()` into rendering; it breaks
  static prerendering and makes the demo drift.
- **Colors come from semantic tokens** (`bg-surface`, `text-fg-muted`, `border-border`,
  `bg-brand`). Reach for a raw ramp value (`navy-900`) only for deliberately fixed surfaces
  like the resident balance card or the device bezel.
- **Both themes, always.** Anything added must read correctly in light and dark. Semantic
  tokens handle this for free; hardcoded hex does not.
- If you change the palette, change `src/app/globals.css` **and** `src/lib/tokens.ts`.

## Two shells, one set of screens

`ResidentShell` renders the resident pages either as a website (sidebar, `max-w-2xl` content)
or inside a phone frame, toggled in the top bar. Resident pages are still authored at phone
width so both modes work. Nav is defined once in `resident-nav.tsx` and consumed by the tab
bar and the sidebar.

## Conventions

- Server components by default. `"use client"` only for genuine interaction (pay flow, new
  request form, nav active state, theme toggle). `<details>` handles expand/collapse without JS.
- Shared UI lives in `src/components/ui/primitives.tsx`. Add to it rather than re-styling
  a card inline for the third time.
- Resident screens are authored at phone width (~380px of content). Board screens are dense
  and desktop-first with a horizontal nav fallback under `lg`.

## Checks

```bash
pnpm lint && npx tsc --noEmit && pnpm build
```

All routes should prerender. `pnpm lint` is strict about `setState` in effects, use
`useSyncExternalStore` for anything reading browser state.

<!-- cce-block-version: 4 -->
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
