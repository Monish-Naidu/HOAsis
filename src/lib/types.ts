/**
 * Domain model for ExpressHOA.
 *
 * These types are the contract between UI and data. Today they're satisfied by
 * fixtures in src/lib/data; swapping in Supabase means reimplementing the
 * repository functions, not touching a single screen.
 *
 * Money is always integer cents. Dates are always ISO `YYYY-MM-DD` strings.
 */

export type ID = string;
export type ISODate = string;
export type Cents = number;

export type Role = "resident" | "board";

/* -------------------------------------------------------------------------- */
/* Association                                                                 */
/* -------------------------------------------------------------------------- */

export interface Association {
  id: ID;
  name: string;
  shortName: string;
  state: string;
  stateName: string;
  unitCount: number;
  fiscalYearStart: string;
  duesCents: Cents;
  duesCadence: "monthly" | "quarterly" | "annually";
  addressLine: string;
  managedBy: "self" | "professional";
  /**
   * The association's own tax id.
   *
   * Gates more than tax. A bank will not open an account in the association's
   * name without it, and registering a brand with The Campaign Registry, which
   * is what makes text messages actually arrive, needs it too.
   */
  ein?: string;
  /** Disclosed on the annual budget report in most states. */
  insuranceCarrier?: string;
  insurancePolicyNo?: string;
  insuranceExpiresOn?: ISODate;
  /** active, past_due or canceled. Cancelling stops billing and nothing else. */
  subscriptionStatus?: "active" | "past_due" | "canceled";
  /**
   * The association's Stripe connected account. Its presence is what turns the
   * resident pay screen from a demo into real money movement; dues settle to
   * this account, never to the platform.
   */
  stripeAccountId?: string;
}

/**
 * A payment that has left the resident's hands but not finished. Settled
 * payments become statement lines and never appear here; this exists so an
 * ACH payment's multi-day flight is visible instead of looking like nothing
 * happened.
 */
