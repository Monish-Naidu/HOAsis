import type { StateCode } from "@/lib/data/library";

/**
 * What an association has to do, and when.
 *
 * The compliance register used to read from a hand written placeholder with
 * chapter level citations and a note in the fixture saying not to deepen it
 * without a legal pass. The library now has that pass for twelve states, so
 * this is where the two meet: every obligation here is stated in a library
 * article that carries its own sources, and it names the article so a board
 * can go and read the reasoning rather than trust a row in a table.
 *
 * The split is deliberate. `GENERAL_OBLIGATIONS` are the ones essentially
 * every association has, and they carry a cadence but no statute, because the
 * statute differs everywhere and a made up citation is worse than none.
 * `STATE_OBLIGATIONS` are where the deadline and the section are real.
 *
 * Nothing here decides whether an association is compliant. It says what is
 * owed and when it falls due, which is arithmetic on a date, and leaves the
 * judgement to the board. That is the same boundary the governing documents
 * decision draws, for the same reason.
 */

export type ObligationCadence =
  | "annual"
  | "triennial"
  | "each-budget"
  | "on-request"
  | "ongoing";

export interface Obligation {
  key: string;
  label: string;
  /** What the board must be able to produce if somebody asks. */
  evidence: string;
  /** The section, where we have one. Absent means the cadence is general. */
  citation?: string;
  cadence: ObligationCadence;
  /** Month it falls due where the statute or convention pins one. 1 to 12. */
  dueMonth?: number;
  /** Days to respond, where the duty is a clock rather than a date. */
  clockDays?: number;
  /**
   * True where this binds from the association's first day.
   *
   * The distinction a new community actually needs. Registering with the state
   * and opening an account in the association's name are day one duties; an
   * annual audit is not something a two month old association is behind on.
   */
  fromDayOne?: boolean;
  /** The library article that explains it, with its sources. */
  article?: string;
  /** Where in the product the evidence already lives. */
  href?: string;
}

/**
 * True almost everywhere, with the deadline set locally.
 *
 * Deliberately uncited. Every state requires an annual meeting and almost
 * every association owes its state an annual corporate report; the section
 * number and the date are different in all of them, and printing a plausible
 * one would be the exact failure the old fixture warned about.
 */
export const GENERAL_OBLIGATIONS: Obligation[] = [
  {
    key: "corporate-report",
    label: "Annual report to the state",
    evidence: "The filed report and the receipt, for the current year.",
    cadence: "annual",
    fromDayOne: true,
    article: "first-30-days-self-managed-board",
    href: "/admin/settings",
  },
  {
    key: "annual-meeting",
    label: "Annual meeting of the members",
    evidence: "The notice as sent, the date it went out, and the minutes.",
    cadence: "annual",
    article: "running-a-board-meeting",
    href: "/admin/voting",
  },
  {
    key: "budget-to-owners",
    label: "Budget delivered to every owner",
    evidence: "The adopted budget, the date it was sent, and the list it went to.",
    cadence: "each-budget",
    article: "reading-an-hoa-budget",
    href: "/admin/money",
  },
  {
    key: "insurance",
    label: "Insurance in force, and a fidelity bond",
    evidence: "Current declarations pages, and the bond over whoever touches the money.",
    cadence: "annual",
    fromDayOne: true,
    href: "/admin/settings",
  },
  {
    key: "records-response",
    label: "Answer a records request inside the statutory window",
    evidence: "The request, what was produced, and the date it went back.",
    cadence: "on-request",
    clockDays: 10,
    article: "enforcing-rules-fairly",
    href: "/admin/documents",
  },
  {
    key: "reserve-study",
    label: "A reserve study, and the annual update",
    evidence: "The study, the most recent update, and the funding disclosure in the budget.",
    cadence: "annual",
    article: "reserve-study-basics",
    href: "/admin/reserves",
  },
];

/**
 * Where the deadline and the section are real.
 *
 * Washington is complete because it is the state the demo association sits in
 * and the one whose article is deepest. The rest carry the obligations their
 * own article states plainly. Anything not written here falls back to the
 * general list, and the register says which it is rather than implying the
 * same confidence for both.
 */
