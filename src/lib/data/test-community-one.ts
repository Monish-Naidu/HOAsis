import { buildOwnerLedgers } from "./owner-ledger";
import type { Community } from "./community";
import { GRANTABLE } from "./accounts";
import type { Capabilities, Capability, Owner } from "@/lib/types";

/**
 * Test Community #1.
 *
 * Deliberately the opposite of Mehr Meadows in almost every dimension: five
 * homes rather than 88, a banner rather than a calendar, no amenities, no
 * reserve study, one vendor, and a two person board. If a screen only works
 * because Mehr Meadows is large and mature, this community will expose it.
 *
 * Dated as of late February 2027, six months after the association onboarded
 * in August 2026.
 */

function caps(on: Capability[], permissions = false): Capabilities {
  const base = Object.fromEntries(
    [...GRANTABLE, "permissions"].map((c) => [c, false]),
  ) as Capabilities;
  for (const c of on) base[c] = true;
  base.permissions = permissions;
  return base;
}

const DUES = 30_00;

/* -------------------------------------------------------------------------- */
/* Six months of dues, one household at a time.                                */
/* -------------------------------------------------------------------------- */

const PAYMENT_MONTHS = [
  { month: "2026-09", label: "September" },
  { month: "2026-10", label: "October" },
  { month: "2026-11", label: "November" },
  { month: "2026-12", label: "December" },
  { month: "2027-01", label: "January" },
  { month: "2027-02", label: "February" },
];

/** Dues collected each month. One household ran late in December. */
function duesEntries() {
  return PAYMENT_MONTHS.map((m, index) => {
    const households = m.month === "2026-12" ? 4 : 5;
    return {
      id: `tc1-le-dues-${index}`,
      date: `${m.month}-04`,
      description: `Assessment payments, batch (${households} homes)`,
      counterparty: "HOAsis Payments",
      category: "Assessments" as const,
      accountId: "tc1-acct-operating",
      amountCents: DUES * households,
      status: "cleared" as const,
      matchedBy: "auto" as const,
    };
  });
}

/** The landscaper, paid $100 by ACH on the 15th of every month. */
function landscapingEntries() {
  return PAYMENT_MONTHS.map((m, index) => ({
    id: `tc1-le-lawn-${index}`,
    date: `${m.month}-15`,
    description: `Bellevue Lawn & Garden, ${m.label} grounds`,
    counterparty: "Bellevue Lawn & Garden",
    category: "Landscaping" as const,
    accountId: "tc1-acct-operating",
    amountCents: -100_00,
    status: "cleared" as const,
    matchedBy: "auto" as const,
  }));
}

/** Our own subscription, which shows on their books like any other vendor. */
function softwareEntries() {
  return PAYMENT_MONTHS.map((m, index) => ({
    id: `tc1-le-saas-${index}`,
    date: `${m.month}-01`,
    description: "HOAsis subscription",
    counterparty: "HOAsis",
    category: "Management" as const,
    accountId: "tc1-acct-operating",
    amountCents: -20_00,
    status: "cleared" as const,
    matchedBy: "auto" as const,
  }));
}

