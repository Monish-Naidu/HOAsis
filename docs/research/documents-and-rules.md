# Governing documents, templates, parsing, and new owner onboarding

Research pass covering four product questions: what the governing documents actually are and
how they rank, whether HOAsis can ship starter templates, how to handle an uploaded PDF of a
declaration, and what a new owner needs on day one.

Everything was fetched on 2026-08-26. Section 6 lists every source with its fetch date.
Section 7 lists what could not be verified. The rule this ran under is the same one that
governs `library-research.md`: no statute number, deadline, percentage, or dollar figure
appears here unless it was read on a source that was actually fetched. Where a claim could
not be pinned to a source, it is marked as unverified rather than smoothed over.

One framing note. This document is written to be read by a volunteer board member, not a
lawyer. Section 2 is drafted so it can drop into the library more or less as is. Sections 3
and 4 are product decisions and are written for us.

---

## 1. Executive summary: the five things that matter

**1. The declaration is the only document recorded against the land, and that is the whole
difference.** The declaration is filed in the county real property records. Recording gives
constructive notice to every later buyer (Cal. Civ. Code § 1213), and the covenants in it are
enforceable equitable servitudes that "inure to the benefit of and bind all owners of separate
interests in the development" (Cal. Civ. Code § 5975(a)). Nobody signs it. It binds anyway,
because it attached to the dirt before the buyer arrived. Articles, bylaws, and rules are
corporate housekeeping by comparison. Every product decision about documents follows from
this one split.

**2. The safe template line is the amendment line.** Anything the board can adopt on its own,
being rules, policies, procedures, committee charters, and letter templates, is safe to ship.
Anything that needs a supermajority owner vote and a county recording, being the declaration,
is not. Colorado enumerates nine policies every association must adopt (C.R.S.
§ 38-33.3-209.5) and California enumerates the rule topics a board may act on (Cal. Civ. Code
§ 4355(a)). Those two lists are, almost exactly, our shippable template catalog. The industry's
own body agrees on the other side of the line: CAI and its College of Community Association
Lawyers published *Guiding Principles for Community Association Governing Documents*, and it
is a resource **for lawyers** containing principles, not model language. If CAI will not
publish model declaration text, we should not either.

**3. Auto-detecting violations from a machine reading of the CC&Rs is a bad idea and we should
not build it.** Full reasoning in section 4. The short version: the best document parser
measured on real regulated documents gets 90.9% of multi-field questions entirely right, and
purpose-built legal RAG systems from LexisNexis and Thomson Reuters, marketed as
"hallucination-free," were measured hallucinating 17% to 33% of the time in a peer-reviewed
study. A violation call is a legal conclusion, not a field extraction. It also cannot save the
board any work, because the notice, cure period, and hearing that follow are mandated by
statute and human either way. What it can do is manufacture selective enforcement and fair
housing exposure at machine speed.

**4. The safe and genuinely valuable version is a confirmed rule catalog with citations.**
Parse the document into articles and sections, index it, and answer "what does the declaration
say about fences" with the quoted text, the section number, and a link to the page image.
Then propose candidate restrictions as *drafts* that a human board member confirms one by one.
Most boards have never had their restrictions in a list. Building that list is the product.
Deciding who broke one is not.

**5. The resale certificate is already the onboarding spec, and it already has a violations
field.** California requires the seller to hand the buyer "a copy or a summary of any notice
previously sent to the owner" about an unresolved violation (Cal. Civ. Code § 4525(a)), and
Texas requires the resale certificate to state violations of the restrictions or bylaws
(Tex. Prop. Code § 207.003). A new owner can inherit an open violation and usually has no idea.
A product that knows the human-adjudicated open items per address can fill that field
correctly, generate the packet in the ten day window the statute allows (Cal. Civ. Code
§ 4530(a)(1); Tex. Prop. Code § 207.003), and tell the new owner on day one what came with the
house. That is the opposite of auto-detection: it reports facts a human already decided.

---

## 2. The document hierarchy, explained plainly

*Library draft. Written for an owner or a new board member.*

### The one sentence version

Your community has four governing documents. They rank. When two of them disagree, the higher
one wins, and state law beats all four.

### The order

California writes the order down in one section, and most states follow the same logic even
where they do not spell it out. Cal. Civ. Code § 4205 says:

- "To the extent of any conflict between the governing documents and the law, the law shall
  prevail." (§ 4205(a))
- The declaration beats the articles of incorporation. (§ 4205(b))
- The articles and the declaration beat the bylaws. (§ 4205(c))
- All three beat the operating rules. (§ 4205(d))

So the stack, top to bottom, is: **law, then the declaration (CC&Rs), then the articles, then
the bylaws, then the rules.**

The order is not arbitrary. It tracks how hard each document is to change and who has to agree
to change it. The thing that is hardest to change sits highest.

### What each document is

**The declaration, usually called the CC&Rs.** This is a recorded land document. It was filed
with the county recorder, normally by the developer before the first house sold. In California
a declaration recorded on or after January 1, 1986 has to contain a legal description of the
development, a statement of what kind of development it is, the association's name, and the
restrictions the developer intended to be enforceable equitable servitudes (Cal. Civ. Code
§ 4250).

**The articles of incorporation.** If your association is incorporated, this is the charter
filed with the Secretary of State. It is short. California requires it to identify the
corporation as an association formed to manage a common interest development under the
Davis-Stirling Act, give the business or corporate office address, and name the managing agent
if there is one (Cal. Civ. Code § 4280). It says the association exists. It does not say much
else.

**The bylaws.** These are the corporation's operating manual. California's nonprofit mutual
benefit corporation law lists what bylaws contain: the number of directors, the time, place,
and manner of calling and noticing members', directors', and committee meetings, director
qualifications and terms, quorum, committees, officers, member admission and expulsion
procedures, and voting requirements above the statutory minimum (Cal. Corp. Code § 7151). If
the question is "how does the association make a decision," the answer is in the bylaws.

**The rules and regulations.** These are what the board adopts. California defines an operating
rule as "a regulation adopted by the board that applies generally to the management and
operation of the common interest development or the conduct of the business and affairs of the
association" (Cal. Civ. Code § 4340).

### Which one binds a new owner, and why

The declaration. Automatically. Nobody asks you to sign it.

