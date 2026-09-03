# UI baseline

The rules every screen is held to, board and resident, from 2026-09-03 on.
Read this before any UI change. It is short on purpose: a checklist, not an
essay. The palette and tokens live in `src/app/globals.css` and
`src/lib/tokens.ts`; the primitives in `src/components/ui/primitives.tsx`.

The frame is Apple's Human Interface Guidelines, applied to a product a
volunteer opens for forty minutes on a Tuesday. Clarity first, then deference,
then depth. Clean and simple is the name of the game.

## Clarity

- **One primary action per surface.** One filled button. Everything else is
  secondary, ghost, or a text link. If two things feel primary, the screen is
  two screens.
- **Say the thing.** Titles are nouns ("Finances", "Homeowners"). Buttons are
  verbs ("Pay by ACH", "Send notice", "Mark resolved"). No jargon, no
  "Manage", no "Submit".
- **Numbers are derived and consistent.** A figure comes from a selector in
  `src/lib/metrics.ts`, never from the screen. Money in cents through
  `money()`. Large figures use `tnum` and tight tracking.
- **Type carries hierarchy, not decoration.** The scale is 28 / 22 / 17 / 15
  / 13 / 11. Semibold for titles and values, medium for labels, regular for
  body. Muted and subtle foregrounds for what matters less.
- **Progressive disclosure.** A row shows what a person needs to decide
  whether to open it. Detail lives one tap in: an expand, a panel, a
  `<details>`. Never a wall of fields.
- **Empty states say what fills them.** One line and, where there is one,
  the action.

## Deference

- **Content over chrome.** Cards are `bg-surface`, one border, `shadow-card`.
  No gradients, no colored headers, no icons for decoration. An icon earns
  its place by aiding recognition (a landmark for a bank, a paperclip for an
  attachment).
- **Semantic tokens only.** `bg-surface`, `text-fg-muted`, `border-border`,
  `bg-brand`, `text-ok`, `bg-warn-soft`. A raw ramp value (`navy-900`) is
  for deliberately fixed surfaces such as the phone bezel. Both themes,
  always: if it cannot be read in dark, it is not done.
- **Color means something.** Green is settled or good. Amber is waiting or
  soon. Red is late, owed, or a fine. Blue is informational. Brand is the
  selected state. Nothing else is colored.
- **Quiet interaction.** Hover is `hover:bg-surface-2`. Focus is a border
  change, not a glow. Transitions are 150 to 200ms. No hover lifts on
  content, only on marketing tiles.

## Depth

- **Layers, sparingly.** The page sits on `bg-bg`. Cards float one step up.
  Popovers and floating rails float two (`shadow-float`). Nothing else
  floats.
- **Rounding is consistent.** Cards `rounded-card` (14px). Buttons and
  inputs `rounded-lg`. Chips and segmented controls `rounded-full` or
  `rounded-lg`. Floating rails `rounded-[26px]`.
- **Spacing is a 4pt grid.** Card padding 16 or 20. Section gaps 20 or 24.
  Row padding 12 to 14 vertical. If a value is not on the grid, it is wrong.

## Patterns to reuse

- **Segmented control** for switching views of one thing (All / Paid up /
  Behind; Overview / Transactions / Trends). Not tabs that load pages.
- **Filter chips** in one row for categories. Never a stack of selects.
- **Stat tiles** are `Stat`: label, value, one hint. Three to four across.
  A delta chip beside the value where a comparison exists.
- **Row with a menu** (`MoreHorizontal`) instead of an edit mode. No
  "Manage" / "Done" toggles.
- **Inline forms** open in place under the button that opened them, with
  their own Cancel. No modals for one or two fields.
- **Callouts** for one thing the person must know, with the action on the
  right. One per screen at most.

## Writing

- No em dashes. Short sentences. Less is more.
- Dates through `formatDate` / `relativeDays`. Never "2026-08-20" on screen.
- Toasts confirm what happened in five words ("Paid. Lands Friday.") and
  offer Undo where the action was destructive.
- Never say a thing is saved when it is not. If a record lives only in this
  browser, the screen says so in one quiet line.

## Before shipping a screen

1. Light and dark, both looked at.
2. 380px, 1024px and 1440px, all three.
3. One primary action, found in under a second.
4. Every number traceable to a selector.
5. `pnpm lint && npx tsc --noEmit && pnpm build`, then `npx vitest run`.
