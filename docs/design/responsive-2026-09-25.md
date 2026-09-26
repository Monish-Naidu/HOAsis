# Responsive pass, 2026-09-25

Every board and resident route screenshotted with Playwright at eleven
viewports, light and dark, at the largest Text size, and with reduced
motion, then audited in the DOM for horizontal overflow, clipped text,
touch targets under 44px, text under 13px, lines over 95 characters, NaN
and crashes. 630 captures. Then the fixes below, then the changed routes
again.

Method note: `next dev` refuses a second server in the same directory, so
the run used a clean worktree at HEAD on port 3300. The phone frame
(`phone-preview` module) is switched off in `modules.ts`, so "phone shell"
here means the real viewports under `lg`, which render the same screens
with the tab bar. Above `lg` both resident modes are identical apart from
the bezel.

## Matrix

Viewport x shell x theme. "pass" means nothing found; "fixed" links to
the list below.

| Viewport | Board | Resident | Dark (board, resident) |
| --- | --- | --- | --- |
| 360x780 Android | fixed 3, 5, 6, 7, 9 | fixed 5, 8, 9 | pass |
| 390x844 iPhone | fixed 3, 5, 6, 7, 9 | fixed 5, 8, 9 | pass |
| 430x932 iPhone Max | fixed 3, 5, 6, 7, 9 | fixed 5, 8, 9 | pass |
| 768x1024 iPad portrait | fixed 2, 4, 6, 7 | fixed 8 | pass |
| 1024x768 iPad landscape | fixed 4 (rail shows, as intended) | pass | pass |
| 1280x800 laptop | fixed 10 | pass | pass |
| 1920x1080 | fixed 10 | pass | pass |
| 1920 at 150% zoom | fixed 10 | pass | pass |
| 1920 at 200% zoom | fixed 4, 10 | pass | pass |
| 2560x1440 | fixed 10 | pass | pass |
| 3840x2160 TV | fixed 1, 10 | fixed 1 | pass |
| Text size Largest, 390 and 1280 | pass | pass | n/a |
| prefers-reduced-motion, 1280 | pass | pass | n/a |

No route overflowed sideways at any width, none crashed, none showed NaN.
Every table already sits in an `overflow-x-auto` wrapper with a minimum
width. Every field already reads 16px under a touch pointer (no iOS zoom).
Focus rings and the reduced-motion block were already in place.

## Fixes

1. TV and unscaled 4K: root font grows to 20px from 2800px and 24px from
   3500px, so a 3840 display reads like a 2560 one seen up close; the
   board page cap moved from `1400px` to `87.5rem` so it grows too.
   `src/app/globals.css`, `src/app/board/layout.tsx`.
2. Board bar at 768: the community name wrapped to two lines beside the
   wordmark, and with `truncate` alone it shrank to one letter. Under `lg`
   the bar shows the bird only, and the switcher truncates on one line.
   `src/app/board/layout.tsx`, `src/components/app/community-hero.tsx`.
3. `.tap` utility: a 44px hit area under a coarse pointer for controls
   drawn smaller, without changing their drawn size. Applied to the phone
   header avatar, vendor Remove and Copy, transaction paperclip, action
   item Remove, forum Like, Reply, Pin and Remove, announcement Remove.
   `src/app/globals.css` and each site.
4. Homeowners roster at tablet and 200% zoom: the name column got 80px and
   showed "Gwen Hall…" while the email column had room. Columns now share
   1.3fr : 1fr and the officer badge wraps under a long name instead of
   crushing it. `src/app/board/homeowners/homeowners-screen.tsx`.
5. Action item Remove was `opacity-0` until hover, so a finger could never
   find it. Always visible under a coarse pointer.
   `src/components/app/action-items.tsx`.
6. Resident / Board switcher and the settings jump links reach 44px under
   a finger. `src/components/app/account-menu.tsx`,
   `src/app/board/settings/settings-screen.tsx`.
7. Hand-built buttons and labels with a fixed `h-8`, `h-9`, `h-10` now use
   `min-h` (they clipped at the largest text size) and reach 44px on
   touch: compliance, notices, document import, documents upload,
   reserve study, settings photo, report form, new request form, fill
   form, governing page, billing gate, assistant, section tabs.
8. Resident "Next up" event titles wrap to two lines instead of
   truncating on a phone. `src/components/app/home-schedule.tsx`.
9. Android and iOS tap highlight turned off on links, buttons, labels and
   summaries; the press animation is the feedback. Phone header pads for
   the notch (`env(safe-area-inset-top)`) when saved to a home screen.
   `src/app/globals.css`, `src/components/app/resident-shell.tsx`.
10. Long lines on wide board screens (up to 181 characters at 1920):
    request descriptions, announcements, ballot descriptions, forum posts,
    the runway sentence and the President note cap at `max-w-prose`.
11. One `text-display` token (36px, scales with Text size) replaces four
    hand-set sizes: the banner name, the resident balance, the setup plan
    and question flow headings. `feature-tabs` figure uses `text-title2`.
    `tokens.ts` `typeScale` now mirrors the CSS names and sizes.
    `src/app/globals.css`, `src/lib/tokens.ts`.

## Left alone, and why

- The 1400px board cap at 2560. Monish's 42" display renders at 2560 CSS
  px and the centred cap is what he signed off; only true 4K and TVs get
  the larger root.
- Tab bar labels at 11 to 13px fixed. A sixth of 320px is the limit and
  the comment in `resident-shell.tsx` says so; the badge count at 10px
  likewise.
- Line-clamped previews (`line-clamp-2` on cards) show as clipped in the
  audit. That is the design.
- `src/app/board/meetings/page.tsx` truncates the live meeting title on a
  phone ("Special board meeting: pool re…"). Another agent has that file
  open; it wants `line-clamp-2` on the `text-ok` title.
- The header search button (36px) belongs to the search overlay, owned by
  another agent. It wants `pointer-coarse:min-h-11`.
- Rail at 1024 landscape shows the sidebar, not the tab bar. That is the
  right call for a tablet with a keyboard, and the rows still hit 44px.
- Tablet email truncation in the roster ("uma.quintero@example.c…") is
  the trade for full names; the row opens to the full address.
- `next.config.ts` in the worktree got `turbopack.root` to allow a linked
  `node_modules`; not carried over.