const ledger = [
  {
    id: "tc1-le-open",
    date: "2026-08-28",
    description: "Opening deposit, transferred from the prior account",
    counterparty: "WaFd Bank",
    category: "Assessments" as const,
    accountId: "tc1-acct-operating",
    amountCents: 1_240_00,
    status: "cleared" as const,
    matchedBy: "manual" as const,
  },
  ...duesEntries(),
  ...landscapingEntries(),
  ...softwareEntries(),
  {
    id: "tc1-le-late",
    date: "2027-01-09",
    description: "Late fee assessed, 1 account",
    counterparty: "Test Community #1",
    category: "Late fees" as const,
    accountId: "tc1-acct-operating",
    amountCents: 15_00,
    status: "cleared" as const,
    matchedBy: "manual" as const,
  },
  {
    id: "tc1-le-catchup",
    date: "2027-01-09",
    description: "December assessment, paid late by unit 3",
    counterparty: "HOAsis Payments",
    category: "Assessments" as const,
    accountId: "tc1-acct-operating",
    amountCents: DUES,
    status: "cleared" as const,
    matchedBy: "auto" as const,
  },
  {
    id: "tc1-le-insurance",
    date: "2026-11-02",
    description: "Evergreen Insurance Group, annual liability premium",
    counterparty: "Evergreen Insurance Group",
    category: "Insurance" as const,
    accountId: "tc1-acct-operating",
    amountCents: -420_00,
    status: "cleared" as const,
    matchedBy: "auto" as const,
  },
  {
    id: "tc1-le-review",
    date: "2027-02-19",
    description: "Unrecognized debit",
    counterparty: "WAFD MISC DR",
    category: "Repairs & maintenance" as const,
    accountId: "tc1-acct-operating",
    amountCents: -18_00,
    status: "needs-review" as const,
    suggestionConfidence: 0.28,
  },
].sort((a, b) => (a.date < b.date ? 1 : -1));

const openingBalance = ledger.reduce((sum, e) => (e.status === "cleared" ? sum + e.amountCents : sum), 0);

const owners: Owner[] = [
    {
      id: "tc1-own-1",
      displayName: "Priya Venkatesan",
      members: ["Priya Venkatesan"],
      email: "priya.v@example.com",
      phone: "(425) 555-0201",
      unit: "1",
      address: "12 Alder Court",
      moveInDate: "2019-04-12",
      balanceCents: 0,
      autopay: true,
      autopayMethod: "ACH ••5512",
      standing: "current",
      daysPastDue: 0,
      boardRole: "President",
    },
    {
      id: "tc1-own-2",
      displayName: "Grant Holloway",
      members: ["Grant Holloway"],
      email: "g.holloway@example.com",
      phone: "(425) 555-0202",
      unit: "2",
      address: "14 Alder Court",
      moveInDate: "2020-08-03",
      balanceCents: 0,
      autopay: true,
      autopayMethod: "ACH ••7730",
      standing: "current",
      daysPastDue: 0,
      boardRole: "Treasurer",
    },
    {
      id: "tc1-own-3",
      displayName: "Marcus & Joy Henderson",
      members: ["Marcus Henderson", "Joy Henderson"],
      email: "hendersons@example.com",
      phone: "(425) 555-0203",
      unit: "3",
      address: "16 Alder Court",
      moveInDate: "2018-06-30",
      balanceCents: 0,
      autopay: false,
      standing: "current",
      daysPastDue: 0,
    },
    {
      id: "tc1-own-4",
      displayName: "Lena Okonkwo",
      members: ["Lena Okonkwo"],
      email: "l.okonkwo@example.com",
      phone: "(425) 555-0204",
      unit: "4",
      address: "18 Alder Court",
      moveInDate: "2023-02-17",
      balanceCents: 30_00,
      autopay: false,
      standing: "grace",
      daysPastDue: 6,
    },
    {
      id: "tc1-own-5",
      displayName: "Dmitri Sokolov",
      members: ["Dmitri Sokolov"],
      email: "d.sokolov@example.com",
      phone: "(425) 555-0205",
      unit: "5",
      address: "20 Alder Court",
      moveInDate: "2021-11-08",
      balanceCents: 0,
      autopay: true,
      autopayMethod: "ACH ••2094",
      standing: "current",
      daysPastDue: 0,
    },
];