Three pieces stack up to produce that result. First, the declaration is recorded in the county
real property records. Second, a recorded instrument is "constructive notice of the contents
thereof to subsequent purchasers and mortgagees" (Cal. Civ. Code § 1213), which means the law
treats you as knowing what it says whether you read it or not. Third, the covenants in it "shall
be enforceable equitable servitudes, unless unreasonable, and shall inure to the benefit of and
bind all owners of separate interests in the development" (Cal. Civ. Code § 5975(a)).

That is why the declaration outranks everything else the association produces. It is not a
contract you entered. It is a restriction that was already attached to the land you bought.

Bylaws and rules bind you too, but through a different door: you became a member of a
corporation, and members are bound by the corporation's governance documents. Cal. Civ. Code
§ 5975(b) handles enforcement of the non-declaration documents separately from the declaration
for exactly this reason.

Recording matters more than most boards realize, and it is not only the declaration.

- **California.** An amendment to the declaration is not effective until it has been approved,
  certified in writing, and "recorded in each county in which a portion of the common interest
  development is located" (Cal. Civ. Code § 4270(a)).
- **Florida.** "An amendment to a governing document is effective when recorded in the public
  records of the county in which the community is located" (Fla. Stat. § 720.306(1)(b)).
- **Texas.** This one catches boards out. Texas defines a "dedicatory instrument" broadly enough
  to include restrictive covenants, bylaws, and "properly adopted rules and regulations" of the
  association (Tex. Prop. Code § 202.001). Then it says the association "shall file all
  dedicatory instruments in the real property records," and that "a dedicatory instrument has no
  effect until the instrument is filed in accordance with this section" (Tex. Prop. Code
  § 202.006). In Texas, an unrecorded rule is not a rule.

### Who can change what

**The declaration: owners, by vote, and then it has to be recorded.** California defaults to a
majority of all members if the declaration does not set a percentage, and requires certification
and recording (Cal. Civ. Code § 4270). Texas defaults to 67% of the total votes allocated to
owners, and if the declaration is silent, 67% of the lots (Tex. Prop. Code § 209.0041). Florida
defaults to two-thirds of the voting interests for any governing document (Fla. Stat.
§ 720.306(1)(b)). Note that all three defaults are different. Whatever your declaration says,
read it before you assume.

**The articles: normally the members, under the state's nonprofit corporation act, and the
change gets filed with the Secretary of State.** In practice this almost never comes up.

**The bylaws: depends on the bylaws.** Some let the board amend, some require a member vote,
and many require a member vote for anything touching voting rights or director removal. This
is the one place where the answer is genuinely in your own document and nowhere else.

**The rules: the board, alone, at a meeting, with notice.** This is the practical lever a board
actually has, and it comes with conditions.

California is the most explicit. A rule is valid and enforceable only if it is in writing, is
"within the authority of the board conferred by law or by the declaration, articles of
incorporation or association, or bylaws," is "not in conflict with governing law and the
declaration, articles of incorporation or association, or bylaws," was adopted in good faith
and in substantial compliance with the statute, and is reasonable (Cal. Civ. Code § 4350).

The board also has to tell people first. It must give general notice of a proposed rule change
"at least 28 days before making the rule change," decide at a board meeting after considering
member comments, and deliver notice of the change within 15 days after making it (Cal. Civ.
Code § 4360(a) through (c)). Emergency rule changes, meaning an imminent threat to public health
or safety or an imminent risk of substantial economic loss, skip the advance notice but expire
after 120 days (§ 4360(d)).

And owners can undo it. Members owning 5% or more of the separate interests can call a special
vote to reverse a rule change (Cal. Civ. Code § 4365(a)). A majority of a quorum reverses it,
and a reversed rule cannot be readopted for one year, although the board may adopt a different
rule on the same subject (§ 4365(d), (f)).

Virginia lands in the same place by a shorter route. The board "shall have the power to
establish, adopt, and enforce rules and regulations with respect to use of the common areas,"
rules "may be adopted by resolution and shall be reasonably published or distributed throughout
the development," and a majority of votes cast at a special meeting "may repeal or amend any rule
or regulation adopted by the board of directors" (Va. Code § 55.1-1819).

The pattern across states: **the board adopts rules alone, but rules are the weakest document,
they must fit inside the declaration, they require notice, and owners can undo them.**

### What belongs where

Boards constantly put things in the wrong document. Two failure shapes account for most of it:
putting something in the declaration that will need to change, and putting something in a rule
that the declaration never authorized.

**Belongs in the declaration.** What an owner owns and what is common area. The obligation to
pay assessments and the association's lien rights. The substantive use restrictions, meaning the
ones that limit what an owner may do with their own lot. The authority to require architectural
approval. Insurance obligations. The amendment procedure itself. CAI's *Guiding Principles*
organizes its 25 sections around exactly this kind of content: use restrictions, insurance,
assessment collections, architectural control.

Rule of thumb: if it takes something away from an owner's property rights, it has to be in the
recorded document, because that is the only document that binds a buyer who never agreed to it.

**Belongs in the articles.** The association's legal name, its status as the entity that manages
this development, and its address (Cal. Civ. Code § 4280). Nothing else. Anything you put here
is hard to change for no benefit.

**Belongs in the bylaws.** Board size, terms, elections, meeting notice, quorum, officer duties,
committees, member meetings (Cal. Corp. Code § 7151). Process, not restrictions.

**Belongs in the rules.** California actually enumerates the topics, in the section that decides
which rule changes get the 28 day notice and the owner reversal right. Cal. Civ. Code § 4355(a)
lists rules relating to:

1. Use of the common area or of an exclusive use common area
2. Use of a separate interest, including any aesthetic or architectural standards
3. Member discipline, including any schedule of monetary penalties
4. Standards for delinquent assessment payment plans
5. Procedures for resolution of disputes
6. Procedures for reviewing and approving or disapproving a proposed physical change
7. Procedures for elections

That is a clean answer to "what is a rule for": the operational detail underneath a restriction
the declaration already created, plus the association's own procedures.

