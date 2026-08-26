# Violations, enforcement, and resident communications

Research for HOAsis. Written 26 August 2026.

Every legal claim below links to a source that was actually opened and read. Where a
claim could not be verified, it is listed in the last section instead of being softened
into the body. Nothing here is legal advice; it is the research a product team needs to
decide what to build.

Statutes are quoted for eight states. They do not agree with each other. That is the
central fact of this whole document.

---

## 1. Executive summary: what this should change in the product

**Nine decisions.**

1. **A violation record must carry the rule it breaks as a field, not as free text.**
   Arizona and Nevada both require the association to state the specific governing
   document provision. Every other state's hearing process turns on it in practice.
   Make `ruleId` required on a violation, and make the notice render the rule text.

2. **The notice/cure/hearing/fine chain must be a state-configurable state machine, not a
   hardcoded one.** Texas requires certified mail and a 30-day window to request a
   hearing. Florida requires 14 days' notice and a hearing before a three-member
   committee that has no officers, directors, or employees on it. Colorado requires two
   consecutive 30-day cure periods and caps the total at $500. Virginia caps a single
   offense at $50. Nevada caps at $100 per violation and $1,000 per hearing. These are
   not variants of one flow; they are different flows.

3. **Photos belong on the notice, not just in the board's file.** Nevada requires the
   notice to include "a clear and detailed photograph" of the alleged violation. Texas
   requires the association to hand the owner every document and photograph it intends to
   use, at least 10 days before the hearing. Build the owner-visible evidence view first
   and the board's internal gallery second.

4. **Let the owner submit photo proof of a cure.** Colorado makes this legally operative:
   if the owner sends "visual evidence that the violation has been cured," the violation
   is deemed cured on the date the owner sent it. That is a one-screen feature with a
   direct statutory payoff.

5. **Do not build anonymous neighbor reporting.** Arizona requires the association to
   disclose "the first and last name of the person or persons who observed the violation"
   when the owner contests. An anonymity promise the product cannot keep is worse than no
   promise. Full reasoning in section 4.

6. **Do build a "report a concern" path that is explicitly not a violation.** A resident
   report should create a *concern*, visible only to the board, which a board member must
   convert into a violation by inspecting it themselves. The concern and the violation are
   two different records. This is the single most important modeling decision in this
   document.

7. **Track who reports whom.** Repeat-reporter and repeat-target patterns are a fair
   housing exposure, not a curiosity. 24 CFR 100.7(a)(1)(iii) makes an association
   directly liable for failing to stop a third party's discriminatory conduct it knew or
   should have known about and had the power to correct. A reporting feature manufactures
   the "should have known." Show the board the pattern.

8. **Statutory notices cannot be email-only in several states, so the product must be able
   to produce a mail packet.** Texas: certified mail. Virginia: hand delivery or
   registered/certified mail, return receipt requested. Colorado: certified mail, return
   receipt requested. Florida is the outlier that expressly permits the owner's
   "designated mailing or e-mail address." Print-and-mail export, or a mail vendor
   integration, is a requirement and not a nice-to-have.

9. **SMS is a real project, not a checkbox.** A2P 10DLC registration, consent capture, and
   opt-out handling are all mandatory before a single text sends. Costs and burden are in
   section 7. The honest framing for a 50-home board: texting is cheap per message and
   expensive in setup, and the setup is HOAsis's job, not the board's.

**The strategic point.** The competitive analysis flagged violation tracking as table
stakes we lack. It is table stakes, but the way to win it is not feature parity. Every
competitor treats a violation as a task with a photo attached. The research says a
violation is a *legal record with a due process clock on it*, and that almost nothing in
the market models the clock. A board that gets the sequence wrong loses the fine. That is
the wedge.

---

## 2. Where violations come from, and the due process chain

### 2.1 The three sources

Industry guidance consistently names three ways a violation is found:

- **Board member or manager inspection.** A scheduled drive-through of the community,
  usually monthly or quarterly, with photos taken from the street.
- **Management company patrol**, which is the same thing done by a paid vendor.
- **Neighbor complaints.**

