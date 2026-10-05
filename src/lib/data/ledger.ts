import type { ChargeLine, LedgerEntry, PaymentMethod, Payout, Vendor } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Association ledger. Newest first.                                           */
/*                                                                             */
/* May through August 2026 are written by hand: the association's first four   */
/* months on the platform, with the review queue, the duplicate and the        */
/* pending check that the screens and tests lean on. Everything before that,   */
/* January 2024 through April 2026, is the imported history, built from a      */
/* monthly template at the bottom of this file so a year comparison has two    */
/* full years to compare.                                                      */
/* -------------------------------------------------------------------------- */

const recentEntries: LedgerEntry[] = [
  {
    id: "le-140",
    date: "2026-08-20",
    description: "Assessment payments, batch (14 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 399_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-139",
    date: "2026-08-19",
    description: "Cascade Grounds, August grounds contract",
    counterparty: "Cascade Grounds Co.",
    category: "Landscaping",
    accountId: "acct-operating",
    amountCents: -285_000,
    status: "cleared",
    matchedBy: "auto",
    payoutId: "po-2",
  },
  {
    id: "le-138",
    date: "2026-08-19",
    description: "Snohomish PUD common area electric",
    counterparty: "Snohomish County PUD",
    category: "Utilities",
    accountId: "acct-operating",
    amountCents: -118_240,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-137",
    date: "2026-08-18",
    description: "Card fee pass-through, August",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: -4_120,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-136",
    date: "2026-08-17",
    description: "Northsound Pool Service, monthly maintenance",
    counterparty: "Northsound Pool Service",
    category: "Repairs & maintenance",
    accountId: "acct-operating",
    amountCents: -64_500,
    status: "cleared",
    matchedBy: "auto",
    payoutId: "po-3",
  },
  {
    id: "le-135",
    date: "2026-08-15",
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-operating",
    amountCents: -612_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-134",
    date: "2026-08-15",
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-reserve",
    amountCents: 612_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-133",
    date: "2026-08-14",
    description: "Assessment payments, batch (31 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 883_500,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-132",
    date: "2026-08-13",
    description: "Evergreen Insurance property & liability, installment 8/12",
    counterparty: "Evergreen Insurance Group",
    category: "Insurance",
    accountId: "acct-operating",
    amountCents: -742_300,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-131",
    date: "2026-08-12",
    description: "Deposit, BECU branch",
    counterparty: "BECU",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 57_000,
    status: "needs-review",
    suggestedCategory: "Assessments",
    suggestionConfidence: 0.72,
  },
  {
    id: "le-130",
    date: "2026-08-11",
    description: "Ace Gate & Access, north gate motor call-out",
    counterparty: "Ace Gate & Access",
    category: "Repairs & maintenance",
    accountId: "acct-operating",
    amountCents: -138_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-129",
    date: "2026-08-10",
    description: "Ace Gate & Access, north gate motor call-out",
    counterparty: "Ace Gate & Access",
    category: "Repairs & maintenance",
    accountId: "acct-operating",
    amountCents: -138_000,
    status: "needs-review",
    duplicateOfId: "le-130",
  },
  {
    id: "le-128",
    date: "2026-08-08",
    description: "Late fee assessed, 3 accounts",
    counterparty: "Willow Creek Estates",
    category: "Late fees",
    accountId: "acct-operating",
    amountCents: 7_500,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-127",
    date: "2026-08-07",
    description: "Kestrel & Boyd LLP, CC&R amendment review",
    counterparty: "Kestrel & Boyd LLP",
    category: "Legal & professional",
    accountId: "acct-operating",
    amountCents: -195_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-126",
    date: "2026-08-05",
    description: "Assessment payments, autopay batch (38 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 1_083_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-125",
    date: "2026-08-04",
    description: "Alderwood Water District water & sewer, common areas",
    counterparty: "Alderwood Water & Wastewater District",
    category: "Utilities",
    accountId: "acct-operating",
    amountCents: -96_780,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-124",
    date: "2026-08-03",
    description: "Cedar River Pest Control, quarterly service",
    counterparty: "Cedar River Pest Control",
    category: "Repairs & maintenance",
    accountId: "acct-operating",
    amountCents: -47_500,
    status: "pending",
    matchedBy: "manual",
    payoutId: "po-4",
  },
  {
    id: "le-123",
    date: "2026-08-01",
    description: "Interest, reserve CD",
    counterparty: "Coastal Community Bank",
    category: "Interest income",
    accountId: "acct-cd",
    amountCents: 53_125,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-122",
    date: "2026-08-01",
    description: "Interest, reserve savings",
    counterparty: "BECU",
    category: "Interest income",
    accountId: "acct-reserve",
    amountCents: 41_286,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-121",
    date: "2026-07-31",
    description: "Unrecognized ACH debit",
    counterparty: "BECU MISC DR",
    category: "Repairs & maintenance",
    accountId: "acct-operating",
    amountCents: -3_200,
    status: "needs-review",
    suggestionConfidence: 0.31,
  },

  /* ------------------------------------------------------------------------
     May through July, the association's first months on the platform. All
     cleared: the review queue is an August problem. The months rhyme rather
     than repeat, because a chart of four identical months reads as fake.
  ------------------------------------------------------------------------ */
  {
    id: "le-120",
    date: "2026-07-28",
    description: "Card fee pass-through, July",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: -3_980,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-119",
    date: "2026-07-24",
    description: "Summit Roofing, clubhouse gutter repair",
    counterparty: "Summit Roofing",
    category: "Repairs & maintenance",
    accountId: "acct-operating",
    amountCents: -89_400,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-118",
    date: "2026-07-21",
    description: "Assessment payments, batch (12 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 342_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-117",
    date: "2026-07-20",
    description: "Snohomish PUD common area electric",
    counterparty: "Snohomish County PUD",
    category: "Utilities",
    accountId: "acct-operating",
    amountCents: -124_860,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-116",
    date: "2026-07-19",
    description: "Cascade Grounds, July grounds contract",
    counterparty: "Cascade Grounds Co.",
    category: "Landscaping",
    accountId: "acct-operating",
    amountCents: -285_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-115",
    date: "2026-07-17",
    description: "Northsound Pool Service, monthly maintenance",
    counterparty: "Northsound Pool Service",
    category: "Repairs & maintenance",
    accountId: "acct-operating",
    amountCents: -64_500,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-114",
    date: "2026-07-15",
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-operating",
    amountCents: -612_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-113",
    date: "2026-07-15",
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-reserve",
    amountCents: 612_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-112",
    date: "2026-07-14",
    description: "Assessment payments, batch (33 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 940_500,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-111",
    date: "2026-07-13",
    description: "Evergreen Insurance property & liability, installment 7/12",
    counterparty: "Evergreen Insurance Group",
    category: "Insurance",
    accountId: "acct-operating",
    amountCents: -742_300,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-110",
    date: "2026-07-08",
    description: "Late fee assessed, 2 accounts",
    counterparty: "Willow Creek Estates",
    category: "Late fees",
    accountId: "acct-operating",
    amountCents: 5_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-109",
    date: "2026-07-06",
    description: "Alderwood Water District water & sewer, common areas",
    counterparty: "Alderwood Water & Wastewater District",
    category: "Utilities",
    accountId: "acct-operating",
    amountCents: -101_340,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-108",
    date: "2026-07-05",
    description: "Assessment payments, autopay batch (38 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 1_083_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-107",
    date: "2026-07-01",
    description: "Interest, reserve CD",
    counterparty: "Coastal Community Bank",
    category: "Interest income",
    accountId: "acct-cd",
    amountCents: 53_125,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-106",
    date: "2026-07-01",
    description: "Interest, reserve savings",
    counterparty: "BECU",
    category: "Interest income",
    accountId: "acct-reserve",
    amountCents: 40_912,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-105",
    date: "2026-06-27",
    description: "Card fee pass-through, June",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: -4_310,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-104",
    date: "2026-06-25",
    description: "WaterWorks Irrigation, main line valve replacement",
    counterparty: "WaterWorks Irrigation",
    category: "Repairs & maintenance",
    accountId: "acct-operating",
    amountCents: -156_200,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-103",
    date: "2026-06-23",
    description: "Assessment payments, batch (13 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 370_500,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-102",
    date: "2026-06-20",
    description: "Snohomish PUD common area electric",
    counterparty: "Snohomish County PUD",
    category: "Utilities",
    accountId: "acct-operating",
    amountCents: -98_120,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-101",
    date: "2026-06-19",
    description: "Cascade Grounds, June grounds contract",
    counterparty: "Cascade Grounds Co.",
    category: "Landscaping",
    accountId: "acct-operating",
    amountCents: -285_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-100",
    date: "2026-06-16",
    description: "Northsound Pool Service, season opening service",
    counterparty: "Northsound Pool Service",
    category: "Repairs & maintenance",
    accountId: "acct-operating",
    amountCents: -84_900,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-099",
    date: "2026-06-15",
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-operating",
    amountCents: -612_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-098",
    date: "2026-06-15",
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-reserve",
    amountCents: 612_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-097",
    date: "2026-06-14",
    description: "Assessment payments, batch (30 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 855_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-096",
    date: "2026-06-13",
    description: "Evergreen Insurance property & liability, installment 6/12",
    counterparty: "Evergreen Insurance Group",
    category: "Insurance",
    accountId: "acct-operating",
    amountCents: -742_300,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-095",
    date: "2026-06-09",
    description: "Late fee assessed, 4 accounts",
    counterparty: "Willow Creek Estates",
    category: "Late fees",
    accountId: "acct-operating",
    amountCents: 10_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-094",
    date: "2026-06-06",
    description: "Alderwood Water District water & sewer, common areas",
    counterparty: "Alderwood Water & Wastewater District",
    category: "Utilities",
    accountId: "acct-operating",
    amountCents: -92_410,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-093",
    date: "2026-06-05",
    description: "Assessment payments, autopay batch (37 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 1_054_500,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-092",
    date: "2026-06-01",
    description: "Interest, reserve CD",
    counterparty: "Coastal Community Bank",
    category: "Interest income",
    accountId: "acct-cd",
    amountCents: 53_125,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-091",
    date: "2026-06-01",
    description: "Interest, reserve savings",
    counterparty: "BECU",
    category: "Interest income",
    accountId: "acct-reserve",
    amountCents: 39_748,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-090",
    date: "2026-05-28",
    description: "Card fee pass-through, May",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: -3_410,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-089",
    date: "2026-05-26",
    description: "Kestrel & Boyd LLP, records request review",
    counterparty: "Kestrel & Boyd LLP",
    category: "Legal & professional",
    accountId: "acct-operating",
    amountCents: -45_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-088",
    date: "2026-05-22",
    description: "Assessment payments, batch (15 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 427_500,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-087",
    date: "2026-05-20",
    description: "Snohomish PUD common area electric",
    counterparty: "Snohomish County PUD",
    category: "Utilities",
    accountId: "acct-operating",
    amountCents: -91_530,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-086",
    date: "2026-05-19",
    description: "Cascade Grounds, May grounds contract",
    counterparty: "Cascade Grounds Co.",
    category: "Landscaping",
    accountId: "acct-operating",
    amountCents: -285_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-085",
    date: "2026-05-15",
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-operating",
    amountCents: -612_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-084",
    date: "2026-05-15",
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-reserve",
    amountCents: 612_000,
    status: "cleared",
    matchedBy: "manual",
  },
  {
    id: "le-083",
    date: "2026-05-14",
    description: "Assessment payments, batch (29 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 826_500,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-082",
    date: "2026-05-13",
    description: "Evergreen Insurance property & liability, installment 5/12",
    counterparty: "Evergreen Insurance Group",
    category: "Insurance",
    accountId: "acct-operating",
    amountCents: -742_300,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-081",
    date: "2026-05-05",
    description: "Assessment payments, autopay batch (36 owners)",
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    accountId: "acct-operating",
    amountCents: 1_026_000,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-080",
    date: "2026-05-01",
    description: "Interest, reserve CD",
    counterparty: "Coastal Community Bank",
    category: "Interest income",
    accountId: "acct-cd",
    amountCents: 53_125,
    status: "cleared",
    matchedBy: "auto",
  },
  {
    id: "le-079",
    date: "2026-05-01",
    description: "Interest, reserve savings",
    counterparty: "BECU",
    category: "Interest income",
    accountId: "acct-reserve",
    amountCents: 38_660,
    status: "cleared",
    matchedBy: "auto",
  },
];

