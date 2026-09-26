import type {
  Account,
  ActionItem,
  AmenityBooking,
  EmailLogEntry,
  JoinRequest,
  GoverningAmendment,
  GoverningArticle,
  Amenity,
  Announcement,
  ArchitecturalForm,
  Association,
  Ballot,
  BankAccount,
  Activity,
  BoardTerm,
  CommunityAmenity,
  CommunityHistory,
  CommunitySettings,
  DocumentRecord,
  ForumPost,
  HomeRequest,
  LedgerEntry,
  Meeting,
  MessageThread,
  Owner,
  Payout,
  PendingPayment,
  ReserveComponent,
  SavingsOffer,
  SharedCost,
  SharedCostBill,
  SpecialAssessment,
  Vendor,
  VendorInvoice,
  Violation,
  ViolationReport,
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
  /** Stripe payments still in flight. Absent in the fixture demo on purpose. */
  pendingPayments?: PendingPayment[];

  bankAccounts: BankAccount[];
  /** An owner's funds summary was asked for and the call failed. */
  fundsUnavailable?: boolean;
  ledger: LedgerEntry[];
  budget: BudgetLine[];
  /** Share of the fiscal year elapsed, used to judge whether spending is on pace. */
  yearElapsed: number;
  reserveComponents: ReserveComponent[];
  savingsOffers: SavingsOffer[];

  /**
   * Layers on top of dues, both empty for most associations.
   *
   * A board that bills one flat amount never creates either, and every screen
   * that reads them renders nothing rather than an empty table. That is the
   * whole contract: adding a capability must not add a screen to associations
   * that did not ask for it.
   */
  /**
   * The three answers onboarding collected, kept so the plan can be rebuilt.
   *
   * Absent for the shipped demo associations, which predate the questions. The
   * plan falls back to showing everything when it is missing, which is the old
   * behaviour and the right default for an association we know nothing about.
   */
  profile?: import("./new-community").AssociationProfileAnswers;

  sharedCosts: SharedCost[];
  sharedCostBills: SharedCostBill[];
  specialAssessments: SpecialAssessment[];

  vendors: Vendor[];
  payouts: Payout[];
  /** Bills vendors have sent that the board has not yet paid, and the ones it has. */
  invoices: VendorInvoice[];

  requests: HomeRequest[];
  violations: Violation[];
  /**
   * What neighbours have told the board.
   *
   * Separate from violations on purpose: a report is an input to an
   * investigation and never a basis for enforcement, so the two must not be
   * one collection that a screen can quietly conflate.
   */
  violationReports: ViolationReport[];
  documents: DocumentRecord[];
  /**
   * The governing documents as text, so they can be read and searched rather
   * than only downloaded. Empty for an association that has only uploaded a
   * scan, which every screen handles by pointing at the file instead.
   */
  governingDocs: GoverningArticle[];
  governingAmendments: GoverningAmendment[];

  meetings: Meeting[];
  ballots: Ballot[];
  threads: MessageThread[];
  announcements: Announcement[];
  posts: ForumPost[];

  amenities: CommunityAmenity[];
  /** Held and confirmed reservations, so the picker can grey out what is gone. */
  amenityBookings: AmenityBooking[];
  /** Who has asked to join and is waiting on the board. */
  joinRequests: JoinRequest[];
  /** What board members agreed to do, and whether they did. */
  actionItems: ActionItem[];
  /** What was emailed and what became of it. Empty for a demo association. */
  emailLog: EmailLogEntry[];
  /** The legacy display list on the resident home. */
  amenityStatus: Amenity[];
  forms: ArchitecturalForm[];
  templates: MessageTemplate[];

  /** Charge history, keyed by owner. Only seeded for the demo households. */
  ownerCharges: Record<string, import("@/lib/types").ChargeLine[]>;

  /**
   * The months the server summed, for a real association with more history
   * than the app loads line by line. Unset for the fixtures, which hold every
   * line, and every selector reads them exactly as before.
   */
  history?: CommunityHistory;
  /** Every term of office on record, current ones included. Unset for the fixtures. */
  boardTerms?: BoardTerm[];
  /** The newest board actions, latest first. Remote only. */
  activity?: Activity[];
}
