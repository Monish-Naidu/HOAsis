import type { Community } from "./community";
import {
  amenities as mmAmenityStatus,
  announcements as mmAnnouncements,
  association as mmAssociation,
  bankAccounts as mmBankAccounts,
  reserveComponents as mmReserveComponents,
  savingsOffers as mmSavingsOffers,
} from "./association";
import { accounts as mmAccounts } from "./accounts";
import { budget as mmBudget, YEAR_ELAPSED } from "./budget";
import {
  governingAmendments as mmGoverningAmendments,
  governingArticles as mmGoverning,
} from "./governing";
import { documents as mmDocuments } from "./documents";
import { forumPosts as mmPosts } from "./forum";
import { invoices as mmInvoices } from "./invoices";
import { ledgerEntries as mmLedger, homeCharges as mmCharges, payouts as mmPayouts, vendors as mmVendors } from "./ledger";
import { buildHomeLedgers } from "./owner-ledger";
import { createdCommunities } from "./created-communities";
import { threads as mmThreads } from "./messages";
import { homes as mmHomes } from "./owners";
import { paymentInstruments as mmInstruments } from "./payments";
import {
  requests as mmRequests,
  violationReports as mmViolationReports,
  violations as mmViolations,
} from "./requests";
import {
  architecturalForms as mmForms,
  communityAmenities as mmAmenities,
  communitySettings as mmSettings,
} from "./settings";
import {
  sharedCostBills as mmSharedCostBills,
  sharedCosts as mmSharedCosts,
  specialAssessments as mmAssessments,
} from "./shared-costs";
import { amenityBookings as mmBookings } from "./bookings";
import { actionItems as mmActionItems, joinRequests as mmJoinRequests } from "./board-items";
import { messageTemplates as mmTemplates } from "./templates";
import { ballots as mmBallots, meetings as mmMeetings } from "./voting";
import { testCommunityOne } from "./test-community-one";

/** Willow Creek Estates, the established 88 home association. */
export const mehrMeadows: Community = {
  id: "mehr-meadows",
  label: "Willow Creek Estates",
  asOf: "2026-08-20",
  nextChargeDate: "2026-09-01",
  association: mmAssociation,
  settings: mmSettings,
  homes: mmHomes,
  accounts: mmAccounts,
  instruments: mmInstruments,
  bankAccounts: mmBankAccounts,
  ledger: mmLedger,
  budget: mmBudget,
  yearElapsed: YEAR_ELAPSED,
  reserveComponents: mmReserveComponents,
  savingsOffers: mmSavingsOffers,
  sharedCosts: mmSharedCosts,
  sharedCostBills: mmSharedCostBills,
  specialAssessments: mmAssessments,
  vendors: mmVendors,
  payouts: mmPayouts,
  invoices: mmInvoices,
  requests: mmRequests,
  violations: mmViolations,
  violationReports: mmViolationReports,
  documents: mmDocuments,
  governingDocs: mmGoverning,
  governingAmendments: mmGoverningAmendments,
  meetings: mmMeetings,
  ballots: mmBallots,
  threads: mmThreads,
  announcements: mmAnnouncements,
  posts: mmPosts,
  amenities: mmAmenities,
  amenityBookings: mmBookings,
  joinRequests: mmJoinRequests,
  actionItems: mmActionItems,
  emailLog: [],
  amenityStatus: mmAmenityStatus,
  forms: mmForms,
  templates: mmTemplates,
  homeCharges: buildHomeLedgers(mmHomes, {
    assessmentCents: 28_500,
    nextChargeDate: "2026-09-01",
    // From January, so every month the books call billed has dues lines on
    // the statements to be summed.
    months: 9,
    handWritten: { "own-042": mmCharges },
  }),
};

/** The two that ship with the app. Anything else was built through onboarding. */
export const seededCommunities: Community[] = [mehrMeadows, testCommunityOne];

export const DEFAULT_COMMUNITY_ID = mehrMeadows.id;

/**
 * Every association this browser knows about, demos first.
 *
 * A function rather than a constant because created communities live in a
 * store, and a module-level array captured at import time would never see one.
 */
export function allCommunities(): Community[] {
  return [...seededCommunities, ...createdCommunities()];
}

export function communityById(id: string): Community {
  return allCommunities().find((c) => c.id === id) ?? mehrMeadows;
}