ManageCasa's enforcement guide puts it plainly: "Violations are typically identified
through routine property inspections, complaints from other residents, or reports
submitted to the management company."
([managecasa.com](https://managecasa.com/articles/hoa-violations-and-enforcement-the-complete-process-guide),
fetched 26 Aug 2026)

**On proportions: no source found gives a number.** Several vendor blogs assert that
neighbor complaints are "most" violations. None cites a survey. The Foundation for
Community Association Research runs a Homeowner Satisfaction Survey of 3,000 homeowners
across six editions from 2016 to 2026
([foundation.caionline.org](https://foundation.caionline.org/research/survey_homeowner/homeowner-satisfaction-survey-dashboard/),
fetched 26 Aug 2026), but its published findings are behind an interactive dashboard and
do not surface a complaint-source breakdown. Treat any percentage you see quoted on this
as unsourced.

For scale: 373,000 community associations in the US, 78.1 million residents, 35.2% of US
housing.
([foundation.caionline.org statistical review](https://foundation.caionline.org/publications/factbook/statistical-review/),
Fact Book 2025, fetched 26 Aug 2026)

### 2.2 The chain, and what is legally required before a fine

The general shape is the same everywhere: **courtesy notice → cure period → formal notice
of hearing → hearing → decision → fine**. What varies is which steps are mandatory, how
many days each takes, who sits on the panel, and how the paper has to travel.

Almost universally, a fine requires **notice and an opportunity to be heard before an
impartial decision maker**. Colorado states the principle in statute better than anyone:

> The policy includes a fair and impartial fact-finding process concerning whether the
> alleged violation actually occurred and whether the unit owner is the one who should be
> held responsible for the violation. This process may be informal but shall, at a
> minimum, guarantee the unit owner notice and an opportunity to be heard before an
> impartial decision maker.
>
> C.R.S. 38-33.3-209.5(2)(b)(I)

Colorado then defines "impartial decision maker" as someone with no "direct personal or
financial interest in the outcome," excluding the benefit shared with the general
membership. (Same section, (2)(b)(II).)
([colorado.public.law](https://colorado.public.law/statutes/crs_38-33.3-209.5), fetched
26 Aug 2026)

### 2.3 The eight states, side by side

| State | Notice delivery | Cure period | Days before hearing | Who hears it | Fine cap |
| --- | --- | --- | --- | --- | --- |
| **Texas** | Certified mail, required | "Reasonable period," no fixed number | Owner has 30 days after mailing to request; hearing within 30 days of request; 10 days' notice of hearing date | The board | Not capped by statute |
| **Florida** | Owner's "designated mailing or e-mail address" | Cure at any point before hearing kills the fine | 14 days | Committee of 3+, no officers, directors, employees, or their spouse/parent/child/sibling | $100/violation, $1,000 aggregate; under $1,000 cannot become a lien |
| **California** | Personal delivery or individual delivery under Civ. Code 4040 | Cure before the meeting bars discipline | 10 days | The board | $100/violation unless the board makes written health/safety findings in an open meeting |
| **Colorado** | Certified mail, return receipt requested | 30 days, then a second 30 days | Not specified; "informal" process allowed | "Impartial decision maker" | $500 total per violation; no daily fines |
| **Nevada** | Mailed to the unit and to any address the owner specified | "Reasonable opportunity"; 14 days before it becomes a continuing violation | "Reasonable opportunity to prepare" | Board, or a committee of 3+ if the documents allow | $100/violation, $1,000 per hearing |
| **Virginia** | Hand delivery, or registered/certified mail, return receipt requested | "Reasonable opportunity to correct" | 14 days | Board or other tribunal named in the documents | $50 single offense, $10/day continuing, max 90 days |
| **Arizona** | Not specified for the notice itself | Not specified | Owner responds within 21 days by certified mail; association replies within 10 business days | Board, plus a state administrative hearing option | Not capped; late charge on a penalty capped at greater of $15 or 10% |
| **North Carolina** | Not specified | Fine may start 5 days after the decision | Not specified | "Adjudicatory panel," appealable to the full board within 15 days | $100/day after 5 days |
| **Washington** | Not specified; the bylaws supply the procedure | Not specified | Not specified | The board, or "the representative designated by the board" | Not capped; must follow "a previously established schedule... furnished to the owners" |

Sources for the table, all fetched 26 Aug 2026:
Texas [209.006](https://texas.public.law/statutes/tex._prop._code_section_209.006) and
[209.007](https://texas.public.law/statutes/tex._prop._code_section_209.007);
Florida [720.305](https://www.flsenate.gov/Laws/Statutes/2024/720.305);
California [5850](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5850)
and [5855](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5855);
Colorado [38-33.3-209.5](https://colorado.public.law/statutes/crs_38-33.3-209.5);
Nevada [NRS 116.31031](https://www.leg.state.nv.us/NRS/NRS-116.html);
Virginia [55.1-1819](https://law.lis.virginia.gov/vacode/title55.1/chapter18/section55.1-1819/);
Arizona [33-1803](https://www.azleg.gov/ars/33/01803.htm) and
[33-1242](https://www.azleg.gov/ars/33/01242.htm);
North Carolina [47F-3-107.1](https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47F/GS_47F-3-107.1.html);
Washington [RCW 64.38.020](https://app.leg.wa.gov/RCW/default.aspx?cite=64.38.020) and
[RCW 64.90.405](https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.405).

**Washington, since Mehr Meadows is there.** Washington does not prescribe a delivery
method or a day count. It sets three floors, and the bylaws fill in the rest. RCW
64.38.020 lets an association, "after notice and an opportunity to be heard by the board of
directors or by the representative designated by the board of directors and in accordance
with the procedures as provided in the bylaws or rules and regulations adopted by the board
of directors, levy reasonable fines in accordance with a previously established schedule
adopted by the board of directors and furnished to the owners." RCW 64.90.405, which
governs communities created on or after 1 July 2018, uses nearly identical language.

So in Washington the **fine schedule has to exist and have been given to owners before the
violation**, the same substantive point Nevada makes explicitly. A Washington board that
invents a fine amount at the hearing loses.

### 2.4 Five details worth building around

**Texas: the hearing evidence packet.** This is the most product-relevant provision found
anywhere.

> Not later than 10 days before the association holds a hearing under this section, the
> association shall provide to an owner a packet containing all documents, photographs,
> and communications relating to the matter the association intends to introduce at the
> hearing.
>
> Tex. Prop. Code 209.007(f)

And if the association misses it, "an owner is entitled to an automatic 15-day
postponement of the hearing" (209.007(g)). The board also has to present its case first
(209.007(h)).

**Texas: curable vs uncurable is defined by statute.** 209.006(g) through (i) list
examples. Curable: parking, maintenance, unapproved construction, an ongoing barking dog.
Uncurable: fireworks, a one-time noise violation, property damage, an unauthorized garage
sale. The distinction controls whether a cure period is owed at all. This is a field on
the rule, not a judgment call at notice time.

**Florida: cure kills the fine, twice.** 720.305(2)(e): "If a violation has been cured
before the hearing or in the manner specified in the written notice... a fine or
suspension may not be imposed." And the committee's role is narrow: "limited to
determining whether to confirm or reject the fine or suspension levied by the board"
(720.305(2)(c)). If the committee does not approve by majority vote, no fine.

**Florida: some rules cannot be fined at all.** 720.305(7) bars fines for leaving garbage
receptacles out within 24 hours of collection, and for holiday decorations left up beyond
the documents' limit unless they stay up more than a week after written notice. A rule
catalog should be able to flag a rule as unenforceable in a given state.

**Nevada: the rule has to have been published to the owner 30 days before the violation.**

> The executive board may not impose a fine... unless: (a) Not less than 30 days before
> the alleged violation, the unit's owner... had been provided with written notice of the
> applicable provisions of the governing documents that form the basis of the alleged
> violation.
>
> NRS 116.31031(4)(a)

A newly adopted rule is unenforceable in Nevada for its first 30 days. The product should
know a rule's effective date and refuse to cite it before then.

### 2.5 Citing the rule: what happens if you do not

Two states require it in the notice or the follow-up:

- **Arizona.** When an owner contests a violation notice by certified mail, the
  association must reply within 10 business days with, among other things, "the provision
  of the community documents that has allegedly been violated." Until it does, "the
  association shall not proceed with any action to enforce the community documents,
  including the collection of attorney fees." A.R.S. 33-1803(D)(1) and (E). The condominium
  statute, A.R.S. 33-1242(C)(1), is identical.
- **Nevada.** A notice to cure "must... include an explanation of the applicable provisions
  of the governing documents that form the basis of the alleged violation." NRS
  116.31031(1)(c)(1).

Everywhere else the requirement is functional rather than express. Florida requires "a
description of the alleged violation" and "the specific action required to cure such
violation" (720.305(2)(b)). Texas requires the notice to "describe the violation"
(209.006(b)(1)). Colorado requires "the nature of the alleged violation, the action or
actions required to cure the alleged violation, and the timeline"
(38-33.3-209.5(2)(c)(I)).

**What happens at a hearing without a citation.** The owner asks which rule they broke.
If the board cannot point to one, the enforcement fails on the merits, because a fine has
to rest on a covenant or a rule that actually exists and actually says that. There is also
a construction question, and it does not resolve the same way everywhere. Texas has
legislated against the common-law instinct:

> A restrictive covenant shall be liberally construed to give effect to its purposes and
> intent.
>
> Tex. Prop. Code 202.003(a)
> ([texas.public.law](https://texas.public.law/statutes/tex._prop._code_section_202.003),
> fetched 26 Aug 2026)

So a vague covenant is easier for a Texas association to enforce than the general rule
would suggest. That does not help a board that cited nothing at all, and it does not
transfer to other states.

Practical read for a board: **cite the section, quote the sentence, in the first notice.**
It costs nothing and it removes the single easiest defense.

---

## 3. Neighbor reporting: what the market does

*Pending.*

---

## 4. Neighbor reporting: the recommendation

**Recommendation: yes to resident reporting, no to anonymity, and no to a resident report
ever becoming a violation without a board member looking at it first.**

Three separate decisions, and they are usually collapsed into one. Taking them apart is the
whole answer.

### 4.1 Anonymity: do not promise it, because in some states you cannot keep it

Arizona has legislated this directly. When an owner contests a violation notice, the
association has ten business days to answer, and the answer must include:

> 1. The provision of the community documents that has allegedly been violated.
> 2. The date of the violation or the date the violation was observed.
> 3. **The first and last name of the person or persons who observed the violation.**
> 4. The process the member must follow to contest the notice.
>
> A.R.S. 33-1803(D)
> ([azleg.gov](https://www.azleg.gov/ars/33/01803.htm), fetched 26 Aug 2026)

The condominium statute is word for word identical at A.R.S. 33-1242(C).
([azleg.gov](https://www.azleg.gov/ars/33/01242.htm), fetched 26 Aug 2026)

Until it complies, "the association shall not proceed with any action to enforce the
community documents, including the collection of attorney fees." A.R.S. 33-1803(E).

So in Arizona, an association that acts on an anonymous tip has two options once the owner
pushes back: name the observer, or drop the enforcement. A product that promised the
reporter anonymity has put the board in the position of breaking a promise to one member in
order to keep a statutory duty to another.

**Texas gets to the same place by a different route.** The evidence packet under Tex. Prop.
Code 209.007(f) is "all documents, photographs, and communications relating to the matter
the association intends to introduce at the hearing." A neighbor's written complaint is a
communication relating to the matter. If the board wants to rely on it, the owner sees it.
If the board does not want to rely on it, then the complaint was never the evidence and the
board's own observation was, which is the model recommended below anyway.

**The general principle, independent of any statute:** an accusation the accused cannot see
is not something they can answer, and every state's process is built on an opportunity to
be heard. Colorado's phrasing is the clearest: "a fair and impartial fact-finding process
concerning whether the alleged violation actually occurred and whether the unit owner is the
one who should be held responsible." C.R.S. 38-33.3-209.5(2)(b)(I).

**What to build instead of anonymity.** Two words that are not the same word:

- **Not published.** The reporter's name is not shown to the accused owner in the portal, is
  not printed on the notice, and is not read out at a meeting.
- **Not confidential.** The reporter's name is recorded, is visible to the board, and will
  be disclosed if a hearing, a statute, or a subpoena requires it.

The submit form should say this in one sentence, before the person types anything: *We
record who reports. We do not put your name on the notice. If this goes to a hearing, or if
state law requires it, your name may be disclosed.* Anyone unwilling to report on those
terms is telling you something useful about the report.

### 4.2 The board should see who reported, and should see the pattern

Two fair housing exposures run in opposite directions, and a reporting feature sits between
them.

**Acting on complaints can create liability.** Under 24 CFR 100.7(a)(1)(iii) a person is
directly liable for "failing to take prompt action to correct and end a discriminatory
housing practice by a third-party, where the person knew or should have known of the
discriminatory conduct and had the power to correct it," with the scope of the duty set by
"the extent of the person's control or any other legal responsibility."
([law.cornell.edu](https://www.law.cornell.edu/cfr/text/24/100.7), fetched 26 Aug 2026)

Harassment under the Fair Housing Act includes hostile environment harassment: unwelcome
conduct "sufficiently severe or pervasive as to interfere with" the use and enjoyment of a
dwelling, judged on "the nature of the conduct, the context..., the severity, scope,
frequency, duration, and location." No economic or psychological injury is required. 24 CFR
100.600. And unlike employment law, the Title VII affirmative defense to vicarious liability
for hostile environment harassment does not apply in housing.
([law.cornell.edu](https://www.law.cornell.edu/cfr/text/24/100.600), fetched 26 Aug 2026)

Put those together. A campaign of repeated complaints by one owner against one neighbor,
targeting a protected characteristic, can be harassment. An association with a reporting
tool that logs every one of those complaints cannot say it did not know.

**Not acting on complaints can also create liability.** The same doctrine cuts the other
way, and community association counsel say so. Hirzel Law's Michigan blog, writing on when
an HOA should step into a neighbor dispute, puts it bluntly: "selective enforcement of HOA
rules or a failure to properly enforce HOA rules may potentially expose them to liability if
it results in the creation of a hostile environment under the Fair Housing Act."
([micondolaw.com](https://micondolaw.com/2021/02/01/neighbor-disputes-within-homeowners-associations-when-should-the-hoa-intervene/),
fetched 26 Aug 2026)

**So the board needs the data, not less of it.** The product decision follows directly:

- Store `reportedBy` on every resident report. Always.
- On the board's view of a property, show how many reports this address has received and
  from how many distinct reporters.
- On the board's view of a reporter, show how many reports they have filed and against how
  many distinct addresses.
- Surface a quiet flag when one reporter accounts for a disproportionate share of reports
  against one address. Do not accuse anyone. Show the count and let the board look.

That last item is the feature nobody in this market has, and it is a five-line query.

### 4.3 A resident report is not a violation

This is the load-bearing modeling decision.

**Two record types.**

- **Concern.** Created by a resident. Visible to the board only. Has a reporter, a subject
  address, a description, optional photos, a status. Never generates a notice. Never appears
  on the accused owner's account. Never counts toward anything.
- **Violation.** Created by a board member or manager, always after an inspection they
  performed. Has a cited rule, a stage, a clock, an owner-visible evidence set. This is the
  record that produces notices and fines.

A concern can be **converted** into a violation. Conversion requires a board member to
record that they inspected it, with a date. The violation that results cites the rule and
carries the inspector's observation, not the neighbor's.

**Why this matters more than it sounds.**

1. **It fixes the Arizona problem.** The person who "observed the violation" for statutory
   purposes is the board member who went and looked. That name is disclosable without
   exposing the neighbor, because the neighbor is not the evidence.
2. **It fixes the selective enforcement problem.** If violations only exist where a board
   member inspected, then enforcement tracks inspections, not complaints. A board that
   inspects the whole community on a route is defensibly uniform. A board that only ever
   inspects addresses it received complaints about is not, and now the data will show that
   too.
3. **It keeps false reports out of the record.** A concern that a board member inspects and
   dismisses closes as "inspected, no violation found." The accused owner never hears about
   it, and no notice was ever generated from an accusation nobody checked.
4. **It sets expectations for the reporter.** The reporter should be told, at submit time,
   that the board will look and that they will not be told the outcome. Not because the
   board is secretive, but because the outcome is another owner's private enforcement
   record. Getting this wrong is how the tool becomes a scoreboard.

**One exception worth building: safety.** A concern flagged as an immediate hazard (a
blocked fire lane, a downed line, a loose dog) should page the board rather than sit in a
queue. Several statutes already treat health and safety differently. Colorado gives a
72-hour cure for a violation that "threatens the public safety or health" against 30 days
otherwise, C.R.S. 38-33.3-209.5(1.7)(b)(II). Texas exempts safety threats from the cure
requirement, 209.006(b)(2)(A), and defines the term at 209.006(f). Nevada exempts imminent
threats from its fine caps.

### 4.4 Safeguards that go with the feature

Everything below is cheap and each one prevents a specific failure.

1. **Named reports only.** No anonymous submit path. Logged in, or not at all.
2. **The stated policy at the point of submission**, in one sentence, as drafted in 4.1.
3. **A required rule selection.** The reporter picks which rule they think is being broken,
   from the association's actual rule list. This does three things: it filters out
   "I don't like their taste," it teaches residents what the rules actually say, and it gives
   the board a starting citation. If no rule fits, the form should say so and offer a
   neighbor-dispute path instead of an enforcement path.
4. **A rate limit, disclosed.** A cap on reports per household per month, with the number
   shown. This is the least popular safeguard and the most effective one.
5. **No resident-visible leaderboard, count, or map of violations.** The accused owner's
   enforcement record is visible to the accused owner and the board. Nobody else.
6. **A cooling-off on repeat reports.** The same reporter against the same address within
   some window attaches to the existing concern instead of creating a new one. It stops
   volume from looking like severity.
7. **Board inspection required before any notice**, per 4.3. No exceptions outside the
   safety path.
8. **An audit trail on the concern-to-violation conversion**, showing who inspected, when,
   and what they found. This is the document that defends the board later.
9. **A written enforcement policy the product generates.** Colorado requires an adopted
   written policy before any fine, C.R.S. 38-33.3-209.5(2)(a). Nevada requires a fine
   schedule delivered to every unit, NRS 116.31031(3). Washington requires "a previously
   established schedule... furnished to the owners," RCW 64.38.020. The product should
   produce this document, not assume the board has one.
10. **A neighbor-dispute off-ramp.** Most reports are not rule violations. Give them
    somewhere else to go, and say plainly that the association does not adjudicate disputes
    between neighbors that do not involve a covenant.

### 4.5 The counterargument, stated fairly

The case against building this at all: complaint-driven enforcement is the single most
disliked thing HOAs do, and a product that makes reporting one click easier will increase
the volume of it. Being the tool that industrialized neighbor surveillance is a bad outcome
even if every individual report is valid.

That argument is right about the risk and wrong about the alternative. Residents already
report. They do it by email, by phone, at the mailbox, and in a Facebook group, and in every
one of those channels there is no rule citation, no record of who said it, no inspection
step, and no pattern visible to anyone. The reporting is not the problem. The **unstructured**
reporting is the problem, because it is exactly the version that produces selective
enforcement and undocumented decisions.

The product's job is to make the report harder to file and much harder to act on than the
board expects, while making the record of it complete. That is the opposite of what a
one-click report button does, and it is the position worth taking publicly.

---

## 5. Photos

### 5.1 Is it legal to photograph a neighbor's property?

**From the street or a common area, yes.** The rule everywhere is that a person has no
reasonable expectation of privacy in what is plainly visible from a place the photographer
has a legal right to be. Florida's drone statute states the line as clearly as any statute
in the country, in the course of describing when the expectation of privacy *does* exist:

> a person is presumed to have a reasonable expectation of privacy on his or her privately
> owned real property if he or she is not observable by persons located at ground level in
> a place where they have a legal right to be, regardless of whether he or she is
> observable from the air
>
> Fla. Stat. 934.50(3)(b)
> ([flsenate.gov](https://www.flsenate.gov/Laws/Statutes/2024/934.50), fetched 26 Aug 2026)

Read that backwards and you get the safe harbor: **if a person standing on the street can
see it, photographing it is fine.** Three things fall outside it.

**Trespass.** Walking onto the lot, into a side yard, or through a gate to get the shot is
a trespass regardless of what the photo shows. In California this is a statutory tort:
Civil Code 1708.8(a) covers knowingly entering "onto the land or into the airspace above
the land of another person without permission" to capture an image of a private activity.
([california.public.law](https://california.public.law/codes/civil_code_section_1708.8),
fetched 26 Aug 2026)

**Photographing into a home, or over a fence with a lens.** California 1708.8(b) covers
"constructive invasion of privacy": using a device to capture an image that "could not
have been achieved without a trespass unless the device was used." Telephoto lenses and
drones are both named. Damages run to treble general and special damages plus civil fines
of $5,000 to $50,000. That is a real number for a volunteer board.

**Drones.** This is the sharpest line and the one boards get wrong.

- **Florida.** "A person, state agency, or political subdivision may not use a drone
  equipped with an imaging device to record an image of privately owned real property or
  of the owner, tenant, occupant, invitee, or licensee of such property with the intent to
  conduct surveillance on the individual or property captured in the image in violation of
  such person's reasonable expectation of privacy without his or her written consent."
  Fla. Stat. 934.50(3)(b). Civil action, compensatory and punitive damages, attorney fees.
- **Texas.** "A person commits an offense if the person uses an unmanned aircraft to
  capture an image of an individual or privately owned real property in this state with
  the intent to conduct surveillance on the individual or property captured in the image."
  Tex. Gov't Code 423.003. Class C misdemeanor. The list of lawful uses in 423.002 covers
  real estate brokers marketing a property, surveyors, engineers, insurance adjusters,
  utilities, and images taken from no more than eight feet above ground level in a public
  place. **There is no exception for a homeowners association inspecting for violations.**
  ([423.003](https://texas.public.law/statutes/tex._gov%27t_code_section_423.003),
  [423.002](https://texas.public.law/statutes/tex._gov%27t_code_section_423.002), fetched
  26 Aug 2026)

**Product position: no drone photos.** Do not build drone capture, do not integrate a
drone vendor, and if the product ever accepts an uploaded aerial image it should warn.
Ground-level photos, taken from the street or a common area, are the only category that is
safe across states.

### 5.2 Photos as evidence, and whether the owner sees them

Two states have already answered this, and they answered yes.

**Nevada requires a photo in the notice.** A notice to cure must:

> Provide a clear and detailed photograph of the alleged violation, if the alleged
> violation relates to the physical condition of the unit or the grounds of the unit or an
> act or a failure to act of which it is possible to obtain a photograph
>
> NRS 116.31031(1)(c)(3)

The same requirement is repeated for the pre-fine notice at NRS 116.31031(4)(b)(1)(II).
([leg.state.nv.us](https://www.leg.state.nv.us/NRS/NRS-116.html), fetched 26 Aug 2026)

**Texas requires disclosure before the hearing.** The association must give the owner "a
packet containing all documents, photographs, and communications relating to the matter
the association intends to introduce at the hearing," at least 10 days out, or the owner
gets an automatic 15-day postponement. Tex. Prop. Code 209.007(f) and (g).

**Colorado lets the owner answer with a photo of their own,** and makes the timing
operative:

> If the unit owner cures the violation within the period to cure afforded the unit owner,
> the unit owner may notify the association of the cure and, if the unit owner sends with
> the notice visual evidence that the violation has been cured, the violation is deemed
> cured on the date that the unit owner sends the notice.
>
> C.R.S. 38-33.3-209.5(1.7)(b)(IV)

Without visual evidence, the association has to inspect, and the cure date slips to
whenever that happens. A photo upload button is worth real money to a Colorado owner.

**The due process argument is the same everywhere.** A hearing where the board looks at
evidence the owner has not seen is not a hearing. Colorado's "fair and impartial
fact-finding process" standard and Florida's committee vote both assume the owner can
respond to what is actually being alleged. Build for the strictest state and you are
compliant everywhere.

**What this means for the product.**

- Photos attach to the violation, and the owner-facing violation view shows them by
  default. There is no "internal only" photo on a violation.
- Capture timestamp and store it. Do not display GPS coordinates to the owner; a
  coordinate on a notice reads as surveillance. The date is the part that matters
  evidentially.
- Photos taken during an inspection but not attached to a notice are a different record
  with different visibility. Keep the two separate so a board cannot leak a survey pass
  into an enforcement file by accident.
- If a violation is in a state that requires a photo (Nevada today), the notice should
  refuse to send without one.

---

## 6. Communications: which channel, and what the law allows

### 6.1 The four channels

| Channel | Legal standing | Consent needed | Good for |
| --- | --- | --- | --- |
| **Mail** | The only universally sufficient method. Certified mail is required for enforcement notices in TX, CO, and VA. | None | Anything statutory. Fine notices, hearing notices, liens, collections. |
| **Email** | Sufficient for many notices, but only where the statute allows it and the owner opted in. | Written consent (FL, CA), or a registered address (TX) | Statements, meeting packets, minutes, newsletters, receipts. |
| **SMS** | No statute found makes a text sufficient for statutory notice. Treat it as a nudge that points at something else. | Express consent, plus 10DLC registration. See section 7. | Reminders, emergency alerts, "you have a new notice, log in." |
| **In-app** | Not notice. It is a record. | None | The permanent, always-there view: balance, violation history, documents. |

### 6.2 What must go by mail

**Texas: certified mail, no substitute, for enforcement.**

> Before a property owners' association may suspend an owner's right to use a common area,
> file a suit against an owner..., charge an owner for property damage, levy a fine for a
> violation..., or report any delinquency of an owner to a credit reporting service, the
> association or its agent must give written notice to the owner by certified mail.
>
> Tex. Prop. Code 209.006(a)

Texas has a general opt-in mechanism at 209.0042, and it is narrow on purpose:

> A property owners' association may use an alternative method of providing notice adopted
> under this section to provide a notice for which another method is prescribed by law only
> if the property owner to whom the notice is provided has affirmatively opted to allow the
> association to use the alternative method... A property owners' association may not
> require an owner to allow the association to use an alternative method.
>
> Tex. Prop. Code 209.0042(b), (c)
> ([texas.public.law](https://texas.public.law/statutes/tex._prop._code_section_209.0042),
> fetched 26 Aug 2026)

So: affirmative, per-owner, and cannot be a condition of anything.

**Virginia: hand delivery or registered/certified mail, both directions.**

> Notice of a hearing, including the actions that may be taken by the association in
> accordance with this section, shall be hand delivered or mailed by registered or
> certified mail, return receipt requested, to the member at the address of record with the
> association at least 14 days prior to the hearing. Within seven days of the hearing, the
> hearing result shall be hand delivered or mailed by registered or certified mail, return
> receipt requested...
>
> Va. Code 55.1-1819(C)
> ([law.lis.virginia.gov](https://law.lis.virginia.gov/vacode/title55.1/chapter18/section55.1-1819/),
> fetched 26 Aug 2026)

No email option in the text. The decision has to go back by the same route.

**Colorado: certified mail, return receipt requested, plus a second channel.** For a
non-health-and-safety violation the association must "through certified mail, return
receipt requested, provide the unit owner written notice." C.R.S.
38-33.3-209.5(1.7)(b)(III)(A). For delinquency notices, Colorado goes further and requires
certified mail *and* physically posting a copy at the unit *and* one of: first-class mail,
a text message to a cell number the owner gave the association, or email to an address the
owner gave. C.R.S. 38-33.3-209.5(1.7)(a)(I).

Colorado also requires notices in a language the owner has requested, and requires the
same correspondence to go to a designated contact the owner nominates.

**Florida is the counterexample.** A fine or suspension notice goes to the owner's
"designated mailing or e-mail address in the association's official records." Fla. Stat.
720.305(2)(b). The decision notice goes the same way, 720.305(2)(d). Florida associations
can run enforcement entirely by email if the owner designated one.

**Arizona sits oddly.** 33-1803 does not prescribe a delivery method for the violation
notice itself, but the owner's response has to go by certified mail within 21 days, and
the association's reply is due within 10 business days of receiving it.

### 6.3 What email requires

**Florida.** Notice by electronic transmission is allowed "to any member who has provided a
facsimile number or e-mail address to the association; however, a member must consent in
writing to receiving notice by electronic transmission." Fla. Stat. 720.303(2)(c)1.
([flsenate.gov](https://www.flsenate.gov/Laws/Statutes/2024/720.303), fetched 26 Aug 2026)

The nonprofit corporation act supplies the mechanics. Notice by email is effective "when
actually transmitted by electronic mail, if correctly directed to an electronic mail
address at which the member has consented to receive notice," and consent is revocable in
writing. Consent is also **deemed revoked** if two consecutive notices bounce and the
secretary knows about it. Fla. Stat. 617.0141(3)(c) and (4).
([flsenate.gov](https://www.flsenate.gov/Laws/Statutes/2024/617.0141), fetched 26 Aug 2026)

That last clause is a product requirement. Two consecutive bounces has to flip the owner
back to mail automatically and tell the board.

**California** replaced blanket email consent with an annual solicitation. Under Civ. Code
4041 the association must ask each member every year for a preferred and an alternate
delivery method (mail, email, or both), a legal representative, and whether the property is
owner-occupied, rented, vacant, or undeveloped. If the member does not answer, "the last
mailing address provided in writing by the member or, if none, the property address shall
be deemed to be the address to which notices are to be delivered."
([leginfo](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4041),
fetched 26 Aug 2026)

Civ. Code 4040 then says individual delivery follows the member's stated preference, and
falls back to first-class, registered, certified, express, or overnight mail if there is
none. It also warns that "an unrecorded provision of the governing documents providing for
a particular method of delivery does not constitute agreement by a member to that method."
([california.public.law](https://california.public.law/codes/civil_code_section_4040),
fetched 26 Aug 2026)

**Washington** is the most permissive of the states read here, and the most useful model
for what a consent record should contain. RCW 64.90.515 allows notice by mail, private
carrier, personal delivery, telephone, fax, electronic transmission, or "any other method
reasonably calculated to provide notice to the recipient." Electronic transmission requires
that the recipient has given **written consent**, has **designated an address, location, or
system** for delivery, and can **revoke consent at any time**. The recipient may also ask
that the electronic address stay confidential.
([app.leg.wa.gov](https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.515), fetched 26 Aug
2026)

Three fields, then: consent flag, designated address, revocation. Store all three with
timestamps, per channel.

**Product requirement: an annual delivery-preference campaign.** California needs it by
statute. Everywhere else it is the thing that keeps the address book from rotting. This is
a small, unglamorous feature that no competitor markets and every board needs.

**The federal floor.** Where a record legally has to be "in writing," E-SIGN lets you send
it electronically only with the consumer's affirmative consent, after a clear and
conspicuous statement of their right to a paper copy, how to withdraw consent, and the
hardware and software required. The consumer must "affirmatively consent electronically,
or confirm consent electronically, in a manner that reasonably demonstrates that the
consumer can access information in the electronic form" being used. 15 U.S.C. 7001(c).
([law.cornell.edu](https://www.law.cornell.edu/uscode/text/15/7001), fetched 26 Aug 2026)

In plain terms: a checkbox on a form the owner is already reading in a browser is close to
the right shape, if it is accompanied by the disclosures. A checkbox buried in a signup
flow with no paper-copy disclosure is not.

### 6.4 In-app, and what boards over-send

There is no statute on in-app notifications, and no good survey data was found on what
owners want. What follows is reasoning from the legal constraints, not a cited finding.
Treat it as a design position.

**The useful frame is that the four channels do four different jobs.**

- **Mail is the legal record.** It exists to be provable later. It should be generated by
  the system, not typed by a volunteer.
- **In-app is the durable state.** Balance, open violations, documents, the reserve study.
  It is always there and never expires. It is not notice and should never be the only
  place a fine notice lives.
- **Email is the summary.** It carries the packet, the statement, the minutes. It is where
  attachments go.
- **SMS is the interrupt.** Its only job is to make someone look at one of the other three.
  Every text should be short and should point somewhere.

**The failure mode boards fall into.** A board that gets a broadcast tool sends
everything through it, because sending is free and skipping feels like withholding. Owners
then stop reading, and the one message that mattered (the water shutoff, the special
assessment vote) lands in a stream they have tuned out. The cost of over-sending is not the
message that annoyed someone; it is the message that gets missed later.

**Three design consequences.**

1. **Category-scoped consent, not one global toggle.** CTIA's guidance is explicit that "a
   Consumer opt-in should apply only to the campaign(s) and specific Message Sender for
   which it was intended or obtained" and that opt-in "should not be transferable or
   assignable" (Messaging Principles and Best Practices, section 5.1.2.2). So an owner who
   opted in to emergency alerts has not opted in to assessment reminders. Model consent per
   category: emergency, billing, meetings, enforcement, community news.
2. **A default routing rule per message type, set by the product, not by the board.** The
   board should not be choosing the channel for a fine notice. The system should know that
   a Texas fine notice goes certified mail, and that the in-app record and the email are
   courtesy copies.
3. **A send budget the board can see.** Show the board how many messages each household has
   received this month before they hit send. Nothing else will slow them down.

---

## 7. SMS specifically: consent, 10DLC, cost, burden

There are three separate gates, and they are not the same gate. A board that clears one
often assumes it has cleared all three.

1. **The TCPA**, which is federal law with a private right of action.
2. **Carrier registration (A2P 10DLC)**, which is not law but is enforced by message
   blocking.
3. **State association law**, which decides whether a text counts as notice at all. It
   mostly does not. See section 6.

### 7.1 The TCPA gate

**The rule turns on whether the message is telemarketing.** 47 CFR 64.1200 draws the line
in two adjacent paragraphs:

- **(a)(1):** an autodialed or prerecorded call to a wireless number requires **prior
  express consent**.
- **(a)(2):** a call "that includes or introduces an advertisement or constitutes
  telemarketing," made with the same equipment, requires **prior express written consent**.

"Telemarketing" is defined as initiating a call "for the purpose of encouraging the
purchase or rental of, or investment in, property, goods, or services."
([law.cornell.edu](https://www.law.cornell.edu/cfr/text/47/64.1200), fetched 26 Aug 2026)

**An HOA texting its own members about assessments, meetings, and violations is not
telemarketing.** It is not encouraging a purchase; the assessment obligation already exists
by covenant. So the written-consent standard in (a)(2) is not the one that applies. Prior
express consent is.

**Prior express consent is a lower bar, but it is not nothing.** The FCC's long-standing
position is that giving a phone number to a business, in connection with the transaction,
is prior express consent for informational calls about that transaction. The safe practice
is still an explicit, recorded, per-category opt-in, because the burden of proving consent
falls on the sender and because the carriers demand it anyway.

**Two things narrow the exposure further.**

The equipment definition. In *Facebook, Inc. v. Duguid*, decided 1 April 2021, the Supreme
Court held:

> To qualify as an automatic telephone dialing system under the TCPA, a device must have
> the capacity either to store a telephone number using a random or sequential number
> generator, or to produce a telephone number using a random or sequential number
> generator.
>
> ([supremecourt.gov, 19-511](https://www.supremecourt.gov/opinions/20pdf/19-511_p86b.pdf),
> fetched 26 Aug 2026)

A platform that texts a stored list of member numbers is not generating those numbers
randomly or sequentially, so it is very likely not an ATDS. That removes the 227(b) hook
for a large class of claims. It does **not** remove the do-not-call rules, state statutes,
or carrier enforcement, and it is not a reason to skip consent.

The one-to-one consent rule is gone. The FCC's 2023 order would have required separate
consent per seller and required calls to be "logically and topically associated" with the
interaction that produced consent. The Eleventh Circuit vacated that part on 24 January
2025 in *Insurance Marketing Coalition Ltd. v. FCC*, 127 F.4th 303 (11th Cir. 2025), No.
24-10277: "we grant IMC's petition for review, vacate Part III.D of the 2023 Order, and
remand for further proceedings."
([media.ca11.uscourts.gov](http://media.ca11.uscourts.gov/opinions/pub/files/202410277.pdf),
fetched 26 Aug 2026). It applied only to telemarketing and advertising robocalls, so it was
never going to bind an HOA anyway.

**Revocation is where the real exposure is, and the rules are recent and specific.** In FCC
24-24 (CG Docket 02-278, adopted 15 February 2024) the Commission codified the following.
([docs.fcc.gov](https://docs.fcc.gov/public/attachments/FCC-24-24A1.pdf), fetched 26 Aug
2026)

- **Per se revocation keywords.** "[U]sing the words stop, quit, end, revoke, opt out,
  cancel, or unsubscribe via reply text message constitutes a per se reasonable means to
  revoke consent." This is not an exclusive list; any words a reasonable person would
  understand as a revocation count.
- **Ten business days.** "All requests to revoke prior express consent or prior express
  written consent made in any reasonable manner must be honored within a reasonable time
  not to exceed ten business days from receipt of such request."
- **No exclusive channel.** Senders "may not designate an exclusive means to request
  revocation of consent." A revocation by voicemail or email to a number or address
  intended to reach the sender counts.
- **If replies do not work, say so on every message.** A sender using a protocol that does
  not accept reply texts "must provide a clear and conspicuous disclosure on each text to
  the consumer that two-way texting is not available due to technical limitations of the
  texting protocol, and clearly and conspicuously provide on each text reasonable
  alternative ways to revoke consent."
- **One confirmation text is allowed.** A single message confirming the opt-out does not
  violate the TCPA, as long as it "merely confirms the called party's opt-out request and
  does not include any marketing or promotional information," and it is "the only
  additional message sent." Sent within five minutes, it is presumed to fall within the
  prior consent.

**Damages.** 47 U.S.C. 227(b)(3) gives a private right of action for actual loss or **$500
per violation, whichever is greater**, trebled to $1,500 for a willful or knowing
violation. ([law.cornell.edu](https://www.law.cornell.edu/uscode/text/47/227), fetched 26
Aug 2026)

Per message, per recipient. For a 200-home association that texts a stale list once, the
arithmetic is unpleasant. This is the reason opt-out has to be an automatic system
behavior, not a board member deleting a row.

**State mini-TCPAs, at least the one that matters most.** Florida's Telephone Solicitation
Act, Fla. Stat. 501.059, has a stricter written-consent standard than federal law, but it
only reaches a "telephonic sales call," defined as a call, text, or voicemail "to a
consumer for the purpose of soliciting a sale of any consumer goods or services, soliciting
an extension of credit for consumer goods or services, or obtaining information that will
or may be used for the direct solicitation of a sale."
([flsenate.gov](https://www.flsenate.gov/Laws/Statutes/2024/501.059), fetched 26 Aug 2026)
An assessment reminder is not a sales call. The statute also carves out calls "primarily in
connection with an existing debt or contract, if payment or performance of such debt or
contract has not been completed."

**Where the product would cross the line:** any message that promotes a vendor, a service, a
sponsor, or a paid amenity. The moment a text says "our landscaping partner is offering
residents 20% off," it becomes telemarketing and the written-consent standard applies.
**Design rule: HOAsis does not carry third-party promotions over SMS.** That single
restriction keeps every association on the easy side of the line.

### 7.2 The carrier gate: A2P 10DLC

Registration is not optional and not a legal question. It is a condition of delivery.

> Anyone sending SMS/MMS messages over a 10DLC number from an application to the US must
> register for A2P 10DLC. Carriers consider all SMS traffic from Twilio to be sent from an
> application. Anyone using a 10DLC number with Twilio to send SMS messages to the US will
> need to register. This includes individuals and hobbyists.
>
> ([twilio.com/docs](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc), fetched
> 26 Aug 2026)

Unregistered traffic gets "additional carrier fees" and "higher message filtering and lower
throughput." In practice, unregistered messages silently do not arrive, which is worse than
an error.

**Two objects have to be registered.**

- A **Brand**: who the sender is. Legal name, tax ID (EIN for US businesses), address.
- A **Campaign**: what the messages are and how people opt in, opt out, and get help.

Twilio's brand tiers, from the same page:

| Brand type | Daily volume to T-Mobile | Campaigns per brand |
| --- | --- | --- |
| Sole Proprietor | ~1,000 SMS/MMS | 1 |
| Low-Volume Standard | ~2,000 SMS/MMS | up to 5 |
| Standard | 2,000 to unlimited, by trust score | up to 5 |

A 50-home association sending four messages per home per month is 200 messages a month.
Throughput is a non-issue at that scale. The registration friction is the issue.

**CTIA's Messaging Principles and Best Practices** is the industry document the carriers
grade campaigns against. The 2019 edition, which is what CTIA publishes at the link below,
sets out the operative expectations.
([api.ctia.org](https://api.ctia.org/wp-content/uploads/2019/07/190719-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf),
fetched 26 Aug 2026)

- **The call to action must disclose** the program description, the originating number, the
  identity of the organization, opt-in terms and any fees, and how to opt out.
- **The opt-in confirmation message must include** the program name, customer care contact
  or HELP instructions, how to opt out, that messages are recurring and how frequently, and
  any fees.
- **Opt-out must work through multiple mechanisms**, including phone, email, and text.
  "Standardized STOP wording should be used," but plain language such as "stop, end,
  unsubscribe, cancel, quit, please opt me out" must also be honored, and "de minimis
  variances... such as capitalization, punctuation, or any letter-case sensitivities" do not
  invalidate an opt-out.
- **One opt-in per campaign.** "A Consumer opt-in should not be transferable or assignable.
  A Consumer opt-in should apply only to the campaign(s) and specific Message Sender for
  which it was intended or obtained."
- **Never use rented, sold, or shared lists.** "Message Senders should create and vet their
  own opt-in lists."
- **Retain the records.** "Message Senders should retain and maintain all opt-in and opt-out
  requests in their records."

That last one is the schema requirement. Consent is a row with a timestamp, a source, and a
category, not a boolean on the owner record.

### 7.3 Cost and burden for a 50-home association

**Per-message cost is trivial.** From Twilio's published US pricing page
([twilio.com](https://www.twilio.com/en-us/sms/pricing/us), fetched 26 Aug 2026):

- Outbound SMS from a long code: **$0.0083 per message**
- Carrier fee per segment: AT&T $0.0035, T-Mobile $0.0045, Verizon $0.0045, others $0.0040
- Long code phone number: **$1.15 per month**
- Failed message fee: $0.001

So roughly **$0.013 per single-segment message delivered**, all in.

For 50 homes at 4 messages a month: 200 messages, about **$2.60 of traffic plus $1.15 for
the number, call it $4 a month**. Multi-segment messages (anything over about 160
characters) multiply the carrier fee per segment, so keep messages short for reasons beyond
readability.

**Registration fees are the part I could not pin down.** Twilio's fee article is
JavaScript-rendered and its help center blocks automated fetches; Telnyx, Plivo, Bandwidth,
and SignalWire all publish per-message pricing without publishing brand or campaign
registration fees. See section 9. What the docs do confirm is that fees exist: "Each Brand
comes with its own Brand registration fee"
([twilio.com/docs](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv),
fetched 26 Aug 2026), and "US A2P 10DLC are subject to registration onboarding fees"
([twilio.com pricing](https://www.twilio.com/en-us/sms/pricing/us)). Get a real quote before
pricing the feature.

**The burden is the setup, and it belongs to HOAsis, not the board.**

The structurally important decision: **HOAsis registers as the ISV and registers each
association as its own Brand and Campaign.** The alternative, a shared HOAsis brand sending
on behalf of 400 associations, fails the CTIA identity rule ("the specific identity of the
organization or individual being represented in the initial message") and puts every
customer's deliverability on one trust score. One bad actor would take down the fleet.

That means onboarding an association has to collect: legal name, EIN, address, a website
with a visible privacy policy and SMS terms, and a described opt-in flow. For a
self-managed 50-home association, the EIN is the friction point. Many small associations
have one and cannot find it. Plan for that step to take a week of back and forth, and build
the onboarding so the rest of the product works while SMS registration is pending.

**Honest framing for the board:** texting costs a few dollars a month and takes a couple of
weeks to switch on, most of which is paperwork we do for you. If we cannot say the second
half of that sentence, do not ship the feature.

---

## 8. Sources

All fetched 26 August 2026 unless noted.

### Statutes and regulations

| Source | URL |
| --- | --- |
| Ariz. Rev. Stat. 33-1803 (HOA, notice of violation) | https://www.azleg.gov/ars/33/01803.htm |
| Ariz. Rev. Stat. 33-1242 (condominium, same) | https://www.azleg.gov/ars/33/01242.htm |
| Cal. Civ. Code 4040 (individual delivery) | https://california.public.law/codes/civil_code_section_4040 |
| Cal. Civ. Code 4041 (annual delivery preference) | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4041 |
| Cal. Civ. Code 5850 (fine schedule, $100 cap) | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5850 |
| Cal. Civ. Code 5855 (10-day notice, 14-day decision) | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5855 |
| Cal. Civ. Code 1708.8 (invasion of privacy) | https://california.public.law/codes/civil_code_section_1708.8 |
| C.R.S. 38-33.3-209.5 (responsible governance, fines, cure) | https://colorado.public.law/statutes/crs_38-33.3-209.5 |
| Fla. Stat. 720.303 (meetings, records, electronic notice) | https://www.flsenate.gov/Laws/Statutes/2024/720.303 |
| Fla. Stat. 720.305 (fines, hearing committee) | https://www.flsenate.gov/Laws/Statutes/2024/720.305 |
| Fla. Stat. 617.0141 (notice, electronic transmission) | https://www.flsenate.gov/Laws/Statutes/2024/617.0141 |
| Fla. Stat. 934.50 (drones) | https://www.flsenate.gov/Laws/Statutes/2024/934.50 |
| Fla. Stat. 501.059 (Telephone Solicitation Act) | https://www.flsenate.gov/Laws/Statutes/2024/501.059 |
| Nev. Rev. Stat. 116.31031 (fines, photograph requirement) | https://www.leg.state.nv.us/NRS/NRS-116.html |
| N.C. Gen. Stat. 47F-3-107.1 (adjudicatory panel) | https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47F/GS_47F-3-107.1.html |
| Tex. Prop. Code 209.006 (certified mail notice) | https://texas.public.law/statutes/tex._prop._code_section_209.006 |
| Tex. Prop. Code 209.007 (hearing, evidence packet) | https://texas.public.law/statutes/tex._prop._code_section_209.007 |
| Tex. Prop. Code 209.0042 (alternative notice, opt-in) | https://texas.public.law/statutes/tex._prop._code_section_209.0042 |
| Tex. Prop. Code 209.0051 (open board meetings, email notice) | https://texas.public.law/statutes/tex._prop._code_section_209.0051 |
| Tex. Prop. Code 202.003 (liberal construction of covenants) | https://texas.public.law/statutes/tex._prop._code_section_202.003 |
| Tex. Gov't Code 423.002, 423.003 (drones) | https://texas.public.law/statutes/tex._gov%27t_code_section_423.003 |
| Va. Code 55.1-1819 (rules, hearing, certified mail) | https://law.lis.virginia.gov/vacode/title55.1/chapter18/section55.1-1819/ |
| RCW 64.38.020 (WA HOA powers, fines) | https://app.leg.wa.gov/RCW/default.aspx?cite=64.38.020 |
| RCW 64.90.405 (WUCIOA, fines) | https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.405 |
| RCW 64.90.515 (WUCIOA, notice and electronic consent) | https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.515 |
| 47 C.F.R. 64.1200 (TCPA rules) | https://www.law.cornell.edu/cfr/text/47/64.1200 |
| 47 U.S.C. 227 (TCPA, damages) | https://www.law.cornell.edu/uscode/text/47/227 |
| 15 U.S.C. 7001 (E-SIGN consumer consent) | https://www.law.cornell.edu/uscode/text/15/7001 |
| 24 C.F.R. 100.7 (FHA direct and vicarious liability) | https://www.law.cornell.edu/cfr/text/24/100.7 |
| 24 C.F.R. 100.600 (FHA harassment) | https://www.law.cornell.edu/cfr/text/24/100.600 |

### Cases and agency orders

| Source | URL |
| --- | --- |
| *Facebook, Inc. v. Duguid*, 592 U.S. 395 (2021), No. 19-511 | https://www.supremecourt.gov/opinions/20pdf/19-511_p86b.pdf |
| *Insurance Marketing Coalition Ltd. v. FCC*, 127 F.4th 303 (11th Cir. 2025), No. 24-10277 | http://media.ca11.uscourts.gov/opinions/pub/files/202410277.pdf |
| FCC 24-24, Report and Order, CG Docket 02-278 (revocation of consent), adopted 15 Feb 2024 | https://docs.fcc.gov/public/attachments/FCC-24-24A1.pdf |

### Industry and vendor documentation

| Source | URL |
| --- | --- |
| CTIA, Messaging Principles and Best Practices (2019) | https://api.ctia.org/wp-content/uploads/2019/07/190719-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf |
| Twilio, Programmable Messaging and A2P 10DLC | https://www.twilio.com/docs/messaging/compliance/a2p-10dlc |
| Twilio, ISV onboarding for A2P 10DLC | https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv |
| Twilio, US SMS pricing | https://www.twilio.com/en-us/sms/pricing/us |
| Telnyx, messaging pricing | https://telnyx.com/pricing/messaging |
| Plivo, US SMS pricing | https://www.plivo.com/sms/pricing/us/ |

### Industry commentary and research

| Source | URL |
| --- | --- |
| Foundation for Community Association Research, Statistical Review (Fact Book 2025) | https://foundation.caionline.org/publications/factbook/statistical-review/ |
| Foundation for Community Association Research, Homeowner Satisfaction Survey dashboard | https://foundation.caionline.org/research/survey_homeowner/homeowner-satisfaction-survey-dashboard/ |
| Hirzel Law, "Neighbor Disputes within Homeowners Associations: When Should the HOA Intervene?" | https://micondolaw.com/2021/02/01/neighbor-disputes-within-homeowners-associations-when-should-the-hoa-intervene/ |
| Tinnelly Law Group, "AB 130 - $100 Fine Caps, Hearing Procedures, and Prohibited ADU Fees" | https://www.hoalawblog.com/ab-130-100-fine-caps-hearing-procedures-and-prohibited-adu-fees/ |
| ManageCasa, HOA violations and enforcement guide | https://managecasa.com/articles/hoa-violations-and-enforcement-the-complete-process-guide |
| CMGT, HOA rules enforcement resource | https://cmgt.org/resources/hoa-rules-enforcement |

---

## 9. What could not be verified

Listed so nobody later mistakes a gap for a finding.

**1. The proportion of violations that start as neighbor complaints.** No survey, no
industry study, no management company dataset. Vendor blogs assert it without a source.
Do not put a percentage on a slide.

**2. Exact A2P 10DLC registration fees.** Twilio's fee article
(help.twilio.com/hc/en-us/articles/1260803965530) is JavaScript-rendered and the help center
returns a bot challenge to automated fetches. Telnyx, Plivo, Bandwidth, and SignalWire all
publish per-message pricing without publishing brand or campaign registration fees. The
Campaign Registry does not publish a public fee schedule at a stable URL. Per-message prices
and phone number rental in section 7.3 are verified from Twilio's public pricing page; the
one-time and monthly registration fees are not. **Get these from a Twilio or Telnyx quote
before pricing the SMS feature.**

**3. What owners actually want by channel.** The Foundation for Community Association
Research runs a 3,000-homeowner survey across six editions from 2016 to 2026, but the
findings sit behind an interactive dashboard that did not yield channel-preference data.
Section 6.4 is reasoned design position, and is labeled as such in the text.

**4. California Civil Code 5855(f): 14 days or 15.** Two sources disagreed. The California
Legislative Information site and Tinnelly Law's summary of AB 130 both say the decision
notice is due within **14 days**, and Tinnelly states AB 130 changed it from 15 to 14
effective 30 June 2025. Older secondary sources still say 15. Fourteen is used above. Verify
before relying on it.

**5. Colorado's electronic notice rules outside the delinquency context.** C.R.S.
38-33.3-209.5(1.7)(a)(I) was read in full and requires certified mail plus posting plus one
of first-class mail, text, or email for **delinquency** notices. Whether Colorado permits
electronic delivery for other association notices was not run down.

**6. Whether any state statute bars anonymous complaints outright.** Arizona's disclosure
requirement was found and read. No search was run for a state that prohibits an association
from accepting an anonymous complaint in the first place. The Arizona provision is a
disclosure duty triggered by the owner contesting, not a ban on receiving tips.

**7. *Wetzel v. Glen St. Andrew Living Community* and other owner-on-owner harassment
cases.** Cited widely for the proposition that a housing provider can be liable for failing
to stop tenant-on-tenant harassment. The regulation it rests on, 24 CFR 100.7, was read
directly and is cited above. The opinion itself was not read for this document.

**8. Whether photographing a neighbor's property triggers any state's video surveillance or
eavesdropping statute.** Only the privacy torts and the two drone statutes were checked.
Audio is a separate and stricter question in two-party consent states, and was not
researched. **If violation reporting ever accepts video, this needs its own pass.**

**9. State mini-TCPA statutes other than Florida's.** Oklahoma, Washington, and Maryland
have their own telephone solicitation statutes. Only Florida's was read. Florida's is
limited to sales calls and does not reach association messages; **do not assume the others
are drafted the same way.**

