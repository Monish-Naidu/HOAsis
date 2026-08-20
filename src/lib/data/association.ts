import type {
  Amenity,
  Announcement,
  Association,
  BankAccount,
  CommunityEvent,
  ReserveComponent,
  SavingsOffer,
} from "@/lib/types";

export const association: Association = {
  id: "assoc-cedar-hollow",
  name: "Cedar Hollow Community Association",
  shortName: "Cedar Hollow",
  state: "WA",
  stateName: "Washington",
  unitCount: 88,
  fiscalYearStart: "January 1",
  duesCents: 28_500,
  duesCadence: "monthly",
  addressLine: "Brier, Washington",
  managedBy: "self",
};

export const bankAccounts: BankAccount[] = [
  {
    id: "acct-operating",
    name: "Operating",
    institution: "BECU",
    mask: "4471",
    kind: "operating",
    balanceCents: 8_422_015,
    syncedMinutesAgo: 4,
    status: "live",
    reconciledThroughDate: "2026-07-31",
    unreconciledCount: 3,
    apy: 0.05,
    interestYtdCents: 2_240,
    insuredLimitCents: 25_000_000,
  },
  {
    id: "acct-reserve",
    name: "Reserve",
    institution: "BECU",
    mask: "7702",
    kind: "reserve",
    balanceCents: 41_286_000,
    syncedMinutesAgo: 4,
    status: "live",
    reconciledThroughDate: "2026-07-31",
    unreconciledCount: 0,
    apy: 1.2,
    interestYtdCents: 330_288,
    insuredLimitCents: 25_000_000,
  },
  {
    id: "acct-cd",
    name: "Reserve CD (12 mo)",
    institution: "Coastal Community Bank",
    mask: "1180",
    kind: "cd",
    balanceCents: 15_000_000,
    syncedMinutesAgo: 1_440,
    status: "delayed",
    reconciledThroughDate: "2026-07-31",
    unreconciledCount: 0,
    apy: 4.25,
    interestYtdCents: 425_000,
    insuredLimitCents: 25_000_000,
    maturityDate: "2027-02-01",
  },
];

/**
 * Where reserve cash could go instead. Rates are quoted as APY so the board is
 * comparing the same number across products.
 */
export const savingsOffers: SavingsOffer[] = [
  {
    id: "offer-sweep",
    name: "Insured cash sweep",
    institution: "HOAsis Reserve, via partner network",
    apy: 4.6,
    kind: "sweep",
    liquidity: "Same day, no penalty",
    insuranceNote: "Spread across member banks so the full balance stays inside coverage limits",
    minimumCents: 2_500_000,
    recommended: true,
  },
  {
    id: "offer-hysa",
    name: "High yield savings",
    institution: "BECU",
    apy: 3.85,
    kind: "savings",
    liquidity: "Same day, 6 withdrawals per month",
    insuranceNote: "NCUA insured to $250,000 at this institution only",
    minimumCents: 1_000_000,
  },
  {
    id: "offer-treasury",
    name: "Treasury ladder, 3 to 12 month",
    institution: "Coastal Community Bank",
    apy: 4.35,
    kind: "treasury",
    liquidity: "Rungs mature quarterly",
    insuranceNote: "Backed by the US Treasury rather than deposit insurance",
    minimumCents: 5_000_000,
  },
];

