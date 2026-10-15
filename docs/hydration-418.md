# Hydration error #418: the cause

Minified React error #418 (hydration mismatch) has fired on cold loads of
board pages since the product went to production builds. This page is the
whole finding, so it can be pasted upstream and re-verified after any
Next.js bump.

## What fires and what does not

Against a production build of this app, on a machine with a warm disk cache:

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

## What it costs today

React recovers, so the page is right within about 35 ms. The visible symptom,
the dark theme being dropped by the recovery re-render, was already fixed by
pull request #8. What remains is a wasted full document render on a cold
load, and an error line in every new visitor's console.

## Why it is not fixed in this repo

No file here renders the boundary; the fix has to come from Next.js. The
first try was bumping Next 16.3.1 to 16.4.1, and it did not build:

- Turbopack rejects `sentry@0.44.1`'s declaration file (module format
  conflict), and a newer Sentry cannot be installed right now: refreshing
  `@sentry/nextjs` pulls `vite@8.2.2`, then `rolldown@1.2.14`, which pins
  `@oxc-project/types@=0.154.0`, a version that was never published.

So the next step is the upstream report below, or a 16.4.1 retry once the
chain above is publishable.

## How to re-verify after any bump

The harness is on this machine under `scripts/.qa/` (gitignored):

```bash
pnpm build
pnpm start -p 3998 &
node scripts/.qa/hydration-frequency.mjs 6 normal
```

Sign in with the Treasurer test login button on the first screen the harness
opens. Zero errors across six cold loads is the pass.

## The report to send upstream

Title: Hydration error #418 from the streaming metadata boundary on every
cold first load, prerendered routes, Next 16.3.1

Body:

Next.js 16.3.1, React 19.2.8, all routes prerendered (`next build` shows
`○` for every page), served with `next start`.

On the first full load of any route in a fresh browser, hydration throws
minified React error #418 about 30 ms in, React discards the document and
renders the client tree, and the page is correct from then on. The second
load in the same browser does not fire. `next dev` does not fire.
Client-side navigation does not fire. Deterministic: 8/8 on one route,
6/6 on a second, 4/4 on a third.

The served HTML is byte-identical between loads that fire and loads that
clean. The mismatch is inside the streaming metadata boundary: the server
emits `<div hidden><!--$--><!--/$--></div>` at the top of `body` (the
boundary's title and meta are hoisted to `head`), while the flight payload
that resolves `Next.Metadata` sits in the inline `__next_f.push` scripts at
the tail of `body`. The flight reader resolves those scripts on microtasks
while hydration walks in scheduler tasks, and on a cold load the walk wins
the race.

Moving only the `__next_f` scripts from the tail of `body` into `head`
(serving the same HTML, nothing else changed) makes the error disappear:
0/6 with the move, 6/6 without. Single-buffering the whole body makes it
fire less (3/8). That points at the read timing rather than the markup.

Expected: hydration waits for, or tolerates, a metadata boundary whose
flight content has not been read yet. Actual: `throwOnHydrationMismatch`
throws #418 from `canHydrateInstance` returning null at the boundary.
