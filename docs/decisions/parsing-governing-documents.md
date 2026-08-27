# We index governing documents, we do not judge them

Decision taken 2026-08-26. Revisit only with evidence, not with a better model.

## The question

A board uploads a PDF of their CC&Rs. Should the product read it and tell them
who is in violation?

## The answer

No. We extract and index. We never assert a violation from a machine reading of
a governing document.

## Why

**The output is not a suggestion, it is an accusation.** Everything downstream
of "this owner is in violation" is adversarial: a notice, a hearing, a fine, a
lien, occasionally a foreclosure. A recommendation engine that is wrong 5% of
the time is a good recommendation engine. An enforcement engine that is wrong
5% of the time issues a false accusation to one household in twenty, and each
one lands on a neighbour who did nothing.

**The documents are written to be argued over.** CC&Rs are drafted by attorneys
for recording against land, amended in layers across decades, and cross
referenced to sections that were themselves amended. Two provisions routinely
appear to conflict, and the resolution is the hierarchy: the recorded
declaration beats the bylaws, and state law beats both. A parser that reads a
fence height out of Article IX has no way to know that Article XIV amended it in
2019, or that the state has since capped what an association may enforce.

**Selective enforcement is the defence that wins.** The whole reason the
collections ladder in this product runs off the calendar rather than off
whoever the board is annoyed with is that "you sent the notice to him and not to
her" is what loses at a hearing. Auto-detection reintroduces exactly that
problem from the other direction: the machine flags the households it happens to
have evidence about, and the pattern of who gets flagged becomes the association
's enforcement record whether the board intended it or not.

**We would be putting our confidence into their legal record.** A board that
sends a notice because our software told them to has adopted our reading of
their documents as their own. When the owner's lawyer asks which provision was
relied on and why, the honest answer is "a language model matched some text."
That is not a defence. It is discovery.

**And it fails toward harm, not toward nothing.** A missed violation costs the
association a little tidiness. A fabricated one costs a neighbour money and the
board its credibility. The asymmetry is not close.

## What we build instead

The failure this product should fix is not that boards miss violations. It is
that **owners do not know the rules exist.** 46% of HOA homeowners have been
fined, warned or cited, and only 6% name "everybody knows the rules" as a
benefit of association living. An owner who does not know a rule exists cannot
request the approval that would have made their project legal.

So:

1. **Extract and index for search.** Parse an uploaded document into articles
   and sections, and make it searchable in plain words. An owner types "fence"
   and finds the fence rule. This is the whole of the value and none of the
   risk.

2. **Help a board cite correctly.** When a board writes a violation notice, let
   them search their own documents and attach the provision. A notice that
   names the section it relies on is the one that survives a hearing, and
   boards get this wrong constantly. We assist the citation. We do not choose
   it.

3. **Tell a new owner what they are buying into.** Three legislatures
   independently converged on the same list of what a buyer must be warned
   about: flags, solar, signs, parking, home business, rentals, architectural
   approval, and the lien consequence of nonpayment. That list is our schema,
   and it is defensible because it is what statute says buyers must be told.

4. **Show the parse, and let it be corrected.** Extraction is a draft the board
   confirms, not a fact. Anything we could not read confidently is shown as
   unread rather than guessed, because a silently wrong section number is worse
   than a visible gap.

## What would change this

Not a better model. The objection is not accuracy, it is that we would be
inserting ourselves into an adversarial process on the strength of a reading we
cannot defend.

It would take an attorney reviewing each association's extraction, or a
regulator blessing a standard, or the association explicitly adopting our
reading as their own written policy through a recorded vote. Absent one of
those, indexing is the honest ceiling.

## The one place automation is safe

Deadlines, not judgements. "Your reserve study is due in October" is arithmetic
on a date the board entered. "Your neighbour's fence is too tall" is an opinion
about a document we skimmed. The compliance register already does the first,
and that is the correct boundary.
