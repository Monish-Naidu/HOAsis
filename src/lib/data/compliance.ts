import type { ComplianceItem } from "@/lib/types";

/**
 * Placeholder register for a Washington association.
 *
 * Mehr Meadows was recorded in 2015, so the Homeowners' Associations Act
 * (RCW 64.38) governs rather than WUCIOA (RCW 64.90), which applies to
 * communities created on or after July 1, 2018.
 *
 * Citations here are deliberately chapter level. The Washington deadline rules
 * still need a proper legal pass before any of this is trustworthy, and the UI
 * says so. Do not deepen these without one.
 */
export const complianceItems: ComplianceItem[] = [
  {
    id: "cmp-reserve-study",
    title: "Reserve study, annual update",
    citation: "RCW 64.38, reserve study provisions",
    jurisdiction: "Washington",
    summary:
      "Washington expects a reserve study, updated annually, with a full study and site visit on a longer cycle. The budget summary carries the funding disclosure.",
    evidence:
      "Last full study March 2025 by Cardinal Reserve Advisors. Deck and railing findings from January 2026 folded into the component schedule. The 2027 draft discloses 41 percent funding against recommended.",
    status: "in-progress",
    dueDate: "2026-10-31",
    cadence: "Annually, full study on a longer cycle",
    owner: "Dana Whitcomb, Treasurer",
    actionLabel: "Open reserve schedule",
    actionHref: "/admin/money",
  },
  {
    id: "cmp-budget-ratification",
    title: "Budget summary and ratification meeting",
    citation: "RCW 64.38, budget adoption and ratification",
    jurisdiction: "Washington",
    summary:
      "The board adopts a budget, delivers a summary to every owner, and sets a ratification meeting. The budget takes effect unless owners reject it.",
    evidence:
      "Not yet sent. Adoption meeting is set for October 21, 2026, so the summary needs to go out by October 7.",
    status: "in-progress",
    dueDate: "2026-10-07",
    cadence: "Annually",
    owner: "Sofia Bergman, Secretary",
    actionLabel: "Schedule the notice",
    actionHref: "/admin/communications",
  },
  {
    id: "cmp-records-clock",
    title: "Records available to owners on request",
    citation: "RCW 64.38, association records",
    jurisdiction: "Washington",
    summary:
      "The statute asks for records within a reasonable time. Mehr Meadows's own policy sets 10 business days, so HOAsis tracks the tighter of the two.",
    evidence:
      "Request REQ-2026-114 from Gwen Halloran, unit 26, received August 11. Policy clock expires August 25. Response drafted, awaiting board sign off.",
    status: "due-soon",
    dueDate: "2026-08-25",
    cadence: "Per request",
    owner: "Sofia Bergman, Secretary",
    actionLabel: "Open the request",
    actionHref: "/admin/requests",
    clockDays: 10,
  },
  {
    id: "cmp-resale",
    title: "Resale certificate on request",
    citation: "RCW 64.38, resale certificate",
    jurisdiction: "Washington",
    summary:
      "A selling owner can demand a resale certificate, and the association has a short window to produce it. It pulls the budget, the reserve disclosure, assessments, and any known violation on the unit.",
    evidence:
      "Two certificates issued in 2026, both inside the window. Latest issued July 2 for unit 84.",
    status: "compliant",
    cadence: "Per request",
    owner: "Sofia Bergman, Secretary",
    completedDate: "2026-07-02",
    actionLabel: "View documents",
    actionHref: "/admin/documents",
  },
  {
    id: "cmp-annual-meeting",
    title: "Annual meeting notice",
    citation: "RCW 64.38, association meetings",
    jurisdiction: "Washington",
    summary:
      "Notice of the annual meeting goes to every owner inside a set window before the meeting. Delivery is the part boards fail to prove, not the meeting itself.",
    evidence:
      "2026 annual meeting held January 21. Notice sent January 5 with the delivery log retained. 88 delivered, 3 bounced and were mailed.",
    status: "compliant",
    cadence: "Annually",
    owner: "Sofia Bergman, Secretary",
    completedDate: "2026-01-05",
  },
  {
    id: "cmp-annual-report",
    title: "Nonprofit corporation annual report",
    citation: "RCW 24.03A, Washington Secretary of State",
    jurisdiction: "Washington",
    summary:
      "The association is a nonprofit corporation and files an annual report to stay in good standing. Lapsing puts the corporate shield and the board's ability to act at risk.",
    evidence: "Filed March 3, 2026. Next report due March 2027. Registered agent current.",
    status: "compliant",
    dueDate: "2027-03-31",
    cadence: "Annually",
    owner: "Arya Mehr, President",
    completedDate: "2026-03-03",
  },
  {
    id: "cmp-insurance",
    title: "Property insurance replacement cost review",
    citation: "Association policy and lender requirement",
    jurisdiction: "Washington",
    summary:
      "An independent replacement cost appraisal on a regular cycle keeps the association from carrying a policy that under insures common property. Not a statutory deadline, but insurers and lenders ask for it and the board's exposure is the same.",
    evidence:
      "Appraisal completed April 2024 by Meridian Valuation. Next due by April 2027. Evergreen policy renews January 1, 2027.",
    status: "compliant",
    dueDate: "2027-04-30",
    cadence: "Every 36 months",
    owner: "Arya Mehr, President",
    completedDate: "2024-04-18",
  },
  {
    id: "cmp-1099",
    title: "Vendor W-9 on file before first payment",
    citation: "IRS 26 U.S.C. § 6041A (1099-NEC prerequisite)",
    jurisdiction: "Federal",
    summary:
      "Every unincorporated vendor paid $600 or more in a calendar year needs a 1099-NEC by January 31, and the association's own policy is to collect the W-9 before the first check goes out. A missing W-9 is the usual reason the January filing goes wrong.",
    evidence:
      "6 of 7 active vendors have a current W-9 on file. Cedar River Pest Control does not, and has already been paid $1,425 year to date, past the $600 threshold. Policy deadline for collection was July 31.",
    status: "overdue",
    dueDate: "2026-07-31",
    cadence: "Before first payment, then annually",
    owner: "Dana Whitcomb, Treasurer",
    actionLabel: "Request the missing W-9",
    actionHref: "/admin/vendors",
  },
];
