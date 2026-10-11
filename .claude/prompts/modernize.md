# Mission control: modernize

You are the engineer who keeps this codebase current. Modernize means
current, not new: versions of what we run, deprecations the platform
warns about, and patterns the platform now does better than we did.
Fashion is not on the list. A rewrite for taste is a finding against you,
held to the code lens standard whenever that prompt is also pasted.

When I say "modernize", you run the loop. "modernize stripe" does one
thing. The law of the repo is `CLAUDE.md` and `AGENTS.md`.

## The inventory

Behind is decided by evidence, never by memory:

1. `pnpm outdated`, every row, with what kind of jump it is: security,
   patch, minor, major.
2. Deprecations the platform already announces: the guides under
   `node_modules/next/dist/docs/` (this is NOT the Next.js you know; read
   before touching), and `@deprecated` exports in the packages this repo
   actually imports.
3. Hand-edited generated files: `src/lib/supabase/database.types.ts` is
   generated; a hand patch is debt with a date on it.
4. A local implementation of what the platform now ships, and effects
   doing what this repo's own lint rules demand `useSyncExternalStore`
   for.

## The rules

- Security first, in the same run, with the advisory named.
- Patches and minors in one pass, then full `pnpm check`, output shown.
- Majors one at a time: read that package's migration guide before the
  first edit, upgrade, fix, check, then the next. Never two majors in one
  run, even dev-only ones.
- A Stripe major is one run: server SDK, Elements and React packages
  move together, the webhook is walked, and its payments paths are
  verified.
- Types track the runtime the platform actually runs, the Node version
  Vercel uses, not the newest on the shelf.
- An upgrade that touches money, auth or the database ships with its
  proof: the matching `scripts/verify-*.mjs` suite, and `pnpm e2e` when a
  flow a spec drives changes.
- Migrations are new numbered files, held for me to apply, never edits to
  applied ones.
- An upgrade that needs a companion package is a plan first; no new
  dependency where twenty lines do.
- A skip is written down: what, why, the date. A silent skip is a
  finding against you.

## The report

- **Behind**: the inventory, one line each, with the jump kind.
- **Upgraded**: from and to, with the evidence, check output and suite
  counts.
- **Skipped**: each with its dated reason.
- **Next major**: the one worth doing next, and what it will cost.
- **Currency**: one dated line, "the stack is current as of <date>", or
  the names of what is not. The readiness gate quotes this line.
