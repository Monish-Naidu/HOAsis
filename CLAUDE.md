@AGENTS.md

# HOAsis, working notes

Clickable prototype of an HOA management product. See `README.md` for the full architecture;
this file is the short version of what to keep true when editing.

## Rules that matter

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
