# Hydration error #418: the cause, and the fix

Minified React error #418 (hydration mismatch) fired on the cold first load
of board pages and of the wizard on every production build from Next 16.3.1
upwards. This page is the whole finding, what closed it, and how to re-verify
after any future bump.

## Fixed by the bump to Next 16.4.2

Next 16.4.2 no longer throws #418, fixed 2026-10-15 in pull request #59. Same
harness, same machine, same build settings, a fresh production server for each
build, six cold loads each:

| Build                 | Cold loads of `/board` that fired #418 |
| --------------------- | -------------------------------------- |
| Next 16.3.1 (control) | 6 of 6                                 |
| Next 16.4.2           | 0 of 6                                 |

The recovery render went with the error. React's recovery is itself a client
render, so a second harness counted DOM mutations after `DOMContentLoaded`
(three cold loads each): on 16.3.1, 66 mutations in the first 400 ms, 17 of
them at the `html`/`body` level, removing the server's `body` children and
putting new ones back. On 16.4.2, 2 mutations in the same window, one of them
the router's own announcer element, and nothing torn down.

The markup did not change. 16.4.2 still serves
`<div hidden><!--$--><!--/$--></div>` at the top of `<body>`, and still puts
the flight payload in `__next_f.push` scripts at the tail of `<body>`. The
fix is in how that boundary is resolved, not in removing it. The Next changes
that cover it shipped in 16.4.0: "Keep metadata rendering stable across
streaming modes" (#97440), "Adopt SelectedMetadata for metadata rendering"
(#97387).

### The bump was worth taking on security alone

Three advisories patched in 16.4.1 affect every Next from 16.0.0 through
16.4.0, which includes 16.3.1. The 16.3 line never received them: 16.3.8,
its last release, is from 2026-09-30.

| Advisory                                                              | Severity | Patched |
| --------------------------------------------------------------------- | -------- | ------- |
| Unauthenticated RCE in `use cache` functions returning typed arrays   | critical | 16.4.1  |
| Unauthenticated RCE in Image Optimization API when SVG files are used | critical | 16.4.1  |
| Denial of service in the App Router using Server Actions              | high     | 16.4.1  |

What that means here: the tree has no `"use cache"` directive, so the typed
array RCE has nothing to reach, and this app serves no remote SVG through
`next/image`. The Server Actions denial of service is the one that applies to
a product whose forms post through actions in `app-state.tsx`.

### What moved

- `next` 16.3.1 to 16.4.2, with `@next/env` and the `@next/swc-*` binaries.
- `@sentry/nextjs` 11.0.0 to 11.7.0, which pulls `sentry` 0.44.1 to 0.45.0.
  The 0.44.1 declaration file is what Turbopack refused, so the two bumps
  belong together. 11.8.0 is newer than 11.7.0 and is deliberately not taken
  yet: it is inside the release-age window.
- Transitive, from those two: `rolldown` 1.2.5 to 1.2.14, `sharp` 0.35.3 to
  0.35.5, an `oxc-parser` bump, a `browserslist` data refresh, and a patch to
  `web-vitals`.
- `pnpm-workspace.yaml` gains a ten-entry `minimumReleaseAgeExclude` block.
  pnpm 11 wrote it because 16.4.2 was published hours before this commit; the
  list is the same-package-family entries only (`next`, `@next/env`, the eight
  `@next/swc-*` binaries).

## What fires and what does not

On 16.3.1, against a production build, on a machine with a warm disk cache:

- The first full load of a route in a fresh browser fires once, every time:
  `/board` 8 of 8 and 6 of 6, `/board/money` 4 of 4, `/start` 4 of 4,
  `/about` 3 of 3. Signed out, `/board` fires 3 of 5.
- The second full load in the same browser never fires.
- `next dev` never fires.
- Client-side navigation never fires, which is why the money pages read
  clean for a day: they are reached from `/board`, and navigation does not
  hydrate. A hard refresh of `/board/money` fires 4 of 4.

## The cause

Next.js 16.3.1 wraps metadata in a streaming boundary,
`<div hidden><MetadataBoundary><Suspense name="Next.Metadata">` in
`next/dist/lib/metadata/metadata.js`. On a prerendered route that boundary
sits at the top of `<body>` as an empty resolved marker; the title and meta
elements it renders are hoisted to `<head>`. The RSC flight payload that
resolves `Next.Metadata` rides the inline `self.__next_f.push(...)` scripts
at the tail of `<body>`, and Next's flight reader resolves those on
microtasks while React's hydration runs in scheduler tasks.

On a cold load the browser starts hydrating before the reader has resolved
the metadata. React's walk reaches the boundary and compares it against a
client tree whose boundary content has not arrived yet. `canHydrateInstance`
returns null, `throwOnHydrationMismatch` throws #418, and React recovers by
discarding the entire document and rendering it on the client (observed:
every head and body child removed and recreated about 30 ms in).

## The proof

The served HTML is byte-identical between loads that fire and loads that
clean. Only one thing changes the outcome: where the flight scripts sit.

- Untouched build: 6 of 6 loads fire.
- The same HTML with the `__next_f` scripts moved from the tail of `<body>`
  into `<head>`: 0 of 6 fire.
- Whole-body single-buffer delivery: 3 of 8 fire.
- Warm reloads: 0 fire.

Ruled out by experiment, not by reading: RequireSession and the loader
subtree, the inline theme script (the only DOMContentLoaded diff, covered by
`suppressHydrationWarning` on `<html>`), the state store and every
`useSyncExternalStore` call (each passes a server snapshot), browser state
(the error still fires with `hoasis:last-association` preset, and does not
re-fire when it is deleted), and Supabase (it fires with every Supabase
request hung and no session at all).

## What it cost while it was there

React recovered, so the page was right within about 35 ms, and the visible
symptom, the dark theme being dropped by the recovery re-render, was already
fixed by pull request #8. What remained on every cold load was a wasted full
document render and an error line in every new visitor's console. Both are
gone on 16.4.2.

## Why the retry took two nights

No file in this repo renders the boundary, so the fix had to come from Next.
The first attempt, on 2026-10-14, did not build:

- Turbopack rejects `sentry@0.44.1`'s declaration file (module format
  conflict). A newer Sentry was the answer, and refreshing `@sentry/nextjs`
  pulled `vite@8.2.2`, then `rolldown@1.2.14`, which pins
  `@oxc-project/types@=0.154.0`.
- That pin is what failed. The version was published minutes after the
  attempt, while pnpm's resolver kept serving the older registry metadata (it
  read 0.153.0 as the latest while the registry held 0.154.0). The retry the
  next day resolved it, with no change to the plan: `next` to 16.4.2,
  `pnpm update @sentry/nextjs`, then the harness below.

## How to re-verify after any bump

The harnesses are on this machine under `scripts/.qa/` (gitignored):

```bash
pnpm build
pnpm start -p 3998 &
node scripts/.qa/hydration-frequency.mjs 6 normal
node scripts/.qa/hydration-mutations.mjs 3
```

Sign in with the Treasurer test login button on the first screen the harness
opens. Zero errors across six cold loads is the pass, and a first-400ms
mutation count in the low single digits (not dozens) says React is still
using the server's DOM.