export const STATE_OBLIGATIONS: Partial<Record<StateCode, Obligation[]>> = {
  WA: [
    {
      key: "wa-corporate-report",
      label: "Annual report to the Secretary of State",
      evidence:
        "The filed report and the receipt. Due by the last day of the month the association was first formed in, and fileable up to 180 days early.",
      citation: "RCW 23.95.255",
      cadence: "annual",
      fromDayOne: true,
      article: "washington-hoa-law",
      href: "/admin/settings",
    },
    {
      key: "wa-budget-ratification",
      label: "Budget summary out, and a ratification meeting set",
      evidence:
        "The summary as sent, and the meeting date. Within 30 days of the board adopting the budget, with the meeting 14 to 50 days after sending.",
      citation: "RCW 64.90.525",
      cadence: "each-budget",
      article: "washington-hoa-law",
      href: "/admin/money",
    },
    {
      key: "wa-reserve-update",
      label: "Reserve study update",
      evidence:
        "The updated study. Every year, and every third year prepared by a professional off a visual site inspection.",
      citation: "RCW 64.90.545",
      cadence: "annual",
      article: "washington-hoa-law",
      href: "/admin/reserves",
    },
    {
      key: "wa-reserve-disclosure",
      label: "Reserve disclosure inside the budget",
      evidence:
        "The budget showing the amount going to reserves, whether a study exists, how far the budget meets it, and the per unit deficit or surplus.",
      citation: "RCW 64.90.525",
      cadence: "each-budget",
      article: "washington-hoa-law",
      href: "/admin/money",
    },
    {
      key: "wa-records-response",
      label: "Produce records on request",
      evidence:
        "The request and what was produced. Available on 10 days' notice, and in no event later than 21 days.",
      citation: "RCW 64.90.495",
      cadence: "on-request",
      clockDays: 10,
      article: "washington-hoa-law",
      href: "/admin/documents",
    },
    {
      key: "wa-audit",
      label: "Annual audit, unless owners waive it",
      evidence:
        "The audit, or the recorded waiver for this year. Waivable by a majority of owner votes where annual assessments are under $100,000.",
      citation: "RCW 64.90.530",
      cadence: "annual",
      article: "washington-hoa-law",
      href: "/admin/money",
    },
    {
      key: "wa-annual-meeting",
      label: "Annual meeting, with the board packet to owners",
      evidence:
        "The notice, the packet, and the minutes recording the comment period.",
      citation: "RCW 64.90.445",
      cadence: "annual",
      article: "washington-hoa-law",
      href: "/admin/voting",
    },
  ],
  CO: [
    {
      key: "co-registration",
      label: "Annual registration with the Division of Real Estate",
      evidence:
        "The current registration. Let it lapse and the right to enforce an assessment lien is suspended until you register again.",
      citation: "C.R.S. § 38-33.3-401",
      cadence: "annual",
      fromDayOne: true,
      article: "colorado-hoa-law",
      href: "/admin/settings",
    },
    {
      key: "co-policies",
      label: "The nine written governance policies",
      evidence:
        "Adopted policies on collections, conflicts, meetings, enforcement, records, reserve investment, policy adoption, disputes and reserve studies.",
      citation: "C.R.S. § 38-33.3-209.5(1)(b)",
      cadence: "ongoing",
      fromDayOne: true,
      article: "colorado-hoa-law",
      href: "/admin/documents/governing",
    },
    {
      key: "co-disclosure",
      label: "Year end disclosures made available",
      evidence:
        "Budget, assessments, financials with reserve balances, insurance list, governing documents, minutes and policies. Within 90 days of the fiscal year end.",
      citation: "C.R.S. § 38-33.3-209.4(2)",
      cadence: "annual",
      article: "colorado-hoa-law",
      href: "/admin/documents",
    },
  ],
  FL: [
    {
      key: "fl-documents-to-members",
      label: "Give every new member the rules and covenants",
      evidence: "What was sent, and when, for each home that changed hands.",
      citation: "Fla. Stat. § 720.303(15)(b)",
      cadence: "ongoing",
      fromDayOne: true,
      article: "florida-hoa-law",
      href: "/admin/documents/new-owner",
    },
    {
      key: "fl-budget",
      label: "Adopted budget delivered before the year starts",
      evidence: "The budget, the delivery date, and the reserve disclosure in it.",
      citation: "Fla. Stat. § 720.303(6)",
      cadence: "each-budget",
      article: "florida-hoa-law",
      href: "/admin/money",
    },
    {
      key: "fl-records",
      label: "Records available inside ten business days",
      evidence: "The request and what was produced.",
      citation: "Fla. Stat. § 720.303(5)",
      cadence: "on-request",
      clockDays: 10,
      article: "florida-hoa-law",
      href: "/admin/documents",
    },
  ],
  CA: [
    {
      key: "ca-reserve-study",
      label: "Reserve study, with a site visit every three years",
      evidence: "The study and the most recent update.",
      citation: "Civ. Code § 5550",
      cadence: "triennial",
      article: "california-hoa-law",
      href: "/admin/reserves",
    },
    {
      key: "ca-annual-disclosure",
      label: "Annual budget report to members",
      evidence:
        "The pro forma budget, reserve summary and funding plan, delivered 30 to 90 days before the fiscal year ends.",
      citation: "Civ. Code § 5300",
      cadence: "annual",
      article: "california-hoa-law",
      href: "/admin/money",
    },
    {
      key: "ca-policy-statement",
      label: "Annual policy statement",
      evidence:
        "The statement of member rights, the collection policy, and the enforcement procedures.",
      citation: "Civ. Code § 5310",
      cadence: "annual",
      article: "california-hoa-law",
      href: "/admin/documents/governing",
    },
  ],
};

/** Which states have obligations written with their own citations. */
export const CITED_STATES = Object.keys(STATE_OBLIGATIONS) as StateCode[];
