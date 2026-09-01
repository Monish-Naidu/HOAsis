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

/**
 * Where a claim came from.
 *
 * Every statute number, deadline, threshold and effective date in a state
 * article traces to a page that was actually read, and the date it was read is
 * kept because statutes change. Publishing free legal orientation without this
 * is how a library becomes a liability: a board acts on a deadline that moved
 * two sessions ago and nobody can say where the number came from.
 */
export interface LibrarySource {
  url: string;
  /** What this source establishes, so a reader can check the right part of it. */
  note: string;
  fetched?: string;
}

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
  sources?: LibrarySource[];
  /**
   * What a photograph for this article should show.
   *
   * Written down rather than illustrated, because the only images worth using
   * are real photographs of the thing being discussed and we do not have them
   * yet. A brief is honest about the gap; a generated image would not be.
   */
  photoBrief?: string;
}

export type LibraryTopic =
  | "Getting started"
  | "Money"
  | "Reserves"
  | "Records and meetings"
  | "Rules and enforcement"
  | "Buying and selling"
  | "State law";

export type StateCode =
  | "WA" | "CA" | "FL" | "TX" | "CO" | "AZ" | "NC" | "GA"
  | "NV" | "VA" | "IL" | "UT";

export const STATES: { code: StateCode; name: string }[] = [
  { code: "AZ", name: "Arizona" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "IL", name: "Illinois" },
  { code: "NV", name: "Nevada" },
  { code: "NC", name: "North Carolina" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
];

/**
 * Reading order, not alphabetical.
 *
 * "Legal" used to be the label on the state pages, which was wrong: every
 * article here is about law. What distinguishes those pages is that a reader
 * arrives at them by picking a state rather than a topic. "Meetings and voting"
 * became "Records and meetings" because records requests are among the most
 * common procedural failures a board makes and had nowhere to live.
 */
export const LIBRARY_TOPICS: LibraryTopic[] = [
  "Getting started",
  "Money",
  "Reserves",
  "Records and meetings",
  "Rules and enforcement",
  "Buying and selling",
  "State law",
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
    topic: "Records and meetings",
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
    topic: "Records and meetings",
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
  {
    slug: "developer-turnover-checklist",
    title: "What to demand at turnover from the developer",
    summary: "Turnover is the one moment a board has leverage. Here is the list to hold the developer to",
    topic: "Getting started",
    readMinutes: 6,
    publishedDate: "2026-08-26",
    photoBrief: "a roll of as-built architectural drawings unrolled on a table next to a ring binder of warranty documents",
    body: `Turnover, also called transition, is the point where the developer stops appointing the board and the owners elect it. It is the one moment a new board has leverage, a statutory document list, and a clock running against the developer. Boards that treat it as a ceremony inherit problems they pay for over the next 20 years.

## When turnover is triggered

Most states tie it to a percentage of homes conveyed plus a backstop time limit. Nevada's period of declarant control ends no later than the earliest of 60 days after conveyance of 75% of units in a community under 1,000 units, 60 days after 90% in a community of 1,000 or more, five years after all declarants stopped offering units in the ordinary course of business, or five years after any right to add new units was last exercised, under NRS 116.31032(1). Colorado uses 60 days after 75%, two years after the last conveyance in the ordinary course, or two years after the right to add units was last exercised, under C.R.S. § 38-33.3-303(5)(a)(I). Washington uses the same three triggers in RCW 64.90.415. North Carolina's condominium act uses 120 days after 75%, two years after declarants ceased offering units, or two years after the last development right was exercised, under N.C. Gen. Stat. § 47C-3-103(d).

Florida condominiums transition on the earliest of several events, including three years after 50% of units are conveyed and three months after 90% are conveyed, under Fla. Stat. § 718.301(1), with a third of the board available at 15%. Florida HOAs transition three months after 90% of parcels are conveyed, with one seat at 50%, under Fla. Stat. § 720.307. Virginia caps condominium declarant control at five years for an expandable condominium, three years for one containing convertible land, and two years otherwise, from settlement of the first unit, under Va. Code § 55.1-1943.

One gap matters. North Carolina's Planned Community Act, § 47F-3-103(d), permits declarant control but sets no statutory outer limit. In a North Carolina HOA the declaration is the only thing capping it.

## The turnover audit

Florida requires one. Under Fla. Stat. § 718.301(4)(c) the developer must deliver financial records within 90 days of turnover, audited by an independent CPA from incorporation or from the last audit. Florida HOAs incorporated after December 31, 2007 get the same under § 720.307(4). Nevada requires audited statements plus an ancillary audit through the end of declarant control, delivered within 210 days and paid for by the declarant, under NRS 116.31038(2). Washington requires a CPA retained within 60 days after the transition meeting unless owners waive it, under RCW 64.90.420. If your state does not require an audit, buy one. It is how you find out whether the developer paid its own assessments.

## The document package

Florida's list in § 718.301(4) is the best checklist any board can use, whatever state it is in. Demand the recorded declaration and all amendments, articles, bylaws, minute books and rules; resignations of developer-appointed directors; audited financial records; association funds and control of the accounts; an inventory of tangible personal property; as-built plans and specifications; the contractor and supplier list; insurance policies in force; certificates of occupancy; applicable permits; every written warranty still effective from contractors, suppliers and manufacturers; the roster of owners and mortgagees; employment and service contracts; and the structural integrity reserve study where one applies. Nevada's list in NRS 116.31038 adds a reserve study by a registered specialist plus a reserve account holding the declarant's share of amounts then due, and Washington requires delivery within 30 days after the transition meeting.

Write down the expiry date of every warranty as it arrives. Roof, elevator, mechanical and envelope warranties usually expire before a new board has learned where the shutoffs are.

## Contracts the developer signed for you

A developer routinely signs management, landscaping, cable and recreational lease agreements while it still controls the board, on both sides of the table. Some states give you a window to undo them. Under Fla. Stat. § 718.302 a condominium association may cancel a grant, reservation, contract, or lease made before owners elected a board majority, generally on a vote of 75% of the voting interests other than the developer's, and for purchase or lease arrangements the window is 18 months after that election. Virginia caps any declarant-affiliated contract, management contract, or recreational or parking lease at two years and lets the association terminate on not less than 90 days' notice, given no later than 60 days after declarant control expires, under Va. Code § 55.1-1943(C). HUD Handbook 4000.1 requires the same 90 day termination right in developer contracts assigned to the association.

Florida HOAs get less. Fla. Stat. § 720.309(1) only requires that a pre-turnover contract with a term longer than 10 years for operation, maintenance, or management be fair and reasonable. Read every contract in the first two weeks and calendar the termination and auto-renewal dates.

## Get your own engineer

Warranties expire and statutes of repose run whether or not anyone looked. Have an independent engineer or building envelope consultant inspect before those dates, not after. Limitation and repose periods are shorter than boards assume and vary by state. Florida is four years for an action founded on the design, planning, or construction of an improvement to real property, with a seven year repose from the earliest of the certificate of occupancy, the certificate of completion, or abandonment of construction, under Fla. Stat. § 95.11(3)(b). Do not assume any other state's numbers without checking them. Nevada stops the clock during developer control: NRS 116.3111(3) tolls limitations on the association's claims against a declarant until declarant control ends.

## The budget was never a real budget

A developer sets assessments low because low dues sell homes, then covers the gap one of two ways. It gives a guarantee, promising assessments will not exceed a stated amount and that it will pay common expenses above it, which under Fla. Stat. § 718.116(9) excuses it from paying regular assessments on units it still owns. Or it just subsidizes the shortfall. Either way the budget you inherit reflects a subsidy that is about to stop.

Nevada makes the developer say it out loud. NRS 116.31038(3)(b) requires the declarant to "disclose, in writing, the amount by which the declarant has subsidized the association's dues on a per unit or per lot basis." Ask for that number in every state. Then commission your own reserve study from an independent professional and rebuild the budget from it. Expect the honest number to be materially higher, and tell owners why before the vote, not after.

## The first 90 days

Take control of the bank accounts and change the signers. Log every document received against the statutory list and put the developer on written notice of what is missing, with a date. Order the audit if the statute does not order it for you. Pull every contract, calendar every termination and renewal date, and flag anything signed with a developer affiliate. Get insurance issued in the association's name. Commission the reserve study and the building condition assessment together, then build the first real budget from them. Have a lawyer review the developer's remaining obligations and the warranty and repose deadlines before any of them pass.`,
    sources: [
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.301",
        note: "2026 Fla. Stat. § 718.301: subsection (1) turnover triggers including 15%, three years after 50%, three months after 90%, and seven years after recording; subsection (4) turnover document list items (a) through (s), the 90 day deadline for paragraph (c), and the independent CPA audit language",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.307",
        note: "2026 Fla. Stat. § 720.307: three months after 90% of parcels conveyed, one board member at 50%, developer board seat while holding 5%, subsection (4) 90 day document delivery, audit requirement for associations incorporated after December 31, 2007",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.302",
        note: "2026 Fla. Stat. § 718.302: cancellation of pre-turnover grants, contracts, and leases, 75% of non-developer voting interests, 18 month window for purchase or lease arrangements",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.309",
        note: "2026 Fla. Stat. § 720.309 verbatim: subsection (1) fair and reasonable standard for pre-turnover contracts with terms greater than 10 years",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.116",
        note: "2026 Fla. Stat. § 718.116(9): developer guarantee of assessments and excuse from paying assessments on developer-owned units, deficit funding obligation",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/95.11",
        note: "2026 Fla. Stat. § 95.11(3)(b): four year limitation and seven year repose for actions founded on design, planning, or construction of an improvement to real property; history note s. 2, ch. 2025-81",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.nv.us/NRS/NRS-116.html",
        note: "NRS 116.31032 full text (period of declarant control, 75%/90%/five year triggers, 25% and 50% board seat triggers); NRS 116.31038 full text (30 day delivery, audited statements, 210 day ancillary audit at declarant expense, reserve study by a registered specialist, reserve account delivery, written disclosure of the amount the declarant subsidized dues, and the full document list); NRS 116.3111(3) tolling of limitations during declarant control; NRS 116.310395 converted building reserve deficit",
        fetched: "2026-08-26",
      },
      {
        url: "https://colorado.public.law/statutes/crs_38-33.3-303",
        note: "C.R.S. § 38-33.3-303(5) and (6): 60 days after 75% conveyance, two years after last conveyance, two years after last exercise of the right to add units; 25% and 50% board seat triggers; large planned community variant",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.415",
        note: "RCW 64.90.415: termination of declarant control at 60 days after 75% conveyance, two years after last conveyance, two years after last exercise of the right to add units; 25% and 33 1/3% board seat triggers; transition meeting",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.420",
        note: "RCW 64.90.420: declarant delivery of property and records no later than 30 days after the transition meeting, document list, and CPA audit within 60 days after the transition meeting unless waived",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title55.1/chapter19/section55.1-1943/",
        note: "Va. Code § 55.1-1943: declarant control capped at the earlier of the instruments' time limit or conveyance of three fourths of undivided interests; five, three, and two year caps by condominium type; extension to 15 years by two thirds vote plus a warranty review committee; subsection C two year contract cap and 90 day termination right exercisable within 60 days after control ends",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47C/GS_47C-3-103.html",
        note: "N.C. Gen. Stat. § 47C-3-103(d) and (e): 120 days after 75% conveyance, two years after declarants ceased offering units, two years after last development right exercised; 25% and 50% board seat triggers",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47F/GS_47F-3-103.html",
        note: "N.C. Gen. Stat. § 47F-3-103(d): declaration may provide for declarant control with no statutory outer limit in the Planned Community Act",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.hud.gov/sites/dfiles/OCHCO/documents/4000.1hsgh.pdf",
        note: "HUD Handbook 4000.1 section II.C.2 transfer of control: relinquish control by the earlier of 120 days after 75% conveyance, three years after completion, or the state law time frame; assigned developer contracts must be terminable on no more than 90 days' notice",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "first-30-days-self-managed-board",
    title: "The first 30 days of a self-managed board",
    summary: "An ordered plan for a new board, grounded in the filings and deadlines that actually bind",
    topic: "Getting started",
    readMinutes: 6,
    publishedDate: "2026-08-26",
    photoBrief: "a kitchen table with a bank signature card, a state annual report form, a checkbook, and a stack of manila folders of association records",
    body: `A new board inherits obligations, not a clean slate. This is what to do in the first month, in order, and why each item is a legal requirement rather than a nice idea.

## Week one, get control of the money

Find out how many bank accounts exist, who can sign on them, and whether operating and reserve funds are actually separate. Update the signature cards first, and require two approvals to move money. Sole control of the funds by one person is the most common way self-managed associations lose them.

The FDIC insures $250,000 per depositor, per insured bank, for each account ownership category, and all deposits owned by a corporation, partnership, or unincorporated association at one bank are combined into a single $250,000 limit. A second account at the same bank does not double the coverage. Associations holding more than that split the balance across institutions or use a deposit placement network, which parks portions at other network banks so each slice stays insured.

Confirm the association has its own Employer Identification Number. The application is Form SS-4, and the IRS says plainly that you never have to pay a fee for an EIN. The online application is open Monday through Friday from 6 a.m. to 1 a.m. Eastern, and issuance is limited to one EIN per responsible party per day.

## Week two, confirm the association still legally exists

Pull the association's record at the Secretary of State. Most associations are nonprofit corporations, and nonprofit corporation statutes require an annual report.

In Florida the report is due between January 1 and May 1 under Fla. Stat. § 617.1622, and administrative dissolution for failing to file happens on the fourth Friday in September under Fla. Stat. § 617.1421. A dissolved corporation continues to exist but may not conduct any affairs except winding up, and directors and officers who keep acting with actual notice of the dissolution can be personally liable.

Texas shows the same failure in a different shape. On forfeiture of corporate privileges, Tex. Tax Code § 171.252 denies the corporation the right to sue or defend in a Texas court, and Tex. Tax Code § 171.255 makes each director and officer personally liable for debts created after the report or tax was due. Losing the right to sue means losing the ability to enforce an assessment lien.

Check the registered agent while you are there. Florida requires a corporation to continuously maintain a registered office and a registered agent (Fla. Stat. § 617.0501). The usual failure is an agent who is a management company you fired or a board member who moved away, so lawsuits and state notices go to a dead address until a default judgment arrives.

## Week three, state registration and the federal filing that no longer applies

Several states require a separate registration on top of the Secretary of State, and the penalty is usually aimed at collections. Colorado requires every unit owners' association to register annually with the director of the Division of Real Estate under C.R.S. § 38-33.3-401. Registration is valid for one year, and if it lapses the association's right to impose or enforce an assessment lien is suspended until it registers again. Utah requires registration with the Department of Commerce within 90 days of recording the declaration under Utah Code § 57-8a-105, with the same lien consequence, and House Bill 217, effective May 7, 2025, added an annual renewal, currently $90, due at the end of the anniversary month.

Virginia requires an annual report to the Common Interest Community Board under Va. Code § 55.1-1835. Under 18VAC48-60-15 a property owners' association files within 30 days of recordation of the declaration, a condominium association within 30 days after declarant control ends, then annually. Nevada charges an annual per unit fee under NRS 116.31155, capped by statute at $5 and set at $4.25 by NAC 116.445, and the association registers with the Ombudsman on Form 562 when it pays.

Texas requires a management certificate recorded in each county containing the subdivision and filed electronically with the Texas Real Estate Commission within seven days, with an amended certificate due within 30 days after notice of a change (Tex. Prop. Code § 209.004). A board turnover is such a change. Florida runs the other way: condominium associations pay $4 per residential unit to the Division by March 1 under Fla. Stat. § 718.501(2), with a 10% penalty and loss of standing to sue or defend until paid, while associations under chapter 720 have no equivalent registration at all.

Federal beneficial ownership reporting is off the table. FinCEN's interim final rule of March 26, 2025 narrowed the definition of reporting company to entities formed under foreign law, and the final rule published August 14, 2026 made that permanent for domestic companies and U.S. persons. Associations formed in the United States do not file, and should not pay anyone to file for them.

## Week four, insurance, the bond, and the reserve study

Get the current declarations page for every policy and read the named insured line. Fannie Mae requires the master property or flood policy to designate the HOA as the named insured for both condo and PUD projects (Selling Guide B7-3-08). Policies still naming the developer or a dissolved predecessor are common in young associations, and they surface when a buyer's lender asks.

Then check fidelity or crime coverage. Fannie Mae B7-4-02 requires it for condo and co-op projects, excepting projects of 20 units or fewer and coverage of $5,000 or less. With financial controls in place the required amount is three months of assessments on all units; without them it is the maximum funds in the custody of the association or its management agent at any time, and the agent's own policy is not an acceptable substitute.

California sets a statutory floor at the reserves plus three months of assessments, requires an equal amount of computer fraud and funds transfer fraud coverage, requires the managing agent to be covered, and says self insurance does not count (Cal. Civ. Code § 5806).

Build the records system now, because owners can demand records on short notice. Florida requires the official records to be kept at least seven years and produced for inspection within 10 business days of a written request (Fla. Stat. § 720.303(4) and (5)). The practical minimum is governing documents, minutes, adopted budgets, bank statements, tax returns, insurance policies, vendor contracts and the owner roster, in one place two people can reach.

Order the reserve study in month one, because it sets next year's assessment and ordering it in October is already too late for a January budget. California requires a visual inspection of the major components at least every three years and an annual board review (Cal. Civ. Code § 5550). Have an attorney who works with community associations read your governing documents once against this list, since your declaration may add obligations the statutes do not.`,
    sources: [
      {
        url: "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
        note: "online EIN application hours, one EIN per responsible party per day, no fee",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.irs.gov/forms-pubs/about-form-ss-4",
        note: "Form SS-4 title and purpose",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.irs.gov/instructions/iss4",
        note: "\"you can apply for and receive an EIN free of charge on IRS.gov\", responsible party definition",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.fdic.gov/resources/deposit-insurance/brochures/documents/your-insured-deposits-english.html",
        note: "$250,000 per depositor per insured bank per ownership category; corporation, partnership and unincorporated association deposits combined",
        fetched: "2026-08-26",
      },
      {
        url: "https://ncua.gov/regulation-supervision/regulatory-compliance-resources/liquidity-risk-resources/brokered-and-reciprocal-deposits-faq",
        note: "how a deposit placement network spreads a balance across network institutions",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2025/617.1622",
        note: "Florida nonprofit annual report due January 1 to May 1",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2025/617.1421",
        note: "administrative dissolution on the fourth Friday in September, effect of dissolution, officer liability",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2025/617.0501",
        note: "registered office and registered agent requirement",
        fetched: "2026-08-26",
      },
      {
        url: "https://texas.public.law/statutes/tex._tax_code_section_171.252",
        note: "forfeiture denies the right to sue or defend",
        fetched: "2026-08-26",
      },
      {
        url: "https://texas.public.law/statutes/tex._tax_code_section_171.255",
        note: "director and officer personal liability after forfeiture",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/co/title-38-property-real-and-personal/co-rev-st-sect-38-33-3-401.html",
        note: "C.R.S. 38-33.3-401 annual registration, one year validity, lien enforcement suspended, current as of January 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/SB25-184",
        note: "HOA Information and Resource Center continued to September 1, 2030, signed May 24, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/~2025/bills/hbillenr/HB0217.pdf",
        note: "enrolled Utah HB 217 amending 57-8a-105, annual renewal, 90 day registration, lien consequences, effective May 7, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://commerce.utah.gov/hoa/renew-your-hoa-registration/",
        note: "$90 annual renewal fee, anniversary month deadline, liens unenforceable if not current",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title55.1/chapter18/section55.1-1835/",
        note: "annual report to the Common Interest Community Board",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/boardcode/title18/agency48/chapter60/section15/",
        note: "18VAC48-60-15 timeframes for registration and annual report",
        fetched: "2026-08-26",
      },
      {
        url: "https://register.dls.virginia.gov/details.aspx?id=12050",
        note: "18VAC48-60 final regulation effective December 31, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://nevada.public.law/statutes/nrs_116.31155",
        note: "per unit fee capped at $5, administrative penalty",
        fetched: "2026-08-26",
      },
      {
        url: "https://nevada.public.law/statutes/nrs_116.31158",
        note: "registration with the Ombudsman at the time the fee is paid",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.nv.us/nac/nac-116.html",
        note: "NAC 116.445 sets the fee at $4.25 per unit on and after July 1, 2016",
        fetched: "2026-08-26",
      },
      {
        url: "https://red.nv.gov/uploadedfiles/rednvgov/Content/CIC/Manual/CIC_Manual.pdf",
        note: "NRED CIC Educational Manual, Form 562 Annual Association Registration",
        fetched: "2026-08-26",
      },
      {
        url: "https://texas.public.law/statutes/tex._prop._code_section_209.004",
        note: "management certificate recording, seven day TREC filing, 30 day amendment",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2025/718.501",
        note: "$4 per residential unit by March 1, 10% penalty, loss of standing",
        fetched: "2026-08-26",
      },
      {
        url: "https://www2.myfloridalicense.com/condos-timeshares-mobile-homes/homeowners-associations/",
        note: "Division arbitrates election and recall disputes only under chapter 720",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.federalregister.gov/api/v1/documents/2025-05199.json",
        note: "FinCEN interim final rule published and effective March 26, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.federalregister.gov/api/v1/documents/2026-16576.json",
        note: "FinCEN final rule published and effective August 14, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.gtlaw.com/en/insights/2026/8/fincen-final-rule-permanently-ends-beneficial-ownership-reporting-requirements-for-us-companies-and-us-persons",
        note: "secondary confirmation the final rule issued August 11, 2026 and adopts the March 2025 exemptions",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b7-3-08/mortgagee-clause-named-insured-and-notice-cancellation-requirements",
        note: "master policy must designate the HOA as named insured, last updated December 14, 2022",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b7-4-02/fidelitycrime-insurance-requirements-project-developments",
        note: "fidelity and crime requirement, 20 unit and $5,000 exceptions, coverage formula, management agent policy not a substitute, last updated August 5, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5806",
        note: "California coverage amount, managing agent coverage, no self insurance",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2025/720.303",
        note: "official records kept 7 years, inspection within 10 business days",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5550",
        note: "visual inspection at least every three years, annual board review",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "billing-utilities-back-to-owners",
    title: "Billing utilities back to owners: submetering, RUBS, and the law",
    summary: "Master meter, submeter, or RUBS: what each one is, what the law allows, and where boards get caught",
    topic: "Money",
    readMinutes: 20,
    publishedDate: "2026-08-26",
    photoBrief: "a bank of residential water submeters mounted on a wall in a condominium mechanical room, registers and shutoff valves visible",
    body: `Your association gets one utility bill for the whole property and has to turn it into a charge on each owner's account. There are exactly three ways to do that, they are not equally legal, and in several states the moment you send an owner a bill for water or electricity you become something the utility commission regulates.

## The three models

A master meter means the utility measures the whole property at one meter and sends the association one bill. Nobody is billed for what they used. The cost sits inside the regular assessment, so a single person in a studio pays the same share as a family of five in a three bedroom. It is the simplest model and the least fair.

Submetering means each unit has its own meter, owned and read by the association or its billing agent rather than by the utility, and each unit is billed on the volume that meter recorded. It is a measurement. It can be reconciled: the sum of the unit readings plus common area use should account for the master meter reading.

Ratio utility billing, usually called RUBS, means the association takes the master bill and divides it by a formula. California defines it as "the allocation of water and sewer costs to tenants based on the square footage, occupancy, or other physical factors of a dwelling unit" in Cal. Civ. Code § 1954.202. Common factors are square footage, number of occupants, bedroom count, and fixture count. No meter is involved.

## What RUBS actually is, and what it is not

RUBS is an allocation, not a measurement. As the National Consumer Law Center puts it, a RUBS bill "is not determined by calculating a particular tenant's utility usage." If an owner asks you to prove their bill, you cannot. There is no reading to point to. You can only show them the formula and the master bill.

That is the whole fairness objection, and it is a real one. Two identical units pay identical RUBS bills whether one sat empty all month and the other ran the dishwasher daily. A leak inside one unit gets spread across everyone. A conservation-minded owner sees no benefit from conserving. NCLC also flags the practical problems: owners rarely see the formula, rarely see the master bill, and cannot compare their charge to a neighbor's.

Courts and regulators have started to say so. In Northland Investment Corp. v. Public Utilities Regulatory Authority, SC 20769, the Connecticut Supreme Court held in 2024 that ratio utility billing violates Conn. Gen. Stat. § 16-262e(c), because the statute allows a landlord to allocate only utility service the occupant used exclusively. In October 2025 the California Attorney General settled with a property manager for $495,000 over RUBS charges that pushed total housing cost past the state rent cap.

## Submetering: equipment, reading, and standards

A submeter is a revenue-grade meter. It is installed on the branch serving one unit, it is certified and calibrated for billing, and it belongs to the association or its agent, not the utility. A check meter is the same idea in hardware but is used for internal monitoring only. It is not calibrated or certified for billing, and billing an owner off a check meter is how associations end up refunding money.

There are real national standards, and two states import them by name. For water, the American Water Works Association publishes ANSI/AWWA C700 for displacement meters in a metal alloy case, C710 for the plastic case version, C708 for multijet meters, and C712 for singlejet meters, among others. North Carolina writes the requirement straight into statute: under N.C. Gen. Stat. § 62-110(g)(1a)c, "all equipment used to measure water usage shall comply with guidelines promulgated by the American Water Works Association." Texas rule 16 TAC § 24.287 requires AWWA compliance, calibration as close as possible to zero error, and evidence of a test within the preceding 24 months.

For electricity the standard is the ANSI C12 family, including ANSI C12.20-2015, the American National Standard for Electricity Meters, 0.1, 0.2, and 0.5 Accuracy Classes, published with NEMA as secretariat. Texas rule 16 TAC § 25.142 requires submeters to meet ANSI Standard C12 accuracy for self-contained watt-hour meters, requires annual testing of non-electromechanical meters, requires reference standards to be calibrated annually and test equipment every 120 days, and lets an owner charge a tenant up to $15 for a requested test only if the meter turns out to be accurate.

Someone has to read the meters, and it is not the utility. Texas requires electric submeters to be read within three days of the scheduled reading date of the utility's master meter, and requires bills to cover the same billing period the utility used. Read on a different cycle than the master bill and your reconciliation will never close.

## The legal trap: you may become a utility

This is the part boards do not see coming. In several states, charging a resident for utility service is itself a regulated activity, and doing it without registering is a violation before anyone has been overcharged a cent.

North Carolina is the clearest. Utilities Commission Rule R18-3 says every provider "is a public utility as defined by G.S. 62-3(23)a.2 and shall comply with all applicable provisions of the Public Utilities Act." No provider may begin charging before applying for and receiving a certificate of authority. Texas requires registration with the Public Utility Commission under 16 TAC § 24.277, and gives the commission exclusive jurisdiction over violations under Tex. Water Code § 13.505(b), with mandatory restitution of overcharges under § 13.505(c).

The second trap is markup. Reselling electricity above cost is flatly prohibited in Texas, where 16 TAC § 25.142 says the owner "shall not impose any extra charges on the tenant over and above those charges which are billed by the retail electric provider or utility to the owner." Florida draws the same line for electricity by defining what "cost" may include. Where a fee is allowed, it is small, capped, and named in a rule.

## Texas

Texas is the most heavily regulated state and the detail is worth reading even if you are elsewhere, because it is the template other states borrow from.

Water and wastewater sit in Tex. Water Code ch. 13, subch. M and 16 TAC ch. 24, subch. I, sections 24.275 through 24.287. Condominiums are squarely inside it. Tex. Water Code § 13.501 defines an apartment house as a building with five or more dwelling units for nontransient use "including a residential condominium whether rented or owner occupied," and separately defines a condominium manager as an association organized under Property Code § 82.101 or a council of owners entity under chapter 81.

An owner or condominium manager who intends to bill for submetered or allocated service must register with the commission in a form it prescribes, under 16 TAC § 24.277. The commission's online registration lists Condominium as a property type and requires a condominium affidavit and a copy of the condominium contract. Under Tex. Water Code § 13.502(b), property where construction began after January 1, 2003 must have individual meters or submeters. Under § 13.502(e), you cannot switch from submetered billing back to allocated billing without written commission approval for good cause.

Charges are capped. Under 16 TAC § 24.281, only water and wastewater bills from the retail public utility may be passed through, and deposits, disconnect, reconnect and late payment fees the utility charged the owner may not be. Tex. Water Code § 13.503 permits a service charge of not more than 9 percent of the costs related to submetering, but the statute grants it to apartment house and manufactured home rental community owners and does not extend it to condominium managers, and it may not be charged to a resident in a low income housing tax credit unit or one receiving tenant-based voucher assistance.

The permitted allocation formulas are specified rather than left to the board. The occupancy method divides occupants in a unit by total occupants. The ratio occupancy method weights them: one occupant counts as 1.0, two as 1.6, three as 2.2, and 0.4 for each additional occupant. The estimated occupancy method uses bedrooms: an efficiency counts as 1, one bedroom as 1.6, two as 2.8, three as 4.0, and 1.2 for each additional bedroom. Square footage may carry no more than 50 percent of the weight. Condominium managers may instead use the method set out in the condominium contract.

Common area water must come off the top before anything is allocated. The commission's registration sets the deductions: if there is an installed irrigation system that is not separately metered, deduct at least 25 percent of the utility's total charges; if irrigation is separately metered, deduct the actual irrigation charges and then at least 5 percent more; if there is no irrigation system at all, deduct at least 5 percent.

Every bill has required content under 16 TAC § 24.283: the total due for submetered or allocated water and wastewater, base and customer service charges, the name of the retail public utility, and a plain statement that the bill is not from the retail public utility. For submetered service it must show total gallons or liters and the cost per unit. The due date may not be less than 16 days after the bill is mailed or hand delivered. A one-time late penalty of no more than 5 percent is allowed only if agreed in writing. A written dispute must be investigated and answered in writing within 30 days.

Records must be kept for the current year and the previous calendar year, and submeter test results until the submeter is permanently removed from service. A resident may see them: within three days if they are on site, 15 days if they must be retrieved from elsewhere.

Electricity is governed separately by 16 TAC ch. 25, subch. G, section 25.142, which also defines apartment house to include a rented or owner-occupied residential condominium. The math is prescribed: divide the net total charges for electrical consumption plus applicable tax by total kilowatt hours to get an average cost per kilowatt hour, then multiply by each unit's metered consumption. Utility penalties are excluded. The lease or rules must state that the unit is submetered, that common area electricity is the owner's responsibility, and that billing disputes are between the resident and the owner, and a copy of the rule or an approved summary must be handed over at signing. Records go back the current month and 12 preceding months.

## California

California regulates water submetering in rental housing and, critically, exempts associations from that scheme. Cal. Civ. Code ch. 2.5, sections 1954.201 through 1954.219, defines "landlord" in § 1954.202 to exclude a common interest development as defined in § 4100. The 10-point-type pre-billing disclosure in § 1954.204 and the charge limits in § 1954.205, including the administrative fee capped at the lesser of $4.75 or 25 percent of usage charges, do not apply to an HOA billing its own members. Section 1954.216(c) adds that nothing in the chapter creates a policy favoring or disfavoring RUBS.

New construction is a different story. Under Water Code § 537.1, a water purveyor must require measurement of water supplied to each dwelling unit as a condition of new water service for a newly constructed multiunit residential or mixed-use structure whose water connection application was submitted after January 1, 2018. The owner installs and reads submeters unless the purveyor agrees to install and read individual meters. Water Code § 537(b) requires the submeter to be a type approved under Bus. & Prof. Code § 12500.5.

On whether an association may charge a utility cost as an assessment, Davis-Stirling gives you the frame rather than an answer. Cal. Civ. Code § 5600(a) requires the association to levy assessments sufficient to perform its obligations under the governing documents, and § 5600(b) says an association "shall not impose or collect an assessment or fee that exceeds the amount necessary to defray the costs for which it is levied." That is a no-markup rule in all but name. Section 5725(b) is the related warning: a monetary penalty imposed as discipline may not be treated as an assessment that becomes a lien.

## Florida

For condominiums, Fla. Stat. § 718.115(1) makes water and sewer service a common expense where a master meter serves the condominium, unless the declaration addresses the manner of payment or allocation. That means the declaration is what lets you bill individually.

Electricity apportionment is a Public Service Commission matter. Fla. Admin. Code R. 25-6.049(9) allows reasonable apportionment methods including submetering, solely to allocate the cost of electricity billed by the utility. "Cost" is defined as only the charges specifically authorized by the electric utility's tariff, and expressly excludes late payment charges, returned check charges, the cost of the customer-owned distribution system behind the master meter, and the customer of record's own cost of billing the units. In other words, no markup and no passing along your billing expense.

Water resale has a numeric safe harbor. Fla. Stat. § 367.022(9) exempts from PSC regulation any person reselling water service "for a fee that does not exceed the actual purchase price of the water and wastewater service plus the actual cost of meter reading and billing, not to exceed 9 percent of the actual cost of service." Section 367.022(7) separately exempts nonprofit corporations and associations providing service solely to members who own and control them.

## North Carolina

North Carolina names associations directly. N.C. Gen. Stat. § 62-110(g) authorizes a lessor, an owners' association in a planned community serving townhomes, and a unit owners' association in a condominium to charge for the costs of providing water or sewer service. All three must apply to the Utilities Commission for authority; the Commission approves or disapproves within 30 days and an application not disapproved in 30 days is deemed approved.

North Carolina also bans RUBS. Under § 62-110(g)(1), charges must be based on metered measurement of all water consumed, and the rate may not exceed the unit consumption rate charged by the supplier. Section 62-110(g)(1a)a says a lessor "shall not utilize a ratio utility billing system or other allocation billing system that does not rely on individually submetered hot water usage," and the narrow hot water allocation alternative it creates is limited to contiguous dwelling units built before 1989 where full metering is impractical, and requires separate Commission authorization.

The administrative fee is fixed by rule at not more than $3.75 under NCUC Rule R18-6(a). Rule R18-7 forbids connection, disconnection and late fees entirely, forbids disconnection for nonpayment, requires monthly billing, and requires a due date not less than 25 days after the billing date. Rule R18-8 sets the common area deduction: reduce total water purchased by 20 percent by default, or subtract actual metered common area usage, or subtract 15 percent for an unmetered irrigation system and 5 percent for each unmetered pool or laundry room.

## Virginia

Virginia's submetering rules for electricity and natural gas apply to condominiums by definition. Va. Code § 56-245.2 defines apartment house to include "residential condominiums and cooperatives, whether rented or owner occupied." Under § 56-245.3, the State Corporation Commission sets the standards, submetering equipment is subject to the same accuracy, testing and recordkeeping regulations as utility-owned meters, and the owner may not charge more than the utility charged per kilowatt hour, cubic foot or therm plus demand and customer charges and taxes, except for service charges permitted by Va. Code § 55.1-1212 for residential tenancies or § 55.1-1404 for nonresidential. Records must be available for Commission inspection during business hours.

Section 55.1-1212 in the Virginia Residential Landlord and Tenant Act permits energy submetering, energy allocation equipment, water and sewer submetering, and ratio utility billing where clearly stated in the lease, allows billing fees covering actual administrative cost, caps the late charge at $5 after 15 days, and lets a tenant demand equipment testing without charge once every 24 months. A revised version of that section takes effect July 1, 2027 and adds a recordkeeping duty covering how billing fees are calculated.

## Illinois

Illinois has a short statute that speaks to associations by name. The Tenant Utility Payment Disclosure Act, 765 ILCS 740, provides in Section 5(b) that no condominium or common interest community association may demand payment for master metered public utility services from a unit owner for a proportionate share without first providing the unit owner a written copy of the formula used for allocating the payments. The total of payments under the formula for the association as a whole for the annual budgeted billing period may not exceed the sum demanded by the public utility. Surplus may go to a deficit, to reserves, or as a credit against the following year.

## Colorado

Colorado's rules are new and they are landlord rules, not association rules. C.R.S. § 6-1-737, created by HB25-1090 and effective January 1, 2026, bars a landlord from requiring a tenant to pay a utility-related charge above the amount the utility provider charged, except as permitted by C.R.S. § 38-12-801(3)(a)(VI), which allows "a markup or fee in an amount that does not exceed two percent of the amount that the landlord was billed or a markup or fee in an amount that does not exceed a total of ten dollars per month, but not both."

HB26-1013, signed March 26, 2026, then added § 6-1-737(4.5) to confirm RUBS is allowed for landlords on four conditions: the aggregate billed to all tenants may not exceed what the utility charged for the whole premises, no markup or administrative fee beyond actual charges except as otherwise permitted by law, common area and shared facility costs excluded from any tenant allocation, and the allocation method clearly and conspicuously disclosed in the rental agreement or an addendum. The same bill provides that for residential premises built under permits applied for on or after July 1, 2027, gas, electric and water service must be metered directly by the utility or by a submeter. None of this reaches unit owners' associations, but the four conditions are a sound checklist for any board.

## Georgia and Arizona

Georgia requires the plumbing but says little about the billing. O.C.G.A. § 12-5-180.1(c) requires all new multiunit residential buildings permitted on or after July 1, 2012 to be constructed so water use by each unit can be measured. Subsection (e)(3) caps recovery: total charges to the units may not exceed the total the owner or operator paid for water and wastewater service for the building, plus a reasonable fee for establishing, servicing and billing. The statute addresses the owner or operator of a building containing residential units and does not name condominium or owners' associations.

Arizona's rule is in landlord-tenant law. A.R.S. § 33-1314.01 permits a landlord to charge separately by submeter or by a ratio utility billing system, permits recovery of the utility's charges plus an administrative fee for actual administrative costs only, and requires the rental agreement to list which utilities are charged separately and state the amount of the administrative fee. The bill must show meter readings and dates and the administrative fee. Permitted allocation methods include per tenant, square footage, unit type, water fixture count, hot water submetering, and any other method that fairly allocates and is described in the agreement.

## Nevada, Washington, and Utah

Nevada gives associations a direct instruction. NRS 116.3115(4)(c) provides that "the costs of utilities must be assessed in proportion to usage." Read literally that pushes toward metering rather than a flat share.

Washington has no submetering statute; a bill to create one, SB 5775 in the 2019-20 session, did not pass. What Washington does have is RCW 64.90.480(4)(d), which lets a declaration provide that common expenses be assessed as the costs of specified services or utilities "in proportion to respective usage, whether metered, billed in bulk based on unit count, or reasonably estimated, or upon the same basis as such charges are made by the service or utility provider." The declaration has to say so.

Utah is the useful blank. We found no Utah submetering or ratio billing statute and no utility commission rule governing an association that bills its members. That is not permission. It means the only limits on you are your declaration and general law, and the only person who will tell you that you got it wrong is an owner with a lawyer.

## Fair housing and occupancy formulas

An occupancy-based RUBS formula charges a household of five more than a household of one for the same unit. Familial status is a protected class under the Fair Housing Act, and charging families with children more is the shape of a disparate impact claim. We could not find a HUD determination or a court decision holding that occupancy-based utility allocation violates the Fair Housing Act, and we are not going to invent one.

What we can say is that regulators who have set formulas do not charge per head in a straight line. Texas weights occupants at 1.0, 1.6, 2.2 and then 0.4 each, which flattens the curve sharply. If you use occupancy, use a weighting like that, document why you chose it, and be able to show that the weighting tracks actual consumption rather than headcount.

## Your declaration is the real gate

Before any of this matters, read the declaration. It has to permit the charge, and it has to permit it in a form you can collect. Florida makes the point plainly: under Fla. Stat. § 718.115(1), master metered water and sewer is a common expense unless the declaration addresses allocation differently. Washington requires the declaration to provide for usage-based allocation before you can use it.

The distinction that bites is between an assessment and a charge. An assessment is generally lienable and foreclosable. A miscellaneous charge often is not, and in California a monetary penalty explicitly cannot be treated as a lienable assessment under Cal. Civ. Code § 5725(b). If your documents let you bill utilities as a common expense assessment, you have real collection remedies. If they let you bill it only as a fee, you may be left suing in small claims for $40 a month. Find out which before you build the program.

## What a careful board does

Reconcile every month. The sum of what you billed all units, plus your common area deduction, should equal the master bill. If it does not, you have a leak, a misread meter, or a formula error, and you want to find it before an owner does.

Publish the formula and put the arithmetic on the statement. Every bill should show the master bill total, the common area deduction, the unit's factor or reading, and the resulting share. Texas requires most of that by rule and it is good practice everywhere. Keep the vacancy rule consistent: allocate among units occupied at the start of the billing period, and divide fixed customer service charges across all units including vacant ones so the association is not quietly absorbing them.

Never mark up. Not a dollar, not a percent, unless a statute or rule in your state names the fee and the cap. If you use a third-party billing company, its fee is a charge to the association, and passing it through to owners is exactly what Florida's definition of cost and Texas's charge rule forbid. Charge it back only if your state permits it and your documents allow it. One conversation with a community association attorney before you launch is cheaper than a restitution order.`,
    sources: [
      {
        url: "https://texas.public.law/statutes/tex._water_code_section_13.501",
        note: "Texas Water Code § 13.501 definitions of apartment house and condominium manager, current through May 26 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://texas.public.law/statutes/tex._water_code_section_13.502",
        note: "Texas Water Code § 13.502 submetering, Jan 1 2003 construction trigger, no switch from submetered to allocated without PUC approval",
        fetched: "2026-08-26",
      },
      {
        url: "https://texas.public.law/statutes/tex._water_code_section_13.503",
        note: "Texas Water Code § 13.503 the 9 percent service charge and its exclusions, 5 percent late fee",
        fetched: "2026-08-26",
      },
      {
        url: "https://texas.public.law/statutes/tex._water_code_section_13.504",
        note: "Texas Water Code § 13.504 improper rental rate increase",
        fetched: "2026-08-26",
      },
      {
        url: "https://texas.public.law/statutes/tex._water_code_section_13.505",
        note: "Texas Water Code § 13.505 restitution and PUC exclusive jurisdiction",
        fetched: "2026-08-26",
      },
      {
        url: "http://txrules.elaws.us/rule/title16_chapter24_sec.24.275",
        note: "16 TAC § 24.275 scope and definitions, property types covered",
        fetched: "2026-08-26",
      },
      {
        url: "http://txrules.elaws.us/rule/title16_chapter24_sec.24.277",
        note: "16 TAC § 24.277 registration and record retention",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.law.cornell.edu/regulations/texas/16-Tex-Admin-Code-SS-24-277",
        note: "16 TAC § 24.277 corroboration, records access deadlines",
        fetched: "2026-08-26",
      },
      {
        url: "http://txrules.elaws.us/rule/title16_chapter24_sec.24.279",
        note: "16 TAC § 24.279 rental agreement disclosures",
        fetched: "2026-08-26",
      },
      {
        url: "http://txrules.elaws.us/rule/title16_chapter24_sec.24.281",
        note: "16 TAC § 24.281 charges, allocation formulas, 50 percent square footage cap, vacant unit treatment",
        fetched: "2026-08-26",
      },
      {
        url: "http://txrules.elaws.us/rule/title16_chapter24_sec.24.283",
        note: "16 TAC § 24.283 required bill contents, 16 day due date, 5 percent penalty, 30 day dispute response",
        fetched: "2026-08-26",
      },
      {
        url: "http://txrules.elaws.us/rule/title16_chapter24_sec.24.287",
        note: "16 TAC § 24.287 AWWA standards, 24 month calibration, $25 test charge",
        fetched: "2026-08-26",
      },
      {
        url: "http://txrules.elaws.us/rule/title16_chapter25_sec.25.142",
        note: "16 TAC § 25.142 electric submetering, no markup, ANSI C12, computation, lease disclosure, records",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.puc.texas.gov/submeter/",
        note: "PUCT registration form: condominium property type, condominium affidavit and contract, occupancy weighting tables, common area deduction percentages",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=WAT&sectionNum=537.",
        note: "Cal. Water Code § 537 exemptions and submeter type approval",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=WAT&sectionNum=537.1.",
        note: "Cal. Water Code § 537.1 January 1 2018 new construction trigger",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1954.201.",
        note: "Cal. Civ. Code § 1954.201 chapter intent",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ca/civil-code/civ-sect-1954-202/",
        note: "Cal. Civ. Code § 1954.202 definitions, common interest development excluded from \"landlord\", RUBS defined",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1954.204.",
        note: "Cal. Civ. Code § 1954.204 pre-billing disclosure",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ca/civil-code/civ-sect-1954-205/",
        note: "Cal. Civ. Code § 1954.205 permitted charges and the $4.75 or 25 percent administrative fee",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1954.216.",
        note: "Cal. Civ. Code § 1954.216(c) no policy favoring or disfavoring RUBS",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4100.",
        note: "Cal. Civ. Code § 4100 definition of common interest development",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5600.",
        note: "Cal. Civ. Code § 5600 assessments may not exceed the cost defrayed",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5725.",
        note: "Cal. Civ. Code § 5725(b) penalties may not be treated as lienable assessments",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4740.",
        note: "Cal. Civ. Code § 4740 is rental restrictions, not utilities",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2025/718.115",
        note: "Fla. Stat. § 718.115(1) master metered water and sewer as common expense unless the declaration provides otherwise",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-25-6-049",
        note: "Fla. Admin. Code R. 25-6.049 definition of cost and exclusions",
        fetched: "2026-08-26",
      },
      {
        url: "https://flrules.elaws.us/fac/25-6.049",
        note: "Fla. Admin. Code R. 25-6.049 subsections 5, 6 and 9 on metering, master metering and apportionment",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2025/367.022",
        note: "Fla. Stat. § 367.022(5), (7) and (9) PSC exemptions including the 9 percent water resale limit",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_62/GS_62-110.pdf",
        note: "N.C. Gen. Stat. § 62-110(g) authority for owners associations and unit owners associations, RUBS prohibition, AWWA requirement, bill contents, 30 day approval",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ncuc.gov/ncrules/Chapter18.pdf",
        note: "NCUC Chapter 18 rules R18-2 through R18-8, public utility status, $3.75 administrative fee, no late fees, common area deductions",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title56/chapter10/section56-245.2/",
        note: "Va. Code § 56-245.2 apartment house includes owner-occupied residential condominiums",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title56/chapter10/section56-245.3/",
        note: "Va. Code § 56-245.3 SCC standards, no charges above the utility's rates, recordkeeping",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1212/",
        note: "Va. Code § 55.1-1212 residential submetering and RUBS, $5 late charge, testing every 24 months, July 1 2027 version",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title55.1/chapter14/section55.1-1404/",
        note: "Va. Code § 55.1-1404 nonresidential tenancies, RUBS formula definition",
        fetched: "2026-08-26",
      },
      {
        url: "http://il.elaws.us/law/765ilcs740",
        note: "765 ILCS 740 Section 5(b) condominium and common interest community association formula disclosure and cap",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bill_files/113380/download",
        note: "Colorado HB26-1013 enrolled text creating C.R.S. § 6-1-737(4.5) and the July 1 2027 metering requirement",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb26-1013",
        note: "HB26-1013 signature date March 26 2026 and applicability to landlords",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb25-1090",
        note: "HB25-1090 effective January 1 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/co/title-38-property-real-and-personal/co-rev-st-sect-38-12-801/",
        note: "C.R.S. § 38-12-801(3)(a)(VI) the 2 percent or $10 markup cap",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.hklaw.com/en/insights/publications/2025/12/colorado-ag-issues-guidance-on-new-price-transparency-law",
        note: "Colorado AG guidance, § 6-1-737(4)(a) citation and January 1 2026 effective date",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-12-conservation-and-natural-resources/ga-code-sect-12-5-180-1/",
        note: "O.C.G.A. § 12-5-180.1 July 1 2012 permit trigger and the cost cap in (e)(3)",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/az/title-33-property/az-rev-st-sect-33-1314-01/",
        note: "A.R.S. § 33-1314.01 submetering, RUBS, administrative fee, disclosure and bill contents",
        fetched: "2026-08-26",
      },
      {
        url: "https://nevada.public.law/statutes/nrs_116.3115",
        note: "NRS 116.3115(4)(c) utilities assessed in proportion to usage, current through May 26 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/billsummary?BillNumber=5775&Year=2019",
        note: "Washington SB 5775 did not pass",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.480",
        note: "RCW 64.90.480(4)(d) usage-based allocation if the declaration provides",
        fetched: "2026-08-26",
      },
      {
        url: "https://library.nclc.org/article/introduction-ratio-utility-billing-systems-tenant-advocates",
        note: "NCLC on RUBS, published February 15 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://jud.ct.gov/external/supapp/summaries/docket/20769.htm",
        note: "Northland Investment Corp. v. PURA, SC 20769, RUBS prohibited under Conn. Gen. Stat. § 16-262e(c)",
        fetched: "2026-08-26",
      },
      {
        url: "https://oag.ca.gov/news/press-releases/attorney-general-bonta-announces-settlement-over-use-utility-fees-shadow-rent",
        note: "California AG RUBS settlement, October 24 2025, $495,000",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.awwa.org/AWWA-Articles/awwa-comment-period-on-10-meter-standards/",
        note: "ANSI/AWWA C700, C708, C710, C712 full titles",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.nema.org/docs/default-source/standards-document-library/ansi-c12-20-2015-contents-and-scope.pdf",
        note: "ANSI C12.20-2015 full title and accuracy classes, NEMA secretariat",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "hoa-federal-income-tax",
    title: "HOA federal income tax, 1120-H and 1120",
    summary: "Why a nonprofit association still files a federal return, and what the section 528 election requires",
    topic: "Money",
    readMinutes: 5,
    publishedDate: "2026-08-26",
    photoBrief: "a printed IRS Form 1120-H on a desk beside a calculator, a bank statement, and a spiral bound association budget",
    body: `Being a nonprofit corporation under state law says nothing about federal income tax. Almost every association has to file a federal return, and the choice of which return is an annual decision with money attached.

## Nonprofit does not mean tax exempt

The IRS treats a small number of associations as exempt social welfare organizations under section 501(c)(4), and the bar is high: the common areas have to be open to the public generally rather than to members only, and the association cannot maintain the exteriors of private residences. Most associations do not qualify.

For everyone else the IRS says a homeowners' association that is not exempt under 501(c)(4), and that is a condominium management association, a residential real estate management association, or a timeshare association, generally may elect under Internal Revenue Code § 528 to receive tax benefits that let it exclude exempt function income from gross income. An association that makes no election is a nonexempt membership organization, and IRC § 277 limits deductions for furnishing services to members to the income received from members.

## Form 1120-H and the section 528 election

An association makes the § 528 election by filing a properly completed Form 1120-H, U.S. Income Tax Return for Homeowners Associations. The election is made separately for each tax year and must generally be made by the due date, including extensions. Once the form is filed, the association cannot revoke the election for that year unless the IRS consents. There is an automatic 12 month extension to make the election if corrective action is taken within 12 months of the due date, but that is a rescue, not a plan.

## The 60% test and the 90% test

Two tests decide whether the association can use the form. Under § 528(c)(1)(B), 60% or more of gross income for the taxable year must consist solely of amounts received as membership dues, fees, or assessments from owners of residential units, owners of real property in the case of a residential real estate management association, or holders of timeshare rights. The instructions state it as: at least 60% of the association's gross income for the tax year must consist of exempt function income.

Under § 528(c)(1)(C), 90% or more of the expenditures of the organization for the taxable year must be expenditures for the acquisition, construction, management, maintenance, and care of association property. The instructions phrase the same test as at least 90% of expenses consisting of expenses to acquire, build, manage, maintain, and care for association property.

Exempt function income is what the first test measures. The instructions define it as membership dues, fees, or assessments from owners of condominium housing units, owners of real property, or owners of timeshare rights. The qualifier that decides close cases is that the amounts must come from members as owners, not as customers of the association's services. Interest on reserves, laundry income and clubhouse rental to outsiders are not exempt function income.

## The rate and the $100 deduction

Section 528(b) imposes tax at 30% of homeowners association taxable income, and 32% in the case of a timeshare association. That rate applies only to the non exempt function income, after deductions directly connected with producing it. Section 528 also allows a specific deduction of $100. For an association whose only non exempt income is a few hundred dollars of bank interest, that $100 plus the 30% rate is a very small bill, which is the practical reason most associations file the form.

## Form 1120 as the alternative

An association can instead file Form 1120, the ordinary corporate return, where the rate under IRC § 11(b) is 21% of taxable income. Associations with substantial non exempt income sometimes come out ahead at 21% rather than 30%. The catch is that Form 1120 carries no § 528 exclusion and puts the association into the § 277 regime, where what counts as member income and what counts as a capital contribution becomes the whole argument.

## Revenue Ruling 70-604

Rev. Rul. 70-604, 1970-2 C.B. 9, is the most misquoted document in association accounting. Its holding is narrow: excess assessments by a condominium management corporation, over the amounts actually used to operate the property, that are returned to the stockholder owners or applied against the following year's assessments, are not taxable income to the corporation, because the excess has in effect been returned to the owners.

Two details matter. In the ruling's facts a meeting is held each year by the owners, at which they decide what to do with the excess, so the election is made by the members and not by the board, and it is made every year rather than once.

The other detail is that the ruling does not let an association move excess member income into reserves. IRS Information Letter INFO 2001-0176, released September 28, 2001, said the revenue ruling was not intended to permit a condominium management association to build a reserve. IRS letter 2010-0233, released December 30, 2010, repeated it: Rev. Rul. 70-604 does not provide that an association may exclude from income amounts accumulated in a working capital reserve, citing Rev. Rul. 75-371 for the point that a contingency reserve is generally includible in income.

## Deadlines

An association must generally file by the 15th day of the 4th month after the end of its tax year, which is April 15 for a calendar year association. An association with a June 30 fiscal year end files by the 15th day of the 3rd month. Form 7004, Application for Automatic Extension of Time To File Certain Business Income Tax, Information, and Other Returns, buys an automatic extension, generally six months, and it must be filed on or before the original due date. Form 7004 does not extend the time to pay.

## State taxes are a separate problem

A federal return does not satisfy state obligations. Depending on the state, an association may owe state corporate income tax, a franchise or privilege tax, or an annual report fee that works like one, and the state's definition of taxable income may not follow the federal one. Check the state separately every year.

This is general information, not tax advice for your association. Use a CPA who actually prepares association returns, because the § 528 election, the § 277 rules, and the members' 70-604 vote are three things a general practice preparer will get wrong in the same afternoon.`,
    sources: [
      {
        url: "https://www.irs.gov/charities-non-profits/other-non-profits/homeowners-associations",
        note: "501(c)(4) test for HOAs and the section 528 alternative",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.irs.gov/forms-pubs/about-form-1120-h",
        note: "purpose of Form 1120-H",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.irs.gov/instructions/i1120h",
        note: "60% and 90% tests as stated in the instructions, exempt function income definition, election made separately each year and not revocable without IRS consent, automatic 12 month extension, 30% and 32% rates, $100 specific deduction, due dates, Form 7004",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.law.cornell.edu/uscode/text/26/528",
        note: "statutory text of the 60% and 90% tests, the 30% and 32% rates, and the $100 specific deduction",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.law.cornell.edu/uscode/text/26/277",
        note: "deductions of nonexempt membership organizations limited to member income",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.law.cornell.edu/uscode/text/26/11",
        note: "21% corporate rate",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.irs.gov/instructions/i1120",
        note: "Form 1120 due date, Form 7004, and the note that section 528 electors file Form 1120-H",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.irs.gov/instructions/i7004",
        note: "automatic extension generally six months, must be filed by the original due date, does not extend time to pay",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.irs.gov/pub/irs-wd/01-0176.pdf",
        note: "IRS INFO 2001-0176 released 9/28/2001, \"The revenue ruling was not intended to permit a condominium management association to build a reserve.\"",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.irs.gov/pub/irs-wd/10-0233.pdf",
        note: "IRS 2010-0233 released 12/30/2010, Rev. Rul. 70-604 does not allow exclusion of amounts accumulated in a working capital reserve, cites Rev. Rul. 75-371",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.revenueruling70-604.com/revenue-ruling-70-604",
        note: "reproduction of the Rev. Rul. 70-604 headnote and holding and the annual members' meeting facts",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "hoa-insurance-what-the-association-carries",
    title: "HOA insurance: what the association carries",
    summary: "Master policy, D and O, fidelity bond, and the owner coverage nobody explains",
    topic: "Money",
    readMinutes: 13,
    publishedDate: "2026-08-26",
    photoBrief: "a condominium hallway ceiling with a section of water-stained drywall cut open and drying fans running on the floor",
    body: `Most boards discover the edges of their insurance program during a claim, which is the worst possible time. This is what an association typically carries, what each policy is really for, and the one thing you should tell every owner.

## The master policy

The association's property policy covers the common elements and, depending on the declaration and state law, some or all of the units. Its companion is a commercial general liability policy covering bodily injury and property damage arising out of the use, ownership or maintenance of the common elements. Fannie Mae will not buy a loan in a project whose liability policy provides less than $1 million for bodily injury and property damage for any single occurrence, and it requires the association to be the named insured with premiums paid as a common expense.

Fannie Mae also requires the liability policy to contain a separation of insureds or severability of interests provision, or an endorsement to the same effect, so the insurer cannot deny one insured's claim because of a negligent act by the association or another owner. That requirement, in Selling Guide B7-4-01, is worth checking on your own policy even if nobody in your project is refinancing this year.

## Bare walls, single entity, all in

These three phrases describe where the master property policy stops and the owner's policy starts. Bare walls means the association insures the structure as built and nothing inside the unit: framing, roof, foundation, exterior, and the pipes and wiring in the walls. Single entity adds the fixtures and finishes as originally installed by the builder, so cabinets, counters, flooring and original appliances are on the master policy. All in adds later upgrades and improvements inside the unit.

The declaration and the state statute decide which one you have, not the insurance agent and not the board's preference. Washington's version is a good example of a statutory default. RCW 64.90.470(1)(a) requires property insurance on the common elements at not less than 80 percent of actual cash value, and subsection (2) then says that in a building whose units are divided by horizontal boundaries or by common walls, that insurance "must include the units and, unless provided otherwise in the declaration, all improvements and betterments to the units." Washington's default is all in, and the declaration is what moves it.

The statute keeps going in ways worth knowing. RCW 64.90.470(1)(c) requires fidelity insurance. Subsection (4) requires the policy to make each unit owner an insured for liability arising out of their interest in the common elements, to waive subrogation against unit owners and their households, and to make the association's policy primary where an owner has other insurance on the same risk. Subsection (9) makes repair cost not paid by insurance a common expense.

## Florida

Florida runs the other direction and spells the line out item by item. Fla. Stat. § 718.111(11) makes the association's policy primary for all portions of the condominium property as originally installed or replaced with like kind and quality per the original plans, plus alterations made under s. 718.113(2). It then requires the policy to exclude, and assigns to the unit owner, all personal property within the unit or limited common elements plus floor, wall and ceiling coverings, electrical fixtures, appliances, water heaters, water filters, built-in cabinets and countertops, and window treatments including curtains, drapes, blinds and their hardware, where those items are inside the unit boundaries and serve only that unit.

Florida also fixes how the number is set. Coverage must be based on replacement cost determined by an independent insurance appraisal or an update of a previous appraisal, and the replacement cost must be determined at least once every three years.

## Utah

Utah Code § 57-8a-403 requires an association, to the extent reasonably available, to carry blanket property insurance or guaranteed replacement cost insurance on the physical structure of all attached dwellings, on limited common areas appurtenant to a dwelling on a lot, and on the common areas, against all risks of direct physical loss commonly insured against including fire and extended coverage perils. It also requires liability coverage for death, bodily injury and property damage arising out of the use, ownership or maintenance of the common areas, and requires notice to lot owners within seven calendar days if either becomes unavailable.

## Directors and officers liability

D and O responds to claims about how the board governed: selective rule enforcement, a denied architectural application, a disputed election, an alleged breach of fiduciary duty. The claim does not have to be good. It has to be filed.

Defense cost is the real value of the policy. A governance dispute that ends with the association winning can still run tens of thousands of dollars in fees, and a volunteer board has no budget line for that. Prefer a duty-to-defend policy, where the insurer takes on the defense from the first notice, over a reimbursement policy where you fund the lawyers and argue about it later. Ask whether defense costs erode the limit, because in most policies they do.

Read the exclusions before you renew. The recurring ones are bodily injury and property damage, which belong on the general liability policy and should not be a surprise, plus breach of contract, discrimination and employment practices, prior or known acts, insured versus insured, and intentional or dishonest conduct. Discrimination in particular is a claim a community association can plausibly face, so confirm whether it is excluded or carved back in.

Two structural questions matter more than most boards realize. First, who is insured: a policy that names only the association is entity-only coverage, and it protects the corporation, not the individual director being sued by name. You want current and former directors, officers, committee members, volunteers, employees and the managing agent as insureds. Second, whether non-monetary claims are covered: a great many association disputes seek an injunction rather than damages, and a policy that responds only to claims for money leaves the board paying its own lawyers in exactly the fight it is most likely to have.

Some states tie personal immunity to buying the coverage. Cal. Civ. Code § 5800 protects a volunteer officer or director of a residential association from personal liability beyond the insurance, but only if the act was within the scope of association duties, in good faith, and not willful, wanton or grossly negligent, and only if the association maintained both general liability and individual director and officer liability coverage of at least $500,000 where the association has 100 or fewer separate interests, or at least $1,000,000 where it has more than 100. Let the policy lapse and the statutory shield goes with it.

## Volunteer immunity is thinner than it sounds

The federal Volunteer Protection Act of 1997, 42 U.S.C. §§ 14501 to 14505, is often described to new board members as though it made them untouchable. It did not. Section 14503(a) shields a volunteer of a nonprofit organization from liability for harm caused by an act or omission only if the volunteer was acting within the scope of their responsibilities at the time, was properly licensed or authorized where the activity required it, the harm was not caused by willful or criminal misconduct, gross negligence, reckless misconduct or a conscious flagrant indifference to the rights or safety of the person harmed, and the harm was not caused by operating a motor vehicle, vessel or aircraft for which a license or insurance is required.

Note what it does not do. Section 14503(d) leaves the organization's liability to third parties untouched, so the association can still be sued and still has to defend. Section 14503(c) does not stop the organization from suing its own volunteer. Section 14502 lets a state elect that the Act not apply to actions where every party is a resident of that state. And a "volunteer" under § 14505 is someone receiving no more than reasonable expense reimbursement, or anything else of value in lieu of compensation, worth no more than $500 a year.

The most important limit is the plainest one. The Act is a defense, not a gate. It does not stop a complaint being filed, served and litigated to the point where the defense can be raised. Something has to pay for the lawyer who raises it, and that something is the D and O policy.

## Fidelity bond and crime coverage

This is the policy that pays when money goes missing. Employee dishonesty coverage responds to theft by someone who handles association funds, which for a self-managed association usually means the treasurer. Computer fraud responds to funds taken by someone who got into the systems. Funds transfer fraud responds to the bank being told to move money by someone impersonating an officer, which is the modern version of the loss and the one boards are least prepared for.

Fannie Mae sets the benchmark most associations end up using. Selling Guide B7-4-02 requires fidelity or crime insurance for condo and co-op projects, other than projects that qualify for a waiver of project review, projects with 20 units or less, and projects needing coverage of $5,000 or less. Where the association follows at least one of Fannie Mae's listed financial controls, coverage must equal at least the sum of three months of assessments on all units in the project. Where it does not, coverage must equal the maximum funds in the association's custody at any time.

The financial controls are worth adopting on their own merits: separate bank accounts for operating and reserve funds with appropriate access controls and monthly statements sent directly to the association, or a management company that keeps separate records and separate bank accounts for each association and has no authority to draw on or transfer reserve funds, or a requirement that two board members sign any check written on the reserve account.

Coverage has to reach the management company. Fannie Mae requires the policy to cover the dishonest or fraudulent acts of anyone who handles or is responsible for association funds, including management agents, whether or not they are compensated, and requires the association to be the named insured. California goes further in statute: Cal. Civ. Code § 5806 requires fidelity bond coverage equal to or more than the combined amount of the association's reserves and three months of total assessments, requires that a managing agent handling association funds be covered for its own and its employees' dishonest acts, and requires protection in an equal amount against computer fraud and funds transfer fraud. Fannie Mae accepts a state's statutory requirement in place of its own where one exists.

## Workers compensation and umbrella

An association with no payroll can still owe workers compensation benefits. The exposure comes from contractors. Hire an unlicensed or uninsured handyman, landscaper or roofer, and if their worker is injured on your property, the association can be treated as the employer. California's version of the trap is Labor Code § 3351(d), which counts as an employee a person employed by the owner or occupant of a residential dwelling whose duties are incidental to the ownership, maintenance or use of the dwelling. The fix is cheap: a minimum-premium or "if any" workers compensation policy costs very little and closes the gap.

Umbrella or excess liability sits above the general liability, auto and sometimes D and O policies and picks up when an underlying limit is exhausted. It only works if you carry the underlying limits the umbrella requires, so check the schedule of underlying insurance every renewal rather than assuming last year's policy still matches.

## What owners need: the HO-6 and loss assessment

Tell owners this once a year in writing, because most of them have never heard it. Their HO-6 unit owner policy covers personal property, personal liability, loss of use, their improvements and betterments, and loss assessment. The dwelling limit on a stock HO-6 is often small and needs to be raised to match whatever the master policy does not cover under your declaration.

Loss assessment coverage is the single most useful thing you can explain. When the association suffers a covered loss that exceeds the master policy limits, or when the master deductible is charged back to the membership, the board levies a special assessment. Loss assessment coverage on the owner's HO-6 pays the owner's share of that assessment. Without it, the owner writes the check personally.

Now the trap, and it is a real one. The standard ISO endorsement, form HO 04 35, lets an owner buy a higher loss assessment limit, but it contains its own sublimit for the situation owners are most likely to face: "We will not pay more than $1,000 of your assessment that results from a deductible in the policy of insurance purchased by a corporation or association of property owners." Buying $50,000 of loss assessment coverage does not buy $50,000 of protection against a master deductible pass-through under that form. Owners should ask their agent directly what their policy pays toward an association deductible assessment, and get the answer in writing.

## The deductible question

Master policy deductibles have risen steeply, and a five or six figure deductible turns every meaningful claim into a question about who absorbs it. The answer is usually in the statute, then the declaration, then the board's resolution, in that order.

Three states show three different defaults. Florida makes the deductible a common expense under Fla. Stat. § 718.111(11)(j), except where the damage was caused by a unit owner's intentional conduct, negligence, or failure to comply with the declaration or the rules. Maryland caps the pass-through: under Md. Code, Real Prop. § 11-114(g)(2)(iii), if the cause of damage originates from a unit, that unit's owner is responsible for the association's property insurance deductible up to $10,000, the excess is a common expense, and the council must tell every owner annually of the responsibility and the amount of the deductible. Utah splits it proportionally: under Utah Code § 57-8a-405 a lot owner pays the deductible multiplied by that lot's share of the total damage, and the association must set aside an amount equal to the deductible or, where the deductible exceeds $10,000, at least $10,000.

Maryland is about to change. Senate Bill 747 of the 2026 session, enacted as Chapter 717 and approved May 26, 2026, revises unit owner responsibility for damage and adds a requirement that unit owners carry a condominium unit owner policy or substantially similar property insurance. It takes effect October 1, 2027, so Maryland boards have a year of lead time to notify owners.

Whatever your state's default is, put the number in front of owners in writing every year. Utah and Maryland both make that an obligation. Everywhere else it is simply the difference between a special assessment people were warned about and one they were not.

## Vendor certificates of insurance

Get a certificate before any contractor touches the property, and get it from the agent rather than from the contractor. Require general liability naming the association as an additional insured, workers compensation or a valid state exemption, and auto liability for anyone driving on site. For a manager, bookkeeper or anyone with access to accounts, require crime or fidelity coverage that covers your funds.

Check three things people skip. That the policy period covers the work, not last year. That additional insured status is granted by endorsement, because a certificate is only evidence of insurance and grants nothing by itself. And that the limits are per occurrence rather than shared across every job the contractor has going. Diary the expiration date and ask for the renewal certificate before the work continues.

None of this is a substitute for having your policies read by a broker who specializes in community associations, and one conversation with a community association attorney about how your declaration allocates coverage will settle arguments you would otherwise have during a claim.`,
    sources: [
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.470",
        note: "RCW 64.90.470 full text: required coverages, the 80 percent standard, the all in default in subsection (2), fidelity insurance, waiver of subrogation, primary coverage, repair cost as common expense",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2025/718.111",
        note: "Fla. Stat. § 718.111(11) primary coverage, the excluded items list assigned to unit owners, replacement cost appraisal every 3 years, deductible as common expense with the negligence exception",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ut/title-57-real-estate/ut-code-sect-57-8a-403/",
        note: "Utah Code § 57-8a-403 required property and liability insurance and the 7 day notice, current as of January 1 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ut/title-57-real-estate/ut-code-sect-57-8a-405/",
        note: "Utah Code § 57-8a-405 lot damage percentage, the $10,000 set-aside, notice duty and 30 day payment, current as of January 1 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://mgaleg.maryland.gov/2022RS/Statute_Web/grp/11-114.pdf",
        note: "Md. Code, Real Prop. § 11-114(g)(2) deductible allocation, the $10,000 cap, annual notice requirement",
        fetched: "2026-08-26",
      },
      {
        url: "https://insurance.maryland.gov/Consumer/Pages/condo/faqs.aspx",
        note: "Maryland Insurance Administration consumer explanation of master policy, HO-6, loss assessment and the $10,000 deductible rule",
        fetched: "2026-08-26",
      },
      {
        url: "https://mgaleg.maryland.gov/mgawebsite/Legislation/Details/sb0747?ys=2026RS",
        note: "Maryland SB 747 (2026), Chapter 717, approved May 26 2026, effective October 1 2027, mandatory unit owner policy",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b7-4-01/general-liability-insurance-requirements-project-developments",
        note: "Fannie Mae Selling Guide B7-4-01, $1 million per occurrence, severability provision, named insured, topic updated August 5 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b7-4-02/fidelitycrime-insurance-requirements-project-developments",
        note: "Fannie Mae Selling Guide B7-4-02, the 20 unit and $5,000 exceptions, three months of assessments formula, the financial controls list, management agent coverage, topic updated August 5 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5800.",
        note: "Cal. Civ. Code § 5800 volunteer director immunity conditions and the $500,000 and $1,000,000 coverage minimums",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5806.",
        note: "Cal. Civ. Code § 5806 fidelity bond amount, managing agent coverage, computer fraud and funds transfer fraud",
        fetched: "2026-08-26",
      },
      {
        url: "https://uscode.house.gov/view.xhtml?path=/prelim@title42/chapter139&edition=prelim",
        note: "Volunteer Protection Act of 1997, 42 U.S.C. §§ 14501-14505, section list and the conditions in § 14503",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.law.cornell.edu/uscode/text/42/14503",
        note: "42 U.S.C. § 14503 conditions, no effect on organization liability to third parties, organization may still sue its volunteer, punitive damages standard, exceptions",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.law.cornell.edu/uscode/text/42/14505",
        note: "42 U.S.C. § 14505 definitions of volunteer, nonprofit organization, economic and noneconomic loss",
        fetched: "2026-08-26",
      },
      {
        url: "https://services.autoclubmo.aaa.com/InsuranceAux/Forms/AR/HomeOwners/HO043504-91.html",
        note: "ISO form HO 04 35 04 91 Loss Assessment Coverage, verbatim $1,000 sublimit on assessments resulting from an association policy deductible",
        fetched: "2026-08-26",
      },
      {
        url: "https://coverageclassroom.com/learn/condo-loss-assessment-endorsement",
        note: "context on the $1,000 default loss assessment limit in a standard HO-6 and how the endorsement raises it",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=LAB&sectionNum=3351.",
        note: "Cal. Labor Code § 3351(d) residential dwelling worker treated as an employee",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.kdisonline.com/making-sense-of-hoa-do-coverage-what-the-policy-really-says/",
        note: "community association D and O: who is insured, non-monetary relief, duty to defend, standard exclusions, published February 4 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://findhoalaw.com/directors-officers-do-insurance/",
        note: "D and O scope, statutory hooks in Cal. Civ. Code §§ 5800, 5805 and 5806, typical exclusions",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "florida-condo-milestone-and-sirs",
    title: "Florida milestone inspections and structural integrity reserve studies",
    summary: "The Chapter 718 inspection and reserve rules with the deadlines, thresholds, and what can still be waived",
    topic: "Reserves",
    states: ["FL"],
    readMinutes: 8,
    publishedDate: "2026-08-26",
    photoBrief: "a spalled concrete balcony edge on an older Florida coastal condominium, rusted rebar exposed through the broken slab, with shoring posts underneath",
    body: `If your board runs a condominium, this is the highest stakes obligation in Florida law. Two separate requirements got created after the Surfside collapse and boards routinely confuse them. One is a structural inspection ordered by the building department. The other is a reserve funding study that changes your budget. Here is how each works.

## The milestone inspection

Fla. Stat. § 553.899 requires a milestone inspection of any building three habitable stories or more in height, as determined by the Florida Building Code, that is subject in whole or in part to condominium or cooperative ownership. It is a structural inspection of load-bearing elements and primary structural members by a Florida licensed architect or engineer, attesting to the life safety and adequacy of the structural components. It is not a building code compliance check.

The trigger is age. The inspection is due by December 31 of the year the building turns 30, based on the date the certificate of occupancy was issued, and every 10 years after that, under § 553.899(3)(a). Two catch-up deadlines applied to older buildings: a building that reached 30 years before July 1, 2022 had to be inspected before December 31, 2024, and a building that reached 30 between July 1, 2022 and December 31, 2024 had to be inspected before December 31, 2025.

A local enforcement agency may move the trigger to 25 years where local conditions such as proximity to salt water justify it, and may extend an initial deadline for good cause if the association has already contracted with an architect or engineer, under § 553.899(3)(b) and (c).

The process runs in two phases under § 553.899(7). Phase one is a visual examination and qualitative assessment. If the inspector finds no signs of substantial structural deterioration, there is no phase two. Phase two is required only if such deterioration is identified, may involve destructive or nondestructive testing, and requires a progress report to the local enforcement agency within 180 days after the phase one report.

The clock the board controls starts with notice. When the local enforcement agency determines a building needs an inspection, it notifies the association by certified mail. The association must tell unit owners within 14 days, and phase one must be completed within 180 days after the association receives that notice, under § 553.899(5) and (6). Within 45 days after receiving any inspection report, the association must mail or deliver the inspector-prepared summary to every owner, post a copy conspicuously on the property, and publish the full report and summary on its website if it is required to have one, under § 553.899(9).

Repairs are on a deadline too. Under § 553.899(11), every county and municipality must have an ordinance requiring repairs for substantial structural deterioration to commence within 365 days after the local enforcement agency receives a phase two report. If the association cannot show that repairs are scheduled or started, the agency must determine whether the building is unsafe for human occupancy.

The inspector also cannot quietly sell you the repair work. Under § 553.899(12), an architect or engineer bidding on a milestone inspection must disclose in writing any intent to bid on the resulting repairs, and a repair contractor may not hold an undisclosed interest in the inspection firm. A contract violating the disclosure rule is voidable.

## The structural integrity reserve study

The reserve study is a different animal with a different threshold. Under Fla. Stat. § 718.112(2)(g)1., a residential condominium association must have a structural integrity reserve study completed at least every 10 years after the condominium's creation, for each building on the property that is three habitable stories or higher in height as determined by the Florida Building Code. There is no age trigger. A brand new building qualifies.

The study must cover the roof, the structure including load-bearing walls and primary structural members, fireproofing and fire protection, plumbing, electrical, waterproofing and exterior painting, windows and exterior doors, and any other item whose deferred maintenance or replacement cost exceeds $25,000 or the inflation-adjusted amount the division posts by February 1 each year, where failure to maintain it would harm one of the listed items.

Who may do it is limited. Under § 718.112(2)(g)3.a., the study and its visual inspection must be performed or verified by an engineer licensed under Chapter 471, an architect licensed under Chapter 481, or a person certified as a reserve specialist or professional reserve analyst by the Community Associations Institute or the Association of Professional Reserve Analysts.

The study must identify each item inspected, state its estimated remaining useful life and estimated replacement cost or deferred maintenance expense, and provide a funding plan. Section 718.112(2)(g)4.a. requires at minimum a baseline funding plan that keeps the reserve cash balance above zero every budget year.

The catch-up deadline was December 31, 2025 for associations existing on or before July 1, 2022 that are controlled by unit owners rather than the developer, under § 718.112(2)(g)7. An association required to complete a milestone inspection on or before December 31, 2026 may do both at once, but the statute closes with a hard line: in no event may the structural integrity reserve study be completed after December 31, 2026.

Two shortcuts exist. If a milestone inspection was performed within the past 5 years and meets the requirements, it can substitute for the visual inspection portion of the study, under § 718.112(2)(g)8. And under § 718.112(2)(g)9., an association that completed a milestone inspection may delay a required study for up to 2 consecutive budget years to focus resources on the repairs the inspection recommended.

Failure has teeth. Under § 718.112(2)(g)10., officers or directors who willfully and knowingly fail to complete a required study breach their fiduciary duty to unit owners, and an officer or director must sign an affidavit acknowledging receipt. Within 45 days of receiving it, the association must distribute the study or a notice of availability to every owner and file a statement with the division confirming it did so.

## What can still be waived, and what cannot

This is where boards get into trouble. Section 718.112(2)(f)2.b. still lets the members of a unit-owner-controlled association vote by a majority of total voting interests to provide no reserves or less reserves than required. But that sentence now carries an exception: for a budget adopted on or after December 31, 2024, the members of an association that must obtain a structural integrity reserve study may not waive or reduce reserves for the items listed in paragraph (g). The only carve-out is a multicondominium association using an alternative funding method approved by the division.

Section 718.112(2)(f)3. closes the other door. For budgets adopted on or after December 31, 2024, members of an association required to have a reserve study may not vote to spend reserve funds or interest on anything other than replacement or deferred maintenance of the listed components.

What remains available is timing relief, not forgiveness. Under § 718.112(2)(f)2.e., for a budget adopted on or before December 31, 2028, an association that completed a milestone inspection within the previous 2 calendar years may, with approval of a majority of the total voting interests, temporarily pause or reduce reserve contributions for no more than two consecutive annual budgets, and only to fund the repairs that inspection recommended. It must then complete a reserve study before restarting contributions. This does not apply to developer-controlled associations, to associations where non-developer owners have held control less than 1 year, or to bulk assignee or bulk buyer controlled associations.

Required reserves may be funded by regular assessments, special assessments, lines of credit, or loans, with a majority vote of total voting interests for anything other than regular assessments, under § 718.112(2)(f)2.c. And if the local building official declares the entire building uninhabitable due to a natural emergency, the board may pause reserves with no owner vote until it is habitable again. Reserve accounts may be pooled, but paragraph (g) components may be pooled only with other paragraph (g) components.

## What boards get wrong

Assuming the two requirements share a threshold. The milestone inspection is age-triggered at 30 years, or 25 in some jurisdictions. The reserve study has no age trigger at all.

Treating December 31, 2025 as a soft date. The statute's outer boundary is December 31, 2026, and only for associations pairing the study with a milestone inspection.

Believing a majority vote can still waive reserves. For paragraph (g) items in an association that must have a reserve study, it cannot, for any budget adopted on or after December 31, 2024.

Confusing the pause with a waiver. A pause under § 718.112(2)(f)2.e. buys two budget years, requires a completed milestone inspection in the previous two calendar years, and requires a reserve study before contributions restart.

Forgetting the paperwork. The 45 day owner distribution and the division statement after a reserve study, and the 45 day summary distribution and posting after a milestone report, are the compliance steps most likely to be missed by an otherwise diligent board.

None of this reaches a homeowners association under Chapter 720, which has no milestone or reserve study obligation. If you are unsure which chapter governs your community, that is the question to put to a Florida community association attorney first.`,
    sources: [
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/553.899",
        note: "milestone inspection definition, three habitable stories, 30 year trigger and 10 year cycle, December 31 2024 and December 31 2025 catch-up dates, 25 year local option, good cause extension, phase one and phase two, 14 day owner notice, 180 day phase one completion, 180 day phase two progress report, 45 day summary distribution, 365 day repair commencement, inspector bid disclosure",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.112",
        note: "SIRS scope and 10 year cycle at three habitable stories, required components, $25,000 threshold and inflation adjustment, qualified providers, baseline funding plan, December 31 2025 and December 31 2026 deadlines, milestone substitution, 2 budget year delay, fiduciary breach and affidavit, 45 day distribution and division statement, reserve waiver prohibition for paragraph (g) items, reserve use prohibition, temporary pause through December 31 2028, special assessment / line of credit / loan funding, uninhabitable building pause, pooling restriction",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.111",
        note: "15 year retention of structural integrity reserve studies and inspection reports as official records; condominium financial report delivery at 180 days",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Committees/BillSummaries/2025/html/913",
        note: "official Senate summary confirming the SIRS deadline extension from December 31 2024 to December 31 2025, the habitable stories change, the $10,000 to $25,000 threshold change, and the reserve pause",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2025/913/BillText/er/PDF",
        note: "enrolled HB 913 showing the habitable stories amendments to 553.899(3)(a) and 718.112(2)(g)1. and the July 1 2025 effective date",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2025/913",
        note: "chapter 2025-175, approved June 23 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.501",
        note: "October 1 2025 division online account and annual division report on associations completing a SIRS",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.303",
        note: "Chapter 720 reserves are optional and there is no SIRS obligation, contrast point",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "reserve-studies-and-percent-funded",
    title: "Reserve studies and percent funded, explained",
    summary: "How to read a reserve study, what percent funded means, and what the number does not tell you",
    topic: "Reserves",
    readMinutes: 5,
    publishedDate: "2026-08-26",
    photoBrief: "a flat roof mid replacement, old membrane peeled back to the deck with stacks of new insulation board staged beside it",
    body: `A reserve study is a budget document that happens to be about buildings. This covers the vocabulary a provider will use, what percent funded measures, and where boards misread it.

## What the standards are

The Community Associations Institute published the National Reserve Study Standards in 1998 and revised them in 2023, after the partial collapse of Champlain Towers South in Surfside, Florida. The revision added disclosure of long life components, meaning those with an estimated remaining life of more than 30 years, required disclosure of whether preventive maintenance is being performed, and treats periodic structural inspections as a reserve expenditure where applicable.

One quiet change matters more than the headline ones. The 2016 standards required a funding plan covering a minimum of 20 years. The current standards require a minimum of 30 years of projected income and expenses. If your last study used a 20 year horizon, the next one will look worse, and that is the standard changing, not your building.

## The levels of service

The standards define four levels. Level I, Full, performs all five tasks: component inventory, condition assessment, life and valuation estimates, fund status, and funding plan. Level II, Update, With Site Visit, performs the same five but verifies rather than re-quantifies the inventory. Level III, Update, No Site Visit, performs three tasks from the desk: life and valuation estimates, fund status, and funding plan. Level IV, Preliminary, is for communities not yet constructed.

Association Reserves describes the practice as a with site visit update at least every three years and no site visit updates in between. All three inputs change annually: physical condition, replacement cost, and cash on hand. A study you paid for in 2021 is not describing 2026 prices.

## What belongs in the study

The current standards use a three part test for the reserve component inventory. The association must have the obligation to maintain or replace the existing element. The need and schedule for the project must be reasonably anticipated. And the total cost must be material to the association, reasonably estimable, and inclusive of all direct and related costs.

Older studies describe a four part test drawn from the 2016 definition of a component: association responsibility, limited useful life, predictable remaining useful life, and above a minimum threshold cost. Both versions do the same job, which is to keep small recurring expenses in the operating budget and predictable large ones out of it.

## Fully funded balance and percent funded

The fully funded balance is the reserve balance that would be in direct proportion to the fraction of each component's life used up, priced at today's repair or replacement cost. The formula is current cost multiplied by effective age divided by useful life, calculated per component and summed. A $10,000 component with a 10 year life that is 4 years old contributes $4,000.

Percent funded is the ratio of the actual or projected reserve balance to the fully funded balance, measured at a stated point in the fiscal year. Fully funded means 100%. The standards add the caveat boards skip: percent funded should be read in light of how it is changing under the funding plan and the association's risk tolerance, and it is not by itself a measure of adequacy.

## The bands, and the national numbers

Association Reserves publishes three ranges. Zero to 30% is weak, with a high likelihood of special assessments and common deferred maintenance. 30% to 70% is fair, with moderate risk. 70% and above is strong, with low risk of special assessments. In its April 2026 report drawn from more than 100,000 reserve studies in all 50 states, 34% of its clients sat in the weak range, 40.3% in fair, and 25.7% at or above 70%.

For scale, the Foundation for Community Association Research counted 373,000 community associations in the United States in 2025, holding 29.6 million housing units and housing 78.1 million residents, 35.2% of U.S. housing. Those associations collected $124.2 billion in assessments and put $31.1 billion of it into reserve funds.

## Funding goals and method

The standards describe three funding goals, from most aggressive to most conservative. Baseline funding keeps the cash balance from ever falling below zero, and the standards say plainly it is not recommended as a long term plan because it leads to project delays, special assessments, or borrowing. Threshold funding keeps the balance above a chosen dollar or percent funded floor. Full funding aims to reach and hold at or near 100% funded, and where a state imposes statutory funding requirements those control.

Method is a separate question from goal. The cash flow method, also called pooling, sets contributions to offset annual expenditures from the fund as a whole. The component method, also called straight line, sets total contributions as the sum of contributions for each component.

## Read the year the balance goes negative

Percent funded is a snapshot of one day. The number that decides whether your community gets a special assessment is the first year in the 30 year projection where the reserve balance hits zero. Find that year in the cash flow table. That is the deadline, and everything before it is runway.

Inflation is why the snapshot ages badly. Association Reserves found adequate reserve funding sat between 15% and 40% of the total annual budget in its 2015 data, midpoint near 25%, and had widened to 15% to 45% by 2025, driven mainly by replacement costs rising faster than budgets from 2021 to 2024. A study quoting today's dollars for a roof 12 years out is only as good as its inflation assumption.

The case for funding gradually is arithmetic. Association Reserves priced the same $250,000 roof three ways: $231,823 through budgeted reserve funding, because the money earns interest while it waits, $250,000 through a special assessment, and $320,071 through a bank loan. The special assessment also lands as a single bill on whoever happens to own the unit that year, which is why boards that defer get recalled.

## Who is qualified to write one

CAI issues the Reserve Specialist, or RS, designation, and the standards name it as the credential indicating a provider can produce a conforming study. The Association of Professional Reserve Analysts issues the Professional Reserve Analyst, or PRA, which requires five years of full time experience, a list of 50 site inspection studies, and continuing education. RSS is not a CAI credential; it is Nevada's state registration for reserve study specialists under NRS 116A.420 and NRS 116A.430.`,
    sources: [
      {
        url: "https://www.lockatong.com/wp-content/uploads/2023/07/CAI-Reserve-Study-Standards-July-2023.pdf and https://www.piazzanj.com/wp-content/uploads/2023/08/CAI-Reserve-Study-Standards-May-2023-FINAL.pdf",
        note: "full text of the current CAI Reserve Study Standards: four levels of service and their names, the three part component test, fully funded balance and formula, percent funded, funding goals, cash flow and component methods, 30 year funding plan minimum, long life components",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.reservestudy.com/wp-content/uploads/2019/01/NRSS-998-CAI-version-updated-2016.pdf",
        note: "prior National Reserve Study Standards last updated November 30, 2016: the four component criteria and the 20 year funding plan minimum",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.reserveadvisors.com/resources/blog/cai-releases-revised-reserve-study-standards/",
        note: "the three areas revised in 2023: long lived asset disclosure, preventive maintenance, structural inspection expense",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.tahoedonner.com/wp-content/uploads/2023/09/230922.RESERVES-STUDY-STANDARDS.v2.pdf",
        note: "board level summary confirming July 2023 adoption, the renaming to Reserve Study Standards, and the three part component selection test",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.reservestudy.com/wp-content/uploads/2026/05/2026-04-29-100000-Industry-Insights-Report-FINAL.pdf",
        note: "Association Reserves, HOA Reserves: Industry Insights Report, April 2026: weak, fair and strong bands, the 34% / 40.3% / 25.7% distribution, 15% to 45% of budget, the $250,000 roof comparison, with site visit updates every three years",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.reservestudy.com/what-exactly-is-percent-funded",
        note: "percent funded formula and band interpretation",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.reservestudy.com/reserve-studies-faq/",
        note: "standards established 1998 by CAI, most recently updated 2023, established the RS credential program",
        fetched: "2026-08-26",
      },
      {
        url: "https://foundation.caionline.org/wp-content/uploads/2026/03/2025StatisticalReviewFoundation.pdf",
        note: "Foundation for Community Association Research, 2025 U.S. National and State Statistical Review: 373,000 associations, 29.6 million units, 78.1 million residents, 35.2% of housing, $124.2 billion assessments, $31.1 billion to reserves",
        fetched: "2026-08-26",
      },
      {
        url: "https://foundation.caionline.org/research/industry-data/",
        note: "2026 outlook of 374,000 to 377,000 associations",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.apra-usa.com/Apply-for-PRA-status",
        note: "PRA credential requirements and continuing education",
        fetched: "2026-08-26",
      },
      {
        url: "https://hoareserves.com/blog/reserve-specialist-credentials",
        note: "RS issued by CAI, PRA issued by APRA",
        fetched: "2026-08-26",
      },
      {
        url: "http://nv.elaws.us/nrs/116a.420",
        note: "Nevada reserve study specialist registration requirement",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "responding-to-a-records-request",
    title: "How to answer a member's records request",
    summary: "Every state gives members an inspection right, but the deadlines and the charges differ a lot",
    topic: "Records and meetings",
    readMinutes: 5,
    publishedDate: "2026-08-26",
    photoBrief: "a banker's box of association files open on a conference table with manila folders and a legal pad beside it",
    body: `A member asks for the association's records. What happens next is governed by a statute, not by how the board feels about the member. The right exists almost everywhere, the deadline is short, and in several states missing it costs money per day.

## The shape of the right

A member may inspect and copy association records, usually after a written request describing what is wanted, at a reasonable time and place, at the member's expense for copies. Some states let the association demand a proper purpose. Virginia does, under Va. Code § 55.1-1815(B). Colorado does the opposite: C.R.S. § 38-33.3-317(2)(a) says the association "may not condition the production of records upon the statement of a proper purpose."

## The clock is different in every state

California splits it. Cal. Civ. Code § 5210 gives 10 business days for records of the current fiscal year and 30 calendar days for the prior two fiscal years. Florida HOAs have 10 business days under Fla. Stat. § 720.303(5); Florida condominiums have 10 working days under Fla. Stat. § 718.111(12). Texas gives 10 business days to produce or to send inspection dates under Tex. Prop. Code § 209.005(e), and if the association cannot make it, § 209.005(f) requires written notice stating a date no later than the 15th business day after that notice. Arizona is 10 business days under A.R.S. § 33-1805. Illinois is 10 business days under 765 ILCS 605/19, and missing it is deemed a denial. Nevada is 21 days for copies of the financial statement, budgets, and reserve study under NRS 116.31175(2). Colorado runs backward: the association may require the written request 10 days before inspection, but its penalty clock starts on the 11th business day after receipt. Virginia sets a notice period rather than a production deadline, five business days for a professionally managed association and 10 business days for a self-managed one.

## What you can hold back

Nearly every state protects the same short list: attorney-client privileged communications and work product, personnel and salary and medical records, pending or threatened litigation, and records about a different owner's account, violation history, or approval file. Illinois lists them in 765 ILCS 605/19(g), Virginia in § 55.1-1815(C), Texas in § 209.005(k), where another owner's records are releasable only with that owner's written consent or a court order. Colorado goes further and makes withholding mandatory for personnel, salary, and medical records and for bank details, phone numbers, email addresses, driver's license numbers, and social security numbers, under § 38-33.3-317(3.5).

Contact information is what boards get wrong. Colorado lets an owner consent in writing to publishing a phone number or email. California lets a member opt out of sharing their name, property address, email address, and mailing address under Cal. Civ. Code § 5220. Check for opt-outs before handing over a roster.

## What you may charge

A per page copy charge is nearly always allowed. A labor or staff time charge often is not. Arizona caps copies at 15 cents per page and allows no charge for the examination itself. Nevada caps copies at 25 cents per page for the first 10 pages and 10 cents after, and caps in-person review at $25 per hour under NRS 116.31175(8). Florida HOAs may charge 25 cents per page and personnel costs of no more than $20 per hour, with no personnel charge at all for a request producing 25 or fewer pages. California allows the direct and actual cost of copying and mailing plus redaction labor at no more than $10 per hour, capped at $200 per written request, under Cal. Civ. Code § 5205. Illinois allows actual retrieval and reproduction costs, Colorado a reasonable charge not exceeding the estimated cost of production.

Texas has a trap. Under Tex. Prop. Code § 209.005(i) the board must adopt a records production and copying policy and record it as a dedicatory instrument, and an association "may not charge an owner" unless that policy has been recorded. No recorded policy, no charge.

## Run a process, not a reaction

Log the request the day it arrives with the date received, because the deadline runs from receipt. Acknowledge in writing. Identify the responsive records. Decide on redaction record by record, and note that Va. Code § 55.1-1815(D) allows withholding a document in full only when an exclusion covers its entire content, otherwise you redact and produce the rest. Produce with a short index, say where you redacted and which exclusion applies, and keep a copy of exactly what you sent.

## The failures that cost money

Boards treat the request as an attack and slow-walk it. Nobody logs the date, so the clock runs out before anyone looks. Documents are quietly redacted with no note saying what was removed, which reads as concealment. Staff time gets billed in a state that does not allow it. Records go to a tenant, a spouse not on title, or a former owner. Worst of all, the board rewrites its records policy mid-request and applies the new version to it.

## What non-compliance actually costs

Florida sets minimum damages at $50 per calendar day for up to 10 days, beginning on the 11th business day after receipt, in both § 720.303(5) and § 718.111(12), and missing the window creates a rebuttable presumption of willful noncompliance. Colorado sets $50 per day from the 11th business day, capped at $500 or actual damages, whichever is greater. Nevada charges the board $25 for each day it fails to provide records under NRS 116.31175(3). California lets a court award costs and attorney's fees and assess a civil penalty of up to $500 for the denial of each separate written request, under Cal. Civ. Code § 5235. Illinois and Texas both shift attorney's fees to the prevailing member.

Florida adds criminal exposure. Under § 720.303(5)(e) a director or manager who knowingly, willfully, and repeatedly violates the inspection duty with intent to cause harm commits a second degree misdemeanor, and "repeatedly" means two or more violations in 12 months. Under § 720.303(5)(f) refusing to produce records to avoid detection or punishment for a crime is a third degree felony. Neither reaches an honest late response, but both should end any argument that stonewalling is a strategy. If a request looks headed for litigation, get counsel involved before the deadline rather than after.`,
    sources: [
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5210",
        note: "Cal. Civ. Code § 5210: 10 business days for current fiscal year records, 30 calendar days for prior two fiscal years; amended by Stats. 2025, Ch. 516, Sec. 4 (SB 410), effective January 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5205",
        note: "Cal. Civ. Code § 5205: direct and actual cost of copying and mailing, $10 per hour redaction labor, $200 per written request cap",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5215",
        note: "Cal. Civ. Code § 5215: withholding and redaction categories",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5220",
        note: "Cal. Civ. Code § 5220: member opt-out of sharing name, property address, email address, and mailing address",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5235",
        note: "Cal. Civ. Code § 5235: costs and attorney's fees plus civil penalty up to $500 per separate written request",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.303",
        note: "2026 Fla. Stat. § 720.303(5): 10 business days, 45 mile location rule, 25 cents per page, $20 per hour personnel cost with 25 page floor, exempt record categories, 100 parcel website posting, $50 per calendar day up to 10 days from the 11th business day, and the (5)(e) and (5)(f) criminal provisions quoted verbatim",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.111",
        note: "2026 Fla. Stat. § 718.111(12): 10 working days, $50 per calendar day up to 10 days from the 11th working day, rebuttable presumption of willful failure, website posting for 25 or more units, third degree felony provision",
        fetched: "2026-08-26",
      },
      {
        url: "https://texas.public.law/statutes/tex._prop._code_section_209.005",
        note: "Tex. Prop. Code § 209.005 full text: certified mail written request, 10 business days, 15 business day extension notice, recorded records production and copying policy and the 1 T.A.C. § 70.3 cap, subsections (k) and (l) exclusions, document retention policy, justice court remedy and attorney's fees, \"business day\" definition",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/az/title-33-property/az-rev-st-sect-33-1805.html",
        note: "A.R.S. § 33-1805: 10 business days, no charge for examination, 15 cents per page copy cap, exempt categories; currency date January 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.nv.us/NRS/NRS-116.html",
        note: "NRS 116.31175 full text: 21 days for copies, 25 cents per page for first 10 pages then 10 cents, $25 per day penalty, $25 per hour review cap, exclusions for personnel records and records relating to another unit's owner",
        fetched: "2026-08-26",
      },
      {
        url: "https://colorado.public.law/statutes/crs_38-33.3-317",
        note: "C.R.S. § 38-33.3-317 full text: no proper purpose condition, 10 day advance written request, permissive and mandatory withholding categories, reasonable charge not exceeding estimated cost, $50 per day from the 11th business day up to $500 or actual damages",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/co/title-38-property-real-and-personal/co-rev-st-sect-38-33-3-317/",
        note: "Second source confirming C.R.S. § 38-33.3-317 penalty and withholding provisions; currency date January 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/Legislation/ILCS/Articles?ActID=2200&ChapterID=62&Print=True",
        note: "765 ILCS 605/19 full text: records list, 10 business days deemed a denial, subsection (f) actual cost, subsection (g) exclusions, attorney's fees for a prevailing member; source P.A. 102-921, eff. 5-27-22",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title55.1/chapter18/section55.1-1815/",
        note: "Va. Code § 55.1-1815: proper purpose, five business days for managed and 10 business days for self-managed associations, subsection (C) exclusions, subsection (D) redact rather than withhold in full, subsection (E) cost schedule; page shows Chapter 18 current as of 8/26/2026",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "lender-project-eligibility",
    title: "Why an underfunded association makes homes harder to sell",
    summary: "Mortgage investors underwrite your association, not just the buyer. Here is what they check",
    topic: "Buying and selling",
    readMinutes: 5,
    publishedDate: "2026-08-26",
    photoBrief: "a condominium building's exposed concrete balcony edge with spalled concrete and rusted rebar visible, shot from below",
    body: `When an owner in your community sells, the buyer's lender does not only underwrite the buyer. It underwrites the association. If the project fails the investor's test, the buyer cannot get a conventional loan, and the number of people who can buy that home drops.

## Review is heavier for condos than for PUDs

Fannie Mae and Freddie Mac both look at the project behind the unit, but not equally. Condo and co-op units generally need a Full Review. Selling Guide B4-2.1-02 waives project review for units in new and established PUD projects, and also for detached condo units, 2 to 4 unit condo projects, and 5 to 10 unit condo projects not part of a master association. As of the August 5, 2026 guide there is no Limited Review left, so an established condo project gets a Full Review or the waiver.

## The reserve percentage lenders compute

B4-2.2-01 requires the budget to fund replacement reserves "at least 10% of the budget," computed by dividing the annual budgeted reserve allocation by the annual budgeted assessment income. A reserve study can substitute, but the baseline funding method "may not be used to waive the 10% reserve requirement," and the budget must include the study's highest recommended allocation. Freddie Mac uses the same 10%. Fannie Mae Lender Letter LL-2026-03, issued March 18, 2026, raises the minimum to 15% for loan applications dated on or after January 4, 2027.

## Fifteen percent delinquent stops the deal

No more than 15% of total units may be 60 days or more past due on common expense assessments, measured as units 60 or more days past due divided by total units. The same test applies separately to each special assessment, and Freddie Mac uses the same threshold in Guide Chapter 5701. In a 40 unit building that is six units. Weak collections are an eligibility problem, not just a cash flow problem.

## Ownership, commercial space, and presales

Under B4-2.1-03 a project is ineligible if one entity owns more than 2 units in a 5 to 10 unit project that is part of a master association, more than 2 units in an 11 to 20 unit project, or more than 20% of a project with 21 or more units. Commercial and nonresidential space may not exceed 35%. For new and newly converted projects, B4-2.2-02 requires at least 50% of units conveyed or under contract to principal residence or second home purchasers.

## Insurance, including the bond boards forget

B7-3-03 requires master property coverage of at least 100% of estimated replacement cost value, with deductibles no greater than 5% per occurrence and $50,000 per unit. B7-4-02 requires fidelity or crime insurance for any condo or co-op project over 20 units, equal to three months of assessments on all units where the association has the listed financial controls, or the maximum funds in its custody at any time where it does not. It must cover the acts of any management agent.

## Critical repairs, the rule Surfside produced

Fannie Mae issued Lender Letter LL-2021-14 in October 2021 and Freddie Mac issued Bulletin 2021-38 on December 15, 2021, effective for settlement dates on or after February 28, 2022. Both were temporary. Fannie Mae made its version permanent through Announcement SEL-2023-06 on July 5, 2023, required for loan applications dated on or after September 18, 2023, and it now lives in B4-2.1-03.

A project is ineligible if it needs repairs that significantly impact safety, soundness, structural integrity, or habitability. That covers material deficiencies likely to cause system failure within a year, mold and water intrusion, advanced deterioration, failed mandatory structural inspections, and any unfunded repairs costing more than $10,000 per unit that should be done within 12 months. Freddie Mac also counts a directive from a regulatory authority or inspection agency to make critical repairs, and a failure to schedule a required inspection. A special assessment paying for repairs that are not finished keeps the project ineligible. Routine repairs do not trigger it, and damage confined to a few units does not either.

## The list your association cannot read

Fannie Mae's Condo Project Manager holds project statuses, including Approved by Fannie Mae, Certified by Lender, and Unavailable. Even where review is waived, B4-2.1-02 says the project cannot carry an Unavailable status. That list is not published, and an association can be on it without being told. Fannie Mae now offers a free Condo Status Finder so a board or its manager can look up whether Fannie Mae is aware of a failing condition. Corrections run through a lender working a real loan.

## The questionnaire your board signs

Fannie Mae Form 1076, which is also Freddie Mac Form 476, is the Condominium Project Questionnaire, and its instructions are addressed to the HOA or management company. Freddie Mac added Form 476A for the critical repairs questions. Answer it accurately, not optimistically. A hopeful answer about reserves or deferred maintenance does not make a project eligible. It shifts a warranty onto the lender and leaves the association exposed when the real numbers surface.

## FHA and VA run their own track

FHA has its own thresholds, in HUD Handbook 4000.1 section II.C. Existing construction generally needs 50% owner occupancy, with an exception down to 35% only through the HUD Review and Approval Process and only if no more than 10% of units are in arrears. FHA also wants reserves funded at 10% of aggregate monthly unit assessments unless a study justifies less, no more than 15% of units over 60 days past due, and individual owner concentration of 10% or less in projects of 20 or more units. VA approves the project rather than the unit and keeps its own list.

## The arithmetic owners feel

Underfunded reserves or 15% delinquency makes the project ineligible. Ineligible means no conventional loan and usually no FHA or VA loan either. That leaves cash buyers and investors, who bid low because they know they are the only bidders. Prices fall for every unit, not just the one listed. The reserve increase the board voted down to keep dues flat gets paid anyway, out of everyone's equity. If your project is flagged or needs critical repairs, get an engineer and a lawyer involved before the next listing goes up.`,
    sources: [
      {
        url: "https://selling-guide.fanniemae.com/sel/b4-2.2-01/full-review-process",
        note: "Full Review Process, 10% replacement reserve requirement and calculation, baseline funding prohibition, highest recommended allocation, 15% delinquency limits for assessments and special assessments; page dated 08/05/2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b4-2.1-03/ineligible-projects",
        note: "Ineligible Projects: critical repairs, material deficiencies, $10,000 per unit unfunded repair threshold, single entity ownership tiers, 35% commercial space limit, special assessment review; dated 08/05/2026, source Announcement SEL-2026-07",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b4-2.1-02/waiver-project-review",
        note: "Waiver of project review for PUDs, detached condo units, 2 to 4 and 5 to 10 unit projects; Unavailable status in CPM still disqualifying",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b4-2.1-01/general-information-project-standards",
        note: "Review paths by project type, co-op Full Review or PERS, PUD review waived except basic requirements",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b4-2.2/project-eligibility",
        note: "Current B4-2.2 section list confirming no Limited Review section remains as of 08/05/2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b4-2/project-standards",
        note: "Full chapter B4-2 section list and renumbering",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b4-2.2-02/full-review-additional-eligibility-requirements-units-new-and-newly-converted-condo-projects",
        note: "50% presale to principal residence or second home purchasers for new and newly converted projects",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b7-3-03/master-property-insurance-requirements-project-developments",
        note: "100% replacement cost value, 5% per occurrence deductible, $50,000 per unit deductible cap",
        fetched: "2026-08-26",
      },
      {
        url: "https://selling-guide.fanniemae.com/sel/b7-4-02/fidelitycrime-insurance-requirements-project-developments",
        note: "Fidelity/crime insurance: 20 unit exemption, three months of assessments formula, management agent coverage",
        fetched: "2026-08-26",
      },
      {
        url: "https://sf.freddiemac.com/docs/pdf/fact-sheets/condo_mortgages_project_reviews_597.pdf",
        note: "Freddie Mac Condominium Unit Mortgages and Project Reviews fact sheet, August 2026: Chapter 5701 structure, 15% delinquency thresholds, ineligible project list including projects in need of critical repairs and excessive single investor concentration, Exempt From Review, reciprocal reviews",
        fetched: "2026-08-26",
      },
      {
        url: "https://guide.freddiemac.com/ci/okcsFattach/get/1008525_7",
        note: "Freddie Mac Bulletin 2021-38, December 15, 2021, effective for Settlement Dates on or after February 28, 2022: definitions of Critical Repairs, Material Deficiencies, Significant Deferred Maintenance, Routine Repairs; regulatory or inspection agency directive language; special assessment review; 10% reserve reminder and 36 month reserve study rule; Form 476A",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.whitefordlaw.com/news-events/client-alert-fannie-mae-announces-significant-changes-to-project-standards-and-property-insurance-requirements-for-community-associations",
        note: "Law firm alert summarizing LL-2026-03: reserve minimum rising from 10% to 15% for loan applications dated on or after January 4, 2027; Limited Review retired effective August 3, 2026; baseline funding no longer permitted",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.reservestudy.com/resources/article/new-fannie-mae-mortgage-availability-tool/",
        note: "Association Reserves on the Fannie Mae Condo Status Finder, who can use it, what it reports, the lender-mediated correction path, and the 10% to 15% change effective January 4, 2027",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.tenaco.com/fannie-mae-issues-selling-guide-announcement-sel-2023-06/",
        note: "SEL-2023-06 dated July 5, 2023 with mandatory implementation for loan applications dated on or after September 18, 2023",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.tenaco.com/fannie-mae-issues-temporary-eligibility-requirements-for-condo-and-co-op-projects/",
        note: "LL-2021-14 issued October 2021, scope of temporary requirements for projects with five or more attached units",
        fetched: "2026-08-26",
      },
      {
        url: "https://sf.freddiemac.com/docs/pdf/forms/condo_questionnaire_form_full.pdf",
        note: "Fannie Mae Form 1076 / Freddie Mac Form 476, Condominium Project Questionnaire Full Form, December 2021, instruction line addressed to the HOA or Management Company, question categories",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.hud.gov/sites/dfiles/OCHCO/documents/4000.1hsgh.pdf",
        note: "HUD Handbook 4000.1 section II.C.2: 50% owner occupancy for existing construction, 35% exception via HRAP with no more than 10% units in arrears, 10% reserve funding of aggregate monthly unit assessments, 15% units in arrears limit, 10% individual owner concentration for projects of 20 or more units",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.hud.gov/sites/dfiles/SFH/documents/FHA-Condo-Project-Approval-Required-Docs.pdf",
        note: "FHA Condominium Project Approval Required Documentation List, last updated 2/14/2025, HRAP and DELRAP",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.hud.gov/hud-partners/single-family-ins-condominiums",
        note: "HUD FHA Condominiums page, project approval framework and Handbook 4000.1 II.C reference",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "arizona-hoa-law",
    title: "Arizona HOA law: the planned community and condominium acts",
    summary: "Records, meetings, fines, collections and the state hearing process Arizona boards have to follow",
    topic: "State law",
    states: ["AZ"],
    readMinutes: 7,
    publishedDate: "2026-08-26",
    photoBrief: "a desert front yard in a Phoenix subdivision with decomposed granite, a saguaro, and a for sale sign at the curb",
    body: `Arizona regulates associations in unusual detail and gives owners a state hearing officer instead of only a courtroom. This is what the two acts require of a board, and where Arizona has taken authority away from boards entirely.

## Which act applies

Planned communities run on A.R.S. §§ 33-1801 to 33-1821. Condominiums run on A.R.S. §§ 33-1201 to 33-1270. The two chapters mirror each other on most operating rules, so this guide cites the planned community section and gives the condominium twin in parentheses.

A planned community under § 33-1802 is a development managed by a nonprofit corporation or unincorporated owners association whose declaration expressly states that owners are mandatory members and must pay assessments. The chapter does not reach timeshares, condominiums, or a development with no association. An association created before January 1, 1974 that has no authority to enforce covenants is outside the chapter unless a majority of members vote to opt in and record a notice of election under § 33-1801(D). Almost every Arizona association is also a nonprofit corporation under Title 10, which supplies the director and officer rules the property chapters leave out.

## The state hearing process

Under A.R.S. § 32-2199.01 an owner or an association may petition the Arizona Department of Real Estate for a hearing about a violation of the community documents or of the statutes that regulate condominiums and planned communities. The other side must answer within 20 days after the petition is mailed. If the commissioner finds the petition justified it goes to the Arizona Office of Administrative Hearings, where an administrative law judge decides it.

The filing fee is set by the commissioner rather than the statute. The department's current schedule charges $800 for each issue in a petition, and $800 per issue for a rehearing request. It is refundable only if the parties settle before a hearing is scheduled. The department does not investigate associations or discipline boards, and will not accept a petition filed by or against a renter, a non-owner, an individual director or a management company. Boards forget the notice half of this: § 33-1803(E), and § 33-1242(D) for condominiums, requires the association to tell the owner in writing that this option exists.

## Records

Section 33-1805 (§ 33-1258) makes all financial and other records reasonably available to any member or a person the member designates in writing. The association may not charge anything for making material available for review. It has 10 business days to fulfill an examination request and 10 business days to provide copies once copies are requested, and may charge no more than 15 cents per page.

Only five categories may be withheld: privileged communications between the association and its attorney, pending litigation, minutes or records of a properly closed session, personal, health or financial records of an individual member or employee, and records about an individual employee's job performance, compensation, health or complaints. Nothing else. If the board records a meeting that is open to members, it must keep the recording at least six months and give any member the unedited recording on request.

## Meetings

Section 33-1804 (§ 33-1248) opens all meetings of the members' association, the board, and any regularly scheduled committee meetings. Members may attend, may record audio or video without giving advance notice, and must be allowed to speak once after the board discusses an agenda item and before it takes formal action on that item.

A portion of a meeting may be closed only for legal advice from the association's attorney, pending or contemplated litigation, personal, health or financial information about an individual member or employee, an individual employee's job performance or complaints against them, or a member's appeal of a violation or penalty unless that member asks for an open session. Before closing, the board must state on the record which paragraph authorizes it.

Notice of a members' meeting goes out not fewer than 10 and not more than 50 days ahead, hand delivered or by prepaid mail, and must state the purpose, including the general nature of any proposed amendment, any assessment change needing member approval, and any proposal to remove a director or officer. After declarant control ends, notice and agenda for a board meeting must go out at least 48 hours ahead by newsletter, conspicuous posting or other reasonable means. Emergency meetings are allowed, are limited to the emergency, and the minutes must state why. A quorum of the board meeting informally, workshops included, has to follow the open meeting and notice rules whether or not it votes.

## Assessments and collection

A regular assessment may not be more than 20% greater than the immediately preceding fiscal year's assessment without approval by a majority of members, and a lower cap in the documents wins. A late charge is capped at the greater of $15 or 10% of the unpaid assessment, may be imposed only after the association has given notice that the assessment is overdue, and a payment is late once 15 days past due unless the documents allow longer. Money paid on an unpaid assessment goes to principal first and interest second. That is all § 33-1803(A).

Section 33-1807 (§ 33-1256) gives the association a common expense lien from the date an assessment becomes due, perfected by the recorded declaration. It sits behind liens recorded before the declaration, a recorded first mortgage or first deed of trust, and tax liens, and it is extinguished if not enforced within six years. Foreclosure is available only if the owner has been and remains delinquent for 18 months or in the amount of $10,000 or more, whichever comes first, measured on the day the action is filed, and only after the board makes reasonable efforts to communicate with the owner and offers a reasonable payment plan.

The part boards miss is subsection B. Member expenses, meaning fees, charges, late charges, monetary penalties and interest, are not enforceable as common expense liens at all. For those the association can get only a judgment lien after winning a civil suit and recording the judgment, and that lien may not be foreclosed and takes effect only when the property is conveyed. Payments are applied in the order set by § 33-1807(K): unpaid assessments, then assessments due but not delinquent, then late charges on those assessments if the declaration authorizes them, then reasonable collection fees and costs, then court-awarded attorney fees, and only then other fees, charges, penalties and interest.

Before handing an account to an attorney or an outside collection agency, the association must send the exact notice in § 33-1807(L), in bold face or all capitals, by certified mail return receipt requested, at least 30 days ahead. Unless the community has fewer than 50 lots and no third party manager, it must also send a statement of account with each assessment cycle rather than a payment book. On written request it must furnish a statement of unpaid liens within 10 days, and failing a licensed escrow agent on that deadline extinguishes the lien for the unpaid assessment then due.

## Fines and the response clock

Section 33-1803(B) allows reasonable monetary penalties after notice and an opportunity to be heard. There is no statutory cap on the fine itself, only on the late charge for an unpaid penalty, which is capped at the greater of $15 or 10%.

The procedure is where associations lose. An owner who receives written notice that their property violates the documents may respond by certified mail within 21 calendar days after the date of the notice. The association then has 10 business days after receiving that response to reply in writing with the provision allegedly violated, the date of the violation or the date it was observed, the first and last name of each person who observed it, and the process the owner must follow to contest. If the original violation notice did not spell out how to contest, the association may not proceed with any enforcement action, including collecting attorney fees, before or during that exchange.

## What Arizona has taken from boards

Section 33-1808 (§ 33-1261) is a long list of things an association may not prohibit: the American flag, uniformed services flags, POW/MIA, the Arizona state flag, an Arizona Indian nations flag, the Gadsden flag, first responder flags, blue star and gold star service flags, and historic versions of the American flag. Rules may regulate flagpole location and size, limit an owner to two wall-mounted holders and two flags at once, and cap pole height at the rooftop, but may not prohibit a flagpole in the front or back yard.

Political signs may not be banned on an owner's own property except earlier than 71 days before a primary, later than 15 days after the general election, or later than 15 days after a primary for a candidate who did not advance. Size and number rules may not be stricter than the local ordinance, and where there is no ordinance the association may limit only the total to 9 square feet. Associations also may not prohibit cautionary signs about children, children playing on association roadways posted at 25 miles per hour or less, door-to-door political activity and petition circulation, association-specific signs about board elections and recalls, or a member's peaceful assembly in the common areas. For sale, for rent and for lease signs get their own protection at industry standard 18 by 24 inches with a 6 by 24 inch rider, with no fee allowed. Charging a fee for one is expensive: under § 33-1808(M) it forfeits the association's lien rights against that owner's property for six consecutive months.

Solar energy devices are protected by § 33-1816, and placement rules survive only if they do not prevent installation, impair the device's functioning, restrict its use or adversely affect its cost or efficiency. Artificial turf is protected by § 33-1819 in any planned community that allows natural grass, after declarant control ends. Rentals are protected but not unrestricted: § 33-1806.01 (§ 33-1260.01) says a member may rent unless the declaration prohibits it, so a recorded rental restriction still binds. What the association may demand is narrow, being the names and contact information of adult occupants, the beginning and ending dates of the lease, and a description and license plate numbers of tenant vehicles. It may charge no more than $25 per new tenancy and nothing on renewal, may charge no more than $15 for late or incomplete information, may not require the rental application, credit report or lease, may not make a tenant waive due process rights, may not bar a non-resident owner from the board, and may not impose any fee, fine or requirement on a rental differently from an owner-occupied property.

## Elections, reserves and audits

After declarant control ends, votes may not be cast by proxy under § 33-1812 (§ 33-1250). The association must offer in-person voting and absentee ballots, and may add email or fax. An absentee ballot must list each proposed action, allow a vote for or against each, expire after the one election, give at least seven days between delivery and the deadline, and carry the voter's name, address and signature. Ballots, envelopes and sign-in sheets are kept for at least a year and are open to member inspection.

Section 33-1813 (§ 33-1243(H)) lets members remove a director by petition. In an association of 1,000 or fewer members the petition needs 25% of the votes or 100 votes, whichever is less. Above 1,000 members it needs 10% or 1,000 votes, whichever is less. The board must call, notice and hold the special meeting within 30 days after receiving the petition, and if it does not, every board member is deemed removed at midnight on the 31st day. Quorum at that meeting is 20% of votes or 1,000 votes, whichever is less, and removal is by majority of those voting.

Arizona does not require a reserve study. The only mention is § 33-1806(A)(6), which requires the resale packet to include the most recent reserve study if one exists. Arizona does require an annual financial audit, review or compilation under § 33-1810 (§ 33-1243(J)), completed within 180 days after the end of the fiscal year and made available to members on request within 30 days after completion. A compilation satisfies the statute unless the community documents call for a CPA audit.

The mistakes that come up most are charging a member to look at records, blowing a 10 business day clock, answering a violation response without naming the person who observed the violation, treating fines as a foreclosable lien, raising dues past 20% without a member vote, and still collecting proxies years after the developer left. One more: § 33-1818 required communities recorded before January 1, 2015 to hold a member vote by June 30, 2025 to keep regulating publicly dedicated roadways. If yours did not hold that vote, that authority expired. Have an Arizona community association attorney confirm where your association landed on it.`,
    sources: [
      {
        url: "https://www.azleg.gov/ars/33/01801.htm",
        note: "applicability and opt-in election for pre-1974 associations",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01802.htm",
        note: "definitions of association, common expense lien, member expenses and planned community",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01803.htm",
        note: "assessment increase cap, late charges, fines, owner response window, association reply duty",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01804.htm",
        note: "open meetings, closed session topics, notice periods, meeting recordings",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01805.htm",
        note: "records, business day deadlines, 15 cents per page, exempt categories",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01806.htm",
        note: "resale disclosure contents, fee caps, civil penalty, reserve study language",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01806-01.htm",
        note: "rental information limits, $25 and $15 caps, association prohibitions",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01807.htm",
        note: "lien, foreclosure thresholds, member expenses, payment order, collection notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01808.htm",
        note: "flags, political signs, for sale signs, assembly, six month lien forfeiture",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01810.htm",
        note: "annual financial audit, review or compilation and the 180 day deadline",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01811.htm",
        note: "conflict of interest declaration",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01812.htm",
        note: "proxy prohibition and absentee ballot requirements",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01813.htm",
        note: "removal petition thresholds, 30 day meeting, automatic removal",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01816.htm",
        note: "solar energy devices",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/ars/33/01818.htm",
        note: "public roadway authority and the June 30 2025 vote",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/az/title-33-property/az-rev-st-sect-33-1819/",
        note: "artificial turf section, currency date January 1 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/az/title-33-property/az-rev-st-sect-33-1248/",
        note: "condominium open meetings twin",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/az/title-33-property/az-rev-st-sect-33-1258/",
        note: "condominium records twin",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/az/title-33-property/az-rev-st-sect-33-1250/",
        note: "condominium proxy and absentee ballot twin",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/az/title-33-property/az-rev-st-sect-33-1243/",
        note: "condominium board section, annual audit at subsection J, removal petition at subsection H",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/az/title-33-property/az-rev-st-sect-33-1260-01/",
        note: "condominium rental information twin",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/az/title-32-professions-and-occupations/az-rev-st-sect-32-2199-01/",
        note: "petition process, 20 day response, referral to the Office of Administrative Hearings",
        fetched: "2026-08-26",
      },
      {
        url: "https://azre.gov/all-adre-resources/fees",
        note: "HOA dispute petition fee of $800 per issue and rehearing fee of $800 per issue",
        fetched: "2026-08-26",
      },
      {
        url: "https://azre.gov/consumers/homeowners-association-dispute-information",
        note: "who may petition, refund rule, administrative law judge, department does not investigate",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "arizona-recent-changes",
    title: "What changed for Arizona HOA boards in 2024, 2025 and 2026",
    summary: "Sixteen bills across three sessions, with chapter numbers and the dates each one starts binding",
    topic: "State law",
    states: ["AZ"],
    readMinutes: 6,
    publishedDate: "2026-08-26",
    photoBrief: "the copper dome of the old Arizona Capitol building in Phoenix seen from the plaza, with the flagpoles in front",
    body: `Arizona rewrites some piece of association law every year. Three sessions are live for boards right now, and the newest batch is signed but not yet in force.

## How Arizona effective dates work

A bill without an emergency clause takes effect on the general effective date, which is the 91st day after the legislature adjourns. The legislature publishes the dates: September 14, 2024 for the 2024 session, September 26, 2025 for the 2025 session, and September 12, 2026 for the 2026 session. So everything from 2024 and 2025 already binds you, and everything in the 2026 list below starts binding on September 12, 2026.

## 2026: signed, in force September 12

Senate Bill 1246, Chapter 162, signed June 19, 2026, amends A.R.S. §§ 33-1256 and 33-1807. It gives condominiums the same foreclosure threshold planned communities got in 2025, so an association may foreclose its common expense lien only if the owner has been and remains delinquent for 18 months or in the amount of $10,000 or more, whichever comes first. It also adds a rule to both acts: for a special assessment with an initial value of $10,000 or more, only the 18 month threshold applies.

Senate Bill 1290, Chapter 222, signed June 22, 2026, adds two words to § 33-1804(A). A closed portion of a meeting is now limited to consideration "without action" of the listed topics. The board may still discuss those five subjects behind closed doors but may not vote there. This bill amends only the planned community section. The condominium equivalent, § 33-1248, was left alone.

House Bill 4011, Chapter 125, signed June 4, 2026, adds a new § 33-1821 for planned communities and a new subsection to § 33-1242 for condominiums. Both say the association has a duty to act reasonably in the exercise of its discretionary powers, which includes exercising them neutrally, fairly, without favoritism and in a nonarbitrary fashion.

House Bill 2397, Chapter 249, signed June 22, 2026, rewrites the resale disclosure package in §§ 33-1260 and 33-1806. The trigger changes from a notice of pending sale to acceptance of the purchaser's offer. New required items include the board-approved minutes of the previous three open board meetings, the final plat, a payment schedule for the annual assessment and any remaining special assessment installments, special assessments approved but not yet assessed or put to members within the previous four months, any title transfer fee, the most recent income and expense statement for operating and reserve accounts, any outstanding unresolved violation cited against the property, whether the community is under declarant control and roughly what share of platted lots the declarant still owns, and a new purchaser acknowledgment. The § 33-1810 audit, review or compilation report replaces the old annual financial report item. The liability standard moves from a bare failure to disclose to knowingly or recklessly failing to disclose or providing materially false or misleading statements, and disclosures may rest on good faith reliance on association records. The fee caps do not move, staying at $400 aggregate, $100 rush and $50 update.

House Bill 2342, Chapter 90, signed June 4, 2026, adds § 33-1816.01. A planned community association may not prohibit the backyard installation or use of a shade structure, defined as a commercially produced or professionally manufactured moveable or permanent structure designed to protect an area from sunlight, including an umbrella, awning, shade sail, gazebo, pergola or canopy. Rules on size, placement or appearance survive only if they do not prevent installation, impair functioning, restrict use or unreasonably affect cost, and are not more restrictive than local zoning on height and setbacks for a single-family home.

Senate Bill 1184, Chapter 154, signed June 19, 2026, adds division flags of the Army, Navy, Marine Corps, Air Force, Space Force and Coast Guard to the protected flag lists in §§ 33-1261 and 33-1808. It also repeals § 33-1261(L), the condominium provision that forfeited an association's lien rights for six months when it violated the sign rules. The planned community version of that penalty, § 33-1808(M), survives.

Senate Bill 1808, Chapter 243, signed June 22, 2026, adds one more protected flag, a flag from a nation allied with the United States as a major non-NATO ally and established on May 14, 1948.

## 2025: in force since September 26, 2025

Senate Bill 1494, Chapter 71, signed April 18, 2025, raised the planned community foreclosure threshold in § 33-1807(A) from one year or $1,200 to 18 months or $10,000, and made the association's claim for member expenses an explicit judgment lien.

Senate Bill 1039, Chapter 13, signed March 31, 2025, amended §§ 33-1248 and 33-1804. If a board records a meeting that is open to members, it must keep the recording at least six months and make the unedited recording available to any member on request.

Senate Bill 1378, Chapter 103, signed May 2, 2025, amended §§ 33-1261 and 33-1808 so that "political sign" means a sign or flag. Political flags now get the same protection and the same election-window limits as political signs.

House Bill 2322, Chapter 46, signed April 7, 2025, added § 33-1255(H) for mixed-use condominiums. Where a condominium has commercial structures separate from residential structures, a common expense that exclusively benefits one category must be assessed only against that category's units, and a shared expense is split in proportion to the benefit.

## 2024: the year the lien changed

House Bill 2648, Chapter 151, signed April 10, 2024, is the one that still trips boards up. It amended §§ 33-1202, 33-1256, 33-1802 and 33-1807 to split the association's claim in two. A common expense lien now covers assessments, late charges on those assessments if the declaration authorizes them, reasonable collection fees and costs, and court-awarded attorney fees and costs. Everything else, meaning fees, charges, late charges, monetary penalties and interest, became member expenses in planned communities and unit owner expenses in condominiums, and those are not enforceable as a lien at all. The same bill required the board to make reasonable efforts to communicate with the owner and offer a reasonable payment plan before filing a foreclosure action, tightened the payment application order, and barred the association from transferring ownership or control of the debt.

Four smaller 2024 bills round it out. House Bill 2662, Chapter 180, requires the secretary to provide an agenda for members' meetings and requires board meeting notices to include the agenda. Senate Bill 1016, Chapter 155, restructured the flagpole rules in § 33-1808(B), capping the association at two wall-mounted flagpole holders and confirming it may not prohibit installing a flagpole in the front yard or backyard. House Bill 2141, Chapter 27, bars a condominium association from prohibiting an interior alteration that may disturb adjacent occupants if the owner pays for materials that minimize the disturbance, and bars it from regulating interior decoration at all. House Bill 2698, Chapter 124, added § 33-1820, which requires every declaration with a declarant control period to state how that period ends and terminates declarant control no later than the conveyance of the second to last lot.

## What to do before September 12

Four things. Take voting out of executive session if you are a planned community. Rebuild the resale packet around the new § 33-1806 list. Stop treating the six month sign penalty as live if you are a condominium. And read the fine and enforcement file against the new duty to act reasonably, because that is now a statutory standard rather than an argument. An Arizona community association attorney should review your enforcement policy once this year.`,
    sources: [
      {
        url: "https://www.azleg.gov/general-effective-dates/",
        note: "general effective dates of 09-14-2024, 09-26-2025 and 09-12-2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/2R/laws/0162.htm",
        note: "SB 1246 chaptered text amending §§ 33-1256 and 33-1807, approved June 19 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/2R/laws/0222.htm",
        note: "SB 1290 chaptered text inserting \"without action\" into § 33-1804(A), approved June 22 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/2R/laws/0125.htm",
        note: "HB 4011 chaptered text adding § 33-1821 and § 33-1242(E), approved June 4 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/2R/laws/0249.htm",
        note: "HB 2397 chaptered text rewriting §§ 33-1260 and 33-1806, approved June 22 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/2R/laws/0090.htm",
        note: "HB 2342 chaptered text adding § 33-1816.01, approved June 4 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/2R/laws/0154.htm",
        note: "SB 1184 chaptered text adding division flags and repealing § 33-1261(L), approved June 19 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/2R/laws/0243.htm",
        note: "SB 1808 chaptered text adding the allied nation flag, approved June 22 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/1R/laws/0071.htm",
        note: "SB 1494 chaptered text, one year and $1,200 struck for 18 months and $10,000, approved April 18 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/1R/laws/0013.htm",
        note: "SB 1039 chaptered text adding the six month recording rule, approved March 31 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/1R/laws/0103.htm",
        note: "SB 1378 chaptered text adding \"or flag\" to the political sign definition, approved May 2 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/57leg/1R/laws/0046.htm",
        note: "HB 2322 chaptered text adding § 33-1255(H), approved April 7 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/56leg/2R/laws/0151.htm",
        note: "HB 2648 chaptered text creating common expense liens and member expenses, approved April 10 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/56leg/2R/laws/0180.htm",
        note: "HB 2662 chaptered text on meeting agendas",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/56leg/2R/laws/0155.htm",
        note: "SB 1016 chaptered text restructuring § 33-1808(B) flagpole rules",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/56leg/2R/laws/0027.htm",
        note: "HB 2141 chaptered text on condominium interior improvements, approved March 29 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.azleg.gov/legtext/56leg/2R/laws/0124.htm",
        note: "HB 2698 chaptered text adding § 33-1820 declarant control",
        fetched: "2026-08-26",
      },
      {
        url: "https://apps.azleg.gov/api/Bill/?billNumber=SB1246&sessionId=130&legislativeBody=S",
        note: "Arizona Legislative Information Services record giving short title, NOW title, governor action date and chapter number; the same endpoint was used for every bill listed",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "california-hoa-elections",
    title: "How to run a legal HOA election in California",
    summary: "The Davis-Stirling election deadlines, the inspector rules, and the mistakes that void a count",
    topic: "State law",
    states: ["CA"],
    readMinutes: 6,
    publishedDate: "2026-08-26",
    photoBrief: "a sealed double envelope HOA ballot on a table beside a printed candidate registration list and a handwritten tally sheet",
    body: `California election rules are the most procedural part of Davis-Stirling and the easiest place to lose. A member who proves you skipped a step gets the results voided unless the association can show the error did not change the outcome. Here is the sequence.

## What has to go to a secret ballot

Cal. Civ. Code § 5100 requires a secret ballot for assessments that legally require a vote, the election and removal of directors, amendments to the governing documents, and the grant of exclusive use of common area under § 4600. It also requires an election for each board seat at the expiration of that director's term and at least once every four years. These rules apply whether the association is incorporated or not, and they supersede conflicting provisions of the Nonprofit Mutual Benefit Corporation Law.

Proxies are not a substitute for a ballot. Cal. Civ. Code § 5130 allows proxies only if the bylaws permit or require them, and a proxy is a way to deliver a ballot, not a way to replace one.

## Election rules, and the 90 day freeze

The association adopts election operating rules under Cal. Civ. Code § 5105. Those rules must give equal access to association media for all candidates and for members advocating a point of view, give free access to common area meeting space during a campaign, allow self-nomination, set voting power and proxy verification and polling hours, provide for the selection of the inspector or inspectors, and provide for a candidate registration list and a voter list that members may verify at least 30 days before ballots go out.

Section 5105 also fixes what you may and may not use to disqualify a candidate. You must disqualify someone who is not a member when nominated, and you may disqualify a member who is delinquent in assessments, except where the assessments are paid under protest or the member is current under a payment plan. You may require one year of membership. You may not invent a qualification that is not in your bylaws or election rules.

The trap is timing. Election operating rules may not be amended less than 90 days before an election. If you notice a problem in your rules six weeks out, you fix it after this election, not before it.

## The inspector of elections

Cal. Civ. Code § 5110 requires one or three independent third parties as inspector. A volunteer poll worker with the county registrar, a licensee of the California Board of Accountancy, or a notary public all qualify, and a member of the association may serve. What disqualifies someone is being a director, being a candidate for director, being related to a director or candidate, or being a person or business currently employed by or under contract to the association for any compensable service other than acting as inspector.

That last clause is what most boards miss. Your management company and your association's accountant are typically under contract for other compensable services and cannot serve as inspector.

The inspector determines the number of memberships entitled to vote and the voting power of each, verifies proxies, receives ballots, counts and tabulates the votes, decides challenges, determines when the polls close, and reports the results.

## The calendar

Cal. Civ. Code § 5115 sets the sequence. Give general notice of the nomination procedure and the deadline at least 30 days before the nomination deadline. Then, at least 30 days before ballots go out, give general notice of the ballot return deadline and address, the electronic voting details if you use them, the date, time, and place of the meeting where quorum is determined and ballots are counted, and the list of candidates.

Ballots and two preaddressed envelopes with return instructions are mailed by first-class mail or delivered not less than 30 days before the voting deadline. The double envelope keeps the vote secret: nothing identifying the voter goes on the ballot itself, and the identifying information sits on the outer envelope.

If the meeting fails to reach quorum, the association may adjourn to a date at least 20 days later. At that reconvened meeting the quorum is 20% of the members voting in person, by proxy, or by secret ballot, and general notice of the reconvened meeting goes out no less than 15 days beforehand with the reduced quorum stated.

## Counting, results, and custody

Ballots are counted and tabulated by the inspector in public, at a properly noticed open meeting, and any member or candidate may witness it (Cal. Civ. Code § 5120). No one may open or review a ballot, or an electronic tally sheet, before that meeting. Within 15 days of the election the board must give general notice of the tabulated results.

The inspector keeps custody of the sealed ballots, signed voter envelopes, voter list, proxies, candidate registration list, and electronic tally sheet until the vote is tabulated and until the challenge window in Cal. Civ. Code § 5145 has closed, at which point custody transfers to the association (Cal. Civ. Code § 5125). That window is one year, so the practical retention period for ballot materials is at least a year from the results notice.

## Electronic voting

Since January 1, 2025 an association may adopt election rules permitting voting by electronic secret ballot, under AB 2159. Members opt out or opt into electronic voting by written request under Cal. Civ. Code § 5260. Only members voting by written ballot get a mailed ballot. The inspector must confirm the internet-based system authenticates member identity, transmits a receipt, and permanently separates any authenticating or identifying information from the ballot, and must test the system at least 30 days before voting opens.

## Campaign funds

Cal. Civ. Code § 5135 prohibits the association from using its funds for campaign purposes in a director election. That includes expressly advocating for or against a candidate, and it includes putting a candidate's photograph or prominently featuring a candidate's name in an association communication within 30 days of an election, other than the ballot, ballot materials, or a legally required communication. The exception is where § 5105 requires you to give equal access to the other candidates.

## What voiding an election looks like

Under Cal. Civ. Code § 5145 a member has one year from the date the inspector notifies the board and membership of the results, or from when the cause of action accrues, whichever is later. If the member proves by a preponderance of the evidence that the election procedures or the association's own election rules were not followed, the court must void the results unless the association proves the noncompliance did not affect the outcome. The court may impose a civil penalty of up to $500 for each violation, and a prevailing member is entitled to attorney's fees and costs. The association recovers costs only if the court finds the action frivolous, unreasonable, or without foundation.

The asymmetry is the point. The member carries a low burden and gets fees. The association carries the burden of proving harmlessness. Run the calendar and use a real independent inspector, and have your association's California counsel review the election rules once rather than fight over them later.`,
    sources: [
      {
        url: "https://california.public.law/codes/civil_code_section_5100",
        note: "secret ballot matters and the four year election rule, updated Jan. 1, 2022",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5100",
        note: "§ 5100 text and amendment history",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5105",
        note: "election rule contents, candidate disqualification limits, 90 day freeze, updated Jan. 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5105",
        note: "§ 5105 as amended by AB 2159, effective Jan. 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5110",
        note: "who may and may not serve as inspector, updated Jan. 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5110",
        note: "inspector duties and electronic voting system checks",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5115",
        note: "full election calendar, 20 day adjournment, 20% reconvened quorum, updated Jan. 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5115",
        note: "30 day notices and ballot mailing deadline",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5120",
        note: "public tabulation and 15 day results notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5125",
        note: "custody of ballots until the § 5145 challenge period expires",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5130",
        note: "proxies are not a substitute for a ballot",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5135",
        note: "association funds and campaign purposes, 30 day window",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5145",
        note: "verbatim subdivision (a), one year period and voiding standard",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5260",
        note: "written request to opt out of or into electronic voting",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2159",
        note: "AB 2159, Ch. 383, electronic secret ballot changes",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2460",
        note: "AB 2460, Ch. 401, reconvened meeting quorum and 15 day notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB1458",
        note: "AB 1458, Ch. 303, 20 day adjournment and reduced quorum",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "california-hoa-law",
    title: "California HOA law: what the Davis-Stirling Act requires",
    summary: "Every scheduled duty a California board has, with the section number and the deadline",
    topic: "State law",
    states: ["CA"],
    readMinutes: 9,
    publishedDate: "2026-08-26",
    photoBrief: "a condominium balcony photographed from directly below, showing the wood joists, the ledger connection to the building wall, and the underside of the waterproof deck coating",
    body: `California gives volunteer boards more statutory homework than almost any other state, and almost all of it is on a schedule. This is the short version of what the Davis-Stirling Act makes your board do, and when.

## The act, and who it binds

California residential common interest developments are governed by the Davis-Stirling Common Interest Development Act, Cal. Civ. Code §§ 4000-6150. Commercial and industrial developments sit under a separate, thinner statute at Cal. Civ. Code §§ 6500-6876 and do not carry most of the duties below.

An association may be incorporated or unincorporated, and either way may exercise the powers of a nonprofit mutual benefit corporation listed in Cal. Corp. Code § 7140 (Cal. Civ. Code §§ 4800, 4805). If you are incorporated, the Nonprofit Mutual Benefit Corporation Law fills gaps Davis-Stirling leaves, including the 10 to 90 day membership meeting notice in Cal. Corp. Code § 7511.

## Board meetings and notice

A board meeting happens whenever a quorum of directors gathers, in person or by teleconference, to hear, discuss, or deliberate on association business (Cal. Civ. Code § 4090). The board may not take action outside a meeting and may not run a meeting as a series of emails (Cal. Civ. Code § 4910). The only email exception is an emergency meeting where every director consents in writing and the consents go in the minutes.

Notice is at least 4 days before a board meeting, at least 2 days before a meeting held solely in executive session, and the notice must contain the agenda (Cal. Civ. Code § 4920). The board may not act on anything off that agenda except in narrow cases, such as a two-thirds vote that an emergency arose after the agenda went out (Cal. Civ. Code § 4930). Minutes, drafts marked as drafts, or a summary must be available within 30 days (Cal. Civ. Code § 4950).

Executive session is a closed list, not a mood: litigation, formation of contracts with third parties, member discipline, personnel matters, and meeting with a member about that member's assessments (Cal. Civ. Code § 4935). Whatever is discussed there must be generally noted in the minutes of the next open meeting. Since January 1, 2024 a board may meet entirely by teleconference with no physical location if the notice carries technical instructions and a phone-in option and votes are by roll call (Cal. Civ. Code § 4926), but not for the ballot counting meeting.

## Records inspection

Cal. Civ. Code § 5200 defines association records across fifteen categories, and separately defines enhanced association records: invoices, receipts, canceled checks, purchase orders, bank statements, credit card statements, statements for services, and reimbursement requests. Enhanced records are where most disputes start.

Current fiscal year records go out within 10 business days of the request, records from the previous two fiscal years within 30 calendar days, and minutes of a committee with decisionmaking authority within 15 calendar days after approval (Cal. Civ. Code § 5210). You may redact or withhold for identity theft risk, fraud risk, privilege, and member privacy, and may withhold executive session minutes and personnel records, but every denial needs a written legal basis (Cal. Civ. Code § 5215). Redaction labor on enhanced records is capped at $10 per hour and $200 per written request (Cal. Civ. Code § 5205). A court can award costs, attorney's fees, and up to $500 for each separate written request denied (Cal. Civ. Code § 5235).

## The two annual mailings

Every year, 30 to 90 days before the fiscal year ends, distribute an annual budget report (Cal. Civ. Code § 5300) and an annual policy statement (Cal. Civ. Code § 5310). The budget report carries the pro forma operating budget on an accrual basis, the reserve summary required by § 5565, the reserve funding plan summary, statements about deferred repairs and likely special assessments, outstanding loans, and an insurance summary with a disclaimer in at least 10 point boldface. The policy statement carries the collection policy, the schedule of fines, the dispute resolution summary, the architectural approval summary, and the overnight payment address.

A summary of either report is acceptable if its first page explains in 10 point boldface how to get the full copy free (Cal. Civ. Code § 5320), and owner delivery addresses must be solicited at least 30 days before the mailings (Cal. Civ. Code § 4041). If gross income exceeds $75,000 in a fiscal year, a licensee of the California Board of Accountancy must prepare a review of the financial statement, distributed within 120 days after year end (Cal. Civ. Code § 5305). Monthly, the board reviews the reconciliations, budget variance, bank statements, income and expense statement, check register, general ledger, and delinquency report (Cal. Civ. Code § 5500).

## Reserves

At least once every three years the board must arrange a reasonably competent and diligent visual inspection of the accessible major components, where their current replacement value is at least one half of the gross budget, and must review the study and adjust it annually (Cal. Civ. Code § 5550). The study covers components with less than 30 years of remaining useful life and must include a funding plan. Since January 1, 2025, gas, water, and electrical service lines the association must repair count as major components.

California never tells you to fund reserves to a particular level. It tells you to disclose exactly how underfunded you are, through the reserve summary in § 5565 and the disclosure summary form in § 5570. Withdrawals need two signatures, either two directors or one director and one non-director officer, and reserve money may only be spent on the components it was collected for (Cal. Civ. Code § 5510). A temporary transfer out must be restored within one year and noticed on an agenda first (Cal. Civ. Code § 5515).

## Assessments and collection

The board may raise the regular assessment by up to 20% over the preceding fiscal year and levy special assessments reaching 5% of budgeted gross expenses in the aggregate, without a member vote (Cal. Civ. Code § 5605(b)). Section 5605(a) conditions any annual regular increase on having complied with most of the § 5300 budget report requirements for that year. Emergencies are carved out by § 5610, and the unforeseeable-expense category there needs a board resolution with written findings sent out with the notice of assessment. Notice of any increase goes out 30 to 60 days before it is due (Cal. Civ. Code § 5615).

Assessments are delinquent 15 days after they are due unless the declaration says otherwise. The late charge is capped at 10% of the delinquent assessment or $10, whichever is greater, with interest up to 12% per year starting 30 days after the due date (Cal. Civ. Code § 5650). Payments apply to assessments first, then to fees, costs, and interest (Cal. Civ. Code § 5655).

Before recording a lien, send the pre-lien notice by certified mail at least 30 days ahead with an itemized accounting (Cal. Civ. Code § 5660). The owner has 15 days from that postmark to request a payment plan meeting, and the board has 45 days from the request postmark to hold it (Cal. Civ. Code § 5665). The lien decision is a majority vote of directors in an open meeting (§ 5673), a copy of the recorded lien is mailed within 10 calendar days (§ 5675), and a release is recorded within 21 days of payment (§ 5685).

Foreclosure is gated. You may not foreclose unless the delinquent assessments alone, excluding late charges, fees, collection costs, attorney's fees, and interest, total $1,800 or more, or unless they are more than 12 months delinquent (Cal. Civ. Code § 5720). Offer dispute resolution first, then vote to foreclose by a majority of directors in executive session at least 30 days before any sale, recording only the parcel number (Cal. Civ. Code § 5705). A nonjudicial sale carries a 90 day right of redemption (Cal. Civ. Code § 5715).

## Fines, rules, and enforcement

Since June 30, 2025 a monetary penalty may not exceed the lesser of the amount in your fine schedule or $100 per violation. The board may go higher only where the violation may result in an adverse health or safety impact on the common area or another member's property, and only after making a written finding specifying that impact at an open meeting (Cal. Civ. Code § 5850). Late charges and interest on a fine are prohibited.

Due process is Cal. Civ. Code § 5855: at least 10 days written notice by individual delivery stating the date, time, place, and the nature of the alleged violation, executive session if the member asks, no discipline if the member cures first or commits financially to curing, and written notice of the decision within 14 days.

Operating rule changes need 28 days of general notice before the vote and notice of the change within 15 days after, and an emergency rule lasts 120 days at most (Cal. Civ. Code § 4360). Enforcement other than assessment collection stops during a declared emergency that makes a fix unsafe or impossible (§ 5875). Before suing for declaratory, injunctive, or writ relief, the parties must try alternative dispute resolution (§ 5930) using a Request for Resolution the other side has 30 days to accept (§ 5935). Internal dispute resolution under §§ 5900 to 5920 is separate, and the association may neither refuse it nor charge for it.

## Exterior elevated elements

Condominium associations in buildings of three or more attached multifamily dwelling units must have a licensed structural or civil engineer or architect inspect load-bearing balcony, deck, stair, and walkway components and their waterproofing where the walking surface sits more than six feet above ground (Cal. Civ. Code § 5551). The first inspection was due by January 1, 2025, then every nine years. An immediate threat goes to local code enforcement within 15 days and the element is closed off until repairs are approved.

## What California boards get wrong

Voting to record a lien in executive session. Section 5673 makes that an open meeting vote. Only the foreclosure vote belongs in executive session, under § 5705.

Treating 20% as the whole rule. Skip the annual budget report and § 5605(a) means you may not raise regular assessments at all that year without a member vote.

Running an old fine schedule. Anything above $100 per violation is unenforceable unless the health or safety finding was made on the record first.

Buying a reserve study every three years and filing it. The three year cycle is the site inspection. The review is annual.

Believing the condominium balcony deadline moved to 2026. AB 2579 moved only the Health and Safety Code deadline for buildings outside Davis-Stirling. Section 5551 still reads January 1, 2025.

Producing records when convenient. Those day counts are real, and each denied written request can cost $500 plus the member's fees.

None of this replaces advice from a California community association attorney reading your own declaration and bylaws.`,
    sources: [
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4000",
        note: "names the Davis-Stirling Common Interest Development Act",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=6150",
        note: "confirms § 6150 is the last section of Part 5 of Division 4",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=6500",
        note: "Commercial and Industrial CID Act, Part 5.3, §§ 6500-6876",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=6876",
        note: "confirms § 6876 is the last section of Part 5.3",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4800",
        note: "association may be incorporated or unincorporated",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4805",
        note: "powers of a nonprofit mutual benefit corporation, Corp. Code § 7140",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CORP&sectionNum=7511",
        note: "10 to 90 day member meeting notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4090",
        note: "definition of board meeting",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4910",
        note: "no action outside a meeting, no serial email meetings",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4920",
        note: "4 day and 2 day notice, agenda in notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4923",
        note: "emergency meeting caller",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4926",
        note: "fully virtual meetings, AB 648",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4930",
        note: "agenda rule and exceptions",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4935",
        note: "exhaustive executive session topics",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4950",
        note: "minutes available within 30 days",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5200",
        note: "definition of association records and enhanced association records, updated Jan. 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5210",
        note: "10 business days and 30 calendar days, updated Jan. 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5205",
        note: "$10 per hour and $200 per request redaction cap",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5215",
        note: "withholding and redaction grounds",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5235",
        note: "$500 civil penalty per denied written request",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5300",
        note: "annual budget report contents and the 30 to 90 day window",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5310",
        note: "annual policy statement contents and window",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5320",
        note: "full report or summary delivery rule",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5305",
        note: "$75,000 review threshold and 120 day distribution",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5500",
        note: "monthly board financial review duty",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4041",
        note: "annual solicitation of owner contact information",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5550",
        note: "three year visual inspection, one half of gross budget, annual review",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5560",
        note: "reserve funding plan",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5565",
        note: "reserve summary and percent funded",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5570",
        note: "assessment and reserve funding disclosure summary",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5510",
        note: "two signature rule and permitted reserve uses",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5515",
        note: "one year restoration of transferred reserves",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5605",
        note: "verbatim subdivisions (a) and (b), 20% and 5% in the aggregate",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5610",
        note: "emergency assessment exceptions and the resolution requirement",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5615",
        note: "30 to 60 day notice of an increase",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5650",
        note: "15 day delinquency, 10% or $10 late charge, 12% interest",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5655",
        note: "order of application of payments and overnight address",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5660",
        note: "30 day pre-lien notice contents",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5665",
        note: "15 day request and 45 day payment plan meeting",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5673",
        note: "lien vote must be in an open meeting",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5675",
        note: "10 calendar day mailing of recorded lien",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5685",
        note: "21 day lien release",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5705",
        note: "foreclosure vote in executive session, 30 days before sale",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5720",
        note: "$1,800 and 12 month foreclosure thresholds",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5715",
        note: "90 day right of redemption",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5730",
        note: "annual NOTICE ASSESSMENTS AND FORECLOSURE and the $1,800 figure",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5850",
        note: "$100 cap, health or safety exception, no late charge on a fine, updated June 30, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5855",
        note: "10 day notice, cure right, IDR, 14 day decision",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5865",
        note: "no expansion of fining authority",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4360",
        note: "28 day rule change notice and 120 day emergency rule",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5875",
        note: "enforcement pause during a declared emergency",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5930",
        note: "ADR prerequisite to an enforcement action",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5935",
        note: "30 days to accept a Request for Resolution",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5910",
        note: "minimum IDR requirements",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5915",
        note: "default IDR procedure, no fee to the member",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5551",
        note: "exterior elevated element definition and the January 1, 2025 deadline, updated Jan. 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5551",
        note: "nine year interval, 15 day code enforcement report, two inspection cycle retention",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240AB2579",
        note: "AB 2579 amends only Health and Safety Code § 17973, not Civ. Code § 5551",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "california-recent-changes",
    title: "What changed for California HOAs in 2024, 2025, and 2026",
    summary: "The bills that actually passed, the sections they moved, and the dates they took effect",
    topic: "State law",
    states: ["CA"],
    readMinutes: 5,
    publishedDate: "2026-08-26",
    photoBrief: "a stack of chaptered California bill printouts on a table with the chapter number stamp visible on the cover page",
    body: `California moves Davis-Stirling every year, and 2025 moved it twice because a housing budget bill landed in June. Here is what actually became law, with the chapter numbers and the dates, and what did not change despite what you may have read.

## Effective January 1, 2024

AB 648 (Stats. 2023, Ch. 203) added Cal. Civ. Code § 4926 and let boards and memberships meet entirely by teleconference with no physical location, if the notice carries technical instructions and a phone-in option and director votes are taken by roll call. The one carve-out is the meeting where ballots are counted under § 5120, which still needs a physical place.

AB 1458 (Stats. 2023, Ch. 303) amended Cal. Civ. Code § 5115 so that a director election meeting that fails to reach quorum can be adjourned to a date at least 20 days later, where the quorum drops to 20% of the members voting in person, by proxy, or by secret ballot.

AB 572 (Stats. 2023, Ch. 745) amended Cal. Civ. Code § 5605 to cap assessment increases on deed-restricted affordable housing units at 5% plus the change in the cost of living, not to exceed 10%. It applies only to associations whose declaration was recorded on or after January 1, 2025.

## Effective January 1, 2025

SB 900 (Stats. 2024, Ch. 288) is the one that changed operations. It amended Cal. Civ. Code § 4775 to make the association responsible for repairs restoring interrupted gas, heat, water, or electrical service that begins in the common area even where the work extends into a separate interest, and it requires the board to commence the repair process within 14 days of the interruption. If reserves are short, the board may obtain financing and levy an emergency assessment without a member vote after passing a resolution. It also amended § 5550 so that gas, water, and electrical service lines the association must repair count as reserve major components, and broadened the emergency assessment ground in § 5610.

AB 2159 (Stats. 2024, Ch. 383) brought electronic secret ballot voting into HOA elections, amending Cal. Civ. Code §§ 5105, 5110, 5115, 5120, 5125, 5200, and 5260. An association can now adopt election rules permitting electronic voting, members opt out or in by written request, the inspector must test the system at least 30 days before voting starts, and the system has to permanently separate identifying information from the ballot.

AB 2460 (Stats. 2024, Ch. 401) further amended Cal. Civ. Code § 5115 on the reduced quorum for a reconvened director election, and set the notice for that reconvened meeting at no less than 15 days beforehand, including the reduced quorum statement.

AB 2579 (Stats. 2024, Ch. 835) extended the balcony inspection deadline in Health and Safety Code § 17973 to January 1, 2026, then every six years. Read the next section carefully before assuming this applied to you.

## Effective June 30, 2025

AB 130 (Stats. 2025, Ch. 22) was a housing budget bill and took effect the day it was signed, with no January runway. It amended Cal. Civ. Code § 5850 to cap a monetary penalty at the lesser of the amount in your fine schedule or $100 per violation. The board can exceed that only where the violation may result in an adverse health or safety impact on the common area or another member's property, and only after making a written finding specifying that impact at an open board meeting. Late charges and interest on a fine are now prohibited.

The same bill rewrote Cal. Civ. Code § 5855. A member must be given the opportunity to cure before the hearing, and discipline cannot be imposed if the member cures, or provides a financial commitment to cure where curing takes longer than the notice period. If the board and the member still disagree after the hearing, the member may request internal dispute resolution under § 5910, and any agreement reached is signed by both sides and judicially enforceable. The deadline to notify the member of the decision moved from 15 days to 14 days.

AB 130 also amended Cal. Civ. Code § 714.3 so that reasonable restrictions on an accessory dwelling unit or junior accessory dwelling unit shall not include any fees or other financial requirements. If your association charges an ADU review fee or a use surcharge, that language is the problem.

## Effective January 1, 2026

SB 410 (Stats. 2025, Ch. 516) moved exterior elevated element inspection reports into the records and disclosure regime. It amended Cal. Civ. Code §§ 4525, 4528, 5200, 5210, and 5551 so that inspector's reports are association records, are subject to inspection for the period § 5551 requires rather than the ordinary current-plus-two-fiscal-years window, must be maintained for two inspection cycles, and must be given to a prospective buyer as part of the seller disclosure package.

SB 625 (Stats. 2025, Ch. 548) added Cal. Civ. Code §§ 4752 and 4766 for disaster rebuilding. A covenant that prohibits a substantially similar reconstruction of a residential structure destroyed or damaged in a disaster is void, where the rebuild stays within 110% of the prior livable square footage and 110% of the prior height. Section 4766 puts a clock on architectural review: 30 calendar days to determine whether an application is complete, 45 calendar days to review a complete application, and 60 calendar days to decide an appeal. Prevailing owners get attorney's fees.

SB 770 (Stats. 2025, Ch. 525) amended Cal. Civ. Code § 4745 to remove the requirement that an owner installing an EV charging station name the association as an additional insured. The owner still has to carry and produce a liability policy.

AB 1170 (Stats. 2025, Ch. 67) also touched Cal. Civ. Code § 5115, but it is the Legislative Counsel's annual code maintenance bill and the change is nonsubstantive.

## What did not change

The condominium balcony deadline. AB 2579 extended only the Health and Safety Code § 17973 deadline, which governs buildings with three or more multifamily dwelling units generally. The Davis-Stirling deadline in Cal. Civ. Code § 5551 still reads January 1, 2025, with nine year cycles after that. Plenty of published guidance says otherwise and is wrong.

The foreclosure thresholds. Cal. Civ. Code § 5720 still requires delinquent assessments of $1,800 or more, excluding fees, costs, and interest, or a delinquency of more than 12 months.

The 20% and 5% assessment caps in Cal. Civ. Code § 5605(b), outside the affordable housing carve-out. The late charge and interest limits in § 5650. The $75,000 review threshold in § 5305. The insurance disclosure requirements in §§ 5300 and 5810, which no 2024, 2025, or 2026 bill amended.

There is still no California statute requiring an association to accept any particular payment method. Section 5655 requires an overnight payment mailing address in the annual policy statement, a receipt on request, and payments applied to assessments before fees and interest.

## What to do about it this quarter

Reprint the fine schedule against the $100 cap and add the written health or safety finding to your hearing template. Confirm your balcony inspection is done and the report is in the records file and the disclosure packet. Update the collections policy language in the annual policy statement if it still promises late fees on unpaid fines. Consult your association's California counsel before you rely on the health or safety exception for a specific violation.`,
    sources: [
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4926",
        note: "AB 648, Stats. 2023, Ch. 203, effective Jan. 1, 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB1458",
        note: "AB 1458, Ch. 303, chaptered Oct. 4, 2023, § 5115 reduced quorum",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5605",
        note: "AB 572, Stats. 2023, Ch. 745, effective Jan. 1, 2024, affordable housing cap",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240SB900",
        note: "SB 900, Ch. 288, chaptered Sept. 19, 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4775",
        note: "§ 4775 as amended by SB 900, effective Jan. 1, 2025, 14 day repair rule",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5550",
        note: "§ 5550 as amended by SB 900, effective Jan. 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5610",
        note: "§ 5610 as amended by SB 900, effective Jan. 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2159",
        note: "AB 2159, Ch. 383, chaptered Sept. 22, 2024, electronic secret ballots",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5110",
        note: "§ 5110 as amended by AB 2159, effective Jan. 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5260",
        note: "§ 5260 as amended by AB 2159, opt out or opt in to electronic voting",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2460",
        note: "AB 2460, Ch. 401, chaptered Sept. 22, 2024, 20% reconvened quorum and 15 day notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2579",
        note: "AB 2579, Ch. 835, chaptered Sept. 28, 2024, HSC § 17973 deadline moved to Jan. 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240AB2579",
        note: "confirms AB 2579 amends only HSC § 17973",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=17973",
        note: "HSC § 17973 as amended by AB 130, Jan. 1, 2026 deadline, six year cycle",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB130",
        note: "AB 130, Ch. 22, chaptered June 30, 2025, immediate effect",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5850",
        note: "§ 5850 as amended by AB 130, $100 cap, updated June 30, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://california.public.law/codes/civil_code_section_5855",
        note: "§ 5855 as amended by AB 130, cure right, IDR, 14 days",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=714.3",
        note: "§ 714.3 as amended by AB 130, no fees or other financial requirements on ADUs",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB410",
        note: "SB 410, Ch. 516, chaptered Oct. 10, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5200",
        note: "§ 5200 as amended by SB 410, effective Jan. 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5210",
        note: "§ 5210 as amended by SB 410, effective Jan. 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB625",
        note: "SB 625, Ch. 548, chaptered Oct. 10, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4752",
        note: "§ 4752 added by SB 625, effective Jan. 1, 2026, 110% square footage and height",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4766",
        note: "§ 4766 added by SB 625, 30, 45, and 60 calendar day clocks",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=4745",
        note: "§ 4745 as amended by SB 770, Stats. 2025, Ch. 525, effective Jan. 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB1170",
        note: "AB 1170, Ch. 67, code maintenance bill",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5115",
        note: "§ 5115 amendment history showing AB 1170, effective Jan. 1, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=202320240AB2050",
        note: "AB 2050 reserve funding bill died Nov. 30, 2024 and is not reported",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=202520260AB1184",
        note: "AB 1184 still in the Senate floor process as of Aug. 20, 2026, not law",
        fetched: "2026-08-26",
      },
      {
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=5655",
        note: "no payment method mandate, overnight address requirement",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "colorado-hoa-law",
    title: "Colorado HOA law: what CCIOA requires of your board",
    summary: "Registration, policies, records, meetings, budgets, fines and collections under CCIOA",
    topic: "State law",
    states: ["CO"],
    readMinutes: 9,
    publishedDate: "2026-08-26",
    photoBrief: "a printed HOA registration confirmation page from the Colorado Division of Real Estate lying on a kitchen table next to a checkbook",
    body: `Colorado governs associations through one statute, the Colorado Common Interest Ownership Act. This is what CCIOA requires of a volunteer board, with the sections to cite.

## Does all of it apply to you

CCIOA is C.R.S. Title 38, Article 33.3, and it applies in full to communities created on or after July 1, 1992.

Older communities are where boards get caught. C.R.S. § 38-33.3-117 lists the only sections that reach back. For events on or after July 1, 1992 that includes the lien section 38-33.3-316, the collections section 38-33.3-316.3, and the attorney fee section 38-33.3-123. For events on or after January 1, 2006 it adds disclosures under 38-33.3-209.4, governance policies under 38-33.3-209.5, records under 38-33.3-317, most of the meeting rules in 38-33.3-308, voting under 38-33.3-310, and registration under 38-33.3-401. Budget ratification under 38-33.3-303(4)(a) reaches back only to July 1, 2017.

Two wrinkles. Where a retroactive section conflicts with an express requirement in a pre-July 1992 declaration or bylaws, the older document controls, except for 38-33.3-316 and 38-33.3-217(7). And under § 38-33.3-119 a pre-1992 cooperative or planned community with ten or fewer units and no development rights escapes almost all of the act.

## Register every year or you cannot enforce your lien

C.R.S. § 38-33.3-401(1) requires annual registration with the director of the Division of Real Estate. A registration lasts one year. The Division charges $45 the first time and $44 to renew, and waives the fee, though not the registration, for an association with annual revenue of $5,000 or less.

The teeth are in § 38-33.3-401(3). Fail to register, or let it expire, and the right to impose or enforce an assessment lien under § 38-33.3-316 and the right to pursue an action under § 38-33.3-123 are suspended until you register. An existing recorded lien survives, but pending enforcement is suspended and time limits are tolled. Registering revives the right without penalty. Since October 1, 2025 registration also requires reporting delinquency, judgment, payment plan and foreclosure counts under § 38-33.3-401(3.2).

## The policies you must adopt

C.R.S. § 38-33.3-209.5(1)(b) requires written policies on nine subjects: collection of unpaid assessments, board conflicts of interest, conduct of meetings, enforcement of covenants and rules including notice and hearing procedures and the schedule of fines, inspection and copying of records, investment of reserve funds, adoption and amendment of policies, disputes between the association and owners, and reserve studies.

That last one is not a reserve study mandate. Colorado does not require an existing association to commission a study. Section 38-33.3-209.5(1)(b)(IX) requires only a policy stating when a study is prepared, whether there is a funding plan and its projected sources, and whether the study rests on a physical and a financial analysis, and it says plainly that an internally conducted study is sufficient.

The disclosure duty is separate. Within 90 days after each fiscal year end, C.R.S. § 38-33.3-209.4(2) requires the association to make available the budget, assessments by unit type, financial statements including reserve balances, audit or review results, an insurance policy list with limits and deductibles, governing documents, minutes and the governance policies. Effective August 12, 2026, subsection (2)(j) adds the most recent reserve study.

## Records

C.R.S. § 38-33.3-317(1) lists what must be kept, and subsection (2)(a) opens all of it to an owner or the owner's agent. The association may require a written request describing the records with reasonable particularity at least 10 days ahead, and may limit inspection to business hours or the next board meeting if it falls within 30 days. It may not demand a statement of proper purpose.

Subsection (3) permits withholding architectural drawings, contracts and bids under negotiation, privileged attorney communications, executive session records and other owners' units. Subsection (3.5) requires withholding personnel, salary and medical records and personal identification and account information, including bank details, phone numbers, email addresses and social security numbers. Copy charges may not exceed the estimated cost of production and reproduction. Miss the deadline and subsection (4.5) imposes $50 a day, up to $500 or actual damages, whichever is greater.

## Meetings

Owners meet at least once a year. Notice goes out not less than 10 and not more than 50 days ahead, by hand or prepaid mail, and must state the agenda including the general nature of any proposed amendment, any budget changes, and any proposal to remove an officer or board member. That is C.R.S. § 38-33.3-308(1).

Every board and committee meeting is open to owners under § 38-33.3-308(2)(a) and (2.5)(a), with agendas reasonably available. Owners must be allowed to speak on an issue before the board votes on it, under (2.5)(b), subject to reasonable time limits and, where views conflict, a reasonable number of speakers per side.

Executive session is limited to the six subjects in § 38-33.3-308(4): personnel and the managing agent's contract, privileged consultation with counsel, criminal investigations, matters protected from disclosure by law, matters that would be an unwarranted invasion of individual privacy including a disciplinary hearing and any referral of delinquency, and review of communications from counsel. The chair must announce the general matter first. No rule may be adopted in executive session, and the minutes must record that a session was held and its general subject matter.

## Budget ratification is a veto, not an approval

Under C.R.S. § 38-33.3-303(4)(a), within 90 days after adopting a proposed budget the board must deliver a summary to all owners, including by posting it on the association's website, and set a meeting. Unless the declaration says otherwise the budget needs no approval. It is deemed approved unless a majority of all unit owners vetoes it at that meeting, whether or not a quorum is present. If vetoed, the last budget owners did not veto continues.

An audit is required under subsection (4)(b) only where annual revenues or expenditures reach $250,000 and owners of at least a third of the units ask for one. A review is required whenever a third of the owners ask.

## Collections and fines

Before acting on a delinquency the association must contact the owner and log the method, date and time. The notice of delinquency goes by certified mail, return receipt requested, plus two of these: a phone call with a voicemail where possible, a text, an email, or regular mail if nothing else is on file. That is C.R.S. § 38-33.3-209.5(1.7)(a)(I). The notice must state the total due with an accounting, whether a payment plan is available, a contact who will supply the ledger within seven business days, and that failing to cure within 30 days can lead to a lien, foreclosure and loss of equity. Under subsection (6) it must be in English and in any language the owner has requested.

Only the board may refer an account to a collection agency or an attorney, by recorded majority vote at a meeting held under § 38-33.3-308(4)(e). A manager cannot make that call.

Interest is capped at 8% per year by § 38-33.3-209.5(8)(a) and § 38-33.3-315(2). Late fees and fines may not be imposed daily. The association may not charge for an account statement, and may not foreclose on a lien made up only of fines or of the costs of collecting fines. Payments apply to assessments first. Before filing a judicial foreclosure, § 38-33.3-209.5(7) requires a written offer of an 18-month repayment plan with owner-chosen payments of at least $25 a month, and the owner must have failed to accept within 30 days or, after accepting, missed at least three installments by more than 15 days. Disputes up to $7,500 can go to small claims court.

Fines require a written policy with a fair and impartial fact-finding process and a hearing before an impartial decision maker, under § 38-33.3-209.5(2). For an ordinary violation, subsection (1.7)(b)(III) requires certified mail notice, 30 days to cure, two consecutive 30-day cure periods before legal action, and a $500 cap on total fines for that violation. For a violation that threatens public safety or health the cure period is 72 hours and fines may then run every other day. Attorney fees are capped by § 38-33.3-123(1) at $5,000 or 50% of the amount owed, whichever is less, adjusted for inflation each August 1 since 2025.

## The lien, the super priority, and the gates on foreclosure

Recording the declaration perfects the lien; nothing else is filed. Under C.R.S. § 38-33.3-316(2)(b)(I) the lien beats a first mortgage to the extent of the common expense assessments that would have become due during the six months immediately preceding the start of an action or nonjudicial foreclosure. Everything else sits behind the mortgage, and the lien dies unless proceedings begin within six years.

Foreclosure is heavily gated. Section 38-33.3-316(11)(a) requires the balance to equal or exceed six months of assessments and requires the board to authorize action against that specific unit by recorded vote. That vote cannot be delegated, and an action filed without evidence of it must be dismissed, with no fees chargeable to the owner. Since August 7, 2024, subsection (10.5) also requires a personal judgment first where the unit is the owner's principal residence, unless the owner died, is incapacitated, could not be served in 180 days, or is in bankruptcy. Three separate 30-day notices precede filing: mediation under (10.7), credit counseling under (10.3), and intent to foreclose under (10.8). Lienholders must be notified within five business days after filing under (11.2).

One easy trap sits in § 38-33.3-316(8). The association must furnish a statement of unpaid assessments within 14 days of a written request, and if it does not, it has no right to assert a lien for amounts due as of that request.

## The board

Under C.R.S. § 38-33.3-303(6), within 60 days after 25% of units are conveyed at least one member and no less than 25% of the board must be elected by non-declarant owners, rising to 33 1/3% after 50% conveyance. Removal takes 67% of all persons present and entitled to vote at a meeting with a quorum. CCIOA sets no term limits; terms are whatever the bylaws say under § 38-33.3-306(1)(c). Colorado does not license community association managers.

## What Colorado boards get wrong

Letting registration lapse and then recording a lien. Fining daily, or past $500 on a non-safety violation. Sending an account to a lawyer on the manager's say-so. Charging 18% interest because the declaration says so. Treating budget ratification as needing a yes vote. Adopting a rule in executive session. Keeping minutes that never mention the session happened. Charging a research fee for records instead of the cost of copies. If your policies still read the way they did in 2021 they are out of date, and this is the point where an hour with a Colorado community association attorney pays for itself.`,
    sources: [
      {
        url: "https://olls.info/crs/crs2026-title-38.htm",
        note: "official Colorado Revised Statutes 2026, Title 38, full text of C.R.S. 38-33.3-106.5, 117, 119, 123, 124, 209.2, 209.4, 209.5, 303, 306, 308, 309, 315, 316, 316.3, 317, 401 and 402, with source notes",
        fetched: "2026-08-26",
      },
      {
        url: "https://olls.info/crs/crs2026-title-12.htm",
        note: "official Colorado Revised Statutes 2026, Title 12, full text of C.R.S. 12-10-801 (HOA information and resource center)",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/agencies/office-legislative-legal-services/2026-crs-titles-download",
        note: "source of the official 2026 CRS files and the note that the 2026 session adjourned sine die May 13, 2026 with non-safety-clause acts effective August 12, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://dre.colorado.gov/hoa-center/hoa-registration-services",
        note: "Colorado Division of Real Estate: $45 initial registration fee, $44 renewal fee, revenue under $5,000 fee exemption, data reported at registration",
        fetched: "2026-08-26",
      },
      {
        url: "https://dre.colorado.gov/hoa-center",
        note: "what the HOA Information and Resource Center does and does not do, including that it does not enforce failure to register",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/sites/default/files/documents/2022A/bills/2022a_1137_enr.pdf",
        note: "enrolled text of HB 22-1137",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/sites/default/files/documents/2024A/bills/2024a_1337_enr.pdf",
        note: "enrolled text of HB 24-1337",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/sites/default/files/documents/2025A/bills/2025a_1043_enr.pdf",
        note: "enrolled text of HB 25-1043",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "colorado-recent-changes",
    title: "Colorado HOA law changes: 2022 through 2026",
    summary: "Bill numbers and effective dates for every recent change to Colorado collections and enforcement",
    topic: "State law",
    states: ["CO"],
    readMinutes: 7,
    publishedDate: "2026-08-26",
    photoBrief: "the signature page of a Colorado enrolled house bill showing the Speaker and Senate President signature lines",
    body: `Colorado rewrote its HOA collection and enforcement rules four times in four years. If your policies predate August 2022, every one of them is wrong. Here is what changed, with bill numbers and effective dates.

## HB 22-1137, effective August 10, 2022

The big one. It added subsections (1.7), (2)(c), (6), (7), (8), (9) and (10) to C.R.S. § 38-33.3-209.5, amended § 38-33.3-308(4)(e), § 38-33.3-315(2), § 38-33.3-316 and § 38-33.3-316.3, and expanded small claims jurisdiction in § 13-6-403.

Before an association acts on a delinquency it must first contact the owner and log the contact. The notice of delinquency must go by certified mail, return receipt requested, plus additional contacts. Owners may designate a second contact and may ask for correspondence in a language other than English. The association must also send a monthly itemized statement of everything owed, by first-class mail and by email where it has an address, at no charge.

Only the board may refer an account to a collection agency or attorney, and only by a recorded majority vote at a meeting held under § 38-33.3-308(4)(e). A management company cannot do it on its own.

Late fees and fines may not be imposed daily. For a violation that threatens public safety or health, the owner gets 72 hours to cure, after which fines may run every other day. For any other violation, the owner gets written notice by certified mail and 30 days to cure, total fines for that violation are capped at $500, and the association must grant two consecutive 30-day cure periods before taking legal action.

Interest on unpaid assessments, fines and fees dropped from a ceiling of 21% to 8% per year. Foreclosure is barred where the debt is only fines, or only collection costs and attorney fees associated with fines. Payment plans went from a six-month minimum to 18 months, and before filing a judicial foreclosure the association must offer a written 18-month plan with owner-chosen monthly payments of at least $25. Owners gained a private right of action for foreclosure law violations, up to $25,000 plus costs and fees, within five years. Board members, management company employees, law firm employees and their immediate family members may not buy the foreclosed unit.

The act applies to conduct occurring on or after its effective date.

## HB 22-1139, effective August 10, 2022

Often miscited as a fines bill. It is not. It added C.R.S. § 38-33.3-106.5(1)(d.5), which bars an association from prohibiting the use of a public right-of-way in accordance with a local government's ordinance, and from requiring that a public right-of-way be used in a particular way.

## HB 24-1233, effective August 7, 2024

A correction to HB 22-1137. It removed the requirement to physically post the notice of delinquency at the unit. It changed the additional contact requirement from one method to two, and replaced first-class mail with a telephone call as an option, requiring a voicemail where possible. It allowed the association to charge the actual cost of certified mail under the new § 38-33.3-209.5(11). And it exempted time share units not occupied full time under § 38-33.3-209.5(12). The act applies to notices of delinquency sent and payment plans entered into on or after the effective date.

## HB 24-1337, effective August 7, 2024

This is the bill that capped attorney fees. Under the amended C.R.S. § 38-33.3-123(1), an association cannot be reimbursed, and a court cannot award, attorney fees exceeding $5,000 or 50% of the amount owed, whichever is less. A court may exceed the cap only on a finding that the owner was financially, physically and reasonably able to comply but willfully failed to. The cap adjusts for inflation on August 1, 2025 and each year after, by the Denver-Aurora-Lakewood consumer price index.

It added § 38-33.3-316(10.5) and (10.6): to foreclose on a unit an individual occupies as a principal residence, or a unit used for workforce housing, the association must first have obtained a personal judgment in a civil action, unless the owner died, is incapacitated, could not be served within 180 days, or is in bankruptcy.

It added § 38-33.3-316(10.7): at least 30 days before filing a foreclosure action, written and electronic notice to the owner of the right to mediate. The owner must respond within 30 days, and the parties must pick a mutually agreeable mediator knowledgeable about CCIOA and schedule the session within 30 days of the notice.

It also extended the ban on insiders buying a foreclosed unit to management companies and to anyone in those roles during the previous five years, and created a redemption path for owners, tenants, affordable housing nonprofits, community land trusts, housing cooperatives and the state, running from 35 to 180 days after the sale under the amended C.R.S. § 38-38-302. The act applies to debts accrued on or after the effective date.

## HB 25-1043, effective October 1, 2025

Titled owner equity protection in homeowners' association foreclosure sales. It added C.R.S. § 38-33.3-123(3), making strict compliance with the lien and foreclosure provisions of Title 38 and with the association's own governing documents a condition precedent to recovering money owed, collection costs or attorney fees through foreclosure. If a court finds an association is not in strict compliance it may stay the case to let the association fix it, and during the stay the association may not assess or accrue late fees, interest or other delinquency charges.

It required a ledger within seven business days of a request, added a warning to the delinquency notice that the unit could be sold at auction and the owner could lose some or all of the equity, and required the notice to point owners to the HOA Information and Resource Center and to HUD credit counseling.

It added § 38-33.3-316(10.3), a credit counseling notice at least 30 days before filing, and § 38-33.3-316(10.8), a notice of intent to foreclose at least 30 days before filing, sent by certified mail plus at least two other means and in the owner's preferred language. Within five business days after filing, § 38-33.3-316(11.2) requires notice to all lienholders of the right to cure and the owner's right to move to stay the sale.

The new C.R.S. § 38-38-109.5 lets an owner move to stay the auction and list the unit for sale at fair market value. The stay runs nine months and a court may extend it. Proceeds go into escrow and are distributed by the court in lien priority order.

Finally, § 38-33.3-401(3.2) now requires associations to report, at annual registration, how many owners were six or more months delinquent, how many judgments were obtained, how many payment plans were entered, and how many foreclosure actions were filed. The act applies to enforcement actions instituted on or after October 1, 2025.

## SB 25-184, effective May 24, 2025

The sunset bill for the HOA Information and Resource Center. It continued the center to September 1, 2030 and clarified that the director of the Division of Real Estate is the appointing authority for the HOA information officer.

## The 2026 session

The 2026 general assembly adjourned sine die on May 13, 2026, so acts without a safety clause took effect August 12, 2026.

HB 26-1099, signed April 13, 2026 and effective August 12, 2026, created C.R.S. § 38-33.3-209.2. Before turning control over to the association, the declarant of a planned community or condominium must commission and pay for a reserve study projecting costs over 30 years, conducted by an independent reserve study professional with no business relationship with or financial interest in the declarant. The study joins the turnover package under § 38-33.3-303(9)(n) and the annual disclosures under § 38-33.3-209.4(2)(j). The same bill added § 38-33.3-317(9): when an association terminates or does not renew a management agreement, the outgoing company must hand over all money, accounts, records, passwords and keys within 45 days at no charge, or owe $250 for each business day of delay, plus interest and late fees the association incurs, and treble damages with attorney fees if the violation was willful.

HB 26-1007, effective August 12, 2026, amended C.R.S. § 38-33.3-106.7 so that on and after January 1, 2027 a portable-scale solar generation device counts as an energy efficiency measure an association may not effectively prohibit.

HB 26-1045, effective August 12, 2026, addresses assistance animals and reasonable accommodation in housing. HB 26-1287, effective the same day, continued the Division of Real Estate itself.

## What to do about it

Pull your collection policy, your covenant enforcement policy and your conduct of meetings policy, and check them against C.R.S. § 38-33.3-209.5 as it reads now. Confirm your registration is current before anyone records a lien. And make sure whoever signs your delinquency notices knows that the board, not the manager, has to vote first.`,
    sources: [
      {
        url: "https://leg.colorado.gov/sites/default/files/documents/2022A/bills/2022a_1137_enr.pdf",
        note: "enrolled text of HB 22-1137, all seven sections and the effective date clause",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb22-1137",
        note: "signed June 3, 2022, effective August 10, 2022",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/sites/default/files/documents/2022A/bills/2022a_1139_enr.pdf",
        note: "enrolled text of HB 22-1139 showing it concerns public rights-of-way",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb22-1139",
        note: "signed May 6, 2022, effective August 10, 2022",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/sites/default/files/documents/2024A/bills/2024a_1233_enr.pdf",
        note: "enrolled text of HB 24-1233",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb24-1233",
        note: "signed June 3, 2024, effective August 7, 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/sites/default/files/documents/2024A/bills/2024a_1337_enr.pdf",
        note: "enrolled text of HB 24-1337, attorney fee cap, personal judgment requirement, mediation notice, redemption",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb24-1337",
        note: "signed June 5, 2024, effective August 7, 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/sites/default/files/documents/2025A/bills/2025a_1043_enr.pdf",
        note: "enrolled text of HB 25-1043, effective October 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb25-1043",
        note: "signed June 4, 2025, effective October 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/SB25-184",
        note: "signed and effective May 24, 2025, center continued to September 1, 2030",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb26-1099",
        note: "signed April 13, 2026, effective August 12, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb26-1045",
        note: "signed May 28, 2026, effective August 12, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://leg.colorado.gov/bills/hb26-1287",
        note: "signed June 4, 2026, effective August 12, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://olls.info/crs/crs2026-title-38.htm",
        note: "CRS 2026 source notes confirming bill numbers, chapter numbers and effective dates for every amendment listed above, including HB 26-1007 and HB 26-1099",
        fetched: "2026-08-26",
      },
      {
        url: "https://dre.colorado.gov/colorado-general-assembly-2026-legislative-updates",
        note: "Division of Real Estate list of 2026 bills affecting common interest communities: HB26-1007, HB26-1045, HB26-1099, HB26-1287, SB26-155, SB26-189",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "florida-hoa-law",
    title: "Florida HOA law, a board member's guide to Chapter 720",
    summary: "What Chapter 720 actually requires of a Florida homeowners association board, with the numbers",
    topic: "State law",
    states: ["FL"],
    readMinutes: 8,
    publishedDate: "2026-08-26",
    photoBrief: "a printed Florida homeowners association declaration of covenants on a table, open to the assessments article, with the county clerk's recording stamp visible in the top corner",
    body: `Florida gives homeowners associations more specific statutory duties than almost any other state, and then declines to enforce most of them. Chapter 720 sets the rules. Members enforce them by suing. Here is what the statute actually says.

## Which chapter governs you

Chapter 720, Florida Statutes, is the Homeowners' Association Act. It applies to a Florida corporation operating a community under a recorded declaration of covenants, where membership is mandatory and unpaid assessments can become a lien, per Fla. Stat. § 720.301(9). Chapter 718 is the Condominium Act and Chapter 719 covers cooperatives; § 720.302(4) says Chapter 720 does not reach associations regulated under those chapters. Your association is also a corporation governed by Chapter 617, the Florida Nonprofit Corporation Act, under § 720.302(5).

There is no state HOA regulator. Section 720.302(2) says plainly that the Legislature does not want one. The DBPR Division of Florida Condominiums, Timeshares, and Mobile Homes arbitrates HOA election and recall disputes and administers presuit mediation, and does not investigate general HOA complaints.

## Board meetings and notice

A board meeting occurs whenever a quorum of the board gathers to conduct association business, per § 720.303(2)(a). Notice must identify the agenda items and be posted conspicuously in the community at least 48 hours ahead, or mailed or delivered to every member at least 7 days ahead.

Two subjects need more. A meeting where a special assessment will be considered, or where amendments to rules governing parcel use will be considered, requires written notice mailed, delivered, or electronically transmitted to members and posted on the property not less than 14 days before, under § 720.303(2)(c)2. Missing that is the most common way a Florida special assessment gets challenged.

Only two kinds of board discussion may be closed: attorney meetings about proposed or pending litigation, and personnel matters. Any owner may record board and member meetings under § 720.306(10). Member meetings need 14 days notice plus a signed affidavit filed in the official records, and default quorum is 30% of total voting interests.

## Records and the 10 business day clock

The official records are listed at § 720.303(4)(a) and must be kept at least 7 years. A written request starts a 10 business day clock under § 720.303(5)(a). If the request went by certified mail with return receipt and the association misses the deadline, § 720.303(5)(b) creates a rebuttable presumption that the failure was willful, and § 720.303(5)(c) sets minimum damages of $50 per calendar day for up to 10 days, counted from the 11th business day.

Owners may photograph records with a phone or tablet at no charge. Copies are capped at 25 cents per page, and personnel time may be charged only above one half hour, only up to $20 per hour, and never on a request producing 25 or fewer pages. Nine categories stay off limits, including attorney-client material, personnel and medical records, and personal identifying information such as Social Security numbers and email addresses.

Since July 1, 2024, there are crimes attached. Knowingly, willfully, and repeatedly denying access with intent to harm is a second degree misdemeanor, where repeatedly means two or more violations in 12 months. Destroying accounting records, or failing to create them, is a first degree misdemeanor. Refusing to produce records to avoid detection or arrest is a third degree felony.

One related deadline gets missed constantly. A written request for a detailed accounting of what an owner owes must be answered within 15 business days, and blowing it waives every fine more than 30 days past due for which no prior written notice was given, under § 720.303(14).

## The website requirement, and the number boards get wrong

An association with 100 or more parcels had to have a website or downloadable mobile application in place by January 1, 2025, under § 720.303(4)(b)1. The threshold is 100 parcels. The 150 figure that circulates is an old condominium number, not the HOA one.

Thirteen categories must go up, covering the governing documents, contracts and the past year's closed bids, budgets, financial reports, insurance policies, director education certificates, and meeting notices. It is not a public site: § 720.303(4)(b)2. requires a protected subpage open only to parcel owners and employees, with a username and password issued on written request.

## Budgets, reserves, and the financial report

Reserves are optional in a Florida HOA. Statutory reserves exist only if a majority of the total voting interests votes to establish them and names the components, under § 720.303(6)(d). If that vote never happened, the financial report must carry a capitalized warning that reserves are not fully funded and special assessments may result. Once established, a majority vote at a quorum meeting may waive or reduce funding for one budget year only.

The financial report must be prepared within 90 days after fiscal year end and delivered no later than 120 days after year end, under § 720.303(7). The level tracks total annual revenue: under $150,000 is a report of cash receipts and expenditures, $150,000 to under $300,000 is compiled, at least $300,000 to under $500,000 is reviewed, and $500,000 or more is audited. At least 1,000 parcels means audited regardless of revenue. Members may still vote the level down by a majority present at a properly called meeting, but not in consecutive fiscal years.

## Collecting assessments

Unpaid assessments bear interest at the rate in the declaration or bylaws, and at 18% per year simple interest if the documents are silent. Compound interest is prohibited. The administrative late fee is capped at the greater of $25 or 5% of the past due installment, and only if the documents authorize one. That is § 720.3085(3). Every payment must be applied first to interest, then the late fee, then costs and attorney fees, then the assessment, regardless of what the owner writes on the check.

Three notices, in order, under § 720.3085(3)(d), (4), and (5). Before charging attorney fees, mail the statutory Notice of Late Assessment giving 30 days to pay. Before recording a lien, mail a Notice of Intent to Record a Claim of Lien by certified and first class mail, giving 45 days. Before filing to foreclose, give a further 45 day notice, which may not be sent until the first 45 days have run. A first mortgagee that takes title by foreclosure owes only the lesser of 12 months of assessments preceding acquisition of title or 1% of the original mortgage debt.

## Fines and suspensions

A fine may not exceed $100 per violation or $1,000 in the aggregate, unless the governing documents provide otherwise, under § 720.305(2). That override is the main split from condominiums, where § 718.303(3) sets the same caps with no escape hatch. A fine of less than $1,000 may not become a lien.

Procedure is strict. The board levies, then gives at least 14 days written notice of the right to a hearing, describing the violation, the specific action required to cure it, and the hearing details. The hearing must happen within 90 days, before a committee of at least three board appointees who are not officers, directors, or employees, or the spouse, parent, child, brother, or sister of one. The committee may only confirm or reject, never change the amount. If the violation is cured before the hearing, no fine may be imposed. If the committee confirms, written findings go out within 7 days and payment is due at least 30 days after that notice.

Use rights and voting rights may be suspended separately for a member more than 90 days delinquent, without a hearing, but the suspension must be approved at a noticed board meeting with written notice to the owner, and may never block access to the parcel, including parking. Under § 720.305(7) you may never fine for garbage cans at the curb within 24 hours of collection, or for holiday decorations unless they stay up more than 1 week after written notice.

## Elections, eligibility, and education

Elections follow the governing documents under § 720.306(9)(a). No election is required unless more candidates are nominated than seats exist, directors win by plurality unless the documents say otherwise, and any challenge must be brought within 60 days after results are announced.

Two disqualifiers matter, both in § 720.306(9)(b). Anyone delinquent on any fee, fine, or monetary obligation on the last day to be nominated may not run or appear on the ballot, and a sitting director who becomes more than 90 days delinquent is deemed to have abandoned the seat. Anyone convicted of a felony is ineligible unless civil rights have been restored for at least 5 years. Chapter 720 has no term limits; the 8 consecutive year cap is a condominium rule.

Since July 1, 2024, signing a statement that you read the documents is no longer enough. Within 90 days of being elected or appointed, every director must submit a certificate of completing a department-approved curriculum covering financial literacy and transparency, recordkeeping, levying fines, and notice and meeting requirements, under § 720.3033(1)(a). It is valid up to 4 years and must be retaken at least every 4 years. Directors must also complete 4 hours of continuing education annually, or 8 hours if the association has 2,500 parcels or more. A director who does not file on time is suspended from the board until they comply.

## What Florida boards get wrong

Treating 48 hour posted notice as enough for a special assessment vote. It is 14 days, mailed or delivered, plus posting.

Assuming reserve money is legally protected. In most HOAs it is not, because statutory reserves exist only if the membership voted them in. And assuming special assessment funds are locked to the stated purpose, which is a condominium rule in § 718.116(10) with no Chapter 720 equivalent.

Letting the fining committee negotiate a number. Its only power is to confirm or reject what the board levied.

Publishing the governing documents on an open website when the statute requires an owner-only area, and skipping competitive bids, which § 720.3055(1) requires for any contract above 10% of the total annual budget including reserves.

If your association is close to any of these lines, that is the moment to spend an hour with a Florida community association attorney rather than a year in litigation.`,
    sources: [
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.301",
        note: "definition of homeowners' association, assessment, division, department",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.302",
        note: "scope, no state regulator, Chapter 617 applicability, exclusion of ch. 718/719/721 associations",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.303",
        note: "board meetings and 48 hour / 7 day / 14 day notice, official records list, 10 business day inspection deadline, fees, damages, criminal provisions, website posting at 100 parcels by Jan 1 2025, budgets and reserves, financial reporting bands and deadlines, debit card ban, 15 business day accounting",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.3033",
        note: "director education certificate within 90 days, 4 year validity, 4 and 8 hour continuing education, kickback felony, removal on indictment",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.3035",
        note: "architectural denial must state the specific rule or covenant relied on",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.305",
        note: "fine caps and governing document override, 14 day hearing notice, three member independent committee, 7 day findings, 30 day payment, delinquency suspensions, garbage and holiday decoration carve-outs",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.3055",
        note: "competitive bid threshold at 10% of total annual budget including reserves",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.306",
        note: "14 day member meeting notice and affidavit, 30% quorum, 3 minute right to speak, election procedure, delinquency and felony disqualifiers, right to record meetings",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.308",
        note: "assessments must match proportional share in the governing documents",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.3085",
        note: "18% default interest, greater of $25 or 5% late fee, payment application order, Notice of Late Assessment 30 days, Notice of Intent to Record a Claim of Lien 45 days, 45 day notice of intent to foreclose, safe harbor of 12 months or 1% of original mortgage debt",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.30851",
        note: "estoppel certificate within 10 business days, no fee if late, $250 / $100 expedited / $150 delinquent caps",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.311",
        note: "presuit mediation, election and recall disputes to DBPR arbitration or court",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.315",
        note: "developer-controlled board may not levy a special assessment without owner approval",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.303",
        note: "condominium fine cap with no governing document override, comparison point",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.116",
        note: "condominium special assessment funds restricted to the stated purpose, comparison point",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.112",
        note: "condominium 8 consecutive year term limit, comparison point",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/617.1622",
        note: "nonprofit corporation annual report due between January 1 and May 1",
        fetched: "2026-08-26",
      },
      {
        url: "https://www2.myfloridalicense.com/condos-timeshares-mobile-homes/homeowners-associations/",
        note: "DBPR arbitrates HOA election and recall disputes and does not investigate Chapter 720 complaints",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "florida-recent-changes",
    title: "What changed for Florida association boards in 2024, 2025, and 2026",
    summary: "The bills that actually became law, with chapter numbers and effective dates",
    topic: "State law",
    states: ["FL"],
    readMinutes: 6,
    publishedDate: "2026-08-26",
    photoBrief: "the Florida Capitol building in Tallahassee photographed from the plaza, the 22-story tower flanked by the House and Senate chambers",
    body: `Florida rewrote community association law three years running, then stopped. Here is what passed, what it changed, and when it took effect. Bills that died in committee are not included, which rules out most of what circulated in board newsletters.

## 2024, the year everything moved

Four laws mattered. HB 1203, chapter 2024-221, was the homeowners association bill. HB 1021, chapter 2024-244, was the condominium and cooperative bill. Both were approved in spring 2024 and both took effect July 1, 2024. HB 59, chapter 2024-202, and HB 293, chapter 2024-205, were narrower.

HB 1203 changed four things a Florida HOA board feels immediately.

Director education stopped being optional. The old law let a new director simply certify in writing that they had read the governing documents. That option is gone. Under Fla. Stat. § 720.3033(1)(a) as amended, a director must submit a certificate of completing a department-approved curriculum within 90 days of election or appointment. The certificate is valid up to 4 years, the course must be retaken at least every 4 years, and directors must also complete 4 hours of continuing education annually, or 8 hours if the association has 2,500 parcels or more. A director who does not file is suspended from the board.

Records became a criminal matter. Section 720.303(5) now makes knowing, willful, repeated denial of records access with intent to harm a second degree misdemeanor, where repeated means two or more violations in 12 months. Defacing or destroying accounting records, or failing to create them, is a first degree misdemeanor. Refusing to produce records to avoid detection or arrest is a third degree felony. Section 720.3033(3) made soliciting or accepting a kickback a third degree felony with mandatory removal from office, and § 720.303(13) banned association debit cards outright and made misuse chargeable as theft.

Website posting arrived. Section 720.303(4)(b) required every association with 100 or more parcels to have a website or downloadable mobile application by January 1, 2025, carrying the governing documents, contracts and recent bids, budgets, financial reports, insurance policies, director education certificates, conflict of interest contracts, and meeting notices. It has to sit behind an owner-only login, and the association must issue credentials on request.

Fining was tightened. Section 720.305(2)(b) now requires the notice to describe the violation, the specific action required to cure it, and the hearing details, and to allow attendance by phone or video. The hearing must happen within 90 days. Section 720.305(2)(e) says no fine may be imposed if the violation is cured before the hearing, and § 720.305(2)(f) sets payment at least 30 days out. Section 720.305(7) barred fines for garbage cans at the curb within 24 hours of collection and for holiday decorations left up less than a week after notice. Section 720.303(14) added a 15 business day deadline to answer a written request for a detailed accounting, and made missing it waive fines more than 30 days past due.

HB 59 required associations to deliver the rules and covenants to every member before October 1, 2024 and to every new member after that, now § 720.303(15). HB 293 required associations to adopt hurricane protection specifications, now § 720.3035(6).

On the condominium side, HB 1021 lowered the website posting threshold in § 718.111(12)(g) from 150 units to 25 units, effective January 1, 2026. It also added a checklist requirement: an association responding to a records request must simultaneously give the requestor a checklist of what was and was not produced, and delivering it creates a rebuttable presumption of compliance.

## 2025, condominiums only

One community association bill passed. HB 913, chapter 2025-175, was approved June 23, 2025 and took effect July 1, 2025 except where the act says otherwise. It is titled Condominium and Cooperative Associations and it does not amend Chapter 720.

The structural integrity reserve study deadline moved from December 31, 2024 to December 31, 2025, with an outer limit of December 31, 2026 for associations that are completing a milestone inspection on or before that date. That is § 718.112(2)(g)7.

Both the milestone inspection trigger in Fla. Stat. § 553.899(3)(a) and the reserve study trigger in § 718.112(2)(g)1. now read three habitable stories or more, as determined by the Florida Building Code, rather than three stories.

Reserve funding got flexibility. Under § 718.112(2)(f)2.e., for a budget adopted on or before December 31, 2028, an association that completed a milestone inspection within the previous 2 calendar years may, on approval of a majority of the total voting interests, pause or reduce reserve contributions for no more than two consecutive annual budgets to fund the repairs the inspection recommended. It must then perform a reserve study before restarting contributions. Section 718.112(2)(f)2.c. lets required reserves be funded by special assessment, line of credit, or loan on a majority vote. Section 718.112(2)(f)2.d. lets the board pause reserves with no owner vote when the local building official declares the building uninhabitable due to a natural emergency.

The reserve threshold for individual items rose from $10,000 to $25,000, and the division must post an inflation-adjusted figure by February 1, 2026 and annually after that, under § 718.112(2)(f)2.a. and 6.

Two administrative items. The condominium annual financial report delivery deadline moved from 120 days to 180 days after fiscal year end, under § 718.111(13), and an officer or director must sign an affidavit that it was delivered. And under § 718.501(3), every condominium association had to create and maintain an online account with the division on or before October 1, 2025, with the same requirement for cooperatives.

Homeowners associations got nothing in 2025. The Chapter 720 bill, HB 983, died in the House Judiciary Committee on June 16, 2025. If your board was told that HOA election, recall, or recreational amenity rules changed in 2025, they did not.

## 2026, essentially nothing

The 2026 Regular Session produced 171 chapter laws and none of them was a condominium, cooperative, or homeowners association bill. Chapter 720 was touched only by SB 104, chapter 2026-14, a reviser's bill effective May 12, 2026, which makes technical corrections rather than substantive changes.

The one law that reaches community associations is HB 797, chapter 2026-168, approved June 25, 2026 and effective July 1, 2026. It rewrites Chapter 617, now called the Florida Nonprofit Corporation Act, to align with the Model Nonprofit Corporation Act and the Florida Business Corporation Act, and makes conforming changes across Chapters 718, 719, 720, and others. Because Fla. Stat. § 720.302(5) makes Chapter 617 apply to any association incorporated under it, the Chapter 617 defaults your bylaws rely on where they are silent, including board vacancies, officer duties, director removal, membership rights, and meeting and proxy procedure, sit on a rewritten foundation as of July 1, 2026, even though Chapter 720 itself did not change. Worth a read alongside your bylaws before the next annual meeting.

HB 657, titled Community Associations, passed the House 108 to 2 on March 5, 2026 and then died in Senate Rules on March 13, 2026. It is not law.

## What to do about it

If you have not verified that every sitting director filed a current education certificate, do that first. It is the requirement with the clearest consequence, since a non-filing director is suspended by operation of statute and every vote they cast is exposed.

If your association has 100 or more parcels and no owner-only portal, you have been out of compliance since January 1, 2025.

If you run a condominium of any size, the January 1, 2026 drop to 25 units means the posting duty now reaches almost every association in the state.

The rest is worth one conversation with a Florida community association attorney, once, with your governing documents in hand.`,
    sources: [
      {
        url: "https://www.flsenate.gov/Session/Bill/2024/1203",
        note: "HB 1203 (2024) approved by Governor May 31 2024, chapter 2024-221, effective July 1 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2024/1203/BillText/er/PDF",
        note: "enrolled HB 1203 text, section 13 \"This act shall take effect July 1, 2024\", 720.3033 education amendments",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2024/1021",
        note: "HB 1021 (2024) approved June 14 2024, chapter 2024-244, effective July 1 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2024/59",
        note: "HB 59 (2024), chapter 2024-202, approved May 28 2024, effective July 1 2024, amends 720.303",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.fl.us/data/session/2024/citator/Daily/chapter.pdf",
        note: "2024 chapter number and effective date report, confirming ch. 2024-202, 2024-205, 2024-221, 2024-244",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2025/913",
        note: "HB 913 (2025) approved June 23 2025, chapter 2025-175, \"Except as otherwise provided in this act, this act shall take effect July 1, 2025\"",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2025/913/BillText/er/PDF",
        note: "enrolled HB 913 text, section 39 effective date, October 1 2025 division online account, January 1 2026 amendment to section 8 of ch. 2024-244",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Committees/BillSummaries/2025/html/913",
        note: "official Senate bill summary of CS/CS/HB 913",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2025/983",
        note: "CS/CS/HB 983 (2025) \"Died in Judiciary Committee\" 6/16/2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.fl.us/data/session/2025/citator/Daily/chapter.pdf",
        note: "2025 chapter report, only ch. 2025-173 and 2025-175 relate to community associations",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.fl.us/data/session/2026/citator/Daily/chapter.pdf",
        note: "2026 chapter report, 171 chapters, no condominium/cooperative/HOA bill; ch. 2026-14 = SB 104 reviser's bill effective 05/12/2026; ch. 2026-168 = HB 797 effective 07/01/2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2026/797",
        note: "HB 797 (2026) approved June 25 2026, chapter 2026-168, effective July 1 2026, amends ch. 617 and conforms 718, 719, 720",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Session/Bill/2026/657",
        note: "HB 657 (2026) \"Community Associations\", passed House 108-2 on 3/5/2026, \"3/13/2026 Senate - Died in Rules\"",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.303",
        note: "history line ending \"s. 3, ch. 2024-221; s. 84, ch. 2025-6; s. 47, ch. 2026-14\"",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/720.3033",
        note: "history line ending \"s. 4, ch. 2024-221; s. 85, ch. 2025-6; s. 187, ch. 2026-168\"",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2024/718.111",
        note: "note: \"Section 8, ch. 2024-244, amended paragraph (12)(g), effective January 1, 2026\"",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2023/718.111",
        note: "prior text: \"By January 1, 2019, an association managing a condominium with 150 or more units\"",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.112",
        note: "current SIRS and reserve pause text",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/718.501",
        note: "October 1 2025 division online account requirement",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.flsenate.gov/Laws/Statutes/2026/553.899",
        note: "milestone inspection thresholds and history through ch. 2025-175",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "georgia-hoa-law",
    title: "Georgia HOA law: the opt in nobody told you about",
    summary: "Georgia's Property Owners' Association Act only applies if your declaration says it does",
    topic: "State law",
    states: ["GA"],
    readMinutes: 7,
    publishedDate: "2026-08-26",
    photoBrief: "a recorded subdivision declaration open on the counter of a Georgia superior court clerk's real estate records room, showing the clerk's recording stamp and the book and page numbers",
    body: `Most Georgia board members assume the state HOA statute applies to them. For many Georgia associations it does not. The Property Owners' Association Act is opt in, and whether your association opted in decides your lien rights, your enforcement powers, and whether your covenants expire.

## Start with one question: did your association opt in?

The Georgia Property Owners' Association Act runs from O.C.G.A. § 44-3-220 to § 44-3-235. Under § 44-3-222 a property owners' development comes into existence only on the recording of a declaration under the article, or the amendment of a recorded declaration to submit to it. The statute is blunt: "Any declaration or amendment intending to bring or avail a development of the benefits and provisions of this article shall state an affirmative election to be so governed."

Section 44-3-235(c) closes the door. Benefits under the article "may only be claimed by developments submitted to this article." There is no default and no grandfathering, and it does not matter that everyone has acted as if the Act applied.

Pull the recorded declaration and every amendment from your county superior court clerk's real estate records and look for that express election, usually a sentence citing O.C.G.A. § 44-3-220 and following. Section 44-3-227 also requires an association in the Act to be incorporated under Title 14, so an unincorporated neighborhood group cannot be covered.

An association can still get in. Under § 44-3-235(a) an existing mandatory-membership association may amend its declaration to submit, if the amendment conforms the instrument to the article. The default threshold under § 44-3-226(a)(1) is two-thirds of the association vote.

## Your covenants may have an expiration date

Georgia is one of the few states where restrictive covenants can simply die. O.C.G.A. § 44-5-60(b) says covenants restricting land to certain uses "shall not run for more than 20 years in municipalities which have adopted zoning laws nor in those areas in counties for which zoning laws have been adopted."

Subsection (d)(1) rescues most subdivisions. Covenants affecting planned subdivisions "containing no fewer than 15 individual plots" renew automatically for successive 20 year periods, with no limit on renewals. Subsection (d)(2) lets 51 percent of plot owners kill them by recording a termination document within the two years before a period expires. A subdivision with fewer than 15 plots in a zoned jurisdiction gets no automatic renewal.

Opting in removes the risk. O.C.G.A. § 44-3-234 provides that the limits in § 44-5-60(b) and (d)(1), (2), and (4) do not apply to covenants in an instrument created under or submitted to the article. Condominiums get the same protection through § 44-3-116.

## Assessments, liens, and collection

An association inside the Act gets an automatic lien. Under § 44-3-232(a) assessments are a lien superior to everything except ad valorem taxes, a first priority mortgage or any mortgage recorded before the declaration, and certain secondary purchase money mortgages.

Section 44-3-232(b) sets ceilings and conditions every one of them on your declaration authorizing the charge. A late charge may not exceed the greater of $10.00 or 10 percent of the assessment, and interest may not exceed 10 percent per annum. You may also recover costs of collection including reasonable attorney's fees actually incurred.

Foreclosure is limited. Section 44-3-232(c) requires at least 30 days after notice sent by certified mail or statutory overnight delivery, return receipt requested. Foreclosure is judicial only, and it is barred "unless the amount of the lien is at least $2,000.00." The lien lapses four years after the assessment first became due.

Section 44-3-232(d) is the trap. Any owner, mortgagee, contract purchaser, or prospective lender may request a statement of past due amounts, and the association has five business days from receipt. Miss it and the lien becomes unenforceable against that purchaser or lender. The condominium equivalents sit in § 44-3-109 with the same figures.

An association that never opted in has none of this. It sues on the covenant, gets a judgment, and collects like any other creditor.

## Records: the right most Georgia boards deny

The Act imposes duties but no inspection right. Section 44-3-231(d) requires detailed minutes of all meetings of the members and of the board, detailed and accurate financial records including itemized receipts and expenditures, and other books required by law. The condominium mirror is § 44-3-106(d). Neither says an owner may look.

The inspection right comes from the Nonprofit Corporation Code, and it reaches nearly every Georgia association because nearly every one is a nonprofit corporation. Under O.C.G.A. § 14-3-1602(b) a member may inspect and copy the articles, the bylaws, three years of member meeting minutes, three years of communications to members including the financial statements furnished under § 14-3-1620, a list of current directors and officers, and the most recent annual registration. The only condition is written notice at least five business days ahead, and no purpose need be stated.

A second tier under § 14-3-1602(c) covers board minute excerpts, accounting records, and the membership list. Those need the same five business days plus a demand made in good faith for a proper purpose reasonably relevant to the member's interest, described with reasonable particularity.

Section 14-3-1604 is why this matters. A superior court may order inspection on an expedited basis and "shall also order the corporation to pay the member's costs (including reasonable attorney's fees)" unless the association proves it refused in good faith.

## Meetings

Section 44-3-230(a) requires member meetings at least annually, with notice at least 21 days before any annual or regularly scheduled meeting and at least seven days before any other meeting. At the annual meeting the board must give comprehensive reports of the affairs, finances, and budget projections. Quorum defaults come from § 44-3-228: more than one-third of the votes for a member meeting, one-half of the board's votes for a board meeting.

The condominium mirror is § 44-3-102, with the same periods plus a right for 15 percent of unit owners to call a meeting under instruments recorded after July 1, 1990. Neither Act requires board meetings to be open. If owners have that right in your community, it comes from your bylaws.

## Budgets, reserves, and special assessments

Georgia does not require a reserve study, and it does not require any level of reserve funding for a property owners' association. The only budget duty in the Act is the annual meeting report under § 44-3-230.

Condominiums get one protection. Section 44-3-80(d)(4) requires capital contributions, initiation fees, and the reserve portion of assessments to go into separate reserve accounts, not to be used for common expenses without the agreement of owners holding two-thirds of the association votes. That guards reserves you already collected. It does not make you collect any.

On special assessments the Act sets no owner vote and no dollar cap, so everything comes from your declaration. Condominiums differ. Section 44-3-80(g) provides that an instrument recorded on or after July 1, 2015 shall not authorize a special assessment fee per unit above one-sixth of the annual common expense assessment per fiscal year without the approval of a majority of the unit owners.

## Fines and enforcement

Section 44-3-223 permits fines and suspension of voting rights and common area use only "if and to the extent provided in the instrument," and never in a way that denies access to the lot. If your declaration does not authorize fines, you cannot levy them.

The statute sets no notice or hearing requirement. Follow one anyway. Send written notice describing the violation, the provision violated, the amount, and a date to respond, then record the decision in the minutes. Georgia courts read covenants strictly against the association, and an undocumented fine is one you will not collect.

Since July 1, 2024 the Act also lets an association go straight to court. After notice under the instrument, or 10 days' written notice if the instrument is silent, it may seek injunctive relief without exhausting other remedies. The same 2024 changes bar suspending voting rights over unpaid fines.

## What Georgia boards get wrong

They assume the Act applies. They deny records requests and get hit with fee shifting under § 14-3-1604(c). They charge late fees and interest above the § 44-3-232(b) caps, or charge them when the declaration never authorized them.

They threaten foreclosure on a $400 lien that § 44-3-232(c) forbids. They blow the five business day payoff statement and lose the lien against a buyer. They send the 21 day annual meeting notice in 10 days. And they forget the Secretary of State annual registration, which O.C.G.A. § 14-3-1622 requires between January 1 and April 1 each year, until the corporation is administratively dissolved.

If you do not know whether your association opted in, that is the one question worth paying a Georgia community association attorney to answer, because every other answer depends on it.`,
    sources: [
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-222/",
        note: "text of the opt in requirement, page current as of March 28 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-235/",
        note: "applicability and the \"benefits may only be claimed\" language",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-234/",
        note: "exemption from the 44-5-60 covenant limits",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-5-60/",
        note: "20 year rule, 15 plot renewal, 51 percent termination",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-232/",
        note: "lien priority, late charge and interest caps, 30 day notice, $2,000 floor, four year lapse, five business day statement",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-225/",
        note: "assessment liability and grantee liability",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-231/",
        note: "powers and the records-keeping duty in subsection (d)",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-227/",
        note: "incorporation prerequisite",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-228/",
        note: "quorum defaults",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-230/",
        note: "meeting frequency and 21 day / seven day notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-226/",
        note: "two-thirds amendment threshold",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-80/",
        note: "condo reserve account protection and the one-sixth special assessment cap",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-109/",
        note: "condominium lien figures",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-102/",
        note: "condominium meeting notice and the 15 percent call right",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-106/",
        note: "condominium association records duty",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-113/",
        note: "Condominium Act applicability and the October 1 1975 date",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-14-corporations-partnerships-and-associations/ga-code-sect-14-3-1602/",
        note: "member inspection right and the five business day notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-14-corporations-partnerships-and-associations/ga-code-sect-14-3-1603/",
        note: "copying rights and cost limits",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-14-corporations-partnerships-and-associations/ga-code-sect-14-3-1604/",
        note: "court-ordered inspection and attorney fee shifting",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-14-corporations-partnerships-and-associations/ga-code-sect-14-3-1620/",
        note: "annual financial statements to members",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-14-corporations-partnerships-and-associations/ga-code-sect-14-3-701/",
        note: "annual member meeting requirement",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-14-corporations-partnerships-and-associations/ga-code-sect-14-3-704/",
        note: "10 / 30 / 60 day meeting notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-14-corporations-partnerships-and-associations/ga-code-sect-14-3-702/",
        note: "5 percent special meeting demand",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-14-corporations-partnerships-and-associations/ga-code-sect-14-3-1622/",
        note: "January 1 to April 1 annual registration",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.onecle.com/georgia/title-44/chapter-3/article-6/index.html",
        note: "complete section list and headings for the POA Act",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.onecle.com/georgia/title-44/chapter-3/article-3/index.html",
        note: "complete section list and headings for the Condominium Act",
        fetched: "2026-08-26",
      },
      {
        url: "https://gov.georgia.gov/document/2024-signed-legislation/hb-220/download",
        note: "signed text of HB 220 amending 44-3-223, 44-3-230 and 44-5-60",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-1-general-provisions/ga-code-sect-1-3-4/",
        note: "default effective date rule for Georgia acts",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "georgia-recent-changes",
    title: "Georgia's 2024 and 2026 HOA laws, and what changes when",
    summary: "HB 220 took effect in 2024; SB 406 adds state registration starting January 1, 2027",
    topic: "State law",
    states: ["GA"],
    readMinutes: 7,
    publishedDate: "2026-08-26",
    photoBrief: "the cover page of a Georgia enrolled Senate bill printed on legal paper, showing the bill number and the sponsor block",
    body: `Georgia changed its community association law twice in three years. The 2024 act is already in force. The 2026 act is the larger one, and most of it does not bite until January 1, 2027.

## HB 220, effective July 1, 2024

House Bill 220 amended four sections of Title 44 and added a fifth provision that reaches associations outside the Property Owners' Association Act. The bill has no effective date section, so under O.C.G.A. § 1-3-4(a)(1) an act approved between January 1 and July 1 takes effect on July 1 of that year.

The core change was enforcement. HB 220 rewrote O.C.G.A. § 44-3-223 for property owners' associations and § 44-3-76 for condominiums so that after notice under the instrument, or 10 days' written notice if the instrument is silent, an association may pursue injunctive relief "without the need or requirement to first pursue or utilize any other remedies, regardless of whether other remedies may be available or might otherwise be adequate." Notice is excused where the violation presents a clear and imminent danger to life, person, or property, or where injunctive relief would become moot before the notice period ran.

The second change protects owners. As rewritten, § 44-3-223 permits fines "which shall not impact voting rights," permits suspension of voting rights only for failure to pay regular and special assessments, and bars any suspension that denies an owner the right to vote in board elections based on failure to pay outstanding fines.

The third change lets owners force a meeting. HB 220 added § 44-3-230(b): if an association fails to hold an annual meeting on or before the last day of its fiscal year, holders of at least 5 percent of the voting power may call one, unless the articles or bylaws set a higher figure, and those documents may not require more than 25 percent.

The fourth change reaches neighborhoods that never opted into the Act. HB 220 added O.C.G.A. § 44-5-60(d)(6), which provides that in every planned subdivision containing no fewer than 15 individual plots, owners and occupants must comply with the covenants, and an association created under those covenants may sue to recover sums due, for damages, for injunctive relief, or for any other remedy, and may pursue injunctive relief without first using other remedies. To the extent the instrument provides, it may impose fines and temporarily suspend voting rights and common area use, but never access to the property. The paragraph does not make covenants in smaller subdivisions unenforceable, and it does not create a lien.

For condominiums, HB 220 also added a utility termination remedy to § 44-3-76. To the extent the instruments provide, water, gas, electricity, heat, and air conditioning supplied by the association may be terminated for failure to pay amounts due under § 44-3-109(a), but only after final judgments totaling more than $750.00, and subject to the same suspension standards and notice requirements the utility providers themselves must follow.

## SB 406, the Georgia Property Owners' Bill of Rights Act

Section 9 of Senate Bill 406 sets the timing. The act becomes effective January 1, 2027, except that Section 7 became effective July 1, 2026 and applies to all actions filed on or after that date.

Section 7 is already in force. Before an association may collect or be awarded attorney's fees, it must send an initial written notice by certified mail or statutory overnight delivery identifying any outstanding fines or delinquent fees, give the owner 30 days from receipt to pay, and provide an itemized list of the reasonable attorney's fees claimed. There is a narrow exception for emergency conditions involving public safety or preservation of property. A judge conducting a bench trial in an action to recover sums assessed against an owner must also review the fee claim for reasonableness and enter an order stating whether the fees were reasonable before awarding them.

Everything below takes effect January 1, 2027.

Registration. The bill adds a new Chapter 17A to Title 43. Under O.C.G.A. § 43-17A-2(a), no person may operate an owners' association in Georgia unless registered with the Secretary of State, and an unregistered association may not collect fines or fees, file or record liens, or initiate foreclosure. Registration means filing the governing documents plus a statement with the association's name, address, and officers, and a financial statement dated no more than one year before filing. The fee is $100.00 initially and for each annual renewal, registrations expire December 31 each year, and a material change in name, address, officers, or control requires an amended filing within 30 days.

There is an opt out, and it is expensive. Under § 43-17A-2(a)(2)(B) an entity may notify the Secretary of State in writing that it elects not to register, becoming a "nonregistered owners' association." Such an association may not assess or collect fines or fees or accelerated assessments against any owner at all.

Records. Section 43-17A-2(g) requires an association to maintain for not less than ten years, at an office in Georgia or at its principal office, all records including electronic records relating to any assessments, fines, fees, liens, and foreclosures. Section 43-17A-2(f) makes those records subject to examination by the Secretary of State.

Complaints. Under § 43-17A-5 any person residing in an owners' development who claims damage from association action or inaction may file a written complaint with the Secretary of State within 180 days of the conduct. A hearing officer investigates and may order a hearing, and after conclusions issue the parties have 15 days to comply.

Filing a complaint acts as an automatic stay barring collection of the fines or fees at issue, and the hearing officer may extend that stay 15 days past the conclusions. The nonprevailing party pays a $100.00 administrative fee. Appeals go to magistrate court for smaller amounts or superior court otherwise, within 20 days of the order.

Payments. Section 43-17A-8 dictates how money is applied: regular assessments or dues until current, then special assessments, then specific assessments, then other fees and fines. No association may refuse to accept payment from an owner in any amount for any assessment, and none may assess or collect accelerated assessments.

Foreclosure. Section 5 of the bill rewrites O.C.G.A. § 44-3-232(c). The pre-foreclosure notice period rises from 30 days to 60, and the notice must state that payment before the sixtieth day following receipt eliminates the right of foreclosure.

The minimum lien for foreclosure changes from $2,000.00 to "the lesser of $4,000.00 or an amount equal to 12 months of regular assessments in arrears but not less than $2,000.00," and no specific assessment, fine, or fee counts toward that amount. The association may bid only up to the amount of its lien, and the lien lapse period extends from four years to six.

A new way in. Section 6 adds O.C.G.A. § 44-3-235(a)(3), which lets a mandatory-membership association submit to the Property Owners' Association Act when 80 percent of the association vote approves and the association records an instrument certifying the vote and giving notice that recordation subjects the association to the article. Section 4 amends § 44-3-226(b) so that no instrument amendment may require approval of more than 80 percent of the association vote and mortgagees holding 80 percent of the mortgaged voting interest.

## What to do now

Two things are already due. Since July 1, 2026, no attorney's fee demand should go out without the certified mail notice and the 30 day cure period behind it. Since July 1, 2024, no ballot should be refused over an unpaid fine.

Before January 1, 2027, budget the $100.00 registration fee, gather the governing documents and a financial statement dated within the year, decide who signs as the authorized officer, and put ten years of assessment, fine, lien, and foreclosure records in one place at a Georgia address. Then have a Georgia attorney read your collection policy against the new payment priority and the new foreclosure floor before the first delinquency of 2027.`,
    sources: [
      {
        url: "https://gov.georgia.gov/document/2026-signed-legislation/sb-406/download",
        note: "signed text of SB 406 as passed, including Chapter 17A of Title 43, the 44-3-232 amendments, and the Section 9 effective dates",
        fetched: "2026-08-26",
      },
      {
        url: "https://gov.georgia.gov/document/2024-signed-legislation/hb-220/download",
        note: "signed text of HB 220 as passed by House and Senate, amending 44-3-76, 44-3-106, 44-3-223, 44-3-230, 44-3-231 and adding 44-5-60(d)(6)",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-1-general-provisions/ga-code-sect-1-3-4/",
        note: "default effective date rule making HB 220 effective July 1, 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://codes.findlaw.com/ga/title-44-property/ga-code-sect-44-3-232/",
        note: "pre-amendment text of the lien section for comparison",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "illinois-hoa-law",
    title: "Illinois HOA and condo law for board members",
    summary: "Two different acts, two different sets of deadlines, and boards mix them up constantly",
    topic: "State law",
    states: ["IL"],
    readMinutes: 8,
    publishedDate: "2026-08-26",
    photoBrief: "a printed board meeting notice taped to the inside of a condominium building's entry vestibule wall next to the mailbox bank",
    body: `Illinois runs two parallel statutes for community associations, and their numbers are not the same. Using a condominium deadline in a townhome association, or the reverse, is the most common way an Illinois board loses a records case or has a budget rejected.

## Which act governs you

Condominiums fall under the Condominium Property Act, 765 ILCS 605. Everything else with a mandatory-assessment declaration falls under the Common Interest Community Association Act, 765 ILCS 160, which reaches townhomes, villas, and single-family homes. Both are usually also nonprofit corporations under 805 ILCS 105.

## The small association exemptions

Section 1-75 is unusual, and it is the first place to look. Under 765 ILCS 160/1-75(a), an association organized under the General Not for Profit Corporation Act of 1986 and having either 10 units or less, or annual budgeted assessments of $100,000 or less, is exempt from the entire Act unless it elects coverage by a majority of its directors or members.

Read that as two conditions. An association organized as an LLC, or not incorporated at all, does not qualify however small it is. And $100,000 is fixed with no inflation adjustment, so the year your budget crosses it you acquire the full Act. Section 1-75(b) adds a narrower partial exemption from § 1-30(a), § 1-40(a) and (b), and § 1-55, for associations of 10 units or less, associations budgeting $50,000 or less, and associations whose documents bar using courts to collect.

## Open meetings and notice

Under 765 ILCS 605/18(a)(9)(A) every condominium board meeting must be open to any unit owner. The board may close a portion only for pending or probable litigation, personnel and service provider decisions, rule violations, an owner's unpaid share of common expenses, or consulting legal counsel. Any vote on those matters must be taken at an open meeting. The CICAA version at 765 ILCS 160/1-40(b)(5) carries the same open-vote rule, and § 1-40(b)(6) adds a required member comment period.

Board meeting notice is 48 hours in both acts, by delivery or by posting in entranceways, elevators, or other conspicuous common areas. Membership meeting notice is 10 to 30 days in both, and both boards must meet at least four times a year.

## Records

Section 765 ILCS 605/19(a) lists ten categories a condominium board must keep at the principal office, including seven years of minutes, current insurance policies, contracts and leases then in effect, the owner list, 12 months of ballots and proxies, books and records for the current and 10 preceding fiscal years, and any reserve study.

Under § 19(b) a member may inspect and copy everything on that list except the owner list and the ballots, on a written request stating with particularity the records sought. No purpose is required. Failure to produce them within 10 business days is deemed a denial, and a member who prevails is entitled to reasonable attorney's fees and costs.

The owner list and the ballots are different. Under § 19(e) those require a purpose that relates to the association, the board may demand a written no-commercial-purpose certification, and attorney's fees come only if the court finds the board acted in bad faith.

The CICAA rule at 765 ILCS 160/1-30(i) differs in two ways that matter. The deadline is 30 days, not 10 business days, and the proper-purpose requirement reaches more records, including ballots, proxies, and anything else available to a nonprofit member under 805 ILCS 105/107.75.

## The budget, and the 115 percent petition

Owners must get the proposed annual budget in advance, marked to show which portions are for reserves, capital expenditures or repairs, or real estate taxes. For condominiums that is at least 25 days before adoption under 765 ILCS 605/18(a)(6). For common interest communities it is at least 30 days but not more than 60 days under 765 ILCS 160/1-45(a).

Then the petition. Under 765 ILCS 605/18(a)(8)(ii), if an adopted budget or separate assessment would make the sum of all regular and separate assessments payable this fiscal year exceed 115 percent of last year's, owners holding 20 percent of the votes may petition the board within 21 days of the board action. The board must call an owner meeting within 30 days of delivery. Unless a majority of the total votes are cast at that meeting to reject, it is ratified. The CICAA rule at 765 ILCS 160/1-45(c) is identical except that the petition window is 14 days.

Two carve-outs matter. Separate assessments for emergencies or mandated by law escape the petition entirely. And assessments for additions and alterations not in the adopted budget go to an owner vote regardless of size, needing two-thirds of all unit owner votes for condominiums under § 18(a)(8)(v) and a simple majority of the members for common interest communities under § 1-45(f).

## Reserves

Condominiums have a real duty. Under 765 ILCS 605/9(c)(2), all budgets adopted on or after July 1, 1990 shall provide for reasonable reserves for capital expenditures and deferred maintenance for repair or replacement of the common elements. The board must consider five factors, among them repair and replacement cost, useful life, any independent professional reserve study it may obtain, and the impact on owners and unit values. Nothing there requires a study, and Illinois has no reserve study mandate.

Owners can waive. Under § 9(c)(3) an association without a reserve requirement in its own instruments may waive the statutory requirement by a vote of two-thirds of the total votes. Under § 9(c)(4) the waiver must be disclosed in the financial statements and in bold print in the § 22.1 resale response, and in exchange no board member or managing agent is liable for the shortfall. Common interest communities have no equivalent duty at all.

## Collecting assessments

Condominiums get a statutory lien. Under 765 ILCS 605/9(g)(1), unpaid common expenses or fines, plus interest, late charges, reasonable attorney fees, and costs of collection, are a lien prior to all other liens except government tax liens and encumbrances recorded before the failure to pay, and § 9(h) allows recording and foreclosure like a mortgage. The CICAA creates no statutory lien at all, so a common interest community's lien comes from its declaration.

The six month priority is narrower than boards think. Section 9(g)(4) makes a foreclosure purchaser other than a mortgagee pay the common expenses that would have become due, absent acceleration, during the six months immediately preceding institution of an action to enforce collection. If the association never filed a collection action before the foreclosure, there is no window to reach back into.

The powerful Illinois remedy is possession. Under 735 ILCS 5/9-102(a)(7) an eviction action lies against a condominium owner who fails to pay assessments or a fine. Section 9-102(a)(8) extends it to common interest communities, but only if the association is a not-for-profit corporation or an LLC, owners may attend board meetings as condominium owners do, and the board voted to come under the article and notified owners.

The demand under 735 ILCS 5/9-104.1 must give at least 30 days. If the amounts are found due, 735 ILCS 5/9-111 directs an eviction order for the whole unit plus a money judgment, stayed at least 60 days and up to 180. The board may then lease the unit under § 9-111.1.

## Fines and elections

Fines require process and nothing else. Under 765 ILCS 605/18.4(l) the board may, "after notice and an opportunity to be heard," levy reasonable fines, and 765 ILCS 160/1-30(g) reads the same. Neither sets a cap, and skipping the hearing is the fastest way to lose the fine.

Neither act provides cumulative voting. Condominium board terms are capped at two years, with at least one-third turning over annually; CICAA terms may run four years, with an election at least once every 24 months. Proxies expire after 11 months unless the instruments say otherwise, and a condominium association can eliminate proxies in board elections by adopting a balloting rule at least 120 days before the election. A candidate who wants the owner list uses the § 19(e) route.

## Chicago, and the policy everyone forgets

Chicago condominiums also answer to Municipal Code of Chicago chapter 13-72. Section 13-72-080(a) requires seven categories of records within 10 business days of a written request, and § 13-72-080(c) bars any owner other than a board member from inspecting owners' email addresses and phone numbers unless the association opts out by a two-thirds vote. Section 13-72-085(a) requires 85 percent of owners to elect to sell the property, where 765 ILCS 605/15 requires 75 percent for buildings of four or more units.

Statewide, 765 ILCS 605/35 and 765 ILCS 160/1-90 require compliance with the Ombudsperson Act, 765 ILCS 615, which now sunsets January 1, 2029. The live duty is § 615/35. Every association except a CICAA-exempt one must adopt a written complaint policy, with a sample form and a requirement that each final determination be in writing, issued within 180 days of the complaint, and marked clearly as "final." The deadline was January 1, 2019.

## What Illinois boards get wrong

They assume they are exempt because they are small, without checking that they are organized under the General Not for Profit Corporation Act. They vote in closed session. They use 25 days for a townhome budget or 21 days for a common interest community petition.

They answer a condominium records request in 30 days and lose it at day 11. They fine without a hearing. They treat the six month priority as automatic. They never adopt the complaint policy. And they miss the nonprofit annual report, due under 805 ILCS 105/114.10 within the 60 days immediately preceding the first day of the corporation's anniversary month.

The two acts look similar enough that boards copy language between them. When a deadline matters, read the one that applies to you, and have a community association attorney confirm which that is.`,
    sources: [
      {
        url: "https://www.ilga.gov/legislation/ILCS/details?ActID=3273&ChapterID=62&ChapAct=765+ILCS+160%2F&SeqStart=100000&SeqEnd=1831250",
        note: "full text of the Common Interest Community Association Act including 1-5, 1-25, 1-30, 1-40, 1-45, 1-75 and 1-90",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/legislation/ILCS/details?ActID=2200&ChapterID=62&ChapAct=765+ILCS+605%2F&SeqStart=&SeqEnd=",
        note: "full text of the Condominium Property Act including 9, 15, 18, 18.4, 19, 22.1, 22.2 and 35",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/Legislation/ILCS/Fulltext?DocName=073500050K9-102",
        note: "eviction action for condominiums and common interest communities",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/Legislation/ILCS/Fulltext?DocName=073500050K9-104.1",
        note: "30 day demand and partial payment rule",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/Legislation/ILCS/Fulltext?DocName=073500050K9-111",
        note: "eviction order, money judgment, and the 60 to 180 day stay",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/legislation/ILCS/details?ActID=3587&ChapterID=62&ChapAct=765+ILCS+615%2F&SeqStart=&SeqEnd=",
        note: "Ombudsperson Act, complaint policy at Section 35 and repeal date at Section 70",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/Legislation/ILCS/Fulltext?DocName=080501050K107.75",
        note: "nonprofit books and records and the proper purpose burden",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/Legislation/ILCS/Fulltext?DocName=080501050K114.05",
        note: "annual report contents including the association designation",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/Legislation/ILCS/Fulltext?DocName=080501050K114.10",
        note: "anniversary month filing deadline",
        fetched: "2026-08-26",
      },
      {
        url: "https://idfpr.illinois.gov/content/dam/soi/en/web/idfpr/ccico/pdfs/chicago-municipal-condominium-ordinanace.pdf",
        note: "Municipal Code of Chicago chapter 13-72, records at 13-72-080, deconversion at 13-72-085, penalties at 13-72-110",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "illinois-recent-changes",
    title: "What changed in Illinois community association law since 2024",
    summary: "Small but real changes on FHA sales, accessible parking, and the ombudsperson sunset",
    topic: "State law",
    states: ["IL"],
    readMinutes: 5,
    publishedDate: "2026-08-26",
    photoBrief: "an accessible parking space in a condominium garage with a faded blue wheelchair symbol painted on the concrete and a unit number stenciled on the wall",
    body: `Illinois did not overhaul its association statutes between 2024 and 2026. It made four changes a board can trip over, and it did not pass the one that got the most attention.

## FHA financing can no longer block a sale

Public Act 103-719 amended 765 ILCS 605/22.2 effective January 1, 2025. The section now says that in the event of a sale of a condominium unit by a unit owner, no condominium association shall exercise any right of refusal, option to purchase, or right to disapprove the sale on the basis that the purchaser's financing is guaranteed by the Federal Housing Administration, or for a discriminatory or otherwise unlawful purpose. Any person aggrieved has a right of action in circuit court against the association.

Before this change the section reached only discriminatory or unlawful purposes. If your right of first refusal has ever been used to steer away FHA buyers, or if your resale review asks about loan type at all, that practice needs to stop.

## The ombudsperson sunset moved to 2029

Public Act 104-377 took effect August 15, 2025 and did one thing. It pushed three repeal dates from January 1, 2026 to January 1, 2029: 765 ILCS 605/35, which requires every condominium association to comply with the Condominium and Common Interest Community Ombudsperson Act; 765 ILCS 160/1-90, which imposes the same duty on non-exempt common interest community associations; and 765 ILCS 615/70, the repealer inside the Ombudsperson Act itself.

The practical consequence is that the written complaint policy requirement in 765 ILCS 615/35 is still live. Every association other than a CICAA-exempt one must have adopted a written policy for resolving owner complaints, make it available on request, and include a sample complaint form, a description of how complaints reach the association, the timeline and manner of final determinations, and a requirement that the final determination be in writing, issued within 180 days of the original complaint, and marked clearly and conspicuously as "final."

The compliance deadline was January 1, 2019. If your board has never adopted one, it is overdue, not upcoming. The dispute resolution function in 765 ILCS 615/40 remains conditioned on appropriation, which is why owners rarely see an ombudsperson actually mediate.

## Accessible parking

Public Act 103-916 added 765 ILCS 605/18.12 effective January 1, 2025. The board of managers must adopt a written policy to reasonably accommodate a unit owner with a disability who requires accessible parking. The policy must set out the procedure for submitting a request and the time for board review, and that review period may not exceed 45 days from the date the request is submitted. A copy goes to any owner on request.

Existing condominiums had 90 days after the act's effective date to adopt the policy. New ones have 90 days after the initial board is elected.

Two more parts matter. Subsection (b) requires the board to make reasonable efforts to facilitate a resolution between owners where the association does not control parking that meets the need. Subsection (c) requires accessible parking spaces in new construction and conversion condominiums submitted after the act to remain common elements rather than being sold as parking units or assigned as limited common elements. Subsections (a) and (b) apply to all condominiums that have parking, however that parking is legally structured. Public Act 104-598 makes further wording changes to the same section effective January 1, 2027.

## Marked police and fire vehicles

Public Act 104-580 adds 765 ILCS 605/18.14 and 765 ILCS 160/1-73 effective January 1, 2027. An association may not define or designate a marked law enforcement vehicle assigned to an officer, or a marked firefighter vehicle assigned to a firefighter, as a commercial vehicle subject to a restrictive covenant or rule, so long as the vehicle does not exceed 12,000 pounds. Any such provision is void and unenforceable. Boards with a blanket commercial vehicle rule should plan an amendment or an enforcement carve-out before that date.

## One smaller item, and one that did not pass

Public Act 103-486 amended 765 ILCS 160/1-30 effective January 1, 2024. The substantive addition was subsection (k), which lets a common interest community association contract with the highway commissioner of its road district, if the association makes up 50 percent or more of the population of the township or road district, to furnish materials for road maintenance or repair. Any such purchase must appear in the board's finance report under § 1-45.

Public Act 104-29, effective January 1, 2026, amended 735 ILCS 5/9-102, the eviction article associations use to take possession of a delinquent unit. It added subsection (e), clarifying that nothing in the article prevents law enforcement from enforcing criminal trespass or removing persons or property in a trespass situation. It did not alter the condominium remedy in § 9-102(a)(7) or the common interest community remedy in § 9-102(a)(8).

The bill that drew the most attention did not become law. House Bill 2563 and Senate Bill 1703 in the 104th General Assembly would have required condominium and common interest community associations to conduct and update a reserve study every five years. Neither appears in the statute database, and the reserve provision at 765 ILCS 605/9(c)(2) is still sourced to Public Act 100-292 from 2018. Illinois still requires condominium budgets to provide reasonable reserves and requires the board to consider any independent reserve study it has, but it does not require the study.

## What to do

Adopt the accessible parking policy if you have not. Adopt the ombudsperson complaint policy if you have not, and note that it has been overdue since 2019 rather than newly due. Strip loan-type questions out of your resale review. Look at your commercial vehicle rule before January 1, 2027. And if a vendor tells you Illinois now requires a reserve study, ask for the public act number before you sign anything.`,
    sources: [
      {
        url: "https://www.ilga.gov/documents/legislation/publicacts/103/PDF/103-0719.pdf",
        note: "P.A. 103-719 amending 765 ILCS 605/22.2 to bar refusal based on FHA-guaranteed financing",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/documents/legislation/publicacts/104/PDF/104-0377.pdf",
        note: "P.A. 104-377 moving the repeal of 765 ILCS 605/35, 765 ILCS 160/1-90 and 765 ILCS 615/70 from January 1 2026 to January 1 2029, effective upon becoming law",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/documents/legislation/publicacts/103/PDF/103-0486.pdf",
        note: "P.A. 103-486 amending 765 ILCS 160/1-30",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/documents/legislation/publicacts/104/PDF/104-0029.pdf",
        note: "P.A. 104-29 amending 735 ILCS 5/9-102",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/legislation/ILCS/details?ActID=2200&ChapterID=62&ChapAct=765+ILCS+605%2F&SeqStart=&SeqEnd=",
        note: "current text and source notes for 765 ILCS 605/9, 18.12, 18.14, 22.2 and 35, showing P.A. 103-916 eff. 1-1-25, P.A. 104-598 eff. 1-1-27 and P.A. 104-580 eff. 1-1-27",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/legislation/ILCS/details?ActID=3273&ChapterID=62&ChapAct=765+ILCS+160%2F&SeqStart=100000&SeqEnd=1831250",
        note: "current text and source notes for 765 ILCS 160/1-30, 1-45, 1-73 and 1-90",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ilga.gov/legislation/ILCS/details?ActID=3587&ChapterID=62&ChapAct=765+ILCS+615%2F&SeqStart=&SeqEnd=",
        note: "Ombudsperson Act Sections 35, 40 and 70",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "nevada-hoa-law",
    title: "Nevada HOA law: what NRS 116 requires of your board",
    summary: "Reserves, budgets, records, meetings, fines and the nine-month super priority lien under NRS 116",
    topic: "State law",
    states: ["NV"],
    readMinutes: 11,
    publishedDate: "2026-08-26",
    photoBrief: "a handheld audio recorder sitting on a folding table beside a printed meeting agenda in a community clubhouse",
    body: `Nevada regulates associations more closely than almost any other state. NRS Chapter 116 sets the rules, NAC Chapter 116 fills in the numbers, and the Real Estate Division has an ombudsman and a commission that can fine a board member personally.

## The act, the ombudsman, and the fee

The statute is NRS Chapter 116, the Common-Interest Ownership (Uniform Act), with regulations at NAC Chapter 116 adopted by the Commission for Common-Interest Communities and Condominium Hotels. NRS 116.625 creates the Office of the Ombudsman for Owners in Common-Interest Communities and Condominium Hotels, which processes mediation claims, publishes guidance, investigates disputes where appropriate, and maintains the state registration of every association.

Every association pays an annual per-unit fee to the Administrator under NRS 116.31155. The statute caps it at $5 per unit. The current amount, set by NAC 116.445, is $4.25 per unit. Pay late and NRS 116.31155(4) imposes a penalty of 10% of the fees owed or $500, whichever is less, plus interest. Under NRS 116.31158 the association registers with the ombudsman on a prescribed form at the same time it pays.

## Mediate before you sue

NRS 38.310 bars any civil action over the interpretation, application or enforcement of covenants, bylaws or rules, or over the procedures for changing assessments, unless the claim was first submitted to mediation or referred to a Division program and all administrative procedures in the governing documents were exhausted. A court must dismiss an action filed in violation of that. It applies to the association suing an owner, not just the reverse. The claim goes to the Division with a $50 filing fee under NRS 38.320, is served like a summons, and is answered within 30 days with another $50.

Separately, NRS 116.760 lets an aggrieved person file an affidavit with the Division, which can lead to a complaint before the Commission. Knowingly filing a false affidavit now risks a $10,000 fine and disqualification from board service for up to ten years.

## Manager licensing and the self-managed board

NRS 116A.400(1) requires a certificate to act as a community manager, but NRS 116A.400(6)(e) exempts a board member or officer acting solely within the scope of those duties. A genuinely self-managed board is fine. Pay anyone outside those roles to manage the community and that person needs a certificate.

## Reserves: Nevada requires the money, not just the disclosure

NRS 116.3115(2)(b) says the association shall establish adequate reserves, funded on a reasonable basis, for repair, replacement and restoration of the major components it is obligated to maintain. Reserves may be used only for that and never for daily maintenance. The association may comply through a funding plan that spreads costs over years, if the plan is designed in an actuarially sound manner that ensures the money is there when the work is needed.

There is no percent-funded threshold in the statute. NRS 116.31152(1) requires the board to have a reserve study done at least once every five years, to review the results at least annually to decide whether reserves are sufficient, and at least annually to adjust the funding plan as it deems necessary. So the board decides what adequate means, using the study, and the board wears the consequences.

The study must be done by a person holding a permit under NRS Chapter 116A, except in a community of 20 or fewer units in a county under 55,000 population. It must identify every major component with less than 30 years of remaining useful life and estimate the annual assessment and funding plan needed. A summary goes to the Division within 45 days after the board adopts the results. Reserve withdrawals need two signatures under NRS 116.31153.

## Budget and audit

NRS 116.31151(1) requires the board, not less than 30 and not more than 60 days before the fiscal year begins, to distribute both an operating budget and a reserve budget to every owner. The reserve budget must show each major component's replacement cost and remaining and useful life, the reserves needed against the reserves actually set aside, whether a special assessment is anticipated, and the qualifications of whoever prepared the reserve study. A summary may go out instead, with notice that copies come on request.

Ratification is a veto. Under NRS 116.31151(3), within 60 days after adopting a proposed budget the board sends a summary and sets a meeting 14 to 30 days after mailing. The budget is ratified unless a majority of all units' owners reject it, whether or not a quorum is present. Note that is a majority of all owners, not of those voting.

NRS 116.31144 sets audit thresholds by annual budget, not revenue. From $45,000 to under $75,000, a CPA review in the year before a reserve study year. From $75,000 to under $150,000, a review every fiscal year. At $150,000 or more, an audit every fiscal year. Separately, 15% of the voting members may force an audit by written request within 180 days before the fiscal year ends.

## Records

Under NRS 116.31175(1), on written request the board must make the books, records and other papers available for review at the business office or a location within 60 miles, during regular working hours, expressly including the financial statement, both budgets, the reserve study, and all contracts and court filings.

Copies of the financial statement, budgets and reserve study must reach the owner or the ombudsman within 21 days, electronically at no charge. If the association cannot do that, it may charge up to 25 cents a page for the first 10 pages and 10 cents after. Miss 21 days and NRS 116.31175(3) imposes $25 for each day. The board may not charge more than $25 an hour for review.

Subsection (4) puts three things outside the request right: employee personnel records other than hours, salaries and benefits; records about another owner, including that owner's architectural plans; and documents still being developed that are not yet on an agenda for final approval. Subsection (5) requires a searchable, de-identified record of every violation for which a sanction was imposed. Records are kept at least ten years and minutes until the community is terminated.

## Meetings

Owners meet at least once a year and the board election ballots are opened and counted there, under NRS 116.3108(1). Notice goes out 15 to 60 days ahead with a copy of the agenda. A petition from owners holding 10% of the votes forces a special meeting, held 15 to 60 days after the petition is received.

The board must meet at least quarterly and not less than once every 100 days, and at least twice a year outside standard business hours, under NRS 116.31083(1). Notice goes out at least 10 days ahead. The agenda rules in NRS 116.3108(4) apply to board meetings too: a clear and complete statement of every topic, including any proposed amendment, any fee or assessment to be imposed or increased, any budgetary change and any proposal to remove an officer, plus a separate list clearly denoting the items on which action may be taken. Nothing off that list can be acted on except in an emergency. NRS 116.31083(6) then requires an owner comment period at both the beginning and the end of every board meeting, with the opening period limited to agenda items.

Every board meeting must be audio recorded and minuted, except executive session, and the recording, minutes and a summary made available within 30 days. Minutes must show who was present and absent, the substance of everything proposed, discussed or decided, and each member's vote. At least quarterly the board must review six financial items at a meeting under NRS 116.31083(7), including reconciliations of both accounts and the latest bank statements.

NRS 116.31085(3) allows executive session only to consult the association's attorney under privilege, to discuss a community manager's or employee's character, misconduct, competence or health, to discuss a violation of the governing documents including nonpayment of an assessment, or to discuss a missed construction schedule. Subsection 2 flatly forbids using executive session to open or consider bids or to enter into, renew, modify or terminate a contract. Whatever is discussed must be generally noted in the minutes. On bids, NRS 116.31086 requires at least three bids where reasonably possible for a project expected to cost 3% or more of the annual budget, or 1% in a community of 1,000 or more units, opened and read aloud at a board meeting.

## The lien, the nine-month super priority, and the notice sequence

The lien arises when an assessment, fine or construction penalty becomes due, and recording the declaration perfects it. Under NRS 116.3116(3) it beats a first security interest to the extent of charges under NRS 116.310312, nine months of assessments that would have become due before the notice of default and election to sell is recorded, and enforcement costs capped by subsection 5. If Fannie Mae or Freddie Mac regulations require a shorter period the window shrinks, but never below six months. Attorney fees are never part of the super priority amount, and subsection 5 caps the enforcement costs that ride ahead of the mortgage at $165 for a demand or intent to lien letter, $325 for a notice of delinquent assessment, $90 for an intent to record a notice of default letter, $400 for a notice of default, and $400 for a trustee's sale guaranty.

What the owner can be charged is capped separately by NAC 116.470, a per-action schedule topping out at $640 for a notice of default and $520 for a notice of delinquent assessment lien. It caps management company fees at $325, requires actual third-party costs to pass through without markup, and caps the total at $2,925. For 15 business days after an owner asks for a payoff figure, no collection fee may be charged.

The foreclosure sequence has a pre-step boards miss. Under NRS 116.31162(4), before the association may even mail a notice of delinquent assessment, it must wait until at least 60 days after the obligation went past due, then mail a schedule of the fees that may be charged, a proposed repayment plan, and notice of the right to contest the debt at a board hearing. Only if 30 days pass without payment, a plan or a hearing request may it proceed.

Then: mail the notice of delinquent assessment by certified or registered mail, return receipt requested. Wait at least 30 days and record a notice of default and election to sell, itemized and carrying a 14-point bold warning. Wait 90 days, running from the later of recording or mailing. Within 10 days after recording, mail copies to lienholders under NRS 116.31163. After the 90 days, NRS 116.311635 requires recording a notice of sale, posting it 20 consecutive days, publishing it three times over three weeks, serving or posting it at the unit, and mailing it to lienholders and to the ombudsman. The owner or a lienholder can stop the sale by paying up to five days before it. NRS 116.31162(6) bars foreclosing on a fine unless the violation posed an imminent threat to health, safety or welfare.

## Fines

NRS 116.31031(1)(b) caps a fine at $100 per violation and $1,000 per hearing, unless the violation poses an imminent threat of a substantial adverse effect on health, safety or welfare. A schedule of fines must be delivered to every unit. The board may not fine unless the owner had written notice of the governing document provision at least 30 days before the violation, and then written notice specifying the violation, the proposed cure, the fine amount and the hearing date, with a clear and detailed photograph where one is possible. A hearing is required unless the fine is paid, the right is waived in writing, or the person fails to appear. A board member who owes past-due assessments may not participate or vote, and if one does the action is void.

If the violation is not cured within 14 days, NRS 116.31031(7) treats it as continuing and allows an additional fine, not exceeding the original, for each seven-day period, without further notice or hearing and without the caps. Past-due fines bear no interest, and fines go in a separate compliance account under NRS 116.310315.

## Elections

At least three board members, all unit owners. A term may not exceed three years, and there is no limit on the number of terms unless the governing documents impose one. Terms must be staggered. At least 30 days before ballots are prepared, every owner gets notice of eligibility. Candidates must disclose apparent conflicts and whether they are in good standing, meaning no past-due assessments. The election is by secret paper or electronic ballot, owners get at least 15 days to return it, no quorum is required, only ballots actually received count, and incumbents and candidates may not touch the ballots before they are counted at the annual meeting. All of that is NRS 116.31034.

Subsection (10) disqualifies anyone who lives with, is married to, is the domestic partner of, or is related within the third degree to another board member or officer, anyone who stands to gain personal profit from a matter before the board, and anyone whose spouse, parent or child manages the association. Within 90 days of taking office every member must certify in writing, on a form prescribed by the Administrator, that they have read and understand the governing documents and NRS 116.

## What Nevada boards get wrong

Sending a notice of delinquent assessment before the 60-day and 30-day steps in NRS 116.31162(4). Charging collection fees above the NAC 116.470 schedule. Fining without proof the owner had 30 days' notice of the rule, or without the photograph. Holding one owner comment period instead of two. Using executive session to award a contract or open bids. Forgetting to audio record. Missing the 45-day deadline to send the reserve study summary to the Division. Suing over a covenant without first filing an NRS 38.310 claim, which gets the case dismissed. Any of these can end with the Commission fining a board member personally, so it is worth paying a Nevada community association attorney to review your collection and enforcement policies once.`,
    sources: [
      {
        url: "https://www.leg.state.nv.us/NRS/NRS-116.html",
        note: "NRS Chapter 116 full text, revision stamp Rev. 4/15/2026, current through the 2025 session: NRS 116.3108, 116.31031, 116.310313, 116.310315, 116.31034, 116.31036, 116.31069, 116.31083, 116.31085, 116.31086, 116.31087, 116.3113, 116.31144, 116.3115, 116.31151, 116.31152, 116.31153, 116.31155, 116.31158, 116.3116, 116.31162, 116.31163, 116.311635, 116.31175, 116.3118, 116.625",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.nv.us/NAC/NAC-116.html",
        note: "NAC Chapter 116, revision stamp Rev. 6/7/2026: NAC 116.445 annual fee of $4.25 per unit, NAC 116.470 collection fee schedule and $2,925 cap",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.nv.us/NRS/NRS-038.html",
        note: "NRS 38.300 to 38.360, the mediation and arbitration prerequisite and filing fees",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.nv.us/NRS/NRS-116A.html",
        note: "NRS 116A.400, community manager certificate requirement and the executive board exemption",
        fetched: "2026-08-26",
      },
      {
        url: "https://archive.leg.state.nv.us/Session/82nd2023/Bills/SB/SB417_EN.pdf",
        note: "2023 SB 417 raising the records review charge cap to $25 per hour and the false affidavit penalty to $10,000",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "nevada-recent-changes",
    title: "Nevada HOA law changes from the 2023 and 2025 sessions",
    summary: "Electronic ballots, website rules, records fees, solar deadlines and the new $5,000 fine",
    topic: "State law",
    states: ["NV"],
    readMinutes: 6,
    publishedDate: "2026-08-26",
    photoBrief: "rooftop solar panels being installed on a tile roof in a Las Vegas subdivision",
    body: `Nevada's legislature meets in odd-numbered years, so NRS 116 changes on a two-year clock. Two sessions have passed since 2022. Here is what actually changed, with bill numbers and effective dates.

## 2023: electronic ballots and voting

AB 309, chapter 172 of the 2023 Statutes of Nevada, was the substantial one. It authorized secret electronic ballots for the election and removal of board members and for electing delegates, amending NRS 116.31034, NRS 116.31036 and NRS 116.31105. Results of electronic ballots must be reviewed, announced and entered into the record at a meeting of the association, and physical ballots are still opened and counted there.

A board member facing removal gained the right to request a board meeting, held before the removal vote, at which the removal is an agenda item. Notice of that meeting must go to owners no later than five days after the written request.

AB 309 also rewrote how notices reach owners under NRS 116.31068, confirmed in NRS 116.311 that an association may conduct a vote for the election or removal of a board member without a meeting, allowed voting machines meeting stated requirements, and added exceptions to the two-signature rule for operating account withdrawals in NRS 116.31153 covering automatic and annual payments. Sections 1 to 5 and 8 to 11 took effect October 1, 2023.

## 2023: the association website, narrowed

SB 378, chapter 436, was approved June 13, 2023 and took effect on approval. It narrowed NRS 116.31069. An association with 150 or more units must still maintain a secure website or electronic portal, but the required contents are now specific: the governing documents, the annual budget and any proposed budgets, and the notices and agendas for upcoming meetings. The old requirement to post any documents relating to the association is gone.

More importantly for boards, SB 378 removed the mandate that the portal accept electronic assessment payments. Under the new NRS 116.310695, a portal may offer electronic payment only if the association or its payment processor carries cybersecurity insurance with a minimum aggregate amount of $5,000,000 covering losses from unauthorized acquisition of personal information, along with other conditions, and only after the board evaluates and determines that offering electronic payment is in the association's best interest.

## 2023: records charges and false affidavits

SB 417, chapter 234, raised the maximum an association may require an owner to pay to review books, records, contracts or other papers from $10 per hour to $25 per hour, at NRS 116.31175(8).

It also strengthened NRS 116.760. The maximum administrative fine for knowingly filing a false or fraudulent affidavit with the Division rose from $1,000 to $10,000, and the Commission or a hearing panel may now disqualify the filer from serving on an executive board for up to ten years. Someone sanctioned twice can be designated a vexatious affiant, after which the Division will not accept an affidavit from that person unless the ombudsman first grants leave. SB 417 contains no special effective date clause, so it took effect October 1, 2023 under NRS 218D.330.

AB 189, chapter 91, effective on approval in 2023, dealt with the hours construction work may begin in declarant-controlled communities in Clark County, at NRS 116.347.

## 2025: solar requests now run on a clock

SB 440, chapter 262, added two new sections to NRS 116, codified at NRS 116.333 and NRS 116.334, governing requests to install a distributed generation system, which in practice means residential solar.

If the association has adopted solar rules under the new NRS 116.334, it has 35 days to approve or deny a request. A denial must be in writing and must state reasons grounded in those rules. Fail to act within 35 days and the request is deemed approved. If the owner fixes the stated problems and resubmits, the clock drops to 15 days, again with automatic approval on silence.

If the association has not adopted solar rules, it has 15 days and it must approve. It may not deny the request and may not impose any conditions on the installation.

Rules an association does adopt cannot conflict with the National Electric Code, local ordinances or state law, must require the installer to be properly licensed, and cannot be enforced against an owner where compliance would add more than 3% to the cash cost of the installation, which the owner may prove with a written estimate from an unaffiliated licensed solar company dated within 60 days. Sections 1 to 29 took effect October 1, 2025.

## 2025: religious and cultural displays

SB 201, chapter 300, effective July 1, 2025, added NRS 116.323 and amended NRS Chapter 118A. An association may not prohibit an owner, tenant or occupant from displaying religious or cultural items on a door, doorframe or within a space they exclusively occupy. Reasonable restrictions on placement and manner survive, and the association may still act where a display exceeds 36 by 12 inches or the size of the door, threatens health, safety or welfare, obstructs a door, violates the law, or is obscene or discriminatory. Conflicting provisions in governing documents and rental agreements are void and unenforceable. The prevailing party in an enforcement action recovers reasonable attorney's fees and costs.

## 2025: the Commission's fine went up fivefold

AB 396, chapter 365, is mostly an accessory dwelling unit bill, but it carries several NRS 116 changes. The one every board should know: NRS 116.785 now allows the Commission or a hearing panel to impose an administrative fine of up to $5,000 for each violation, raised from $1,000. The same increase applies to violating a Commission order.

AB 396 also amended NRS 116.2117 to let an association amend its declaration to reasonably restrict leasing where the restriction is designed to meet lender or insurer underwriting requirements, changed the voting requirements for terminating a common-interest community in NRS 116.2118, revised the rental restriction rules in NRS 116.31065 and NRS 116.335, and added NRS 116.4109(1)(g), which requires the resale package to include proof of the insurance policies the association must carry under NRS 116.3113.

The timing is unusual. Under section 14 of the act, sections 1 to 12 take effect on passage and approval only for adopting regulations and doing preparatory administrative work, and on July 1, 2026 for all other purposes. The Nevada Legislature's own statute pages carry two versions of NRS 116.4109 and NRS 116.31065 for exactly this reason, one effective through June 30, 2026 and one after.

## 2025: a narrow insurance change

AB 376, chapter 423, is an insurance bill. Its section 25.6 amended NRS 116.3113 so that the requirement to include units in the association's property insurance does not apply to a policy covering the peril of wildfire that coordinates with or subrogates individual owner wildfire policies. Section 25.6 took effect July 1, 2025.

## What this means for your policy binder

If your association has 150 or more units, check the website against the narrowed NRS 116.31069 list, and do not accept online payments unless the cybersecurity insurance condition in NRS 116.310695 is satisfied. If you are still charging $10 an hour for record review you are leaving money on the table, and if you are charging more than $25 you are over the cap. Put a calendar rule in place for solar requests, because 15 days passes quickly and silence approves the request. And if your resale packages go out after July 1, 2026, they need proof of insurance in them.`,
    sources: [
      {
        url: "https://archive.leg.state.nv.us/Session/82nd2023/Bills/AB/AB309_EN.pdf",
        note: "2023 AB 309 enrolled text, digest and section 12 effective dates",
        fetched: "2026-08-26",
      },
      {
        url: "https://archive.leg.state.nv.us/Session/82nd2023/Bills/SB/SB378_EN.pdf",
        note: "2023 SB 378 enrolled text, digest and section 6 effective on passage and approval",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.nv.us/Statutes/82nd2023/Stats202323.html",
        note: "Statutes of Nevada 2023, chapter 436 (SB 378), approved June 13, 2023",
        fetched: "2026-08-26",
      },
      {
        url: "https://archive.leg.state.nv.us/Session/82nd2023/Bills/SB/SB417_EN.pdf",
        note: "2023 SB 417 enrolled text, $10 to $25 per hour, $1,000 to $10,000 affidavit fine, vexatious affiant",
        fetched: "2026-08-26",
      },
      {
        url: "https://archive.leg.state.nv.us/Session/82nd2023/Bills/AB/AB189_EN.pdf",
        note: "2023 AB 189 enrolled text, section 7 effective on passage and approval",
        fetched: "2026-08-26",
      },
      {
        url: "https://archive.leg.state.nv.us/Session/83rd2025/Bills/SB/SB440_EN.pdf",
        note: "2025 SB 440 enrolled text, sections 13.3 and 13.7, section 30 effective October 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://archive.leg.state.nv.us/Session/83rd2025/Bills/SB/SB201_EN.pdf",
        note: "2025 SB 201 enrolled text, section 3 effective July 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://archive.leg.state.nv.us/Session/83rd2025/Bills/AB/AB396_EN.pdf",
        note: "2025 AB 396 enrolled text, digest, sections 5 to 10 and section 14 effective dates",
        fetched: "2026-08-26",
      },
      {
        url: "https://archive.leg.state.nv.us/Session/83rd2025/Bills/AB/AB376_EN.pdf",
        note: "2025 AB 376 enrolled text, section 25.6 amending NRS 116.3113, section 27 effective July 1, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.nv.us/NRS/NRS-116.html",
        note: "NRS 116 source notes mapping each amendment to its Statutes of Nevada page, and the dual versions of NRS 116.4109 and NRS 116.31065",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.leg.state.nv.us/NRS/NRS-218D.html",
        note: "NRS 218D.330, Nevada's default October 1 effective date for acts with no effective date clause",
        fetched: "2026-08-26",
      },
      {
        url: "https://red.nv.gov/uploadedFiles/rednvgov/Content/CIC/Program_Training/Presentations/2025-Legislative-Updates.pdf",
        note: "Nevada Real Estate Division presentation on the 83rd session identifying AB 10, AB 396, SB 201 and SB 440 as the CIC bills",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "north-carolina-hoa-law",
    title: "North Carolina HOA law, what a board actually has to do",
    summary: "Chapter 47F, what applies to pre-1999 communities, and the rules boards get wrong",
    topic: "State law",
    states: ["NC"],
    readMinutes: 8,
    publishedDate: "2026-08-26",
    photoBrief: "a claim of lien document on a clerk of superior court counter, with the county file stamp visible",
    body: `North Carolina gives HOA boards a short statute and almost no oversight. No state agency regulates associations here, so the only enforcement is a lawsuit by an owner. Getting the details right is entirely your job.

## Which law applies to you

Single family and townhome communities run under the North Carolina Planned Community Act, N.C.G.S. Chapter 47F. Condominiums created after October 1, 1986 run under the Condominium Act, Chapter 47C, older ones under the Unit Ownership Act, Chapter 47A. Almost every association is also a nonprofit corporation under Chapter 55A.

Chapter 47F applies in full only to planned communities created on or after January 1, 1999. Under § 47F-1-102(a) and (b) it does not apply at all to a post-1999 community with no more than 20 lots, or to an all nonresidential community, unless the declaration says it does.

## The pre-1999 trap

This is the most misread provision in North Carolina community association law. Section 47F-1-102(c) makes a specific list of sections apply to communities created before January 1, 1999, and only that list: § 47F-1-104, § 47F-2-103, § 47F-2-117, § 47F-3-102(1) through (6) and (11) through (17), § 47F-3-103(f), § 47F-3-104, § 47F-3-107(a) through (c), § 47F-3-107.1, § 47F-3-108, § 47F-3-115, § 47F-3-116, § 47F-3-118, and § 47F-3-121. Section 47F-3-120 also applies.

Two limits matter. Everything on the list except § 47F-3-120 yields if the articles of incorporation or the declaration expressly provides to the contrary. And the listed sections reach only events and circumstances occurring on or after January 1, 1999.

Now look at what is missing. The budget ratification process in § 47F-3-103(c), the owner power to remove a director in § 47F-3-103(b), and the default quorum rules in § 47F-3-109 do not reach a pre-1999 community. Boards in older neighborhoods routinely mail a budget summary, hold a meeting with no quorum, and declare the budget ratified, when their own bylaws still control and may require a real vote. If your declaration predates 1999, read the bylaws first and the statute second.

A pre-1999 community can opt in. Under § 47F-1-102(d) that takes an affirmative vote or signed written agreement of owners holding at least 67% of the votes, or any smaller majority the declaration specifies, and that subsection overrides conflicting amendment procedures in the declaration.

## Records

Section 47F-3-118(a) makes all financial and other records, including minutes of association and board meetings, reasonably available to any lot owner and the owner's authorized agents as required in the bylaws and Chapter 55A. The section sets no hours, no place, and no response deadline, so the corporate statute does the real work. Under § 55A-16-02(a) a member may inspect and copy the corporate records listed in § 55A-16-01(e) after at least five business days' written notice, at a reasonable time and location the corporation specifies. Accounting records and the membership list need the same notice plus a demand made in good faith for a proper purpose, described with reasonable particularity. Section 55A-16-03(c) allows a reasonable charge for labor and materials, not exceeding the estimated cost of production.

Two hard deadlines sit in § 47F-3-118. An annual income and expense statement and balance sheet must be available to all owners at no charge within 75 days after the fiscal year closes. And on written request the association must furnish a statement of unpaid assessments within 10 business days, for no more than $200, plus up to $100 more if the request comes within 48 hours of closing.

## Meetings and the budget

A meeting of the association must be held at least once each year under § 47F-3-108(a). Special meetings may be called by the president, a majority of the board, or owners holding 10% of the votes. Notice goes out not less than 10 nor more than 60 days in advance, by hand delivery, prepaid mail, or email to an address the owner designated in writing, and must state the time, place, and agenda, including the general nature of any proposed amendment, any budget changes, and any proposal to remove a director or officer.

Board meetings are a weaker rule than in most states. Section 47F-3-108(b) says board meetings are held as provided in the bylaws, and that at regular intervals the board shall provide lot owners an opportunity to attend a portion of a meeting and speak. That is not an open meeting law. There is no statutory right to attend every board meeting, no board meeting notice requirement, no executive session rules, and no agenda packet right. Open board meetings come from your bylaws, not from Chapter 47F.

Where § 47F-3-103(c) applies, the budget model is ratification, not approval. Within 30 days after adopting a proposed budget the board sends every owner a summary and notice of a ratification meeting, including a statement that the budget may be ratified without a quorum. The meeting is held 10 to 60 days after mailing. No quorum is required. The budget is ratified unless a majority of all the lot owners rejects it, and if rejected the last ratified budget continues.

## Fines

Unless the declaration provides a specific procedure, § 47F-3-107.1 requires a hearing before the board or an adjudicatory panel appointed by the board, and any panel must consist of association members who are not officers or board members. The owner gets notice of the charge, an opportunity to be heard and present evidence, and notice of the decision.

The figure is $100. A fine not to exceed $100 may be imposed for the violation and, without further hearing, for each day more than five days after the decision that the violation continues. There is no statutory ceiling on the number of days and no statutory advance notice period for the hearing, so your bylaws govern that. Fines are assessments secured by liens under § 47F-3-116. An owner may appeal a panel decision to the full board by written notice within 15 days.

Separately, § 47F-3-102(11) caps late charges at the greater of $20 per month or 10% of the unpaid installment, and allows suspension of association privileges or services, but never access to the lot, once amounts are 30 days past due. Interest cannot exceed 18% per year under § 47F-3-115(b).

## Collecting assessments

An assessment unpaid for 30 days or longer becomes a lien when a claim of lien is filed with the clerk of superior court in the county where the lot sits, under § 47F-3-116(a). No fewer than 15 days before filing, the association must mail a statement of the amount due by first class mail to the lot's physical address, the owner's address of record, and, if different, the address on county tax records, plus the registered agent if the owner is a corporation or LLC.

The lien is extinguished unless enforcement proceedings begin within three years of filing. Priority is ordinary, not super: it is subordinate to any mortgage or deed of trust recorded before the claim of lien was filed and to tax liens, and a first mortgage foreclosure purchaser owes nothing for assessments that came due before it took title. Before charging attorney fees and costs to an owner, § 47F-3-116(e) requires a separate written notice stating the balance and telling the owner there are 15 days from mailing to pay without fees, with a contact who can discuss a payment plan.

Power of sale foreclosure under Article 2A of Chapter 45 is available only if the assessment is unpaid 90 days or more and the board votes to commence against that specific lot. In an uncontested foreclosure, § 47F-3-116(f)(12) caps attorneys' fees and the trustee's commission together at $1,200, not including costs or expenses. If the owner contests, the cap disappears.

Two limits catch boards out. Under subsection (h), a debt consisting solely of fines, interest on fines, or attorney fees tied only to fines can be enforced only by judicial foreclosure, never by power of sale. The same is true of a debt made up only of service, collection, consulting, or administration fees, and the association cannot charge those fees at all unless the declaration expressly allows them.

## What North Carolina does not require

There is no reserve study requirement, no reserve funding requirement, and no reserve disclosure requirement. Section 47F-3-102(2) merely permits budgets that include reserves. Any reserve obligation you have comes from your declaration, so do not tell owners the state requires one.

There is also no resale disclosure packet. The buyer side protection is the § 47F-3-118(b) statement of unpaid assessments. For condominiums, § 47C-4-109 requires the selling owner to give the buyer a statement of the monthly common expense assessment and other fees before conveyance. And North Carolina nonprofit corporations file no annual report with the Secretary of State, because § 55A-16-22 was repealed in 1995, though you still must keep a registered agent and registered office on file.

Two rules worth knowing when a dispute starts. The declaration may be amended by owners holding at least 67% of the votes under § 47F-2-117(a), with a one year window to challenge. And under § 47F-3-120 a court may award attorney fees to the prevailing party only if the declaration allows fee recovery.

## What boards here get wrong most often

Treating Chapter 47F as if it applied regardless of when the community was created. Assuming board meetings must be open, or must be closed, without reading the bylaws. Filing a claim of lien without the 15 day statement, or adding attorney fees without the separate notice under subsection (e). Trying to foreclose by power of sale on a balance made up only of fines. Charging a collection or administration fee the declaration never authorized. Missing the 75 day annual financial statement. Refusing a records request that Chapter 55A plainly allows after five business days' notice.

None of this replaces reading your own declaration and bylaws, and a lawyer should look at any collection matter you intend to take to foreclosure.`,
    sources: [
      {
        url: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_47F.html",
        note: "full text of Chapter 47F including §§ 47F-1-102, 47F-2-117, 47F-3-102, 47F-3-103, 47F-3-107.1, 47F-3-108, 47F-3-109, 47F-3-113, 47F-3-115, 47F-3-116, 47F-3-118, 47F-3-120, 47F-3-121, 47F-3-122 and their session law history lines",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_47C.html",
        note: "full text of the NC Condominium Act including §§ 47C-1-102, 47C-3-103, 47C-3-107.1, 47C-3-116, 47C-3-118, 47C-4-109",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_47A.html",
        note: "Unit Ownership Act, § 47A-2 interaction with Chapter 47C",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByArticle/Chapter_55A/Article_16.html",
        note: "§§ 55A-16-01 through 55A-16-04, records and member inspection rights",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_55A/GS_55A-16-22.html",
        note: "confirms the nonprofit annual report section is repealed",
        fetched: "2026-08-26",
      },
      {
        url: "https://ncdoj.gov/protecting-consumers/home-repair-and-products/homeowners-associations/",
        note: "NC DOJ statement that no state or federal agency oversees HOAs",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "texas-hoa-law",
    title: "Texas HOA law: what Chapter 209 requires of your board",
    summary: "Recording, records, meetings, fines and collections under the Texas Residential Property Owners Protection Act",
    topic: "State law",
    states: ["TX"],
    readMinutes: 7,
    publishedDate: "2026-08-26",
    photoBrief: "a county clerk's real property records counter with a stamped and recorded deed restriction document lying on it",
    body: `Texas spreads homeowner association law across several chapters of the Property Code rather than putting it in one act. This is which chapter applies to your association, and what each one actually makes the board do.

## Which law applies to you

Chapter 209, the Texas Residential Property Owners Protection Act, is the main one. Under Tex. Prop. Code § 209.003 it applies only to a residential subdivision whose declaration authorizes the association to collect regular or special assessments on all or a majority of the property, and only to associations with mandatory membership for all or a majority of owners. It does not apply to condominiums as defined by § 81.002 or § 82.003.

Chapter 202 applies to all restrictive covenants regardless of when they were created, and it is where most of the "an association may not ban this" rules live. Chapter 204 is narrower than people assume: under § 204.002 it reaches only residential subdivisions in a county of 3.3 million or more or in two specific categories of adjacent county, which in practice means the Houston area. Condominiums run on Chapter 82, the Texas Uniform Condominium Act, which governs condominiums whose declaration was recorded on or after January 1, 1994, with a listed set of sections reaching older ones under § 82.002(c). Almost every association is also a Texas nonprofit corporation, so Chapter 22 of the Business Organizations Code supplies the rules on directors, officers and committees.

Chapter 209 has size thresholds inside it. Payment plan guidelines and the document retention policy start above 14 lots. Architectural review procedure under § 209.00505 starts above 40 lots. Online document posting under § 207.006 starts at 60 lots or at any association using a management company. Candidate solicitation under § 209.00593 starts above 100 lots.

## Record it, or it does not count

Under § 202.006 the association must file all dedicatory instruments in the real property records of each county where the property sits, and a dedicatory instrument has no effect until it is filed. If the instrument authorizing a regular assessment is not filed, the association may not collect that assessment. Rules, policies and guidelines are dedicatory instruments. Adopting one at a board meeting is not enough.

Section 209.004 requires a recorded management certificate in each county, an amended certificate within 30 days of notice of a change, and an electronic filing with the Texas Real Estate Commission within seven days of each county filing. The commission publishes them at hoa.texas.gov. The penalty bites: while a certificate is unrecorded or unfiled, the owner is not liable for attorney's fees the association incurs collecting a delinquent assessment or for interest accruing in that period, and a bona fide purchaser takes free of amounts due.

## Records requests

An owner requests records in writing by certified mail to the address on the most recent management certificate, and must elect either to inspect first or to receive copies, under § 209.005(e). The association has 10 business days to send inspection dates or produce copies. If it cannot make that deadline it must say so in writing and give a date no later than the 15th business day after that notice.

Before charging anything, the board must adopt a records production and copying policy and record it as a dedicatory instrument. Section 209.005(i) bars any charge for compilation, production or reproduction unless that policy is recorded, and caps charges at the rates in 1 Tex. Admin. Code § 70.3, which sets standard paper copies at 10 cents per page. Associations above 14 lots must also adopt the document retention policy in § 209.005(m), which requires seven years for financial records and minutes.

## Meetings

Regular and special board meetings are open to owners under § 209.0051. Executive session is limited to personnel, pending or threatened litigation, contract negotiations, enforcement actions, confidential communications with the association's attorney, matters involving the invasion of privacy of individual owners, and matters kept confidential by request and agreement. Any decision made there must be summarized orally and placed in the minutes in general terms, including a general explanation of expenditures approved.

Notice goes out by mail 10 to 60 days before the meeting, or at least 144 hours before a regular meeting and 72 hours before a special meeting by conspicuous posting or website plus email to owners who registered an address. A board may act outside a meeting, including by electronic or telephonic vote, if every member gets a reasonable chance to speak and vote and the action is summarized orally and documented in the next meeting's minutes. But § 209.0051(h) lists 15 subjects the board may not decide that way, including fines, assessment increases, special assessments, budget approval, initiating foreclosure or enforcement, architectural appeals, filling a board vacancy and electing an officer.

## Fines and enforcement

Section 209.0061 requires the board to adopt a fine enforcement policy listing the general categories of covenants that can draw a fine, a schedule of fines for each category, and information about hearings. The policy has to be posted on an association website accessible to members or sent to owners annually.

Before suspending common area rights, suing, charging for property damage, levying a fine or reporting a delinquency to a credit bureau, § 209.006 requires written notice by certified mail describing the violation, stating any amount due, giving a reasonable period to cure a curable violation, and telling the owner they may request a hearing on or before the 30th day after the notice was mailed. If the owner cures in time, no fine may be assessed. Section 209.007 then requires the hearing within 30 days of the request, with 10 days notice of the date and time, and requires the association to give the owner a packet of every document, photograph and communication it intends to use at least 10 days before the hearing. Miss that and the owner gets an automatic 15 day postponement.

## Assessments and foreclosure

Associations above 14 lots must adopt payment plan guidelines under § 209.0062 and file them in the county real property records. The minimum plan term is three months. The association need not allow a plan running more than 18 months from the request, offer one to an owner who defaulted on a plan in the past two years, or offer one more than once in any 12 month period.

Section 209.0063 fixes the order payments are applied: delinquent assessments, then current assessments, then attorney's fees and third party collection costs tied to assessments, then other attorney's fees, then fines, then anything else. Fines go last. Before hiring a collection agent the association must send a certified mail notice with a cure period of at least 45 days under § 209.0064.

Before filing an assessment lien, § 209.0094 requires a first delinquency notice by first class mail or email, a second by certified mail no earlier than 30 days later, and then a 90 day wait after that second notice. Foreclosure requires a court order under § 209.0092, either an expedited foreclosure order or a judicial foreclosure, unless the owner waives that in writing at the time. Section 209.009 bars foreclosure where the debt is only fines, attorney's fees tied only to fines, or records and recount costs added to the account. Section 209.0091 requires 60 days notice and a chance to cure for subordinate deed of trust lienholders. After a sale the owner has 180 days to redeem under § 209.011, and a lienholder must wait 90 days.

## Elections, resale and architectural review

Notice of an election or vote at a meeting goes out 10 to 60 days ahead under § 209.0056, and 20 days ahead for a vote not taken at a meeting. Under § 209.00592 every owner must be given at least one of absentee ballot, proxy or electronic ballot. A candidate, or a relative within the third degree, may not tabulate or see the ballots under § 209.00594. Any owner may demand a recount within 15 days under § 209.0057, at the owner's cost, refunded if the result changes.

Section 207.003 gives the association 10 business days to deliver the restrictions, bylaws, rules and a resale certificate after a written request, with a fee cap of $375 and $75 for an update. Section 209.00505 requires an architectural denial in writing with the basis explained and notice that the owner may request a board hearing within 30 days, and § 209.00506 bars board members, their spouses and their household members from the review authority.

Notice what Chapter 209 does not require. There is no statutory reserve study, no audit threshold and no requirement to send owners a budget. What Texas boards get wrong is the paperwork: policies adopted but never recorded, management certificates never filed with the commission, records charged for without a recorded fee policy, fines levied by email vote, payments applied to fines first. Have a Texas community association attorney check your recorded instruments against this list once.`,
    sources: [
      {
        url: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.209.htm",
        note: "full text of Property Code Chapter 209, all section citations above",
        fetched: "2026-08-26",
      },
      {
        url: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.202.htm",
        note: "Chapter 202 applicability and the § 202.006 recording rule",
        fetched: "2026-08-26",
      },
      {
        url: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.204.htm",
        note: "Chapter 204 applicability, association powers and architectural control vesting",
        fetched: "2026-08-26",
      },
      {
        url: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.207.htm",
        note: "Chapter 207 resale certificate contents, deadlines and fee caps",
        fetched: "2026-08-26",
      },
      {
        url: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.82.htm",
        note: "Chapter 82 applicability, condominium records, lien and management certificate",
        fetched: "2026-08-26",
      },
      {
        url: "https://statutes.capitol.texas.gov/Docs/BO/htm/BO.22.htm",
        note: "Business Organizations Code Chapter 22 records and financial report sections",
        fetched: "2026-08-26",
      },
      {
        url: "http://txrules.elaws.us/rule/title1_chapter70_sec.70.3",
        note: "1 T.A.C. § 70.3 copy charges referenced by § 209.005(i)",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.hoa.texas.gov/hoa-management-certificate-requirements",
        note: "commission management certificate filing requirement and seven day deadline",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "texas-recent-changes",
    title: "What changed for Texas HOA boards in 2023, 2025 and 2026",
    summary: "The bills that actually reached the governor, with numbers and effective dates",
    topic: "State law",
    states: ["TX"],
    readMinutes: 5,
    publishedDate: "2026-08-26",
    photoBrief: "the Texas Capitol rotunda floor seen from above, with the terrazzo seal and the ring of galleries",
    body: `Texas holds regular legislative sessions in odd-numbered years, so the 89th Legislature's 2025 regular session is the one that matters for boards right now. Here is what passed, what it changed, and when it took effect.

## 2025: six bills reached the governor

Senate Bill 711 was the omnibus. It took effect September 1, 2025 and rewrote pieces of three Property Code chapters. For subdivisions it moved architectural review eligibility into a new Tex. Prop. Code § 209.00506 and added § 209.00507, which requires the association to notify members and solicit candidates at least 10 days before it elects or appoints anyone to the architectural review authority. The response deadline the association sets cannot be earlier than the 10th day after that notice. It also amended § 202.023 on security measures, grandfathering perimeter fencing and fencing forward of the front building line installed before September 1, 2025, and adding an exception for owners whose address is exempt from public disclosure or who can document a law enforcement need for enhanced security.

Senate Bill 711 hit condominiums harder. It added § 82.1142, requiring condominium associations of at least 60 units, or any association using a management company, to post dedicatory instruments online. It amended § 82.116 to require electronic filing of the management certificate with the Texas Real Estate Commission within seven days of recording, and capped the condominium resale certificate fee at $375 under § 82.157. Section 8 of the bill gave condominium associations that had already recorded a certificate until March 1, 2026 to file it with the commission. That deadline has passed. If your condominium association never filed, do it now.

Senate Bill 2629, also effective September 1, 2025, is the meetings and voting bill. It added § 209.0056(d), confirming that a meeting of owners may be held by any method of communication including electronic and telephonic means under Business Organizations Code § 6.002. It amended § 209.00592(a-1) to add electronic ballot to the list of voting methods, so an association satisfies the statute by offering an owner any one of absentee ballot, proxy or electronic ballot. For condominiums it rewrote § 82.108 to allow board meetings by any method of communication with notice, and added § 82.108(c-1) allowing board action by unanimous written consent without a meeting. Both routes exclude votes on fines, damage assessments, architectural appeals, and suspension of an owner's rights before that owner has had a chance to be heard.

House Bill 517 took effect September 1, 2025 and added § 202.008. An association may not fine an owner for brown or discolored grass or vegetation while the property is under a mandated residential watering restriction, or before the 60th day after that restriction is lifted. If your community sits under a drought stage right now, pull those violation letters.

House Bill 621 took effect September 1, 2025 and added § 202.013. An association may not prohibit an owner or resident from inviting a government official, or a candidate qualified for the ballot, to address members in the common areas. The association may still apply the same rental fees, occupancy limits, hours and reservation rules it applies to any other common area gathering. Associations exempt under Internal Revenue Code § 501(c)(3) are outside the section.

House Bill 431 was filed without the governor's signature and took effect May 29, 2025. It amended § 202.010(a)(2) so a solar roof tile counts as a solar energy device, which pulls solar shingles under the existing solar protections instead of leaving them to architectural discretion.

Senate Bill 2411, effective September 1, 2025, is a business organizations bill rather than a property bill, but it matters to incorporated associations. It rewrote Business Organizations Code § 22.218(a) so a nonprofit corporation's board may delegate authority to a committee only if the certificate of formation or bylaws provide for it or authorize the board to do it. The old route of a bare board resolution is gone. If your board created a committee with real decision-making authority by motion alone, check your bylaws.

## 2023: two rules boards still miss

House Bill 614 was signed June 12, 2023 and took effect January 1, 2024. It added § 209.0061, requiring the board to adopt a written fine enforcement policy containing the general categories of covenants that can draw a fine, a schedule of fines for each category, and information about the hearing rights in § 209.007. The board must give owners a copy by posting it on an association website accessible to members or by sending it annually, and must also put it on any publicly accessible association website. A fine levied without an adopted policy is exposed.

House Bill 886 took effect September 1, 2023 and rewrote § 209.0094. Before filing an assessment lien the association must send a first delinquency notice by first class mail or to an email address the owner provided, then a second notice by certified mail return receipt requested no earlier than the 30th day after the first, then wait until the 90th day after that second notice before filing. Owners protected by the Servicemembers Civil Relief Act are excepted.

House Bill 1193, also effective September 1, 2023, added § 202.024. An association may not enforce a covenant that stops an owner from renting to a tenant because of the tenant's method of payment, including a Section 8 housing choice voucher or other public or private rental assistance.

## 2026: nothing new

There is no Texas regular session in 2026. The 89th Legislature met in two called sessions in 2025, from July 21 to August 15 and from August 15 to September 4, and neither produced a property owners association bill. The next regular session convenes in January 2027, so the law described here is the law your board operates under today.

The practical checklist is short. File the management certificate with the commission. Record the fine policy, the records policy and the payment plan guidelines. Stop fining for brown grass during watering restrictions. Offer one real alternative voting method. Make sure any committee with authority has a bylaw behind it.`,
    sources: [
      {
        url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB711",
        note: "SB 711 caption, signed May 13 2025, effective September 1 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/tlodocs/89R/billtext/html/SB00711F.htm",
        note: "SB 711 enrolled text, Sections 1 to 9 including the March 1 2026 condominium filing deadline",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB2629",
        note: "SB 2629 caption, signed May 19 2025, effective September 1 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/tlodocs/89R/billtext/html/SB02629F.htm",
        note: "SB 2629 enrolled text amending §§ 82.101, 82.108, 82.110, 209.0056, 209.00592",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=HB517",
        note: "HB 517 caption, signed May 26 2025, effective September 1 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=HB621",
        note: "HB 621 caption, signed June 20 2025, effective September 1 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=HB431",
        note: "HB 431 caption, filed without signature, effective May 29 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB2411",
        note: "SB 2411 caption and September 1 2025 effective date",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/tlodocs/89R/billtext/html/SB02411F.htm",
        note: "SB 2411 enrolled text, Section 40 amending Bus. Orgs. Code § 22.218(a), and Section 59 effective date",
        fetched: "2026-08-26",
      },
      {
        url: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.202.htm",
        note: "amendment history showing HB 517 Ch. 168, HB 621 Ch. 551, HB 431 Ch. 254 and SB 711 Ch. 10 with effective dates",
        fetched: "2026-08-26",
      },
      {
        url: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.209.htm",
        note: "amendment history showing HB 614 Ch. 666 effective January 1 2024 and HB 886 Ch. 807 effective September 1 2023, and showing no called-session amendments",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=HB614",
        note: "HB 614 caption, signed June 12 2023, effective January 1 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=HB886",
        note: "HB 886 caption, signed June 13 2023, effective September 1 2023",
        fetched: "2026-08-26",
      },
      {
        url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=HB1193",
        note: "HB 1193 caption, filed without signature, effective September 1 2023",
        fetched: "2026-08-26",
      },
      {
        url: "https://lrl.texas.gov/sessions/specialsessions/index.cfm",
        note: "dates of the 89th Legislature's two called sessions and confirmation that no 2026 special session is listed",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "utah-hoa-law",
    title: "Utah HOA law, a board member's guide",
    summary: "Registration, reserves, records, fines, collections and the deductible rule Utah boards get backwards",
    topic: "State law",
    states: ["UT"],
    readMinutes: 13,
    publishedDate: "2026-08-26",
    photoBrief: "a mailbox cluster and a xeriscaped common area strip with gravel mulch and low shrubs in a Utah subdivision, photographed at midday",
    body: `Utah writes more specific HOA rules than most states, and attaches real consequences to missing them. The one that ends boards is registration: if the association is not registered with the Department of Commerce, its assessment lien does not exist. This guide covers what a Utah board has to do.

## Which act applies

The Utah Community Association Act is Title 57, Chapter 8a. The Condominium Ownership Act is Title 57, Chapter 8. Most associations are also nonprofit corporations under Title 16, Chapter 6a. Since May 6, 2026, § 57-8a-103 settles which act you are under. Chapter 8a applies if the declaration says so, or if the declaration is silent and the plats are not designated as condominium plats, regardless of when the association was created. The two chapters run in parallel, so most rules below have a condominium twin.

## Registration with the Department of Commerce

Under § 57-8a-105, an association must register with the Department of Commerce no later than 90 days after the declaration is recorded. Associations under declarations recorded before May 10, 2011 had to register by July 1, 2011. Registration takes the association's name and address, the board chair's name, phone and email, the manager's contact information, a primary contact who holds payoff information for closings, a fee set by the department, and a statement of whether the association imposes a reinvestment fee or transfer fee under § 57-1-46. It must be renewed annually, and any change reported within 90 days.

The penalty is specific and harsh. Under § 57-8a-105(6), during any period of noncompliance with the registration or update requirement, no lien may arise under § 57-8a-301 and the association may not enforce an existing lien. Curing the lapse restores the lien and lets liens arise retroactively for events during the lapse. But if a lot is conveyed to an independent third party while the association is out of compliance, the lien is extinguished on conveyance and events during the lapse can never produce a lien on that lot. Condominium associations have the same rule in § 57-8-13.1.

## Reserve analysis and the reserve line item

Section 57-8a-211 sets the schedule. Unless the governing documents provide otherwise, the board must cause a reserve analysis at least every six years, and review and if necessary update a previous one at least every three years. The board may do it itself or engage a reliable person or organization. The analysis must list the components that will need reserve funds, give each one's probable remaining useful life and estimated cost to repair, replace or restore, estimate the total annual contribution needed, and include a funding plan.

Two annual duties are where boards fail. The association must annually give lot owners a summary of the most recent analysis or update, and a complete copy to any owner who asks. And each year's budget must include a reserve fund line item in an amount the board determines, based on the analysis, to be prudent, or a higher amount if the governing documents require one.

Owners get a veto, not an approval vote. Within 45 days after the association adopts the annual budget, lot owners may veto the reserve fund line item by a 51% vote of the allocated voting interests at a special meeting they call for that purpose. If they do, the association funds reserves at the last line item that was not vetoed. Reserve money may not be spent on anything other than its purpose without a majority vote, may not go to daily maintenance except by majority vote or during a qualifying statewide emergency shortfall, and must be kept separate from other funds. An owner can sue for injunctive relief and the greater of $500 or actual damages, plus fees, after a 90 day written notice. Condominiums have the identical scheme in § 57-8-7.5.

## Budget and money

Section 57-8a-215 requires the board to prepare and adopt a budget at least once a year and present it to members at a meeting of the members. The budget is disapproved only if, within 45 days after that meeting, at least 51% of all the allocated voting interests vote to disapprove it at a special meeting called by lot owners. If it is disapproved, or never adopted, the last adopted budget continues. Since May 6, 2026 condominium management committees have the same duty under § 57-8-7.6.

Section 57-8a-230 is short and absolute. The association must keep all of its funds in an account in the name of the association, and may not commingle association funds with anyone else's.

## Records

Section 57-8a-227 was expanded on May 6, 2026. The association must keep and make available the records identified in § 16-6a-1601(1) through (5), whether or not it is incorporated, plus the governing documents, the most recent approved minutes, the most recent annual budget and financial statement, the most recent reserve analysis, a certificate of insurance for each policy, board minutes from the previous three calendar years, profit and loss statements for the previous three fiscal years, and balance sheets for the previous three fiscal years.

Only three things may be redacted: Social Security numbers, bank account numbers, and communications subject to attorney-client privilege. That is a narrower withholding right than most states allow.

If the association has an active website, the governing documents, most recent approved minutes, and most recent annual budget and financial statement must be on it free of charge. If it has no website, physical copies must be available during regular business hours at the registered address. A written request must include the association's name, the owner's name, property address and email address, and a description of the documents. The association must comply within 10 business days. Charges are capped at the actual cost paid to a recognized third party duplicating service, or 10 cents per page and $20 per hour of staff time, and nothing may be charged for electronic transmission.

Miss the deadline and the meter runs. The association owes the reasonable costs of inspecting and copying, plus $25 per day for each day a request for the governing documents, minutes, or budget and financial statement goes unfulfilled starting on the eleventh business day, plus attorney fees. In court an owner may recover $1,000 or actual damages, whichever is greater, after a 10 day pre-suit notice, and the court must hold a hearing within 30 days of a motion. Section 57-8-17 is the condominium equivalent.

## Meetings

Under § 57-8a-226 a board may act only at a board meeting, except for action without a meeting under § 16-6a-813. At least 48 hours before a board meeting the association must email written notice to each lot owner who requested notice, unless the meeting was on a schedule already provided or it is an emergency where board members themselves got less than 48 hours notice. The notice states the time, date, location and how to join electronically.

Board meetings are open to each lot owner or a representative designated in writing. The board may close a meeting only for legal advice, ongoing or potential litigation, mediation, arbitration or administrative proceedings, a personnel matter, contract negotiations including a bid or proposal, a matter involving an individual where discussion would cause undue embarrassment or violate a reasonable expectation of privacy, or a delinquent assessment or fine. The board must give each lot owner a reasonable opportunity to comment, and may confine comments to one period. These rules apply regardless of when the first governing document was recorded, and an owner may sue for injunctive relief and the greater of $500 or actual damages after 90 days written notice.

## Fines

Section 57-8a-208 has day counts boards get wrong. Before any fine, the board must send a written warning that describes the violation, identifies the rule violated, states that fines may follow if a continuing violation is not cured or a similar violation occurs within one year, and for a continuing violation gives a cure deadline no less than 48 hours out. A fine may then be assessed if within one year of the warning the owner violates the same rule again, or fails to cure a continuing violation in time. After a first fine, and only if the governing documents permit it, the board may fine again without a new warning for a repeat violation within one year or for letting a violation continue 10 days or longer after the fine. The amount must be the amount in the governing documents.

The owner may request an informal hearing before the board within 30 days after receiving notice of the fine, and if the request is timely no interest or late fees accrue until after the hearing and a final decision. The board must let the owner present, must allow electronic participation, and may not delegate the hearing to a managing agent. The owner may appeal by civil action within 180 days of the final decision, or of the expiration of the 30 day request window.

A fine becomes lienable only when the appeal window closes with no appeal or a court upholds it, under § 57-8a-301(1)(a)(iii). And under § 57-8a-303(3)(c) a lien that includes a fine cannot be foreclosed nonjudicially.

## Assessments, liens and collection

Section 57-8a-201 caps a late fee at the greater of 10% of the assessment or $50, plus interest of up to 1.5% per month, and requires the board to adopt a fee schedule by rule under § 57-8a-217 and give each owner a copy before imposing anything.

Section 57-8a-301 gives the association a lien for assessments, collection costs including court costs and reasonable attorney fees, late charges, interest, and qualifying fines. Recording the declaration is record notice and perfection. The lien has priority over other liens except one recorded before the declaration, a first or second security interest recorded before a recorded notice of lien, and real property tax liens. There is no super priority over a first mortgage in Utah.

Section 57-8a-302 allows nonjudicial foreclosure, treating the lien like a deed of trust with a qualified trustee appointed, or judicial foreclosure. Section 57-8a-303 sets the prerequisites. At least 30 calendar days before recording a notice of default the association must deliver a notice by certified mail, return receipt requested, in substantially the statutory form, telling the owner about the right to demand judicial foreclosure instead. Nonjudicial foreclosure is barred if that notice was not given, if the owner mails a demand for judicial foreclosure within 30 days after delivery, if the lien includes a fine, or if the lien does not include an assessment delinquent more than 180 days.

Two tools short of foreclosure matter. Under § 57-8a-309, if the governing documents authorize it, the board may cut off a utility service paid as a common expense or access to recreational facilities, after a notice stating the amount owed, giving at least 14 days to pay, and stating the right to a hearing. The owner has 14 days to request an informal hearing, and nothing may be shut off until the hearing and a final decision. Under § 57-8a-310, if an owner is more than 60 days behind and the governing documents authorize it, the board may require the owner's tenant to pay rent to the association, after notice to the owner with 15 days to pay and then written notice to the tenant. The association holds the money in a separate account, may keep up to $25 of administration cost, and must return any surplus within five business days after the debt is paid. A receiver may also be appointed under § 57-8a-308.

## Insurance and the deductible

This is the Utah rule boards get backwards. Part 4 of chapter 8a applies to policies issued or renewed on or after July 1, 2011, but under § 57-8a-402 it does not apply to an all nonresidential project, or to a project whose initial declaration was recorded before January 1, 2012 that includes attached dwellings where the declaration requires each owner to insure the dwelling, unless the association amends in.

Where it applies, § 57-8a-405 requires property insurance at not less than 100% of full replacement cost at purchase and at each renewal, covering fixtures, improvements and betterments in an attached dwelling or its appurtenant limited common area, original or added later, down to floor coverings, cabinets, light and plumbing fixtures, paint, wall coverings and windows. The association need not insure a dwelling that is not physically attached to another dwelling or to a common area structure.

Each lot owner is an insured person. When both policies cover a loss the association's policy is primary, but the owner is responsible for the association's deductible, and the owner's building coverage applies to that portion. The owner's share is the lot damage percentage applied to the deductible, and if the owner does not pay within 30 days after repairs are substantially complete the association may assess it. The association must set aside an amount equal to its deductible, or at least $10,000 if the deductible exceeds $10,000, and must give owners notice under § 57-8a-214 of the deductible obligation and of any change in the amount. An association that never gives that notice is responsible for the portion it could have assessed, to the extent the owner has no coverage. If it gave notice of the deductible but not of a later increase, it eats only the increase.

## The Homeowners' Association Ombudsman

Since May 7, 2025 Utah has an Office of the Homeowners' Association Ombudsman in the Department of Commerce, in Title 13, Chapter 79. An owner or an association may request a written advisory opinion on compliance with chapter 8, chapter 8a or other state statutes, before filing in court or starting binding arbitration. The filing fee is $150 and is nonrefundable, and the request must come within one year of when the requester knew or should have known about the act. The requester must first exhaust the dispute resolution procedures in the governing documents, but an association may not require binding arbitration before someone asks for an opinion.

Opinions are public and are neither binding nor admissible, with one exception: if a court later rules the same way on the same issue, it may award the substantially prevailing party attorney fees and costs from the date of the opinion, plus a civil penalty up to $5,000 if the violation was knowing and intentional. The office cannot interpret governing documents and does not represent anyone.

## What Utah boards get wrong

Letting registration lapse without realizing the lien is gone while it is lapsed. Ordering the reserve analysis on schedule but never sending owners the annual summary or putting the line item in the budget. Treating the budget and the reserve line item as things owners approve, when both are disapproval mechanisms with 45 day windows. Fining without the written warning, or on a warning older than a year. Charging interest on a fine while a timely hearing request is pending. Trying to foreclose nonjudicially on a lien that includes fines, or where nothing is 180 days delinquent. Missing the 10 business day records deadline and starting the $25 a day meter. And getting the deductible backwards, or never sending the deductible notice and losing the right to charge it.

If any of this is unclear as applied to your declaration, an advisory opinion from the ombudsman costs $150 and is a cheaper first step than a lawyer.`,
    sources: [
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S105.html",
        note: "registration deadline, contents, annual renewal, 90 day update, lien consequences of noncompliance",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S103.html",
        note: "which chapter applies test",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S211.html",
        note: "reserve analysis schedule, annual summary, reserve line item, 45 day veto, remedies",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8/57-8-S7.5.html",
        note: "condominium reserve analysis, identical scheme",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S215.html",
        note: "annual budget, 45 day 51% disapproval",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8/57-8-S7.6.html",
        note: "new condominium budget duty",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S227.html",
        note: "records categories, redactions, 10 business days, fee caps, $25 per day, $1,000 remedy",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S226.html",
        note: "board meeting notice, open meetings, closed session topics, owner comment, remedies",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S208.html",
        note: "fine warning, day counts, hearing and appeal",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S201.html",
        note: "late fee and interest caps, fee schedule requirement",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S301.html",
        note: "lien contents, perfection by recording the declaration, priority",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S302.html",
        note: "judicial and nonjudicial enforcement, trustee appointment",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S303.html",
        note: "30 day notice, statutory form, judicial foreclosure demand, fine and 180 day limits",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S309.html",
        note: "utility and amenity termination, 14 day notice and 14 day hearing request",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S310.html",
        note: "rent redirection, 60 days, 15 day owner notice, $25 administration cap",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S230.html",
        note: "funds in the association's name, no commingling",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S217.html",
        note: "rule adoption notice, open forum, 60 day 51% disapproval",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S231.html",
        note: "water wise landscaping protections and the 8 foot turf rule",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-P4.html",
        note: "part 4 section list",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S402.html",
        note: "insurance part applicability and exclusions",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S405.html",
        note: "replacement cost, fixtures and betterments, primary coverage, deductible allocation, set aside, notice consequences",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8/57-8-S13.1.html",
        note: "condominium registration and lien consequences",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title13/Chapter79/13-79-S103.html",
        note: "ombudsman duties and limits",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title13/Chapter79/13-79-S104.html",
        note: "advisory opinion process, $150 nonrefundable fee, one year window, fee shifting, $5,000 penalty",
        fetched: "2026-08-26",
      },
      {
        url: "https://commerce.utah.gov/hoa/",
        note: "Department of Commerce registration and renewal portal, renewal by the end of the month of registration",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "utah-recent-changes",
    title: "What changed in Utah HOA law, 2024 to 2026",
    summary: "Bill numbers, chapter numbers and effective dates for three sessions of Utah HOA legislation",
    topic: "State law",
    states: ["UT"],
    readMinutes: 6,
    publishedDate: "2026-08-26",
    photoBrief: "the Utah State Capitol in Salt Lake City photographed from the east lawn, with the dome and columns in frame",
    body: `Utah passes HOA legislation nearly every session, and it takes effect fast. Utah bills generally take effect 60 days after adjournment unless the bill says otherwise, which has meant May 1, May 7 and May 6 in the last three years. Here is what passed and what a board has to do about it.

## 2024, landscaping rules and common area sales

Second Substitute Senate Bill 204, Condominium and Community Association Amendments, became chapter 519, Laws of Utah 2024. It passed on March 1, 2024, was signed on March 21, 2024, and took effect May 1, 2024.

It required associations to adopt water wise landscaping rules, gave an owner a remedy if the association does not, restricted an association from regulating lease agreements in certain circumstances, added an internal accessory dwelling unit to the definition of a rental, changed the record inspection rights of nonprofit directors and members under § 16-6a-1602, clarified how a county assessor values common area for property tax, and enacted § 57-8a-232, a process by which an association may sell common areas.

Two other 2024 bills touch association rules. Second Substitute House Bill 11, Water Efficient Landscaping Requirements, became chapter 19, and Second Substitute House Bill 215, Home Solar Energy Amendments, became chapter 136. Both took effect May 1, 2024.

## 2025, the ombudsman and a long list of fee and records changes

Fifth Substitute House Bill 217, Homeowners' Association Amendments, became chapter 226, Laws of Utah 2025. It passed on March 7, 2025, was signed on March 25, 2025, and took effect May 7, 2025. It is the largest single Utah HOA bill in years.

It created the Office of the Homeowners' Association Ombudsman in Title 13, Chapter 79, with the power to issue advisory opinions. It made certain association transfer fees void and unenforceable, set requirements an association must meet before imposing a fee or charge, set requirements for imposing a reinvestment fee, and required written notice to an owner when a plan is denied. It authorized the Department of Commerce to set and impose an annual registration fee and required annual renewal of registration. It capped late fees, which is why § 57-8a-201 now reads greater of 10% or $50 with interest up to 1.5% per month. It expanded required document production, raised the amounts an association may charge for producing documents, and barred any charge for electronic transmission. It raised the amount an owner may recover when an association fails to make documents available. It restricted declarants during the period of administrative control, including a bar on using association funds against a homeowner suing the declarant. And it prohibited an association from restricting or delaying a plan because it includes fire-resistant material in an area with heightened wildfire risk. The ombudsman office carries a repeal date subject to legislative review under § 63I-1-213 on July 1, 2030.

Fifth Substitute House Bill 86, Homeowners' Association Requirements, became chapter 197, signed March 25, 2025, effective May 7, 2025. It increased the amount an owner may request when an association fails to make records available, barred declarants from using association funds in a legal action brought by a homeowner, defined development right, and changed the conditions for ending the period of administrative control.

Two more 2025 bills constrain rules. House Bill 119, Solar Panel Restrictions in Homeowners Associations Amendments, became chapter 207. First Substitute House Bill 77, Flag Display Amendments, became chapter 508 and took effect without the governor's signature on March 27, 2025. Both are effective May 7, 2025.

## 2026, the omnibus bill

Third Substitute Senate Bill 122, HOA Amendments, became chapter 62, Laws of Utah 2026. It passed on March 6, 2026, was signed on March 17, 2026, and took effect May 6, 2026. Most of what a board notices this year comes from this bill.

It settled which act applies to which association in § 57-8a-103, using the declaration first and the plat designation as the fallback. It required condominium management committees to prepare and adopt an annual budget and present it to members, in the new § 57-8-7.6, and restated the same rule for homeowners associations in § 57-8a-215.

It expanded the records list in § 57-8a-227 to include board meeting minutes from the previous three calendar years, profit and loss statements for the previous three fiscal years, and balance sheets for the previous three fiscal years. It declared those records and the association's operating account funds to be property of the association, and required anyone else holding an association record to hand it over on request without charge. It removed the requirement that a board member and president give a physical address for registration.

On the ombudsman side it required the office to make each advisory opinion public, to publish a list of relevant statutes, frequently asked questions and plain language educational materials, and to route callers to those resources. It stated that no attorney-client relationship arises from the office's work. It made the $150 advisory opinion filing fee expressly nonrefundable, and it barred an association from requiring binding arbitration before a person requests an advisory opinion, while keeping the requirement that governing document dispute procedures be exhausted first. It also repealed the requirement that the parties split the cost of an opinion.

It changed what a rule may say about the type of vehicle parked on a driveway, limited what a declaration may contain, changed when a lot owner may keep renting without a fee, renamed the association transfer fee to an administrative setup fee, set out when an association may convey part of the common areas, and set declarant duties and the conditions for extending administrative control in a large master planned development.

## Other 2026 bills that reach associations

First Substitute House Bill 306, Reinvestment Fee Amendments, became chapter 123, signed March 18, 2026, effective May 6, 2026. It is why § 57-8a-105 and § 57-8-13.1 now require the registration to state whether the association imposes a reinvestment fee or a transfer fee under § 57-1-46, and why the ombudsman's website must carry a disclaimer that nobody may rely on that disclosure when preparing purchase documents.

First Substitute House Bill 215, Landscaping Restrictions Amendments, became chapter 79. Senate Bill 46, Water Wise Landscaping Amendments, became chapter 346. Second Substitute Senate Bill 196, Wrongful Lien Act Amendments, became chapter 273. Third Substitute House Bill 591, Nuisance Amendments, became chapter 401. Sixth Substitute Senate Bill 284, Local Land and Water Modifications, became chapter 166. All took effect May 6, 2026.

One more matters for the corporate side. Third Substitute Senate Bill 40, Business Entity Amendments, became chapter 93, signed March 17, 2026, and takes effect October 1, 2026. It enacts a new Title 16, Chapter 1a with standardized filing and annual report requirements for all business entities, and it repeals § 16-6a-1607, the nonprofit annual report section, on October 1, 2026. If your association is a Utah nonprofit corporation, the annual report you file after October 1, 2026 comes from a different part of the code than the one you filed last year.

## What to do now

Check your registration. Confirm it is current, confirm the reinvestment fee or transfer fee statement is accurate, and confirm the chair and manager contact details match reality, because an out of date registration is a period of noncompliance under § 57-8a-105(5) and (6).

Then rebuild the records response. The three year minutes, profit and loss statements and balance sheets are new to the list, the deadline is 10 business days, and the penalty starts on the eleventh.`,
    sources: [
      {
        url: "https://le.utah.gov/asp/passedbills/passedbills.asp?session=2024GS",
        note: "2024 passed bill list with chapter numbers, passage dates, effective dates and signing dates for SB 204 chapter 519, HB 11 chapter 19, HB 215 chapter 136",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/asp/passedbills/passedbills.asp?session=2025GS",
        note: "2025 passed bill list for HB 217 chapter 226, HB 86 chapter 197, HB 119 chapter 207, HB 77 chapter 508",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/asp/passedbills/passedbills.asp?session=2026GS",
        note: "2026 passed bill list for SB 122 chapter 62, HB 306 chapter 123, HB 215 chapter 79, SB 46 chapter 346, SB 196 chapter 273, HB 591 chapter 401, SB 284 chapter 166, SB 40 chapter 93",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/~2024/bills/sbillint/SB0204S02.pdf",
        note: "SB 204 second substitute long title, highlighted provisions and sections affected",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/~2025/bills/hbillenr/HB0217.pdf",
        note: "HB 217 enrolled copy, highlighted provisions and sections affected",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/~2025/bills/hbillenr/HB0086.pdf",
        note: "HB 86 enrolled copy, highlighted provisions and sections affected",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/~2026/bills/sbillenr/SB0122.pdf",
        note: "SB 122 enrolled copy, highlighted provisions and sections affected",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/~2026/bills/sbillenr/SB0040.pdf",
        note: "SB 40 enrolled copy, new Title 16 Chapter 1a and entity annual report changes",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S105.html",
        note: "section as amended by Chapter 123, 2026, effective May 6, 2026, including the reinvestment fee statement",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8/57-8-S13.1.html",
        note: "condominium registration as amended by Chapter 123, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S227.html",
        note: "records section as amended by Chapter 62, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S215.html",
        note: "budget section as amended by Chapter 62, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8/57-8-S7.6.html",
        note: "new condominium budget section enacted by Chapter 62, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S103.html",
        note: "which act applies, as amended by Chapter 62, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title13/Chapter79/13-79-S104.html",
        note: "advisory opinion process as amended by Chapter 62, 2026, nonrefundable $150 fee, no forced arbitration",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title13/Chapter79/13-79-P1.html",
        note: "the chapter as effective May 7, 2025 and the 2030 review date",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title16/Chapter6a/16-6a-S1607.html",
        note: "nonprofit annual report section marked repealed October 1, 2026 by Chapter 93, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S201.html",
        note: "late fee caps as amended by Chapter 226, 2025",
        fetched: "2026-08-26",
      },
      {
        url: "https://le.utah.gov/xcode/Title57/Chapter8A/57-8a-S231.html",
        note: "water wise landscaping section, showing 2024 and 2025 amendment history",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "virginia-hoa-law",
    title: "Virginia HOA law, the board's obligations in plain terms",
    summary: "Title 55.1, the CIC Board filing, records, fines, liens, reserves, and resale",
    topic: "State law",
    states: ["VA"],
    readMinutes: 11,
    publishedDate: "2026-08-26",
    photoBrief: "a memorandum of lien stamped and indexed in a circuit court clerk's deed book",
    body: `Virginia regulates community associations more closely than most states, and changes the rules almost every year. Two things set it apart: a state board you must file with annually, and a state ombudsman an owner can escalate to when the board says no.

## Which law applies to you

Single family and townhome associations run under the Virginia Property Owners' Association Act, Va. Code § 55.1-1800 and following. Condominiums run under the Virginia Condominium Act, § 55.1-1900 and following. Resale disclosure for both runs under the Virginia Resale Disclosure Act, § 55.1-2307 and following. Incorporated associations are also governed by the Virginia Nonstock Corporation Act in Title 13.1.

In 2019 the General Assembly recodified all of this from Title 55 into Title 55.1. Old § 55-510 is now § 55.1-1815, § 55-513 is now § 55.1-1819, and § 55-516 is now § 55.1-1833. If a source cites a Title 55 number, it is out of date. Under § 55.1-1801(C), where a declaration is silent the Act fills the gap, and if any one lot is subject to the Act, every lot is.

## The annual filing with the Common Interest Community Board

Every association files an annual report with the Common Interest Community Board at the Department of Professional and Occupational Regulation, under § 55.1-1835 for associations and § 55.1-1980 for condominiums, where the duty starts when declarant control ends.

Under 18VAC48-60-15 a property owners' association registers within 30 days of recordation of the declaration and files every year after; a condominium files within 30 days after declarant control terminates. Registration expires 12 months from the last day of the month it was issued, and an association more than 12 months lapsed must start over. Under 18VAC48-60-60 the renewal fee runs from $30 for 1 to 50 lots up to $170 for 5,001 or more.

Skipping it has teeth. Under § 55.1-2316(F) an association that is not registered, not current on its annual report, or not current on Board assessments cannot collect resale certificate fees at all. The Board can also issue a cease and desist order and assess a penalty of up to $1,000 against the governing board.

## The complaint procedure you are required to have

Section 54.1-2354.4 requires every association to adopt written procedures for resolving written complaints from members and citizens, and to follow them. Regulation 18VAC48-70-50 sets the contents. The procedure must describe how complaints are delivered and give contact information for the Office of the Common Interest Community Ombudsman. The association acknowledges receipt in writing within 14 days. Notice of when and where the complaint will be considered goes out at least 14 days beforehand. The written final determination follows within seven days, dated, citing the specific laws or regulations behind the result and stating the association's registration number, telling the complainant about the right to escalate to the Ombudsman, and either setting out an appeal process or stating plainly that none exists.

Records of each complaint are kept at least one year, the procedure must be attached to the resale certificate, and since December 31, 2025 the association certifies with every annual report that it is adopted and in effect. An owner who receives a final adverse decision has 30 days to file a notice with the Ombudsman, on the Board's form, with a $25 fee that can be waived for hardship.

Virginia also licenses common interest community managers under § 54.1-2346(A). A self-managed board needs no license, but a manager you hire does.

## Records

Under § 55.1-1815(B) a member in good standing may examine and copy the books and records so long as the request is for a proper purpose related to membership. The request must be in writing, must reasonably identify the purpose and the specific records, and must give five business days' notice if the association is professionally managed or 10 business days if it is self managed. Inspection happens only during reasonable business hours or at a mutually convenient time and location.

Nine categories may be withheld under subsection (C): personnel and medical matters, contracts under negotiation, pending or probable litigation, formal government enforcement proceedings, privileged communications with counsel, disclosures that would violate law, executive session minutes, materials prepared for the board's consideration in executive session, and other owners' individual files. Withholding a whole document is allowed only if the exclusion covers all of it. Otherwise you redact, produce the rest, and the requester pays reasonable redaction costs. Charges are limited to the reasonable cost of materials and labor under a cost schedule the board adopted and gives the requester at the time of the request. Draft board minutes open 60 days after the meeting or when they go out in the next agenda package, whichever comes first.

## Meetings

Under § 55.1-1815(G) notice of an association meeting goes out at least 14 days before an annual or regularly scheduled meeting and at least seven days before any other. For condominiums the annual notice period is 21 days under § 55.1-1949(A).

Board meetings are genuinely open. Section 55.1-1816(A) opens every board and committee meeting where association business is discussed or transacted to all members of record, and forbids using work sessions to get around it. Notice of time, date, and place must be published where it is reasonably calculated to reach a majority of owners, and any owner who asks in writing once a year gets individual notice by first class mail or email. Agenda packets given to board members must reach the membership at the same time. Any member may record an open portion. Voting by secret or written ballot in an open meeting violates the chapter, except for electing officers.

Executive session is narrow. Under subsection (C) the board may close a meeting only to consider personnel matters, consult legal counsel, discuss contracts, pending or probable litigation and violation matters, or discuss the personal liability of members, and only on an affirmative vote in the open meeting. The motion must state specifically the purpose, and the motion and stated purpose must appear in the minutes. Nothing decided in closed session takes effect unless the board reconvenes in open session and votes with the substance reasonably identified. Subsection (D) requires a designated owner comment period at each meeting. Meetings may be electronic under § 55.1-1832(F) if the board adopted guidelines and offers a reasonable alternative at its own expense.

## Budget and reserves

Before the fiscal year starts the board must make the annual budget or a summary available to owners, under § 55.1-1826(A) and § 55.1-1965(A).

The reserve duty has three parts and boards usually remember only the first. Under § 55.1-1826(B) the board must conduct a study at least once every five years to determine the necessity and amount of reserves for capital components, review the results of that study at least annually to determine whether reserves are sufficient, and make any adjustments to the annual budget and annual assessment it deems necessary. The annual review is separate from the five year study, and it is the one that gets skipped.

If the study shows a need to budget for reserves, subsection (C) requires four disclosures in the budget: current estimated replacement cost, estimated remaining life, and estimated useful life of the capital components; accumulated cash reserves at the start of the fiscal year and the expected contribution for that year; the procedures used to estimate and accumulate reserves; and the amount the study recommends alongside the cash actually on hand.

Funding is not mandatory. Subsection (D) lets the board meet repair and replacement requirements through reserves, additional assessments, or borrowed funds. What Virginia requires is to study, review, and disclose. Section 55.1-1827(B) separately requires a fidelity bond or employee dishonesty policy equal to the lesser of $1 million or reserve balances plus one quarter of annual assessment income, with a $10,000 floor.

## Fines

Section 55.1-1819 for associations and § 55.1-1959 for condominiums set one process and two numbers. Before any charge the member gets written notice of the alleged violation and a reasonable opportunity to correct it. If it stays uncorrected the member gets an opportunity to be heard and represented by counsel before the board or another tribunal named in the documents. Notice of the hearing, including what the association may do, must be hand delivered or sent by registered or certified mail, return receipt requested, at least 14 days ahead, and the result goes out the same way within seven days.

The charge cannot exceed $50 for a single offense or $10 per day for an offense of a continuing nature, and continuing charges cannot be assessed for a period exceeding 90 days. Charges are treated as an assessment for lien purposes, and once anyone files suit no further charges accrue. Suspension of services is separate: the board may suspend use of facilities or services for nonpayment more than 60 days past due, only to the extent the declaration or duly adopted rules expressly provide, never blocking access to the lot.

## Assessments and liens

Late fees are a default rule, not a hard cap. Under § 55.1-1824, unless the declaration or rules provide otherwise, the board may impose a late fee not exceeding the penalty in § 58.1-3915, which is 5%, and only for an assessment or installment unpaid within 60 days of its due date.

The lien deadline is what Virginia boards miss most. Under § 55.1-1833(B) an association perfects its lien by filing a memorandum in the circuit court clerk's office before the expiration of 12 months from the time the first such assessment became due and payable. For condominiums the window is far shorter: § 55.1-1966(C) allows only 90 days. Miss it and the lien is gone. Before filing, a property owners' association must send the owner written notice by certified mail to the last known address at least 10 days ahead.

Priority puts the perfected lien ahead of subsequent liens but behind real estate tax liens, liens recorded before the declaration, and sums unpaid on a mortgage or deed of trust recorded before perfection. Foreclosure cannot begin more than 120 months after the memorandum was recorded. Nonjudicial foreclosure requires that the sums secured exceed $5,000 exclusive of attorney fees and costs, plus a notice giving the owner at least 60 days to pay, trustee appointment, advertising, and a separate 14 day mailed notice of sale. The prevailing party recovers costs and reasonable attorney fees either way. Condominium boards have one extra trap: under § 55.1-1966(H), failing to furnish a recordable statement of unpaid assessments within 10 days of a written request extinguishes the lien as to that unit.

## Resale certificates

The seller or the seller's agent obtains the resale certificate from the association, and that cannot be waived by agreement. Under § 55.1-2309(B) the association or its preparer must deliver it within 14 days of a written request, and if it is not delivered in 14 days it is deemed unavailable. The association may not require the purchaser's name before preparing it.

Section 55.1-2310 lists 30 required items, among them the governing documents, current and unpaid assessments, approved capital expenditures, reserves, the latest financial statements and operating budget, the current reserve study or a summary, judgments and material litigation, insurance and deductible responsibility, six months of board minutes, rental and parking and sign and solar restrictions, and a certification that the annual report has been filed with the Common Interest Community Board. An updated certificate is due within 10 days of a written request and a financial update within three business days. Under § 55.1-2312 the purchaser generally has three days to cancel from ratification or from receipt, and may cancel any time before settlement if the certificate was never delivered.

The Board sets the fee caps under § 55.1-2316(C), adjusted for inflation no less than every five years. The current schedule took effect January 12, 2023, was amended July 1, 2023, and the next adjustment is due in 2028. The maximums are $211.96 for preparation and delivery in paper for up to two copies or $176.64 electronically, $141.31 for an inspection if the declaration authorizes it, $70.66 to expedite within five business days, $35.33 for an extra hard copy, $70.66 for a post closing fee charged to the purchaser, $70.66 for a pre settlement update, and $141.31 for an additional inspection at the purchaser's request.

## Elections and amendments

Neither Act sets a percentage for removing a director. For an incorporated association § 13.1-860 controls: members may remove a director with or without cause unless the articles require cause, removal takes a majority of the votes entitled to be cast at an election of directors, and it may happen only at a meeting called for that purpose with notice stating the purpose. Under § 55.1-1829(D) the declaration may be amended by a two thirds vote of the lot owners unless the declaration provides otherwise.

## What Virginia boards get wrong most often

Letting the Common Interest Community Board registration lapse and charging resale fees anyway. Never adopting a written complaint procedure, or adopting one that omits the Ombudsman contact information and the 14 day acknowledgment. Doing the five year reserve study and skipping the annual review. Moving into executive session on a motion that says only "personnel", or deciding something in closed session and never voting in the open. Fining more than $50, or letting a continuing charge run past 90 days. Missing the 90 day condominium lien window because the board assumed it had a year. Charging copy fees without a board adopted cost schedule.

A lawyer should review your collection policy and your complaint procedure once, so the templates you reuse are correct.`,
    sources: [
      {
        url: "https://law.lis.virginia.gov/vacodefull/title55.1/chapter18/",
        note: "full text of the Property Owners' Association Act, §§ 55.1-1800 through 55.1-1837",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodefull/title55.1/chapter19/",
        note: "full text of the Virginia Condominium Act, §§ 55.1-1900 through 55.1-1990",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodefull/title55.1/chapter23.1/",
        note: "full text of the Resale Disclosure Act, §§ 55.1-2307 through 55.1-2317",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodefull/title54.1/chapter23.3/",
        note: "Common Interest Community Board, manager licensing, Ombudsman, and association complaint procedure, §§ 54.1-2345 through 54.1-2354.5",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/boardcodefull/title18/agency48/chapter60/",
        note: "Common Interest Community Association Registration Regulations, 18VAC48-60, registration timing, expiration, fees, complaint procedure certification",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/boardcodefull/title18/agency48/chapter70/",
        note: "Common Interest Community Ombudsman Regulations, 18VAC48-70, required contents of the association complaint procedure and the final adverse decision process",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.dpor.virginia.gov/sites/default/files/boards/CIC/CIC-MaximumAllowableFees.pdf",
        note: "CIC Board Maximum Allowable Preparation Fees bulletin with the current dollar caps, effective January 12, 2023 and amended July 1, 2023",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title58.1/section58.1-3915/",
        note: "the 5% penalty referenced by § 55.1-1824",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title13.1/chapter10/section13.1-860/",
        note: "removal of directors of a nonstock corporation",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title55.1/",
        note: "Title 55.1 chapter list confirming Chapter 23.1 is the current home of resale disclosure",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "virginia-recent-changes",
    title: "What changed for Virginia HOAs in 2024, 2025, and 2026",
    summary: "Bill numbers, code sections, and effective dates for three sessions of changes",
    topic: "State law",
    states: ["VA"],
    readMinutes: 7,
    publishedDate: "2026-08-26",
    photoBrief: "the Virginia State Capitol legislative chamber with empty desks and bill folders",
    body: `Virginia amends its community association statutes nearly every year. Here is what actually passed in the last three sessions, with the bill numbers and the dates.

## How Virginia effective dates work

Under Article IV, Section 13 of the Constitution of Virginia, a law enacted at a regular session takes effect on the first day of July following adjournment, unless the bill itself specifies a later date or an emergency clause moves it earlier. So the default is July 1 of the year the bill passed. Where a bill below has a delayed date, the bill said so.

## 2024

The 2024 session was the heaviest of the three for association law.

House Bill 880 and Senate Bill 341 became 2024 Chapters 55 and 349, "common interest communities; foreclosure remedy". They amended §§ 8.01-463, 55.1-1815, 55.1-1833, 55.1-1945, and 55.1-1966, among others. The core change bars a bill to enforce a judgment lien where the real estate is the judgment debtor's primary residence and the judgment is for association assessments, if the amount secured by one or more judgments, exclusive of interest and costs, does not exceed $5,000. The same act added two recordkeeping duties that apply to every board: the association must maintain individual assessment account records, and must maintain a record of any recorded lien at least as long as the lien remains effective. Chapter 55 was approved March 8, 2024 and Chapter 349 on April 2, 2024. Effective July 1, 2024.

House Bill 1209 became 2024 Chapter 324, "common interest communities; reserve studies; special assessment rescission or reduction". It amended §§ 55.1-1800, 55.1-1825, 55.1-1826, 55.1-1900, 55.1-1964, and 55.1-1965. It removed the provisions that had let owners rescind or reduce assessments levied for maintenance and upkeep of the common area and for capital components, confirmed that boards may borrow money for those purposes and pledge future revenues, and added a statutory definition of "reserve study" as a capital budget planning tool covering the physical status and estimated repair or replacement cost of capital components plus an analysis of the association's funding capacity. Approved April 2, 2024. Effective July 1, 2024. If your association still tells owners they can vote down a special assessment for capital components, that authority is gone.

Senate Bill 672 became 2024 Chapter 685, amending §§ 55.1-1805 and 55.1-1904. It clarified that nothing in either Act prevents an association from levying or using assessments, charges, or fees to pay the association's contractual or other legal obligations, while restricting charges imposed on fewer than all owners to fees for services provided, charges related to common area use, and fees expressly authorized by § 55.1-2316. Approved April 8, 2024.

House Bill 723 became 2024 Chapter 82, amending § 55.1-1816. It confirmed that the board meeting rules govern regardless of whether the property owners' association is incorporated or unincorporated, and clarified that those rules do not supersede corporate authorities otherwise established by law or the governing documents.

Two resale bills passed. House Bill 876 and Senate Bill 526 became 2024 Chapters 54 and 511, amending §§ 55.1-2308 through 55.1-2312, 55.1-2316, and 55.1-2317, on delivery of the resale certificate and the purchaser's remedies. House Bill 105 became 2024 Chapter 170, amending § 55.1-2316 to add condominium and cooperative associations to the associations that cannot collect resale fees unless they are current on the annual report and fee with the Common Interest Community Board.

House Bill 214 became 2024 Chapter 839, amending § 54.1-2347 and § 60.2-210. A resident of a common interest community who provides bookkeeping, billing, or recordkeeping services for compensation is presumed to be an independent contractor, and the association is exempt from the definition of "employer" in that situation. Approved May 17, 2024. This matters to self managed communities that pay a neighbor to keep the books.

## 2025

Three association bills passed in 2025, all effective July 1, 2025.

House Bill 1704 and Senate Bill 808 became 2025 Chapters 14 and 16, amending § 55.1-2310. The resale certificate form must now include a statement indicating that the governing documents may make an owner responsible for payment of all or part of the deductible when making a claim against insurance provided by the association or insurance owners are required or recommended to carry. If your association reuses a stored resale packet, the form needs updating.

House Bill 2110 became 2025 Chapter 247, amending §§ 55.1-2309 and 55.1-2310. An association may not require the purchaser's name before preparing the resale certificate, and may not require the purchaser's name to be set out on the completed certificate.

House Bill 2750 became 2025 Chapter 105, amending §§ 54.1-2353, 54.1-2354.5, 55.1-1837, and 55.1-1940.1, on termination of certain management contracts and transfer of association books and records. Within a reasonable time after a management contract terminates, and without additional cost to the association, a common interest community manager must transfer and release all funds and close bank accounts maintained on the association's behalf. Section 55.1-1837 already allowed either side to terminate a management contract with an automatic renewal provision at any time, without cause and without penalty, on not less than 60 days' written notice.

Two regulatory changes also landed in 2025. The Common Interest Community Ombudsman Regulations, 18VAC48-70, were amended effective August 1, 2025, with new complaint forms dated 8/2025. The Common Interest Community Association Registration Regulations, 18VAC48-60, were amended effective December 31, 2025, adding 18VAC48-60-16, which requires the annual report to name a contact person and a governing board member authorized to receive Ombudsman correspondence about final adverse decisions, and requires the association to certify with every annual report that it has adopted a complaint procedure and that the procedure is in effect.

## 2026

No 2026 act amended the Property Owners' Association Act, the Virginia Condominium Act, or the Resale Disclosure Act. That is verified against the Code of Virginia 2026 Updates listing for Title 55.1 and Title 54.1, which shows no updated sections in Chapters 18, 19, or 23.1 of Title 55.1 or in Chapter 23.3 of Title 54.1.

The change that will matter most to incorporated associations is one chapter over. House Bill 439 and Senate Bill 246 became 2026 Chapters 393 and 394 and rewrite the Virginia Nonstock Corporation Act, with a delayed effective date of January 1, 2027. Among many other revisions, the act lets members bring derivative proceedings, lets a court remove a director in certain circumstances, and adds a new § 13.1-837.1 on a member's liability for dues, assessments, and fees. For community associations specifically, the rewritten § 13.1-814.1(C) provides that where there is a conflict between the declaration or condominium instruments and the articles of incorporation or bylaws on member liability for dues, assessments, and fees, or on membership and its resignation or suspension, the declaration or condominium instruments control. A new subsection (D) says the Nonstock Act does not supersede any provision of the declaration or condominium instruments.

House Bill 444 became 2026 Chapter 395 and creates the Uniform Consumer Debt Default Judgments Act as a new chapter of Title 8.01, §§ 8.01-465.26 through 8.01-465.34, with a delayed effective date of July 1, 2027. It sets prerequisites for entering a default judgment in an action to collect a consumer debt, defined broadly as an obligation arising out of a transaction primarily for a personal, family, or household purpose. Associations that collect delinquent assessments by warrant in debt should treat this as a 2027 process change and watch how it is applied to assessment claims.

Two 2026 bills that get described as HOA bills are not. House Bill 395 and Senate Bill 250, 2026 Chapters 1052 and 998, cover small portable solar generation devices. They add § 55.1-1212.1, which sits in the Virginia Residential Landlord and Tenant Act and restricts what a landlord may prohibit, effective January 1, 2027. Neither Act was amended, so an association's authority over solar devices still comes from § 55.1-1820.1 and § 55.1-1951.1. House Bill 833, 2026 Chapter 679, lets localities require electric vehicle charging infrastructure in subdivision ordinances effective July 1, 2027, which affects developers and localities rather than existing associations.

Three association bills were carried over to the 2027 session and did not become law: House Bill 621 on declarant control disclosure in sale contracts, and House Bill 1196 and Senate Bill 746 on how common area land is valued in a condemnation proceeding.

## What to do with this

If your governing documents or your resale packet template were last updated before July 2024, three things are now wrong in them: the reserve and special assessment rescission language, the resale certificate insurance deductible disclosure, and any request for the purchaser's name. Fix those, then put a note in your calendar to check this list again after the 2027 session, because the Nonstock Corporation Act rewrite lands on January 1, 2027 and the consumer debt default judgment rules land six months later.`,
    sources: [
      {
        url: "https://lis.virginia.gov/bill-details/20241/HB880",
        note: "https://lis.virginia.gov/bill-details/20241/SB341",
        fetched: "2026-08-26",
      },
      {
        url: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?241+ful+CHAP0055",
        note: "full enrolled text and approval date of 2024 Chapter 55 (HB 880)",
        fetched: "2026-08-26",
      },
      {
        url: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?241+ful+CHAP0349",
        note: "full text and approval date of 2024 Chapter 349 (SB 341)",
        fetched: "2026-08-26",
      },
      {
        url: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?241+ful+CHAP0324",
        note: "2024 Chapter 324 (HB 1209), reserve studies and special assessment rescission",
        fetched: "2026-08-26",
      },
      {
        url: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?241+ful+CHAP0685",
        note: "2024 Chapter 685 (SB 672), assessments for legal obligations",
        fetched: "2026-08-26",
      },
      {
        url: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?241+ful+CHAP0082",
        note: "2024 Chapter 82 (HB 723), board meetings, incorporated or not",
        fetched: "2026-08-26",
      },
      {
        url: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?241+ful+CHAP0054",
        note: "2024 Chapter 54 (HB 876), resale certificate delivery and remedies",
        fetched: "2026-08-26",
      },
      {
        url: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?241+ful+CHAP0511",
        note: "2024 Chapter 511 (SB 526), companion to HB 876",
        fetched: "2026-08-26",
      },
      {
        url: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?241+ful+CHAP0170",
        note: "2024 Chapter 170 (HB 105), resale certificate fees",
        fetched: "2026-08-26",
      },
      {
        url: "https://legacylis.virginia.gov/cgi-bin/legp604.exe?241+ful+CHAP0839",
        note: "2024 Chapter 839 (HB 214), resident services exemption",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodefull/title55.1/chapter23.1/",
        note: "current text of §§ 55.1-2309, 55.1-2310, 55.1-2311, 55.1-2312, 55.1-2316 with the 2024 and 2025 chapter citations in the history lines",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodefull/title55.1/chapter18/",
        note: "current text of §§ 55.1-1826, 55.1-1825, 55.1-1833, 55.1-1837 with 2024 and 2025 chapter citations",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodeupdates/title55.1/",
        note: "Code of Virginia 2026 Updates for Title 55.1, showing no 2026 changes in Chapters 18, 19, or 23.1",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodeupdates/title54.1/",
        note: "Code of Virginia 2026 Updates for Title 54.1, showing no 2026 changes in Chapter 23.3",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodeupdates/title13.1/section13.1-814.1/",
        note: "rewritten § 13.1-814.1 effective January 1, 2027, cited to 2026 cc. 393 and 394",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodeupdates/title13.1/section13.1-837.1/",
        note: "new § 13.1-837.1, member liability for dues, assessments, and fees, effective January 1, 2027",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/vacodeupdates/title55.1/section55.1-1212.1/",
        note: "new § 55.1-1212.1, small portable solar generation devices, in the Residential Landlord and Tenant Act, effective January 1, 2027",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/boardcodefull/title18/agency48/chapter60/",
        note: "18VAC48-60 with the December 31, 2025 amendment dates and new 18VAC48-60-16",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/boardcodefull/title18/agency48/chapter70/",
        note: "18VAC48-70 with the August 1, 2025 amendment dates",
        fetched: "2026-08-26",
      },
      {
        url: "https://law.lis.virginia.gov/constitution/article4/section13/",
        note: "the July 1 default effective date rule",
        fetched: "2026-08-26",
      },
      {
        url: "https://lis.virginia.gov/bill-details/20261/HB439",
        note: "https://lis.virginia.gov/bill-details/20261/SB246",
        fetched: "2026-08-26",
      },
      {
        url: "https://lis.virginia.gov/bill-details/20251/HB1704",
        note: "https://lis.virginia.gov/bill-details/20251/SB808",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "washington-hoa-law",
    title: "Washington HOA law, a board member's guide",
    summary: "WUCIOA, the 2028 repeal of the old chapters, and the rules that already apply to every association",
    topic: "State law",
    states: ["WA"],
    readMinutes: 10,
    publishedDate: "2026-08-26",
    photoBrief: "a recorded declaration of covenants on paper with a county auditor's recording stamp in the top margin, photographed flat on a table",
    body: `Washington is in the middle of a migration. Every common interest community in the state, condominium or homeowners association, old or new, ends up under one statute on January 1, 2028. Some of that statute already applies to you today. This guide covers what a self-managed Washington board has to do now, and what changes.

## Which chapter governs your association

Four chapters are in play. RCW 64.90 is the Washington Uniform Common Interest Ownership Act, or WUCIOA. RCW 64.34 is the Condominium Act for condos created between 1990 and mid 2018. RCW 64.32 is the Horizontal Property Regimes Act for older condos. RCW 64.38 is the Homeowners' Associations chapter for plat communities.

Under RCW 64.90.360(2), before January 1, 2028 WUCIOA applies only to a community created on or after July 1, 2018, and to a pre-2018 community that amended its declaration to elect in. Under RCW 64.90.360(3) the older chapters apply to a pre-2018 community only until it becomes subject to WUCIOA.

That ends on January 1, 2028. Chapters 58.19, 64.32, 64.34 and 64.38 RCW were repealed by 2024 c 321, effective January 1, 2028, and WUCIOA then applies to every common interest community regardless of when it was created. If your governing documents quote RCW 64.38 or RCW 64.34, they will be quoting a repealed statute.

## The WUCIOA sections that already apply to older associations

This is the part Washington boards most often miss. RCW 64.90.365(1) lists WUCIOA sections that apply right now to communities created before July 1, 2018, and says any inconsistent provision of chapter 58.19, 64.32, 64.34 or 64.38 RCW does not apply. The list is RCW 64.90.370 on electing into the act, RCW 64.90.405(1)(b) and (c) on adopting budgets and imposing assessments, RCW 64.90.445 on meetings, RCW 64.90.480(10) on payment methods, RCW 64.90.502 on emergencies, RCW 64.90.513 on electric vehicle charging stations, RCW 64.90.525 on budgets and special assessments, RCW 64.90.545 on reserve studies, RCW 64.90.580 on heat pumps, and RCW 64.90.010 to the extent needed to read the subsection. The current list took effect January 1, 2026.

Two exceptions. The list does not reach a small plat or miscellaneous community that fits the exemption in RCW 64.90.360(4), or a nonresidential or mixed-use community under RCW 64.90.100. Under RCW 64.90.365(2) these sections apply only to events on or after July 1, 2018, but RCW 64.90.370 and RCW 64.90.525 override conflicting language already in the governing documents of a plat or miscellaneous community.

## Meetings

RCW 64.90.445 requires at least one meeting of the association each year. Notice of an owners meeting goes out not less than 14 days and not more than 50 days before the meeting. Board meeting notice is at least 14 days, and 7 days by electronic communication for an emergency meeting on something that could not reasonably have been foreseen.

Board and committee meetings are open to owners except in executive session. The board must give at least 15 minutes at the beginning of each board meeting for owners to comment on agenda items before the board votes, with no less than 90 seconds per owner per unit. If materials go to the board before the meeting, copies must be made reasonably available to owners, except unapproved minutes and executive session materials.

Executive session is limited to legal advice, litigation or mediation, personnel matters, contract negotiations, and matters involving an individual where disclosure would violate a reasonable expectation of privacy. Electronic meetings are allowed if the notice explains how to connect, everyone can hear the discussion, and board votes are by roll call or voice. After transition from declarant control the board may act without a meeting only on ministerial matters or to carry out something already authorized.

## Budgets

RCW 64.90.525 uses ratification, not approval. Within 30 days after the board adopts a proposed budget it must send a copy to all owners and set a ratification meeting not less than 14 and not more than 50 days after sending it. The budget is ratified unless owners holding a majority of the votes reject it at that meeting, and it is ratified whether or not a quorum shows up. If the budget is rejected, or the notice was not given, the last ratified budget continues. Special assessments follow the same procedure.

The budget itself must show projected income by category, projected common expenses by category, the assessment per unit and its due date, the current amount of regular assessments going to reserves, a statement of whether the association has a reserve study meeting RCW 64.90.550 and how far the budget meets or deviates from it, and the current reserve deficiency or surplus expressed per unit.

## Reserves

RCW 64.90.545 requires an initial reserve study prepared by a reserve study professional, an updated study every year, and at least every third year an update prepared by a professional based on a visual site inspection. The annual update is the one boards skip. Exemptions cover nonresidential communities, communities with only nominal reserve costs, certain middle housing communities, and cases where the cost of the study or update exceeds 10% of the annual budget.

RCW 64.90.550 sets contents, including a component list for anything whose replacement cost exceeds 1% of the annual budget, the study level, the reserve balance, percent funded, interest and inflation assumptions, full funding and baseline funding contribution rates over a 30 year period, and the per unit deficit or surplus. It also requires a specific warning paragraph beginning "This reserve study should be reviewed carefully."

Funding reserves is not mandatory. Under RCW 64.90.560 no monetary damages or other liability may be imposed on the association, its officers or board members, or advisors, for failing to establish or replenish a reserve account, have a current study, or make the reserve disclosures, except an attorney fee award under RCW 64.90.555(2). The duty is to study, update, and disclose. Older associations that have not elected in still take the contents rules from RCW 64.38.070 or RCW 64.34.380 until 2028.

## Records

For WUCIOA associations, RCW 64.90.495 lists what must be kept, including financial records, minutes, contracts, insurance policies, design approvals and enforcement decisions for seven years, and voting records for one year. Records must be made available on 10 days' notice, and in no event later than 21 days without a court order. The association may charge a reasonable fee for copies and for supervising an inspection, but each owner gets one free copy of the owner list and preforeclosure information each year. Personnel and medical records, ongoing negotiations, litigation records, privileged legal advice, executive session records, other owners' unit files, and security access codes may be withheld or redacted.

A pre-2018 association is still on RCW 64.38.045, which is not on the RCW 64.90.365 list. It has the same categories and the same seven year retention, but no statutory response deadline. It also requires an annual financial statement, with a CPA audit if annual assessments are $50,000 or more unless 67% of the votes cast waive it. Under RCW 64.90.530 a WUCIOA association needs an annual audit, waivable each year by a majority of the votes held by owners other than the declarant when annual assessments are under $100,000.

## Collections and foreclosure

RCW 64.90.485 gives the association a statutory lien from the time an assessment is due, and recording the declaration is enough to perfect it. The lien takes priority over an earlier recorded mortgage to the extent of six months of regular assessments that would have come due in the six months before the association starts foreclosure, plus costs and reasonable attorney fees capped at the lesser of $2,000 or that six month amount.

The association cannot start foreclosure unless the owner owes the greater of three months of assessments or $2,000, excluding fines, late charges, interest and collection costs, and at least 90 days have passed since that amount accrued. Within 30 days after an assessment goes past due the association must mail a first preforeclosure notice. For 15 days after that mailing it may not take collection action or charge anything beyond printing and mailing costs, a $10 administrative fee, and a single late fee not exceeding the lesser of $50 or 5% of the unpaid assessment. A second notice comes after the account is 90 days past due and no sooner than 60 days after the first. RCW 64.38.100 imposes the same notices and thresholds on pre-2018 homeowners associations, and also requires board approval of the foreclosure, but it does not give them a super priority lien.

## Rules, fines and elections

Under RCW 64.90.405(2)(l) the association may impose reasonable fines after notice and an opportunity to be heard, using a schedule of fines the board adopted in advance and gave to owners. There is no dollar cap in the statute. RCW 64.90.505 requires notice of the board's intent to adopt, amend or repeal a rule, the text of the rule, and a date the board will act after considering owner comments, followed by notice of the action and copies of the rule.

RCW 64.90.510 bars rules that prohibit the United States or Washington flag, flagpoles, political signs, solar panels meeting safety standards, or storing collection containers in a garage, side yard or back yard, while allowing reasonable rules about each. RCW 64.90.512 protects drought resistant, pollinator and wildfire resistant landscaping, and RCW 64.90.582 protects fire-hardened building materials.

RCW 64.90.410 requires a board of at least three, a majority of them owners after transition, held to the care and loyalty standard of a corporate director. RCW 64.90.518 requires pre-election notice of the number of open seats, any candidate qualifications, and the process and deadline for nominations, plus an appeal if the board disqualifies a nominee. RCW 64.90.520 lets owners remove a board member or officer with or without cause by the lesser of a majority of the votes in the association or two thirds of the votes cast, provided removal was on the agenda in the notice and the person gets a chance to speak. RCW 64.90.455 requires a secret ballot for board elections, removals and governing document amendments, and voids an undated proxy.

## The corporate side

Most Washington associations are nonprofit corporations under chapter 24.03A RCW, the Washington nonprofit corporation act, which took effect January 1, 2022. The annual report goes to the Secretary of State under RCW 23.95.255 and is due by the last day of the month in which the corporation was first formed or registered, and may be filed up to 180 days early. The fee is $60, reduced to $20 if the nonprofit certifies gross revenue under $500,000 in its most recent fiscal year. Miss it and the Secretary of State serves notice, and if you do not cure within 60 days the corporation is administratively dissolved under RCW 23.95.610. A dissolved association keeps existing but may only wind up, which is a bad position from which to enforce a lien.

## What Washington boards get wrong

They keep working from RCW 64.38 or RCW 64.34 without checking the RCW 64.90.365 list, and so they miss the meeting, budget and reserve rules that already bind them. They treat the budget as something owners approve, when silence ratifies it. They order a reserve study every three years and skip the annual update. They assume funding reserves is legally required and are surprised by RCW 64.90.560, or they assume the study is optional because funding is not. They start collection inside the 15 day window after the first preforeclosure notice, or stack more than one late fee. They forget the 15 minute comment period and the board packet now due to owners. And they let the Secretary of State annual report lapse.

If you are unsure which chapter your declaration puts you under, that is the one question worth paying an attorney to answer.`,
    sources: [
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.360",
        note: "applicability of WUCIOA, the January 1, 2028 date, small community exemption, note that the older chapters were repealed by 2024 c 321",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.365",
        note: "the list of WUCIOA sections applying to pre-2018 communities",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.370",
        note: "electing into WUCIOA, and recodification from 64.90.095",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.095",
        note: "disposition note showing recodification by 2024 c 321 s 510",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.445",
        note: "meeting notice periods, open meetings, comment period, executive session",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.525",
        note: "budget ratification and budget contents",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.545",
        note: "reserve study frequency and exemptions",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.550",
        note: "reserve study contents and required disclosure",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.560",
        note: "reserve liability safe harbor",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.495",
        note: "WUCIOA records",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.485",
        note: "lien, priority, foreclosure prerequisites and notices",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.510",
        note: "limits on rules",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.505",
        note: "rule adoption notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.405",
        note: "powers and duties, fines",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.410",
        note: "board composition and standard of care",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.518",
        note: "board election notice",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.520",
        note: "removal of board members and officers",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.455",
        note: "owner voting, proxies, secret ballots",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.530",
        note: "financial statements and audit threshold",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.480",
        note: "assessments, payment method subsection (10)",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.38",
        note: "list of sections in the Homeowners' Associations chapter",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.38.045",
        note: "pre-2018 records and audit threshold",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.38.025",
        note: "pre-2018 budget summary and ratification",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.38.065",
        note: "pre-2018 reserve account and study",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.38.070",
        note: "pre-2018 reserve study contents",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.38.100",
        note: "pre-2018 liens and preforeclosure notices",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.34.380",
        note: "condominium reserve rules effective until January 1, 2028",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=24.03A.005",
        note: "Washington nonprofit corporation act effective January 1, 2022",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=23.95.255",
        note: "annual report requirement",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=23.95.610",
        note: "administrative dissolution procedure",
        fetched: "2026-08-26",
      },
      {
        url: "https://www.sos.wa.gov/sites/default/files/2025-06/6.2025%20-%20AR%20-%20NP%2024.03A_0.pdf",
        note: "nonprofit annual report fee of $60 or $20 and the expiration date rule",
        fetched: "2026-08-26",
      },
      {
        url: "https://lawfilesext.leg.wa.gov/biennium/2023-24/Htm/Bills/Session%20Laws/Senate/5796-S.SL.htm",
        note: "the 2024 act, effective dates, sections 401 through 432 effective January 1, 2028",
        fetched: "2026-08-26",
      },
    ],
  },
  {
    slug: "washington-recent-changes",
    title: "What changed in Washington HOA law, 2024 to 2026",
    summary: "Bill numbers and effective dates for the WUCIOA rollout, the new collection rules, and the 2026 bills",
    topic: "State law",
    states: ["WA"],
    readMinutes: 6,
    publishedDate: "2026-08-26",
    photoBrief: "the Washington State Capitol legislative building in Olympia photographed from the north steps on an overcast day",
    body: `Washington has changed community association law in each of the last three sessions, and the changes are sequenced rather than one-off. This is what passed, when it takes effect, and what a board has to do about it.

## 2024, the act that ends the old chapters

Substitute Senate Bill 5796 became chapter 321, Laws of 2024. It passed the Senate on February 2, 2024 and the House on March 6, 2024, and the Governor approved it on March 28, 2024. Most of it took effect June 6, 2024. Section 319 took effect January 1, 2025, and sections 401 through 432 take effect January 1, 2028.

Those last sections carry the repeal. Chapters 58.19, 64.32, 64.34 and 64.38 RCW are repealed effective January 1, 2028, and the Washington Uniform Common Interest Ownership Act in chapter 64.90 RCW then applies to every common interest community in the state whatever its age.

The act also reorganized chapter 64.90. RCW 64.90.095, the election provision for preexisting communities, was recodified as RCW 64.90.370. The applicability section formerly at RCW 64.90.075 is now RCW 64.90.360. If your files or your attorney's template quote the old numbers, they are stale. The act also added RCW 64.90.518, which requires pre-election notice of open seats, candidate qualifications and the nomination deadline, and it rewrote the removal rules in RCW 64.90.520.

Separately in 2024, Substitute Senate Bill 5973 became chapter 128, Laws of 2024, and added RCW 64.90.580 protecting the installation and use of heat pumps.

## 2025, the ramp

Engrossed Substitute Senate Bill 5129 became chapter 119, Laws of 2025. It passed the Senate on February 12, 2025 and the House on April 10, 2025, and the Governor approved it on April 22, 2025. The general effective date is July 27, 2025, but sections 2 through 4, 11, 19, 21 and 25 took effect January 1, 2026, and section 34 takes effect January 1, 2028.

Section 11 is the one that matters most. It rewrote RCW 64.90.365, the list of WUCIOA sections that apply to communities created before July 1, 2018. Since January 1, 2026 that list covers RCW 64.90.370, RCW 64.90.405(1)(b) and (c), RCW 64.90.445, RCW 64.90.480(10), RCW 64.90.502, RCW 64.90.513, RCW 64.90.525, RCW 64.90.545 and RCW 64.90.580. In plain terms, every Washington association is now on the WUCIOA rules for meetings, budgets, reserve studies, emergency powers, payment methods, electric vehicle charging and heat pumps, whatever its declaration says.

Section 16 amended RCW 64.90.445 and added two duties boards feel immediately. The board must give at least 15 minutes at the beginning of each board meeting for owners to comment on agenda items before it votes. And any materials distributed to board members before a meeting must be made reasonably available to owners, except unapproved minutes and executive session material. The act also widened the small community exemption in RCW 64.90.360(4).

Engrossed Second Substitute Senate Bill 5686 became chapter 393, Laws of 2025. It extends the state foreclosure mediation program to association assessment lien foreclosures and rewrites the preforeclosure notices in RCW 64.90.485 and RCW 64.38.100, along with the records sections RCW 64.90.495 and RCW 64.38.045. Sections 1 through 4 and 11 through 14 took effect January 1, 2026, and sections 5 through 7 take effect January 1, 2028.

The practical result is a two notice sequence with a quiet period. A first preforeclosure notice goes out within 30 days after an assessment is past due. For 15 days after mailing it the association may not take collection action or charge anything beyond printing and mailing costs, a $10 administrative fee, and one late fee capped at the lesser of $50 or 5% of the unpaid assessment. A second notice follows once the account is more than 90 days past due and at least 60 days after the first.

House Bill 1403 became chapter 201, Laws of 2025, and amended the implied warranty of quality in RCW 64.90.670, drawing a line between condominiums created before and after July 27, 2025.

## 2026, three bills that change board paperwork

Substitute House Bill 2354 became chapter 96, Laws of 2026. It passed the House on February 13, 2026 and the Senate on March 5, 2026, and the Governor approved it on March 18, 2026, effective June 11, 2026. It raised the audit threshold in RCW 64.90.530 from $50,000 to $100,000 in annual assessments, added a reserve study exemption in RCW 64.90.545 for middle housing communities with no on-site wastewater or health and safety reserve components, adjusted the small community exemption in RCW 64.90.360(4) for communities of six or fewer middle housing units, and removed the ability of governing documents to vary the owner responsibility rules in RCW 64.90.513(8) and RCW 64.90.580(7).

Engrossed Substitute House Bill 1500 became chapter 194, Laws of 2026. It passed the Senate on March 4, 2026 and the House on March 11, 2026, was approved on March 24, 2026, and takes effect June 11, 2026. It rewrote the resale certificate rules in RCW 64.90.640. The association must furnish a resale certificate within 10 days of an owner's request. The charge may not exceed $275, and an update within six months may carry a nominal fee not exceeding $100. Certain assessment information must be current to within 45 days, and the purchaser may cancel within five business days after first receiving the certificate.

Engrossed House Bill 1501 became chapter 128, Laws of 2026, approved on March 23, 2026 and effective June 11, 2026. It added a matching owner inquiry section to chapters 64.90, 64.32, 64.34 and 64.38 RCW. The chapter 64.90 version is RCW 64.90.715. An owner may send one written inquiry per 30 days about governance or operations, and the association has 30 days after receipt to give a substantive response or tell the owner more time is reasonably necessary. Extensions are allowed for review at the next regularly scheduled monthly board meeting, for 30 more days on a complex inquiry, or to obtain a legal or professional opinion.

Substitute Senate Bill 6054 became chapter 180, Laws of 2026 and added RCW 64.90.582 on fire-hardened building materials. Governing documents may not prohibit them, and reasonable design rules must still leave feasible compliant options. The section applies retroactively to governing documents in effect on June 11, 2026, and a conflicting provision in such a document is void and unenforceable.

## What to do before the next session

Three concrete tasks. Add the 15 minute owner comment period to your board meeting agenda template and set up a way to publish the board packet. Rebuild your collection letter sequence around the two preforeclosure notices and the 15 day quiet period. And check whether your annual assessments crossed the new $100,000 audit line in either direction.

Then plan the 2028 transition. Governing documents that recite RCW 64.38 or RCW 64.34 will point at repealed law, and amending a declaration takes months.`,
    sources: [
      {
        url: "https://app.leg.wa.gov/billsummary?BillNumber=5796&Year=2023&Initiative=false",
        note: "SB 5796 sponsor, passage and approval dates, chapter 321 Laws of 2024",
        fetched: "2026-08-26",
      },
      {
        url: "https://lawfilesext.leg.wa.gov/biennium/2023-24/Htm/Bills/Session%20Laws/Senate/5796-S.SL.htm",
        note: "effective date line, sections 401 through 432 effective January 1, 2028, passage and approval dates",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.365",
        note: "note that chapters 58.19, 64.32, 64.34 and 64.38 RCW were repealed by 2024 c 321 effective January 1, 2028, and the current retroactive section list",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.095",
        note: "recodification of 64.90.095 to 64.90.370 by 2024 c 321 s 510",
        fetched: "2026-08-26",
      },
      {
        url: "https://lawfilesext.leg.wa.gov/biennium/2025-26/Htm/Bills/Session%20Laws/Senate/5129-S.SL.htm",
        note: "ESSB 5129 effective dates, passage and approval dates, RCW 64.90.365 list, 15 minute comment period and board materials language",
        fetched: "2026-08-26",
      },
      {
        url: "https://lawfilesext.leg.wa.gov/biennium/2025-26/Htm/Bills/Session%20Laws/Senate/5686-S2.SL.htm",
        note: "SB 5686 chapter 393 Laws of 2025, sections amended, mediation expansion, effective date sections",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.485",
        note: "preforeclosure notice sequence, quiet period, fee caps, amendment history including 2025 c 393",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.670",
        note: "2025 c 201 amendment to the implied warranty",
        fetched: "2026-08-26",
      },
      {
        url: "https://lawfilesext.leg.wa.gov/biennium/2025-26/Htm/Bills/Session%20Laws/House/2354-S.SL.htm",
        note: "SHB 2354 chapter 96 Laws of 2026, section by section, effective date June 11, 2026",
        fetched: "2026-08-26",
      },
      {
        url: "https://lawfilesext.leg.wa.gov/biennium/2025-26/Htm/Bills/Session%20Laws/House/1500-S.SL.htm",
        note: "ESHB 1500 chapter 194 Laws of 2026, resale certificate fees and deadlines, effective date",
        fetched: "2026-08-26",
      },
      {
        url: "https://lawfilesext.leg.wa.gov/biennium/2025-26/Htm/Bills/Session%20Laws/House/1501.SL.htm",
        note: "EHB 1501 chapter 128 Laws of 2026, owner inquiry requirement, effective date",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.715",
        note: "the codified owner inquiry section and its 2026 c 128 source note",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.582",
        note: "fire-hardened building materials, retroactivity, and the 2026 c 180 source note linking to SB 6054",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.580",
        note: "heat pumps, and the 2024 c 128 source note linking to SB 5973",
        fetched: "2026-08-26",
      },
      {
        url: "https://app.leg.wa.gov/RCW/default.aspx?cite=64.90.530",
        note: "audit threshold raised to $100,000 by 2026 c 96 s 6",
        fetched: "2026-08-26",
      },
      {
        url: "https://advocacy.caionline.org/wa2026eos/",
        note: "lead on the 2026 bill list, used only to find bills, each then verified against the session law or the RCW source note",
        fetched: "2026-08-26",
      },
    ],
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

/**
 * Slugs that used to exist, and where they went.
 *
 * The four original state articles were thin and, in two places, wrong in ways
 * the new research fixes: the Florida piece quoted the 150 parcel website
 * threshold, which is the condominium number rather than the HOA one, and the
 * Washington piece predates the repeal of RCW 64.38. They are superseded rather
 * than edited, and the old URLs still resolve, because a board that bookmarked
 * one should land on the corrected page instead of a 404.
 */
export const LIBRARY_REDIRECTS: Record<string, string> = {
  "washington-reserve-and-records": "washington-hoa-law",
  "california-davis-stirling": "california-hoa-law",
  "florida-2026-website-rule": "florida-hoa-law",
  "texas-open-meetings-and-fines": "texas-hoa-law",
};
