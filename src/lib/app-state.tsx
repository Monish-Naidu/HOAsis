"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  allCommunities,
  seededCommunities,
  communityById,
  DEFAULT_COMMUNITY_ID,
} from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import { CircuitBreaker } from "@/lib/core/circuit-breaker";
import { ValidationError } from "@/lib/core/errors";
import { caps, DEFAULT_ROLE_CAPABILITIES, DEFAULT_ROLE_VIEWS, NO_CAPABILITIES, sees as seesArea } from "@/lib/data/accounts";
import { DUES_HIGH_MESSAGE, MAX_DUES_CENTS, isEmail } from "@/lib/input-checks";
import { addDays, daysFromToday, formatDate, setToday, todayIsoDate } from "@/lib/utils";
import { isUuid, newId } from "@/lib/core/ids";
import { PersistedStore, type Store } from "@/lib/core/store";
import { createdCommunitiesStore, saveCreatedCommunity } from "@/lib/data/created-communities";
import {
  useRemote,
  setRemoteAssociation,
  loadRemote,
  preferRemoteAssociation,
  refreshRemote,
  remoteWrite,
  reportRemoteError,
  remoteSnapshot,
  NOTHING_CHANGED,
  WRITE_TIMEOUT_MS,
} from "@/lib/data/remote-store";
import { ownerDues } from "@/lib/home-types";
import { setHomeDues as writeHomeDues } from "@/lib/roster/apply";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import type { Json } from "@/lib/supabase/database.types";
import {
  documentTitle,
  formatSize,
  mimeTypeOf,
  rejectReason,
  storagePathFor,
  toDbVisibility,
  toDocumentRecord,
} from "@/lib/documents";
import { signOutOfSupabase } from "@/lib/auth";

/** The signed in person's id, read straight from the remote store snapshot. */
function sessionUserId(): string | null {
  return remoteSnapshot().profileId;
}

/**
 * The association as it stands when a write runs, not when it was asked for.
 *
 * Writes queue, and each waits for the re-read after the one before it. A
 * write that replaces a whole list (a thread's messages, a seat's
 * permissions) calls this inside its callback, so two quick presses build on
 * each other instead of both building on the copy the screen held at the
 * first press. Falls back to that copy if the person has since switched
 * association.
 */
function latest(rc: Community): Community {
  const now = remoteSnapshot().community;
  return now && now.id === rc.id ? now : rc;
}
import {
  buildCommunity,
  draftCollectionPolicy,
  type CommunityDraft,
  reservableSpaceNames,
} from "@/lib/data/new-community";
import {
  isBudgetLines,
  isChargeLedger,
  isAssociation,
  isCommunitySettings,
  isRecord,
  isRecordArray,
  isSession,
} from "@/lib/core/guards";
import type {
  DocumentRecord,
  Account,
  ActionItem,
  Announcement,
  AutopayPlan,
  Capability,
  JoinRequest,
  WorkOrder,
  ForumPost,
  ForumReply,
  HomeRequest,
  MessageThread,
  Owner,
  HomeType,
  BankAccount,
  AccountRole,
  Violation,
  VendorInvoice,
  ViolationReport,
  AccessLevel,
  Capabilities,
} from "@/lib/types";
import { canRaiseNotice } from "@/lib/violations";
import { chargeProblem } from "@/lib/payments/charges";
import { MANUAL_METHOD_LABEL, manualPaymentLabel, type ManualMethod, type PaymentInstrument } from "@/lib/payments/instruments";
import {
  parseManualLabel,
  reversalReasonProblem,
  pairManualPayments,
  recentManualPayments,
  type HandMethod,
  type ManualPaymentRow,
} from "@/lib/payments/manual-payments";
import { placeLabel } from "@/lib/wording";
import { pickSeat } from "@/lib/home-choice";
import { addStatementLine } from "@/lib/statement";
import { homeCount } from "@/lib/metrics";
import { videoJoinUrl } from "@/lib/meetings/video";
import { statusLabel } from "@/lib/request-status";
import { ballotPhase, meetingPhase } from "@/lib/phases";

export type View = "resident" | "board";

type NoticeKind = "announcement" | "meeting" | "ballot" | "letter" | "message" | "request";

/** What a send that fell short is called in its toast. */
const NOTICE_LABEL: Record<NoticeKind, string> = {
  announcement: "Emailing the announcement",
  meeting: "Emailing the meeting notice",
  ballot: "Emailing the ballot notice",
  letter: "Emailing the letter",
  message: "Emailing the message",
  request: "Emailing the update",
};

/**
 * The server sends for under a minute at a time and answers with how many
 * it did not reach. Asked again it carries on from there, so a long roster
 * is a few calls. Twelve is far more than any roster needs; it is only there
 * so a server that keeps answering "more to go" cannot be asked for ever.
 * It is also only asked again while the number left is going down: a call
 * that leaves as many as the one before is not carrying on, and asking it
 * again could only mail the same homes twice.
 */
const NOTICE_CALLS = 12;

/** A count out of the server's answer, or zero when it sent none. */
const tally = (value: unknown) => (typeof value === "number" && value > 0 ? value : 0);

/** `NOTHING_CHANGED` as its own sentence, for a screen that shows it bare. */
const NOT_CHANGED = `${NOTHING_CHANGED[0].toUpperCase()}${NOTHING_CHANGED.slice(1)}`;

/** Meeting notices being emailed right now, so a second press does not start a second run. */
const noticesInFlight = new Set<string>();

/**
 * Emails what the board just wrote, after the row is in.
 *
 * The record is already right by the time this runs, the server checks the
 * caller's capability and reads the words back from the row, and every
 * attempt lands in email_log whether it went or not. Nothing waits on it
 * except a caller that needs to know: it resolves true when the server ran
 * the send and reported back, whatever the counts, and false when the server
 * refused or could not be reached. What fell short is said here, in a toast.
 *
 * It used to be fired and forgotten. The server stops a long send before its
 * time limit, and nobody read the answer, so a statutory notice to a large
 * roster reached the first part of it and the board was told nothing. Now
 * the answer is read, the send is asked to carry on while homes remain, and
 * anything still unsent at the end is said through the same toast a failed
 * write uses.
 *
 * The server passes over anybody who got the same notice in the last hour
 * and counts them as `already`. They have it, so they are not a failure.
 * But a send that reached nobody new because everybody already had it (an
 * announcement posted again under the same title) emailed nobody, and the
 * board is told that in so many words rather than nothing at all.
 *
 * Only ever called in remote mode; the demo has nobody to email.
 */
async function emailNotice(
  associationId: string,
  notice: {
    kind: NoticeKind;
    id?: string;
    unitIds?: string[];
    subject?: string;
    body?: string;
  },
): Promise<boolean> {
  const label = NOTICE_LABEL[notice.kind];
  let sent = 0;
  let already = 0;
  let failed = 0;
  let remaining = 0;
  let left = Infinity;
  try {
    for (let call = 0; call < NOTICE_CALLS; call++) {
      const response = await fetch("/api/email/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId, ...notice }),
      });
      const answer = ((await response.json().catch(() => null)) ?? {}) as {
        sent?: unknown;
        failed?: unknown;
        already?: unknown;
        remaining?: unknown;
        error?: unknown;
      };
      if (!response.ok) {
        const why = typeof answer.error === "string" && answer.error ? answer.error : "it could not be sent";
        reportRemoteError(`${label}: ${why}. It is saved here, but the email did not go`);
        return false;
      }
      remaining = tally(answer.remaining);
      // Every call passes over the same people and counts them again, so
      // it is the most any one call saw, not the sum of them.
      already = Math.max(already, tally(answer.already));
      sent += tally(answer.sent);
      // The server counts the homes it did not reach among the failed. An
      // address that fails is tried again on the next call, so the worst
      // single call is the count, not the sum of them.
      failed = Math.max(failed, Math.max(0, tally(answer.failed) - remaining));
      if (remaining === 0 || remaining >= left) break;
      left = remaining;
    }
  } catch {
    reportRemoteError(
      `${label}: the mail service could not be reached. It is saved here, but the email did not go`,
    );
    return false;
  }
  const unsent = failed + remaining;
  if (unsent > 0) {
    reportRemoteError(
      `${label}: ${unsent} ${unsent === 1 ? "email was" : "emails were"} not sent. It is saved here`,
    );
  }
  if (sent === 0 && already > 0) {
    reportRemoteError(
      `${label}: the same notice already went to ${already} ${already === 1 ? "owner" : "owners"} in the last hour, so it was not emailed again`,
    );
  }
  return true;
}

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

interface AppState {
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
  sendMeetingNotice: (meetingId: string) => boolean | Promise<boolean>;
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
  /** Returns an undo: confirming moves a transaction into every report. */
  confirmLedgerEntry: (
    entryId: string,
    category?: Community["ledger"][number]["category"],
  ) => () => void;
  dismissLedgerEntry: (entryId: string) => () => void;
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
  replyToThread: (threadId: string, body: string) => void;
  /** An owner starting a conversation with the board. Resolves true when it landed. */
  messageBoard: (
    ownerId: string,
    subject: string,
    body: string,
    tag?: MessageThread["tag"],
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
   * request's conversation and changes nothing else. Resolves true once saved.
   */
  replyToRequest: (requestId: string, body: string) => Promise<boolean>;
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

const Ctx = createContext<AppState | null>(null);

/** The demo's pinned "now", used for every timestamp the app writes. */

/* -------------------------------------------------------------------------- */
/* Stores                                                                      */
/*                                                                             */
/* Everything the demo lets you change lives in one of these. They sit outside */
/* React and are read through useSyncExternalStore, which keeps the server and */
/* client markup in agreement and avoids a setState cascade on every mount.    */
/*                                                                             */
/* Every mutable slice is scoped to a community, so switching associations     */
/* switches the whole dataset rather than blending two of them together.       */
/* -------------------------------------------------------------------------- */

interface Session {
  accountId: string | null;
  view: View;
}

const NO_SESSION: Session = { accountId: null, view: "resident" };

/**
 * One breaker for every store. A browser that refuses site data should trip
 * the circuit once, not once per slice per community.
 */
const storageBreaker = new CircuitBreaker("localStorage", {
  failureThreshold: 3,
  cooldownMs: 30_000,
});

const sessionStore = new PersistedStore<Session>("hoasis-session", NO_SESSION, {
  breaker: storageBreaker,
  validate: isSession,
});

/**
 * The home a person with more than one is looking at, as a unit id. Empty
 * until they choose, and read through the same server snapshot as the other
 * stores, so prerendering is unchanged. It is not scoped to an association:
 * an id that is not one of their seats there simply falls back to the first.
 */
const homeStore = new PersistedStore<string>("hoasis-home", "", {
  breaker: storageBreaker,
  validate: (v): v is string => typeof v === "string",
});

const communityStore = new PersistedStore<string>(
  "hoasis-community",
  DEFAULT_COMMUNITY_ID,
  { breaker: storageBreaker, validate: (v): v is string => typeof v === "string" },
);

/**
 * Photographs owners add of their own homes, keyed by owner id.
 *
 * Browser-only on purpose, for now: the photo is a personal touch on the
 * owner's own dashboard, nothing else reads it, and shipping it without a
 * migration means the card can fall back to the community photo the moment
 * the browser forgets. Syncing it to storage is a later, deliberate step.
 */
const homePhotoStore = new PersistedStore<Record<string, string>>(
  "hoasis-home-photos",
  {},
  {
    breaker: storageBreaker,
    validate: (v): v is Record<string, string> =>
      typeof v === "object" &&
      v !== null &&
      !Array.isArray(v) &&
      Object.values(v).every((x) => typeof x === "string"),
  },
);

/** The slices a board can actually change. Everything else is reference data. */
const MUTABLE_SLICES = [
  "settings",
  "accounts",
  "owners",
  "bankAccounts",
  "ownerCharges",
  "budget",
  "amenities",
  "forms",
  "posts",
  "requests",
  "instruments",
  "ledger",
  "payouts",
  "invoices",
  "vendors",
  "threads",
  "documents",
  "ballots",
  "templates",
  "sharedCosts",
  "sharedCostBills",
  // Both were read-only, which meant four tasks on the setup plan pointed at
  // screens that could not complete them. A plan that cannot be finished is
  // worse than no plan.
  "association",
  "reserveComponents",
  // A board could not create a ballot or schedule a meeting, so for a new
  // association the voting page was four permanent zeroes.
  "meetings",
  // Text imported from an uploaded declaration has to land somewhere, and it
  // is the board's own document rather than reference data.
  "governingDocs",
  // Residents can report, and a board can raise a notice off the back of one
  // once somebody has been out to look.
  "violations",
  "violationReports",
  // What the board tells everyone. Was fixture-only, which meant a real
  // association's residents were reading announcements nobody had written.
  "announcements",
  // What the board agreed to do, and who is waiting to be let in.
  "actionItems",
  "joinRequests",
] as const;

type MutableSlice = (typeof MUTABLE_SLICES)[number];

/**
 * Stores are created on demand, one per community and slice, and cached.
 *
 * Creating them lazily rather than up front means adding a community is a data
 * change with no wiring, and a community you never visit costs nothing. The
 * cache is what keeps `subscribe` and `getSnapshot` referentially stable, which
 * useSyncExternalStore requires.
 */
const registry = new Map<string, PersistedStore<never>>();

/**
 * Bump when the demo fixtures change in a way a browser's remembered copy
 * would hide: a renamed association, a home that moved street. Persisted
 * demo slices are keyed by this, so an old browser starts from the new
 * fixture instead of showing last month's name over this month's data.
 * Session, theme and the chosen community are keyed separately and survive.
 */
const DEMO_FIXTURE_VERSION = 2;

function sliceStore<K extends MutableSlice>(
  communityId: string,
  slice: K,
): PersistedStore<Community[K]> {
  const key = `hoasis:${communityId}:v${DEMO_FIXTURE_VERSION}:${slice}`;
  const existing = registry.get(key);
  if (existing) return existing as unknown as PersistedStore<Community[K]>;

  const seed = communityById(communityId)[slice];
  const store = new PersistedStore(key, seed, {
    breaker: storageBreaker,
    validate:
      slice === "association"
        ? (isAssociation as (v: unknown) => v is Community[K])
        : slice === "settings"
        ? (isCommunitySettings as (v: unknown) => v is Community[K])
        : slice === "ownerCharges"
          ? (isChargeLedger as (v: unknown) => v is Community[K])
          : slice === "budget"
            ? (isBudgetLines as (v: unknown) => v is Community[K])
          : (isRecordArray<{ id: string }>() as unknown as (v: unknown) => v is Community[K]),
  });
  registry.set(key, store as unknown as PersistedStore<never>);
  return store;
}

/** Puts one community back to its seeded state. */
function resetCommunity(communityId: string): void {
  for (const slice of MUTABLE_SLICES) sliceStore(communityId, slice).reset();
}

/**
 * Clears every store, session and community selection included.
 *
 * These stores are module singletons that cache their value, so clearing
 * localStorage alone is not enough to isolate a test. Product code should use
 * `resetDemo`, which deliberately leaves you signed in.
 */
export function resetAllStores(): void {
  sessionStore.reset();
  communityStore.reset();
  for (const community of allCommunities()) resetCommunity(community.id);
}

/**
 * Runs a destructive change and returns a function that puts it back.
 *
 * Snapshotting the whole collection is the right trade here: these are small,
 * and restoring the exact prior array is simpler and safer than re-inserting
 * one record at its old index with its old neighbors.
 */
function destructive<T>(store: Store<T>, mutate: (current: T) => T): () => void {
  const previous = store.getSnapshot();
  store.update(mutate);
  return () => store.set(previous);
}

/**
 * A stable receipt code for one vote.
 *
 * Derived from the ballot and choice rather than a random number so the same
 * vote always yields the same code. A receipt exists so an owner can confirm
 * their vote was counted without the secretary revealing how anyone voted.
 */
function voteReceipt(ballotId: string, optionId: string): string {
  let hash = 7;
  for (const ch of `${ballotId}:${optionId}`) hash = (hash * 31 + ch.charCodeAt(0)) % 10_000;
  return `VR-${todayIsoDate().slice(0, 7)}-${String(hash).padStart(4, "0")}`;
}

/**
 * Setup tasks a demo association has skipped.
 *
 * Separate from the slice registry because it is not part of a community's
 * data, it is a note about how far through setup somebody got.
 */
const dismissRegistry = new Map<string, PersistedStore<string[]>>();

function dismissStore(communityId: string): PersistedStore<string[]> {
  const key = `hoasis:${communityId}:setup-skipped`;
  const existing = dismissRegistry.get(key);
  if (existing) return existing;
  const store = new PersistedStore<string[]>(key, [], {
    breaker: storageBreaker,
    validate: (v): v is string[] =>
      Array.isArray(v) && v.every((x) => typeof x === "string"),
  });
  dismissRegistry.set(key, store);
  return store;
}

/** Reads any Store through React, with the three snapshot callbacks bound once. */
function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

const noopSubscribe = () => () => {};
const alwaysTrue = () => true;
const alwaysFalse = () => false;

/**
 * True only after hydration, so a first paint never redirects a signed in user.
 * The three callbacks are module constants on purpose: an inline arrow here
 * gives useSyncExternalStore a new subscribe identity on every render, and it
 * resubscribes each pass.
 */
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, alwaysTrue, alwaysFalse);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const session = useStore(sessionStore);
  const chosenHome = useStore(homeStore);
  const ready = useHydrated();

  const remote = useRemote();
  const communityId = useStore(communityStore);
  // Created associations live in a store, so the list has to be read rather
  // than captured at import time.
  const createdList = useStore(createdCommunitiesStore);
  const communityList = useMemo(() => [...seededCommunities, ...createdList], [createdList]);
  const community = communityById(communityId);

  // Each association's fixture data is written as of its own date, so the
  // pinned clock follows the community. Set before the slices are read so
  // every derived figure below this line sees the same "today". A real
  // association is read as of the actual date, so its clock is that date;
  // a closing date defaulting to the demo's August would be refused by the
  // database as earlier than the tenure it is closing.
  setToday(remote.community?.asOf ?? community.asOf);

  // One hook per slice, in a fixed order, so the hook count never changes when
  // the community does.
  const settings = useStore(sliceStore(communityId, "settings"));
  const accountList = useStore(sliceStore(communityId, "accounts"));
  const ownerList = useStore(sliceStore(communityId, "owners"));
  const bankAccountList = useStore(sliceStore(communityId, "bankAccounts"));
  const budgetLines = useStore(sliceStore(communityId, "budget"));
  // Demo associations keep their skipped setup tasks here. Real ones keep them
  // in the database, loaded alongside the community.
  const localDismissals = useStore(dismissStore(communityId));
  const ownerChargeMap = useStore(sliceStore(communityId, "ownerCharges"));
  const amenities = useStore(sliceStore(communityId, "amenities"));
  const forms = useStore(sliceStore(communityId, "forms"));
  const posts = useStore(sliceStore(communityId, "posts"));
  const requestList = useStore(sliceStore(communityId, "requests"));
  const instruments = useStore(sliceStore(communityId, "instruments"));
  const ledger = useStore(sliceStore(communityId, "ledger"));
  const payouts = useStore(sliceStore(communityId, "payouts"));
  const invoices = useStore(sliceStore(communityId, "invoices"));
  const vendors = useStore(sliceStore(communityId, "vendors"));
  const threads = useStore(sliceStore(communityId, "threads"));
  const documents = useStore(sliceStore(communityId, "documents"));
  const governingDocs = useStore(sliceStore(communityId, "governingDocs"));
  const violationList = useStore(sliceStore(communityId, "violations"));
  const reportList = useStore(sliceStore(communityId, "violationReports"));
  const associationRow = useStore(sliceStore(communityId, "association"));
  const meetingList = useStore(sliceStore(communityId, "meetings"));
  const reserveComponentList = useStore(sliceStore(communityId, "reserveComponents"));
  const sharedCosts = useStore(sliceStore(communityId, "sharedCosts"));
  const sharedCostBills = useStore(sliceStore(communityId, "sharedCostBills"));
  const ballots = useStore(sliceStore(communityId, "ballots"));
  const templates = useStore(sliceStore(communityId, "templates"));
  // Three slices that were mutable without being subscribed here, so a demo
  // write landed in storage and the screen kept showing the seed until reload.
  const announcementList = useStore(sliceStore(communityId, "announcements"));
  const actionItemList = useStore(sliceStore(communityId, "actionItems"));
  const joinRequestList = useStore(sliceStore(communityId, "joinRequests"));

  // A seat's account id is the profile id, so a person with two homes holds
  // two accounts with one id. Only seats with their own profile id are theirs,
  // which means there is no way to be looking at somebody else's.
  const mySeats = useMemo(() => {
    if (remote.community) {
      return remote.community.accounts.filter((a) => a.id === remote.profileId);
    }
    const demo = accountList.find((candidate) => candidate.id === session.accountId);
    return demo ? [demo] : [];
  }, [remote.community, remote.profileId, accountList, session.accountId]);

  const account = useMemo(() => pickSeat(mySeats, chosenHome), [mySeats, chosenHome]);

  const chooseHome = useCallback(
    (unitId: string) => {
      if (mySeats.some((s) => s.ownerId === unitId)) homeStore.set(unitId);
    },
    [mySeats],
  );

  /* --------------------------------------------------------------- session */

