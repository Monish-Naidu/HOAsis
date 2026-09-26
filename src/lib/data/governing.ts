import type { GoverningAmendment, GoverningArticle } from "@/lib/types";

/**
 * The governing documents, as text rather than as a PDF nobody opens.
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
 * There are three documents here and they are not interchangeable, which is
 * the other half of the point. The declaration is recorded against the land
 * and binds a buyer who never read it. The bylaws run the association. The
 * rules are whatever the board adopted last, under authority the declaration
 * already gave it. Which document a sentence sits in decides who can change it
 * and which sentence wins when two of them disagree.
 *
 * The text below is written for a fictional Washington association and is not
 * a template. Every association's documents differ, which is the point of
 * reading your own.
 */

/**
 * The recorded Declaration of Covenants, Conditions and Restrictions.
 *
 * This is the instrument nobody reads and everybody is bound by. It was
 * recorded with the county before the first home sold, it runs with the land,
 * and no vote of the current owners removed it from the title of anyone who
 * bought afterwards. Almost everything that surprises a new owner is in here
 * rather than in the bylaws, which is why the disclosure tags sit mostly on
 * these articles.
 */
export const declarationArticles: GoverningArticle[] = [
  {
    id: "dec-1",
    document: "declaration",
    number: "Article I",
    title: "The property this Declaration binds",
    topic: "governance",
    affects: "owners",
    text: [
      "Section 1. This Declaration is recorded against all of the real property described in Exhibit A, being Lots 1 through 88 inclusive of the Plat of Willow Creek Estates, recorded in Volume 168 of Plats, pages 41 through 44, records of Snohomish County, Washington.",
      "Section 2. Every covenant, condition and restriction in this Declaration runs with the land and binds every person acquiring any interest in a Lot, whether or not the covenants are referred to in the instrument by which that interest is acquired.",
      "Section 3. This Declaration may be enforced by the Association or by any Owner. Failure to enforce a covenant on one occasion is not a waiver of the right to enforce it later.",
    ],
    plain:
      "This is the document that came with the land. It binds you because you bought here, not because you signed it, and it applies whether or not anyone mentioned it at closing. Both the association and your neighbors can enforce it.",
  },
  {
    id: "dec-2",
    document: "declaration",
    number: "Article II",
    title: "Residential use, and working from home",
    topic: "property",
    affects: "owners",
    disclosureTopics: ["home-business"],
    text: [
      "Section 1. Each Lot shall be used for single family residential purposes only. No trade, business, or commercial activity shall be conducted upon any Lot.",
      "Section 2. Notwithstanding Section 1, an Owner may conduct a business activity within the dwelling provided that the existence of the business is not apparent from the exterior, that it generates no customer or client traffic beyond that ordinary for a residence, that it involves no employees who do not reside in the dwelling, and that it complies with all applicable licensing.",
      "Section 3. No commercial signage identifying a business conducted on a Lot may be displayed.",
    ],
    plain:
      "You can work from home, including running a business, as long as a neighbor could not tell from the street. What you cannot do is have customers coming and going, staff who do not live with you, or a sign on the lawn.",
  },
  {
    id: "dec-3",
    document: "declaration",
    number: "Article III",
    title: "Leasing your home",
    topic: "property",
    affects: "owners",
    disclosureTopics: ["rentals"],
    text: [
      "Section 1. An Owner may lease their dwelling in its entirety. No Lot may be leased in part, and no room may be separately let.",
      "Section 2. Every lease shall be in writing and shall provide that the tenant is subject to this Declaration, the Bylaws, and the Rules and Regulations, and that a breach by the tenant is enforceable against the Owner.",
      "Section 3. An Owner shall deliver to the Association the name of each occupant and the term of the lease within ten days of its commencement.",
    ],
    plain:
      "You can rent your home out, but the whole home, not a room. The lease has to say your tenant follows the same rules you do, and you stay on the hook for what they do. Tell the association who is living there within ten days.",
  },
  {
    id: "dec-4",
    document: "declaration",
    number: "Article IV",
    title: "Assessments",
    topic: "money",
    affects: "owners",
    text: [
      "Section 1. Each Owner, by acceptance of a deed to a Lot, covenants to pay the Association regular assessments levied for the common expenses and special assessments levied under Section 4.",
      "Section 2. Regular assessments are set annually by the Board as part of the adopted budget and are allocated equally among the Lots.",
      "Section 3. The obligation to pay is not excused by non-use of the common areas, by dissatisfaction with the Association, or by any claim against the Association.",
      "Section 4. A special assessment for a capital improvement or an unbudgeted expense in excess of five percent of the annual budget requires the approval of a majority of the total voting interests.",
    ],
    plain:
      "Dues are owed because you own the home. You cannot withhold them because you never use the trail, because you disagree with the board, or because the association owes you something. A large one-off assessment needs a vote of the owners.",
  },
  {
    id: "dec-5",
    document: "declaration",
    number: "Article V",
    title: "What happens if assessments go unpaid",
    topic: "money",
    affects: "owners",
    disclosureTopics: ["lien"],
    text: [
      "Section 1. Each assessment, together with interest, late charges, and the costs of collection including reasonable attorney fees, is a continuing lien upon the Lot against which it is assessed from the date it becomes due.",
      "Section 2. The lien is also the personal obligation of the Owner at the time the assessment fell due, and does not pass to a purchaser except as provided by law.",
      "Section 3. The Association may foreclose the lien in the manner provided by RCW 64.90.485 for the foreclosure of a mortgage. The Association shall not commence a foreclosure action for a debt consisting solely of fines, late charges, interest, or collection costs.",
      "Section 4. The Association shall not commence a foreclosure action unless the assessments secured by the lien have been delinquent for at least three months.",
    ],
    plain:
      "Unpaid dues become a lien on your home from the day they are late, and the association can eventually force a sale to collect them. It cannot do that over fines alone, and not until you are at least three months behind. This is the part of the documents most owners have never been told about.",
  },
  {
    id: "dec-6",
    document: "declaration",
    number: "Article VI",
    title: "Keeping your lot maintained",
    topic: "property",
    affects: "owners",
    text: [
      "Section 1. Each Owner shall maintain their Lot, the dwelling, and all improvements upon it in good repair and in a clean and attractive condition.",
      "Section 2. Lawns shall be mowed, planting beds kept free of noxious weeds, and dead trees and shrubs removed within a reasonable time.",
      "Section 3. If an Owner fails to maintain their Lot after written notice and a reasonable opportunity to cure, the Association may enter upon the Lot, perform the work, and charge the cost to the Owner as a specific assessment.",
    ],
    plain:
      "Keep the house and the yard in reasonable shape. If you do not, and you have been told and given time to fix it, the association can have the work done and bill you for it.",
  },
  {
    id: "dec-7",
    document: "declaration",
    number: "Article VII",
    title: "Architectural control, and exterior appearance",
    topic: "property",
    affects: "owners",
    disclosureTopics: ["architectural"],
    text: [
      "Section 1. No building, fence, wall, deck, patio, driveway, antenna, or other structure or improvement shall be commenced, erected, or maintained upon a Lot, nor shall any exterior addition, alteration, or change of exterior color be made, until the plans have been submitted to and approved in writing by the Architectural Review Committee.",
      "Section 2. The Committee shall consider harmony of external design with existing structures and the location in relation to surrounding structures and topography. Approval shall not be unreasonably withheld.",
      "Section 3. An improvement made without approval may be ordered removed at the Owner's expense.",
      "Section 4. Nothing in this Article shall be construed to require approval for work wholly within the dwelling and not visible from outside it.",
    ],
    plain:
      "Anything you change on the outside needs written approval first, and that includes repainting the same house a different color. Inside work is your own business. Build without asking and you can be made to take it down at your own cost.",
  },
  {
    id: "dec-8",
    document: "declaration",
    number: "Article VIII",
    title: "Signs, flags, and what you may display",
    topic: "property",
    affects: "owners",
    disclosureTopics: ["signs", "flags"],
    text: [
      "Section 1. No sign of any kind shall be displayed to public view upon a Lot except one professionally lettered sign of not more than five square feet advertising the property for sale or rent, and signs required by legal proceedings.",
      "Section 2. Political yard signs may be displayed during the ninety days preceding an election and shall be removed within seven days after it.",
      "Section 3. The Association shall not prohibit the display of the flag of the United States on a Lot. The Association may adopt reasonable rules as to the size, placement, and manner of display, and as to the height and location of a freestanding flagpole.",
      "Section 4. No other banner, pennant, or display shall be affixed to the exterior of a dwelling or displayed in a yard for more than fourteen consecutive days.",
    ],
    plain:
      "One for-sale sign is fine. Political signs are fine in the three months before an election and have to come down a week after. The American flag cannot be banned, though the association can say how big and where. Everything else comes down after two weeks.",
  },
  {
    id: "dec-9",
    document: "declaration",
    number: "Article IX",
    title: "Vehicles and parking",
    topic: "property",
    affects: "owners",
    disclosureTopics: ["parking"],
    text: [
      "Section 1. Each Lot has the parking provided in its garage and driveway. Garages shall be maintained so that they remain usable for parking a vehicle.",
      "Section 2. (a) No vehicle shall be parked upon any part of a Lot other than a driveway or garage. (b) No commercial vehicle, boat, trailer, camper, recreational vehicle, or vehicle bearing commercial lettering shall be parked or stored on a Lot, on a street, or in a common area overnight, except within a closed garage. (c) A commercial vehicle present for the purpose of providing a service to a residence is permitted for the duration of that service.",
      "Section 3. No vehicle that is inoperable, unlicensed, or under repair shall be kept on a Lot other than within a closed garage.",
      "Section 4. Guest parking in common areas is subject to the Rules and Regulations adopted by the Board.",
    ],
    plain:
      "Park in your garage or on your driveway. A work truck, boat, camper or trailer cannot sit outside overnight unless it is in the garage, though a plumber's van parked while the plumber is working is fine. Nothing on blocks in the driveway.",
  },
  {
    id: "dec-10",
    document: "declaration",
    number: "Article X",
    title: "Solar, antennas, and installations that cannot be refused",
    topic: "property",
    affects: "owners",
    disclosureTopics: ["solar"],
    text: [
      "Section 1. Notwithstanding Article VII, the Association shall not prohibit the installation of a solar energy panel or system on a Lot.",
      "Section 2. The Association may impose reasonable requirements as to placement and screening, provided that the requirements do not decrease the expected production of the system by more than ten percent or increase the cost of installation by more than one thousand dollars.",
      "Section 3. An Owner shall submit an application under Article VII before installation so that the Committee may state its placement requirements, and the Committee shall respond within forty-five days.",
      "Section 4. This Article shall be construed consistently with RCW 64.38.055 and with any successor statute limiting an association's authority over solar energy systems.",
    ],
    plain:
      "Solar panels cannot be refused because of how they look. The committee can ask you to put them somewhere less visible, but not if that costs you much output or much money. You still have to apply first, and they have forty-five days to answer.",
  },
  {
    id: "dec-11",
    document: "declaration",
    number: "Article XI",
    title: "Enforcement, and the limits on it",
    topic: "enforcement",
    affects: "both",
    text: [
      "Section 1. The Association may impose reasonable fines for a violation of this Declaration, the Bylaws, or the Rules and Regulations, after notice and an opportunity to be heard before the Board.",
      "Section 2. A notice of violation shall state the provision alleged to have been violated, the facts relied upon, the action required to cure, and the date by which the Owner may request a hearing.",
      "Section 3. No fine shall be imposed for a violation that has been cured within the period stated in the notice.",
      "Section 4. The Association shall enforce this Declaration uniformly. Enforcement against one Owner and not another in substantially the same circumstances is not enforcement under this Article.",
    ],
    plain:
      "Before you can be fined you have to be told exactly what rule you broke and what would fix it, and given a chance to say your piece. Fix it in time and there is no fine. And the association has to treat you the same as the neighbor doing the same thing.",
  },
  {
    id: "dec-12",
    document: "declaration",
    number: "Article XII",
    title: "Changing this Declaration",
    topic: "governance",
    affects: "both",
    text: [
      "Section 1. This Declaration may be amended by an instrument signed by Owners holding not less than seventy-five percent of the total voting interests.",
      "Section 2. No amendment is effective until it is recorded with the Snohomish County Auditor.",
      "Section 3. No amendment may alter the boundaries of a Lot, the allocated interests of a Lot, or the uses to which a Lot is restricted, without the consent of every Owner affected.",
    ],
    plain:
      "Changing this document takes seventy-five percent of all homes and a trip to the county recorder. Some changes, the ones that would alter your lot or what you may use it for, need your own agreement no matter how the vote goes.",
  },
];