Colorado approaches it from the other end and simply requires the policies to exist. C.R.S.
§ 38-33.3-209.5 requires every association to adopt policies, procedures, and rules on:
collection of unpaid assessments; conflicts of interest; conduct of meetings; covenant
enforcement, "including notice and hearing procedures and the schedule of fines"; inspection and
copying of association records; investment of reserve funds; procedures for adopting and
amending policies; procedures for addressing disputes between the association and owners; and
reserve studies.

**Common misfilings, and what goes wrong.**

- *Fine schedule in the CC&Rs.* Fines change. A schedule in the declaration needs an owner vote
  and a recording to update. California treats the schedule as a board-adopted item distributed
  annually (Cal. Civ. Code § 5850, § 5310(a)), and lists member discipline including the
  schedule of monetary penalties as a rule topic (§ 4355(a)(3)).
- *A new restriction adopted as a rule.* A rule must be "within the authority of the board
  conferred by law or by the declaration, articles of incorporation or association, or bylaws"
  (Cal. Civ. Code § 4350(b)) and must not conflict with the declaration (§ 4350(c)). A board
  cannot invent a restriction the declaration does not support and then enforce it as if it
  were a covenant. If the rule and the declaration disagree, the declaration wins
  (§ 4205(d)) and the rule is not enforceable.
- *Election procedures in the declaration.* They will need to change when the statute changes,
  and now every change costs an owner vote.
- *An amendment adopted but never recorded.* In California and Florida it is not effective
  (Cal. Civ. Code § 4270(a); Fla. Stat. § 720.306(1)(b)). In Texas, an unrecorded dedicatory
  instrument "has no effect" at all (Tex. Prop. Code § 202.006).

### Where state law sits

Above all of it. Cal. Civ. Code § 4205(a) is blunt: to the extent of any conflict between the
governing documents and the law, the law prevails.

This matters more than it sounds, because most declarations are old. A restriction printed in a
1978 declaration that a later statute made unenforceable is still printed there, and it is still
wrong. The text on the page is not the same thing as the rule that applies. Any owner, board
member, or piece of software reading a declaration has to hold both facts at once.

---

## 3. Templates: what we can safely ship, and what we must not

### The precedent question: does anyone publish model documents?

Not really, and the negative result is informative.

CAI, the trade body for the industry, together with its College of Community Association
Lawyers, publishes *Guiding Principles for Community Association Governing Documents: A Resource
for Lawyers*. The title is the finding. It is aimed at attorneys drafting documents for new
communities or in developer transition, and secondarily at boards and managers considering
amendments. It contains 25 sections discussing "the purpose and intent of governing provisions."
It is principles, not model language, and CAI-IL's own summary notes the guidelines "do not
address every issue to be included nor can they be applied without a clear understanding of the
specific community being created."

So the organization with the most standing to publish a model declaration has instead published
a drafting guide for lawyers. That is our answer on the top of the stack.

At the bottom of the stack the picture is different. Colorado, through statute, effectively tells
every association exactly which nine policies it must have (C.R.S. § 38-33.3-209.5), and
California tells every association what must go into an annual policy statement (Cal. Civ. Code
§ 5310(a)) and what topics rules cover (§ 4355(a)). State law itself is producing the template
outline for the board-adopted layer. Filling that outline in is not a novel legal act.

### The liability risk, honestly

Two separate risks, and they need separating because the mitigations differ.

**Risk A: unauthorized practice of law (UPL).** This is a regulatory risk to HOAsis, not to the
board. The definitions are broad. Texas defines the practice of law to include "the giving of
advice or the rendering of any service requiring the use of legal skill or knowledge, such as
preparing a will, contract, or other instrument, the legal effect of which under the facts and
conclusions involved must be carefully determined" (Tex. Gov't Code § 81.101(a)). California is
simply flat: "No person shall practice law in California unless the person is an active licensee
of the State Bar" (Cal. Bus. & Prof. Code § 6125).

A recorded declaration is precisely "an instrument the legal effect of which under the facts and
conclusions involved must be carefully determined."

Two pieces of history define the boundary.

*Quicken Family Lawyer.* Parsons Technology sold software that interviewed the user and produced
a legal document from about 100 forms. A Texas court held it was the practice of law and enjoined
its sale in Texas. The Texas legislature then amended the statute. Today Tex. Gov't Code
§ 81.101(c) says the practice of law "does not include the design, creation, publication,
distribution, display, or sale, including publication, distribution, display, or sale by means
of an Internet web site, of written materials, books, forms, computer software, or similar
products if the products clearly and conspicuously state that the products are not a substitute
for the advice of an attorney."

That is a real safe harbor, and the disclaimer condition is the whole of it. But it is a Texas
statute. Most states have nothing like it.

*Janson v. LegalZoom.* A Missouri federal court found LegalZoom's document preparation service
was not protected self-help. The distinction the court drew is the one that should govern our
design. Per the order as quoted in contemporaneous reporting, "LegalZoom's internet portal offers
consumers not a piece of self-help merchandise, but a legal document service which goes well
beyond the role of notary or public stenographer," and the court contrasted a blank form buyer,
where "the purchaser understood that it was their responsibility to get it right," with
LegalZoom's pitch of "Just answer a few simple online questions and LegalZoom takes over."

**The line is who is understood to be responsible for the output.** A blank template the board
fills in and takes to its own lawyer is a product. A system that takes the board's specific facts
and produces a finished legal instrument, with the implication that the system got it right, is a
service, and in some states that service is UPL.

North Carolina turned that line into a checklist, and it is the most useful compliance artifact
found in this whole research pass. N.C. Gen. Stat. § 84-2.2 exempts a web-based document
preparation site from UPL if, among other conditions:

- the consumer can see the blank template or the final completed document before finalizing a
  purchase;
- **a North Carolina licensed attorney has reviewed each template and all potential variations**;
- the provider communicates that "the forms or templates are not a substitute for the advice or
  services of an attorney";
- the provider discloses its legal name and physical address;
- the provider does not disclaim warranties or limit consumer remedies;
- the provider does not require the consumer to agree to jurisdiction or venue outside North
  Carolina;
- there is a conspicuous process for consumer concerns that refers UPL complaints to the NC State
  Bar;
- the provider registers annually with the NC State Bar (capped at $100 initially, $50 annually).

Note the "does not disclaim warranties or limit consumer remedies" condition. That one has real
commercial teeth and should go to counsel before we launch templates in North Carolina.