  const signIn = useCallback(
    (id: string) => {
      const next = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === id);
      sessionStore.set({
        accountId: id,
        view: next && next.role !== "resident" ? "board" : "resident",
      });
    },
    [communityId],
  );

  const signOut = useCallback(() => {
    sessionStore.set(NO_SESSION);
    // Clearing the demo seat is not signing out if there is a real session
    // behind it, so end that too rather than leaving somebody logged in on a
    // page that says they are not.
    void signOutOfSupabase();
  }, []);

  const setView = useCallback(
    (view: View) => sessionStore.update((current) => ({ ...current, view })),
    [],
  );

  /**
   * Switching association also signs you out.
   *
   * An account belongs to one community, so carrying a session across would
   * leave a President of one association holding capabilities in another. The
   * safe move is to make the person sign in again on the other side.
   */
  const setCommunity = useCallback(
    (nextId: string): "switched" | "signed-out" => {
      // A real member holding two associations switches between them without
      // signing out, because the database knows which they belong to. Demo
      // seats still sign out, since picking a seat is how you choose a person.
      if (remote.associations.some((a) => a.id === nextId)) {
        void setRemoteAssociation(nextId);
        return "switched";
      }
      sessionStore.set(NO_SESSION);
      communityStore.set(nextId);
      return "signed-out";
    },
    [remote.associations],
  );

  const can = useCallback(
    (c: Capability) => Boolean(account && account.capabilities[c]),
    [account],
  );
  const sees = useCallback((c: Capability) => seesArea(account, c), [account]);

  /* -------------------------------------------------------------- settings */

  const updateSettings = useCallback(
    (patch: SettingsPatch) => {
      if (!remote.community) {
        sliceStore(communityId, "settings").update((current) => ({
          ...current,
          ...patch,
          banner: patch.banner ? { ...current.banner, ...patch.banner } : current.banner,
        }));
        return true;
      }
      // Columns where there are columns; the jsonb patch for the rest.
      const rc = remote.community;
      const columns: Record<string, unknown> = {};
      const extras: Record<string, unknown> = {};
      const COLUMN: Record<string, string> = {
        displayName: "name",
        photoUrl: "photo_url",
        photoCredit: "photo_credit",
        autopayLateAfterDay: "late_after_day",
        paymentFeeCents: "payment_fee_cents",
        paymentFeePaidBy: "payment_fee_paid_by",
        paymentFeeWaivedOnAch: "payment_fee_waived_on_ach",
      };
      for (const [key, value] of Object.entries(patch)) {
        if (COLUMN[key]) columns[COLUMN[key]] = value;
        else extras[key] = value;
      }
      return remoteWrite("Saving settings", async () => {
        const supabase = supabaseBrowser();
        const next: Record<string, unknown> = { ...columns };
        if (Object.keys(extras).length) {
          // Read under the queue, so two quick toggles merge instead of the
          // second writing over the first. A failed read stops here: merging
          // the patch into nothing would replace every other setting with it.
          const { data, error } = await supabase
            .from("associations")
            .select("settings")
            .eq("id", rc.id)
            .single();
          if (error) throw new Error(error.message);
          const stored = (data?.settings as Record<string, unknown> | null) ?? {};
          const settings: Record<string, unknown> = { ...stored, ...extras };
          // The banner is two fields saved one at a time. Merged one level
          // down onto what is stored, so a patch that names only the title
          // cannot put an old copy of the detail over the one saved a moment
          // before it. An association with no banner stored yet starts from
          // the one on screen, so the row is never left with half of one.
          if (isRecord(extras.banner)) {
            settings.banner = {
              ...latest(rc).settings.banner,
              ...(isRecord(stored.banner) ? stored.banner : {}),
              ...extras.banner,
            };
          }
          next.settings = settings;
        }
        return supabase.from("associations").update(next, { count: "exact" }).eq("id", rc.id);
      });
    },
    [remote.community, communityId],
  );

  const setAmenities = useCallback(
    (next: Community["amenities"]) => {
      if (!remote.community) {
        sliceStore(communityId, "amenities").set(next);
        return;
      }
      const rc = remote.community;
      void remoteWrite("Saving amenities", async () => {
        const supabase = supabaseBrowser();
        // What is there now, read when the write runs. `next` and `rc` are
        // the list as the screen drew it, and a row taken away a moment ago
        // stays on screen until the re-read lands. Updating or deleting it
        // again matches nothing, which read as a refusal and dropped the
        // edit made to the row beside it.
        const there = new Set(latest(rc).amenities.map((a) => a.id));
        const keep = new Set<string>();
        for (const amenity of next) {
          if (isUuid(amenity.id) && !there.has(amenity.id)) continue;
          const row = {
            association_id: rc.id,
            name: amenity.name,
            detail: amenity.detail,
            reservable: amenity.reservable,
            status: amenity.status,
            max_hours: amenity.rules?.maxHours ?? amenity.maxHours ?? null,
            rules: amenity.rules ?? null,
          };
          // A screen invents an id for a new item; the database gets to pick
          // the real one, and the row is told apart by whether it is a uuid.
          const id = isUuid(amenity.id) ? amenity.id : newId();
          keep.add(id);
          // An update is aimed at a row that exists, so it is counted: one
          // that row level security hid matches nothing and says nothing.
          const { error, count } = isUuid(amenity.id)
            ? await supabase.from("amenities").update(row, { count: "exact" }).eq("id", id)
            : await supabase.from("amenities").insert({ id, ...row });
          if (error) throw new Error(error.message);
          if (count === 0) throw new Error(NOTHING_CHANGED);
        }
        // Only what the screen listed and left out, and only if it is still
        // there. A row added since the screen drew is not this save's to take.
        const gone = rc.amenities
          .filter((a) => !keep.has(a.id) && there.has(a.id))
          .map((a) => a.id);
        if (gone.length) {
          return supabase.from("amenities").delete({ count: "exact" }).in("id", gone);
        }
      });
    },
    [remote.community, communityId],
  );

  const setForms = useCallback(
    (next: Community["forms"]) => {
      if (!remote.community) {
        sliceStore(communityId, "forms").set(next);
        return;
      }
      // The stock forms ship in code and are not rows, so only what the board
      // uploaded is written, and only it can be taken away.
      const rc = remote.community;
      void remoteWrite("Saving forms", async () => {
        const supabase = supabaseBrowser();
        // As in `setAmenities`: a form removed a moment ago is skipped
        // rather than written to, and is not deleted a second time.
        const there = new Set(latest(rc).forms.map((f) => f.id));
        const keep = new Set<string>();
        for (const form of next) {
          if (form.source !== "uploaded") continue;
          if (isUuid(form.id) && !there.has(form.id)) continue;
          const row = {
            association_id: rc.id,
            label: form.label,
            description: form.description,
            file_name: form.fileName,
            size_label: form.size,
            updated_on: form.updatedDate,
            fields: form.fields ?? null,
            governed_by: form.governedBy ?? null,
            decision_days: form.decisionDays ?? null,
          };
          const id = isUuid(form.id) ? form.id : newId();
          keep.add(id);
          const { error, count } = isUuid(form.id)
            ? await supabase.from("forms").update(row, { count: "exact" }).eq("id", id)
            : await supabase.from("forms").insert({ id, ...row });
          if (error) throw new Error(error.message);
          if (count === 0) throw new Error(NOTHING_CHANGED);
        }
        const gone = rc.forms
          .filter((f) => f.source === "uploaded" && !keep.has(f.id) && there.has(f.id))
          .map((f) => f.id);
        if (gone.length) return supabase.from("forms").delete({ count: "exact" }).in("id", gone);
      });
    },
    [remote.community, communityId],
  );

  const removeForm = useCallback(
    (formId: string) => {
      if (!remote.community) {
        return destructive(sliceStore(communityId, "forms"), (all) =>
          all.filter((f) => f.id !== formId),
        );
      }
      const form = remote.community.forms.find((f) => f.id === formId);
      if (!form || form.source !== "uploaded") {
        reportRemoteError("The stock forms cannot be removed, only the ones you uploaded");
        return () => {};
      }
      const rc = remote.community;
      const row = {
        id: form.id,
        association_id: rc.id,
        label: form.label,
        description: form.description,
        file_name: form.fileName,
        size_label: form.size,
        updated_on: form.updatedDate,
        fields: form.fields ?? null,
        governed_by: form.governedBy ?? null,
        decision_days: form.decisionDays ?? null,
      };
      void remoteWrite("Removing the form", () =>
        supabaseBrowser().from("forms").delete({ count: "exact" }).eq("id", formId),
      );
      return () => {
        void remoteWrite("Restoring the form", () => supabaseBrowser().from("forms").insert(row));
      };
    },
    [remote.community, communityId],
  );

  const removeAmenity = useCallback(
    (amenityId: string) => {
      if (!remote.community) {
        return destructive(sliceStore(communityId, "amenities"), (all) =>
          all.filter((a) => a.id !== amenityId),
        );
      }
      const rc = remote.community;
      const amenity = rc.amenities.find((a) => a.id === amenityId);
      void remoteWrite("Removing the amenity", () =>
        supabaseBrowser().from("amenities").delete({ count: "exact" }).eq("id", amenityId),
      );
      return () => {
        if (!amenity) return;
        void remoteWrite("Restoring the amenity", () =>
          supabaseBrowser().from("amenities").insert({
            id: amenity.id,
            association_id: rc.id,
            name: amenity.name,
            detail: amenity.detail,
            reservable: amenity.reservable,
            status: amenity.status,
            max_hours: amenity.rules?.maxHours ?? amenity.maxHours ?? null,
            rules: amenity.rules ?? null,
          }),
        );
      };
    },
    [remote.community, communityId],
  );

  const setCapability = useCallback(
    (id: string, capability: Capability, level: AccessLevel) => {
      // The President's grid is deliberately immutable. An association that can
      // strip its President of access has no way back in.
      const change = level === "change";
      const view = level === "view";
      if (!remote.community) {
        sliceStore(communityId, "accounts").update((list) =>
          list.map((a) =>
            a.id === id && a.role !== "president"
              ? {
                  ...a,
                  capabilities: { ...a.capabilities, [capability]: change },
                  views: { ...a.views, [capability]: view },
                }
              : a,
          ),
        );
        return;
      }
      const rc = remote.community;
      const seat = rc.accounts.find((a) => a.id === id);
      if (!seat || seat.role === "president") return;
      const held = (set: Capabilities, on: boolean) =>
        Object.entries({ ...set, [capability]: on })
          .filter(([, v]) => v)
          .map(([name]) => name);
      void remoteWrite("Saving access", () => {
        // The seat as the last write left it. Built from the copy on screen,
        // the second of two quick presses on the grid dropped the first.
        const account = latest(rc).accounts.find((a) => a.id === id) ?? seat;
        return supabaseBrowser()
          .from("memberships")
          .update(
            { capabilities: held(account.capabilities, change), views: held(account.views, view) },
            { count: "exact" },
          )
          .eq("association_id", rc.id)
          .eq("profile_id", id)
          .is("ends_on", null);
      });
    },
    [remote.community, communityId],
  );

  const resetDemo = useCallback(() => resetCommunity(communityId), [communityId]);

  /**
   * Founds an association for a signed in person, in Postgres.
   *
   * Distinct from `createCommunity`, which builds one in this browser for
   * somebody evaluating the product. Keeping them apart is deliberate: a demo
   * must never write to the database, and a real association must never be
   * something one browser knows about.
   */
  const createRemoteAssociation = useCallback(async (draft: CommunityDraft) => {
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.rpc("create_association", {
      p_name: draft.name,
      p_city: draft.city,
      p_state: draft.state,
      p_dues_cents: draft.duesCents,
      p_dues_cadence: draft.duesCadence,
      p_due_day: draft.dueDay,
      p_founder_name: draft.founder.name,
      p_founder_unit: draft.founder.unit,
      p_households: draft.households,
      // The three answers, kept. They were being asked and then discarded on
      // this path, so a real board got the generic plan, which is the one
      // outcome the questions exist to prevent.
      p_property_type: draft.propertyType ?? null,
      p_origin: draft.origin ?? null,
      p_collects: draft.collects,
      p_shared_spaces: draft.sharedSpaces,
      p_previously: draft.previously ?? undefined,
      p_founder_address: draft.founder.address?.trim() || undefined,
      // Every kind of home, each home's kind, and what each kind pays.
      p_home_types: draft.homeTypes?.length ? draft.homeTypes : undefined,
      p_dues_by_type: draft.duesByType ?? undefined,
      p_founder_home_type: draft.founder.homeType ?? undefined,
    });
    if (error) throw new Error(error.message);

    const associationId = data as string;

    // The late fee the founder chose, or none, as the collections policy.
    // Written here rather than through `updateSettings`, which acts on the
    // association already open and this one is not yet. The association
    // exists by now, so a failure is said and not thrown.
    {
      const { data: row, error: readError } = await supabase
        .from("associations")
        .select("settings")
        .eq("id", associationId)
        .single();
      const stored = (row?.settings as Record<string, unknown> | null) ?? {};
      const { error: policyError } = readError
        ? { error: readError }
        : await supabase
            .from("associations")
            .update({ settings: { ...stored, collectionPolicy: draftCollectionPolicy(draft) } })
            .eq("id", associationId);
      if (policyError) {
        reportRemoteError(
          `Your association is set up, but its late fee setting was not saved (${policyError.message}). No late fee is charged until you set one in Finances, Past due.`,
        );
      }
    }

    // The shared spaces named during setup become the amenities owners can
    // reserve. Without this the plan asked for them a second time.
    const spaces = reservableSpaceNames(draft.sharedSpaces, draft.customSpaces);
    // The association exists by now, so a failure below is said and the
    // founder still lands in it; throwing would send them back into the
    // wizard to found the same association a second time.
    if (spaces.length) {
      const { error: spacesError } = await supabase.from("amenities").insert(
        spaces.map((name) => ({
          association_id: associationId,
          name,
          detail: "",
          reservable: true,
          status: "open",
        })),
      );
      if (spacesError) {
        reportRemoteError(
          `Your association is set up, but its shared spaces were not saved (${spacesError.message}). Add them from your setup steps.`,
        );
      }
    }

    // The account the books are kept against. The wizard stopped asking for
    // a bank on 2026-10-04, which left a new association with nowhere for a
    // recorded check to land and no account to give a starting balance. It
    // gets a plainly named one; it is a ledger, not a connection, and online
    // money still goes through Stripe.
    {
      const { error: bankError } = await supabase.from("bank_accounts").insert({
        association_id: associationId,
        kind: "operating",
        institution: draft.bankAccount?.institution ?? "Operating account",
        mask: draft.bankAccount?.mask ?? "",
      });
      if (bankError) {
        reportRemoteError(
          `Your association is set up, but its operating account was not created (${bankError.message}). Add it on Finances.`,
        );
      }
    }

    // Each home's own dues amount, now the homes exist. create_association
    // takes none, so they follow it through set_home_dues, the way balances
    // follow an import. The association exists, so a failure is said and the
    // founder still lands in it; Change dues on a household finishes the job.
    {
      const own = [
        ...(draft.founder.duesCents
          ? [{ unit: draft.founder.unit, duesCents: draft.founder.duesCents }]
          : []),
        ...draft.households
          .filter((h) => h.duesCents && h.duesCents > 0)
          .map((h) => ({ unit: h.unit, duesCents: h.duesCents as number })),
      ];
      if (draft.duesByHome && own.length) {
        try {
          await writeHomeDues(associationId, own);
        } catch (duesError) {
          reportRemoteError(
            `Your association is set up, but some homes were not given their own dues (${
              duesError instanceof Error ? duesError.message : "it was not saved"
            }). Open Homeowners and use Change dues on those homes. Until then they pay the usual amount.`,
          );
        }
      }
    }

    // Land in the one just founded, not in whichever this browser had open.
    preferRemoteAssociation(associationId);
    await loadRemote(sessionUserId());
    return associationId;
  }, []);

  /**
   * Appoints a household to an office, or returns them to being a resident.
   *
   * Capabilities reset to that office's defaults, because carrying the old
   * ones over is how a former treasurer keeps the books open. The President's
   * own row is left alone: an association that can demote its President has no
   * way back in.
   */
  const setAccountRole = useCallback(
    (accountId: string, role: AccountRole) => {
      if (!remote.community) {
        sliceStore(communityId, "accounts").update((all) =>
          all.map((account) =>
            account.id === accountId && account.role !== "president"
              ? {
                  ...account,
                  role,
                  capabilities: caps(DEFAULT_ROLE_CAPABILITIES[role] ?? []),
                  views: caps(DEFAULT_ROLE_VIEWS[role] ?? []),
                }
              : account,
          ),
        );
        return;
      }
      const rc = remote.community;
      // Making somebody President is a handover, and the database keeps the
      // rule that there is exactly one; it has its own function for that.
      if (role === "president") {
        void remoteWrite("Transferring the presidency", () =>
          supabaseBrowser().rpc("transfer_presidency", { p_to_profile: accountId }),
        );
        return;
      }
      void remoteWrite("Saving the role", () =>
        supabaseBrowser()
          .from("memberships")
          .update(
            {
              role,
              capabilities: DEFAULT_ROLE_CAPABILITIES[role] ?? [],
              views: DEFAULT_ROLE_VIEWS[role] ?? [],
            },
            { count: "exact" },
          )
          .eq("association_id", rc.id)
          .eq("profile_id", accountId)
          .is("ends_on", null)
          .neq("role", "president"),
      );
    },
    [remote.community, communityId],
  );

  const setHomeRole = useCallback(
    (ownerId: string, role: AccountRole) => {
      if (!remote.community) {
        const account = sliceStore(communityId, "accounts")
          .getSnapshot()
          .find((a) => a.ownerId === ownerId);
        if (account) setAccountRole(account.id, role);
        return;
      }
      const rc = remote.community;
      // The presidency needs a person, not a home; that is a handover.
      if (role === "president") {
        const holder = rc.accounts.find((a) => a.ownerId === ownerId);
        if (holder) setAccountRole(holder.id, role);
        return;
      }
      // Keyed on the home, so an officer can be named before they have
      // signed up. Their capabilities are waiting when they do.
      void remoteWrite("Saving the role", () =>
        supabaseBrowser()
          .from("memberships")
          .update(
            {
              role,
              capabilities: DEFAULT_ROLE_CAPABILITIES[role] ?? [],
              views: DEFAULT_ROLE_VIEWS[role] ?? [],
            },
            { count: "exact" },
          )
          .eq("association_id", rc.id)
          .eq("unit_id", ownerId)
          .is("ends_on", null)
          .neq("role", "president"),
      );
    },
    [remote.community, communityId, setAccountRole],
  );

  /**
   * Setup tasks a board has declared do not apply to them.
   *
   * Kept in the database for a real association and in a local store for a
   * demo, because a checklist that forgets what you told it is worse than one
   * that never asked.
   */
  const dismissedSetupTasks = useMemo(
    () => new Set(remote.community ? remote.dismissals : localDismissals),
    [remote.community, remote.dismissals, localDismissals],
  );

  const dismissSetupTask = useCallback(
    (key: string) => {
      if (!remote.community) {
        dismissStore(communityId).update((all) =>
          all.includes(key) ? all : [...all, key],
        );
        return;
      }
      // Through the same door as every other write, so a refusal is said.
      // Fired straight at the table, a skip the database would not take
      // looked taken until the next load brought the task back.
      const rc = remote.community;
      void remoteWrite("Skipping the step", () =>
        supabaseBrowser()
          .from("setup_dismissals")
          .upsert(
            { association_id: rc.id, task_key: key },
            { onConflict: "association_id,task_key" },
          ),
      );
    },
    [remote.community, communityId],
  );

  const restoreSetupTask = useCallback(
    (key: string) => {
      if (!remote.community) {
        dismissStore(communityId).update((all) => all.filter((k) => k !== key));
        return;
      }
      const rc = remote.community;
      void remoteWrite("Bringing the step back", () =>
        supabaseBrowser()
          .from("setup_dismissals")
          .delete({ count: "exact" })
          .eq("association_id", rc.id)
          .eq("task_key", key),
      );
    },
    [remote.community, communityId],
  );

  /* ----------------------------------------------------------------- money */

  /** Connects an account the association can receive dues into. */
  const addBankAccount = useCallback(
    (account: BankAccount) => {
      if (!remote.community) {
        sliceStore(communityId, "bankAccounts").update((all) => [
          ...all.filter((a) => a.id !== account.id),
          account,
        ]);
        return;
      }
      const rc = remote.community;
      void remoteWrite("Connecting the account", () =>
        supabaseBrowser().from("bank_accounts").insert({
          id: isUuid(account.id) ? account.id : newId(),
          association_id: rc.id,
          kind: account.kind,
          institution: account.institution,
          mask: account.mask,
        }),
      );
    },
    [remote.community, communityId],
  );

  /**
   * The demo's side of a payment: statement line, balance, books, budget and
   * bank, written together. An online payment and one the board enters by
   * hand differ only in the words on the line and the date.
   */
  const applyLocalPayment = useCallback(
    (input: {
      ownerId: string;
      amountCents: number;
      processorCents: number;
      platformCents: number;
      platformPaidBy: "owner" | "association";
      label: string;
      method: string;
      date: string;
    }) => {
      const date = input.date;
      const charges = sliceStore(communityId, "ownerCharges");
      const existing = charges.getSnapshot()[input.ownerId] ?? [];

      // What each charge still owes, after everything already applied to it.
      const paidAgainst = new Map<string, number>();
      for (const line of existing) {
        for (const applied of line.appliedTo ?? []) {
          paidAgainst.set(
            applied.chargeId,
            (paidAgainst.get(applied.chargeId) ?? 0) + applied.amountCents,
          );
        }
      }

      // Oldest first. The stored ledger is newest first, so walk it backwards.
      // Only bills already due are paid toward, as record_payment does: a
      // bill posted early waits for its date, and money sent ahead of it
      // stays a payment on the statement.
      let remaining = input.amountCents;
      const appliedTo: { chargeId: string; label: string; amountCents: number }[] = [];
      for (const line of [...existing].reverse()) {
        if (remaining <= 0) break;
        if (line.kind !== "charge" || line.date > date) continue;
        const open = line.amountCents - (paidAgainst.get(line.id) ?? 0);
        if (open <= 0) continue;
        const take = Math.min(open, remaining);
        appliedTo.push({ chargeId: line.id, label: line.label, amountCents: take });
        remaining -= take;
      }

      const owners = sliceStore(communityId, "owners");
      const owner = owners.getSnapshot().find((o) => o.id === input.ownerId);
      const balanceAfter = Math.max(0, (owner?.balanceCents ?? 0) - input.amountCents);

      // Placed by its date, after the charges of that day, with the running
      // balances restated: written at the top it sat above a bill dated
      // later and the balance beside it read as if paid before billed.
      const headBefore = existing[0]?.balanceAfterCents ?? owner?.balanceCents ?? 0;
      charges.update((all) => ({
        ...all,
        [input.ownerId]: addStatementLine(
          all[input.ownerId] ?? [],
          {
            id: `pay-${date}-${input.ownerId}-${existing.length + 1}`,
            date,
            label: input.label,
            kind: "payment" as const,
            amountCents: -input.amountCents,
            balanceAfterCents: headBefore - input.amountCents,
            method: input.method,
            feeCents: input.processorCents,
            feePaidBy: "association" as const,
            // An early payment covers nothing yet, and saying so beats
            // inventing a charge for it to have paid.
            ...(appliedTo.length ? { appliedTo } : {}),
          },
          headBefore - input.amountCents,
        ),
      }));

      owners.update((all) =>
        all.map((o) =>
          o.id === input.ownerId
            ? { ...o, balanceCents: balanceAfter, daysPastDue: 0, standing: "current" as const }
            : o,
        ),
      );

      // The association keeps the assessment; the processor takes its cut out
      // of the deposit, and our fee only if the association agreed to carry it.
      const absorbed =
        input.processorCents + (input.platformPaidBy === "association" ? input.platformCents : 0);
      const operating = sliceStore(communityId, "bankAccounts")
        .getSnapshot()
        .find((a) => a.kind === "operating");

      sliceStore(communityId, "ledger").update((all) => [
        // Worded and booked as record_payment does it (0101): the whole
        // payment in, and the processor's fee out as its own line, so the
        // board can see where the difference went.
        ...(absorbed > 0
          ? [
              {
                id: `led-${date}-${input.ownerId}-fee-${all.length + 1}`,
                date,
                description: `Processing fee, unit ${owner?.unit ?? "?"}`,
                counterparty: "Stripe",
                category: "Processing fees" as const,
                accountId: operating?.id ?? "unassigned",
                amountCents: -absorbed,
                status: "cleared" as const,
                matchedBy: "auto" as const,
                ownerId: input.ownerId,
              },
            ]
          : []),
        {
          id: `led-${date}-${input.ownerId}-${all.length + 1}`,
          date,
          description: `Assessment payment, unit ${owner?.unit ?? "?"}`,
          counterparty: owner?.displayName ?? "Owner",
          category: "Assessments" as const,
          accountId: operating?.id ?? "unassigned",
          amountCents: input.amountCents,
          status: "cleared" as const,
          matchedBy: "auto" as const,
          ownerId: input.ownerId,
        },
        ...all,
      ]);

      // Income against budget is what tells a board whether collections are on
      // pace. Moving cash without moving this is how a dashboard ends up
      // reporting a full bank account and nothing collected.
      sliceStore(communityId, "budget").update((all) =>
        all.map((line) =>
          line.kind === "income" && line.category === "Assessments"
            ? { ...line, ytdActualCents: line.ytdActualCents + input.amountCents }
            : line,
        ),
      );

      if (operating) {
        sliceStore(communityId, "bankAccounts").update((all) =>
          all.map((a) =>
            a.id === operating.id
              ? { ...a, balanceCents: a.balanceCents + input.amountCents - absorbed }
              : a,
          ),
        );
      }
    },
    [communityId],
  );

  /**
   * Records a payment everywhere it has to appear.
   *
   * This is the seam the whole product turns on. A payment is not one fact, it
   * is four: the household's statement, the household's balance, the
   * association's books, and the bank balance the board reconciles against.
   * Writing one and not the others is exactly the drift this product exists to
   * argue against, so they are written together or not at all.
   *
   * Money is applied to the oldest open charge first, which is the convention
   * every collection policy assumes and the one owners are told about.
   */
  const recordPayment = useCallback(
    (input: {
      ownerId: string;
      amountCents: number;
      /** What the processor takes out of the deposit. */
      processorCents: number;
      /** Our fee, and who carried it. */
      platformCents: number;
      platformPaidBy: "owner" | "association";
      method: string;
      kind: "ach" | "card" | "apple-pay";
    }) => {
      if (remote.community) {
        // The database does all four writes in one function, so a payment
        // cannot land on the statement and miss the books.
        void remoteWrite("Recording the payment", () =>
          supabaseBrowser().rpc("record_payment", {
            p_unit_id: input.ownerId,
            p_amount_cents: input.amountCents,
            p_rail: input.kind,
            p_processor_fee_cents: input.processorCents,
            p_platform_fee_cents: input.platformCents,
            p_platform_fee_paid_by: input.platformPaidBy,
          }),
        );
        return;
      }
      applyLocalPayment({
        ...input,
        label: input.kind === "ach" ? "Bank payment" : `Card payment, ${input.method}`,
        date: todayIsoDate(),
      });
    },
    [remote.community, applyLocalPayment],
  );

  /**
   * A check or cash the board received. Real associations go through
   * record_manual_payment (0083), which writes the statement line, the
   * allocations and the deposit together and takes the date the money
   * arrived. The demo does the same locally. Resolves once the write is
   * back, so the form can say "recorded" only when it was.
   */
  const recordManualPayment = useCallback(
    (input: {
      ownerId: string;
      amountCents: number;
      method: ManualMethod;
      reference: string;
      receivedOn: string;
    }) => {
      if (remote.community) {
        return remoteWrite("Recording the payment", () =>
          supabaseBrowser().rpc("record_manual_payment", {
            p_unit_id: input.ownerId,
            p_amount_cents: input.amountCents,
            p_method: input.method,
            p_reference: input.reference.trim(),
            p_received_on: input.receivedOn,
          }),
        );
      }
      applyLocalPayment({
        ownerId: input.ownerId,
        amountCents: input.amountCents,
        processorCents: 0,
        platformCents: 0,
        platformPaidBy: "association",
        label: manualPaymentLabel(input.method, input.reference),
        method: MANUAL_METHOD_LABEL[input.method],
        date: input.receivedOn,
      });
      return true;
    },
    [remote.community, applyLocalPayment],
  );

  /**
   * Takes a check or cash back off the books. Real associations go through
   * reverse_manual_payment (0088), which stores it as a full refund: the
   * payment reads refunded, the home is charged the amount again and the
   * deposit is offset. The demo does the same locally.
   */
  const reverseManualPayment = useCallback(
    (paymentId: string, reason: string) => {
      const why = reason.trim();
      if (!can("finances")) return false;
      if (reversalReasonProblem(why)) return false;
      if (remote.community) {
        return remoteWrite("Reversing the payment", () =>
          supabaseBrowser().rpc("reverse_manual_payment", {
            p_payment_id: paymentId,
            p_reason: why,
          }),
        );
      }
      const date = todayIsoDate();
      const charges = sliceStore(communityId, "ownerCharges");
      let ownerId: string | null = null;
      let amountCents = 0;
      for (const [id, lines] of Object.entries(charges.getSnapshot())) {
        const line = lines.find((l) => l.id === paymentId);
        if (line) {
          ownerId = id;
          amountCents = -line.amountCents;
        }
      }
      if (!ownerId || amountCents <= 0) return false;
      const owners = sliceStore(communityId, "owners");
      const owner = owners.getSnapshot().find((o) => o.id === ownerId);
      const balanceAfter = (owner?.balanceCents ?? 0) + amountCents;
      const homeId = ownerId;
      charges.update((all) => ({
        ...all,
        [homeId]: [
          {
            id: `reversal-${date}-${paymentId}`,
            date,
            label: `Payment reversed: ${why}`,
            kind: "charge" as const,
            // As reverse_manual_payment writes it (0088): not dues, so no
            // bill, skip or late fee logic reads the line as one.
            category: "other",
            amountCents,
            balanceAfterCents: balanceAfter,
          },
          ...(all[homeId] ?? []).map((l) => (l.id === paymentId ? { ...l, reversed: true } : l)),
        ],
      }));
      owners.update((all) =>
        all.map((o) => (o.id === homeId ? { ...o, balanceCents: balanceAfter } : o)),
      );
      // The deposit comes back out of the books and the bank, as the money
      // went in, so collected and the bank balance fall with the balance.
      const operating = sliceStore(communityId, "bankAccounts")
        .getSnapshot()
        .find((a) => a.kind === "operating");
      sliceStore(communityId, "ledger").update((all) => [
        {
          id: `led-reversal-${date}-${paymentId}`,
          date,
          description: `Payment reversed, ${placeLabel(owner?.unit ?? "?")}`,
          counterparty: owner?.displayName ?? "Owner",
          category: "Assessments" as const,
          accountId: operating?.id ?? "unassigned",
          amountCents: -amountCents,
          status: "cleared" as const,
          matchedBy: "auto" as const,
          ownerId: homeId,
        },
        ...all,
      ]);
      sliceStore(communityId, "budget").update((all) =>
        all.map((line) =>
          line.kind === "income" && line.category === "Assessments"
            ? { ...line, ytdActualCents: line.ytdActualCents - amountCents }
            : line,
        ),
      );
      if (operating) {
        sliceStore(communityId, "bankAccounts").update((all) =>
          all.map((a) =>
            a.id === operating.id ? { ...a, balanceCents: a.balanceCents - amountCents } : a,
          ),
        );
      }
      return true;
    },
    [can, remote.community, communityId],
  );

  /**
   * One home's checks and cash entered by hand. A payments row carries no
   * date or reference, so those are read off the statement line written
   * beside it. Row level security already lets a finance holder read both.
   */
  const manualPaymentsFor = useCallback(
    async (ownerId: string): Promise<ManualPaymentRow[]> => {
      if (remote.community) {
        if (!isUuid(ownerId)) return [];
        const supabase = supabaseBrowser();
        const [paid, lines] = await Promise.all([
          supabase
            .from("payments")
            .select("id, amount_cents, rail, state, refunded_cents, created_at")
            .eq("unit_id", ownerId)
            .in("rail", ["check", "cash"])
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("charges")
            .select("label, amount_cents, due_on")
            .eq("unit_id", ownerId)
            .eq("kind", "payment")
            .or("label.like.Check payment*,label.like.Cash payment*")
            .order("created_at", { ascending: true }),
        ]);
        if (paid.error) throw new Error(paid.error.message);
        if (lines.error) throw new Error(lines.error.message);
        return recentManualPayments(
          pairManualPayments(
            [...(paid.data ?? [])].reverse().map((p) => ({
              id: p.id,
              amountCents: p.amount_cents,
              method: p.rail as HandMethod,
              reversed: p.state === "refunded" || p.refunded_cents > 0,
              createdOn: p.created_at.slice(0, 10),
            })),
            (lines.data ?? []).map((l) => ({
              label: l.label,
              amountCents: -l.amount_cents,
              date: l.due_on,
            })),
          ),
        );
      }
      const lines = sliceStore(communityId, "ownerCharges").getSnapshot()[ownerId] ?? [];
      const rows: ManualPaymentRow[] = [];
      for (const l of lines) {
        const parsed = l.kind === "payment" ? parseManualLabel(l.label) : null;
        if (!parsed) continue;
        rows.push({
          id: l.id,
          amountCents: -l.amountCents,
          method: parsed.method,
          receivedOn: l.date,
          reference: parsed.reference,
          reversed: Boolean(l.reversed),
        });
      }
      return recentManualPayments(rows);
    },
    [remote.community, communityId],
  );

  /**
   * A credit on one home's statement, such as a late fee waived. It lowers
   * what the home owes and is not money in the bank, so the books get no
   * line. A finance holder may insert a charge directly (charges_write), so
   * this needs no function of its own.
   */
  const addCredit = useCallback(
    (input: { ownerId: string; amountCents: number; reason: string }) => {
      const reason = input.reason.trim();
      if (input.amountCents <= 0 || !reason) return false;
      const date = todayIsoDate();
      if (remote.community) {
        const rc = remote.community;
        return remoteWrite("Adding the credit", () =>
          supabaseBrowser().from("charges").insert({
            association_id: rc.id,
            unit_id: input.ownerId,
            kind: "credit",
            label: reason,
            amount_cents: -input.amountCents,
            due_on: date,
          }),
        );
      }
      const owner = sliceStore(communityId, "owners")
        .getSnapshot()
        .find((o) => o.id === input.ownerId);
      const balanceAfter = (owner?.balanceCents ?? 0) - input.amountCents;
      sliceStore(communityId, "ownerCharges").update((all) => ({
        ...all,
        [input.ownerId]: [
          {
            id: `credit-${date}-${input.ownerId}-${(all[input.ownerId] ?? []).length + 1}`,
            date,
            label: reason,
            kind: "credit" as const,
            amountCents: -input.amountCents,
            balanceAfterCents: balanceAfter,
          },
          ...(all[input.ownerId] ?? []),
        ],
      }));
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) => (o.id === input.ownerId ? { ...o, balanceCents: balanceAfter } : o)),
      );
      return true;
    },
    [remote.community, communityId],
  );


  /** One charge line on a home's demo statement, with the balance it leaves. */
  const addLocalCharge = useCallback(
    (ownerId: string, amountCents: number, label: string, dueOn: string) => {
      const owner = sliceStore(communityId, "owners")
        .getSnapshot()
        .find((o) => o.id === ownerId);
      const balanceAfter = (owner?.balanceCents ?? 0) + amountCents;
      sliceStore(communityId, "ownerCharges").update((all) => ({
        ...all,
        [ownerId]: [
          {
            id: `charge-${dueOn}-${ownerId}-${(all[ownerId] ?? []).length + 1}`,
            date: dueOn,
            label,
            kind: "charge" as const,
            amountCents,
            balanceAfterCents: balanceAfter,
          },
          ...(all[ownerId] ?? []),
        ],
      }));
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) => (o.id === ownerId ? { ...o, balanceCents: balanceAfter } : o)),
      );
    },
    [communityId],
  );

  /**
   * A one-off charge on one home. Real associations go through add_charge
   * (0086), which checks the amount, the label and the date again and writes
   * the activity record; the demo puts the line on the statement locally.
   * The charge is not dues, so it draws no late fee.
   */
  const addCharge = useCallback(
    (input: { ownerId: string; amountCents: number; label: string; dueOn: string }) => {
      const label = input.label.trim();
      if (!can("finances")) return false;
      if (chargeProblem({ ...input, label }, todayIsoDate())) return false;
      if (remote.community) {
        return remoteWrite("Adding the charge", () =>
          supabaseBrowser().rpc("add_charge", {
            p_unit_id: input.ownerId,
            p_amount_cents: input.amountCents,
            p_label: label,
            p_due_on: input.dueOn,
          }),
        );
      }
      addLocalCharge(input.ownerId, input.amountCents, label, input.dueOn);
      return true;
    },
    [can, remote.community, addLocalCharge],
  );

  /** The same one-off charge on every home, in one transaction. */
  const addChargeToAll = useCallback(
    (input: { amountCents: number; label: string; dueOn: string }) => {
      const label = input.label.trim();
      if (!can("finances")) return false;
      if (chargeProblem({ ...input, label }, todayIsoDate())) return false;
      if (remote.community) {
        const rc = remote.community;
        return remoteWrite("Adding the charge to every home", () =>
          supabaseBrowser().rpc("add_charge_to_all", {
            p_association_id: rc.id,
            p_amount_cents: input.amountCents,
            p_label: label,
            p_due_on: input.dueOn,
          }),
        );
      }
      for (const o of sliceStore(communityId, "owners").getSnapshot()) {
        addLocalCharge(o.id, input.amountCents, label, input.dueOn);
      }
      return true;
    },
    [can, remote.community, communityId, addLocalCharge],
  );

  /**
   * What one bank account held on the day the books started here. One
   * confirmed ledger line in the "Opening balance" category, which the
   * metrics already keep out of income and spending, replacing an earlier
   * opening line for the same account so correcting it never stacks two.
   * A finance holder may write ledger lines directly (ledger_write).
   */
  const setOpeningBankBalance = useCallback(
    (accountId: string, input: { amountCents: number; asOf: string }) => {
      if (input.amountCents < 0) return false;
      if (remote.community) {
        const rc = remote.community;
        if (!isUuid(accountId)) return false;
        return remoteWrite("Saving the opening balance", async () => {
          const supabase = supabaseBrowser();
          const { error: clearError } = await supabase
            .from("ledger_entries")
            .delete()
            .eq("association_id", rc.id)
            .eq("bank_account_id", accountId)
            .eq("category", "Opening balance");
          if (clearError) throw new Error(clearError.message);
          return supabase.from("ledger_entries").insert({
            association_id: rc.id,
            bank_account_id: accountId,
            occurred_on: input.asOf,
            description: "Opening balance",
            counterparty: "",
            category: "Opening balance",
            amount_cents: input.amountCents,
            confirmed_at: new Date().toISOString(),
          });
        });
      }
      const ledger = sliceStore(communityId, "ledger");
      const earlier = ledger
        .getSnapshot()
        .filter((e) => e.accountId === accountId && e.category === "Opening balance")
        .reduce((t, e) => t + e.amountCents, 0);
      ledger.update((all) => [
        {
          id: `led-opening-${accountId}`,
          date: input.asOf,
          description: "Opening balance",
          counterparty: "",
          category: "Opening balance" as const,
          accountId,
          amountCents: input.amountCents,
          status: "cleared" as const,
          matchedBy: "manual" as const,
        },
        ...all.filter((e) => !(e.accountId === accountId && e.category === "Opening balance")),
      ]);
      sliceStore(communityId, "bankAccounts").update((all) =>
        all.map((a) =>
          a.id === accountId ? { ...a, balanceCents: a.balanceCents - earlier + input.amountCents } : a,
        ),
      );
      return true;
    },
    [remote.community, communityId],
  );

  /**
   * Adds a household to the roster, with the account that lets them sign in.
   *
   * An owner and an account are created together because in an association
   * they are the same fact: the register says who the members are, and every
   * member gets access. Splitting them lets the two drift.
   */
  const addOwnerSaving = useCallback(
    (input: {
      name: string;
      email: string;
      unit: string;
      homeType?: HomeType;
    }): { owner: Owner; saved: Promise<boolean> } => {
      const unit = input.unit.trim();
      const existing = remote.community
        ? remote.community.owners
        : sliceStore(communityId, "owners").getSnapshot();
      if (existing.some((o) => o.unit === unit)) {
        throw new ValidationError(`${placeLabel(unit)} is already on the roster`, { unit });
      }

      // The id is chosen here so the screen can name the household before
      // the write lands; the database takes it as given.
      const ownerId = remote.community ? newId() : `${communityId}-own-${unit}`;
      const owner: Owner = {
        id: ownerId,
        displayName: input.name.trim(),
        members: [input.name.trim()],
        email: input.email.trim(),
        phone: "",
        unit,
        address: placeLabel(unit),
        moveInDate: todayIsoDate(),
        balanceCents: 0,
        autopay: false,
        standing: "current",
        daysPastDue: 0,
        homeType: input.homeType,
      };

      if (remote.community) {
        const rc = remote.community;
        const saved = remoteWrite("Adding the home", async () => {
          const added = await supabaseBrowser().rpc("add_household", {
            p_association_id: rc.id,
            p_unit_id: ownerId,
            p_name: owner.displayName,
            p_email: owner.email,
            p_unit: unit,
          });
          // The kind of home rides on the unit the function just made.
          if (added.error || !input.homeType) return added;
          return supabaseBrowser()
            .from("units")
            .update({ home_type: input.homeType })
            .eq("id", ownerId);
        });
        return { owner, saved };
      }

      sliceStore(communityId, "owners").update((all) => [...all, owner]);
      sliceStore(communityId, "accounts").update((all) => [
        ...all,
        {
          id: `${communityId}-acct-${unit}`,
          ownerId,
          name: owner.displayName,
          email: owner.email,
          unit,
          role: "resident" as const,
          capabilities: NO_CAPABILITIES,
          views: NO_CAPABILITIES,
        },
      ]);
      return { owner, saved: Promise.resolve(true) };
    },
    [remote.community, communityId],
  );

  /**
   * The household at once, for a screen that names it before the write
   * lands. A caller whose next step depends on the write having landed uses
   * `addOwnerSaving` and waits for `saved`.
   */
  const addOwner = useCallback(
    (input: { name: string; email: string; unit: string; homeType?: HomeType }) =>
      addOwnerSaving(input).owner,
    [addOwnerSaving],
  );

  /**
   * What each home owed on the day the association switched to us.
   *
   * The one step that makes a move from anywhere else work end to end, and the
   * reason nothing in this product imports a ledger. Reproducing a decade of
   * somebody else's history is where a migration stalls, and the reproduced
   * version is never right anyway: a single opening figure per home is enough
   * to be correct from the switch date forward.
   *
   * It is written as a dated line on the statement rather than as a number
   * that appears from nowhere, because an owner who cannot see where a balance
   * came from disputes it, and a board that cannot show where it came from
   * loses that dispute.
   */
  const setHouseholdOwner = useCallback(
    (ownerId: string, input: { name: string; email: string }) => {
      const name = input.name.trim();
      const email = input.email.trim();
      if (remote.community) {
        // The empty membership the founding wizard left on the home takes the
        // name, so the row on the roster becomes theirs rather than a second
        // household on the same lot. Seating waits for them to sign in.
        //
        // Counted, because there is no insert behind this: a home with no
        // empty seat, or one this officer may not write, matched nothing,
        // saved nothing and was still reported as "Jane Doe is on 12".
        return remoteWrite("Adding the owner", () =>
          supabaseBrowser()
            .from("memberships")
            .update({ full_name: name, invited_email: email || null }, { count: "exact" })
            .eq("unit_id", ownerId)
            .is("profile_id", null)
            .is("ends_on", null),
        );
      }
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) =>
          o.id === ownerId
            ? { ...o, displayName: name, members: [name], email, placeholder: false }
            : o,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /**
   * The demo's version of a seat: the person is named on the home and gets an
   * account of their own. Two accounts can point at one home, which is what
   * a second owner is. Nothing is added to the register.
   */
  const seatInDemo = useCallback(
    (ownerId: string, input: { name: string; email: string }, second: boolean) => {
      const owners = sliceStore(communityId, "owners");
      const owner = owners.getSnapshot().find((o) => o.id === ownerId);
      if (!owner) return false;
      const name = input.name.trim();
      const email = input.email.trim();
      const accounts = sliceStore(communityId, "accounts");
      const onHome = accounts.getSnapshot().filter((a) => a.ownerId === ownerId);
      if (second || owner.placeholder) {
        // A second owner joins the names on title; the first owner of an
        // empty home replaces the stand in name.
        owners.update((all) =>
          all.map((o) =>
            o.id !== ownerId
              ? o
              : second
                ? { ...o, members: [...o.members, name] }
                : { ...o, displayName: name, members: [name], email, placeholder: false },
          ),
        );
        accounts.update((all) => [
          ...all,
          {
            id: `${communityId}-acct-${owner.unit}${second ? `-${onHome.length + 1}` : ""}`,
            ownerId,
            name,
            email,
            unit: owner.unit,
            role: "resident" as const,
            capabilities: NO_CAPABILITIES,
            views: NO_CAPABILITIES,
          },
        ]);
        return true;
      }
      // A home with a listed owner who has no email: the requester takes it.
      owners.update((all) =>
        all.map((o) => (o.id === ownerId ? { ...o, displayName: name, members: [name], email } : o)),
      );
      accounts.update((all) =>
        all.map((a) => (a.ownerId === ownerId ? { ...a, name, email } : a)),
      );
      return true;
    },
    [communityId],
  );

  /**
   * A second owner of a home that already has one. They are a second seat on
   * the same home: the bill, the balance and the vote stay the home's.
   */
  const addSecondOwner = useCallback(
    (ownerId: string, input: { name: string; email: string }) => {
      if (remote.community) {
        return remoteWrite("Adding the second owner", () =>
          supabaseBrowser().rpc("add_second_owner", {
            p_unit_id: ownerId,
            p_name: input.name.trim(),
            p_email: input.email.trim(),
          }),
        );
      }
      return Promise.resolve(seatInDemo(ownerId, input, true));
    },
    [remote.community, seatInDemo],
  );

  /**
   * One owner of two taken off the home, today. The other owner keeps the
   * home, the bill and the vote. A real association asks remove_owner (0090),
   * which refuses the only owner, the president and anybody on the board; the
   * demo drops the second name and account from the household.
   */
  const removeCoOwner = useCallback(
    (ownerId: string, seatId: string) => {
      if (remote.community) {
        return remoteWrite("Removing the owner", () =>
          supabaseBrowser().rpc("remove_owner", { p_membership_id: seatId }),
        );
      }
      const accounts = sliceStore(communityId, "accounts");
      const gone = accounts.getSnapshot().find((a) => a.id === seatId && a.ownerId === ownerId);
      const onHome = accounts.getSnapshot().filter((a) => a.ownerId === ownerId);
      if (!gone || onHome.length < 2) return Promise.resolve(false);
      accounts.update((all) => all.filter((a) => a.id !== seatId));
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) => {
          if (o.id !== ownerId) return o;
          const members = o.members.filter((m) => m !== gone.name);
          const first = members[0] ?? o.displayName;
          return {
            ...o,
            members,
            displayName: o.displayName === gone.name ? first : o.displayName,
            email: o.email === gone.email ? (onHome.find((a) => a.id !== seatId)?.email ?? o.email) : o.email,
          };
        }),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /**
   * Corrects the address a listed owner will claim their seat with.
   * claim_my_seats matches it on the next sign in or press of their
   * invitation link, so a typo no longer strands them.
   */
  const changeOwnerEmail = useCallback(
    (ownerId: string, email: string) => {
      const next = email.trim();
      if (remote.community) {
        const current = remote.community.owners.find((o) => o.id === ownerId);
        return remoteWrite("Changing the email", () =>
          supabaseBrowser().rpc("change_owner_email", {
            p_unit_id: ownerId,
            p_old_email: current?.email ?? "",
            p_new_email: next,
          }),
        );
      }
      const was = sliceStore(communityId, "owners").getSnapshot().find((o) => o.id === ownerId)?.email;
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) => (o.id === ownerId ? { ...o, email: next } : o)),
      );
      sliceStore(communityId, "accounts").update((all) =>
        all.map((a) => (a.ownerId === ownerId && a.email === was ? { ...a, email: next } : a)),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /**
   * Correcting what kind of home a home is.
   *
   * The kind decides the dues it is billed from the next due date on; bills
   * already issued keep their amount, because an owner's statement never
   * changes behind them.
   */
  const setHomeType = useCallback(
    (ownerIds: string[], homeType: HomeType) => {
      if (!ownerIds.length) return true;
      if (remote.community) {
        return remoteWrite("Saving the kind of home", () =>
          supabaseBrowser()
            .from("units")
            .update({ home_type: homeType }, { count: "exact" })
            .in("id", ownerIds),
        );
      }
      const ids = new Set(ownerIds);
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) => (ids.has(o.id) ? { ...o, homeType } : o)),
      );
      return true;
    },
    [remote.community, communityId],
  );

  /**
   * One home's own dues, or several. `set_home_dues` (0084) is the only way
   * in: a finance holder may call it and a settings holder may too, which a
   * plain update of the units table would not allow the first. Bills already
   * issued keep their amount.
   */
  const setHomeDues = useCallback(
    (changes: { ownerId: string; cents: number | null }[]) => {
      if (!changes.length) return true;
      if (changes.some((c) => c.cents !== null && (!Number.isInteger(c.cents) || c.cents < 0))) {
        reportRemoteError("Dues cannot be negative");
        return false;
      }
      if (changes.some((c) => c.cents !== null && c.cents > MAX_DUES_CENTS)) {
        reportRemoteError(DUES_HIGH_MESSAGE);
        return false;
      }
      if (remote.community) {
        return remoteWrite("Saving dues", async () => {
          const supabase = supabaseBrowser();
          for (const { ownerId, cents } of changes) {
            const { error } = await supabase.rpc("set_home_dues", {
              p_unit_id: ownerId,
              p_dues_cents: cents,
            });
            if (error) throw new Error(error.message);
          }
        }, { timeoutMs: WRITE_TIMEOUT_MS + changes.length * 1_000 });
      }
      const byOwner = new Map(changes.map((c) => [c.ownerId, c.cents]));
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) => {
          if (!byOwner.has(o.id)) return o;
          const cents = byOwner.get(o.id);
          // Zero reads as no amount, as it does in the database.
          const { duesCents: _was, ...rest } = o;
          void _was;
          return cents ? { ...rest, duesCents: cents } : rest;
        }),
      );
      return true;
    },
    [remote.community, communityId],
  );

  const setOpeningBalances = useCallback(
    (asOf: string, balances: { ownerId: string; amountCents: number }[]) => {
      if (remote.community) {
        // One dated line per home, replaced rather than stacked when it is
        // corrected. The balance view sums it with everything else.
        const rc = remote.community;
        return remoteWrite("Saving opening balances", async () => {
          const supabase = supabaseBrowser();
          for (const { ownerId, amountCents } of balances) {
            const { error: clearError } = await supabase
              .from("charges")
              .delete()
              .eq("unit_id", ownerId)
              .eq("label", "Balance brought forward");
            if (clearError) throw new Error(clearError.message);
            if (amountCents === 0) continue;
            const { error } = await supabase.from("charges").insert({
              association_id: rc.id,
              unit_id: ownerId,
              kind: amountCents > 0 ? "charge" : "credit",
              label: "Balance brought forward",
              amount_cents: amountCents,
              due_on: asOf,
            });
            if (error) throw new Error(error.message);
          }
          // Two statements a home, one after the other, so a long roster is
          // given longer than a single write before it is called stuck.
        }, { timeoutMs: WRITE_TIMEOUT_MS + balances.length * 1_000 });
      }
      const byOwner = new Map(balances.map((b) => [b.ownerId, b.amountCents]));

      // Only the balance moves. Standing and days past due are deliberately
      // left alone: a figure typed into a box says what is owed and says
      // nothing about how long it has been owed, and turning it into
      // "collections" would drop a household onto the enforcement ladder on
      // their first day here on the strength of an inference. The ladder runs
      // off the calendar from the switch date, which is the whole reason it is
      // defensible at a hearing.
      sliceStore(communityId, "owners").update((all) =>
        all.map((owner) => {
          const amount = byOwner.get(owner.id);
          return amount === undefined ? owner : { ...owner, balanceCents: amount };
        }),
      );

      sliceStore(communityId, "ownerCharges").update((all) => {
        const next = { ...all };
        for (const { ownerId, amountCents } of balances) {
          const existing = (next[ownerId] ?? []).filter(
            (line) => line.id !== `${ownerId}-opening`,
          );
          if (amountCents === 0) {
            next[ownerId] = existing;
            continue;
          }
          next[ownerId] = [
            {
              id: `${ownerId}-opening`,
              date: asOf,
              label: "Balance brought forward",
              kind: "charge" as const,
              amountCents,
              balanceAfterCents: amountCents,
            },
            ...existing,
          ];
        }
        return next;
      });
      // Synchronous, like `transferHome`: the demo settles in one render.
      return true;
    },
    [remote.community, communityId],
  );

  /* ------------------------------------------------------------ reports */

  /**
   * A neighbour telling the board about another home.
   *
   * Lands as a report and never as a violation. The gap between those two is
   * the whole of this feature: what a resident submits is an input to an
   * investigation, and it becomes enforceable only once somebody from the
   * association has gone and looked.
   */
  const addViolationReport = useCallback(
    (input: {
      reporterId: string;
      reporterName: string;
      reporterUnit: string;
      subjectUnit: string;
      subjectOwnerId?: string;
      what: string;
      observedOn: string;
    }) => {
      const existing = remote.community
        ? remote.community.violationReports
        : sliceStore(communityId, "violationReports").getSnapshot();
      const sequence = existing.length + 1;
      const report: ViolationReport = {
        id: remote.community ? newId() : `rep-${communityId}-${sequence}-${input.subjectUnit}`,
        reference: `REP-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        reporterId: input.reporterId,
        reporterName: input.reporterName,
        reporterUnit: input.reporterUnit,
        subjectUnit: input.subjectUnit.trim(),
        subjectOwnerId: input.subjectOwnerId,
        what: input.what.trim(),
        observedOn: input.observedOn,
        submittedOn: todayIsoDate(),
        status: "new",
      };
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Sending the report", () =>
          supabaseBrowser().from("violation_reports").insert({
            id: report.id,
            association_id: rc.id,
            reference: report.reference,
            reporter_profile_id: remote.profileId,
            reporter_name: report.reporterName,
            reporter_unit: report.reporterUnit,
            subject_unit: report.subjectUnit,
            subject_unit_id: isUuid(report.subjectOwnerId ?? "") ? report.subjectOwnerId : null,
            what: report.what,
            observed_on: report.observedOn,
            submitted_on: report.submittedOn,
            status: "new",
          }),
        );
        return report;
      }
      sliceStore(communityId, "violationReports").update((all) => [report, ...all]);
      return report;
    },
    [remote.community, remote.profileId, communityId],
  );

  /**
   * The board's own observation, written down.
   *
   * Not a status flip. The note is the thing a notice rests on, so a
   * verification without one is refused rather than recorded, which is the
   * difference between an investigation and a tick.
   */
  const verifyReport = useCallback(
    (reportId: string, by: string, note: string) => {
      if (!note.trim()) {
        throw new ValidationError("Write down what you saw before marking this verified", {
          reportId,
        });
      }
      if (remote.community) {
        void remoteWrite("Saving what you saw", () =>
          supabaseBrowser()
            .from("violation_reports")
            .update(
              {
                status: "verified",
                verified_by: by,
                verified_on: todayIsoDate(),
                verification_note: note.trim(),
              },
              { count: "exact" },
            )
            .eq("id", reportId),
        );
        return;
      }
      sliceStore(communityId, "violationReports").update((all) =>
        all.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: "verified" as const,
                verification: { by, on: todayIsoDate(), note: note.trim() },
              }
            : r,
        ),
      );
    },
    [remote.community, communityId],
  );

  /** Closing a report the board looked at and found nothing in. */
  const dismissReport = useCallback(
    (reportId: string, reason: string) => {
      if (remote.community) {
        void remoteWrite("Closing the report", () =>
          supabaseBrowser()
            .from("violation_reports")
            .update({ status: "dismissed", dismissed_reason: reason.trim() }, { count: "exact" })
            .eq("id", reportId),
        );
        return;
      }
      sliceStore(communityId, "violationReports").update((all) =>
        all.map((r) =>
          r.id === reportId
            ? { ...r, status: "dismissed" as const, dismissedReason: reason.trim() }
            : r,
        ),
      );
    },
    [remote.community, communityId],
  );

  /**
   * Raising a notice from a verified report.
   *
   * Refuses anything that has not been verified, in the state layer rather
   * than only in the screen, because the screen is the part somebody will
   * later copy. The notice carries the board's citation and the board's
   * photographs; nothing the reporter wrote becomes the allegation.
   */
  const raiseNoticeFromReport = useCallback(
    (
      reportId: string,
      input: { rule: string; ruleCitation: string; ownerId: string; ownerName: string },
    ) => {
      const reports = remote.community
        ? remote.community.violationReports
        : sliceStore(communityId, "violationReports").getSnapshot();
      const report = reports.find((r) => r.id === reportId);
      if (!report) throw new ValidationError("That report is not on file", { reportId });
      if (!canRaiseNotice(report)) {
        throw new ValidationError(
          "Someone has to look at the home and mark this report verified before a notice can be sent",
          { reportId },
        );
      }

      const existing = remote.community
        ? remote.community.violations
        : sliceStore(communityId, "violations").getSnapshot();
      const sequence = existing.length + 1;
      const violation: Violation = {
        id: remote.community ? newId() : `vio-${communityId}-${sequence}`,
        reference: `VIO-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        unit: report.subjectUnit,
        rule: input.rule.trim(),
        ruleCitation: input.ruleCitation.trim(),
        stage: "courtesy",
        openedDate: todayIsoDate(),
        nextActionDate: addDays(todayIsoDate(), 14),
        // The board's own photographs go on afterwards. Nothing the reporter
        // supplied is carried across as if the association had taken it.
        photos: [],
        fineCents: 0,
        reportId,
      };

      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Raising the notice", async () => {
          const supabase = supabaseBrowser();
          // The report is claimed first, and only while no notice stands on
          // it. This is the write row level security can hide, and it used
          // to come second: the notice went in, the link matched nothing,
          // the board was told nothing had changed, and pressing again
          // raised a second notice on the same report. Refused here, nothing
          // has been written yet, so pressing again is safe.
          const claim = await supabase
            .from("violation_reports")
            .update({ violation_id: violation.id }, { count: "exact" })
            .eq("id", reportId)
            .is("violation_id", null);
          if (claim.error) throw new Error(claim.error.message);
          if (claim.count === 0) throw new Error(NOTHING_CHANGED);
          const { error } = await supabase.from("violations").insert({
            id: violation.id,
            association_id: rc.id,
            reference: violation.reference,
            unit_id: isUuid(violation.ownerId) ? violation.ownerId : null,
            unit_label: violation.unit,
            owner_name: violation.ownerName,
            rule: violation.rule,
            fix: violation.fix ?? "",
            rule_citation: violation.ruleCitation,
            stage: violation.stage,
            opened_on: violation.openedDate,
            next_action_on: violation.nextActionDate,
            photos: [],
            fine_cents: 0,
            report_id: reportId,
            source: "neighbor",
          });
          if (error) {
            // The notice did not go in, so the report is let go of and is
            // back in the queue to be raised again. Not counted: there is
            // nothing more to say if this misses too.
            await supabase
              .from("violation_reports")
              .update({ violation_id: null })
              .eq("id", reportId)
              .eq("violation_id", violation.id);
            throw new Error(error.message);
          }
        });
        return violation;
      }

      sliceStore(communityId, "violations").update((all) => [violation, ...all]);
      sliceStore(communityId, "violationReports").update((all) =>
        all.map((r) => (r.id === reportId ? { ...r, violationId: violation.id } : r)),
      );
      return violation;
    },
    [remote.community, communityId],
  );

  const addNotice = useCallback(
    (input: {
      ownerId: string;
      ownerName: string;
      unit: string;
      rule: string;
      fix?: string;
      ruleCitation?: string;
    }) => {
      if (!input.rule.trim() || !input.unit.trim()) {
        throw new ValidationError("Choose a home and name the rule", {});
      }
      const existing = remote.community
        ? remote.community.violations
        : sliceStore(communityId, "violations").getSnapshot();
      const sequence = existing.length + 1;
      const violation: Violation = {
        id: remote.community ? newId() : `vio-${communityId}-${sequence}`,
        reference: `VIO-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        ownerId: input.ownerId,
        ownerName: input.ownerName.trim(),
        unit: input.unit.trim(),
        rule: input.rule.trim(),
        fix: (input.fix ?? "").trim() || undefined,
        ruleCitation: (input.ruleCitation ?? "").trim(),
        stage: "courtesy",
        openedDate: todayIsoDate(),
        nextActionDate: addDays(todayIsoDate(), 14),
        photos: [],
        fineCents: 0,
        source: "board",
      };
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Sending the notice", () =>
          supabaseBrowser().from("violations").insert({
            id: violation.id,
            association_id: rc.id,
            reference: violation.reference,
            unit_id: isUuid(violation.ownerId) ? violation.ownerId : null,
            unit_label: violation.unit,
            owner_name: violation.ownerName,
            rule: violation.rule,
            rule_citation: violation.ruleCitation,
            stage: violation.stage,
            opened_on: violation.openedDate,
            next_action_on: violation.nextActionDate,
            photos: [],
            fine_cents: 0,
            report_id: null,
            source: "board",
          }),
        );
        return violation;
      }
      sliceStore(communityId, "violations").update((all) => [violation, ...all]);
      return violation;
    },
    [remote.community, communityId],
  );

  const closeBallot = useCallback(
    (ballotId: string) => {
      if (remote.community) {
        void remoteWrite("Closing the ballot", () =>
          supabaseBrowser()
            .from("ballots")
            .update({ status: "closed" }, { count: "exact" })
            .eq("id", ballotId),
        );
        return;
      }
      sliceStore(communityId, "ballots").update((all) =>
        all.map((b) => (b.id === ballotId ? { ...b, status: "closed" as const } : b)),
      );
    },
    [remote.community, communityId],
  );

  const setViolationStage = useCallback(
    (violationId: string, stage: Violation["stage"]) => {
      const today = todayIsoDate();
      const nextActionDate = stage === "cured" ? today : addDays(today, 14);
      const patch: Partial<Violation> =
        stage === "cured"
          ? { stage, nextActionDate, resolvedDate: today }
          : { stage, nextActionDate };
      if (remote.community) {
        void remoteWrite(stage === "cured" ? "Resolving the notice" : "Updating the notice", () =>
          supabaseBrowser()
            .from("violations")
            .update(
              {
                stage,
                next_action_on: nextActionDate,
                resolved_on: stage === "cured" ? today : null,
              },
              { count: "exact" },
            )
            .eq("id", violationId),
        );
        return;
      }
      sliceStore(communityId, "violations").update((all) =>
        all.map((v) => (v.id === violationId ? { ...v, ...patch } : v)),
      );
    },
    [remote.community, communityId],
  );

  const addCityNotice = useCallback(
    (input: {
      agency: string;
      caseNumber: string;
      deadline: string;
      rule: string;
      ownerId?: string;
      ownerName?: string;
      unit?: string;
    }) => {
      const agency = input.agency.trim();
      const caseNumber = input.caseNumber.trim();
      if (!agency || !input.rule.trim() || !input.deadline) {
        throw new ValidationError("A city notice needs the agency, what it says, and the deadline", {});
      }
      const existing = remote.community
        ? remote.community.violations
        : sliceStore(communityId, "violations").getSnapshot();
      const sequence = existing.length + 1;
      const violation: Violation = {
        id: remote.community ? newId() : `vio-${communityId}-${sequence}`,
        reference: `CITY-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        ownerId: input.ownerId ?? "",
        // Against the association itself unless a home is named.
        ownerName: input.ownerName?.trim() || "The association",
        unit: input.unit?.trim() || "Common area",
        rule: input.rule.trim(),
        // The agency and case number ride the citation too, so they survive a
        // database that has no column for them yet.
        ruleCitation: caseNumber ? `${agency}, case ${caseNumber}` : agency,
        stage: "first-notice",
        openedDate: todayIsoDate(),
        nextActionDate: input.deadline,
        photos: [],
        fineCents: 0,
        source: "city",
        agency,
        caseNumber: caseNumber || undefined,
      };
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Logging the notice", () =>
          supabaseBrowser().from("violations").insert({
            id: violation.id,
            association_id: rc.id,
            reference: violation.reference,
            unit_id: isUuid(violation.ownerId) ? violation.ownerId : null,
            unit_label: violation.unit,
            owner_name: violation.ownerName,
            rule: violation.rule,
            rule_citation: violation.ruleCitation,
            stage: violation.stage,
            opened_on: violation.openedDate,
            next_action_on: violation.nextActionDate,
            photos: [],
            fine_cents: 0,
            report_id: null,
            source: "city",
            agency,
            case_number: caseNumber,
          }),
        );
        return violation;
      }
      sliceStore(communityId, "violations").update((all) => [violation, ...all]);
      return violation;
    },
    [remote.community, communityId],
  );

  /** Removes a household and its account together, returning one undo for both. */
  const removeOwner = useCallback(
    (ownerId: string) => {
      if (!remote.community) {
        const undoOwners = destructive(sliceStore(communityId, "owners"), (all) =>
          all.filter((o) => o.id !== ownerId),
        );
        const undoAccounts = destructive(sliceStore(communityId, "accounts"), (all) =>
          all.filter((a) => a.ownerId !== ownerId),
        );
        return () => {
          undoOwners();
          undoAccounts();
        };
      }
      // A home with no statement is deleted outright. One with a statement
      // is retired instead (0099): its records stay, it is billed and
      // counted no more. The database decides which, and refuses a home
      // that still owes money, saying so through the toast. The undo below
      // only fits the deleted case; a retired home is brought back by hand.
      const rc = remote.community;
      const owner = rc.owners.find((o) => o.id === ownerId);
      const hasStatement = (rc.ownerCharges[ownerId] ?? []).length > 0;
      void remoteWrite(hasStatement ? "Retiring the home" : "Removing the household", () =>
        hasStatement
          ? supabaseBrowser().rpc("retire_home", { p_unit_id: ownerId })
          : supabaseBrowser().rpc("remove_household", { p_unit_id: ownerId }),
      );
      return () => {
        if (!owner || hasStatement) return;
        void remoteWrite("Restoring the household", () =>
          supabaseBrowser().rpc("add_household", {
            p_association_id: rc.id,
            p_unit_id: owner.id,
            p_name: owner.displayName,
            p_email: owner.email,
            p_unit: owner.unit,
          }),
        );
      };
    },
    [remote.community, communityId],
  );

  const transferHome = useCallback(
    (
      ownerId: string,
      input: { name: string; email: string; closingDate: string; settleBalance: boolean },
    ) => {
      const name = input.name.trim();
      const email = input.email.trim();
      if (remote.community) {
        const rc = remote.community;
        return remoteWrite("Recording the sale", async () => {
          const supabase = supabaseBrowser();
          // What the home owes now, not what it owed when the form opened. A
          // failed attempt re-reads the association, so a second try does not
          // settle a balance the first one already settled.
          const now = latest(rc);
          const owner = now.owners.find((o) => o.id === ownerId);
          const owed = owner?.balanceCents ?? 0;
          const settle = input.settleBalance && owed > 0;
          const recordSale = () =>
            supabase.rpc("transfer_home", {
              p_unit_id: ownerId,
              p_new_name: name,
              p_new_email: email,
              p_closing_date: input.closingDate,
            });
          // Paid out of escrow at closing: a payment line, so the statement
          // shows where the balance went rather than a number vanishing.
          const recordPayment = () =>
            supabase.from("charges").insert({
              association_id: rc.id,
              unit_id: ownerId,
              kind: "payment",
              label: "Paid at closing",
              amount_cents: -owed,
              due_on: input.closingDate,
            });
          // And the money itself, which the title company wires to the
          // association. Without this line the owner's balance cleared while
          // the bank balance and "collected" never saw the payment.
          const recordDeposit = () => {
            const operating = now.bankAccounts.find((b) => b.kind === "operating");
            return supabase.from("ledger_entries").insert({
              association_id: rc.id,
              bank_account_id: operating && isUuid(operating.id) ? operating.id : null,
              occurred_on: input.closingDate,
              description: `Paid at closing, ${placeLabel(owner?.unit ?? "")}`.trim(),
              counterparty: owner?.displayName ?? "Title company",
              category: "Assessments",
              amount_cents: owed,
              confirmed_at: new Date().toISOString(),
            });
          };
          const depositMissing = (why: string) =>
            `the sale and the payment at closing are recorded, but the deposit is not in Finances (${why}). Do not record the sale again`;

          // An officer recording the sale of their own home is the one case
          // where the money goes first. The sale ends their seat, and with it
          // the right to write the payment and the deposit, so sale first
          // left the home sold and the balance still owing, refused. Any
          // other home is sold first, below. A President's home is too: the
          // database refuses that sale outright, and money written ahead of
          // a sale that cannot happen is the fault sale first was put in to
          // stop.
          const seats = now.accounts.filter((a) => a.ownerId === ownerId);
          const ownHome =
            seats.some((a) => a.id === remote.profileId) &&
            !seats.some((a) => a.role === "president");
          if (settle && ownHome) {
            // The one refusal that can be seen coming, checked before any
            // money is written.
            if (owner && input.closingDate < owner.moveInDate) {
              throw new Error("the closing date is before this owner took ownership. Check the date");
            }
            const { error } = await recordPayment();
            if (error) throw new Error(error.message);
            const { error: bookError } = await recordDeposit();
            const { error: saleError } = await recordSale();
            if (saleError) {
              // The re-read after this shows the home owing nothing, so the
              // next try goes straight to the sale.
              throw new Error(
                `the balance paid at closing is recorded, but the sale was not (${saleError.message}). Record the sale again: the balance will not be paid twice`,
              );
            }
            if (bookError) throw new Error(depositMissing(bookError.message));
            return;
          }

          // The sale first. The database can refuse it (a closing date before
          // the tenure began, a home held by the President), and money written
          // ahead of a refused sale stayed on the books with no sale behind it.
          const { error: saleError } = await recordSale();
          if (saleError) throw new Error(saleError.message);
          if (!settle) return;
          // The sale is on record by now, so a failure from here says so:
          // pressing again would seat the buyer a second time.
          const { error } = await recordPayment();
          if (error) {
            throw new Error(
              `the sale is recorded, but the balance paid at closing was not (${error.message}). Do not record the sale again. The home still shows what it owed`,
            );
          }
          const { error: bookError } = await recordDeposit();
          if (bookError) throw new Error(depositMissing(bookError.message));
        });
      }

      const owners = sliceStore(communityId, "owners");
      const before = owners.getSnapshot().find((o) => o.id === ownerId);
      if (!before) return false;
      const settle = input.settleBalance && before.balanceCents > 0;
      owners.update((all) =>
        all.map((o) =>
          o.id === ownerId
            ? {
                ...o,
                displayName: name,
                members: [name],
                email,
                moveInDate: input.closingDate,
                balanceCents: settle ? 0 : o.balanceCents,
                daysPastDue: settle ? 0 : o.daysPastDue,
                standing: settle ? ("current" as const) : o.standing,
                autopay: false,
                autopayMethod: undefined,
                boardRole: undefined,
              }
            : o,
        ),
      );
      if (settle) {
        sliceStore(communityId, "ownerCharges").update((all) => ({
          ...all,
          [ownerId]: [
            {
              id: `${ownerId}-closing-${input.closingDate}`,
              date: input.closingDate,
              label: "Paid at closing",
              kind: "payment" as const,
              amountCents: -before.balanceCents,
              balanceAfterCents: 0,
            },
            ...(all[ownerId] ?? []),
          ],
        }));
      }
      // The seller's sign-in goes with them; the buyer gets a resident seat.
      sliceStore(communityId, "accounts").update((all) => [
        ...all.filter((a) => a.ownerId !== ownerId),
        {
          id: `${communityId}-acct-${before.unit}-${input.closingDate}`,
          ownerId,
          name,
          email,
          unit: before.unit,
          role: "resident" as const,
          capabilities: NO_CAPABILITIES,
          views: NO_CAPABILITIES,
        },
      ]);
      // Synchronous on purpose: the demo path settles in one render, and a
      // promise here would make every test's act() an async one.
      return true;
    },
    [remote.community, remote.profileId, communityId],
  );

  /**
   * Builds an association from onboarding and signs the founder into it.
   *
   * Dated from the real calendar rather than the pinned demo clock, because a
   * board setting up today should see today. The date is captured once, here,
   * and stored on the community, so nothing downstream reads a wall clock
   * during render.
   */
  const createCommunity = useCallback((draft: CommunityDraft) => {
    const asOf = new Date().toISOString().slice(0, 10);
    const built = buildCommunity(draft, asOf);
    saveCreatedCommunity(built);
    // Seed each slice from the new community so its stores exist before any
    // screen reads them.
    for (const slice of MUTABLE_SLICES) sliceStore(built.id, slice).set(built[slice]);
    communityStore.set(built.id);
    sessionStore.set({ accountId: built.accounts[0].id, view: "board" });
    return built;
  }, []);

  /* ----------------------------------------------------------------- forum */

  const addPost = useCallback(
    (post: ForumPost) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Posting", () =>
          supabaseBrowser().from("posts").insert({
            id: newId(),
            association_id: rc.id,
            author_id: remote.profileId,
            author_name: post.author,
            unit_label: post.unit,
            author_role: post.authorRole ?? null,
            category: post.category,
            title: post.title,
            body: post.body,
            status: post.status,
          }),
        );
        return;
      }
      sliceStore(communityId, "posts").update((all) => [post, ...all]);
    },
    [remote.community, remote.profileId, communityId],
  );

  const addAnnouncement = useCallback(
    (
      a: { title: string; body: string; category: Announcement["category"]; pinned?: boolean },
      email: "announcement" | "none" = "announcement",
    ) => {
      // Author is the seat that pressed the button, in the form the fixtures
      // established: "Arya Mehr, Board President".
      const roleLabel: Record<string, string> = {
        president: "Board President",
        "vice-president": "Vice President",
        treasurer: "Treasurer",
        secretary: "Secretary",
      };
      if (remote.community) {
        const rc = remote.community;
        const me = rc.accounts.find((x) => x.id === remote.profileId);
        const author = me
          ? `${me.name}${roleLabel[me.role] ? `, ${roleLabel[me.role]}` : ""}`
          : "The board";
        const id = newId();
        void remoteWrite("Posting the announcement", () =>
          supabaseBrowser().from("announcements").insert({
            id,
            association_id: rc.id,
            author_name: author,
            category: a.category,
            title: a.title,
            body: a.body,
            pinned: a.pinned ?? false,
          }),
        ).then((ok) => {
          if (ok && email === "announcement") void emailNotice(rc.id, { kind: "announcement", id });
        });
        return;
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((x) => x.id === sessionStore.getSnapshot().accountId);
      const author = me
        ? `${me.name}${roleLabel[me.role] ? `, ${roleLabel[me.role]}` : ""}`
        : "The board";
      sliceStore(communityId, "announcements").update((all) => [
        {
          id: newId(),
          title: a.title,
          body: a.body,
          category: a.category,
          pinned: a.pinned,
          author,
          postedDate: todayIsoDate(),
        },
        ...all,
      ]);
    },
    [remote.community, remote.profileId, communityId],
  );

  const sendMeetingNotice = useCallback(
    (meetingId: string) => {
      const meetings = remote.community ? remote.community.meetings : meetingList;
      const m = meetings.find((x) => x.id === meetingId);
      if (!m) return false;
      const when = `${formatDate(m.date, "long")} at ${m.time}`;
      const title = `Notice of meeting: ${m.title}, ${when}`;
      // One run at a time for a meeting. The date that takes the button away
      // is written only once the email has reported back, which for a long
      // roster is most of a minute, and a second press in that time would
      // post the notice and mail everybody again.
      if (remote.community && noticesInFlight.has(meetingId)) return false;
      // Posted once. A send that failed is pressed again, and the notice
      // from the first press is already on every home screen.
      const posted =
        remote.community &&
        latest(remote.community).announcements.some((a) => a.title === title);
      if (!posted) {
        addAnnouncement({
          title,
          body: [
            `${m.title} is on ${when}, ${m.location}.`,
            `Join by video: ${videoJoinUrl(m, (remote.community?.association ?? associationRow).id)}${m.dialIn ? `, or dial ${m.dialIn}${m.passcode ? ` (passcode ${m.passcode})` : ""}` : ""}.`,
            m.agenda.length ? `Agenda: ${m.agenda.join("; ")}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          category: "Governance",
        }, "none");
      }
      const today = todayIsoDate();
      if (remote.community) {
        const rc = remote.community;
        // Statutory notice, so it goes by email under its own category
        // rather than as an announcement an owner may have turned off.
        //
        // The date is the record that notice was given, so it is written
        // after the send reports back. It used to be written first, and a
        // send the server then refused left a meeting marked as noticed
        // with nothing to press again.
        //
        // It is written whatever the send reported, because the notice is
        // posted on every home screen by then and the emails that fell
        // short have been counted out in a toast. Written only when some
        // email went, a board whose mail could not go at all (a sending
        // domain not yet verified) kept the button for good, and so did a
        // second press that found everybody already had it.
        //
        // A send the server refused, or that never got there, did not
        // report back. The date is left unwritten, the button stays, and
        // pressing it again carries on from whoever was not reached.
        noticesInFlight.add(meetingId);
        return emailNotice(rc.id, { kind: "meeting", id: meetingId })
          .then((reported) =>
            reported
              ? remoteWrite("Recording the notice", () =>
                  supabaseBrowser()
                    .from("meetings")
                    .update({ notice_sent_on: today }, { count: "exact" })
                    .eq("id", meetingId),
                )
              : false,
          )
          .finally(() => noticesInFlight.delete(meetingId));
      }
      sliceStore(communityId, "meetings").update((all) =>
        all.map((x) => (x.id === meetingId ? { ...x, noticeSentDate: today } : x)),
      );
      return true;
    },
    [remote.community, meetingList, associationRow, addAnnouncement, communityId],
  );

  const removeAnnouncement = useCallback(
    (id: string) => {
      if (remote.community) {
        void remoteWrite("Removing the announcement", () =>
          supabaseBrowser().from("announcements").delete({ count: "exact" }).eq("id", id),
        );
        return;
      }
      sliceStore(communityId, "announcements").update((all) =>
        all.filter((a) => a.id !== id),
      );
    },
    [remote.community, communityId],
  );

  const moderatePost = useCallback(
    (postId: string, decision: "published" | "rejected", reason?: string) => {
      if (remote.community) {
        const rc = remote.community;
        const post = rc.posts.find((p) => p.id === postId);
        const moderator = rc.accounts.find((a) => a.id === remote.profileId);
        void remoteWrite("Saving the decision", () =>
          supabaseBrowser()
            .from("posts")
            .update(
              {
                status: decision,
                moderated_by: moderator?.name ?? null,
                moderated_at: new Date().toISOString(),
                rejection_reason: decision === "rejected" ? (reason ?? null) : null,
              },
              { count: "exact" },
            )
            .eq("id", postId),
        );
        return () => {
          if (!post) return;
          void remoteWrite("Undoing the decision", () =>
            supabaseBrowser()
              .from("posts")
              .update(
                {
                  status: post.status,
                  moderated_by: post.moderatedBy ?? null,
                  rejection_reason: post.rejectionReason ?? null,
                },
                { count: "exact" },
              )
              .eq("id", postId),
          );
        };
      }
      const moderator = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      return destructive(sliceStore(communityId, "posts"), (all) =>
        all.map((post) =>
          post.id === postId
            ? {
                ...post,
                status: decision,
                moderatedBy: moderator?.name,
                moderatedAt: todayIsoDate(),
                rejectionReason: decision === "rejected" ? reason : undefined,
              }
            : post,
        ),
      );
    },
    [remote.community, remote.profileId, communityId],
  );

  const togglePinned = useCallback(
    (postId: string) => {
      if (remote.community) {
        const post = remote.community.posts.find((p) => p.id === postId);
        void remoteWrite("Pinning", () =>
          supabaseBrowser()
            .from("posts")
            .update({ pinned: !post?.pinned }, { count: "exact" })
            .eq("id", postId),
        );
        return;
      }
      sliceStore(communityId, "posts").update((all) =>
        all.map((post) => (post.id === postId ? { ...post, pinned: !post.pinned } : post)),
      );
    },
    [remote.community, communityId],
  );

  const removePost = useCallback(
    (postId: string) => {
      if (remote.community) {
        // Removed means rejected, which hides it from every neighbour and
        // keeps the record, and is the only version of removal that can be
        // undone: the insert policy would not let a moderator put back a post
        // that somebody else wrote.
        const post = remote.community.posts.find((p) => p.id === postId);
        void remoteWrite("Removing the post", () =>
          supabaseBrowser()
            .from("posts")
            .update({ status: "rejected" }, { count: "exact" })
            .eq("id", postId),
        );
        return () => {
          if (!post) return;
          void remoteWrite("Restoring the post", () =>
            supabaseBrowser()
              .from("posts")
              .update({ status: post.status }, { count: "exact" })
              .eq("id", postId),
          );
        };
      }
      return destructive(sliceStore(communityId, "posts"), (all) =>
        all.filter((p) => p.id !== postId),
      );
    },
    [remote.community, communityId],
  );

  const likePost = useCallback(
    (postId: string) => {
      if (remote.community) {
        void remoteWrite("Liking", () => supabaseBrowser().rpc("like_post", { p_post_id: postId }));
        return;
      }
      sliceStore(communityId, "posts").update((all) =>
        all.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)),
      );
    },
    [remote.community, communityId],
  );

  const replyToPost = useCallback(
    (postId: string, body: string) => {
      const text = body.trim();
      if (!text) return false;
      if (remote.community) {
        const rc = remote.community;
        const me = rc.accounts.find((a) => a.id === remote.profileId);
        const home = me ? rc.owners.find((o) => o.id === me.ownerId) : undefined;
        const roleLabel: Record<string, string> = {
          president: "Board President",
          "vice-president": "Vice President",
          treasurer: "Treasurer",
          secretary: "Secretary",
        };
        void remoteWrite("Replying", () =>
          supabaseBrowser().from("post_replies").insert({
            association_id: rc.id,
            post_id: postId,
            author_id: remote.profileId,
            author_name: me?.name ?? "Neighbor",
            author_role: me ? (roleLabel[me.role] ?? null) : null,
            unit_label: home?.unit ?? "",
            body: text,
          }),
        );
        return true;
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      const owner = me
        ? sliceStore(communityId, "owners").getSnapshot().find((o) => o.id === me.ownerId)
        : undefined;
      const roleLabel: Record<string, string> = {
        president: "Board President",
        "vice-president": "Vice President",
        treasurer: "Treasurer",
        secretary: "Secretary",
      };
      const reply: ForumReply = {
        id: `fr-${postId}-${Date.now().toString(36)}`,
        author: me?.name ?? "Neighbor",
        unit: owner?.unit ?? "",
        authorRole: me ? roleLabel[me.role] : undefined,
        at: todayIsoDate(),
        body: text,
      };
      sliceStore(communityId, "posts").update((all) =>
        all.map((post) =>
          post.id === postId ? { ...post, replies: [...post.replies, reply] } : post,
        ),
      );
      return true;
    },
    [remote.community, remote.profileId, communityId],
  );

  const updateMyContact = useCallback(
    (input: { phone: string; mailingAddress: string }) => {
      if (remote.community) {
        const rc = remote.community;
        return remoteWrite("Saving your contact details", () =>
          supabaseBrowser().rpc("update_my_contact", {
            p_association_id: rc.id,
            p_phone: input.phone,
            p_mailing_address: input.mailingAddress,
          }),
        );
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      if (!me) return Promise.resolve(false);
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) =>
          o.id === me.ownerId
            ? { ...o, phone: input.phone, mailingAddress: input.mailingAddress || undefined }
            : o,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );


  /* --------------------------------------------------------------- autopay */

  const setAutopay = useCallback(
    (plan: AutopayPlan | null) => {
      if (remote.community) {
        const rc = remote.community;
        // The home on screen. set_my_autopay writes every seat the person
        // holds, which would switch autopay on or off for all their homes at
        // once; this one names the home.
        const unitId = account?.ownerId;
        if (!unitId) return Promise.resolve(false);
        return remoteWrite(plan ? "Saving autopay" : "Turning autopay off", () =>
          supabaseBrowser().rpc("set_my_home_autopay", {
            p_association_id: rc.id,
            p_unit_id: unitId,
            p_autopay: plan as unknown as Json,
          }),
        );
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      if (!me) return Promise.resolve(false);
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) =>
          o.id === me.ownerId
            ? { ...o, autopay: Boolean(plan), autopayPlan: plan ?? undefined }
            : o,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId, account?.ownerId],
  );

  /* ------------------------------------------------------ owner says fixed */

  const markViolationFixed = useCallback(
    (violationId: string, note: string) => {
      const today = todayIsoDate();
      if (remote.community) {
        return remoteWrite("Telling the board", () =>
          supabaseBrowser().rpc("mark_violation_fixed", {
            p_violation_id: violationId,
            p_note: note,
          }),
        );
      }
      sliceStore(communityId, "violations").update((all) =>
        all.map((v) =>
          v.id === violationId && v.stage !== "cured"
            ? { ...v, ownerFixedDate: today, ownerFixedNote: note.trim() || undefined }
            : v,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /* ------------------------------------------------------------ work orders */

  const setWorkOrder = useCallback(
    (requestId: string, workOrder: WorkOrder | null) => {
      const existing = remote.community
        ? remote.community.requests
        : sliceStore(communityId, "requests").getSnapshot();
      const request = existing.find((r) => r.id === requestId);
      if (!request) return;
      // The owner reads the same thread the board does, so what changed on
      // the order is said there in words rather than left for them to diff.
      const previous = request.workOrder;
      let body: string | null = null;
      if (!workOrder) body = "The work order was taken off this request.";
      else if (!previous) body = `Work order opened${workOrder.vendorName ? ` with ${workOrder.vendorName}` : ""}.`;
      else if (workOrder.completedOn && !previous.completedOn) body = "The work is done.";
      else if (workOrder.scheduledOn && workOrder.scheduledOn !== previous.scheduledOn)
        body = `Scheduled for ${formatDate(workOrder.scheduledOn, "medium")}${workOrder.vendorName ? ` with ${workOrder.vendorName}` : ""}.`;
      const actorName = remote.community
        ? (remote.community.accounts.find((a) => a.id === remote.profileId)?.name ?? "Board")
        : (sliceStore(communityId, "accounts")
            .getSnapshot()
            .find((a) => a.id === sessionStore.getSnapshot().accountId)?.name ?? "Board");
      const thread = body
        ? [
            ...request.thread,
            {
              id: `rt-${request.id}-${request.thread.length}`,
              at: todayIsoDate(),
              actor: actorName,
              actorRole: "board" as const,
              body,
              kind: "status" as const,
            },
          ]
        : request.thread;
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Saving the work order", () => {
          // The note goes onto the thread as the last write left it, so a
          // decision saved a moment ago is not written over by this one.
          const now = latest(rc).requests.find((r) => r.id === requestId)?.thread ?? request.thread;
          const event = body ? thread[thread.length - 1] : undefined;
          return supabaseBrowser()
            .from("requests")
            .update(
              {
                work_order: (workOrder as unknown as Json) ?? null,
                thread: event ? [...now, { ...event, id: `rt-${request.id}-${now.length}` }] : now,
              },
              { count: "exact" },
            )
            .eq("id", requestId);
        });
        return;
      }
      sliceStore(communityId, "requests").update((all) =>
        all.map((r) =>
          r.id === requestId ? { ...r, workOrder: workOrder ?? undefined, thread } : r,
        ),
      );
    },
    [remote.community, remote.profileId, communityId],
  );

  /* ------------------------------------------------------------------ rsvps */

  const rsvpMeeting = useCallback(
    (meetingId: string, response: "yes" | "no") => {
      if (remote.community) {
        return remoteWrite("Saving your answer", () =>
          supabaseBrowser().rpc("rsvp_meeting", { p_meeting_id: meetingId, p_response: response }),
        );
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      if (!me) return Promise.resolve(false);
      sliceStore(communityId, "meetings").update((all) =>
        all.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                rsvps: [
                  ...(m.rsvps ?? []).filter((r) => r.profileId !== me.id),
                  { profileId: me.id, name: me.name, unit: me.unit, response, at: todayIsoDate() },
                ],
              }
            : m,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /* ----------------------------------------------------------- action items */

  const addActionItem = useCallback(
    (input: { title: string; ownerName: string; dueOn?: string; meetingId?: string }) => {
      const title = input.title.trim();
      if (!title) throw new ValidationError("Describe the action item", { title });
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the item", () =>
          supabaseBrowser().from("action_items").insert({
            association_id: rc.id,
            title,
            owner_name: input.ownerName.trim(),
            due_on: input.dueOn || null,
            meeting_id: input.meetingId && isUuid(input.meetingId) ? input.meetingId : null,
            created_by: remote.profileId,
          }),
        );
        return;
      }
      const item: ActionItem = {
        id: `act-${Date.now()}`,
        title,
        ownerName: input.ownerName.trim(),
        dueOn: input.dueOn || undefined,
        meetingId: input.meetingId,
        createdOn: todayIsoDate(),
      };
      sliceStore(communityId, "actionItems").update((all) => [...all, item]);
    },
    [remote.community, remote.profileId, communityId],
  );

  const setActionItemDone = useCallback(
    (itemId: string, done: boolean) => {
      const doneOn = done ? todayIsoDate() : undefined;
      if (remote.community) {
        void remoteWrite(done ? "Ticking it off" : "Reopening it", () =>
          supabaseBrowser()
            .from("action_items")
            .update({ done_on: doneOn ?? null }, { count: "exact" })
            .eq("id", itemId),
        );
        return;
      }
      sliceStore(communityId, "actionItems").update((all) =>
        all.map((i) => (i.id === itemId ? { ...i, doneOn } : i)),
      );
    },
    [remote.community, communityId],
  );

  const removeActionItem = useCallback(
    (itemId: string) => {
      if (remote.community) {
        void remoteWrite("Removing the item", () =>
          supabaseBrowser().from("action_items").delete({ count: "exact" }).eq("id", itemId),
        );
        return;
      }
      sliceStore(communityId, "actionItems").update((all) => all.filter((i) => i.id !== itemId));
    },
    [remote.community, communityId],
  );

  /* -------------------------------------------------------- request to join */

  const decideJoin = useCallback(
    (requestId: string, status: "approved" | "declined") => {
      const today = todayIsoDate();
      if (remote.community) {
        const rc = remote.community;
        const by = rc.accounts.find((a) => a.id === remote.profileId)?.name ?? "Board";
        return remoteWrite(status === "approved" ? "Letting them in" : "Declining", () =>
          supabaseBrowser()
            .from("join_requests")
            .update({ status, decided_on: today, decided_by: by }, { count: "exact" })
            .eq("id", requestId),
        );
      }
      const by =
        sliceStore(communityId, "accounts")
          .getSnapshot()
          .find((a) => a.id === sessionStore.getSnapshot().accountId)?.name ?? "Board";
      sliceStore(communityId, "joinRequests").update((all) =>
        all.map((j) =>
          j.id === requestId ? { ...j, status, decidedOn: today, decidedBy: by } : j,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, remote.profileId, communityId],
  );

  const approveJoinRequest = useCallback(
    async (requestId: string, unit: string) => {
      const existing = remote.community
        ? remote.community.joinRequests
        : sliceStore(communityId, "joinRequests").getSnapshot();
      const request = existing.find((j) => j.id === requestId);
      if (!request) return false;
      // The roster is the only door. Approving is adding the household with
      // the address they gave, so the same rules apply as to any other add.
      const { owner, saved } = addOwnerSaving({ name: request.name, email: request.email, unit });
      // The household first, and only then the decision. Marked approved
      // while the add was still in the air, a refused add left a request
      // that read "approved", a welcome email on its way, and no home.
      if (!(await saved)) return false;
      const decided = await decideJoin(requestId, "approved");
      // They made an account when they asked, so the note that says "you're
      // in" carries a link that opens it. Fire and forget: the roster is
      // already right, and a failed email is logged on the server.
      if (decided && remote.community) {
        void fetch("/api/email/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            associationId: remote.community.id,
            unitIds: [owner.id],
            kind: "welcome",
          }),
        }).catch(() => undefined); // The roster is right already; the server logs a failed email.
      }
      return decided;
    },
    [remote.community, communityId, addOwnerSaving, decideJoin],
  );

  /**
   * The board chose a home from the register for this request. Nothing is
   * created from what the person typed: the database seats them on that
   * home (or beside its owner), and only then is the request marked decided,
   * so a refusal leaves it waiting.
   */
  const seatJoinRequest = useCallback(
    async (requestId: string, ownerId: string, second: boolean) => {
      const existing = remote.community
        ? remote.community.joinRequests
        : sliceStore(communityId, "joinRequests").getSnapshot();
      const request = existing.find((j) => j.id === requestId);
      if (!request) return false;
      if (remote.community) {
        const seated = await remoteWrite("Letting them in", () =>
          supabaseBrowser().rpc("seat_join_request", {
            p_request_id: requestId,
            p_unit_id: ownerId,
            p_as_second: second,
          }),
        );
        if (!seated) return false;
        const decided = await decideJoin(requestId, "approved");
        // The note that says "you're in" goes to every address on the home,
        // so a second owner is not sent one: it would reach the first owner
        // too. They find the home on their next sign in or Check again.
        if (decided && !second) {
          void fetch("/api/email/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              associationId: remote.community.id,
              unitIds: [ownerId],
              kind: "welcome",
            }),
          }).catch(() => undefined); // The roster is right already; the server logs a failed email.
        }
        return decided;
      }
      if (!seatInDemo(ownerId, { name: request.name, email: request.email }, second)) return false;
      return decideJoin(requestId, "approved");
    },
    [remote.community, communityId, decideJoin, seatInDemo],
  );

  const declineJoinRequest = useCallback(
    (requestId: string) => decideJoin(requestId, "declined"),
    [decideJoin],
  );

  const requestToJoin = useCallback(
    async (input: { code: string; name: string; email: string; unit: string; note: string }) => {
      const code = input.code.trim().toUpperCase();
      const name = input.name.trim();
      const email = input.email.trim();
      if (!code) return { ok: false as const, error: "Enter the join code from your board." };
      if (!name || !isEmail(email)) {
        return { ok: false as const, error: "Enter your name and a working email address." };
      }
      // A demo association answers from the browser, so the flow can be
      // tried without an account. A real one goes to the database as anyone.
      const local = allCommunities().find((c) => c.association.joinCode === code);
      if (local) {
        const request: JoinRequest = {
          id: `join-${Date.now()}`,
          name,
          email,
          unit: input.unit.trim(),
          note: input.note.trim(),
          status: "pending",
          requestedOn: todayIsoDate(),
        };
        sliceStore(local.id, "joinRequests").update((all) =>
          all.some((j) => j.email.toLowerCase() === email.toLowerCase() && j.status === "pending")
            ? all
            : [request, ...all],
        );
        return { ok: true as const, association: local.settings.displayName };
      }
      const { data, error } = await supabaseBrowser().rpc("request_to_join", {
        p_code: code,
        p_name: name,
        p_email: email,
        p_unit: input.unit.trim(),
        p_note: input.note.trim(),
      });
      if (error || !data) {
        return { ok: false as const, error: error?.message ?? "No association has that join code. Check it with your board." };
      }
      return { ok: true as const, association: data };
    },
    [],
  );

  const lookupJoinCode = useCallback(async (input: string) => {
    const code = input.trim().toUpperCase();
    if (!code) return null;
    const local = allCommunities().find((c) => c.association.joinCode === code);
    if (local) {
      return { name: local.settings.displayName, place: local.association.addressLine };
    }
    if (!hasSupabase) return null;
    // Through our own route so lookups are counted per address; the answer
    // is the same anonymous RPC either way.
    const response = await fetch(`/api/join/lookup?code=${encodeURIComponent(code)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { found: { name: string; place: string } | null };
    return body.found;
  }, []);

  /* -------------------------------------------------------------- requests */

  const addRequest = useCallback(
    (request: HomeRequest) => {
      if (remote.community) {
        const rc = remote.community;
        // The number comes back from the row. The form numbers a request
        // from the ones its owner can see, and the database gives a number
        // already taken the next free one, so what was sent is a guess. The
        // filer may read their own row back (requests_read), which is what
        // lets the insert return it. Resolves null when nothing was saved,
        // so the form stays put instead of saying "Request submitted".
        let stored = "";
        return remoteWrite("Sending the request", async () => {
          const { data, error } = await supabaseBrowser().from("requests").insert({
            id: newId(),
            association_id: rc.id,
            unit_id: request.ownerId,
            filed_by: remote.profileId,
            reference: request.reference,
            kind: request.kind,
            title: request.title,
            body: request.summary,
            status: request.status === "draft" ? "submitted" : request.status,
            submitted_on: request.submittedDate,
            due_on: request.dueDate ?? null,
            due_reason: request.dueReason ?? null,
            attachments: request.attachments,
            thread: request.thread,
            submission: request.submission ?? null,
            certificate_id: request.certificateId ?? null,
          }).select("reference").single();
          if (error) throw new Error(error.message);
          stored = data?.reference ?? "";
        }).then((ok) => (ok ? stored : null));
      }
      sliceStore(communityId, "requests").update((all) => [request, ...all]);
    },
    [remote.community, remote.profileId, communityId],
  );

  const updateRequestStatus = useCallback(
    (requestId: string, status: HomeRequest["status"], note?: string): Promise<boolean> => {
      const decided = ["approved", "denied"].includes(status);
      const event = (request: HomeRequest, actorName: string) => ({
        id: `rt-${request.id}-${request.thread.length}`,
        at: todayIsoDate(),
        actor: actorName,
        actorRole: "board" as const,
        body: note ?? `Status changed to ${statusLabel[status].toLowerCase()}.`,
        kind: "status" as const,
      });
      if (remote.community) {
        const rc = remote.community;
        const request = rc.requests.find((r) => r.id === requestId);
        if (!request) return Promise.resolve(false);
        const actor = rc.accounts.find((a) => a.id === remote.profileId);
        return remoteWrite("Saving the decision", () => {
          // The request as the last write left it, so the note lands after
          // whatever was just added to the thread instead of replacing it.
          const now = latest(rc).requests.find((r) => r.id === requestId) ?? request;
          return supabaseBrowser()
            .from("requests")
            .update(
              {
                status,
                decided_on: decided ? todayIsoDate() : (now.decisionDate ?? null),
                decided_by: decided ? (actor?.name ?? null) : (now.decidedBy ?? null),
                decided_note: note ?? null,
                thread: [...now.thread, event(now, actor?.name ?? "Board")],
              },
              { count: "exact" },
            )
            .eq("id", requestId);
        }).then((ok) => {
          if (ok) void emailNotice(rc.id, { kind: "request", id: requestId, body: note });
          return ok;
        });
      }
      const actor = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      sliceStore(communityId, "requests").update((all) =>
        all.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status,
                decisionDate: decided ? todayIsoDate() : request.decisionDate,
                decidedBy: decided ? actor?.name : request.decidedBy,
                thread: [...request.thread, event(request, actor?.name ?? "Board")],
              }
            : request,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, remote.profileId, communityId],
  );

  const replyToRequest = useCallback(
    (requestId: string, body: string): Promise<boolean> => {
      const text = body.trim();
      if (!text) return Promise.resolve(false);
      const event = (request: HomeRequest, actorName: string) => ({
        id: `rt-${request.id}-${request.thread.length}`,
        at: todayIsoDate(),
        actor: actorName,
        actorRole: "board" as const,
        body: text,
        kind: "note" as const,
      });
      if (remote.community) {
        const rc = remote.community;
        const request = rc.requests.find((r) => r.id === requestId);
        if (!request) return Promise.resolve(false);
        const actor = rc.accounts.find((a) => a.id === remote.profileId);
        return remoteWrite("Sending the reply", () => {
          // Built from the thread as the write before this one left it, not
          // the copy this press started from: two quick replies are both kept.
          const now = latest(rc).requests.find((r) => r.id === requestId) ?? request;
          return supabaseBrowser()
            .from("requests")
            .update({ thread: [...now.thread, event(now, actor?.name ?? "Board")] }, { count: "exact" })
            .eq("id", requestId);
        }).then((ok) => {
          // Told only once the reply is on the record. The same email kind
          // as a decision: it says the request was updated and carries the words.
          if (ok) void emailNotice(rc.id, { kind: "request", id: requestId, body: text });
          return ok;
        });
      }
      const actor = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      // The demo has no database to wait on; the store's latest copy is read
      // inside the update, so two quick replies are both kept here too.
      sliceStore(communityId, "requests").update((all) =>
        all.map((request) =>
          request.id === requestId
            ? { ...request, thread: [...request.thread, event(request, actor?.name ?? "Board")] }
            : request,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, remote.profileId, communityId],
  );

  /* ----------------------------------------------------------- instruments */

  const addInstrument = useCallback(
    (draft: Omit<PaymentInstrument, "id" | "isDefault">): PaymentInstrument => {
      const existing = remote.community
        ? remote.community.instruments
        : sliceStore(communityId, "instruments").getSnapshot();
      const mine = existing.filter((i) => i.ownerId === draft.ownerId);
      const instrument: PaymentInstrument = {
        ...draft,
        id: remote.community ? newId() : `pm-${draft.kind}-${draft.mask}-${existing.length}`,
        // The first one an owner adds becomes their default, because a payment
        // screen with nothing selected is a dead end.
        isDefault: mine.length === 0,
      };
      if (remote.community) {
        const rc = remote.community;
        const { id, ownerId, kind, label, mask, isDefault, addedDate, ...detail } = instrument;
        void remoteWrite("Saving the payment method", () =>
          supabaseBrowser().from("payment_instruments").insert({
            id,
            association_id: rc.id,
            unit_id: ownerId,
            profile_id: remote.profileId,
            kind,
            label,
            mask,
            is_default: isDefault,
            added_on: addedDate,
            detail,
          }),
        );
        return instrument;
      }
      sliceStore(communityId, "instruments").set([...existing, instrument]);
      return instrument;
    },
    [remote.community, remote.profileId, communityId],
  );

  const removeInstrument = useCallback(
    (instrumentId: string) => {
      if (remote.community) {
        const rc = remote.community;
        // The route detaches the method from Stripe before the row goes, and
        // a detached method cannot come back, so there is nothing to undo.
        void remoteWrite("Removing the payment method", async () => {
          const response = await fetch("/api/stripe/instruments", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ associationId: rc.id, instrumentId }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error ?? "The payment method was not removed. Try again");
          }
        });
        return undefined;
      }
      return destructive(sliceStore(communityId, "instruments"), (all) => {
        const removed = all.find((i) => i.id === instrumentId);
        const kept = all.filter((i) => i.id !== instrumentId);
        if (!removed?.isDefault) return kept;
        const successor = kept.find((i) => i.ownerId === removed.ownerId);
        return successor
          ? kept.map((i) => (i.id === successor.id ? { ...i, isDefault: true } : i))
          : kept;
      });
    },
    [remote.community, communityId],
  );

  const setDefaultInstrument = useCallback(
    (instrumentId: string) => {
      if (remote.community) {
        const target = remote.community.instruments.find((i) => i.id === instrumentId);
        if (!target) return;
        void remoteWrite("Choosing the default", async () => {
          const supabase = supabaseBrowser();
          const { error } = await supabase
            .from("payment_instruments")
            .update({ is_default: false })
            .eq("unit_id", target.ownerId);
          if (error) throw new Error(error.message);
          // The first update clears the others and may match none. This one is
          // aimed at the method just chosen, so it has to land.
          return supabase
            .from("payment_instruments")
            .update({ is_default: true }, { count: "exact" })
            .eq("id", instrumentId);
        });
        return;
      }
      sliceStore(communityId, "instruments").update((all) => {
        const target = all.find((i) => i.id === instrumentId);
        if (!target) return all;
        // Exactly one default per household, enforced on write.
        return all.map((i) =>
          i.ownerId === target.ownerId ? { ...i, isDefault: i.id === instrumentId } : i,
        );
      });
    },
    [remote.community, communityId],
  );

  /* ----------------------------------------------------------- admin work */

  const confirmLedgerEntry = useCallback(
    (entryId: string, category?: Community["ledger"][number]["category"]) => {
      if (remote.community) {
        const entry = remote.community.ledger.find((e) => e.id === entryId);
        void remoteWrite("Confirming the transaction", () =>
          supabaseBrowser()
            .from("ledger_entries")
            .update(
              {
                confirmed_at: new Date().toISOString(),
                category: category ?? entry?.suggestedCategory ?? entry?.category,
              },
              { count: "exact" },
            )
            .eq("id", entryId),
        );
        return () => {
          if (!entry) return;
          void remoteWrite("Reopening the transaction", () =>
            supabaseBrowser()
              .from("ledger_entries")
              .update({ confirmed_at: null, category: entry.category }, { count: "exact" })
              .eq("id", entryId),
          );
        };
      }
      return destructive(sliceStore(communityId, "ledger"), (all) =>
        all.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                status: "cleared" as const,
                category: category ?? entry.suggestedCategory ?? entry.category,
                suggestedCategory: undefined,
                suggestionConfidence: undefined,
                matchedBy: "manual" as const,
              }
            : entry,
        ),
      );
    },
    [remote.community, communityId],
  );

  const dismissLedgerEntry = useCallback(
    (entryId: string) => {
      if (remote.community) {
        const rc = remote.community;
        const entry = rc.ledger.find((e) => e.id === entryId);
        void remoteWrite("Dismissing the transaction", () =>
          supabaseBrowser().from("ledger_entries").delete({ count: "exact" }).eq("id", entryId),
        );
        return () => {
          if (!entry) return;
          void remoteWrite("Restoring the transaction", () =>
            supabaseBrowser().from("ledger_entries").insert({
              id: entry.id,
              association_id: rc.id,
              bank_account_id: isUuid(entry.accountId) ? entry.accountId : null,
              occurred_on: entry.date,
              description: entry.description,
              counterparty: entry.counterparty,
              category: entry.category,
              amount_cents: entry.amountCents,
              confirmed_at: entry.status === "cleared" ? new Date().toISOString() : null,
            }),
          );
        };
      }
      return destructive(sliceStore(communityId, "ledger"), (all) =>
        all.filter((e) => e.id !== entryId),
      );
    },
    [remote.community, communityId],
  );

  const recordReserveTransfer = useCallback(
    (amountCents: number, date: string) => {
      if (amountCents <= 0) throw new ValidationError("Enter an amount", { amount: "Enter an amount" });
      const source = remote.community ?? null;
      const accounts = source ? source.bankAccounts : bankAccountList;
      const operating = accounts.find((b) => b.kind === "operating");
      const reserve = accounts.find((b) => b.kind !== "operating");
      if (!operating || !reserve) {
        throw new ValidationError("Add an operating and a reserve account first", {});
      }
      const pair = [
        { accountId: operating.id, amountCents: -amountCents, description: "Transfer to reserve account", counterparty: reserve.name },
        { accountId: reserve.id, amountCents, description: "Transfer from operating account", counterparty: operating.name },
      ];
      if (source) {
        void remoteWrite("Recording the transfer", () =>
          supabaseBrowser().from("ledger_entries").insert(
            pair.map((line) => ({
              association_id: source.id,
              bank_account_id: isUuid(line.accountId) ? line.accountId : null,
              occurred_on: date,
              description: line.description,
              counterparty: line.counterparty,
              category: "Reserve transfer",
              amount_cents: line.amountCents,
              confirmed_at: new Date().toISOString(),
            })),
          ),
        );
        return;
      }
      sliceStore(communityId, "ledger").update((all) =>
        [
          ...pair.map((line) => ({
            id: newId(),
            date,
            description: line.description,
            counterparty: line.counterparty,
            category: "Reserve transfer" as const,
            accountId: line.accountId,
            amountCents: line.amountCents,
            status: "cleared" as const,
          })),
          ...all,
        ].sort((a, b) => b.date.localeCompare(a.date)),
      );
      // The demo's balances are stored, not summed, so they move by hand.
      sliceStore(communityId, "bankAccounts").update((all) =>
        all.map((b) =>
          b.id === operating.id
            ? { ...b, balanceCents: b.balanceCents - amountCents }
            : b.id === reserve.id
              ? { ...b, balanceCents: b.balanceCents + amountCents }
              : b,
        ),
      );
    },
    [remote.community, bankAccountList, communityId],
  );

  const approvePayout = useCallback(
    (payoutId: string) => {
      if (remote.community) {
        const rc = remote.community;
        const approver = rc.accounts.find((a) => a.id === remote.profileId);
        const asked = rc.payouts.find((p) => p.id === payoutId);
        if (!approver || !asked) return;
        if (asked.approvals.some((a) => a.name === approver.name)) return;
        // The database adds the signature under a row lock (approve_payout,
        // 0094). The browser used to read the list, add a name and write
        // the whole list back, and two officers pressing at once each wrote
        // a list of one over the other's.
        void remoteWrite("Approving the payment", () =>
          supabaseBrowser().rpc("approve_payout", { p_payout_id: payoutId }),
        );
        return;
      }
      const approver = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      if (!approver) return;
      sliceStore(communityId, "payouts").update((all) =>
        all.map((payout) => {
          if (payout.id !== payoutId) return payout;
          if (payout.approvals.some((a) => a.name === approver.name)) return payout;
          const approvals = [...payout.approvals, { name: approver.name, at: todayIsoDate() }];
          return {
            ...payout,
            approvals,
            status: approvals.length >= payout.approvalsRequired ? "scheduled" : payout.status,
          };
        }),
      );
    },
    [remote.community, remote.profileId, communityId],
  );

  const markPayoutPaid = useCallback(
    (payoutId: string) => {
      if (!can("finances")) return false;
      const today = todayIsoDate();
      if (remote.community) {
        const rc = remote.community;
        const payout = rc.payouts.find((p) => p.id === payoutId);
        if (!payout || (payout.status !== "scheduled" && payout.status !== "in-transit")) return false;
        return remoteWrite("Marking the payment paid", async () => {
          const supabase = supabaseBrowser();
          // Only a payment still waiting to go out: a second press, or another
          // officer's, finds it paid and writes no second ledger line.
          const moved = await supabase
            .from("payouts")
            .update({ status: "paid" }, { count: "exact" })
            .eq("id", payoutId)
            .in("status", ["scheduled", "in-transit"]);
          if (moved.error) throw new Error(moved.error.message);
          if (!moved.count) throw new Error("That payment was already marked paid");
          const vendor = rc.vendors.find((v) => v.id === payout.vendorId);
          const operating = rc.bankAccounts.find((b) => b.kind === "operating");
          return supabase.from("ledger_entries").insert({
            association_id: rc.id,
            bank_account_id: operating && isUuid(operating.id) ? operating.id : null,
            occurred_on: today,
            description: payout.invoiceNumber ? `${payout.vendor}, ${payout.invoiceNumber}` : payout.vendor,
            counterparty: payout.vendor,
            category: vendor?.defaultCategory ?? "Vendors",
            amount_cents: -payout.amountCents,
            confirmed_at: new Date().toISOString(),
          });
        });
      }
      const payout = sliceStore(communityId, "payouts").getSnapshot().find((p) => p.id === payoutId);
      if (!payout || (payout.status !== "scheduled" && payout.status !== "in-transit")) return false;
      const vendor = sliceStore(communityId, "vendors").getSnapshot().find((v) => v.id === payout.vendorId);
      const operating = sliceStore(communityId, "bankAccounts")
        .getSnapshot()
        .find((a) => a.kind === "operating");
      const category = vendor?.defaultCategory ?? "Repairs & maintenance";
      sliceStore(communityId, "payouts").update((all) =>
        all.map((p) => (p.id === payoutId ? { ...p, status: "paid" as const } : p)),
      );
      // A bill paid from the invoice inbox already has its line, booked
      // pending; the money leaves the bank now, so it clears. Otherwise the
      // line is written here, as addPayout writes one for a payment recorded
      // as paid.
      const ledger = sliceStore(communityId, "ledger");
      if (ledger.getSnapshot().some((e) => e.payoutId === payoutId)) {
        ledger.update((all) =>
          all.map((e) =>
            e.payoutId === payoutId ? { ...e, status: "cleared" as const, date: today } : e,
          ),
        );
      } else {
        ledger.update((all) => [
          {
            id: `le-${payoutId}`,
            date: today,
            description: payout.invoiceNumber ? `${payout.vendor}, ${payout.invoiceNumber}` : payout.vendor,
            counterparty: payout.vendor,
            category,
            accountId: operating?.id ?? "unassigned",
            amountCents: -payout.amountCents,
            status: "cleared" as const,
            matchedBy: "manual" as const,
            payoutId,
          },
          ...all,
        ]);
      }
      if (operating) {
        sliceStore(communityId, "bankAccounts").update((all) =>
          all.map((a) =>
            a.id === operating.id ? { ...a, balanceCents: a.balanceCents - payout.amountCents } : a,
          ),
        );
      }
      sliceStore(communityId, "budget").update((all) =>
        all.map((line) =>
          line.kind === "expense" && line.category === category
            ? { ...line, ytdActualCents: line.ytdActualCents + payout.amountCents }
            : line,
        ),
      );
      return true;
    },
    [can, remote.community, communityId],
  );

  const markW9Requested = useCallback(
    (vendorId: string) => {
      if (remote.community) {
        void remoteWrite("Noting the W-9", () =>
          supabaseBrowser()
            .from("vendors")
            .update({ w9_on_file: true }, { count: "exact" })
            .eq("id", vendorId),
        );
        return;
      }
      sliceStore(communityId, "vendors").update((all) =>
        all.map((vendor) => (vendor.id === vendorId ? { ...vendor, w9OnFile: true } : vendor)),
      );
    },
    [remote.community, communityId],
  );

  const addVendor = useCallback(
    (vendor: Community["vendors"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the vendor", () =>
          supabaseBrowser().from("vendors").insert({
            id: newId(),
            association_id: rc.id,
            name: vendor.name,
            service: vendor.service,
            ach_enabled: vendor.achEnabled,
            w9_on_file: vendor.w9OnFile,
            coi_expires_on: vendor.coiExpires ?? null,
            default_category: vendor.defaultCategory,
          }),
        );
        return;
      }
      sliceStore(communityId, "vendors").update((all) => [vendor, ...all]);
    },
    [remote.community, communityId],
  );

  const removeVendor = useCallback(
    (vendorId: string) => {
      if (remote.community) {
        const rc = remote.community;
        const vendor = rc.vendors.find((v) => v.id === vendorId);
        void remoteWrite("Removing the vendor", () =>
          supabaseBrowser().from("vendors").delete({ count: "exact" }).eq("id", vendorId),
        );
        return () => {
          if (!vendor) return;
          void remoteWrite("Restoring the vendor", () =>
            supabaseBrowser().from("vendors").insert({
              id: vendor.id,
              association_id: rc.id,
              name: vendor.name,
              service: vendor.service,
              ach_enabled: vendor.achEnabled,
              w9_on_file: vendor.w9OnFile,
              coi_expires_on: vendor.coiExpires ?? null,
              default_category: vendor.defaultCategory,
            }),
          );
        };
      }
      return destructive(sliceStore(communityId, "vendors"), (all) =>
        all.filter((v) => v.id !== vendorId),
      );
    },
    [remote.community, communityId],
  );

  const messageBoard = useCallback(
    async (ownerId: string, subject: string, body: string, tag: MessageThread["tag"] = "General") => {
      if (!subject.trim() || !body.trim()) {
        throw new ValidationError("Add a subject and a message", {});
      }
      if (remote.community) {
        return remoteWrite("Sending your message", () =>
          supabaseBrowser().rpc("start_owner_thread", {
            p_unit_id: ownerId,
            p_subject: subject.trim(),
            p_body: body.trim(),
            p_tag: tag,
          }),
        );
      }
      const owner = sliceStore(communityId, "owners").getSnapshot().find((o) => o.id === ownerId);
      const from = owner?.members[0] ?? owner?.displayName ?? "Owner";
      sliceStore(communityId, "threads").update((all) => [
        {
          id: `t-${newId()}`,
          subject: subject.trim(),
          participants: [from],
          ownerId,
          unit: owner?.unit,
          updatedDate: todayIsoDate(),
          unread: true,
          tag,
          messages: [
            {
              id: `m-${newId()}`,
              at: todayIsoDate(),
              from,
              fromRole: "resident",
              direction: "inbound",
              channel: "portal",
              body: body.trim(),
            },
          ],
        },
        ...all,
      ]);
      return true;
    },
    [remote.community, communityId],
  );

  const replyAsOwner = useCallback(
    async (threadId: string, ownerId: string, body: string) => {
      if (!body.trim()) return false;
      if (remote.community) {
        return remoteWrite("Sending your reply", () =>
          supabaseBrowser().rpc("reply_as_owner", { p_thread_id: threadId, p_body: body.trim() }),
        );
      }
      const owner = sliceStore(communityId, "owners").getSnapshot().find((o) => o.id === ownerId);
      sliceStore(communityId, "threads").update((all) =>
        all.map((t) =>
          t.id === threadId
            ? {
                ...t,
                unread: true,
                updatedDate: todayIsoDate(),
                messages: [
                  ...t.messages,
                  {
                    id: `m-${newId()}`,
                    at: todayIsoDate(),
                    from: owner?.members[0] ?? owner?.displayName ?? "Owner",
                    fromRole: "resident",
                    direction: "inbound",
                    channel: "portal",
                    body: body.trim(),
                  },
                ],
              }
            : t,
        ),
      );
      return true;
    },
    [remote.community, communityId],
  );

  const replyToThread = useCallback(
    (threadId: string, body: string) => {
      const message = (senderName: string, count: number) => ({
        id: `m-${threadId}-${count}`,
        at: todayIsoDate(),
        from: senderName,
        fromRole: "board" as const,
        direction: "outbound" as const,
        channel: "email" as const,
        body,
      });
      if (remote.community) {
        const rc = remote.community;
        const thread = rc.threads.find((t) => t.id === threadId);
        if (!thread) return;
        // Appended in the database, to the thread as it is there now
        // (reply_as_board, migration 0072). The browser used to send the
        // whole list back, built from the thread as this tab last read it,
        // so a reply written at 9:10 from a page opened at 9:00 erased what
        // an owner had sent at 9:05. The function names the sender from
        // their seat and numbers the message itself.
        void remoteWrite("Sending the reply", () =>
          supabaseBrowser().rpc("reply_as_board", { p_thread_id: threadId, p_body: body }),
        ).then((ok) => {
          // The channel on the message says "email", so it is one.
          if (ok && thread.ownerId) {
            void emailNotice(rc.id, {
              kind: thread.tag === "Billing" ? "letter" : "message",
              unitIds: [thread.ownerId],
              subject: thread.subject,
              body,
            });
          }
        });
        return;
      }
      const sender = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      sliceStore(communityId, "threads").update((all) =>
        all.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                unread: false,
                updatedDate: todayIsoDate(),
                messages: [...thread.messages, message(sender?.name ?? "Board", thread.messages.length)],
              }
            : thread,
        ),
      );
    },
    [remote.community, communityId],
  );

  const messageOwner = useCallback(
    (
      ownerId: string,
      subject: string,
      body: string,
      tag: Community["threads"][number]["tag"] = "General",
    ) => {
      const id = newId();
      const message = (senderName: string) => ({
        id: `m-${id}-0`,
        at: todayIsoDate(),
        from: senderName,
        fromRole: "board" as const,
        direction: "outbound" as const,
        channel: "email" as const,
        body,
      });
      if (remote.community) {
        const rc = remote.community;
        const owner = rc.owners.find((o) => o.id === ownerId);
        if (!owner) return false;
        const sender = rc.accounts.find((a) => a.id === remote.profileId);
        const senderName = sender?.name ?? "Board";
        // Resolves once the letter is on its thread, so a screen sending
        // several can say how many landed. The email follows on its own.
        return remoteWrite("Sending the letter", () =>
          supabaseBrowser().from("threads").insert({
            id,
            association_id: rc.id,
            subject,
            unit_id: ownerId,
            participants: [owner.displayName, senderName],
            tag,
            updated_on: todayIsoDate(),
            unread: false,
            messages: [message(senderName)],
          }),
        ).then((ok) => {
          // A dues letter is a statutory notice; a note is a message the
          // owner may turn off. The tag is what tells them apart.
          if (ok) {
            void emailNotice(rc.id, {
              kind: tag === "Billing" ? "letter" : "message",
              unitIds: [ownerId],
              subject,
              body,
            });
          }
          return ok;
        });
      }
      const owner = sliceStore(communityId, "owners")
        .getSnapshot()
        .find((o) => o.id === ownerId);
      if (!owner) return false;
      const sender = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      const senderName = sender?.name ?? "Board";
      sliceStore(communityId, "threads").update((all) => [
        {
          id,
          subject,
          participants: [owner.displayName, senderName],
          ownerId,
          unit: owner.unit,
          updatedDate: todayIsoDate(),
          unread: false,
          tag,
          messages: [message(senderName)],
        },
        ...all,
      ]);
      return true;
    },
    [remote.community, remote.profileId, communityId],
  );

  const uploadDocuments = useCallback(
    async (
      files: File[],
      options?: {
        category?: DocumentRecord["category"];
        /** Board only unless the caller says otherwise; governing documents say so. */
        visibility?: DocumentRecord["visibility"];
      },
    ): Promise<UploadOutcome> => {
      const outcome: UploadOutcome = { uploaded: [], rejected: [], filed: [] };
      const category = options?.category ?? "Notices";
      const visibility = options?.visibility ?? "board";
      const accepted: File[] = [];
      for (const file of files) {
        const reason = rejectReason(file);
        if (reason) outcome.rejected.push({ name: file.name, reason });
        else accepted.push(file);
      }

      if (!remote.community) {
        // A demo has nowhere to put the bytes, so it keeps everything else.
        const filed = accepted.map((file, index) => ({
          ...toDocumentRecord(file, `doc-upload-${Date.now()}-${index}`, todayIsoDate()),
          category,
        }));
        if (filed.length) {
          sliceStore(communityId, "documents").update((all) => [...filed, ...all]);
        }
        outcome.uploaded.push(...accepted.map((file) => file.name));
        outcome.filed.push(...filed.map((d) => ({ id: d.id, name: d.name })));
        return outcome;
      }

      const supabase = supabaseBrowser();
      const associationId = remote.community.id;
      for (const file of accepted) {
        const id = crypto.randomUUID();
        const path = storagePathFor(associationId, id, file.name);
        const { error: putError } = await supabase.storage
          .from("documents")
          .upload(path, file, { contentType: mimeTypeOf(file.name, file.type) });
        if (putError) {
          outcome.rejected.push({ name: file.name, reason: putError.message });
          continue;
        }
        const { error: rowError } = await supabase.from("documents").insert({
          id,
          association_id: associationId,
          name: documentTitle(file.name),
          category,
          visibility: toDbVisibility(visibility),
          storage_path: path,
          size_label: formatSize(file.size),
        });
        if (rowError) {
          // The row is what makes a file reachable. Without one the bytes are
          // an orphan, so take them back out rather than leave them.
          await supabase.storage.from("documents").remove([path]);
          outcome.rejected.push({ name: file.name, reason: rowError.message });
          continue;
        }
        outcome.uploaded.push(file.name);
        outcome.filed.push({ id, name: documentTitle(file.name) });
      }
      if (outcome.uploaded.length) await refreshRemote();
      return outcome;
    },
    [remote.community, communityId],
  );

  /**
   * Adds text confirmed out of an uploaded governing document.
   *
   * Appends rather than replaces, and drops anything whose number is already
   * on file. Importing the same file twice is the most likely way this gets
   * used by mistake, and the failure it would otherwise produce is a document
   * with two Article VIIs, which is exactly the ambiguity a board cites into.
   */
  const addGoverningArticles = useCallback(
    (articles: Community["governingDocs"]) => {
      if (remote.community) {
        const rc = remote.community;
        const offset = rc.governingDocs.length;
        void remoteWrite("Filing the articles", () =>
          supabaseBrowser()
            .from("governing_articles")
            // The unique key on document and number is what drops a second
            // Article VII; ignoring the duplicate keeps the rest.
            .upsert(
              articles.map((article, index) => ({
                association_id: rc.id,
                document: article.document,
                number: article.number,
                title: article.title,
                topic: article.topic,
                text: article.text,
                plain: article.plain ?? null,
                affects: article.affects,
                amended_on: article.amendedOn ?? null,
                amendment_ballot_id: article.amendmentBallotId ?? null,
                adopted_on: article.adoptedOn ?? null,
                disclosure_topics: article.disclosureTopics ?? null,
                extraction: article.extraction ?? null,
                position: offset + index,
              })),
              { onConflict: "association_id,document,number", ignoreDuplicates: true },
            ),
        );
        return;
      }
      sliceStore(communityId, "governingDocs").update((all) => {
        const taken = new Set(all.map((a) => `${a.document}|${a.number}`));
        const fresh = articles.filter((a) => !taken.has(`${a.document}|${a.number}`));
        return [...all, ...fresh];
      });
    },
    [remote.community, communityId],
  );

  const updateAssociation = useCallback(
    (patch: Partial<Community["association"]>) => {
      // The same ceiling the database holds (0102), for the demo too.
      const rates = [patch.duesCents, ...Object.values(patch.duesByType ?? {})];
      if (rates.some((c) => c !== undefined && c > MAX_DUES_CENTS)) {
        reportRemoteError(DUES_HIGH_MESSAGE);
        return false;
      }
      if (remote.community) {
        const rc = remote.community;
        const COLUMN: Record<string, string> = {
          name: "name",
          duesCents: "dues_cents",
          duesByType: "dues_by_type",
          duesCadence: "dues_cadence",
          fiscalYearStart: "fiscal_year_start",
          insuranceCarrier: "insurance_carrier",
          // Not null in the table, so a cleared field is a blank string, below.
          contactEmail: "contact_email",
          billsByEmail: "bills_by_email",
          insurancePolicyNo: "insurance_policy_no",
          insuranceExpiresOn: "insurance_expires_on",
          ein: "ein",
          state: "state",
        };
        const row: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(patch)) {
          if (COLUMN[key]) row[COLUMN[key]] = value ?? null;
        }
        // A cleared date picker hands back "", which a date column refuses.
        if (row.insurance_expires_on === "") row.insurance_expires_on = null;
        if ("contact_email" in row) row.contact_email = row.contact_email ?? "";
        if (!Object.keys(row).length) return true;
        return remoteWrite("Saving the association", () =>
          supabaseBrowser().from("associations").update(row, { count: "exact" }).eq("id", rc.id),
        );
      }
      sliceStore(communityId, "association").update((current) => ({ ...current, ...patch }));
      return true;
    },
    [remote.community, communityId],
  );

  const addPayout = useCallback(
    (payout: Community["payouts"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Recording the payment", async () => {
          const supabase = supabaseBrowser();
          const { error } = await supabase.from("payouts").insert({
            id: newId(),
            association_id: rc.id,
            vendor_id: isUuid(payout.vendorId) ? payout.vendorId : null,
            vendor_name: payout.vendor,
            invoice_number: payout.invoiceNumber,
            amount_cents: payout.amountCents,
            method: payout.method,
            status: payout.status,
            issued_on: payout.issuedDate,
            expected_on: payout.expectedDate,
            approvals: payout.approvals,
            approvals_required: payout.approvalsRequired,
          });
          if (error) throw new Error(error.message);
          // Money that already left is a line on the books from the same
          // click, or Finances shows a bank balance the bank does not.
          if (payout.status !== "paid") return;
          const vendor = rc.vendors.find((v) => v.id === payout.vendorId);
          const operating = rc.bankAccounts.find((b) => b.kind === "operating");
          return supabase.from("ledger_entries").insert({
            association_id: rc.id,
            bank_account_id: operating && isUuid(operating.id) ? operating.id : null,
            occurred_on: payout.issuedDate,
            description: payout.invoiceNumber
              ? `${payout.vendor}, ${payout.invoiceNumber}`
              : payout.vendor,
            counterparty: payout.vendor,
            category: payout.category ?? vendor?.defaultCategory ?? "Vendors",
            amount_cents: -payout.amountCents,
            confirmed_at: new Date().toISOString(),
          });
        });
        return;
      }
      sliceStore(communityId, "payouts").update((all) =>
        [payout, ...all].sort((a, b) => b.issuedDate.localeCompare(a.issuedDate)),
      );
      // The rest of what the signed-in path writes for money that already
      // left: a line on the operating account's books, and from it the bank
      // balance, the vendor's year, and the budget line. A payout row alone
      // read "Paid" while cash, Transactions and the vendor's total stood
      // still.
      if (payout.status !== "paid") return;
      const vendor = sliceStore(communityId, "vendors")
        .getSnapshot()
        .find((v) => v.id === payout.vendorId);
      const operating = sliceStore(communityId, "bankAccounts")
        .getSnapshot()
        .find((a) => a.kind === "operating");
      const category = payout.category ?? vendor?.defaultCategory ?? "Repairs & maintenance";
      const entry: Community["ledger"][number] = {
        id: `le-${payout.id}`,
        date: payout.issuedDate,
        description: payout.invoiceNumber ? `${payout.vendor}, ${payout.invoiceNumber}` : payout.vendor,
        counterparty: payout.vendor,
        category,
        accountId: operating?.id ?? "unassigned",
        amountCents: -payout.amountCents,
        status: "cleared",
        matchedBy: "manual",
        payoutId: payout.id,
      };
      sliceStore(communityId, "ledger").update((all) => [entry, ...all]);
      if (operating) {
        sliceStore(communityId, "bankAccounts").update((all) =>
          all.map((acct) =>
            acct.id === operating.id ? { ...acct, balanceCents: acct.balanceCents - payout.amountCents } : acct,
          ),
        );
      }
      if (vendor && payout.issuedDate.slice(0, 4) === todayIsoDate().slice(0, 4)) {
        sliceStore(communityId, "vendors").update((all) =>
          all.map((v) => (v.id === vendor.id ? { ...v, ytdPaidCents: v.ytdPaidCents + payout.amountCents } : v)),
        );
      }
      sliceStore(communityId, "budget").update((all) =>
        all.map((line) =>
          line.kind === "expense" && line.category === category
            ? { ...line, ytdActualCents: line.ytdActualCents + payout.amountCents }
            : line,
        ),
      );
    },
    [remote.community, communityId],
  );

  /* -------------------------------------------------------------- invoices */

  /**
   * Invoices have no table yet, so a real association is refused plainly
   * rather than given a record that lives in one browser and looks saved.
   */
  const invoicesLocalOnly = useCallback(() => {
    if (remote.community) {
      throw new ValidationError("Invoices are not saved for real associations yet", {});
    }
  }, [remote.community]);

  const addInvoice = useCallback(
    (input: Omit<VendorInvoice, "id" | "status" | "via">) => {
      invoicesLocalOnly();
      const invoice: VendorInvoice = {
        ...input,
        id: `inv-${communityId}-${Date.now().toString(36)}`,
        status: "new",
        via: "upload",
      };
      sliceStore(communityId, "invoices").update((all) => [invoice, ...all]);
      return invoice;
    },
    [invoicesLocalOnly, communityId],
  );

  const approveInvoice = useCallback(
    (invoiceId: string) => {
      invoicesLocalOnly();
      sliceStore(communityId, "invoices").update((all) =>
        all.map((i) => (i.id === invoiceId && i.status === "new" ? { ...i, status: "approved" } : i)),
      );
    },
    [invoicesLocalOnly, communityId],
  );

  const rejectInvoice = useCallback(
    (invoiceId: string, reason: string) => {
      invoicesLocalOnly();
      sliceStore(communityId, "invoices").update((all) =>
        all.map((i) =>
          i.id === invoiceId ? { ...i, status: "rejected", rejectedReason: reason.trim() } : i,
        ),
      );
    },
    [invoicesLocalOnly, communityId],
  );

  const payInvoice = useCallback(
    (invoiceId: string, notes?: string) => {
      invoicesLocalOnly();
      const invoice = sliceStore(communityId, "invoices")
        .getSnapshot()
        .find((i) => i.id === invoiceId);
      if (!invoice) throw new ValidationError("That invoice is not on file", { invoiceId });
      if (invoice.status === "paid") return;
      const vendor = sliceStore(communityId, "vendors")
        .getSnapshot()
        .find((v) => v.id === invoice.vendorId);
      const operating =
        sliceStore(communityId, "bankAccounts")
          .getSnapshot()
          .find((a) => a.kind === "operating") ?? sliceStore(communityId, "bankAccounts").getSnapshot()[0];
      if (!operating) {
        throw new ValidationError("Connect the association's bank account before paying a bill", {});
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      const today = todayIsoDate();
      const stamp = Date.now().toString(36);
      const payout: Community["payouts"][number] = {
        id: `po-${communityId}-${stamp}`,
        vendorId: invoice.vendorId,
        vendor: invoice.vendor,
        invoiceNumber: invoice.number,
        amountCents: invoice.amountCents,
        method: "ach",
        status: "scheduled",
        issuedDate: today,
        expectedDate: addDays(today, 2),
        approvals: [{ name: me?.name ?? "The board", at: today }],
        approvalsRequired: 1,
        notes: notes?.trim() || undefined,
        invoiceId,
      };
      const entry: Community["ledger"][number] = {
        id: `le-${communityId}-${stamp}`,
        date: today,
        description: `${invoice.vendor}, ${invoice.description}`,
        counterparty: invoice.vendor,
        category: vendor?.defaultCategory ?? "Repairs & maintenance",
        accountId: operating.id,
        amountCents: -invoice.amountCents,
        status: "pending",
        matchedBy: "manual",
        payoutId: payout.id,
      };
      sliceStore(communityId, "payouts").update((all) =>
        [payout, ...all].sort((a, b) => b.issuedDate.localeCompare(a.issuedDate)),
      );
      sliceStore(communityId, "ledger").update((all) => [entry, ...all]);
      sliceStore(communityId, "invoices").update((all) =>
        all.map((i) =>
          i.id === invoiceId
            ? { ...i, status: "paid", payoutId: payout.id, notes: notes?.trim() || i.notes }
            : i,
        ),
      );
      if (vendor) {
        sliceStore(communityId, "vendors").update((all) =>
          all.map((v) =>
            v.id === vendor.id ? { ...v, ytdPaidCents: v.ytdPaidCents + invoice.amountCents } : v,
          ),
        );
      }
    },
    [invoicesLocalOnly, communityId],
  );

  const setPayoutNotes = useCallback(
    (payoutId: string, notes: string) => {
      // The payouts table has no notes column yet; a real association keeps
      // the note in this browser, and the screen says so.
      if (remote.community) return;
      sliceStore(communityId, "payouts").update((all) =>
        all.map((p) => (p.id === payoutId ? { ...p, notes: notes.trim() || undefined } : p)),
      );
    },
    [remote.community, communityId],
  );

  const addBallot = useCallback(
    (ballot: Community["ballots"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Opening the ballot", async () => {
          const supabase = supabaseBrowser();
          const id = newId();
          const { error } = await supabase.from("ballots").insert({
            id,
            association_id: rc.id,
            title: ballot.title,
            body: ballot.body,
            kind: ballot.kind,
            audience: ballot.audience,
            status: ballot.status,
            opens_on: ballot.opensDate,
            closes_on: ballot.closesDate,
            seats: ballot.seats ?? 1,
            quorum_required: ballot.quorumRequired,
            threshold_label: ballot.thresholdLabel,
            meeting_id: isUuid(ballot.meetingId ?? "") ? ballot.meetingId : null,
            live_results_visible: ballot.liveResultsVisible,
          });
          if (error) throw new Error(error.message);
          const { error: optionsError } = await supabase.from("ballot_options").insert(
            ballot.options.map((option, position) => ({
              ballot_id: id,
              label: option.label,
              detail: option.detail ?? null,
              position,
            })),
          );
          if (optionsError) throw new Error(optionsError.message);
          // Notice of a vote goes out the moment it opens to owners. The
          // server reads the ballot back and declines a board-only one.
          if (ballot.audience === "owners" && ballot.status === "open") {
            void emailNotice(rc.id, { kind: "ballot", id });
          }
        });
        return;
      }
      sliceStore(communityId, "ballots").update((all) => [ballot, ...all]);
    },
    [remote.community, communityId],
  );

  const addMeeting = useCallback(
    (meeting: Community["meetings"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Scheduling the meeting", () =>
          supabaseBrowser().from("meetings").insert({
            id: newId(),
            association_id: rc.id,
            title: meeting.title,
            held_on: meeting.date,
            held_at: meeting.time,
            location: meeting.location,
            dial_in: meeting.dialIn || null,
            passcode: meeting.passcode || null,
            status: meeting.status,
            kind: meeting.kind,
            agenda: meeting.agenda,
            notice_sent_on: meeting.noticeSentDate ?? null,
          }),
        );
        return;
      }
      sliceStore(communityId, "meetings").update((all) =>
        [...all, meeting].sort((a, b) => a.date.localeCompare(b.date)),
      );
    },
    [remote.community, communityId],
  );

  const addBudgetLine = useCallback(
    (line: Community["budget"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the budget line", () =>
          supabaseBrowser().from("budget_lines").insert({
            association_id: rc.id,
            category: line.category,
            annual_cents: line.annualCents,
            kind: line.kind,
            position: rc.budget.length,
          }),
        );
        return;
      }
      sliceStore(communityId, "budget").update((all) => [...all, line]);
    },
    [remote.community, communityId],
  );

  const addReserveComponent = useCallback(
    (component: Community["reserveComponents"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the component", () =>
          supabaseBrowser().from("reserve_components").insert({
            id: isUuid(component.id) ? component.id : newId(),
            association_id: rc.id,
            name: component.name,
            useful_life_years: component.usefulLifeYears,
            remaining_life_years: component.remainingLifeYears,
            replacement_cost_cents: component.replacementCostCents,
            funded_cents: component.fundedCents,
            last_inspection: component.lastInspection ?? null,
            note: component.note ?? null,
          }),
        );
        return;
      }
      sliceStore(communityId, "reserveComponents").update((all) => [...all, component]);
    },
    [remote.community, communityId],
  );

  const addSharedCost = useCallback(
    (cost: Community["sharedCosts"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the shared cost", () =>
          supabaseBrowser().from("shared_costs").insert({
            id: isUuid(cost.id) ? cost.id : newId(),
            association_id: rc.id,
            name: cost.name,
            kind: cost.kind,
            provider: cost.provider,
            account_ref: cost.accountRef,
            allocation: cost.allocation,
            markup_percent: cost.markupPercent,
            active: cost.active,
            usage_unit: cost.usageUnit,
          }),
        );
        return;
      }
      sliceStore(communityId, "sharedCosts").update((all) => [...all, cost]);
    },
    [remote.community, communityId],
  );

  const removeSharedCost = useCallback(
    (costId: string) => {
      if (remote.community) {
        // The bills go with it, by cascade.
        void remoteWrite("Removing the shared cost", () =>
          supabaseBrowser().from("shared_costs").delete({ count: "exact" }).eq("id", costId),
        );
        return;
      }
      sliceStore(communityId, "sharedCosts").update((all) =>
        all.filter((cost) => cost.id !== costId),
      );
      // The bills go with it. Leaving them would keep the cost in every total
      // while it no longer appears in any list, which is worse than losing it.
      sliceStore(communityId, "sharedCostBills").update((all) =>
        all.filter((bill) => bill.sharedCostId !== costId),
      );
    },
    [remote.community, communityId],
  );

  const postSharedCostBill = useCallback(
    (bill: Community["sharedCostBills"][number]) => {
      if (remote.community) {
        const cost = remote.community.sharedCosts.find((c) => c.id === bill.sharedCostId);
        // The database divides the bill between the homes and posts a charge
        // to each, in one function, so the split cannot drift from the total.
        void remoteWrite("Posting the bill", () =>
          supabaseBrowser().rpc("post_shared_cost_bill", {
            p_shared_cost_id: bill.sharedCostId,
            p_period_start: bill.periodStart,
            p_period_end: bill.periodEnd,
            p_total_cents: bill.totalCents,
            p_due_on: bill.dueOn,
            p_usage_amount: bill.usageAmount ?? null,
            p_usage_unit: cost?.usageUnit ?? "",
          }),
        );
        return;
      }
      sliceStore(communityId, "sharedCostBills").update((all) => [...all, bill]);
    },
    [remote.community, communityId],
  );

  const setDocumentVisibility = useCallback(
    async (documentId: string, visibility: Community["documents"][number]["visibility"]) => {
      if (!remote.community) {
        sliceStore(communityId, "documents").update((all) =>
          all.map((doc) => (doc.id === documentId ? { ...doc, visibility } : doc)),
        );
        return;
      }
      const { error, count } = await supabaseBrowser()
        .from("documents")
        .update({ visibility: toDbVisibility(visibility) }, { count: "exact" })
        .eq("id", documentId);
      if (error) throw new Error(error.message);
      // Hidden by row level security, the row matches nothing and the
      // database says nothing. The screen catches this and says it.
      if (count === 0) throw new Error(NOT_CHANGED);
      await refreshRemote();
    },
    [remote.community, communityId],
  );

  const removeDocument = useCallback(
    async (documentId: string) => {
      if (!remote.community) {
        return destructive(sliceStore(communityId, "documents"), (all) =>
          all.filter((d) => d.id !== documentId),
        );
      }
      const doc = remote.community.documents.find((d) => d.id === documentId);
      const supabase = supabaseBrowser();
      const { error, count } = await supabase
        .from("documents")
        .delete({ count: "exact" })
        .eq("id", documentId);
      if (error) throw new Error(error.message);
      // A delete that matched nothing left the row where it is, and the
      // bytes must stay with it: taking them left a document on the list
      // that opened to nothing.
      if (count === 0) throw new Error(NOT_CHANGED);
      // With the row gone nothing can reach the file, so the bytes go too. If
      // this step fails the result is an unreachable orphan, not a document
      // that appears to have survived.
      if (doc?.storagePath) await supabase.storage.from("documents").remove([doc.storagePath]);
      await refreshRemote();
      return undefined;
    },
    [remote.community, communityId],
  );

  const castVote = useCallback(
    (ballotId: string, optionIds: string | string[]) => {
      const picks = Array.isArray(optionIds) ? optionIds : [optionIds];
      if (remote.community) {
        // The receipt is minted by the database, where it cannot be forged,
        // and arrives with the re-read. The screens show it from the ballot.
        const existing = remote.community.ballots.find((b) => b.id === ballotId);
        void remoteWrite("Casting your vote", () =>
          supabaseBrowser().rpc("cast_votes", { p_ballot_id: ballotId, p_option_ids: picks }),
        );
        return existing?.myVoteReceipt ?? "";
      }
      const store = sliceStore(communityId, "ballots");
      const existing = store.getSnapshot().find((b) => b.id === ballotId);
      const receipt = existing?.myVoteReceipt ?? voteReceipt(ballotId, picks[0]);

      store.update((all) =>
        all.map((ballot) => {
          if (ballot.id !== ballotId) return ballot;
          const previous = new Set(
            ballot.myVoteOptionIds ?? (ballot.myVoteOptionId ? [ballot.myVoteOptionId] : []),
          );
          const next = new Set(picks);
          // One mark per seat per household. Changing your mind replaces the
          // marks rather than adding to them, and keeps the original receipt
          // so the number a voter wrote down still resolves.
          return {
            ...ballot,
            myVoteOptionId: picks[0],
            myVoteOptionIds: picks,
            myVoteReceipt: receipt,
            options: ballot.options.map((option) => {
              const was = previous.has(option.id);
              const is = next.has(option.id);
              if (is && !was) return { ...option, votes: option.votes + 1 };
              if (was && !is) return { ...option, votes: Math.max(0, option.votes - 1) };
              return option;
            }),
          };
        }),
      );

      return receipt;
    },
    [remote.community, communityId],
  );

  const saveTemplate = useCallback(
    (template: Community["templates"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        const row = {
          association_id: rc.id,
          name: template.name,
          description: template.description,
          subject: template.subject,
          body: template.body,
          trigger: template.trigger,
          updated_on: todayIsoDate(),
        };
        void remoteWrite("Saving the template", () =>
          isUuid(template.id)
            ? supabaseBrowser()
                .from("message_templates")
                .update(row, { count: "exact" })
                .eq("id", template.id)
            : // A stock template, edited: the row replaces it, keyed by its id.
              supabaseBrowser()
                .from("message_templates")
                .upsert({ ...row, baseline_id: template.id }, { onConflict: "association_id,baseline_id" }),
        );
        return;
      }
      sliceStore(communityId, "templates").update((all) =>
        all.some((t) => t.id === template.id)
          ? all.map((t) => (t.id === template.id ? template : t))
          : [...all, template],
      );
    },
    [remote.community, communityId],
  );

  /**
   * The community every screen sees, with the live slices laid over the seed.
   *
   * Without this overlay `community.ballots` is the fixture while `ballots` is
   * the store, and the two disagree the moment anyone changes anything. It also
   * keeps the pure selectors in metrics.ts honest, since they take a community
   * and read vendors, payouts and ballots straight off it.
   */
  const liveCommunity = useMemo<Community>(
    () => ({
      ...community,
      settings,
      accounts: accountList,
      owners: ownerList,
      bankAccounts: bankAccountList,
      ownerCharges: ownerChargeMap,
      budget: budgetLines,
      amenities,
      forms,
      posts,
      requests: requestList,
      instruments,
      ledger,
      payouts,
      invoices,
      vendors,
      threads,
      documents,
      governingDocs,
      violations: violationList,
      violationReports: reportList,
      ballots,
      templates,
      association: associationRow,
      meetings: meetingList,
      reserveComponents: reserveComponentList,
      sharedCosts,
      sharedCostBills,
      announcements: announcementList,
      actionItems: actionItemList,
      joinRequests: joinRequestList,
    }),
    [
      community,
      settings,
      accountList,
      ownerList,
      bankAccountList,
      ownerChargeMap,
      budgetLines,
      amenities,
      forms,
      posts,
      requestList,
      instruments,
      ledger,
      payouts,
      invoices,
      vendors,
      threads,
      documents,
      governingDocs,
      violationList,
      reportList,
      ballots,
      templates,
      associationRow,
      meetingList,
      reserveComponentList,
      sharedCosts,
      sharedCostBills,
      announcementList,
      actionItemList,
      joinRequestList,
    ],
  );

  // A signed in person looking at a real association sees Postgres. Everyone
  // else sees the demo. The two never blend: `remote.community` is either the
  // whole world or none of it.
  const community_ = remote.community ?? liveCommunity;

  const value: AppState = {
    community: community_,
    communities: remote.community
      ? remote.associations.map((a) => ({ id: a.id, label: a.name, place: a.place, slug: a.slug }))
      : communityList.map((c) => ({ id: c.id, label: c.label, place: c.association.addressLine, slug: c.id })),
    setCommunity,
    account,
    mySeats,
    chooseHome,
    // Every slice is read off the active community rather than off the local
    // stores directly, so remote and demo cannot disagree about which world
    // a screen is in. In demo mode community_ is the local overlay, so this
    // is the same data by a shorter route.
    accounts: community_.accounts,
    // "admin" is what sessions stored before the 2026-09-01 rename; the guard
    // lets it through so nobody is signed out, and it reads as board here.
    view: (session.view as string) === "admin" ? "board" : session.view,
    ready,
    settings: community_.settings,
    amenities: community_.amenities,
    forms: community_.forms,
    posts: community_.posts,
    requests: community_.requests,
    instruments: community_.instruments,
    ledger: community_.ledger,
    payouts: community_.payouts,
    invoices: community_.invoices,
    vendors: community_.vendors,
    threads: community_.threads,
    documents: community_.documents,
    ballots: community_.ballots,
    templates: community_.templates,
    signIn,
    signOut,
    setView,
    can,
    sees,
    updateSettings,
    setAmenities,
    setForms,
    removeForm,
    removeAmenity,
    addVendor,
    saveTemplate,
    removeVendor,
    removeDocument,
    setCapability,
    resetDemo,
    createCommunity,
    createRemoteAssociation,
    isRemote: Boolean(remote.community),
    addOwner,
    addViolationReport,
    verifyReport,
    dismissReport,
    raiseNoticeFromReport,
    setOpeningBalances,
    setHouseholdOwner,
    addSecondOwner,
    removeCoOwner,
    changeOwnerEmail,
    setHomeType,
    setHomeDues,
    removeOwner,
    transferHome,
    setAccountRole,
    dismissedSetupTasks,
    dismissSetupTask,
    restoreSetupTask,
    addBankAccount,
    recordPayment,
    recordManualPayment,
    reverseManualPayment,
    manualPaymentsFor,
    addCredit,
    addCharge,
    addChargeToAll,
    setOpeningBankBalance,
    addPost,
    addAnnouncement,
    removeAnnouncement,
    sendMeetingNotice,
    moderatePost,
    togglePinned,
    removePost,
    addRequest,
    addInstrument,
    removeInstrument,
    setDefaultInstrument,
    confirmLedgerEntry,
    recordReserveTransfer,
    dismissLedgerEntry,
    approvePayout,
    markPayoutPaid,
    markW9Requested,
    replyToThread,
    messageBoard,
    replyAsOwner,
    messageOwner,
    uploadDocuments,
    addGoverningArticles,
    updateAssociation,
    addPayout,
    addBallot,
    addMeeting,
    addBudgetLine,
    addReserveComponent,
    addSharedCost,
    removeSharedCost,
    postSharedCostBill,
    setDocumentVisibility,
    castVote,
    updateRequestStatus,
    replyToRequest,
    likePost,
    replyToPost,
    updateMyContact,
    setAutopay,
    markViolationFixed,
    setWorkOrder,
    rsvpMeeting,
    addActionItem,
    setActionItemDone,
    removeActionItem,
    approveJoinRequest,
    seatJoinRequest,
    declineJoinRequest,
    requestToJoin,
    lookupJoinCode,
    setHomeRole,
    addInvoice,
    payInvoice,
    approveInvoice,
    rejectInvoice,
    setPayoutNotes,
    setViolationStage,
    addCityNotice,
    addNotice,
    closeBallot,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}