/**
 * The Rules and Regulations, adopted by the Board.
 *
 * These are the ones that actually change. A board can adopt a rule at a
 * single meeting without an owner vote, which is exactly why they are the
 * layer where overreach happens: a rule that contradicts the Declaration is
 * void, and almost nobody checks.
 */
export const rulesArticles: GoverningArticle[] = [
  {
    id: "rul-1-2",
    document: "rules",
    number: "Section 1.2",
    title: "Guest parking",
    topic: "property",
    affects: "owners",
    disclosureTopics: ["parking"],
    text: [
      "1.2 Guest parking spaces in the common area are for visitors and are limited to seventy-two consecutive hours. A resident's own vehicle may not be kept in a guest space.",
      "1.2.1 A vehicle remaining beyond seventy-two hours may be towed at the owner's expense after a notice is affixed to the vehicle for twenty-four hours.",
    ],
    plain:
      "Guest spots are for guests, for up to three days. Leave a car longer and it can be towed, but only after a notice has been on the windshield for a day.",
    adoptedOn: "2023-05-16",
  },
  {
    id: "rul-2-3",
    document: "rules",
    number: "Section 2.3",
    title: "Landscaping and yard maintenance",
    topic: "property",
    affects: "owners",
    text: [
      "2.3 Front yard lawns shall be mowed to a height not exceeding six inches between April 1 and October 31, and planting beds shall be kept free of weeds and debris.",
      "2.3.1 Dead or diseased plant material in a front yard shall be removed within thirty days.",
      "2.3.2 This Section implements Article VI of the Declaration and does not extend it.",
    ],
    plain:
      "Mow the front lawn through the growing season and keep the beds tidy. Dead plants come out within a month.",
    adoptedOn: "2022-09-20",
  },
  {
    id: "rul-3-1",
    document: "rules",
    number: "Section 3.1",
    title: "How to apply for architectural approval",
    topic: "property",
    affects: "owners",
    disclosureTopics: ["architectural"],
    text: [
      "3.1 An application shall include a description of the work, a site plan or sketch showing location, the materials and colors proposed, and the expected start and completion dates.",
      "3.1.1 The Committee shall acknowledge a complete application within seven days and shall approve or deny it within forty-five days of receipt.",
      "3.1.2 An application not acted upon within forty-five days is deemed approved.",
      "3.1.3 A denial shall state the provision relied upon and the reason. An Owner may appeal to the Board within thirty days.",
    ],
    plain:
      "Say what you are building, where, in what material and color, and when. They have forty-five days to answer, and if they do not answer in time your application is approved. A refusal has to name the rule it relies on.",
    adoptedOn: "2024-02-19",
  },
  {
    id: "rul-4-1",
    document: "rules",
    number: "Section 4.1",
    title: "Refuse containers",
    topic: "property",
    affects: "owners",
    text: [
      "4.1 Refuse, recycling, and yard waste containers shall be stored out of view from the street except between 6:00 p.m. on the day before collection and 8:00 p.m. on the day of collection.",
      "4.1.1 Containers shall be kept closed and in sanitary condition.",
    ],
    plain:
      "Bins live out of sight except from the evening before collection to the evening of collection day.",
    adoptedOn: "2022-09-20",
  },
  {
    id: "rul-5-1",
    document: "rules",
    number: "Section 5.1",
    title: "The fine schedule",
    topic: "enforcement",
    affects: "both",
    text: [
      "5.1 The following fines apply after notice and an opportunity to be heard as provided in Article XI of the Declaration: first violation, a written courtesy notice and no fine; second violation of the same provision within twelve months, fifty dollars; each subsequent violation, one hundred dollars.",
      "5.1.1 A continuing violation may be fined once for each thirty day period it remains uncured after the cure date stated in the notice.",
      "5.1.2 No fine may be imposed where the violation was cured within the period stated in the notice.",
    ],
    plain:
      "The first time, you get a letter and no fine. A second time within a year is fifty dollars, after that it is a hundred. Fix it by the date on the letter and there is no fine at all.",
    adoptedOn: "2024-02-19",
  },
  {
    id: "rul-6-1",
    document: "rules",
    number: "Section 6.1",
    title: "Asking to see the association's records",
    topic: "records",
    affects: "both",
    text: [
      "6.1 A request to inspect records shall be made in writing and shall describe the records sought with reasonable particularity.",
      "6.1.1 The Association shall make the records available within ten business days at a reasonable time and place, or shall deliver copies.",
      "6.1.2 The Association may charge the actual cost of copying. It may not charge for the time spent locating records.",
      "6.1.3 Records that may be withheld are limited to those listed in RCW 64.90.495(6).",
    ],
    plain:
      "Ask in writing and say what you want to see. They have ten business days. You pay for copies, not for their time, and there is a short list of things they are allowed to hold back.",
    adoptedOn: "2024-02-19",
  },
];

