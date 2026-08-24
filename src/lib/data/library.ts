/**
 * The resource library.
 *
 * Free, no signup. Most of what a volunteer board needs to know is general,
 * and a minority is genuinely state specific. That minority is where the value
 * is, because nobody publishes it for free, so articles carry an optional
 * `states` list and the library filters on it. Anything without a list is
 * general and shows for every state.
 *
 * This doubles as the seed for the compliance register: same research, one
 * surface aimed at the public and one aimed at a board with a deadline.
 */

export interface LibraryArticle {
  slug: string;
  title: string;
  summary: string;
  topic: LibraryTopic;
  /** Omitted means it applies everywhere. */
  states?: StateCode[];
  readMinutes: number;
  publishedDate: string;
  /** Markdown-ish: "## " starts a heading, blank lines separate paragraphs. */
  body: string;
}

export type LibraryTopic =
  | "Getting started"
  | "Money"
  | "Meetings and voting"
  | "Rules and enforcement"
  | "Reserves"
  | "Legal";

export type StateCode = "WA" | "CA" | "FL" | "TX" | "CO" | "AZ" | "NC" | "GA";

export const STATES: { code: StateCode; name: string }[] = [
  { code: "AZ", name: "Arizona" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "NC", name: "North Carolina" },
  { code: "TX", name: "Texas" },
  { code: "WA", name: "Washington" },
];

export const LIBRARY_TOPICS: LibraryTopic[] = [
  "Getting started",
  "Money",
  "Meetings and voting",
  "Rules and enforcement",
  "Reserves",
  "Legal",
];