/**
 * The owner record behind the signed in account. An admin switching to the
 * resident view sees their own unit and their own balance, not a demo one.
 */
export function useCurrentOwner(): Owner | null {
  const { account, community } = useAppState();
  // Indexed per community, so a lookup stays constant time as either grows.
  const index = useMemo(
    () => new Map(community.owners.map((owner) => [owner.id, owner])),
    [community],
  );
  return useMemo(() => (account ? (index.get(account.ownerId) ?? null) : null), [account, index]);
}

/** Charge history is only seeded for a few households; everyone else sees an empty ledger. */
export function useOwnerCharges() {
  const { community } = useAppState();
  const owner = useCurrentOwner();
  return owner ? (community.ownerCharges[owner.id] ?? []) : [];
}

/**
 * The signed-in owner's photo of their home, with a setter. Null clears it.
 *
 * `photo` is always the best image we hold, in this order: what the owner
 * uploaded in this browser, then the photo on their record, then the
 * community's cover. `uploaded` says whether the first of those is in play,
 * which is the only case "Remove photo" makes sense for.
 */
export function useHomePhoto(): {
  photo: string | null;
  uploaded: boolean;
  setPhoto: (dataUrl: string | null) => void;
} {
  const owner = useCurrentOwner();
  const { settings } = useAppState();
  const all = useStore(homePhotoStore);
  const ownerId = owner?.id;
  const setPhoto = useCallback(
    (dataUrl: string | null) => {
      if (!ownerId) return;
      homePhotoStore.update((current) => {
        const next = { ...current };
        if (dataUrl) next[ownerId] = dataUrl;
        else delete next[ownerId];
        return next;
      });
    },
    [ownerId],
  );
  const own = ownerId ? (all[ownerId] ?? null) : null;
  return {
    photo: own ?? owner?.photoUrl ?? settings.photoUrl ?? null,
    uploaded: Boolean(own),
    setPhoto,
  };
}