**Risk B: the board adopts our template and it is void in their state.** This is the risk that
actually bites the customer, and it is not solved by a disclaimer. It is solved by scoping. A
governing document is a creature of a specific state's act. The amendment defaults alone differ
across the three states checked here: majority of all members in California, 67% in Texas,
two-thirds in Florida. Notice periods, permitted rule topics, and required policies differ too.
A single generic template is wrong somewhere.

### The line

**Ship. Low risk.**

- Rules and regulations on the topics states already enumerate: common area use, aesthetic and
  architectural standards, member discipline and fine schedules, payment plans, dispute
  resolution, architectural review procedure, election procedure (Cal. Civ. Code § 4355(a)).
- The required governance policies: collections, conflicts of interest, meeting conduct, covenant
  enforcement with notice and hearing procedures, records inspection, reserve fund investment,
  policy adoption procedure, dispute resolution, reserve studies (C.R.S. § 38-33.3-209.5).
- Annual policy statement / annual disclosure generators (Cal. Civ. Code § 5310(a) is a literal
  spec).
- Committee charters, particularly architectural review committee charters.
- Correspondence: violation notices, cure letters, hearing notices, delinquency letters, welcome
  letters, architectural approval and denial letters. These are operational documents, they are
  revocable, and in many states the required contents are in the statute.
- Meeting artifacts: agendas, minutes templates, board resolutions.

Why these are safe: the board can adopt them alone, they are not recorded against title in most
states, a bad one is cheap and fast to fix, and in several states the statute already dictates
the contents.

**Do not ship. High risk.**

- Declaration / CC&R text, in any form, including "starter" or "sample" declarations.
- Amendments to the declaration.
- Anything that produces a document intended for county recording.

Why: it is recorded against title, it binds people who never agreed to it, it requires a
supermajority owner vote, the vote thresholds and permitted content vary by state, an error takes
another owner vote and another recording to unwind, and it sits squarely inside every state's
definition of an instrument whose legal effect must be carefully determined.

**Gray zone. Ship a gap analysis, not text.**

- Bylaws. They are corporate rather than recorded in most states, but they are recorded in Texas
  (Tex. Prop. Code §§ 202.001, 202.006), they interact with each state's nonprofit corporation
  act, and a generic set can be void or unusable. The right product here is a **bylaws checklist**:
  read the board what their bylaws do and do not cover against the state's list, flag the gaps,
  and hand the gap list to their attorney. That delivers most of the value with none of the
  drafting.

### Guardrails if we ship any templates

1. Every template carries a conspicuous statement that it is not legal advice and not a
   substitute for an attorney, visible in the app and baked into the exported file. This is the
   entire Texas safe harbor (§ 81.101(c)) and a named condition in North Carolina (§ 84-2.2).
2. A licensed attorney in each state we claim coverage for reviews each template and each
   variation before it ships. North Carolina requires this for NC; adopting it everywhere is the
   cheap way to be defensible everywhere.
3. Templates are state-scoped, never national. If we do not have a reviewed version for a state,
   we do not show one.
4. Show the blank template before purchase or adoption.
5. Never auto-adopt. The board reads it, edits it, and takes the board action. The product records
   that the board adopted it; it does not adopt anything.
6. Never take the board's specific facts and emit a finished legal instrument as an answer. That
   is the Janson line.
7. Take the "no warranty disclaimer, no remedy limitation" condition in N.C. Gen. Stat. § 84-2.2
   to counsel before enabling templates in NC, and register with the NC State Bar if we do.

### What competitors do

<!-- COMPETITORS -->

---

## 4. Parsing uploaded governing documents

### What we are actually up against

A declaration is not a clean PDF. In the common case it is a scan of a document recorded at a
county recorder decades ago, sometimes photographed off microfilm, with a recording stamp, a
legal description, exhibits, and plat pages. Then there are the amendments, each a separately
recorded instrument, each replacing or adding to specific sections of the original.

The document set problem is bigger than the OCR problem. The operative restriction is very often
"Section 5.3, as amended by the Fourth Amendment recorded in 1998." A system that reads only the
original declaration reads a superseded rule and reads it confidently.

### A realistic approach

**Stage 1: get the text.** Born-digital PDFs have a text layer; take it. Scans need OCR plus a
layout model. Vision-capable models now handle stamps, multi-column pages, and typewriter fonts
substantially better than classical OCR.

**Stage 2: recover structure.** Declarations are numbered legal prose, which is the friendly case.
The signals are strong and regular: `ARTICLE V`, `Section 5.3`, `(a)`, `(i)`, indentation,
all-caps headings, running headers. Build a tree of article, section, subsection. The existing
standard for exactly this shape of document is OASIS LegalDocML / Akoma Ntoso, which standardizes
XML markup for legislative, judicial, and contract documents and includes a URI syntax for legal
citation. We do not need to adopt the standard, but its model, being a nested structure plus a
stable citation identifier per node, is the right shape and it is worth stealing.

**Stage 3: keep provenance on every node.** Every section stores its source page and, ideally, its
bounding box. Every answer the product ever gives can then link back to the page image. This is
not a nice-to-have; it is what makes the whole feature defensible.

**Stage 4: model the document set, not the document.** Record instrument number, recording date,
county, and document type per file. Model amendments as edits: this instrument replaces Section
5.3, adds Section 5.9, deletes Article XI. Present the consolidated current text with each
section labeled by which instrument last touched it.

This fourth stage is the highest-value and least-discussed piece. It is a records problem rather
than a judgment problem, the accuracy bar is achievable, and the failure mode is visible rather
than silent. Most boards genuinely do not know which version of their own restrictions is current.

**Stage 5: index for retrieval, with citation-first answers.** Never paraphrase without the quote.
Answer with the quoted text plus the section number plus the page link.

**Stage 6: extract definitions separately.** Declarations define terms, and the defined terms carry
the meaning. A restriction on "Structures" is meaningless without the definition of "Structure."
The definitions article should be a first-class object that other sections link to.

### What accuracy to expect

Two measurements are directly relevant, and both are sobering.

**Document parsing.** RealDocBench (arXiv 2606.07401, June 2026) evaluated 18 systems on 581 real
regulated documents across mortgage, finance, supply chain, and medical, with 1,356 field-level
questions and a separate 1,500 page layout track. Results for the top systems:

| System | Per-field | Per-question | Cost/page | Latency |
| --- | --- | --- | --- | --- |
| Extend Performance v2 | 96.0% | 90.9% | $0.040 | 13.7 s |
| LlamaParse (Agentic) | 92.2% | 84.5% | $0.0125 | 23.7 s |
| Reducto (Agentic) | 91.4% | 83.8% | $0.060 | 23.0 s |
| Gemini 3.5 Flash | 89.3% | 82.2% | $0.0113 | 18.9 s |
| Azure Document Intelligence | 89.1% | 79.6% | $0.010 | 6.5 s |
| AWS Textract | 70.7% | 54.0% | $0.015 | 4.7 s |

Best layout adjusted F1 was 0.835 across 1,500 pages.

The number that matters is **per-question**, meaning every field in the answer correct at once,
because a violation determination needs the restriction, the exception, the definition, and the
approval carve-out all read correctly together. Best case is 90.9%. Roughly one in eleven
multi-part reads has at least one thing wrong in it. The spread across systems is also large,
which means "we use a good parser" is a real engineering decision, not a checkbox.

Caveat, stated plainly: RealDocBench was authored by Extend AI, whose own system tops it. The
paper acknowledges this and publishes its harness. Treat the absolute numbers as approximate and
the ordering as vendor-influenced. Treat the *shape* of the result, being a ten point gap between
per-field and per-question accuracy, as the real finding.

**Legal question answering.** Magesh, Surani, Dahl, Suzgun, Manning, and Ho, *Hallucination-Free?
Assessing the Reliability of Leading AI Legal Research Tools*, Journal of Empirical Legal Studies
(accepted 14 March 2025), Stanford RegLab. This is the closest published analogue to "read the
governing documents and answer a legal question."

The systems tested were Lexis+ AI, Westlaw AI-Assisted Research, and Ask Practical Law AI: purpose
built retrieval-augmented systems, over curated proprietary legal corpora, from LexisNexis and
Thomson Reuters, and marketed at the time as eliminating or avoiding hallucination.

Findings:

- The tools "each hallucinate between 17% and 33% of the time."
- Lexis+ AI, the best performer, answered 65% of queries accurately.
- Westlaw AI-Assisted Research was accurate 42% of the time and hallucinated nearly twice as
  often as the other legal tools tested.
- Ask Practical Law AI gave incomplete answers on more than 60% of queries.

The definition of hallucination is the part to internalize. A response is hallucinated "if it is
either incorrect or misgrounded." Misgrounded means "key factual propositions are cited but the
source does not support the claim." So a confident answer with a real-looking section citation
attached, where the section does not actually say that, counts. That is exactly the failure mode
a board member cannot catch, because the citation looks like verification.

### Failure modes specific to CC&Rs

- **Superseded text.** The single largest correctness risk. Reading an original declaration
  without its amendments produces confident, wrong answers.
- **Scan quality.** Old recorded documents, microfilm artifacts, recording stamps over text,
  handwritten marginalia.
- **Defined terms.** Missing the definitions article silently changes the meaning of every
  restriction that uses a capitalized term.
- **Exceptions and conditions.** "No fence over six feet, except with prior written approval of
  the Architectural Committee." Dropping the exception inverts the answer.
- **Cross-document references.** The declaration authorizes; the rules specify; the bylaws set the
  procedure. Any one of them read alone is incomplete.
- **Provisions that are void.** Declarations frequently contain restrictions that later law made
  unenforceable. Cal. Civ. Code § 4205(a) puts the law above the documents, so the printed text is
  not the answer. A parser has no way to know this from the document.
- **Exhibits and plats.** Maps, site plans, and legal descriptions that carry meaning but not text.

### Auto-violation detection: recommendation

**Do not build it. Not as a beta, not behind a flag, not with a confidence score.**

Six reasons, in order of how much they matter.

**1. It is a legal conclusion, not an extraction.** "Does the declaration contain the string
'no boats'" is a retrieval question and we can do it well. "Is this owner in violation" requires
knowing whether the provision is enforceable under current law (Cal. Civ. Code § 4205(a)), whether
a rule is within the board's authority and consistent with the declaration and reasonable (Cal.
Civ. Code § 4350), whether an exception or approval applies, and whether the association's own
past conduct has waived the provision. Those are judgment calls a community association attorney
makes. Machine reading answers a different question and presents it as the same one.

**2. The accuracy ceiling is not close to good enough.** See above. Best-in-class multi-part
document reading is around 90% and purpose-built legal RAG hallucinates 17% to 33% of the time,
with the dominant failure being a wrong answer wearing a plausible citation.

**3. It saves the board nothing, because the enforcement process is statutory and human anyway.**
Texas requires written notice by certified mail that describes the violation, states any amount
due, tells the owner they may cure a curable violation, gives a cure deadline that is "a
reasonable period," and tells them they may request a hearing within 30 days (Tex. Prop. Code
§ 209.006). The hearing has to happen within 30 days of the request, and the association must give
the owner "a packet containing all documents, photographs, and communications relating to the
matter" (Tex. Prop. Code § 209.007). If the owner cures before the cure period expires, "a fine
may not be assessed for the violation" (§ 209.006).

California requires at least 10 days' written notice of the meeting, a description of the alleged
violation, an opportunity to be heard, an opportunity to cure, and written notice of the decision
within 14 days, and § 5855(g) makes the discipline ineffective if the board does not comply.
Penalties are capped at the lesser of the scheduled amount in effect at the time of the violation
or $100 per violation, absent a documented health or safety finding (Cal. Civ. Code § 5850).

Every one of those steps requires a human to look at the property, decide, and write. The machine
cannot remove any of them. It can only put a wrong accusation at the front of an expensive,
mandatory, adversarial process aimed at somebody's neighbor.

**4. It manufactures selective enforcement.** An automated detector enforces whatever it can
observe, which means front yards over back yards, photographed streets over unphotographed ones,
owners who upload pictures over owners who do not. Uneven enforcement by construction. Uneven
enforcement is the classic defense: waiver, estoppel, and selective enforcement all turn on the
association tolerating the same conduct elsewhere. The canonical selective enforcement case is
*White Egret Condominium, Inc. v. Franklin*, 379 So. 2d 346 (Fla. 1979), where children were
prohibited in one unit and tolerated in others. A product that dramatically increases detection
volume without increasing detection *evenness* hands owners that defense and hands the board its
own audit trail proving it.

