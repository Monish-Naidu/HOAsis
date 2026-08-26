import type { BylawAmendment, BylawArticle } from "@/lib/types";

/**
 * The association's bylaws, as text rather than as a PDF nobody opens.
 *
 * Every product in this category stores governing documents as a file. That is
 * technically compliant and practically useless: an owner with a question about
 * fence height has to download an 80 page scan and read it, so they ask the
 * board instead, and the board answers from memory. Half the disputes in a
 * self-managed association start there.
 *
 * So each article carries two things. The governing text, which is what
 * actually binds and cannot be paraphrased away, and a plain reading, which is
 * what gets somebody to look at all. Showing only the summary would be
 * misleading; showing only the deed language recreates the PDF.
 *
 * The text below is written for a fictional Washington association and is not
 * a template. Every association's documents differ, which is the point of
 * reading your own.
 */
export const bylawArticles: BylawArticle[] = [
  {
    id: "by-1",
    number: "Article I",
    title: "Name, purpose, and what this document governs",
    topic: "governance",
    affects: "both",
    text: [
      "The Association is Mehr Meadows Homeowners Association, a Washington nonprofit corporation organized under RCW 24.03A and subject to the Washington Uniform Common Interest Ownership Act, RCW 64.90.",
      "These Bylaws govern the internal affairs of the Association. Where these Bylaws conflict with the Declaration, the Declaration controls. Where either conflicts with Washington law, the law controls.",
    ],
    plain:
      "This is the rule book for how the association runs itself. If it ever disagrees with the recorded Declaration, the Declaration wins. If either disagrees with state law, the law wins.",
  },
  {
    id: "by-2",
    number: "Article II",
    title: "Membership",
    topic: "governance",
    affects: "owners",
    text: [
      "Every owner of a Lot is a member of the Association. Membership runs with the Lot and cannot be separated from it, assigned, or transferred except on conveyance of the Lot.",
      "Where a Lot is owned by more than one person, all such persons are members, but the Lot has one vote.",
    ],
    plain:
      "If you own a home here, you are a member. You cannot opt out, and you cannot keep the membership if you sell. A couple who own together share one vote, not two.",
  },
  {
    id: "by-3",
    number: "Article III",
    title: "Voting and quorum",
    topic: "meetings",
    affects: "owners",
    text: [
      "Each Lot has one vote. A member whose assessments are more than sixty days delinquent may not vote until the delinquency is cured.",
      "Twenty percent of the total voting interests, present in person, by proxy, or by ballot, constitutes a quorum for a meeting of members.",
      "Except where these Bylaws or the Declaration require otherwise, action is taken by a majority of the votes cast once a quorum is established.",
    ],
    plain:
      "One home, one vote. Fall more than sixty days behind on dues and you lose the vote until you catch up. Twenty percent of homes have to take part for a meeting to decide anything.",
    amendedOn: "2024-03-18",
  },
  {
    id: "by-4",
    number: "Article IV",
    title: "The Board of Directors",
    topic: "governance",
    affects: "board",
    text: [
      "The Board consists of five directors, each of whom must be a member of the Association. Directors serve two year terms, staggered so that no more than three seats are filled in any one year.",
      "A director may be removed, with or without cause, by a vote of a majority of the total voting interests at a meeting called for that purpose.",
      "The Board fills a vacancy by appointment until the next annual meeting, at which the seat is filled for the remainder of the term.",
    ],
    plain:
      "Five neighbors, elected for two years each, with the terms staggered so the whole board never turns over at once. Owners can remove a director by majority vote. The board fills a mid-term vacancy itself until the next annual meeting.",
  },
  {
    id: "by-5",
    number: "Article V",
    title: "Officers",
    topic: "governance",
    affects: "board",
    text: [
      "The officers are a President, a Vice President, a Secretary, and a Treasurer, elected annually by the Board from among its members.",
      "The Treasurer is responsible for the custody of Association funds and for the books of account, and shall present a financial report at each regular meeting of the Board.",
      "No officer may sign a check payable to themselves. Disbursements above two thousand dollars require two signatures.",
    ],
    plain:
      "The board picks four officers from among itself each year. The treasurer keeps the books and reports at every meeting. Nobody can write themselves a check, and anything over $2,000 needs two signatures.",
  },
  {
    id: "by-6",
    number: "Article VI",
    title: "Meetings",
    topic: "meetings",
    affects: "both",
    text: [
      "The annual meeting of members is held in the fourth quarter of each calendar year. Notice stating the date, time, place, and agenda is delivered to each member not less than fourteen nor more than sixty days before the meeting.",
      "Board meetings are open to members except for those portions properly held in executive session, which are limited to matters of pending litigation, personnel, contract negotiation, and owner delinquency or discipline.",
      "Minutes of every meeting, including a general description of matters discussed in executive session, are made available to members within thirty days.",
    ],
    plain:
      "One annual meeting a year, with at least fourteen days notice and an agenda. Board meetings are open to you, except for four narrow topics. Minutes go up within thirty days either way.",
  },
  {
    id: "by-7",
    number: "Article VII",
    title: "Assessments",
    topic: "money",
    affects: "owners",
    text: [
      "The Board adopts an annual budget and levies regular assessments sufficient to fund it. Regular assessments are payable monthly in advance on the first day of each month.",
      "The Board may increase the regular assessment by up to twenty percent over the prior fiscal year without a vote of the members. An increase beyond twenty percent requires the approval of a majority of the total voting interests.",
      "A special assessment for a purpose other than an emergency requires the approval of a majority of the total voting interests. An emergency is limited to a condition that threatens the health or safety of occupants, or an expense required by law or by a court.",
    ],
    plain:
      "Dues are billed monthly and cover the budget. The board can raise them by up to twenty percent in a year on its own; more than that needs an owner vote. Any special assessment needs an owner vote unless it is a genuine emergency.",
    amendedOn: "2024-03-18",
  },
  {
    id: "by-8",
    number: "Article VIII",
    title: "Late assessments and collection",
    topic: "money",
    affects: "owners",
    text: [
      "An assessment not paid within ten days of its due date is delinquent. The Association may charge a late fee not exceeding the greater of fifteen dollars or ten percent of the delinquent amount, and interest at twelve percent per annum.",
      "Before recording a lien, the Association shall deliver written notice of the delinquency, the amount owed, and the opportunity to enter a payment plan of at least twelve months.",
      "The Association shall not commence foreclosure on a lien consisting solely of fines and related charges.",
    ],
    plain:
      "You have ten days. After that there is a late fee and interest. Before any lien is recorded you get a written notice and the offer of a payment plan of at least a year. The association cannot foreclose over fines alone.",
  },
  {
    id: "by-9",
    number: "Article IX",
    title: "Reserves",
    topic: "money",
    affects: "board",
    text: [
      "The Board shall cause a reserve study to be prepared and updated in accordance with RCW 64.90.550, and shall include in each annual budget a proposed reserve contribution.",
      "Reserve funds are held in a separate account and are not used for operating expenses. A transfer from reserves for any purpose other than the replacement of a component identified in the reserve study requires a resolution of the Board recorded in the minutes.",
    ],
    plain:
      "The board keeps a reserve study current and budgets a contribution to it every year. Reserve money sits in its own account and cannot quietly cover an operating shortfall.",
  },
  {
    id: "by-10",
    number: "Article X",
    title: "Architectural review",
    topic: "property",
    affects: "owners",
    text: [
      "No exterior construction, alteration, addition, or change of exterior color may be made without prior written approval of the Architectural Review Committee. This includes fences, walls, hedges used as a boundary, sheds, decks, patios, driveways, and any rooftop equipment.",
      "A fence or wall shall not exceed six feet in height on a rear or side lot line, or four feet in any yard between the dwelling and the street. Fences shall be of cedar, vinyl, wrought iron, or composite. Chain link is prohibited.",
      "The Committee shall approve or deny a complete application within forty-five days. An application not acted upon within forty-five days is deemed approved.",
      "Denial shall state the specific provision relied upon and the reasons for the decision. An applicant may appeal a denial to the Board within thirty days.",
    ],
    plain:
      "Get written approval before you change anything visible from outside: paint, a fence, a shed, a deck, solar. Fences top out at six feet in back and four feet in front, and chain link is out. The committee has forty-five days, and if they miss it your application is approved automatically. A denial has to say which rule it relies on, and you can appeal within thirty days.",
  },
  {
    id: "by-11",
    number: "Article XI",
    title: "Enforcement and fines",
    topic: "enforcement",
    affects: "both",
    text: [
      "Before imposing a fine, the Association shall give the owner written notice describing the violation, the provision violated, and the right to be heard before the Board at a hearing held not less than fourteen days after the notice.",
      "Fines shall not exceed one hundred dollars for a single violation, or one hundred dollars per day for a continuing violation after notice and hearing.",
      "The Association shall not fine an owner for a violation that the Association has not enforced consistently against other owners.",
    ],
    plain:
      "You get written notice and a hearing before any fine. Fines are capped at $100, or $100 a day for something ongoing after the hearing. If the association has let other people do the same thing, it cannot fine you for it.",
  },
  {
    id: "by-12",
    number: "Article XII",
    title: "Records",
    topic: "records",
    affects: "both",
    text: [
      "A member may inspect and copy the records of the Association, on written request, during regular business hours and within ten business days of the request.",
      "The Association may withhold records that reveal personnel matters, communications with legal counsel, pending litigation, and information about another owner's account other than the fact of delinquency.",
      "The Association may charge the actual cost of copying and no more.",
    ],
    plain:
      "Ask in writing and the association has ten business days to let you see its records. A short list of things can be withheld, mostly legal advice and other people's private information. You pay copying costs only.",
  },
  {
    id: "by-13",
    number: "Article XIII",
    title: "Amendment of these Bylaws",
    topic: "governance",
    affects: "both",
    text: [
      "These Bylaws may be amended by the affirmative vote of sixty-seven percent of the total voting interests, at a meeting or by ballot.",
      "The text of a proposed amendment, showing the language to be added and the language to be struck, shall be delivered to every member not less than fourteen days before the vote opens.",
      "An amendment takes effect when the Secretary certifies the result and records the amendment if recording is required.",
    ],
    plain:
      "Changing these bylaws takes sixty-seven percent of all homes, not just of those who vote. Everyone has to see the exact wording, marked up, at least fourteen days before voting opens.",
  },
];