export function useMyRequests() {
  const owner = useCurrentOwner();
  const { requests: all } = useAppState();
  return useMemo(
    () =>
      owner
        ? all
            .filter((r) => r.ownerId === owner.id)
            .sort((a, b) => (a.submittedDate < b.submittedDate ? 1 : -1))
        : [],
    [owner, all],
  );
}

/**
 * What a resident is allowed to see: published posts, plus their own pending
 * ones so they can tell the post was received rather than lost.
 */
export function useVisiblePosts(): ForumPost[] {
  const { posts, account } = useAppState();
  return useMemo(
    () =>
      posts.filter(
        (post) =>
          post.status === "published" ||
          (account && post.author === account.name && post.status !== "rejected"),
      ),
    [posts, account],
  );
}

/** The moderation queue, oldest first so nothing sits forever. */
export function usePendingPosts(): ForumPost[] {
  const { posts } = useAppState();
  return useMemo(
    () =>
      posts.filter((p) => p.status === "pending").sort((a, b) => (a.at < b.at ? -1 : 1)),
    [posts],
  );
}

/**
 * Reconciliation over the live ledger rather than the frozen fixture, so
 * confirming a transaction updates every count that depends on it.
 */
export function useReconciliation() {
  const { ledger, community } = useAppState();
  return useMemo(() => {
    const needsReview = ledger.filter((e) => e.status === "needs-review");
    const pending = ledger.filter((e) => e.status === "pending");
    const cleared = ledger.filter((e) => e.status === "cleared");
    const duplicates = ledger.filter((e) => e.duplicateOfId);
    return {
      needsReview,
      pending,
      cleared,
      duplicates,
      staleFeeds: community.bankAccounts.filter((a) => a.status !== "live"),
      lastSyncMinutes: community.bankAccounts.length
        ? Math.min(...community.bankAccounts.map((a) => a.syncedMinutesAgo))
        : 0,
      tiesOut: needsReview.length === 0,
    };
  }, [ledger, community]);
}

