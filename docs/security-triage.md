# Code scanning triage

The fourteen alerts GitHub code scanning had open on `main`, each one read
in the code before it was judged. Written 2026-10-15 against commit
`93056ca`, on the branch `security/codeql-alerts`. Three were fixed here,
the rest are false positives or risks that are bounded by their callers.
The reason is written down for each one, so the dismissal on GitHub can be
made from this page.

Where an alert's line number and the code disagree, the line in the code is
the one written here, and the alert's own number is named as well.

## 1. Request forgery in the cron continuation (critical, fixed)

`js/request-forgery`, reported at `src/lib/cron.ts:66`.

`scheduleContinuation` built the URL for the next call out of
`request.nextUrl` and sent the caller's `authorization` header with it, the
header that carries `CRON_SECRET`. A spoofed Host header could aim that
fetch, secret included, at a machine of the attacker's choosing.

How far that goes today: each route that calls it returns 401 unless the
request already carries the right Bearer secret, before any work is done
(`src/app/api/email/bills/route.ts:43`, `src/app/api/billing/sweep/route.ts:52`,
`src/app/api/autopay/run/route.ts:68`,
`src/app/api/assessments/run/route.ts:34`). So an attacker needs the secret
in hand first, and the header they get sent back is their own. The fix is
still worth making: a secret that leaks once should not then be forwardable
to any host the attacker names.

What was done: the host of the constructed URL is checked against an
allowlist before anything is fetched (`continuationAllowed` at
`src/lib/cron.ts:88`, the guard at `:103`). Vercel's own hostnames are
always allowed: `vercel.app` and any `*.vercel.app`. A deployment that is
not on Vercel names itself in `CRON_ALLOWED_HOSTS`, comma separated
(`continuationHosts` at `:66`), which is the hook the Azure Container App
needs when it arrives; `.env.example` documents the variable beside
`CRON_SECRET`.

A refused continuation fetches nothing, so no run is lost: the next
scheduled run starts from the top and the rows it missed are only delayed a
day, the same failure mode the file already documents for a fetch that
fails. Tests in `tests/unit/cron-batch.test.ts`: Vercel's hosts, a named
host, a host that only ends the same way, a string that is not a URL, and
that the continuation callback is never reached for a refused host.

## 2. Dynamic method call in the log route (high, fixed)

`js/unvalidated-dynamic-method-call`, reported at `src/app/api/log/route.ts:83`.

`log[level](...)` called a logger method through a string taken from the
request body. The value was already narrowed on line 53 to `warn`, `info`
or `error`, all three of which are real logger methods, so there was
nothing to inject. It was still the wrong shape: no reader can see which
functions can run. It is now an explicit choice of the function
(`src/app/api/log/route.ts:85`), and the alert goes with it.

## 3. The password printed by the seed scripts (two high, false positive)

`js/clear-text-logging` at `scripts/seed-demo.mjs:386` and
`scripts/seed-playground.mjs:1609`. The value CodeQL follows is `PASSWORD`,
printed at `scripts/seed-demo.mjs:395` and `scripts/seed-playground.mjs:1615`.

Both prints are the last thing a seeding run does, and they are the
feature: the demo password is shared by every account the run creates, and
the operator needs it to sign in. Each script says so in its own header,
and `scripts/seed-demo.mjs` refuses to run at all unless `ALLOW_TEST_RESET`
is true and `TEST_RESET_PROJECT_REF` names the project it may empty
(`scripts/seed-demo.mjs:41` and `:59`). Neither script runs in the app, in
a route or in a cron. Nothing to fix: an operator who cannot read the
password cannot use the seeded data.

## 4. Math.random in the seed and verification scripts (seven high, accepted)

`js/insecure-randomness` at `scripts/lib/harness.mjs:61`,
`scripts/seed-demo.mjs:86`, `scripts/seed-playground.mjs:44`,
`scripts/seed-ten-years.mjs:49`, `scripts/verify-five-years.mjs:49` and
`scripts/verify-ranked-list.mjs:16`. The alert list names
`verify-ranked-list.mjs:33` and `:40`; the only `Math.random` in that file
is line 16. One more site in the scripts was not alerted,
`scripts/seed-playground.mjs:1021`, which mints a receipt code for the
seeded playground ballot.

Every one of them generates a password:

