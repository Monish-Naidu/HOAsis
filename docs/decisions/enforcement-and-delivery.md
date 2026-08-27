# A complaint is not a notice, and email is not always delivery

Two decisions taken 2026-08-26, recorded together because they are the same
instinct applied twice: the product does not let a board believe it has done
something it has not.

## Residents can report, and a report can never be a notice

**The question.** Should residents be able to report a neighbour, and if so,
what happens to the report?

**The answer.** Yes, and it goes to the board privately as an *input to an
investigation*. It cannot become a notice until a board member has gone and
looked and written down what they saw. The reporter's name is held and never
shown to the accused.

**Why.** Every management company and enforcement attorney publishing guidance
on this converges on the same rule, and one puts it bluntly: a board cannot act
on a complaint unless somebody signs it. The softer version is that evidence
gets gathered by the association before any notice exists. A notice resting on
a neighbour's account is one the neighbour has to defend at a hearing, which is
the position nobody wants a complainant in and the reason boards that do it
stop receiving reports.

So `canRaiseNotice` requires a verification note, `raiseNoticeFromReport`
refuses without one in the state layer rather than only in the screen, and the
raised notice carries none of the reporter's words. There is deliberately no
button anywhere that promotes a report into a violation.

**Why it is not anonymous.** No state researched bans an anonymous complaint to
an association; Florida's ban binds municipal code inspectors. But a board that
cannot tell one neighbour's twelve reports from twelve neighbours' one cannot
see the pattern that matters. `reportingPatterns` surfaces one household
repeatedly reporting the same neighbour, because where the two households
differ in a way the Fair Housing Act cares about, that pattern is the beginning
of a complaint against the association rather than against either of them. The
trade is stated to the reporter on the form: we know who you are, and the
household you report never does.

**The positioning note.** HOALife ships resident reporting and does not market
it: forty-four blog posts, none about neighbour complaints, anonymity or
selective enforcement, and their own enforcement post describes the workflow as
manager-driven. Nobody in the category will say out loud how this should work.

## Photographs carry where they were taken from

`Violation.photoCount` was a number. A count tells the board how many
photographs exist and tells the accused household nothing, which is backwards:
the whole of due process here is the owner seeing the case before answering it.
So the count became records, and the same viewer serves both sides.

Each photograph carries a **vantage**. The privacy question in enforcement
photography is not whether a photograph exists, it is where the photographer
was standing: a bin at the curb shot from the sidewalk and the same yard shot
over a fence are different acts, and in several states a different legal one.
`photoConcerns` flags the second kind before a notice goes out rather than
leaving it to be raised at the hearing. It does not block. The association may
well have the right to the photograph; what it should not do is find out late.

## Not every notice may go every way

**The question.** Text and in-app did not exist. What should be built?

**The answer.** The rules first, the plumbing second. `src/lib/delivery.ts`
holds which notices may travel which channel, and the screen says so before a
board writes anything.

**Why the rules are the hard half.** Sending a lien warning by email works. The
message goes, the board believes it gave notice, and the defect appears at the
point somebody is losing a house over it. Failures that look like successes are
the ones worth engineering against, so where paper is the notice the product
says the electronic copy is a courtesy and refuses to record it as delivery.

**Text is gated, not offered.** Two separate gates, both real.

- **Consent.** The TCPA turns on prior express consent for an automated text to
  a mobile number. Having somebody's phone number is not consent, and neither
  is a line in the CC&Rs. An opt out stops it that day, with no override
  anywhere in this product.
- **Registration.** Application-to-person traffic on a ten digit number has to
  be registered with The Campaign Registry, brand and campaign, which needs the
  association's EIN. Unregistered traffic is filtered by the carriers silently.
  A send button that appears to work and delivers nothing is worse than no
  button, so SMS is off until all three are in place and the screen lists them.

Quiet hours are 8am to 9pm local and are not waivable by consent.

**What is still open.** The state-by-state question of exactly which notices
require certified mail is not answered here, and should not be: that belongs in
the compliance register, where a row can carry a citation. The rules in
`delivery.ts` are the shape of the duty, not a jurisdiction's version of it.
