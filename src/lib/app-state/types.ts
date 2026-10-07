import type { Community } from "@/lib/data/community";
import type { CommunityDraft } from "@/lib/data/new-community";
import type { AccessLevel, Account, AccountRole, Announcement, AutopayPlan, BankAccount, Capability, DocumentRecord, ForumPost, HomeRequest, HomeType, MessageThread, Owner, ThreadAddress, VendorInvoice, Violation, ViolationReport, WorkOrder } from "@/lib/types";
import type { ManualMethod, PaymentInstrument } from "@/lib/payments/instruments";
import type { ManualPaymentRow } from "@/lib/payments/manual-payments";
import type { ReplyEmail } from "@/lib/email/plain-error";

export type View = "resident" | "board";

/**
 * Settings to change. The banner may name only the field that changed: it is
 * two boxes saved one at a time, and a patch carrying the whole banner as one
 * render saw it wrote an old title back over the one saved a moment before.
 */
export type SettingsPatch = Partial<Omit<Community["settings"], "banner">> & {
  banner?: Partial<Community["settings"]["banner"]>;
};

/**
 * Everything a screen can read or change.
 *
 * Collections are typed off the Community bundle rather than restated, so
 * adding a field to a community cannot leave this interface silently behind.
 */
/** What came of an upload: the names that landed, and the ones refused with why. */
export interface UploadOutcome {
  uploaded: string[];
  rejected: { name: string; reason: string }[];
  /** The records made, so a caller can point at one of them afterwards. */
  filed: { id: string; name: string }[];
}

/** What a reversal hands back: how to put the line back as a new line, or false when refused. */
export type LedgerReversal = { undo: () => void } | false;

export interface AppState {
  /** Which association is being viewed, and what else is available. */
  community: Community;
  /** Every association this person can open. `place` tells twins apart. */
  communities: { id: string; label: string; place?: string; slug?: string }[];
  /**
   * Opens another association. A real member holding two switches in place
   * and gets `"switched"`; picking a demo seat signs out and gets
   * `"signed-out"`, so the caller knows whether to send them to the door.
   */
  setCommunity: (communityId: string) => "switched" | "signed-out";

  account: Account | null;
  /**
   * Every seat this person holds in the association, one per home. One entry
   * for almost everyone, and always the one account in the demo. The resident
   * screens show `account`, which is whichever of these they chose.
   */
  mySeats: Account[];
  /** Looks at another of their own homes. A unit they do not hold is ignored. */
  chooseHome: (unitId: string) => void;
  accounts: Account[];
  view: View;
  ready: boolean;

  settings: Community["settings"];
  amenities: Community["amenities"];
  forms: Community["forms"];
  posts: Community["posts"];
  requests: Community["requests"];
  instruments: Community["instruments"];
  ledger: Community["ledger"];
  payouts: Community["payouts"];
  invoices: Community["invoices"];
  vendors: Community["vendors"];
  threads: Community["threads"];
  documents: Community["documents"];
  ballots: Community["ballots"];
  templates: Community["templates"];

  signIn: (accountId: string) => void;
  signOut: () => void;
  setView: (v: View) => void;
  /** May this seat change the area? Every action asks this. */
  can: (c: Capability) => boolean;
  /** May this seat open the area, to read or to change? Screens and nav ask this. */
  sees: (c: Capability) => boolean;