/** Payouts still short of the signatures they need. */
export function usePendingApprovals() {
  const { payouts } = useAppState();
  return useMemo(
    () => payouts.filter((p) => p.approvals.length < p.approvalsRequired),
    [payouts],
  );
}

export function useUnreadThreadCount() {
  const { threads } = useAppState();
  return useMemo(() => threads.filter((t) => t.unread).length, [threads]);
}

/** Vendor paperwork the board still owes someone. */
export function useVendorGaps() {
  const { vendors } = useAppState();
  return useMemo(
    () => ({
      missingW9: vendors.filter((v) => !v.w9OnFile),
      noAch: vendors.filter((v) => !v.achEnabled),
      expiringCoi: vendors.filter(
        (v) => v.coiExpires && daysFromToday(v.coiExpires) < 60 && daysFromToday(v.coiExpires) >= 0,
      ),
    }),
    [vendors],
  );
}

/**
 * The snapshot the in-app assistant answers from.
 *
 * Built on the client from live state rather than rendered on the server, so it
 * follows the signed in household and the active association. The assistant is
 * only trustworthy if it reads the same data the screens do.
 */
export function useAssistantContext() {
  const { community, settings, requests, documents, amenities } = useAppState();
  const owner = useCurrentOwner();
  const charges = useOwnerCharges();

  return useMemo(() => {
    const lastPayment = charges.find((c) => c.kind === "payment");
    const live = community.meetings.find((m) => m.status === "live");
    const cash = community.bankAccounts.reduce(
      (acc, a) =>
        a.kind === "operating"
          ? { ...acc, operating: acc.operating + a.balanceCents }
          : { ...acc, reserve: acc.reserve + a.balanceCents },
      { operating: 0, reserve: 0 },
    );
    const reserveBalance = cash.reserve;
    const blendedApy = reserveBalance
      ? community.bankAccounts
          .filter((a) => a.kind !== "operating")
          .reduce((t, a) => t + a.apy * a.balanceCents, 0) / reserveBalance
      : 0;
    const required = community.reserveComponents.reduce(
      (t, c) => t + c.replacementCostCents,
      0,
    );
    const funded = community.reserveComponents.reduce((t, c) => t + c.fundedCents, 0);

    return {
      owner: {
        name: owner?.members[0] ?? "",
        unit: owner?.unit ?? "",
        balanceCents: owner?.balanceCents ?? 0,
        nextChargeDate: community.nextChargeDate as string | undefined,
        standing: owner?.standing ?? "current",
        daysPastDue: owner?.daysPastDue ?? 0,
        autopay: owner?.autopay ?? false,
        lastPayment: lastPayment
          ? {
              date: lastPayment.date,
              amountCents: Math.abs(lastPayment.amountCents),
              method: lastPayment.method,
              appliedTo: lastPayment.appliedTo?.map((a) => a.label) ?? [],
            }
          : undefined,
      },
      association: {
        name: community.association.name,
        // What this owner's home pays, which is the one figure the assistant
        // says about dues.
        duesCents: ownerDues(community.association, owner ?? undefined),
        unitCount: homeCount(community),
        operatingCents: cash.operating,
        reserveCents: reserveBalance,
        interestYtdCents: community.bankAccounts.reduce((t, a) => t + a.interestYtdCents, 0),
        blendedApy,
        reservePercentFunded: required ? funded / required : 0,
      },
      methods: community.instruments.map((m) => ({
        label: m.label,
        kind: m.kind,
        feeCents: 0,
        feePercent: 0,
      })),
      meetings: community.meetings
        // By phase, as every screen reads them: nothing marks a real
        // association's meeting ended, so its date does.
        .filter((m) => meetingPhase(m) !== "ended")
        .map((m) => ({
          title: m.title,
          date: m.date,
          time: m.time,
          location: m.location,
          dialIn: m.dialIn,
          status: m.status,
        })),
      liveMeeting: live ? { title: live.title, attendees: live.attendees.length } : undefined,
      events: [] as { title: string; date: string; time: string; location: string }[],
      ballots: community.ballots
        // A ballot past its closing date is closed, pressed or not.
        .filter((b) => b.audience === "owners" && ballotPhase(b) === "open")
        .map((b) => ({ title: b.title, closesDate: b.closesDate, voted: Boolean(b.myVoteOptionId) })),
      requests: requests
        .filter((r) => r.ownerId === owner?.id)
        .map((r) => ({
          reference: r.reference,
          title: r.title,
          status: r.status,
          submittedDate: r.submittedDate,
        })),
      documentCount: documents.filter((d) => d.visibility !== "board").length,
      amenities: amenities.map((a) => ({ name: a.name, status: a.status, detail: a.detail })),
      fundsVisible: settings.showFundsToResidents,
    };
  }, [community, settings, requests, documents, amenities, owner, charges]);
}