export const announcements: Announcement[] = [
  {
    id: "ann-1",
    title: "Pool resurfacing begins September 8",
    body: "The pool and deck close Monday September 8 for resurfacing and will reopen Friday September 19, weather permitting. The spa stays open the entire time. Gate codes are unchanged.",
    postedDate: "2026-08-18",
    author: "Arya Mehr, Board President",
    pinned: true,
    category: "Maintenance",
  },
  {
    id: "ann-2",
    title: "Budget workshop, September 3 at 6:30pm",
    body: "Open to all owners. We'll walk through the draft 2027 operating budget and the reserve funding plan line by line before the board votes in October. Come with questions.",
    postedDate: "2026-08-15",
    author: "Dana Whitcomb, Treasurer",
    category: "Governance",
  },
  {
    id: "ann-3",
    title: "Windstorm season: clear your deck before the first big one",
    body: "When a wind advisory goes up, stow patio furniture, planters, and grills. Anything left out becomes a projectile, and the association does not insure resident property. Snohomish County PUD outage alerts are worth turning on.",
    postedDate: "2026-08-11",
    author: "Cedar Hollow Board",
    category: "Notice",
  },
  {
    id: "ann-4",
    title: "New: pay dues from your phone with Apple Pay",
    body: "Autopay and one-time payments now work with Apple Pay and Google Pay. ACH stays free for you and costs the association $0.35, by far the cheapest way to pay.",
    postedDate: "2026-08-04",
    author: "Cedar Hollow Board",
    category: "Notice",
  },
];

export const events: CommunityEvent[] = [
  {
    id: "ev-1",
    title: "Budget workshop (open to owners)",
    date: "2026-09-03",
    time: "6:30 PM",
    location: "Clubhouse",
    kind: "meeting",
    agendaUrl: "#",
  },
  {
    id: "ev-2",
    title: "Pool closed for resurfacing",
    date: "2026-09-08",
    time: "All day",
    location: "Pool deck",
    kind: "maintenance",
  },
  {
    id: "ev-3",
    title: "Board meeting + architectural votes",
    date: "2026-09-16",
    time: "7:00 PM",
    location: "Clubhouse",
    kind: "meeting",
    agendaUrl: "#",
  },
  {
    id: "ev-4",
    title: "Fall community cookout",
    date: "2026-10-04",
    time: "12:00 PM",
    location: "Oak Green",
    kind: "social",
  },
];

export const amenities: Amenity[] = [
  { id: "am-1", name: "Pool", status: "open", detail: "Open until 10 PM · closes Sep 8" },
  { id: "am-2", name: "Clubhouse", status: "reserved", detail: "Reserved Sat 4–9 PM" },
  { id: "am-3", name: "Tennis court", status: "open", detail: "Open · no reservation needed" },
  { id: "am-4", name: "Fitness room", status: "open", detail: "Open 24h with fob" },
];

/**
 * The components a reserve study tracks, with remaining life and replacement cost.
 * Percent funded is derived, never stored, so the number can't drift.
 */
export const reserveComponents: ReserveComponent[] = [
  {
    id: "rc-roof",
    name: "Roofs, buildings A through D",
    usefulLifeYears: 25,
    remainingLifeYears: 7,
    replacementCostCents: 62_000_000,
    fundedCents: 21_700_000,
    lastInspection: "2025-03-14",
  },
  {
    id: "rc-paint",
    name: "Exterior paint & siding",
    usefulLifeYears: 8,
    remainingLifeYears: 2,
    replacementCostCents: 14_500_000,
    fundedCents: 9_800_000,
    lastInspection: "2024-11-02",
  },
  {
    id: "rc-pave",
    name: "Asphalt drives & lots",
    usefulLifeYears: 20,
    remainingLifeYears: 11,
    replacementCostCents: 18_800_000,
    fundedCents: 7_150_000,
  },
  {
    id: "rc-pool",
    name: "Pool deck & equipment",
    usefulLifeYears: 15,
    remainingLifeYears: 1,
    replacementCostCents: 8_400_000,
    fundedCents: 7_900_000,
    lastInspection: "2026-02-20",
    note: "Resurfacing scheduled Sep 8, draws against this component.",
  },
  {
    id: "rc-decks",
    name: "Decks & railings",
    usefulLifeYears: 30,
    remainingLifeYears: 13,
    replacementCostCents: 22_000_000,
    fundedCents: 4_100_000,
    lastInspection: "2026-01-09",
    note: "Inspection findings folded into the study.",
  },
  {
    id: "rc-fence",
    name: "Perimeter fence & gates",
    usefulLifeYears: 12,
    remainingLifeYears: 4,
    replacementCostCents: 6_200_000,
    fundedCents: 3_050_000,
  },
];
