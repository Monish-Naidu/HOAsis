# UI baseline

The rules every screen is held to, board and resident, from 2026-09-03 on,
revised 2026-09-19 for the pop pass (`ui-pop-2026-09-19.md`).
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
- **Type carries hierarchy, not decoration.** Sizes are tokens, never
  `text-[Npx]`: `text-title1` 28, `text-title2` 24, `text-title3` 20,
  `text-headline` 18, `text-body` 16, `text-callout` 15, `text-footnote` 14,
  `text-caption` 13. Nothing smaller than caption. Semibold for titles and
  values, medium for labels, regular for body. Muted and subtle foregrounds
  for what matters less.
- **Progressive disclosure.** A row shows what a person needs to decide
  whether to open it. Detail lives one tap in: an expand, a panel, a
  `<details>`. Never a wall of fields.
- **Empty states say what fills them.** One line and, where there is one,
  the action.

## Readable for everyone

Owners skew older and many are not technical (2026-09-24).

- **Text size is the reader's.** The tokens are rem times `--type-scale`,
  which the Text size control sets to 1, 1.125 or 1.25. It lives in
  Settings on both sides (`DisplaySettings`); the phone header's avatar
  opens resident Settings. Anything that holds text grows with
  it: `min-h`, not `h`, on a box with words in it; no `whitespace-nowrap` on
  a label that could wrap instead.
- **Contrast clears AA with room.** `fg-muted` 7:1, `fg-subtle` 5:1, field
  and secondary-button edges (`border-2`) 3:1. Do not add a lighter grey.
- **44px under a finger.** Buttons, back links, icon buttons, segmented
  options. An icon-only control is the exception, and it has an
  `aria-label`.
- **Words beside icons** where the icon is not obvious (Board / Resident,
  Sign out, Light / Dark).
- **Links look like links.** A link in body-coloured text is underlined.
- **Nothing important disappears on its own.** Toasts hold while a pointer
  rests on them; warnings stay until closed. Money on a resident screen is
  shown as the figure, not counted up.
- **Keep the real word, explain it on tap.** CC&Rs, Autopay, Reserves,
  funded, special assessment, business days: owners hear these at meetings,
  so they stay, wrapped in `Term` (`src/lib/glossary.ts`) where a resident
  first meets them. Tap, never hover.
- **Every section is reachable on a phone.** The tab bar holds six; More
  lists the rest with a line under each.
- **Focus is always visible.** Fields wear the ring whatever their classes
  say (`globals.css`).

## Deference

- **Content over chrome.** Cards are `bg-surface`, one border, `shadow-card`.
  A card is never a gradient and never has a coloured header. Colour goes on
  the things inside it: the tile behind an icon, the hairline on a stat, the
  one filled button.
- **Gradients, three places only.** The primary button (`bg-brand-gradient`,
  through `Button variant="primary"`), one accent word in a marketing
  headline (`text-gradient`), and a marketing stage behind a section
  (`bg-aurora`, or two blurred pools on a navy band). Nowhere else. Not on
  a card, not on a row, not on text inside the product.
- **Icons are tiles.** An icon aids recognition (a landmark for a bank, a
  paperclip for an attachment) and wears an `IconTile`. In the product,
  `soft`: a pale tinted field with a saturated glyph. On marketing pages,
  `solid`: the tint lit from the top left with a white glyph. Never a bare
  glyph on grey, never a coloured circle drawn inline.
- **Tints are recognition, not meaning.** Five: blue, teal, amber, coral,
  violet. An idea keeps its tint everywhere it appears: money is teal,
  requests are blue, meetings and time are amber, notices and alerts are
  coral, documents, voting and records are violet. A row of six tiles with
  six different tints is right; six blue tiles is wrong.