**5. Fair housing exposure, and it lands on the board, not on us.** The Fair Housing Act makes it
unlawful to discriminate "in the terms, conditions, or privileges of sale or rental of a dwelling,
or in the provision of services or facilities in connection therewith" on protected grounds (42
U.S.C. § 3604(b)), and HUD's regulation specifically prohibits "limiting the use of privileges,
services or facilities associated with a dwelling" on protected grounds (24 C.F.R. § 100.65(b)(4)).
The Act also requires "reasonable accommodations in rules, policies, practices, or services, when
such accommodations may be necessary to afford such person equal opportunity to use and enjoy a
dwelling" (42 U.S.C. § 3604(f)(3)(B)).

A text-matching detector does not know that the ramp is an accommodation, that the animal is a
service animal, that the item on the doorframe is religious, or that the toys in the yard belong
to a protected family. It flags them all. And 24 C.F.R. § 100.7(b) makes a person "vicariously
liable for a discriminatory housing practice by the person's agent or employee, regardless of
whether the person knew or should have known of the conduct." The board cannot point at the
software.

**6. It is the exact failure this product is positioned against.** HOAsis exists because two
screens should never disagree about the same number. A machine-generated accusation that turns out
to be wrong is the worst possible version of that, because the counterparty is a neighbor who now
has a letter from the board in their hand.

### The safe version, in four tiers

**Tier 1: extract, structure, index, search. Ship it.** The board asks "what do our documents say
about fences," and gets the quoted section text, the citation, and a link to the page image.
Answers are quotes plus citations, never paraphrase alone. If the OCR could not read page 34, the
product says page 34 is unreadable rather than answering around it. Confidence is expressed as
"read" or "not read," not as a percentage.

**Tier 2: a rule catalog, human-confirmed. Ship it, and this is the actual product.** The system
proposes candidate restrictions from the text as *drafts*, each carrying the quoted source text and
its citation. A board member reviews each one and confirms, edits, or rejects it. Nothing enters
the catalog without a human accepting it. The output is the thing almost no board has: a plain
list of what the restrictions actually are, in order, with the source text behind each entry.
Every subsequent feature keys off the confirmed catalog, never off the raw parse.

**Tier 3: notice generation from the confirmed catalog, with a human gate. Ship carefully.** When a
human opens a violation case and picks a catalog entry, the product drafts the notice: the quoted
provision, the section citation, and the statutory elements for that state (cure deadline, hearing
rights, amount, delivery method). The product never decides that a violation occurred. It formats
a decision a human made.

**Tier 4: automated determination that a specific owner is in violation. Do not build.** From text
matching, from uploaded photos, from cameras, from drones. No.

**Cross-cutting: version and supersession tracking.** Instrument number, recording date, county,
which sections each amendment touched, and which version is current. Boring, hard, valuable, and
safe.

---

## 5. New homeowner onboarding

### What is legally required at closing

Every state that regulates associations makes somebody hand the buyer a packet. The details vary,
the shape does not: the governing documents, the money, and the problems.

**California.** The seller has to give the prospective purchaser, as a hard requirement, the
following (Cal. Civ. Code § 4525(a)):

1. A copy of all governing documents, plus a written statement if the association is not
   incorporated
2. A statement about age-related occupancy restrictions and their enforceability
3. A copy of the most recent annual disclosure documents distributed under Article 7 (§ 5300 et
   seq.)
4. A written statement from an association representative of current regular and special
   assessments, unpaid fees, liens, and collection costs
5. **"A copy or a summary of any notice previously sent to the owner pursuant to Section 5855"**,
   meaning any unresolved governing document violation
6. A copy of the initial list of construction defects under § 6000, with exceptions for settled
   matters
7. A copy of the latest information under § 6100
8. Any board-approved assessment or fee changes not yet due
9. A statement describing any rental or leasing prohibition
10. Board meeting minutes from the previous 12 months, on request
11. The most recent inspection report under § 5551 (the balcony and elevated element inspection)

The association's job is the supply side: on written request it must provide those documents
"within 10 days of the mailing or delivery of the request" (Cal. Civ. Code § 4530(a)(1)).

**Texas.** On written request the association must deliver, within 10 business days, the current
restrictions applying to the subdivision, the current bylaws and rules, and a resale certificate
prepared no earlier than 60 days before delivery (Tex. Prop. Code § 207.003). The certificate has
16 required items, including any right of first refusal and transfer restrictions, regular
assessment frequency and amount, approved special assessments coming due, unpaid amounts owed to
the association, capital expenditures and reserves, the current operating budget and balance
sheet, unsatisfied judgments and pending lawsuits, insurance, **violations of the restrictions or
bylaws**, code violation notices from a governmental authority, administrative transfer fees, the
managing agent's contact details, and "a statement indicating whether the restrictions allow
foreclosure."

**Annual, not just at closing: California's annual policy statement.** Cal. Civ. Code § 5310(a)
lists what every member gets every year, and it reads like a welcome packet specification: the
person designated to receive official communications; how to request notices at up to two
addresses; where general notices are posted; the right to receive general notices by individual
delivery; the right to receive meeting minutes; the assessment collection policy statement
required by § 5730; the association's lien and default enforcement practices; the discipline
policy including the fine schedule under § 5850; a summary of dispute resolution procedures; **a
summary of any requirements for association approval of a physical change to property** under
§ 4765; and the overnight assessment payment address.

Item ten there is the one new owners most need and least often see.

<!-- ONBOARDING_STATES -->

### What new owners get fined for

<!-- ONBOARDING_VIOLATIONS -->

The structural reason is worth stating even where survey data is thin. The documents are delivered
at closing, in a stack, in the same week as the loan documents and the inspection report and the
move. Nobody reads a 60 page recorded declaration at that moment. And the law does not require
them to: recording alone is constructive notice (Cal. Civ. Code § 1213), which means an owner is
legally treated as knowing the contents whether or not they ever opened the file. The gap between
"legally on notice" and "actually knows" is the entire onboarding problem, and it is where fines
come from.

### Welcome packet best practice