/**
 * The Bylaws, which govern how the association runs itself.
 */
export const bylawArticles: GoverningArticle[] = [
  {
    id: "by-1",
    document: "bylaws",
    number: "Article I",
    title: "Name, purpose, and what this document governs",
    topic: "governance",
    affects: "both",
    text: [
      "The Association is Willow Creek Estates Homeowners Association, a Washington nonprofit corporation organized under RCW 24.03A and subject to the Washington Uniform Common Interest Ownership Act, RCW 64.90.",
      "These Bylaws govern the internal affairs of the Association. Where these Bylaws conflict with the Declaration, the Declaration controls. Where either conflicts with Washington law, the law controls.",
    ],
    plain:
      "This is the rule book for how the association runs itself. If it ever disagrees with the recorded Declaration, the Declaration wins. If either disagrees with state law, the law wins.",
  },
  {
    id: "by-2",
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
    document: "bylaws",
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
 * The three documents as one searchable set.
 *
 * Ordered by precedence, declaration first, because that is the order in which
 * a conflict resolves and the order a reader should meet them in.
 */
export const governingArticles: GoverningArticle[] = [
  ...declarationArticles,
  ...bylawArticles,
  ...rulesArticles,
];

/**
 * What is currently on the table.
 *
 * A proposal carries the finished text, not a description of it, so a member
 * voting on the ballot reads the words their documents will actually contain.
 * Boards routinely ask "shall we amend Article VII" with the change in an
 * attachment nobody opens, and then find the result challenged.
 */
export const governingAmendments: GoverningAmendment[] = [
  {
    id: "amd-solar",
    document: "bylaws",
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
    document: "bylaws",
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