/** The signed in household's payment instruments, default first. */
export function useMyInstruments(): PaymentInstrument[] {
  const owner = useCurrentOwner();
  const { instruments } = useAppState();
  return useMemo(
    () =>
      owner
        ? instruments
            .filter((i) => i.ownerId === owner.id)
            .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
        : [],
    [owner, instruments],
  );
}

/** Open, decided, then history. A request leaves the queue, never the record. */
export const OPEN_STATUSES = ["draft", "submitted", "in-review", "info-needed"] as const;
export const DECIDED_STATUSES = ["approved", "denied"] as const;

export function bucketRequests<T extends { status: string }>(rows: T[]) {
  return {
    open: rows.filter((r) => (OPEN_STATUSES as readonly string[]).includes(r.status)),
    decided: rows.filter((r) => (DECIDED_STATUSES as readonly string[]).includes(r.status)),
    history: rows.filter((r) => r.status === "closed"),
  };
}

/**
 * Any association by id, including ones built through onboarding.
 *
 * Created associations live in a store that only has content after hydration,
 * so a component resolving one during the first render sees the server
 * snapshot and finds nothing. Subscribing here means the lookup re-runs once
 * storage has been read, which is what an invitation link needs.
 */
export function useCommunityById(id: string | null | undefined): Community | null {
  const created = useStore(createdCommunitiesStore);
  return useMemo(() => {
    if (!id) return null;
    const base = [...seededCommunities, ...created].find((c) => c.id === id);
    return base ? withLiveSlices(base) : null;
  }, [id, created]);
}

/**
 * A community with its stored slices laid over the seed.
 *
 * Every association exists in two halves: a seed, which is either a fixture or
 * the bundle onboarding wrote, and the slice stores that hold everything
 * changed since. Reading only the seed is how a household added this morning
 * fails to exist. The provider does the same overlay through hooks so the
 * active community stays reactive; this is the one-shot version, for reading
 * an association you are not signed into.
 */
export function withLiveSlices(base: Community): Community {
  const next = { ...base };
  for (const slice of MUTABLE_SLICES) {
    (next as Record<string, unknown>)[slice] = sliceStore(base.id, slice).getSnapshot();
  }
  return next;
}

/** True once storage has been read, so a caller can tell missing from not-yet-loaded. */
export function useStorageReady(): boolean {
  return useHydrated();
}