  /**
   * Resolves true once a real association's settings are written, false when
   * the write was refused, so a screen can hold its "saved" until it knows.
   */
  updateSettings: (patch: SettingsPatch) => boolean | Promise<boolean>;
  setAmenities: (next: Community["amenities"]) => void;
  setForms: (next: Community["forms"]) => void;
  removeForm: (formId: string) => () => void;
  removeAmenity: (amenityId: string) => () => void;
  addVendor: (vendor: Community["vendors"][number]) => void;
  saveTemplate: (template: Community["templates"][number]) => void;
  removeVendor: (vendorId: string) => () => void;
  /**
   * Resolves with an undo for a demo. A real association gets none: the file
   * is gone from Storage, and a toast offering to bring it back would lie.
   */
  removeDocument: (documentId: string) => Promise<(() => void) | undefined>;
  setCapability: (accountId: string, capability: Capability, level: AccessLevel) => void;
  resetDemo: () => void;
  /** Adds a household to the register, with the account that lets them sign in. */
  addOwner: (input: { name: string; email: string; unit: string; homeType?: HomeType }) => Owner;
  /** A neighbour telling the board about another home. Never a violation. */
  addViolationReport: (input: {
    reporterId: string;
    reporterName: string;
    reporterUnit: string;
    subjectUnit: string;
    subjectOwnerId?: string;
    what: string;
    observedOn: string;
  }) => ViolationReport;
  /** The board's own observation. Refuses an empty note. */
  verifyReport: (reportId: string, by: string, note: string) => void;
  dismissReport: (reportId: string, reason: string) => void;
  /** Refuses anything nobody has gone and looked at. */
  raiseNoticeFromReport: (
    reportId: string,
    input: { rule: string; ruleCitation: string; ownerId: string; ownerName: string },
  ) => Violation;
  /**
   * What each home owed on the day the association switched to us. Only the
   * homes passed are touched. Resolves once a real association's lines are
   * written, so a screen can hold its button until then.
   */
  setOpeningBalances: (
    asOf: string,
    balances: { ownerId: string; amountCents: number }[],
  ) => boolean | Promise<boolean>;
  /** Names the owner of a home that has none on record yet. */
  setHouseholdOwner: (ownerId: string, input: { name: string; email: string }) => Promise<boolean>;
  /** A second person on a home that already has an owner, with a sign-in of their own. */
  addSecondOwner: (ownerId: string, input: { name: string; email: string }) => Promise<boolean>;
  /**
   * Ends one of two owners' seats on a home today. `seatId` is the membership
   * id for a real association and the account id in the demo. The other owner
   * stays. (removeOwner, above, removes a whole household.)
   */
  removeCoOwner: (ownerId: string, seatId: string) => Promise<boolean>;
  /** The address a not yet signed in owner claims their seat with. */
  changeOwnerEmail: (ownerId: string, email: string) => Promise<boolean>;
  /** Which kind of home these are: detached, townhome or condo. */
  setHomeType: (ownerIds: string[], homeType: HomeType) => boolean | Promise<boolean>;
  /**
   * What each of these homes pays of its own, from the next bill. A null
   * amount clears it, so the home pays what its kind or the association
   * pays. Resolves once a real association has the write, so a screen can
   * wait before it says saved; false when it was refused.
   */
  setHomeDues: (
    changes: { ownerId: string; cents: number | null }[],
  ) => boolean | Promise<boolean>;
  removeOwner: (ownerId: string) => () => void;
  /**
   * A home changes hands. The seller's seat ends on the closing date, the
   * buyer is seated with a clean statement, and the home keeps its history.
   * What the seller owed is either settled at closing, which is the normal
   * case and is written as a payment, or carried to the buyer.
   */
  transferHome: (
    ownerId: string,
    input: { name: string; email: string; closingDate: string; settleBalance: boolean },
  ) => boolean | Promise<boolean>;
  /** Connects an account the association can receive dues into. */
  /** Appoints a household to an office, or returns them to being a resident. */
  setAccountRole: (accountId: string, role: AccountRole) => void;
  /** Setup tasks this association has said do not apply to them. */
  dismissedSetupTasks: Set<string>;
  dismissSetupTask: (key: string) => void;
  restoreSetupTask: (key: string) => void;
  addBankAccount: (account: BankAccount) => void;
  /** Records a payment on the statement, the balance, the books, and the bank. */
  recordPayment: (input: {
    ownerId: string;
    amountCents: number;
    processorCents: number;
    platformCents: number;
    platformPaidBy: "owner" | "association";
    method: string;
    kind: "ach" | "card" | "apple-pay";
  }) => void;
  /**
   * A check or cash the board received from an owner. Resolves true once the
   * statement, the balance and the books have all taken it.
   */
  recordManualPayment: (input: {
    ownerId: string;
    amountCents: number;
    method: ManualMethod;
    reference: string;
    receivedOn: string;
  }) => boolean | Promise<boolean>;
  /**
   * Takes back a check or cash the board entered by mistake. The home owes the
   * money again and the books lose the deposit. Resolves true once it is done.
   */
  reverseManualPayment: (paymentId: string, reason: string) => boolean | Promise<boolean>;
  /**
   * One home's checks and cash entered by hand, newest first, ten at most.
   * Real associations read them on demand; the demo returns what this session
   * entered. Rejects when the read fails.
   */
  manualPaymentsFor: (ownerId: string) => Promise<ManualPaymentRow[]>;
  /** A credit on one home's statement, such as a waived late fee. Not money in the bank. */
  addCredit: (input: {
    ownerId: string;
    amountCents: number;
    reason: string;
  }) => boolean | Promise<boolean>;
  /**
   * A one-off charge on one home's statement: a repair, a key fob, a special
   * assessment. Raises the balance and is paid oldest first like dues, but is
   * not dues, so it draws no late fee. Resolves true once it is on the books.
   */
  addCharge: (input: {
    ownerId: string;
    amountCents: number;
    label: string;
    dueOn: string;
  }) => boolean | Promise<boolean>;
  /** The same one-off charge on every home's statement, in one write. */
  addChargeToAll: (input: {
    amountCents: number;
    label: string;
    dueOn: string;
  }) => boolean | Promise<boolean>;
  /** What an account held when the books started here. Replaces an earlier figure. */
  setOpeningBankBalance: (
    accountId: string,
    input: { amountCents: number; asOf: string },
  ) => boolean | Promise<boolean>;
  /** Builds an association from onboarding and signs its founder in. */
  createCommunity: (draft: CommunityDraft) => Community;
  /** Founds one in Postgres, for a signed in person. */
  createRemoteAssociation: (draft: CommunityDraft) => Promise<string>;
  /** True when a real association is on screen rather than a demo. */
  isRemote: boolean;