/* -------------------------------------------------------------------------- */
/* Imported history, January 2024 through April 2026.                          */
/*                                                                             */
/* The same association, earlier. Same vendors, same dues batches on the same  */
/* days, the same paired reserve transfer on the 15th, so `monthlyFlows` and   */
/* `spendingByCategory` treat these rows exactly as they treat the hand        */
/* written ones. Built from a template rather than written out, because four   */
/* hundred literals drift the first time somebody edits one of them.           */
/*                                                                             */
/* Dues and the big contracts step up a little each year, so 2025 runs above   */
/* 2024 and 2026 is on pace above 2025: a comparison of identical years shows  */
/* nothing. Small deterministic wobble on the utility bills and batch counts   */
/* keeps twelve months from reading as one month twelve times.                 */
/* -------------------------------------------------------------------------- */

interface YearPlan {
  /** Monthly assessment per unit that year. */
  duesCents: number;
  /** One twelfth of the master policy premium. */
  insuranceCents: number;
  /** What the budget sent to reserves each month. */
  reserveCents: number;
  /** Utilities and small contracts, relative to 2026. */
  priceLevel: number;
  /** Households on autopay, which grew as the association nudged people on. */
  autopay: number;
}

const YEAR_PLAN: Record<number, YearPlan> = {
  2024: { duesCents: 26_500, insuranceCents: 668_100, reserveCents: 564_000, priceLevel: 0.91, autopay: 31 },
  2025: { duesCents: 27_500, insuranceCents: 705_900, reserveCents: 588_000, priceLevel: 0.96, autopay: 34 },
  2026: { duesCents: 28_500, insuranceCents: 742_300, reserveCents: 612_000, priceLevel: 1, autopay: 36 },
};

