# Onboarding, one question at a time (2026-09-03)

Monish's ask: the setup checklist should be a conversation. Answer one
thing, the page moves to the next. Anything an association does not have
(a vendor, a pool, a builder to name) can be skipped or left empty.

## Shape

Two flows, one engine (`src/components/app/question-flow.tsx`).

1. **Founding** (`/start`, `setup-wizard.tsx`). Twelve questions, each on
   its own screen: account, name, place, dues, kind of homes, shared spaces,
   who is setting up, anything else billed, which home is yours, who built
   it (only when there is a builder), the homes, the bank. The last one
   creates the association and lands on the plan.
2. **The plan** (`/start/plan`, `setup-plan.tsx`, `SetupFlow`). Opens on a
   welcome screen that says what exists and, for a handover or a builder,
   what the first weeks are about. Then each setup task is a question with
   its answer on the spot: connect a bank, upload a document, add a budget
   line, a vendor, an officer, an amenity, the photo. Forward skips
   questions the records already answer.

`/board/setup` (`SetupOverview`) is the status page for a later visit: each
task, why it applies to this association, done or not, and a link that
opens the flow at that question (`/start/plan?task=key`).

## Rules

- Skipping is always labelled ("Nothing shared", "Just dues", "Not sure
  yet", "Skip for now") and never blocks. A task's own statement of absence
  ("We do not pay any vendors") is recorded through `dismissSetupTask` and
  drops the task from the plan; `buildPlan` takes the dismissed set.
- Continue is enabled by the records, never by a tick: a task is done when
  the thing exists.
- Motion: leave fast (`--dur-fast`, ease-in), enter settled (`--dur-base`,
  `--ease-out-soft`), direction follows travel. Reduced motion gets the end
  state.
- Enter continues on questions of one or two fields.
- Questions are tracked by id, not index, so the list can change shape
  (the account question drops out when a session arrives).

## Second pass, same day

Monish walked it and asked for four things, all in:

- "Just dues" is the first card on the billing question, not a way past it.
- The founder gives their home address; the lot or unit number is the
  second field and keys the register. Stored on the unit (migration 0024).
- "Who is setting this up?" has three doors: builder, taking over from the
  builder, already running it. The third asks where they are coming from
  (a management company, another platform, nothing yet) and will not move
  on without an answer. Stored as `associations.previously`; the porting
  plan on the welcome screen changes with it.
- The closing list's "Do this" links work: the plan remounts on `?task=`.
  The dashboard's setup line opens the next open question directly; the
  overview stays under Getting started in the sidebar.

## Number and address, 2026-09-04

Monish asked whether a home should have an address or a unit number. Both,
on the record; one required, by who is asking:

- The number keys the register on every path, because the homes screen
  builds the roster from number ranges and the founder's own home has to
  match one of them. Condominiums keep a number forever; on a subdivision
  it is the lot on the plat, which deeds and liens cite.
- The address is required when the association is already running (every
  home has one) and optional from a builder or a handover, because the
  county assigns addresses closer to closing. Requiring it there stalls
  setup on a fact nobody has.
- Whichever field the founder knows comes first and takes focus.
- Nothing migrates when the address arrives. It is a blank field filling
  in; the number stays as the permanent key. Until then a home reads as
  "Lot 12" or "Unit 12" in the community's own words.

Still to do: let a buyer confirm or enter the address when they accept
their invite, and let the board edit it on the home record.

## Not done

- Skips within a visit are not remembered; the overview is the record.
- The invites question links out; there is no inline way to give an
  existing household an email.