export const testCommunityOne: Community = {
  id: "test-community-1",
  label: "Test Community #1",
  asOf: "2027-02-24",
  nextChargeDate: "2027-03-01",

  association: {
    id: "assoc-test-community-1",
    name: "Test Community #1",
    shortName: "Test Community #1",
    state: "WA",
    stateName: "Washington",
    unitCount: 5,
    fiscalYearStart: "January 1",
    duesCents: DUES,
    duesCadence: "monthly",
    addressLine: "Bothell, Washington",
    managedBy: "self",
  },

  settings: {
    displayName: "Test Community #1",
    photoUrl: "/community/test-community-1.jpg",
    photoCredit: "Unsplash",
    // Quarterly meetings and no events. A calendar here would be an empty grid
    // twelve months a year, which is worse than no calendar.
    homeLayout: "banner",
    banner: {
      enabled: true,
      title: "Quarterly meeting, March 12 at 6:30 PM",
      detail: "At the Hendersons'. Agenda: landscaping renewal and the 2027 budget.",
      updatedDate: "2027-02-20",
    },
    showFundsToResidents: true,
    showLiveVoteResults: false,
    autopayLateAfterDay: 10,
    forumEnabled: false,
    paymentFeeCents: 100,
    paymentFeePaidBy: "owner",
    // A $1 fee on a $30 assessment is 3.3%, worse than a card. Waived on the
    // cheap rail so the default path costs an owner nothing.
    paymentFeeWaivedOnAch: true,
  },

  owners,

  accounts: [
    {
      id: "tc1-acct-priya",
      ownerId: "tc1-own-1",
      name: "Priya Venkatesan",
      email: "priya.v@example.com",
      unit: "1",
      role: "president",
      capabilities: caps([...GRANTABLE], true),
    },
    {
      id: "tc1-acct-grant",
      ownerId: "tc1-own-2",
      name: "Grant Holloway",
      email: "g.holloway@example.com",
      unit: "2",
      role: "treasurer",
      capabilities: caps(["finances", "vendors", "requests", "documents", "compliance"]),
    },
    {
      id: "tc1-acct-marcus",
      ownerId: "tc1-own-3",
      name: "Marcus Henderson",
      email: "hendersons@example.com",
      unit: "3",
      role: "resident",
      capabilities: caps([]),
    },
    {
      id: "tc1-acct-lena",
      ownerId: "tc1-own-4",
      name: "Lena Okonkwo",
      email: "l.okonkwo@example.com",
      unit: "4",
      role: "resident",
      capabilities: caps([]),
    },
    {
      id: "tc1-acct-dmitri",
      ownerId: "tc1-own-5",
      name: "Dmitri Sokolov",
      email: "d.sokolov@example.com",
      unit: "5",
      role: "resident",
      capabilities: caps([]),
    },
  ],

  instruments: [
    {
      id: "tc1-pm-priya",
      ownerId: "tc1-own-1",
      kind: "ach",
      label: "WaFd checking",
      mask: "5512",
      institution: "WaFd Bank",
      accountType: "checking",
      isDefault: true,
      addedDate: "2026-08-26",
      token: "tok_ach_tc1_5512",
    },
    {
      id: "tc1-pm-grant",
      ownerId: "tc1-own-2",
      kind: "ach",
      label: "BECU checking",
      mask: "7730",
      institution: "BECU",
      accountType: "checking",
      isDefault: true,
      addedDate: "2026-08-27",
      token: "tok_ach_tc1_7730",
    },
    {
      id: "tc1-pm-marcus",
      ownerId: "tc1-own-3",
      kind: "card",
      label: "Visa",
      mask: "9921",
      brand: "visa",
      expMonth: 6,
      expYear: 2029,
      isDefault: true,
      addedDate: "2026-09-02",
      token: "tok_card_tc1_9921",
    },
    {
      id: "tc1-pm-dmitri",
      ownerId: "tc1-own-5",
      kind: "ach",
      label: "Chase checking",
      mask: "2094",
      institution: "Chase",
      accountType: "checking",
      isDefault: true,
      addedDate: "2026-08-29",
      token: "tok_ach_tc1_2094",
    },
  ],

  bankAccounts: [
    {
      id: "tc1-acct-operating",
      name: "Operating",
      institution: "WaFd Bank",
      mask: "8840",
      kind: "operating",
      balanceCents: openingBalance,
      syncedMinutesAgo: 12,
      status: "live",
      reconciledThroughDate: "2027-01-31",
      unreconciledCount: 1,
      apy: 0.01,
      interestYtdCents: 21,
      insuredLimitCents: 25_000_00 * 10,
    },
  ],

  budget: [
    { category: "Assessments", annualCents: 1_800_00, ytdActualCents: 330_00, kind: "income" },
    { category: "Late fees", annualCents: 30_00, ytdActualCents: 15_00, kind: "income" },
    { category: "Landscaping", annualCents: 1_200_00, ytdActualCents: 200_00, kind: "expense" },
    { category: "Insurance", annualCents: 420_00, ytdActualCents: 0, kind: "expense" },
    { category: "Management", annualCents: 240_00, ytdActualCents: 40_00, kind: "expense" },
    { category: "Repairs & maintenance", annualCents: 300_00, ytdActualCents: 0, kind: "expense" },
  ],
  // Two months into the 2027 fiscal year.
  yearElapsed: 2 / 12,

  // No reserve study yet. This is the finding, not an omission.
  reserveComponents: [],
  savingsOffers: [],
  bylaws: [],
  bylawAmendments: [],
  sharedCosts: [],
  sharedCostBills: [],
  specialAssessments: [],

  vendors: [
    {
      id: "tc1-v-lawn",
      name: "Bellevue Lawn & Garden",
      service: "Grounds and seasonal cleanup",
      achEnabled: true,
      w9OnFile: true,
      coiExpires: "2027-05-31",
      ytdPaidCents: 200_00,
      defaultCategory: "Landscaping",
    },
    {
      id: "tc1-v-insurance",
      name: "Evergreen Insurance Group",
      service: "General liability",
      achEnabled: true,
      w9OnFile: true,
      ytdPaidCents: 0,
      defaultCategory: "Insurance",
    },
  ],

  payouts: [
    {
      id: "tc1-po-feb",
      vendorId: "tc1-v-lawn",
      vendor: "Bellevue Lawn & Garden",
      invoiceNumber: "BLG-2027-02",
      amountCents: 100_00,
      method: "ach",
      status: "paid",
      issuedDate: "2027-02-14",
      expectedDate: "2027-02-16",
      approvals: [{ name: "Grant Holloway", at: "2027-02-13" }],
      approvalsRequired: 1,
    },
    {
      id: "tc1-po-mar",
      vendorId: "tc1-v-lawn",
      vendor: "Bellevue Lawn & Garden",
      invoiceNumber: "BLG-2027-03",
      amountCents: 100_00,
      method: "ach",
      status: "scheduled",
      issuedDate: "2027-03-14",
      expectedDate: "2027-03-16",
      approvals: [{ name: "Grant Holloway", at: "2027-02-20" }],
      approvalsRequired: 1,
    },
  ],

  requests: [
    {
      id: "tc1-req-1",
      reference: "REQ-2027-002",
      kind: "architectural",
      title: "Replace the front door and repaint the trim",
      summary: "Same color as the existing trim. Contractor quote attached.",
      ownerId: "tc1-own-5",
      ownerName: "Dmitri Sokolov",
      unit: "5",
      status: "in-review",
      submittedDate: "2027-02-16",
      dueDate: "2027-03-18",
      dueReason: "CC&Rs Art. IV: the board answers within 30 days",
      attachments: [{ name: "door-quote.pdf", size: "180 KB" }],
      thread: [
        {
          id: "tc1-rt-1",
          at: "2027-02-16",
          actor: "Dmitri Sokolov",
          actorRole: "resident",
          body: "Existing door is warped and does not seal. Quote attached, same color as the trim.",
          kind: "note",
        },
      ],
    },
    {
      id: "tc1-req-2",
      reference: "REQ-2026-001",
      kind: "maintenance",
      title: "Streetlight out at the Alder Court entrance",
      summary: "Reported to the city, who confirmed it is on their pole.",
      ownerId: "tc1-own-3",
      ownerName: "Marcus & Joy Henderson",
      unit: "3",
      status: "closed",
      submittedDate: "2026-10-21",
      decisionDate: "2026-11-04",
      decidedBy: "Priya Venkatesan",
      attachments: [],
      thread: [
        {
          id: "tc1-rt-2",
          at: "2026-11-04",
          actor: "Priya Venkatesan",
          actorRole: "board",
          body: "City confirmed it is their pole and replaced the fixture. Closing this out.",
          kind: "status",
        },
      ],
    },
  ],

  violations: [],

  documents: [
    { id: "tc1-doc-1", name: "Declaration of Covenants, Conditions & Restrictions", category: "Governing", updatedDate: "2015-03-02", size: "1.4 MB", visibility: "public", requiredBy: "RCW 64.38, association records", fileType: "pdf" },
    { id: "tc1-doc-2", name: "Bylaws", category: "Governing", updatedDate: "2015-03-02", size: "620 KB", visibility: "public", requiredBy: "RCW 64.38, association records", fileType: "pdf" },
    { id: "tc1-doc-3", name: "Articles of Incorporation", category: "Governing", updatedDate: "2015-02-18", size: "210 KB", visibility: "public", requiredBy: "RCW 64.38, association records", fileType: "pdf" },
    { id: "tc1-doc-4", name: "Rules & Regulations", category: "Governing", updatedDate: "2026-09-15", size: "180 KB", visibility: "public", fileType: "pdf" },
    { id: "tc1-doc-5", name: "Building schematics, units 1 to 5", category: "Plans", updatedDate: "2026-08-30", size: "8.4 MB", visibility: "members", fileType: "pdf" },
    { id: "tc1-doc-6", name: "Plat map and recorded survey", category: "Plans", updatedDate: "2026-08-30", size: "3.1 MB", visibility: "public", fileType: "pdf" },
    { id: "tc1-doc-7", name: "As-built drawings, shared drainage", category: "Plans", updatedDate: "2026-08-30", size: "2.6 MB", visibility: "members", fileType: "pdf" },
    { id: "tc1-doc-8", name: "2027 Adopted Operating Budget", category: "Financial", updatedDate: "2026-11-19", size: "96 KB", visibility: "public", requiredBy: "RCW 64.38, budget ratification", fileType: "pdf" },
    { id: "tc1-doc-9", name: "FY2026 Annual Financial Statement", category: "Financial", updatedDate: "2027-01-24", size: "142 KB", visibility: "members", requiredBy: "RCW 64.38, financial statements", fileType: "pdf" },
    { id: "tc1-doc-10", name: "Quarterly Meeting Minutes, December 11 2026", category: "Meetings", updatedDate: "2026-12-18", size: "88 KB", visibility: "public", fileType: "pdf" },
    { id: "tc1-doc-11", name: "Quarterly Meeting Minutes, September 18 2026", category: "Meetings", updatedDate: "2026-09-25", size: "84 KB", visibility: "public", fileType: "pdf" },
    { id: "tc1-doc-12", name: "Certificate of Insurance, Evergreen Group", category: "Insurance", updatedDate: "2026-11-02", size: "310 KB", visibility: "members", fileType: "pdf" },
    { id: "tc1-doc-13", name: "Vendor contract, Bellevue Lawn & Garden", category: "Insurance", updatedDate: "2026-08-30", size: "240 KB", visibility: "board", fileType: "pdf" },
    { id: "tc1-doc-14", name: "Welcome packet and parking rules", category: "Notices", updatedDate: "2026-09-01", size: "420 KB", visibility: "public", fileType: "pdf" },
    { id: "tc1-doc-15", name: "Emergency contact list", category: "Notices", updatedDate: "2026-09-01", size: "40 KB", visibility: "members", fileType: "pdf" },
    { id: "tc1-doc-16", name: "Architectural Change Request form", category: "Forms", updatedDate: "2026-09-01", size: "72 KB", visibility: "public", fileType: "pdf" },
  ],

  complianceItems: [
    {
      id: "tc1-cmp-reserve",
      title: "Reserve study, never commissioned",
      citation: "RCW 64.38, reserve study provisions",
      jurisdiction: "Washington",
      summary:
        "Washington expects a reserve study with a funding disclosure in the annual budget. This association has never had one, and currently transfers nothing to reserves.",
      evidence:
        "No study on file. The 2027 budget allocates $0 to reserves against a projected surplus of $360.",
      status: "overdue",
      dueDate: "2026-12-31",
      cadence: "Annually, full study on a longer cycle",
      owner: "Grant Holloway, Treasurer",
      actionLabel: "Open reserves",
      actionHref: "/admin/reserves",
    },
    {
      id: "tc1-cmp-annual-report",
      title: "Nonprofit corporation annual report",
      citation: "RCW 24.03A, Washington Secretary of State",
      jurisdiction: "Washington",
      summary:
        "The association is a nonprofit corporation and files an annual report to stay in good standing.",
      evidence: "Filed February 6, 2027. Next due February 2028.",
      status: "compliant",
      dueDate: "2028-02-28",
      cadence: "Annually",
      owner: "Priya Venkatesan, President",
      completedDate: "2027-02-06",
    },
    {
      id: "tc1-cmp-budget",
      title: "Budget summary and ratification meeting",
      citation: "RCW 64.38, budget adoption and ratification",
      jurisdiction: "Washington",
      summary:
        "The board adopts a budget, delivers a summary to every owner, and sets a ratification meeting.",
      evidence: "2027 budget adopted and delivered November 19, 2026. Ratified at the December meeting.",
      status: "compliant",
      cadence: "Annually",
      owner: "Grant Holloway, Treasurer",
      completedDate: "2026-11-19",
    },
    {
      id: "tc1-cmp-records",
      title: "Records available to owners on request",
      citation: "RCW 64.38, association records",
      jurisdiction: "Washington",
      summary:
        "The statute asks for records within a reasonable time. No written response policy has been adopted yet.",
      evidence: "No requests received to date. No policy adopted.",
      status: "in-progress",
      dueDate: "2027-03-12",
      cadence: "Per request",
      owner: "Priya Venkatesan, President",
    },
  ],

  meetings: [
    {
      id: "tc1-mtg-q1",
      title: "Quarterly meeting, Q1 2027",
      date: "2027-03-12",
      time: "6:30 PM",
      status: "scheduled",
      kind: "board",
      location: "12 Alder Court and video call",
      dialIn: "(425) 555-0110",
      passcode: "704 221",
      attendees: [],
      agenda: [
        "Approve December minutes",
        "Landscaping contract renewal",
        "Reserve study: get a quote",
        "Unit 5 architectural request",
      ],
      ballotIds: ["tc1-bal-lawn"],
      noticeSentDate: "2027-02-20",
    },
    {
      id: "tc1-mtg-q4",
      title: "Quarterly meeting, Q4 2026",
      date: "2026-12-11",
      time: "6:30 PM",
      status: "ended",
      kind: "board",
      location: "14 Alder Court",
      dialIn: "(425) 555-0110",
      passcode: "551 903",
      attendees: [],
      agenda: ["2027 budget ratification", "Landscaper performance", "Owner forum"],
      ballotIds: [],
      noticeSentDate: "2026-11-19",
    },
  ],

  ballots: [
    {
      id: "tc1-bal-lawn",
      reference: "BAL-2027-01",
      title: "Renew the landscaping contract for another year at $100 a month",
      body: [
        "Bellevue Lawn & Garden has held the grounds contract since August at $100 a month, which is $1,200 a year against a $1,800 budget.",
        "One competing quote came in at $135. Renewing keeps the rate flat through 2027.",
      ],
      kind: "special-assessment",
      audience: "owners",
      status: "open",
      opensDate: "2027-02-20",
      closesDate: "2027-03-12",
      eligible: 5,
      quorumRequired: 3,
      thresholdLabel: "Majority of votes cast",
      options: [
        { id: "tc1-opt-renew", label: "Renew at $100", votes: 2 },
        { id: "tc1-opt-rebid", label: "Put it out to bid again", votes: 0 },
      ],
      meetingId: "tc1-mtg-q1",
      liveResultsVisible: false,
    },
  ],

  threads: [
    {
      id: "tc1-th-1",
      subject: "December assessment, running a week behind",
      participants: ["Marcus Henderson", "Grant Holloway"],
      ownerId: "tc1-own-3",
      unit: "3",
      updatedDate: "2027-01-09",
      unread: false,
      tag: "Billing",
      messages: [
        {
          id: "tc1-m-1",
          at: "2027-01-05",
          from: "Grant Holloway",
          fromRole: "board",
          direction: "outbound",
          channel: "email",
          body: "December is showing unpaid. No rush, just flagging it before the late fee applies on the 10th.",
        },
        {
          id: "tc1-m-2",
          at: "2027-01-09",
          from: "Marcus Henderson",
          fromRole: "resident",
          direction: "inbound",
          channel: "email",
          body: "Card on file expired over the holidays. Updated and paid, sorry for the noise.",
        },
      ],
    },
  ],

  announcements: [
    {
      id: "tc1-ann-1",
      title: "Quarterly meeting is March 12",
      body: "6:30 at the Hendersons'. On the agenda: renewing the landscaping contract, getting a reserve study quote, and unit 5's door request. Dial in if you cannot make it.",
      postedDate: "2027-02-20",
      author: "Priya Venkatesan, President",
      pinned: true,
      category: "Governance",
    },
    {
      id: "tc1-ann-2",
      title: "Spring cleanup is included in the grounds contract",
      body: "Bellevue Lawn & Garden handles the beds and the shared drainage swale in March at no extra charge. If something in your own yard is draining badly, tell them while they are here.",
      postedDate: "2027-02-11",
      author: "Grant Holloway, Treasurer",
      category: "Maintenance",
    },
  ],

  posts: [],

  // No shared amenities.
  amenities: [],
  amenityStatus: [],

  forms: [
    {
      id: "tc1-form-arch",
      label: "Architectural change request",
      description: "Exterior changes, including doors, paint, and anything visible from the street",
      fileName: "architectural-change-request.pdf",
      size: "72 KB",
      source: "baseline",
      updatedDate: "2026-09-01",
    },
    {
      id: "tc1-form-paint",
      label: "Exterior paint color request",
      description: "Approved palette and the sample requirement",
      fileName: "exterior-paint-request.pdf",
      size: "180 KB",
      source: "baseline",
      updatedDate: "2026-09-01",
    },
  ],

  templates: [
    {
      id: "tc1-tpl-past-due",
      name: "Friendly reminder",
      description: "First contact. Assumes it was an oversight, because in a five home association it usually was.",
      trigger: "past-due",
      subject: "{{association}}: assessment reminder for unit {{unit}}",
      body: `Hello {{owner}},

Our records show {{balance}} outstanding on unit {{unit}}, {{days_past_due}} days past due. If you have already paid, thank you and please ignore this.

You can pay at {{portal_link}}. Bank transfer is free to you.

The {{association}} Board`,
      updatedDate: "2026-09-01",
    },
  ],

  ownerCharges: buildOwnerLedgers(owners, {
    assessmentCents: DUES,
    nextChargeDate: "2027-03-01",
    handWritten: {
      "tc1-own-4": [
      { id: "tc1-ch-3", date: "2027-03-01", label: "March assessment", kind: "charge", amountCents: DUES, balanceAfterCents: DUES },
      { id: "tc1-ch-2", date: "2027-02-02", label: "ACH payment", kind: "payment", amountCents: -DUES, balanceAfterCents: 0, method: "ACH ••4417", feeCents: 35, feePaidBy: "association", appliedTo: [{ chargeId: "tc1-ch-1", label: "February assessment", amountCents: DUES }] },
      { id: "tc1-ch-1", date: "2027-02-01", label: "February assessment", kind: "charge", amountCents: DUES, balanceAfterCents: DUES },
      ],
    },
  }),

  ledger,
};