<!-- ONBOARDING_PACKET -->

### What HOAsis should actually do with this

The statutes above are a feature spec, and three things fall out of them.

**One: the disclosure packet is a generated artifact, not a filing cabinet.** California gives the
association 10 days (§ 4530(a)(1)); Texas gives 10 business days and requires the certificate to
be no more than 60 days old (§ 207.003). Both packets are assembled from data the product already
holds: the documents, the assessment balance, approved but not yet due changes, and open
violations. Generating it on demand, dated and complete, is straightforward and is the highest
value thing we can do with the documents we already store.

**Two: open violations transfer, and nobody tells the buyer.** California requires the seller to
pass along any unresolved § 5855 violation notice (§ 4525(a)); Texas requires violations of the
restrictions or bylaws in the certificate (§ 207.003). If the product knows the human-adjudicated
open items per address, it can fill that field correctly and, separately, tell the new owner on
day one what came with the house. This is the version of "the documents know something about you"
that is safe: it reports decisions humans already made, not conclusions a model drew.

**Three: onboarding should teach the approval reflex, not the rule list.** The single highest
value sentence for a new owner is that exterior changes need approval before the work starts.
California already requires the association to describe its approval requirements annually
(Cal. Civ. Code § 5310(a), § 4765), and § 4765 requires the procedure to be "fair, reasonable, and
expeditious," decisions to be in writing, denials to give reasons and describe reconsideration,
and the association to notify members annually of the requirements. An onboarding flow that ends
with the owner having submitted nothing but knowing where the architectural request form is has
done its job.

---

## 6. Sources, with fetch dates

All fetched 2026-08-26.

### Primary: statutes and regulations

- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4205 ,
  Cal. Civ. Code § 4205, hierarchy of governing documents, law over documents, declaration over
  articles, articles and declaration over bylaws, all over operating rules
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4250 ,
  Cal. Civ. Code § 4250, contents of a declaration recorded on or after Jan 1 1986
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4270 ,
  Cal. Civ. Code § 4270, amendment of the declaration, approval, certification, recording in each
  county, majority of all members default
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4280 ,
  Cal. Civ. Code § 4280, contents of articles of incorporation, filed with the Secretary of State
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4340 ,
  Cal. Civ. Code § 4340, definition of operating rule and rule change
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4350 ,
  Cal. Civ. Code § 4350, five requirements for a valid operating rule
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4355 ,
  Cal. Civ. Code § 4355, which rule topics are subject to notice and reversal, and which are excluded
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4360 ,
  Cal. Civ. Code § 4360, 28 day notice before a rule change, 15 day notice after, 120 day emergency rules
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4365 ,
  Cal. Civ. Code § 4365, 5% of separate interests may call a special vote to reverse a rule change
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4525 ,
  Cal. Civ. Code § 4525, documents an owner must give a prospective purchaser
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4530 ,
  Cal. Civ. Code § 4530(a)(1), association must provide § 4525 documents within 10 days of written request
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4765 ,
  Cal. Civ. Code § 4765, fair reasonable and expeditious architectural approval, written decisions,
  reconsideration, annual notice of requirements
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5310 ,
  Cal. Civ. Code § 5310(a), twelve required contents of the annual policy statement
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5850 ,
  Cal. Civ. Code § 5850, schedule of monetary penalties, annual distribution, $100 cap absent a
  documented health or safety finding
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5855 ,
  Cal. Civ. Code § 5855, 10 day notice, hearing, cure opportunity, 14 day decision notice, and
  § 5855(g) making non-compliant discipline ineffective
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5975 ,
  Cal. Civ. Code § 5975, declaration covenants are enforceable equitable servitudes binding all owners
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1213 ,
  Cal. Civ. Code § 1213, recorded conveyance is constructive notice to subsequent purchasers
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CORP&sectionNum=7151 ,
  Cal. Corp. Code § 7151, contents of nonprofit mutual benefit corporation bylaws
- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=6125 ,
  Cal. Bus. & Prof. Code § 6125, no person shall practice law in California unless an active
  licensee of the State Bar
- https://texas.public.law/statutes/tex._prop._code_section_202.001 , Tex. Prop. Code § 202.001,
  definition of dedicatory instrument, includes bylaws and properly adopted rules
- https://texas.public.law/statutes/tex._prop._code_section_202.006 , Tex. Prop. Code § 202.006,
  all dedicatory instruments must be filed in county real property records, no effect until filed
- https://texas.public.law/statutes/tex._prop._code_section_207.003 , Tex. Prop. Code § 207.003,
  subdivision information and resale certificate, 10 business days, 60 day certificate age, 16 items
- https://texas.public.law/statutes/tex._prop._code_section_209.006 , Tex. Prop. Code § 209.006,
  certified mail notice before enforcement, description of violation, right to cure, reasonable
  cure period, 30 days to request a hearing
- https://texas.public.law/statutes/tex._prop._code_section_209.007 , Tex. Prop. Code § 209.007,
  hearing within 30 days, association must provide a packet of all documents, photographs, and
  communications relating to the matter
- https://texas.public.law/statutes/tex._prop._code_section_209.0041 , Tex. Prop. Code § 209.0041,
  67% default to amend a declaration, lower percentage in the declaration controls
- https://texas.public.law/statutes/tex._gov't_code_section_81.101 , Tex. Gov't Code § 81.101(a) and
  (c), definition of the practice of law, and the software and forms safe harbor conditioned on a
  clear and conspicuous statement that the product is not a substitute for the advice of an attorney
- https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_84/GS_84-2.2.html ,
  N.C. Gen. Stat. § 84-2.2, conditions under which web-based document preparation is not UPL,
  including NC attorney review of each template and all variations and annual State Bar registration
- http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0700-0799/0720/Sections/0720.306.html ,
  Fla. Stat. § 720.306(1)(b), two-thirds default to amend any governing document, amendment
  effective when recorded in the county public records
- https://law.lis.virginia.gov/vacode/title55.1/chapter18/section55.1-1819/ , Va. Code § 55.1-1819,
  board power to adopt common area rules by resolution, publication requirement, majority of votes
  cast at a special meeting may repeal or amend
- https://codes.findlaw.com/co/title-38-property-real-and-personal/co-rev-st-sect-38-33-3-209-5.html ,
  C.R.S. § 38-33.3-209.5, nine required responsible governance policies