/** Common area electric, by month, at 2026 prices. Summer irrigation pumps show. */
const ELECTRIC_BY_MONTH = [
  104_200, 98_400, 92_100, 88_600, 91_530, 98_120,
  124_860, 118_240, 106_300, 96_700, 101_900, 108_500,
];
/** Water and sewer for the common areas, same shape, smaller swing. */
const WATER_BY_MONTH = [
  80_200, 79_400, 81_300, 84_900, 88_600, 92_410,
  101_340, 96_780, 90_200, 85_100, 81_700, 80_900,
];
/** Counsel bills quarterly. The third quarter carries the annual meeting prep. */
const LEGAL_BY_QUARTER = [120_000, 85_000, 210_000, 140_000];
const QUARTER_MONTHS = [2, 5, 8, 11];

/** The repairs that came up, in the order they came up. Blank months happen. */
const REPAIRS: ({ counterparty: string; description: string; cents: number } | null)[] = [
  { counterparty: "Ace Gate & Access", description: "Ace Gate & Access, south gate keypad", cents: 72_000 },
  null,
  { counterparty: "Summit Roofing", description: "Summit Roofing, clubhouse gutter repair", cents: 89_400 },
  { counterparty: "WaterWorks Irrigation", description: "WaterWorks Irrigation, backflow test and valve", cents: 61_500 },
  null,
  { counterparty: "Ace Gate & Access", description: "Ace Gate & Access, north gate motor", cents: 138_000 },
  null,
  { counterparty: "WaterWorks Irrigation", description: "WaterWorks Irrigation, main line repair", cents: 156_200 },
  { counterparty: "Summit Roofing", description: "Summit Roofing, mail kiosk roof", cents: 43_800 },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A stable fraction in [0, 1) from a string, so the same month always wobbles the same way. */
function unit(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

/** `cents` nudged up to `pct` either way, to whole dimes. */
function wobble(cents: number, key: string, pct: number): number {
  const factor = 1 + (unit(key) * 2 - 1) * pct;
  return Math.round((cents * factor) / 10) * 10;
}

function buildMonth(year: number, month: number): LedgerEntry[] {
  const plan = YEAR_PLAN[year];
  const mm = String(month + 1).padStart(2, "0");
  const day = (d: number) => `${year}-${mm}-${String(d).padStart(2, "0")}`;
  const key = (tag: string) => `${year}-${mm}-${tag}`;
  const monthIndex = (year - 2024) * 12 + month;
  const rows: Omit<LedgerEntry, "id">[] = [];
  const operating = (row: Omit<LedgerEntry, "id" | "accountId" | "status" | "matchedBy"> & { matchedBy?: "auto" | "manual" }) =>
    rows.push({ accountId: "acct-operating", status: "cleared", matchedBy: "auto", ...row });

  // Dues, in the same three batches the platform still pays out: autopay on
  // the 5th, the bulk of the rest mid month, the stragglers after the 20th.
  const autopay = plan.autopay + (unit(key("autopay")) < 0.4 ? 1 : 0);
  const mid = 29 + Math.floor(unit(key("mid")) * 5);
  const late = 11 + Math.floor(unit(key("late")) * 5);
  operating({
    date: day(5),
    description: `Assessment payments, autopay batch (${autopay} owners)`,
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    amountCents: autopay * plan.duesCents,
  });
  operating({
    date: day(14),
    description: `Assessment payments, batch (${mid} owners)`,
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    amountCents: mid * plan.duesCents,
  });
  operating({
    date: day(21 + Math.floor(unit(key("lateday")) * 3)),
    description: `Assessment payments, batch (${late} owners)`,
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    amountCents: late * plan.duesCents,
  });
  operating({
    date: day(27),
    description: `Card fee pass-through, ${MONTH_NAMES[month]}`,
    counterparty: "Your HOAsis Payments",
    category: "Assessments",
    amountCents: -wobble(3_800, key("cardfee"), 0.12),
  });
  const lateAccounts = 2 + Math.floor(unit(key("latefee")) * 3);
  operating({
    date: day(8),
    description: `Late fee assessed, ${lateAccounts} accounts`,
    counterparty: "Willow Creek Estates",
    category: "Late fees",
    amountCents: lateAccounts * 2_500,
    matchedBy: "manual",
  });

  // The contracts.
  operating({
    date: day(19),
    description: `Cascade Grounds, ${MONTH_NAMES[month]} grounds contract`,
    counterparty: "Cascade Grounds Co.",
    category: "Landscaping",
    amountCents: -Math.round((285_000 * (0.88 + 0.06 * (year - 2024))) / 100) * 100,
  });
  operating({
    date: day(13),
    description: `Evergreen Insurance property & liability, installment ${month + 1}/12`,
    counterparty: "Evergreen Insurance Group",
    category: "Insurance",
    amountCents: -plan.insuranceCents,
  });
  operating({
    date: day(20),
    description: "Snohomish PUD common area electric",
    counterparty: "Snohomish County PUD",
    category: "Utilities",
    amountCents: -wobble(ELECTRIC_BY_MONTH[month] * plan.priceLevel, key("pud"), 0.03),
  });
  operating({
    date: day(6),
    description: "Alderwood Water District water & sewer, common areas",
    counterparty: "Alderwood Water & Wastewater District",
    category: "Utilities",
    amountCents: -wobble(WATER_BY_MONTH[month] * plan.priceLevel, key("water"), 0.03),
  });

  // The pool runs June through October.
  if (month >= 5 && month <= 9) {
    const service = Math.round((64_500 * plan.priceLevel) / 100) * 100;
    operating({
      date: day(17),
      description:
        month === 5
          ? "Northsound Pool Service, season opening service"
          : month === 9
            ? "Northsound Pool Service, season closing service"
            : "Northsound Pool Service, monthly maintenance",
      counterparty: "Northsound Pool Service",
      category: "Repairs & maintenance",
      amountCents: -(month === 5 ? service + 20_400 : month === 9 ? service - 12_500 : service),
    });
  }

  // Quarterly: counsel and pest control.
  const quarter = QUARTER_MONTHS.indexOf(month + 1);
  if (quarter >= 0) {
    operating({
      date: day(7),
      description: `Kestrel & Boyd LLP, quarterly retainer and ${["annual filing", "records requests", "annual meeting prep", "covenant review"][quarter]}`,
      counterparty: "Kestrel & Boyd LLP",
      category: "Legal & professional",
      amountCents: -Math.round((LEGAL_BY_QUARTER[quarter] * (1 + 0.06 * (year - 2024))) / 100) * 100,
    });
    operating({
      date: day(3),
      description: "Cedar River Pest Control, quarterly service",
      counterparty: "Cedar River Pest Control",
      category: "Repairs & maintenance",
      amountCents: -[45_000, 46_200, 47_500][year - 2024],
      matchedBy: "manual",
    });
  }

  // Whatever broke that month.
  const repair = REPAIRS[monthIndex % REPAIRS.length];
  if (repair) {
    operating({
      date: day(10 + Math.floor(unit(key("repairday")) * 14)),
      description: repair.description,
      counterparty: repair.counterparty,
      category: "Repairs & maintenance",
      amountCents: -wobble(repair.cents * plan.priceLevel, key("repair"), 0.05),
    });
  }

  // Reserve funding on the 15th, both sides, so the transfer nets to nothing.
  rows.push({
    date: day(15),
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-operating",
    amountCents: -plan.reserveCents,
    status: "cleared",
    matchedBy: "manual",
  });
  rows.push({
    date: day(15),
    description: "Reserve transfer, monthly funding",
    counterparty: "Internal transfer",
    category: "Reserve transfer",
    accountId: "acct-reserve",
    amountCents: plan.reserveCents,
    status: "cleared",
    matchedBy: "manual",
  });
  // Interest on the reserve savings, creeping up as the balance does.
  rows.push({
    date: day(1),
    description: "Interest, reserve savings",
    counterparty: "BECU",
    category: "Interest income",
    accountId: "acct-reserve",
    amountCents: 31_000 + monthIndex * 260,
    status: "cleared",
    matchedBy: "auto",
  });

  return rows
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((row, i) => ({ id: `le-h${year}${mm}-${String(i + 1).padStart(2, "0")}`, ...row }));
}

/** January 2024 through April 2026, newest first. */
export function buildLedgerHistory(): LedgerEntry[] {
  const months: { year: number; month: number }[] = [];
  for (let year = 2024; year <= 2026; year++) {
    for (let month = 0; month < 12; month++) {
      if (year === 2026 && month > 3) break;
      months.push({ year, month });
    }
  }
  return months.reverse().flatMap(({ year, month }) => buildMonth(year, month));
}

export const ledgerEntries: LedgerEntry[] = [...recentEntries, ...buildLedgerHistory()];

/* -------------------------------------------------------------------------- */
/* One owner's account history (Monish Naidu, unit 42)                   */
/* -------------------------------------------------------------------------- */

export const ownerCharges: ChargeLine[] = [
  {
    id: "ch-09",
    date: "2026-09-01",
    label: "September assessment",
    kind: "charge",
    amountCents: 28_500,
    balanceAfterCents: 28_500,
  },
  {
    id: "ch-08",
    date: "2026-08-03",
    label: "Bank payment",
    kind: "payment",
    amountCents: -28_500,
    balanceAfterCents: 0,
    method: "Bank ••2288",
    feeCents: 35,
    feePaidBy: "association",
    appliedTo: [{ chargeId: "ch-07", label: "August assessment", amountCents: 28_500 }],
  },
  {
    id: "ch-07",
    date: "2026-08-01",
    label: "August assessment",
    kind: "charge",
    amountCents: 28_500,
    balanceAfterCents: 28_500,
  },
  {
    id: "ch-06",
    date: "2026-07-09",
    label: "Card payment, Visa ••4402",
    kind: "payment",
    amountCents: -31_900,
    balanceAfterCents: 0,
    method: "Visa ••4402",
    feeCents: 955,
    feePaidBy: "association",
    appliedTo: [
      { chargeId: "ch-05", label: "July late fee", amountCents: 3_400 },
      { chargeId: "ch-04", label: "July assessment", amountCents: 28_500 },
    ],
  },
  {
    id: "ch-05",
    date: "2026-07-08",
    label: "July late fee",
    kind: "charge",
    amountCents: 3_400,
    balanceAfterCents: 31_900,
  },
  {
    id: "ch-04",
    date: "2026-07-01",
    label: "July assessment",
    kind: "charge",
    amountCents: 28_500,
    balanceAfterCents: 28_500,
  },
  {
    id: "ch-03",
    date: "2026-06-02",
    label: "Bank payment",
    kind: "payment",
    amountCents: -28_500,
    balanceAfterCents: 0,
    method: "Bank ••2288",
    feeCents: 35,
    feePaidBy: "association",
    appliedTo: [{ chargeId: "ch-02", label: "June assessment", amountCents: 28_500 }],
  },
  {
    id: "ch-02",
    date: "2026-06-01",
    label: "June assessment",
    kind: "charge",
    amountCents: 28_500,
    balanceAfterCents: 28_500,
  },
  {
    id: "ch-01",
    date: "2026-05-04",
    label: "Bank payment",
    kind: "payment",
    amountCents: -28_500,
    balanceAfterCents: 0,
    method: "Bank ••2288",
    feeCents: 35,
    feePaidBy: "association",
    appliedTo: [{ chargeId: "ch-00", label: "May assessment", amountCents: 28_500 }],
  },
  {
    id: "ch-00",
    date: "2026-05-01",
    label: "May assessment",
    kind: "charge",
    amountCents: 28_500,
    balanceAfterCents: 28_500,
  },
  {
    id: "ch-p04",
    date: "2026-04-04",
    label: "Bank payment",
    kind: "payment",
    amountCents: -28_500,
    balanceAfterCents: 0,
    method: "Bank ••2288",
    feeCents: 35,
    feePaidBy: "association",
    appliedTo: [{ chargeId: "ch-a04", label: "April assessment", amountCents: 28_500 }],
  },
  {
    id: "ch-a04",
    date: "2026-04-01",
    label: "April assessment",
    kind: "charge",
    amountCents: 28_500,
    balanceAfterCents: 28_500,
  },
  {
    id: "ch-p03",
    date: "2026-03-04",
    label: "Bank payment",
    kind: "payment",
    amountCents: -28_500,
    balanceAfterCents: 0,
    method: "Bank ••2288",
    feeCents: 35,
    feePaidBy: "association",
    appliedTo: [{ chargeId: "ch-a03", label: "March assessment", amountCents: 28_500 }],
  },
  {
    id: "ch-a03",
    date: "2026-03-01",
    label: "March assessment",
    kind: "charge",
    amountCents: 28_500,
    balanceAfterCents: 28_500,
  },
  {
    id: "ch-p02",
    date: "2026-02-04",
    label: "Bank payment",
    kind: "payment",
    amountCents: -28_500,
    balanceAfterCents: 0,
    method: "Bank ••2288",
    feeCents: 35,
    feePaidBy: "association",
    appliedTo: [{ chargeId: "ch-a02", label: "February assessment", amountCents: 28_500 }],
  },
  {
    id: "ch-a02",
    date: "2026-02-01",
    label: "February assessment",
    kind: "charge",
    amountCents: 28_500,
    balanceAfterCents: 28_500,
  },
  {
    id: "ch-p01",
    date: "2026-01-04",
    label: "Bank payment",
    kind: "payment",
    amountCents: -28_500,
    balanceAfterCents: 0,
    method: "Bank ••2288",
    feeCents: 35,
    feePaidBy: "association",
    appliedTo: [{ chargeId: "ch-a01", label: "January assessment", amountCents: 28_500 }],
  },
  {
    id: "ch-a01",
    date: "2026-01-01",
    label: "January assessment",
    kind: "charge",
    amountCents: 28_500,
    balanceAfterCents: 28_500,
  },
];

/* -------------------------------------------------------------------------- */
/* Payment methods. Every one quotes its real cost before you commit.          */
/* -------------------------------------------------------------------------- */

export const paymentMethods: PaymentMethod[] = [
  {
    id: "pm-ach",
    label: "BECU checking",
    kind: "ach",
    mask: "2288",
    feeCents: 35,
    feePercent: 0,
    isDefault: true,
  },
  {
    id: "pm-card",
    label: "Visa",
    kind: "card",
    mask: "4402",
    feeCents: 30,
    feePercent: 2.9,
    isDefault: false,
  },
  {
    id: "pm-apple",
    label: "Apple Pay",
    kind: "apple-pay",
    mask: "4402",
    feeCents: 30,
    feePercent: 2.9,
    isDefault: false,
  },
];

/* -------------------------------------------------------------------------- */
/* Vendors + payables                                                          */
/* -------------------------------------------------------------------------- */

export const vendors: Vendor[] = [
  {
    id: "v-gulfside",
    name: "Cascade Grounds Co.",
    service: "Grounds & irrigation",
    achEnabled: true,
    w9OnFile: true,
    coiExpires: "2027-01-31",
    ytdPaidCents: 2_280_000,
    defaultCategory: "Landscaping",
  },
  {
    id: "v-coastal",
    name: "Northsound Pool Service",
    service: "Pool maintenance",
    achEnabled: true,
    w9OnFile: true,
    coiExpires: "2026-10-15",
    ytdPaidCents: 516_000,
    defaultCategory: "Repairs & maintenance",
  },
  {
    id: "v-ace",
    name: "Ace Gate & Access",
    service: "Gates & access control",
    achEnabled: true,
    w9OnFile: true,
    coiExpires: "2026-09-04",
    ytdPaidCents: 412_000,
    defaultCategory: "Repairs & maintenance",
  },
  {
    id: "v-kestrel",
    name: "Kestrel & Boyd LLP",
    service: "Association counsel",
    achEnabled: true,
    w9OnFile: true,
    coiExpires: "2027-06-30",
    ytdPaidCents: 780_000,
    defaultCategory: "Legal & professional",
  },
  {
    id: "v-bayline",
    name: "Evergreen Insurance Group",
    service: "Property & liability",
    achEnabled: true,
    w9OnFile: true,
    ytdPaidCents: 5_938_400,
    defaultCategory: "Insurance",
  },
  {
    id: "v-sunbelt",
    name: "Cedar River Pest Control",
    service: "Pest control",
    achEnabled: false,
    w9OnFile: false,
    coiExpires: "2026-12-01",
    ytdPaidCents: 142_500,
    defaultCategory: "Repairs & maintenance",
  },
  {
    id: "v-marchetti",
    name: "Marchetti Resurfacing",
    service: "Pool deck resurfacing",
    achEnabled: true,
    w9OnFile: true,
    coiExpires: "2027-03-20",
    ytdPaidCents: 0,
    defaultCategory: "Repairs & maintenance",
  },
];

export const payouts: Payout[] = [
  {
    id: "po-1",
    vendorId: "v-marchetti",
    vendor: "Marchetti Resurfacing",
    invoiceNumber: "MR-2026-118",
    amountCents: 2_940_000,
    method: "ach",
    status: "needs-approval",
    issuedDate: "2026-08-20",
    expectedDate: "2026-08-22",
    approvals: [{ name: "Dana Whitcomb", at: "2026-08-20" }],
    approvalsRequired: 2,
  },
  {
    id: "po-2",
    vendorId: "v-gulfside",
    vendor: "Cascade Grounds Co.",
    invoiceNumber: "GL-8841",
    amountCents: 285_000,
    method: "ach",
    status: "paid",
    issuedDate: "2026-08-18",
    expectedDate: "2026-08-19",
    approvals: [
      { name: "Dana Whitcomb", at: "2026-08-17" },
      { name: "Arya Mehr", at: "2026-08-18" },
    ],
    approvalsRequired: 2,
  },
  {
    id: "po-3",
    vendorId: "v-coastal",
    vendor: "Northsound Pool Service",
    invoiceNumber: "CPS-3390",
    amountCents: 64_500,
    method: "ach",
    status: "paid",
    issuedDate: "2026-08-16",
    expectedDate: "2026-08-17",
    approvals: [
      { name: "Dana Whitcomb", at: "2026-08-15" },
      { name: "Sofia Bergman", at: "2026-08-16" },
    ],
    approvalsRequired: 2,
  },
  {
    id: "po-4",
    vendorId: "v-sunbelt",
    vendor: "Cedar River Pest Control",
    invoiceNumber: "SPC-771",
    amountCents: 47_500,
    method: "check",
    status: "in-transit",
    issuedDate: "2026-08-12",
    expectedDate: "2026-08-24",
    invoiceId: "inv-1",
    notes: "Quarterly perimeter treatment. Mailed a check; Cedar River is not on ACH yet.",
    approvals: [
      { name: "Dana Whitcomb", at: "2026-08-11" },
      { name: "Arya Mehr", at: "2026-08-12" },
    ],
    approvalsRequired: 2,
  },
  {
    id: "po-5",
    vendorId: "v-ace",
    vendor: "Ace Gate & Access",
    invoiceNumber: "AGA-2261",
    amountCents: 138_000,
    method: "ach",
    // Paid, because the bank says so: le-130 cleared on August 11. It sat
    // here a signature short and scheduled for the 24th, so the Vendors page
    // asked the board to approve money that had already left.
    status: "paid",
    issuedDate: "2026-08-10",
    expectedDate: "2026-08-11",
    approvals: [
      { name: "Dana Whitcomb", at: "2026-08-09" },
      { name: "Arya Mehr", at: "2026-08-10" },
    ],
    approvalsRequired: 2,
  },
];
