# New communities, and no migrations

Decision taken 2026-08-26. Replaces the previous positioning, which was
self-managed associations leaving a management company.

## The question

Who is the customer, and what does onboarding have to accept?

## The answer

**New construction, and the handover that follows it.** A builder standing an
association up before the homes sell, and the owners who take control of it at
turnover. An established association is supported as a third path, but as a
fresh start rather than as a migration.

**Nothing imports a spreadsheet or reads an export from another product.** Not
as a missing feature. As a decision.

The onboarding step names all three and says what each one changes, because a
person choosing between three cards should be choosing on consequences rather
than on which description sounds most like them. Somebody who is none of these
should find that out on that screen rather than four screens later.

## Why new construction

**The failure is designed in, and it is designed in by one identifiable
person.** The builder sets the first budget, records the covenants, and decides
what goes into reserves. Low dues in year one make the homes easier to sell,
and the board that inherits that budget finds out in its second winter, when
it has to raise dues in its first month. Selling into an established
association means arriving after every one of those decisions has been made.

**Reserves are the whole argument, and a new build is the easiest possible case
to get right.** Everything is new, so remaining useful life is full useful life
and the costs are the builder's own invoices rather than an estimate. Every
other association in the country is guessing at a twelve year old roof. Around
74% of US associations are underfunded, and no competitor in the category
produces a funding plan at all.

**A builder is one relationship that produces many communities.** An
association is one customer that churns when the board turns over. A builder
doing four subdivisions a year is a different shape of business entirely, and
the product they hand over becomes the product the owners keep.

## Why no imports, ever

**A file format is a promise about somebody else's data.** Accepting a roster
export means accepting whatever the last product wrote, forever, including the
version they changed last quarter. The parser we removed was already handling
quoted commas, header rows, unknown column orders and semicolon separators, and
it still could not have handled a real ledger.

**Reproducing a history is where migrations stall, and the copy is never
right.** An association carrying a decade of assessments, payments, late fees,
waivers and corrections cannot have that reproduced faithfully by anybody,
including them. What actually matters is that the balance is right on the day
they start billing here.

**So one figure per home replaces all of it.** `/admin/homeowners/opening-
balances` takes what each household owed on the switch date and writes it onto
the statement as "Balance brought forward", dated. Everything before that day
stays where it is. That is a number a treasurer can read off their own
statement, and it is defensible in a way that an imported ledger is not,
because they typed it.

**And it does not set standing.** A typed figure says what is owed and says
nothing about how long it has been owed. Turning it into "collections" would
drop a household onto the enforcement ladder on their first day here on the
strength of an inference, and the reason that ladder is defensible at a hearing
is that it runs off the calendar rather than off a judgement.

## What was removed

- `parseRoster` and the CSV upload in onboarding, with their tests
- `recordsDemandLetter` and the letter writer on the plan
- The `self-managed` and `leaving-manager` plans
- Marketing copy positioning the product against a management contract as the
  primary frame

Homes now come from the plat instead: a builder types the lot ranges by phase
and every lot exists from day one, sold or not. An unsold lot is not vacant.
The builder owns it and owes the assessment on it, and a roster that leaves
those out is a budget that is short and a quorum threshold that is wrong.

## What would change this

A builder telling us they will not adopt something their buyers inherit, or
enough established associations arriving that the third path is the business
rather than an accommodation. Neither is a file format problem, so neither
would be solved by building an importer.
