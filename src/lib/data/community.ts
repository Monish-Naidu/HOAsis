import type {
  Account,
  Amenity,
  Announcement,
  ArchitecturalForm,
  Association,
  Ballot,
  BankAccount,
  CommunityAmenity,
  CommunitySettings,
  ComplianceItem,
  DocumentRecord,
  ForumPost,
  HomeRequest,
  LedgerEntry,
  Meeting,
  MessageThread,
  Owner,
  Payout,
  ReserveComponent,
  SavingsOffer,
  Vendor,
  Violation,
} from "@/lib/types";
import type { BudgetLine } from "./budget";
import type { MessageTemplate } from "./templates";
import type { PaymentInstrument } from "@/lib/payments/instruments";

/**
 * One association's entire world.
 *
 * Everything that belongs to a community is grouped here rather than exported
 * as loose module-level arrays. That is what makes a second association
 * possible: the app asks for the active community and gets a complete,
 * self-consistent dataset, instead of every screen reaching for a singleton.
 *
 * It is also the shape a real backend would return for a tenant, so the day
 * this moves to a server the boundary is already drawn in the right place.
 */
export interface Community {
  id: string;
  /** Shown in the switcher. */
  label: string;
  /**
   * The date this community's data is written as of.
   *
   * Each association sits at its own point in time, so anything that says
   * "in 5 days" or opens a calendar on the current month has to measure from
   * here rather than from one global constant.
   */
  asOf: string;
  /** The next assessment due date, which drives the pay and balance screens. */
  nextChargeDate: string;
  association: Association;
  settings: CommunitySettings;

  owners: Owner[];
  accounts: Account[];
  instruments: PaymentInstrument[];

  bankAccounts: BankAccount[];
  ledger: LedgerEntry[];
  budget: BudgetLine[];
  /** Share of the fiscal year elapsed, used to judge whether spending is on pace. */
  yearElapsed: number;
  reserveComponents: ReserveComponent[];
  savingsOffers: SavingsOffer[];

  vendors: Vendor[];
  payouts: Payout[];

  requests: HomeRequest[];
  violations: Violation[];
  documents: DocumentRecord[];
  complianceItems: ComplianceItem[];

  meetings: Meeting[];
  ballots: Ballot[];
  threads: MessageThread[];
  announcements: Announcement[];
  posts: ForumPost[];

  amenities: CommunityAmenity[];
  /** The legacy display list on the resident home. */
  amenityStatus: Amenity[];
  forms: ArchitecturalForm[];
  templates: MessageTemplate[];

  /** Charge history, keyed by owner. Only seeded for the demo households. */
  ownerCharges: Record<string, import("@/lib/types").ChargeLine[]>;
}