/**
 * What is currently on the table.
 *
 * A proposal carries the finished text, not a description of it, so a member
 * voting on the ballot reads the words their documents will actually contain.
 * Boards routinely ask "shall we amend Article VII" with the change in an
 * attachment nobody opens, and then find the result challenged.
 */
export const bylawAmendments: BylawAmendment[] = [
  {
    id: "amd-solar",
    kind: "amend",
    articleId: "by-10",
    number: "Article X",
    title: "Architectural review",
    topic: "property",
    affects: "owners",
    text: [
      "No exterior construction, alteration, addition, or change of exterior color may be made without prior written approval of the Architectural Review Committee. This includes fences, walls, hedges used as a boundary, sheds, decks, patios, driveways, and any rooftop equipment.",
      "A fence or wall shall not exceed six feet in height on a rear or side lot line, or four feet in any yard between the dwelling and the street. Fences shall be of cedar, vinyl, wrought iron, or composite. Chain link is prohibited.",
      "The Committee shall approve or deny a complete application within forty-five days. An application not acted upon within forty-five days is deemed approved.",
      "The Committee shall not deny an application for a solar energy system on the grounds of appearance alone. It may impose reasonable conditions as to placement and screening that do not reduce the system's expected output by more than ten percent or increase its cost by more than one thousand dollars.",
      "Denial shall state the specific provision relied upon and the reasons for the decision. An applicant may appeal a denial to the Board within thirty days.",
    ],
    plain:
      "Adds a paragraph on solar. The committee could no longer refuse panels because of how they look, though it could still ask for a different placement so long as that does not cost you much output or much money.",
    rationale:
      "Three applications were denied last year on appearance. Washington law limits an association's ability to refuse solar, and the current article does not reflect that, which leaves the association exposed.",
    proposedBy: "Board of Directors",
    proposedOn: "2026-08-04",
    stage: "open",
    ballotId: "bal-3",
    thresholdLabel: "67% of all 88 homes",
  },
  {
    id: "amd-rentals",
    kind: "add",
    number: "Article XIV",
    title: "Leasing",
    topic: "property",
    affects: "owners",
    text: [
      "An owner may lease their Lot for a term of not less than six months. Leases of less than six months, including short term vacation rentals, are prohibited.",
      "An owner shall provide the Association with the name and contact information of each tenant within ten days of the commencement of a lease.",
      "An owner remains responsible for all assessments and for the conduct of their tenants.",
    ],
    plain:
      "Would add a new article limiting rentals to six months or longer, which rules out short term vacation lets. You would have to tell the association who your tenant is, and you would stay responsible for the dues and for what they do.",
    rationale:
      "Petition of twelve owners following complaints about weekend rentals on Cedar Lane. Lenders also ask for the rental cap when a buyer applies for financing.",
    proposedBy: "Petition of 12 owners",
    proposedOn: "2026-08-12",
    stage: "draft",
    thresholdLabel: "67% of all 88 homes",
  },
];