export interface PendingPayment {
  id: ID;
  unitId: ID;
  amountCents: Cents;
  rail: "ach" | "card" | "apple-pay" | "google-pay";
  state: "pending" | "failed";
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* People + units                                                              */
/* -------------------------------------------------------------------------- */

export interface Owner {
  id: ID;
  /** Households can have two names on title. One record, one bill. */
  displayName: string;
  members: string[];
  email: string;
  phone: string;
  unit: string;
  address: string;
  moveInDate: ISODate;
  balanceCents: Cents;
  autopay: boolean;
  autopayMethod?: string;
  standing: "current" | "grace" | "late" | "collections";
  daysPastDue: number;
  boardRole?: string;
  isCorporateOwner?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

export type AccountKind = "operating" | "reserve" | "cd";

export interface BankAccount {
  id: ID;
  name: string;
  institution: string;
  mask: string;
  kind: AccountKind;
  balanceCents: Cents;
  /** Minutes since the feed last delivered a transaction. */
  syncedMinutesAgo: number;
  status: "live" | "delayed" | "disconnected";
  reconciledThroughDate: ISODate;
  unreconciledCount: number;
  /** Annual percentage yield, as a percent (1.2 means 1.20%). */
  apy: number;
  interestYtdCents: Cents;
  /** Deposit insurance ceiling at this institution. Balances above it are exposed. */
  insuredLimitCents: Cents;
  maturityDate?: ISODate;
}

/** A place the board could move reserve cash to earn more. */
export interface SavingsOffer {
  id: ID;
  name: string;
  institution: string;
  apy: number;
  kind: "sweep" | "savings" | "treasury" | "cd";
  liquidity: string;
  insuranceNote: string;
  minimumCents: Cents;
  recommended?: boolean;
}

export type LedgerCategory =
  | "Assessments"
  | "Late fees"
  | "Landscaping"
  | "Utilities"
  | "Insurance"
  | "Repairs & maintenance"
  | "Management"
  | "Reserve transfer"
  | "Legal & professional"
  | "Interest income";

export interface LedgerEntry {
  id: ID;
  date: ISODate;
  description: string;
  counterparty: string;
  category: LedgerCategory;
  accountId: ID;
  amountCents: Cents;
  /** Cleared = matched to a bank feed line. Pending = booked, not yet cleared. */
  status: "cleared" | "pending" | "needs-review";
  /** Set when the feed offered a category but a human hasn't confirmed it. */
  suggestedCategory?: LedgerCategory;
  suggestionConfidence?: number;
  matchedBy?: "auto" | "manual";
  ownerId?: ID;
  duplicateOfId?: ID;
}

/** One owner's line-item history: what was charged, what a payment paid off. */
export interface ChargeLine {
  id: ID;
  date: ISODate;
  label: string;
  kind: "charge" | "payment" | "credit";
  amountCents: Cents;
  balanceAfterCents: Cents;
  /** For payments: which charges this money was applied to, and how much each. */
  appliedTo?: { chargeId: ID; label: string; amountCents: Cents }[];
  method?: string;
  feeCents?: Cents;
  feePaidBy?: "association" | "owner";
}

export interface Payout {
  id: ID;
  vendorId: ID;
  vendor: string;
  invoiceNumber: string;
  amountCents: Cents;
  method: "ach" | "check" | "card";
  status: "scheduled" | "in-transit" | "paid" | "needs-approval";
  issuedDate: ISODate;
  expectedDate: ISODate;
  approvals: { name: string; at: ISODate }[];
  approvalsRequired: number;
}

export interface Vendor {
  id: ID;
  name: string;
  service: string;
  achEnabled: boolean;
  w9OnFile: boolean;
  coiExpires?: ISODate;
  ytdPaidCents: Cents;
  defaultCategory: LedgerCategory;
}

/* -------------------------------------------------------------------------- */
/* Requests + violations                                                       */
/* -------------------------------------------------------------------------- */

export type RequestKind =
  | "architectural"
  | "maintenance"
  | "records"
  | "amenity"
  | "violation-appeal";

export type RequestStatus =
  | "draft"
  | "submitted"
  | "in-review"
  | "info-needed"
  | "approved"
  | "denied"
  | "closed";

export interface RequestThreadEvent {
  id: ID;
  at: ISODate;
  actor: string;
  actorRole: Role | "system";
  body: string;
  kind: "note" | "status" | "attachment";
}

export interface HomeRequest {
  id: ID;
  reference: string;
  kind: RequestKind;
  title: string;
  summary: string;
  ownerId: ID;
  ownerName: string;
  unit: string;
  status: RequestStatus;
  submittedDate: ISODate;
  /** Statutory or bylaw clock, if this request type has one. */
  dueDate?: ISODate;
  dueReason?: string;
  decisionDate?: ISODate;
  decidedBy?: string;
  attachments: { name: string; size: string }[];
  thread: RequestThreadEvent[];
  /** The form the owner filled in, when the request started from one. */
  submission?: FormSubmission;
  /** Approved requests produce a shareable, verifiable certificate. */
  certificateId?: string;
}

/**
 * Where a photograph was taken from.
 *
 * The privacy question in enforcement photography is not whether a photo
 * exists, it is where the photographer was standing. A trash can shot from the
 * sidewalk is unremarkable. The same yard shot over a fence, through a window,
 * or from a drone is a different act, and in several states a different legal
 * one. Recording the vantage makes that reviewable before a notice goes out
 * rather than discoverable afterwards.
 */
export type PhotoVantage =
  | "street"
  | "common-area"
  | "reporter-property"
  | "over-boundary"
  | "aerial"
  | "unknown";

export interface ViolationPhoto {
  id: ID;
  /**
   * What the photograph shows, written down.
   *
   * Carried whether or not the image is present, because it is what the
   * accused owner is entitled to be told and what a hearing actually turns on.
   * Follows the same rule as the library's photo briefs: describing what is
   * needed is honest, inventing it is not.
   */
  brief: string;
  takenOn: ISODate;
  takenBy: string;
  vantage: PhotoVantage;
  /** The image itself, where the association has uploaded one. */
  src?: string;
}

export interface Violation {
  id: ID;
  reference: string;
  ownerId: ID;
  ownerName: string;
  unit: string;
  rule: string;
  ruleCitation: string;
  stage: "courtesy" | "first-notice" | "hearing" | "fined" | "cured";
  openedDate: ISODate;
  nextActionDate: ISODate;
  /**
   * The evidence, one record per photograph.
   *
   * This was a count. A count tells the board how many photographs exist and
   * tells the accused owner nothing, which is backwards: due process runs on
   * the owner being able to see what is being said about them.
   */
  photos: ViolationPhoto[];
  fineCents: Cents;
  /** The resident report this started from, when it started from one. */
  reportId?: ID;
}

/* -------------------------------------------------------------------------- */
/* Reports from residents                                                      */
/* -------------------------------------------------------------------------- */

export type ReportStatus = "new" | "verifying" | "verified" | "dismissed";

/**
 * One neighbour telling the board about another.
 *
 * The rule this type exists to enforce is the one every management company and
 * enforcement attorney converges on: **a complaint is an input to an
 * investigation, never a basis for enforcement.** So a report is deliberately
 * not a violation. It cannot become one until somebody on the board has gone
 * and looked, and `verification` is where that goes.
 *
 * The reporter's name is held and never shown to the accused. Both halves
 * matter. Naming them turns a rule into a feud, and not recording them at all
 * hides the pattern that actually needs watching: one owner reporting one
 * neighbour over and over, which is a fair housing problem before it is
 * anything else.
 */
export interface ViolationReport {
  id: ID;
  reference: string;
  /** Board only. Never rendered on anything the accused owner can reach. */
  reporterId: ID;
  reporterName: string;
  reporterUnit: string;
  /** The home the report is about. */
  subjectUnit: string;
  subjectOwnerId?: ID;
  what: string;
  observedOn: ISODate;
  submittedOn: ISODate;
  status: ReportStatus;
  /**
   * The board's own observation.
   *
   * Not the reporter's. This is the thing a notice may rest on, and until it
   * exists the report is hearsay with a reference number.
   */
  verification?: {
    by: string;
    on: ISODate;
    note: string;
  };
  dismissedReason?: string;
  /** The violation this became, when the board raised one. */
  violationId?: ID;
}

/* -------------------------------------------------------------------------- */
/* Compliance                                                                  */
/* -------------------------------------------------------------------------- */

export type ComplianceStatus = "compliant" | "due-soon" | "overdue" | "in-progress";

export interface ComplianceItem {
  id: ID;
  title: string;
  citation: string;
  jurisdiction: string;
  summary: string;
  /** What a board must be able to show if asked. */
  evidence: string;
  status: ComplianceStatus;
  dueDate?: ISODate;
  cadence: string;
  owner: string;
  /** Deep-link into the part of ExpressHOA that satisfies this obligation. */
  actionLabel?: string;
  actionHref?: string;
  completedDate?: ISODate;
  clockDays?: number;
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

export interface DocumentRecord {
  id: ID;
  name: string;
  category:
    | "Governing"
    | "Plans"
    | "Financial"
    | "Meetings"
    | "Insurance"
    | "Notices"
    | "Forms";
  updatedDate: ISODate;
  size: string;
  /** Public = reachable with no login, which is what FL 720/718 actually requires. */
  visibility: "public" | "members" | "board";
  requiredBy?: string;
  fileType: "pdf" | "xlsx" | "docx";
  /** Where the bytes live in Storage, for a real association. A demo keeps none. */
  storagePath?: string;
  /** A link that opens the file, good for a few hours. Absent when there is no file. */
  url?: string;
}

/* -------------------------------------------------------------------------- */
/* Communications                                                              */
/* -------------------------------------------------------------------------- */

export interface MessageEvent {
  id: ID;
  at: ISODate;
  from: string;
  fromRole: Role | "system";
  direction: "inbound" | "outbound";
  channel: "email" | "sms" | "portal";
  body: string;
}

export interface MessageThread {
  id: ID;
  subject: string;
  participants: string[];
  ownerId?: ID;
  unit?: string;
  updatedDate: ISODate;
  unread: boolean;
  tag: "Billing" | "Maintenance" | "Governance" | "Architectural" | "General";
  messages: MessageEvent[];
}

/* -------------------------------------------------------------------------- */
/* Community                                                                   */
/* -------------------------------------------------------------------------- */

export interface Announcement {
  id: ID;
  title: string;
  body: string;
  postedDate: ISODate;
  author: string;
  pinned?: boolean;
  category: "Notice" | "Maintenance" | "Event" | "Governance";
}

export interface CommunityEvent {
  id: ID;
  title: string;
  date: ISODate;
  time: string;
  location: string;
  kind: "meeting" | "social" | "maintenance" | "deadline";
  agendaUrl?: string;
}

export interface Amenity {
  id: ID;
  name: string;
  status: "open" | "reserved" | "closed";
  detail: string;
}

export interface PaymentMethod {
  id: ID;
  label: string;
  kind: "ach" | "card" | "apple-pay";
  mask: string;
  /** Cost to move money with this method, quoted before the user commits. */
  feeCents: Cents;
  feePercent: number;
  isDefault: boolean;
}

export interface ReserveComponent {
  id: ID;
  name: string;
  usefulLifeYears: number;
  remainingLifeYears: number;
  replacementCostCents: Cents;
  fundedCents: Cents;
  lastInspection?: ISODate;
  note?: string;
}

/* -------------------------------------------------------------------------- */
/* Voting + meetings                                                           */
/* -------------------------------------------------------------------------- */

export type BallotAudience = "owners" | "board";

export type BallotStatus = "scheduled" | "open" | "closed" | "certified";

export interface BallotOption {
  id: ID;
  label: string;
  detail?: string;
  votes: number;
}

export interface Ballot {
  id: ID;
  reference: string;
  title: string;
  /** Paragraphs. The description is rich text, not one unbroken block. */
  body: string[];
  kind: "election" | "budget" | "amendment" | "special-assessment" | "poll";
  audience: BallotAudience;
  status: BallotStatus;
  opensDate: ISODate;
  closesDate: ISODate;
  /** Eligible voting interests: units for owner votes, seats for board votes. */
  eligible: number;
  /**
   * Seats being filled, for an election where each household votes more than
   * once. Turnout and quorum count households, not votes, so a two seat race
   * with 129 votes is 65 ballots rather than a turnout of 147 percent.
   */
  seats?: number;
  /** Votes needed for the result to count. */
  quorumRequired: number;
  /** Share of votes cast that must approve. */
  thresholdLabel: string;
  options: BallotOption[];
  proxiesHeld?: number;
  /** The option this resident picked, if they have voted. */
  myVoteOptionId?: ID;
  myVoteReceipt?: string;
  meetingId?: ID;
  certifiedBy?: string;
  certifiedDate?: ISODate;
  /** Owners see live tallies only when the board opts in. */
  liveResultsVisible: boolean;
}

export interface MeetingAttendee {
  name: string;
  unit?: string;
  role?: string;
  channel: "video" | "phone" | "in-person";
  isHost?: boolean;
}

export interface Meeting {
  id: ID;
  title: string;
  date: ISODate;
  time: string;
  status: "scheduled" | "live" | "ended";
  kind: "board" | "annual" | "workshop" | "special";
  location: string;
  dialIn: string;
  passcode: string;
  attendees: MeetingAttendee[];
  agenda: string[];
  ballotIds: ID[];
  noticeSentDate?: ISODate;
  recordingAvailable?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Accounts, roles, capabilities                                               */
/*                                                                             */
/* Every account is a resident first. An admin role wraps that: same person,   */
/* same unit, same dues, plus a set of capabilities. The President holds the   */
/* one capability that cannot be granted away, which is granting capabilities. */
/* -------------------------------------------------------------------------- */

export type BoardRole = "president" | "vice-president" | "treasurer" | "secretary";
export type AccountRole = "resident" | BoardRole;

export const ADMIN_ROLES: BoardRole[] = [
  "president",
  "vice-president",
  "treasurer",
  "secretary",
];

export const ROLE_LABEL: Record<AccountRole, string> = {
  resident: "Resident",
  president: "President",
  "vice-president": "Vice President",
  treasurer: "Treasurer",
  secretary: "Secretary",
};

export type Capability =
  | "finances"
  | "requests"
  | "documents"
  | "communications"
  | "voting"
  | "vendors"
  | "compliance"
  | "forum"
  | "settings"
  | "permissions";

export type Capabilities = Record<Capability, boolean>;

export interface Account {
  id: ID;
  ownerId: ID;
  name: string;
  email: string;
  unit: string;
  role: AccountRole;
  capabilities: Capabilities;
}

/* -------------------------------------------------------------------------- */
/* Community settings, owned by the admins                                     */
/* -------------------------------------------------------------------------- */

/**
 * The rules a board sets on a bookable space.
 *
 * Every association ends up writing these on a laminated sign by the door, and
 * then enforcing them by argument. Stating them as numbers means the booking
 * screen can simply not offer a slot that breaks one, which is a great deal
 * kinder than letting somebody book and then telling them they cannot.
 *
 * All optional. A space with no rules can be booked at any hour for as long as
 * anybody likes, which is genuinely how some picnic shelters work.
 */
export interface BookingRules {
  /** Earliest and latest hour of the day, 0 to 23. */
  opensHour?: number;
  closesHour?: number;
  /** Length of one bookable block, in minutes. */
  slotMinutes?: number;
  /** Longest single booking, in hours. */
  maxHours?: number;
  /** How many bookings one home may hold in a day and in a week. */
  maxPerDay?: number;
  maxPerWeek?: number;
  /** How far ahead a home may book. */
  advanceDays?: number;
  /** Whether the board approves each one, or the slot is simply taken. */
  needsApproval?: boolean;
}

export interface CommunityAmenity {
  id: ID;
  name: string;
  /** Residents can request a reservation for this one. */
  reservable: boolean;
  detail: string;
  status: "open" | "reserved" | "closed";
  /** Kept for the older screens. `rules.maxHours` is the one that governs. */
  maxHours?: number;
  rules?: BookingRules;
}

/** One held slot, so the booking screen can grey out what is gone. */
export interface AmenityBooking {
  id: ID;
  amenityId: ID;
  /** YYYY-MM-DD. */
  date: ISODate;
  /** Minutes from midnight, so arithmetic never touches a timezone. */
  startMinute: number;
  endMinute: number;
  unit: string;
  ownerName: string;
  status: "held" | "confirmed" | "declined";
}

/**
 * One question on a form.
 *
 * Deliberately a small set of kinds. A form builder that can express anything
 * produces forms nobody finishes, and every architectural request in this
 * category asks the same eight or nine things.
 */
export interface FormField {
  id: ID;
  label: string;
  kind: "text" | "long" | "number" | "date" | "choice" | "checkbox" | "file";
  required?: boolean;
  /** Shown under the field. This is where the rule that drives the question goes. */
  help?: string;
  /** For "choice". */
  options?: string[];
  placeholder?: string;
  /** Units printed after a number, like "feet" or "square feet". */
  suffix?: string;
}

export interface ArchitecturalForm {
  id: ID;
  label: string;
  description: string;
  fileName: string;
  size: string;
  /** Baseline forms ship with ExpressHOA. Uploaded ones come from the admin. */
  source: "baseline" | "uploaded";
  updatedDate: ISODate;
  /**
   * The questions, when the form can be filled in here.
   *
   * A form with no fields is a PDF to print, sign by hand, and scan, which is
   * what every association does today and what roughly half of applications
   * die in the middle of. Filling it in on the page is the whole improvement.
   */
  fields?: FormField[];
  /** The article this form exists to satisfy, quoted back to the applicant. */
  governedBy?: string;
  /** Days the association has to decide, from the same article. */
  decisionDays?: number;
}

/**
 * A signature captured on the page.
 *
 * Both the drawn image and the typed name are kept, along with when and from
 * where. An association challenged on an approval needs to show that a person
 * agreed to something at a moment in time, and a canvas by itself does not
 * establish that.
 */
export interface FormSignature {
  /** Data URL of the drawn mark, when the signer drew one. */
  drawn?: string;
  /** The typed legal name, which is what makes it enforceable in most states. */
  typedName: string;
  signedAt: string;
  /** What the signer agreed to, stored with the signature rather than referenced. */
  statement: string;
}

/** A completed form, ready to become a request. */
export interface FormSubmission {
  formId: ID;
  formLabel: string;
  answers: { fieldId: ID; label: string; value: string }[];
  signature: FormSignature;
}

export interface CommunityBanner {
  enabled: boolean;
  title: string;
  detail: string;
  updatedDate: ISODate;
}

export interface CommunitySettings {
  displayName: string;
  photoUrl: string;
  photoCredit?: string;
  /** Some associations run a full calendar. Some just meet quarterly. */
  homeLayout: "calendar" | "banner";
  banner: CommunityBanner;
  /** Whether residents can see association balances and transactions. */
  showFundsToResidents: boolean;
  /** Whether ballot tallies are visible before a ballot closes. */
  showLiveVoteResults: boolean;
  /** The day of the month after which an assessment is late. */
  autopayLateAfterDay: number;
  /** Flat ExpressHOA fee per payment, in cents. */
  paymentFeeCents: number;
  /** Whether the owner or the association carries that fee. */
  paymentFeePaidBy: "owner" | "association";
  /** Waiving it on ACH pushes volume to the cheapest rail. */
  paymentFeeWaivedOnAch: boolean;
  forumEnabled: boolean;
}

/* -------------------------------------------------------------------------- */
/* Forum                                                                       */
/* -------------------------------------------------------------------------- */

export type ForumCategory =
  | "General"
  | "Recommendations"
  | "For sale"
  | "Lost and found"
  | "Safety"
  | "Events";

export interface ForumReply {
  id: ID;
  author: string;
  unit: string;
  authorRole?: string;
  at: ISODate;
  body: string;
}

export type PostStatus = "pending" | "published" | "rejected";

export interface ForumPost {
  id: ID;
  /** Every post is reviewed before neighbors see it. */
  status: PostStatus;
  moderatedBy?: string;
  moderatedAt?: ISODate;
  rejectionReason?: string;
  author: string;
  unit: string;
  /** Board members get a badge so neighbors know when it is official. */
  authorRole?: string;
  category: ForumCategory;
  title: string;
  body: string;
  at: ISODate;
  likes: number;
  pinned?: boolean;
  replies: ForumReply[];
}

/* -------------------------------------------------------------------------- */
/* Layers: what an association charges beyond a flat monthly due.              */
/* -------------------------------------------------------------------------- */

/**
 * How a shared bill is divided between homes.
 *
 * Equal is the default and the only one that needs no data about the homes.
 * The rest exist because dividing a water bill equally between a studio and a
 * four bedroom is the argument that starts most utility disputes. Splitting by
 * occupancy or floor area is what the utility billing industry calls RUBS.
 */
export type AllocationMethod = "equal" | "square_feet" | "bedrooms" | "occupants" | "submeter";

export type SharedCostKind =
  | "water"
  | "sewer"
  | "trash"
  | "gas"
  | "electric"
  | "internet"
  | "other";

/**
 * A bill the association receives and passes on.
 *
 * Water, trash, bulk internet. The association is the customer of record, so
 * owners never see the provider's invoice and normally have no idea what the
 * community actually pays. That opacity is the complaint; the provider and the
 * account reference are stored so a statement can answer it.
 */
export interface SharedCost {
  id: ID;
  name: string;
  kind: SharedCostKind;
  /** Who the association pays. Shown to owners, deliberately. */
  provider: string;
  accountRef: string;
  allocation: AllocationMethod;
  /** Some boards add an administration percentage. Recorded, never hidden in the rate. */
  markupPercent: number;
  active: boolean;
  /** How the provider measures usage: gallons, therms, kWh. */
  usageUnit: string;
}

/** One provider bill, for one period, already divided. */
export interface SharedCostBill {
  id: ID;
  sharedCostId: ID;
  periodStart: ISODate;
  periodEnd: ISODate;
  dueOn: ISODate;
  totalCents: Cents;
  usageAmount?: number;
  /** Homes the bill was divided between. */
  homes: number;
  /** What the median home paid, which is the number owners actually ask for. */
  averageShareCents: Cents;
  /** The current owner's own share, when there is a signed in owner. */
  myShareCents?: Cents;
}

/**
 * One large cost, approved once, split across homes, and paid off.
 *
 * Distinct from dues because it ends. Owners want to see how much is left, and
 * a buyer's lender asks about it by name.
 */
export interface SpecialAssessment {
  id: ID;
  title: string;
  /** Why the board levied it, in their words. Several states require this be stated. */
  reason: string;
  totalCents: Cents;
  allocation: AllocationMethod;
  installments: number;
  firstDueOn: ISODate;
  /** The vote that authorised it, when the documents required one. */
  ballotId?: ID;
  /** Collected so far, across every home. */
  collectedCents: Cents;
  status: "proposed" | "active" | "complete";
}

/* -------------------------------------------------------------------------- */
/* Bylaws, as something a person can actually read.                           */
/* -------------------------------------------------------------------------- */

export type GoverningTopic =
  | "governance"
  | "money"
  | "meetings"
  | "property"
  | "enforcement"
  | "records";

/**
 * Which of the three documents an article belongs to.
 *
 * Boards and owners use "bylaws" and "CC&Rs" interchangeably and they are not
 * the same instrument. The declaration is recorded against the land, binds
 * every future buyer whether they read it or not, and is the hardest to
 * change. The bylaws govern how the association runs itself and are usually
 * not recorded. Rules are adopted by the board under authority the declaration
 * already grants, and can be changed at a single meeting.
 *
 * Storing which is which is not pedantry. It decides who may change the text,
 * by what margin, and which provision wins when two of them disagree.
 */
export type GoverningDoc = "declaration" | "bylaws" | "rules";

/**
 * How a document is changed, and what beats what.
 *
 * The order of this list is the hierarchy: state law beats the declaration,
 * the declaration beats the bylaws, the bylaws beat the rules. A board that
 * adopts a rule contradicting its own declaration has adopted nothing, and
 * that is the single most common self-managed mistake.
 */
export interface GoverningDocMeta {
  kind: GoverningDoc;
  /** What it is called on the cover page. */
  label: string;
  /** The form that reads naturally mid-sentence: "added to the CC&Rs". */
  short: string;
  /** One line an owner can hold on to. */
  plain: string;
  /** Who has to agree before the words change. */
  changedBy: string;
  /** Rank in the hierarchy. Lower wins. State law is 0 and is not a document. */
  precedence: number;
  recorded: boolean;
}

/**
 * One article of the governing documents.
 *
 * Both the real text and a plain reading of it are stored, deliberately. The
 * legal language is what governs and cannot be paraphrased away; the plain
 * reading is what makes anybody look at it. A product that shows only the
 * summary is misleading, and one that shows only the deed language is the PDF
 * nobody opens.
 */
export interface GoverningArticle {
  id: ID;
  /** Which instrument this article is part of. Decides precedence. */
  document: GoverningDoc;
  /** "Article VII", "Section 4.2". Printed as written in the document. */
  number: string;
  title: string;
  topic: GoverningTopic;
  /** The governing text, verbatim. Paragraphs. */
  text: string[];
  /**
   * What it means, in the words a neighbor would use.
   *
   * Optional, and absent is a real state rather than a bug. Text pulled out of
   * an uploaded document arrives without one, because a plain reading is an
   * interpretation and a machine has no standing to write one. A board member
   * writes it, and until somebody does the screen shows the governing text and
   * says the summary is missing.
   */
  plain?: string;
  /** Who it actually constrains. Owners skip half of a bylaw set. */
  affects: "owners" | "board" | "both";
  /** When this article was last changed, and by which vote. */
  amendedOn?: ISODate;
  amendmentBallotId?: ID;
  /**
   * When a board adopted this rule.
   *
   * Only meaningful on the rules layer. A rule adopted after you moved in
   * still binds you, and an owner is entitled to know that the thing they are
   * being cited under did not exist when they bought.
   */
  adoptedOn?: ISODate;
  /**
   * Which of the things a buyer must be warned about this article settles.
   *
   * Confirmed by a person, never inferred. An extractor may propose a tag and
   * the board accepts it, because "your documents ban flags" is an assertion
   * about somebody's home and we do not make those on our own authority.
   */
  disclosureTopics?: DisclosureTopic[];
  /**
   * Set when the text came out of an uploaded file rather than being typed.
   *
   * Kept so a reader can tell a confirmed extraction from something a board
   * member wrote, and so an extraction can be re-run without touching either.
   */
  extraction?: {
    /** The document record the text was pulled from. */
    sourceDocumentId?: ID;
    /** Confirmed by a named board member on this date, or not yet. */
    confirmedBy?: string;
    confirmedOn?: ISODate;
  };
}

/* -------------------------------------------------------------------------- */
/* What a buyer has to be told                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The eight things a buyer must be warned about.
 *
 * Not our list. Virginia, Colorado and Washington legislated disclosure
 * requirements independently and converged on the same short set, which is
 * what makes it defensible as a schema: it is what statute says a buyer must
 * be told, not what we think is interesting.
 */
export type DisclosureTopic =
  | "flags"
  | "solar"
  | "signs"
  | "parking"
  | "home-business"
  | "rentals"
  | "architectural"
  | "lien";

export type AmendmentKind = "amend" | "add" | "remove";
export type AmendmentStage = "draft" | "open" | "passed" | "failed" | "withdrawn";

/**
 * A proposed change to one article.
 *
 * Kept next to the article rather than as free text on a ballot, so an owner
 * voting on it sees exactly what the words become. Boards routinely put "shall
 * we amend Article VII" on a ballot with the actual change in an attachment
 * nobody opens, and then wonder why the vote is challenged.
 */
export interface GoverningAmendment {
  id: ID;
  kind: AmendmentKind;
  /** Which document is being changed. Decides the threshold and the recording. */
  document: GoverningDoc;
  /** The article being changed. Absent when adding a new one. */
  articleId?: ID;
  /** Where a new article would sit, or the number of the one being changed. */
  number: string;
  title: string;
  /** The proposed text. Empty for a removal. */
  text: string[];
  plain: string;
  topic: GoverningTopic;
  /** Who the change would constrain, so an owner can tell if it reaches them. */
  affects: "owners" | "board" | "both";
  /** Why the board or the petitioning owners want it. */
  rationale: string;
  proposedBy: string;
  proposedOn: ISODate;
  stage: AmendmentStage;
  /** The ballot carrying it, once it opens. */
  ballotId?: ID;
  /** What share of owners must approve, from the association's own documents. */
  thresholdLabel: string;
}
