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
import { complianceItems as mmCompliance } from "./compliance";
import { documents as mmDocuments } from "./documents";
import { forumPosts as mmPosts } from "./forum";
import { ledgerEntries as mmLedger, ownerCharges as mmCharges, payouts as mmPayouts, vendors as mmVendors } from "./ledger";
import { buildOwnerLedgers } from "./owner-ledger";
import { createdCommunities } from "./created-communities";
import { threads as mmThreads } from "./messages";
import { owners as mmOwners } from "./owners";
import { paymentInstruments as mmInstruments } from "./payments";
import { requests as mmRequests, violations as mmViolations } from "./requests";
import {
  architecturalForms as mmForms,
  communityAmenities as mmAmenities,
  communitySettings as mmSettings,
} from "./settings";
import { messageTemplates as mmTemplates } from "./templates";
import { ballots as mmBallots, meetings as mmMeetings } from "./voting";
import { testCommunityOne } from "./test-community-one";

/** Mehr Meadows, the established 88 home association. */
export const mehrMeadows: Community = {
  id: "mehr-meadows",
  label: "Mehr Meadows",
  asOf: "2026-08-20",
  nextChargeDate: "2026-09-01",
  association: mmAssociation,
  settings: mmSettings,
  owners: mmOwners,
  accounts: mmAccounts,
  instruments: mmInstruments,
  bankAccounts: mmBankAccounts,
  ledger: mmLedger,
  budget: mmBudget,
  yearElapsed: YEAR_ELAPSED,
  reserveComponents: mmReserveComponents,
  savingsOffers: mmSavingsOffers,
  vendors: mmVendors,
  payouts: mmPayouts,
  requests: mmRequests,
  violations: mmViolations,
  documents: mmDocuments,
  complianceItems: mmCompliance,
  meetings: mmMeetings,
  ballots: mmBallots,
  threads: mmThreads,
  announcements: mmAnnouncements,
  posts: mmPosts,
  amenities: mmAmenities,
  amenityStatus: mmAmenityStatus,
  forms: mmForms,
  templates: mmTemplates,
  ownerCharges: buildOwnerLedgers(mmOwners, {
    assessmentCents: 28_500,
    nextChargeDate: "2026-09-01",
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

/** True when this association was built through onboarding, not shipped. */
export function isCreatedCommunity(id: string): boolean {
  return !seededCommunities.some((c) => c.id === id);
}
