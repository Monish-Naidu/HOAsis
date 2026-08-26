/**
 * Domain model for HOAsis.
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
  /** Disclosed on the annual budget report in most states. */
  insuranceCarrier?: string;
  insurancePolicyNo?: string;
  insuranceExpiresOn?: ISODate;
  /** active, past_due or canceled. Cancelling stops billing and nothing else. */
  subscriptionStatus?: "active" | "past_due" | "canceled";
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
  photoCount: number;
  fineCents: Cents;
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
  /** Deep-link into the part of HOAsis that satisfies this obligation. */
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

export type AdminRole = "president" | "vice-president" | "treasurer" | "secretary";
export type AccountRole = "resident" | AdminRole;

export const ADMIN_ROLES: AdminRole[] = [
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

export interface CommunityAmenity {
  id: ID;
  name: string;
  /** Residents can request a reservation for this one. */
  reservable: boolean;
  detail: string;
  status: "open" | "reserved" | "closed";
  maxHours?: number;
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
  /** Baseline forms ship with HOAsis. Uploaded ones come from the admin. */
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
  /** Flat HOAsis fee per payment, in cents. */
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

export type BylawTopic =
  | "governance"
  | "money"
  | "meetings"
  | "property"
  | "enforcement"
  | "records";

/**
 * One article of the governing documents.
 *
 * Both the real text and a plain reading of it are stored, deliberately. The
 * legal language is what governs and cannot be paraphrased away; the plain
 * reading is what makes anybody look at it. A product that shows only the
 * summary is misleading, and one that shows only the deed language is the PDF
 * nobody opens.
 */
export interface BylawArticle {
  id: ID;
  /** "Article VII", "Section 4.2". Printed as written in the document. */
  number: string;
  title: string;
  topic: BylawTopic;
  /** The governing text, verbatim. Paragraphs. */
  text: string[];
  /** What it means, in the words a neighbor would use. */
  plain: string;
  /** Who it actually constrains. Owners skip half of a bylaw set. */
  affects: "owners" | "board" | "both";
  /** When this article was last changed, and by which vote. */
  amendedOn?: ISODate;
  amendmentBallotId?: ID;
}

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
export interface BylawAmendment {
  id: ID;
  kind: AmendmentKind;
  /** The article being changed. Absent when adding a new one. */
  articleId?: ID;
  /** Where a new article would sit, or the number of the one being changed. */
  number: string;
  title: string;
  /** The proposed text. Empty for a removal. */
  text: string[];
  plain: string;
  topic: BylawTopic;
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