| Site                                | What the value is                                                 |
| ----------------------------------- | ----------------------------------------------------------------- |
| `scripts/lib/harness.mjs:61`        | for users the same run deletes in `cleanupAll`                    |
| `scripts/verify-ranked-list.mjs:16` | the same, for the two users that file deletes                     |
| `scripts/seed-demo.mjs:86`          | the shared demo password, printed at `:395`                       |
| `scripts/seed-playground.mjs:44`    | the shared playground password, printed at `:1615`                |
| `scripts/seed-ten-years.mjs:49`     | the QA password for accounts kept for testing, printed at `:2427` |
| `scripts/verify-five-years.mjs:49`  | the same, printed when the run is kept, at `:1879`                |

No change was made, for one reason: where a person needs the value the
script prints it on purpose, and a printed value has no unpredictability
left to protect. Where it is not printed, the accounts are deleted when the
run ends. `SEED_PASSWORD` overrides the two demo passwords and
`scripts/rebuild-supabase.sh` sets it, so the generated value is a fallback
for an ad hoc run. Nobody outside the process can predict `Math.random`
output, and inside the process the password is in the terminal already.

If these should be closed by code rather than dismissed,
`randomBytes(4).toString("hex")` from `node:crypto` replaces the
`Math.random().toString(36)` slice at each site, one line each. That is a
sweep of seven scripts, and it belongs in one pass of its own rather than
half of one here.

## 5. Tag stripping that is not HTML (two high, false positive)

`js/incomplete-multi-character-sanitization` at
`src/lib/email/templates.ts:395` and `scripts/setup-resend.mjs:143`.

`src/lib/email/templates.ts:395` strips tags for the plain text part of a
message. That part is not HTML and is never rendered as HTML; the comment
above the escaping helper says so at `:399`. A partial strip cannot inject
anything into text, and stripping once is what keeps the wording readable.
No change.

`scripts/setup-resend.mjs:143` removes a `Name <address>` display name from
the From value before it is sent to Supabase as `smtp_sender_name` (the
request body is `:134` to `:150`), and the value is read back and printed at
`:169`. It becomes an SMTP header on mail Supabase sends, never HTML. No
change.

## 6. Regexes that can backtrack (three high, one fixed)

`js/polynomial-redos` at `src/lib/input-checks.ts:195`, `src/lib/log.ts:78`
(the pattern is used at `:88`) and `src/lib/meetings/video.ts:21` (the two
patterns are at `:23` and `:24`).

`src/lib/input-checks.ts`: the pattern in `isEmail` was reported because
nothing in the function bounds its input. The length cap lived in one
caller, `emailProblem`, but `isEmail` is exported and six other callers do
not cap: `src/lib/app-state/use-people.ts:919`, `src/lib/roster/csv.ts:328`,
`src/app/api/auth/signup/route.ts:51`, `src/app/api/auth/resend/route.ts:45`,
`src/app/board/homeowners/owner-forms.tsx:8` and
`src/app/join/join-panel.tsx:343`. A pasted spreadsheet cell or a request
body can be long, so the cap moved into the function
(`src/lib/input-checks.ts:198`), which is also correct validation: longer
than 254 characters is not an email address. `emailProblem` no longer
repeats the check. Tests in `tests/unit/walk-validation.test.ts`, including
the 254 character boundary and two long adversarial strings.

`src/lib/log.ts`: the same shape, on a string that is being logged. It is
quadratic at worst in the length of the string, and every string that
reaches it has already been cut by the caller: the route that takes text
from a browser keeps the message to 500 characters and the stack to 4000
(`src/app/api/log/route.ts:49` and `:76`). Bounded by its callers, no
change.

`src/lib/meetings/video.ts`: `roomSlug` runs on an association id, a
meeting id and an optional pinned room name. No screen sets a pinned room
name, so in practice the inputs are ids of a few dozen characters. Bounded
by its callers, no change.

## The alerts that stay open

What remains open, each dismissed with the reason above: the two password
prints in the seed scripts (intended, dev only), the `Math.random`
passwords in the scripts (printed on purpose, or deleted with the run), the
two tag strips (neither one is HTML), and the two regexes whose callers
bound their input.

Dismissing them on GitHub with that reason is the honest close. They are
not silent risk: the reasoning is written here, next to the code it is
about, and the ones that were real are fixed on this branch. If one of them
becomes real later, a seed password that is no longer printed, a strip that
starts feeding HTML, a string that reaches `isEmail` past the cap, the
dismissal should be reopened rather than trusted.