- **Semantic tokens only.** `bg-surface`, `text-fg-muted`, `border-border`,
  `bg-primary`, `bg-tint-teal-soft`, `text-ok`, `bg-warn-soft`. A raw ramp
  value (`navy-900`) is for deliberately fixed surfaces such as the phone
  bezel and the navy rail. Both themes, always: if it cannot be read in
  dark, it is not done. A new colour goes in `globals.css` and `tokens.ts`
  in the same commit.
- **Color means something.** Green is settled or good. Amber is waiting or
  soon. Red is late, owed, or a fine. Blue is informational. Primary is the
  one thing to do. The five tints say "this is that thing again" and nothing
  more.
- **Interaction is felt, not announced.** Every button presses (`.press`,
  120ms scale). The primary button glows on hover (`shadow-glow`) and a
  sheen sweeps it once (`.shimmer`). Content rows hover to `bg-surface-2`.
  Marketing tiles lift (`.lift`); product cards never lift. Focus is the
  ring token, not a glow.

- **The rail is lit, and every row has a tile.** The navy rail (`Rail`) is
  a fixed surface with a pool of brand blue behind the wordmark and a
  hairline of light at its edge. Each row's icon sits on a small dark tile
  (`RailIcon`) with the section's tint on the glyph; the pointer lights the
  tile in that tint, and the selected row's tile goes frosted white on the
  gradient pill. Tints come from the route table (`BOARD_ROUTES`,
  `residentTabs`), never from the nav.
- **A page title wears its section's lit tile.** `PageHeader` puts the
  section's `solid` tile beside the title, looked up from the route by
  path (`RouteTile`); resident pages do the same through `ResidentTitle`.
  The one place a `solid` tile appears inside the product, and the glyph
  and tint are the same as the rail row that opened the page.

## Motion

Two easings, three durations, one pop.

- `--ease-out-soft` for anything arriving or settling. `--ease-spring` for
  a thing snapping into a position (the tab pill, the toggle knob).
  `--ease-pop` only for a thing appearing from nothing (a check, a chip
  landing).
- `--dur-press` 120ms for a button under a finger. `--dur-fast` 180ms for
  hover. `--dur-base` 320ms for a thing arriving. `--dur-slow` 640ms for a
  section settling on scroll.
- Page changes stagger: `PageTransition` is a `.stagger` parent, and each
  direct child of the page lands 40ms after the one before, up to twelve.
  A list that wants the same puts `.stagger` on its `ul`.
- Figures count up once on first paint (`CountUp`), 800ms, never on a
  re-render. Money stays integer cents through `money()`.
- Done is one check that pops and one ring that pulses (`SuccessMark`).
  Not confetti, not a second ring, not a sound.
- Toasts spring up, the icon pops a beat later, and a hairline drains for
  as long as the toast will stay.
- Rail rows stagger in on first paint. A tab or rail tile pops once
  (`pop-in`) when it becomes selected, by remounting on the change.
- The sliding pill (`TabPill`) is never a `.stagger` child: an animation
  would override its inline transform and park it on the first row.
- Everything above is listed in the reduced-motion block in `globals.css`
  and lands on its end state when the reader has asked for less motion. A
  new animation is not done until it is in that list.

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
- **Stat tiles** are `Stat` (or finance `StatTile`): label, value, one
  hint, an `accent` tint for the hairline along the top and the tile behind
  the icon. Three to four across, each a different tint. A delta chip beside
  the value where a comparison exists.
- **Row with a menu** (`MoreHorizontal`) instead of an edit mode. No
  "Manage" / "Done" toggles.
- **Inline forms** open in place under the button that opened them, with
  their own Cancel. No modals for one or two fields.
- **Callouts** for one thing the person must know, with the action on the
  right. One per screen at most.
- **Status is a dot and a word** (`Badge dot`). The dot carries the colour,
  the word carries the meaning, so nobody has to remember which colour is
  which.
- **Empty states** put their icon on a neutral tile, or a tinted one when
  the emptiness is an invitation ("Send your first notice").

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