export const libraryArticles: LibraryArticle[] = [
  {
    slug: "self-managing-vs-management-company",
    title: "What a management company actually does, and what it costs",
    summary:
      "A line by line look at the work, so a board can decide honestly which parts it wants to keep.",
    topic: "Getting started",
    readMinutes: 7,
    publishedDate: "2026-07-14",
    body: `Management companies bundle about nine jobs together and quote one number. Boards rarely see the breakdown, which makes the decision to hire or leave feel like a leap rather than a comparison.

## What is in the bundle

Collecting assessments and chasing the late ones. Paying vendors. Keeping the books and producing statements. Holding the records. Sending notices. Running elections. Logging violations and issuing letters. Fielding owner calls. Coordinating repairs.

## What it costs

Full service management is commonly quoted per door per month, and for a small association the floor pricing often works out worse per home than for a large one. Ask for the number three ways: per door, per month total, and as a share of your annual assessment income. That third number is usually the one that changes minds.

Then ask what is excluded. Special assessments, election supervision, extra mailings, after hours calls, and document production for a sale are frequently billed on top.

## What a board keeps either way

Fiduciary duty does not transfer. A manager can prepare the budget, but the board adopts it. A manager can send the notice, but the board owes the notice. If money goes missing, the board explains it.

## The honest test

Take the nine jobs above and mark each one: something the board is willing to do, something software can do, or something you genuinely need a person for. Most self managing boards find the answer is roughly four, four, and one. The one is usually the hardest conversation, not the hardest task.`,
  },
  {
    slug: "reserve-study-basics",
    title: "Reserve studies, explained without the jargon",
    summary:
      "Percent funded, useful life, and why the number that matters is the year you run out.",
    topic: "Reserves",
    readMinutes: 9,
    publishedDate: "2026-06-02",
    body: `A reserve study is a list of everything the association will have to replace, when, and for how much. Everything else in the document is arithmetic on that list.

## Useful life and remaining life

Every component has a useful life, which is how long it lasts new, and a remaining life, which is how long yours has left. A roof with a 25 year useful life installed in 2011 has about 10 years remaining. Remaining life is what schedules the spending.

## Percent funded

Percent funded compares what you have saved against what you should have saved by now. Note the "by now": a roof halfway through its life should be about half funded, not fully funded. An association at 70% or better is generally considered strong, 30 to 70% fair, and below 30% weak. Some lenders decline mortgages in associations funded below 10%, which is how a reserve problem becomes a property value problem.

## The number nobody shows you

Percent funded is a snapshot. The number that actually decides whether you levy a special assessment is the first year your projected balance goes negative.

Roll the years forward: opening balance, plus contributions, plus interest, minus whatever gets replaced that year. Do that for 30 years. The first negative year is your deadline. If it is 18 years out, you have time. If it is 4 years out, you are already having the conversation, you just have not scheduled it yet.

## Inflation is not optional

A roof that costs $620,000 today costs about $833,000 in ten years at 3% construction inflation. A study that quotes today's prices against a ten year horizon is understating the problem by a third.

## Interest is a real lever

It is also the only lever that raises nobody's assessment. Reserve cash sitting in a 0.05% checking account instead of a 4.5% insured savings account is a large, silent, entirely avoidable loss.`,
  },
  {
    slug: "collecting-late-assessments",
    title: "How to collect a late assessment without wrecking a friendship",
    summary:
      "Escalation that is consistent, documented, and does not require anyone to be the villain.",
    topic: "Money",
    readMinutes: 6,
    publishedDate: "2026-05-19",
    body: `Collections is the hardest part of a volunteer board, because the delinquent owner is also the neighbor whose dog you feed. The way through is to make the process impersonal and consistent, so nobody is choosing to come after anybody.

## Write the policy before you need it

Adopt a written collection policy at a meeting, in advance, applying to everyone. Grace period, late fee, when a reminder goes out, when it escalates, when it goes to counsel. Once it is policy, no individual is making a decision about their neighbor.

## Use templates

Draft the letters once, calmly, and reuse them. Wording written in the moment is either too soft to work or too sharp to forgive.

## Lead with the payment plan

Most delinquencies are cash flow, not defiance. Offer the plan in the first contact rather than the third. A board that gets $300 a month for six months has solved the problem. A board that stands on principle for six months has a lien, a lawyer, and a neighbor who no longer speaks to them.

## Be careful once counsel is involved

After referral, stop contacting the owner about the balance directly. It undercuts your attorney and can create problems under federal and state debt collection rules.

## Apply it evenly, every time

Selective enforcement is the fastest way to lose. If the board waived a fee for one owner, expect to be asked why in front of everyone.`,
  },
  {
    slug: "running-a-board-meeting",
    title: "Running a board meeting people are willing to attend",
    summary: "Agenda, quorum, minutes, and executive session, without the theatre.",
    topic: "Meetings and voting",
    readMinutes: 5,
    publishedDate: "2026-04-08",
    body: `A meeting that runs long, decides nothing, and ends in an argument teaches owners not to come. Then quorum gets hard, and everything gets harder.

## Publish the agenda with the notice

People show up for items, not for meetings. An agenda also gives the chair something to point at when a discussion runs away.

## Know your quorum before you start

Quorum is defined in your bylaws, and proxies usually count. Check it at the top and record it in the minutes. Decisions made without quorum are vulnerable.

## Minutes record decisions, not conversation

Who was present, what was moved, who seconded, how the vote went. Not who said what. Minutes are a legal record and, in most states, an official record any owner can inspect. Debate belongs in the room.

## Executive session is narrow

Most states allow the board to close a session for a short list of topics, typically legal advice, personnel, contract negotiation, and matters involving an individual owner's account or a violation hearing. Going into executive session for general business is a common and avoidable mistake.

## End on time

A board that reliably finishes in an hour gets better attendance than one that reliably runs to three.`,
  },
  {
    slug: "enforcing-rules-fairly",
    title: "Enforcing rules without becoming the HOA people complain about",
    summary: "Notice, opportunity to cure, hearing, and the discipline of enforcing evenly.",
    topic: "Rules and enforcement",
    readMinutes: 6,
    publishedDate: "2026-03-22",
    body: `Nearly every HOA horror story is an enforcement story, and nearly every one of those involves a board that skipped a step or applied a rule unevenly.

## The sequence

Courtesy notice. Formal notice with a cure period. Opportunity for a hearing. Then a fine. Skipping straight to a fine is the most common procedural error, and it is usually fatal to the fine.

## Photograph and date everything

A violation you cannot evidence is a violation you cannot enforce. Attach the photo and the date to the record at the time, not later.

## Cite the actual provision

"Article IX section 2(b)" not "the rules". An owner who can read the provision can comply with it. An owner who cannot will assume you made it up.

## Even enforcement is not optional

If three homes have the same violation and you notice one, you have not enforced a rule, you have picked someone. Selective enforcement is a defence owners raise successfully.

## Ask whether the rule is worth it

Some rules cost more in goodwill than they return in property value. A board is allowed to propose amending its own governing documents, and occasionally that is the correct answer.`,
  },
  {
    slug: "reading-an-hoa-budget",
    title: "How to read an HOA budget in ten minutes",
    summary: "Operating versus reserve, where the money actually goes, and what to question.",
    topic: "Money",
    readMinutes: 5,
    publishedDate: "2026-02-11",
    body: `Most owners never read the budget, which is a shame, because it is short and it explains their assessment entirely.

## Two buckets

Operating pays for this year: insurance, utilities, landscaping, repairs, management. Reserves save for the big replacements later. Money moves from operating to reserves as a transfer, which is why the transfer line looks like an expense.

## Where it goes

For most associations, insurance and landscaping are the two largest operating lines, and insurance has been the one moving fastest. If your assessment jumped, look there first.

## Read against the year, not the total

Two thirds of the way through the year, a line should be about two thirds spent. A line at 90% in August is going to need a conversation in October.

## Questions worth asking

What is the reserve transfer, and what percent funded does the study say we are? When was the insurance last shopped? Which contracts renew this year? What was last year's actual against last year's budget?

That last one matters most. A budget that never gets compared to reality is a wish.`,
  },
  {
    slug: "washington-reserve-and-records",
    title: "Washington: reserve studies, records, and which chapter governs you",
    summary:
      "RCW 64.38 or WUCIOA depends on when your community was created, and it changes what you owe.",
    topic: "Legal",
    states: ["WA"],
    readMinutes: 8,
    publishedDate: "2026-06-25",
    body: `Washington associations are governed by different chapters depending on when the community was created, and boards routinely read the wrong one.

## Which chapter applies

The Washington Uniform Common Interest Ownership Act, RCW 64.90, applies to communities created on or after July 1, 2018. Older homeowners associations generally remain under the Homeowners' Associations Act, RCW 64.38, though certain WUCIOA provisions were made to reach back. An association can also elect into WUCIOA.

Work out which one governs you before you rely on any deadline, and confirm it with counsel. It is the first question a Washington HOA attorney will ask.

## Reserve studies

Washington expects a reserve study with regular updates and a funding disclosure in the annual budget. The disclosure is the part boards forget: owners are entitled to see the funding level, whatever it is.

## Records

Owners have a right to inspect official records. The statutory standard is framed around a reasonable time rather than a hard clock, which sounds generous and is actually a trap: "reasonable" is decided later, by someone else, with hindsight. Adopt your own written response window, publish it, and meet it.

## Budget ratification

Washington uses a ratification model rather than an approval model. The board adopts the budget and delivers a summary, and it takes effect unless owners reject it. Boards that treat it as an approval vote create confusion.

## Stay in good standing

Your association is almost certainly a nonprofit corporation and owes the Secretary of State an annual report. Letting it lapse puts the corporate shield and the board's authority to act at risk, and it is the easiest deadline on this page to meet.

This is a summary, not legal advice. Washington rules change and the details turn on your governing documents.`,
  },
  {
    slug: "california-davis-stirling",
    title: "California: Davis-Stirling, reserve studies, and SB 326",
    summary: "The most prescriptive HOA statute in the country, and the balcony rule that has teeth.",
    topic: "Legal",
    states: ["CA"],
    readMinutes: 8,
    publishedDate: "2026-05-06",
    body: `California's Davis-Stirling Common Interest Development Act is the most detailed HOA statute in the United States. If you serve on a California board, someone on it needs to have actually read it.

## Reserve studies on a cycle

California requires a reserve study with a site visit on a regular cycle and annual review in between, with disclosures going to owners with the budget package.

## SB 326 balcony inspections

Inspections of exterior elevated elements in buildings with three or more multifamily units, by a licensed professional, on a recurring cycle. Findings have to be acted on and folded into reserve planning. Cities have been citing and fining associations that miss it.

## Records on a clock

California puts hard timelines on records requests and on delivering documents for a sale. Unlike a "reasonable time" standard, these are countable, which means missing one is provable.

## Annual disclosures

California requires an annual budget report and an annual policy statement, each with defined contents and delivery windows. Boards that treat these as formalities are the ones that get caught.

This is a summary, not legal advice. Confirm the current requirements with California counsel.`,
  },
  {
    slug: "florida-2026-website-rule",
    title: "Florida: the 25 parcel website rule and what has to be posted",
    summary:
      "The threshold dropped from 150 parcels to 25, which pulled thousands of small associations into scope.",
    topic: "Legal",
    states: ["FL"],
    readMinutes: 7,
    publishedDate: "2026-04-30",
    body: `Florida has been steadily expanding what associations must publish, and the parcel threshold change caught a lot of small boards by surprise.

## The website requirement

Florida requires associations at or above a parcel threshold to maintain an official website or app and post specified records there. The threshold moved down substantially, which brought many small associations into scope for the first time.

The detail boards miss: some records must be genuinely public. A portal that requires a login for everything does not satisfy a requirement to post publicly.

## Director education

Florida requires newly elected or appointed directors to complete approved education within a set window of taking office, with continuing hours after that. A director who does not certify can be suspended from the board, which can cost you quorum at exactly the wrong moment.

## Financial reporting tiers

The level of financial reporting owed to members is set by annual revenue, stepping up through compiled, reviewed, and audited statements. Know which band you are in before the fiscal year closes, not after.

## Structural obligations

Milestone inspections and structural integrity reserve studies apply to buildings meeting height and age criteria. If they apply to you, they are not optional and they are not cheap. If they do not, document the applicability review so you can show your work.

This is a summary, not legal advice. Florida has amended these rules repeatedly. Confirm the current text with Florida counsel.`,
  },
  {
    slug: "texas-open-meetings-and-fines",
    title: "Texas: open meetings, recorded policies, and the fine process",
    summary: "Texas requires more paperwork filed publicly than boards expect.",
    topic: "Legal",
    states: ["TX"],
    readMinutes: 6,
    publishedDate: "2026-03-12",
    body: `Texas property owners associations operate under Chapter 209 of the Property Code, and the recurring theme is that policies have to be written down and, in several cases, recorded publicly.

## Recorded policies

Texas requires certain association policies, including collection and document retention policies, to be recorded in the county real property records. An unrecorded policy can be an unenforceable one.

## Open meetings

Board meetings are generally open to owners, with notice requirements, and closed sessions are limited to defined topics. Decisions made in a closed session generally have to be summarised in the open.

## Before you fine

Texas gives owners specific procedural protections before a fine, including notice and an opportunity to be heard. Skipping the hearing right is the most common way a Texas fine gets reversed.

## Resale certificates

Texas sets out what must be provided on a sale and the window for providing it. Missing it delays closings and makes you the reason.

This is a summary, not legal advice. Confirm the current requirements with Texas counsel.`,
  },
  {
    slug: "first-90-days-on-a-board",
    title: "Your first 90 days on an HOA board",
    summary: "What to read, what to ask for, and what to fix before you try to change anything.",
    topic: "Getting started",
    readMinutes: 6,
    publishedDate: "2026-01-20",
    body: `Most new board members start by trying to fix the thing that annoyed them into running. Almost always, the better first move is to find out what you have inherited.

## Read four documents

The declaration or CC&Rs, the bylaws, the current budget, and the most recent reserve study. Together these take an evening and answer most questions you will be asked all year.

## Ask for five things

Bank statements for the last twelve months. The current delinquency list. The insurance declarations page. Every vendor contract with its renewal date. The list of open violations and requests.

## Check three boring things

Is the corporate registration current? Is the insurance actually in force, with the association named correctly? Does more than one person have access to the bank accounts?

That last one is the single highest value check a new board member can make. The most common serious HOA failure is not a bad decision, it is one person with sole control of the money.

## Change nothing for a month

You will be tempted. Wait until you know why the current arrangement exists. Sometimes the answer is inertia, and sometimes it is a reason nobody wrote down.`,
  },
  {
    slug: "electronic-voting",
    title: "Electronic voting: what it fixes and what it does not",
    summary: "Turnout, quorum, and the record keeping that makes a result defensible.",
    topic: "Meetings and voting",
    readMinutes: 5,
    publishedDate: "2025-12-04",
    body: `Electronic voting usually raises turnout, which is often the difference between reaching quorum and adjourning again. But a vote is only worth as much as the record behind it.

## Check that your state and documents allow it

Most states now permit electronic voting for association matters, often requiring owner consent to receive electronic notices, and sometimes excluding specific matters. Your governing documents can be more restrictive than the statute.

## Eligibility comes from the roster

One voting interest per unit unless your documents say otherwise. Decide in advance whether an owner in arrears may vote, and follow whatever your documents say rather than what feels fair in the moment.

## Proxies still exist

Electronic voting does not eliminate proxies. Attach each proxy to the unit that granted it and name the holder, so the tally reconciles.

## Seal the results until close

Live running totals change behavior. Publish turnout and quorum during the vote, and the tallies after it closes.

## Receipts on both sides

Owners should get a confirmation they can keep. The secretary should get a tally that reconciles to those confirmations. Without that, a close result is an argument.`,
  },
];

export function articleBySlug(slug: string): LibraryArticle | undefined {
  return libraryArticles.find((article) => article.slug === slug);
}

/** General articles always show. State specific ones show for their states. */
export function articlesForState(state: StateCode | "all"): LibraryArticle[] {
  if (state === "all") return libraryArticles;
  return libraryArticles.filter((article) => !article.states || article.states.includes(state));
}