  addPost: (post: ForumPost) => void;
  addAnnouncement: (
    a: {
      title: string;
      body: string;
      category: Announcement["category"];
      pinned?: boolean;
    },
    /** "none" when the caller sends its own email, as a meeting notice does. */
    email?: "announcement" | "none",
  ) => void;
  removeAnnouncement: (id: string) => void;
  /**
   * Posts the meeting's notice to every home screen and records the date.
   * Answers whether notice is now on record. A real association emails the
   * roster first, which can take most of a minute, so it answers later.
   */
  /**
   * Posts the notice in the app and emails it. Resolves to the sentence to
   * toast (what was emailed, or why not), or false when nothing was posted
   * or the date could not be recorded.
   */
  sendMeetingNotice: (meetingId: string) => string | false | Promise<string | false>;
  /** Returns an undo, because publishing broadcasts and rejecting discards. */
  moderatePost: (
    postId: string,
    decision: "published" | "rejected",
    reason?: string,
  ) => () => void;
  togglePinned: (postId: string) => void;
  removePost: (postId: string) => () => void;
  /**
   * Files a request. A real association answers with the number the database
   * kept, which may not be the one the form made up, or null when the
   * request was not saved. The demo answers with nothing: its number stands.
   */
  addRequest: (request: HomeRequest) => void | Promise<string | null>;
  addInstrument: (instrument: Omit<PaymentInstrument, "id" | "isDefault">) => PaymentInstrument;
  /** Returns an undo where one is possible; a Stripe method, once detached, is gone. */
  removeInstrument: (instrumentId: string) => (() => void) | undefined;
  setDefaultInstrument: (instrumentId: string) => void;
  /**
   * Confirming moves a transaction into every report. There is no undo: a
   * confirmed money line is not edited back (0106). To take one back, reverse it.
   */
  confirmLedgerEntry: (
    entryId: string,
    category?: Community["ledger"][number]["category"],
  ) => void;
  /**
   * Takes a line back by writing its opposite, with a reason, and leaves the
   * line itself on the books. Resolves to an undo once it is written, or false
   * when it was refused. The undo is a fresh copy of the line, not a delete.
   */
  reverseLedgerEntry: (
    entryId: string,
    reason: string,
  ) => LedgerReversal | Promise<LedgerReversal>;
  /**
   * Money moved from operating into reserves: two lines, one per account, so
   * both balances move. A transfer booked on the operating side alone read
   * as a negative operating balance and a reserve account that never grew.
   */
  recordReserveTransfer: (amountCents: number, date: string) => void;
  approvePayout: (payoutId: string) => void;
  /**
   * Says a signed or scheduled vendor payment has gone out. Cash moves only
   * here (or when a payment is recorded as already paid): approving the last
   * signature only schedules it. Writes the ledger line, so the bank balance,
   * Transactions and the vendor's year all move together.
   */
  markPayoutPaid: (payoutId: string) => boolean | Promise<boolean>;
  markW9Requested: (vendorId: string) => void;
  /**
   * Posts the board's reply and emails it. Resolves to how the email went
   * ("none" when none was tried: the demo, or a thread with no household),
   * or false when the reply itself was not saved.
   */
  replyToThread: (threadId: string, body: string) => Promise<ReplyEmail | false>;
  /** An owner starting a conversation with the board. Resolves true when it landed. */
  messageBoard: (
    ownerId: string,
    subject: string,
    body: string,
    tag?: MessageThread["tag"],
    /** The office to write to, or the board as a whole. Defaults to the board. */
    toRole?: ThreadAddress,
  ) => Promise<boolean>;
  /** An owner answering one of their home's conversations. */
  replyAsOwner: (threadId: string, ownerId: string, body: string) => Promise<boolean>;
  /**
   * A new letter to one household, on its own thread.
   *
   * A dues reminder is not a reply to "Question about the pool closure", so
   * it starts a thread of its own under the subject the letter carries. The
   * board's record is the thread; the resident's copy goes by email.
   */
  messageOwner: (
    ownerId: string,
    subject: string,
    body: string,
    tag?: Community["threads"][number]["tag"],
  ) => boolean | Promise<boolean>;
  /**
   * Files the board uploads. A demo keeps the name and size; a real
   * association keeps the bytes in Storage and the rest in a row. Resolves
   * with what landed and what was refused, so the screen can say both.
   */
  uploadDocuments: (
    files: File[],
    options?: { category?: DocumentRecord["category"]; visibility?: DocumentRecord["visibility"] },
  ) => Promise<UploadOutcome>;
  /** Text confirmed out of an uploaded declaration, bylaws or rule set. */
  addGoverningArticles: (articles: Community["governingDocs"]) => void;
  /**
   * Switching the shared cost layer on, and recording a provider bill.
   *
   * Both live here rather than in the screen because an owner's statement and
   * the board's trend read the same rows. A screen that kept its own copy would
   * be the exact drift this product argues against.
   */
  /** Association level facts a board edits: insurance, name, dues. */
  updateAssociation: (patch: Partial<Community["association"]>) => boolean | Promise<boolean>;
  /**
   * Records a payment to a vendor.
   *
   * Plenty of boards will keep paying their landscaper from their own bank for
   * a while, and a product that only knows about payments it made itself shows
   * them books that are wrong. So a payment can be entered after the fact,
   * with the date it actually left.
   */
  addPayout: (payout: Community["payouts"][number]) => void;
  addBallot: (ballot: Community["ballots"][number]) => void;
  addMeeting: (meeting: Community["meetings"][number]) => void;
  addBudgetLine: (line: Community["budget"][number]) => void;
  addReserveComponent: (component: Community["reserveComponents"][number]) => void;
  addSharedCost: (cost: Community["sharedCosts"][number]) => void;
  removeSharedCost: (costId: string) => void;
  postSharedCostBill: (bill: Community["sharedCostBills"][number]) => void;
  setDocumentVisibility: (
    documentId: string,
    visibility: Community["documents"][number]["visibility"],
  ) => Promise<void>;
  /** Records a vote and returns the receipt the voter is shown. */
  /** One choice, or up to `seats` of them in a multi seat election. */
  castVote: (ballotId: string, optionIds: string | string[]) => string;
  /**
   * Moves a request to a status, with the words the owner is told. Resolves
   * true once the decision is saved, so a screen can say so only then.
   */
  updateRequestStatus: (
    requestId: string,
    status: HomeRequest["status"],
    note?: string,
  ) => Promise<boolean>;
  /**
   * The board writing to the owner on their request. Appends one line to the
   * request's conversation and changes nothing else. Resolves to how the
   * email went once saved, or false when it was not.
   */
  replyToRequest: (requestId: string, body: string) => Promise<ReplyEmail | false>;
  likePost: (postId: string) => void;
  /**
   * A neighbour answering a post. Returns false when nothing was kept, which
   * is the case for a real association until replies have a table.
   */
  replyToPost: (postId: string, body: string) => boolean;
  /** The signed in owner's own phone and mailing address. */
  updateMyContact: (input: { phone: string; mailingAddress: string }) => Promise<boolean>;
  /** The signed in owner's autopay, or null to turn it off. */
  setAutopay: (plan: AutopayPlan | null) => Promise<boolean>;
  /** The owner's word that a notice about their home is fixed. */
  markViolationFixed: (violationId: string, note: string) => Promise<boolean>;
  /** The board's work order on a maintenance request; null takes it off. */
  setWorkOrder: (requestId: string, workOrder: WorkOrder | null) => void;
  /** Whether the signed in person is coming to a meeting. */
  rsvpMeeting: (meetingId: string, response: "yes" | "no") => Promise<boolean>;
  addActionItem: (input: {
    title: string;
    ownerName: string;
    dueOn?: string;
    meetingId?: string;
  }) => void;
  setActionItemDone: (itemId: string, done: boolean) => void;
  removeActionItem: (itemId: string) => void;
  /** Lets a person in: a household on the roster, invited at their address. */
  approveJoinRequest: (requestId: string, unit: string) => Promise<boolean>;
  /**
   * Lets a requester in on a home already on the register, chosen by the
   * board. `second` shares the home with its owner. Creates no home.
   */
  seatJoinRequest: (requestId: string, ownerId: string, second: boolean) => Promise<boolean>;
  declineJoinRequest: (requestId: string) => Promise<boolean>;
  /**
   * Somebody outside asking in. Works signed out: the code names the
   * association and the board decides. Resolves to the association's name.
   */
  /** The association behind a join code: its name and where it is, or null. */
  lookupJoinCode: (code: string) => Promise<{ name: string; place: string } | null>;
  /** Gives a home's holder an office, whether or not they have signed up yet. */
  setHomeRole: (ownerId: string, role: AccountRole) => void;
  requestToJoin: (input: {
    code: string;
    name: string;
    email: string;
    unit: string;
    note: string;
  }) => Promise<{ ok: true; association: string } | { ok: false; error: string }>;
  /** A bill attached by hand. Email-in lands the same way once it is wired. */
  addInvoice: (invoice: Omit<VendorInvoice, "id" | "status" | "via">) => VendorInvoice;
  /**
   * Pays an invoice by ACH from the operating account. One call writes the
   * payout, the ledger entry and the invoice's paid state, so the three
   * cannot disagree.
   */
  payInvoice: (invoiceId: string, notes?: string) => void;
  approveInvoice: (invoiceId: string) => void;
  rejectInvoice: (invoiceId: string, reason: string) => void;
  /** What the board wrote on a payment. Any payment, not only invoices. */
  setPayoutNotes: (payoutId: string, notes: string) => void;
  /** Moves a notice along, or closes it. Cured is how a notice is resolved. */
  setViolationStage: (violationId: string, stage: Violation["stage"]) => void;
  /**
   * The board's own notice to a home, from its own observation. The simple
   * Notices page since the launch scope: one home, what was seen, optionally
   * which rule. No report behind it and no stage ladder in front of it.
   */
  addNotice: (input: {
    ownerId: string;
    ownerName: string;
    unit: string;
    rule: string;
    fix?: string;
    ruleCitation?: string;
  }) => Violation;
  /** Ends voting. The tally as it stands is the result. */
  closeBallot: (ballotId: string) => void;
  /**
   * A notice from a city or county agency, logged by the board. Not hearsay,
   * so it needs nobody to go and look; the deadline is the whole point.
   */
  addCityNotice: (input: {
    agency: string;
    caseNumber: string;
    deadline: string;
    rule: string;
    ownerId?: string;
    ownerName?: string;
    unit?: string;
  }) => Violation;
}