- https://www.law.cornell.edu/uscode/text/42/3604 , 42 U.S.C. § 3604(b), (c), (f)(2), (f)(3)(B),
  Fair Housing Act discrimination in terms conditions and privileges, and reasonable accommodations
- https://www.law.cornell.edu/cfr/text/24/100.65 , 24 C.F.R. § 100.65, including (b)(4) limiting the
  use of privileges services or facilities associated with a dwelling
- https://www.law.cornell.edu/cfr/text/24/100.7 , 24 C.F.R. § 100.7, direct liability and
  § 100.7(b) vicarious liability for an agent's discriminatory housing practice regardless of knowledge

### Cases

- https://blog.ericgoldman.org/archives/2011/08/missouri_federa_1.htm , Eric Goldman,
  Technology & Marketing Law Blog, quoting the order in *Janson v. LegalZoom.com, Inc.*,
  802 F. Supp. 2d 1053 (W.D. Mo. 2011), on the self-help merchandise versus legal document
  service distinction
- https://www.floridacondohoalawblog.com/2022/03/30/three-common-covenant-enforcement-defenses-waiver-estoppel-and-selective-enforcement/ ,
  Becker, Florida Condo & HOA Law Blog, on waiver, estoppel, and selective enforcement, citing
  *White Egret Condominium, Inc. v. Franklin*, 379 So. 2d 346 (Fla. 1979)

### Research and benchmarks

- https://arxiv.org/pdf/2606.07401 , *RealDocBench: A Benchmark for Field-Level QA and Layout
  Understanding on Real-World Regulated Documents*, Extend AI, arXiv 2606.07401, June 2026.
  Per-field and per-question accuracy, layout adjusted F1, cost and latency for 18 systems
- https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf and
  https://arxiv.org/abs/2405.20362 , Magesh, Surani, Dahl, Suzgun, Manning, Ho,
  *Hallucination-Free? Assessing the Reliability of Leading AI Legal Research Tools*,
  Journal of Empirical Legal Studies, accepted 14 March 2025. 17% to 33% hallucination rates,
  65% and 42% accuracy figures, definition of hallucination as incorrect or misgrounded

### Industry

- https://blog.caionline.org/guide-for-drafting-association-governing-documents/ , CAI blog on
  *Guiding Principles for Community Association Governing Documents: A Resource for Lawyers*,
  25 sections, principles rather than model language, audience is attorneys plus boards and managers
- https://www.cai-illinois.org/guiding-principles-for-community-association-governing-documents/ ,
  CAI Illinois summary of the same resource, including the caveat that the guidelines cannot be
  applied without understanding the specific community
- https://foundation.caionline.org/research/statistical-review/ , Foundation for Community
  Association Research Fact Book 2025: 373,000 community associations, 78.1 million residents,
  35.2% of US housing
- https://www.oasis-open.org/committees/tc_home.php?wg_abbrev=legaldocml , OASIS LegalDocML /
  Akoma Ntoso, XML standard for legislative, judicial, and contract documents, OASIS Standard 2018

<!-- COMPETITOR_SOURCES -->

<!-- ONBOARDING_SOURCES -->

---

## 7. What could not be verified

**Read in secondary sources, not in the primary source.**

- *UPLC v. Parsons Technology*, 179 F.3d 956 (5th Cir. 1999). The Fifth Circuit PDF on
  ca5.uscourts.gov could not be extracted and Justia returned 403. The history described here,
  being the district court injunction against Quicken Family Lawyer followed by the Texas
  legislature's amendment, comes from search result summaries. **The load-bearing fact, the text
  of Tex. Gov't Code § 81.101(c), was read directly and is reliable.** The case history is
  background and should not be cited without pulling the opinion.
- *Janson v. LegalZoom*, 802 F. Supp. 2d 1053 (W.D. Mo. 2011). Quotations come from Eric Goldman's
  blog reproducing the order, not from the order itself.
- *White Egret Condominium v. Franklin*, 379 So. 2d 346 (Fla. 1979). Citation and holding come from
  a law firm blog, not from the opinion.
- Texas Property Code sections. statutes.capitol.texas.gov now serves its statute text through
  JavaScript, and both WebFetch and a direct curl returned only the navigation shell. All Texas
  citations here were read on texas.public.law, which reproduces statute text but is not the
  official Texas Legislature site. **Re-verify every Texas section against the official site before
  any of this becomes user-facing content.** In particular the § 207.003 fee caps ($375 assembly
  and delivery, $75 update, 7 business day update turnaround) should be treated as unconfirmed.
- C.R.S. § 38-33.3-209.5 was read on codes.findlaw.com, not on a Colorado state site.

**Could not be fetched at all.**

- caionline.org returned 403 on the press room and governing documents pages. Only the CAI blog and
  the CAI Illinois chapter page were reachable, so the description of *Guiding Principles* rests on
  those two summaries rather than the resource itself. Whether CAI sells any actual fill-in template
  documents to members behind its paywall is **not established**.
- HUD's assistance animal notice (FHEO-2020-01) returned 404 at two URL paths. No HUD guidance was
  read directly. The fair housing analysis here rests on the statute (42 U.S.C. § 3604) and the
  regulations (24 C.F.R. §§ 100.7, 100.65), which were read directly.
- ecfr.gov redirects to an interstitial and could not be read; the CFR text above came from Cornell
  LII.
- uniformlaws.org's community page did not surface UCIOA text.

**Not researched or not established.**

- Whether courts have squarely held that an HOA or condominium association is a covered "housing
  provider" under the Fair Housing Act. The statutory language reaches "any person" discriminating
  in the terms, conditions, or privileges of sale or rental and in the provision of services or
  facilities, and the DOJ page describing FHA scope returned 403. **The direction of the law here is
  well settled in practice but is not cited to a source in this document.**
- The claim that old declarations commonly contain racially restrictive covenants that are void but
  still printed. Widely reported, not verified here.
- FCC OTARD preemption of satellite dish restrictions. Not verified here.
- The WebSearch budget for this session was exhausted partway through, so several planned searches,
  particularly on AI-driven HOA violation detection products and drone-based community inspection,
  were not run. The market scan in section 3 is therefore narrower than intended.
