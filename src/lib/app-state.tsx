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
  ownersById,
  ownerCharges,
  requests as seedRequests,
  accounts as seedAccounts,
  architecturalForms as seedForms,
  communityAmenities as seedAmenities,
  communitySettings as seedSettings,
  forumPosts as seedPosts,
  paymentInstruments as seedInstruments,
  bankAccounts,
  ballots as seedBallots,
  messageTemplates as seedTemplates,
  documents as seedDocuments,
  ledgerEntries as seedLedger,
  payouts as seedPayouts,
  threads as seedThreads,
  vendors as seedVendors,
} from "@/lib/data";
import type { PaymentInstrument } from "@/lib/payments/instruments";
import type { Ballot, DocumentRecord, LedgerEntry, MessageThread, Payout, Vendor } from "@/lib/types";
import type { MessageTemplate } from "@/lib/data/templates";
import { CircuitBreaker } from "@/lib/core/circuit-breaker";
import { daysFromToday, TODAY } from "@/lib/utils";
import { PersistedStore, type Store } from "@/lib/core/store";
import {
  isCommunitySettings,
  isRecordArray,
  isSession,
  type StoredSession,
} from "@/lib/core/guards";
import type {
  Account,
  HomeRequest,
  Owner,
  ArchitecturalForm,
  Capability,
  CommunityAmenity,
  CommunitySettings,
  ForumPost,
} from "@/lib/types";

/**
 * Prototype application state.
 *
 * There is no real authentication here. Signing in selects one of the seeded
 * accounts so you can see the product from that person's seat. Everything an
 * admin edits lives in this provider, so a change on the settings screen shows
 * up on the resident side immediately, which is the point of the demo.
 */

export type View = "resident" | "admin";

interface AppState {
  account: Account | null;
  accounts: Account[];
  view: View;
  settings: CommunitySettings;
  amenities: CommunityAmenity[];
  forms: ArchitecturalForm[];
  posts: ForumPost[];
  requests: HomeRequest[];
  instruments: PaymentInstrument[];
  ledger: LedgerEntry[];
  payouts: Payout[];
  vendors: Vendor[];
  threads: MessageThread[];
  documents: DocumentRecord[];
  ballots: Ballot[];
  templates: MessageTemplate[];
  signIn: (accountId: string) => void;
  signOut: () => void;
  setView: (v: View) => void;
  can: (c: Capability) => boolean;
  updateSettings: (patch: Partial<CommunitySettings>) => void;
  setAmenities: (next: CommunityAmenity[]) => void;
  setForms: (next: ArchitecturalForm[]) => void;
  removeForm: (formId: string) => () => void;
  removeAmenity: (amenityId: string) => () => void;
  addVendor: (vendor: Vendor) => void;
  saveTemplate: (template: MessageTemplate) => void;
  removeVendor: (vendorId: string) => () => void;
  removeDocument: (documentId: string) => () => void;
  setCapability: (accountId: string, capability: Capability, on: boolean) => void;
  resetDemo: () => void;
  addPost: (post: ForumPost) => void;
  moderatePost: (postId: string, decision: "published" | "rejected", reason?: string) => void;
  togglePinned: (postId: string) => void;
  removePost: (postId: string) => () => void;
  addRequest: (request: HomeRequest) => void;
  addInstrument: (instrument: Omit<PaymentInstrument, "id" | "isDefault">) => PaymentInstrument;
  removeInstrument: (instrumentId: string) => () => void;
  setDefaultInstrument: (instrumentId: string) => void;
  confirmLedgerEntry: (entryId: string, category?: LedgerEntry["category"]) => void;
  dismissLedgerEntry: (entryId: string) => () => void;
  approvePayout: (payoutId: string) => void;
  markW9Requested: (vendorId: string) => void;
  replyToThread: (threadId: string, body: string) => void;
  addDocument: (document: DocumentRecord) => void;
  setDocumentVisibility: (documentId: string, visibility: DocumentRecord["visibility"]) => void;
  castBoardVote: (ballotId: string, optionId: string) => void;
  updateRequestStatus: (requestId: string, status: HomeRequest["status"], note?: string) => void;
  likePost: (postId: string) => void;
  ready: boolean;
}

const Ctx = createContext<AppState | null>(null);

/** The demo's pinned "now", used for every timestamp the app writes. */
const TODAY_ISO = TODAY.toISOString().slice(0, 10);

/* -------------------------------------------------------------------------- */
/* Stores                                                                      */
/*                                                                             */
/* Everything the demo lets you change lives in one of these. They sit outside */
/* React and are read through useSyncExternalStore, which keeps the server and */
/* client markup in agreement and avoids a setState cascade on every mount.    */
/* -------------------------------------------------------------------------- */

type Session = StoredSession;

const NO_SESSION: Session = { accountId: null, view: "resident" };

/**
 * One breaker for every store. A browser that refuses site data should trip
 * the circuit once, not six times, and all six stores should degrade together.
 */
const storageBreaker = new CircuitBreaker("localStorage", {
  failureThreshold: 3,
  cooldownMs: 30_000,
});

const sessionStore = new PersistedStore<Session>("hoasis-session", NO_SESSION, {
  breaker: storageBreaker,
  validate: isSession,
});
const accountStore = new PersistedStore<Account[]>("hoasis-accounts", seedAccounts, {
  breaker: storageBreaker,
  validate: isRecordArray<Account>(),
});
const settingsStore = new PersistedStore<CommunitySettings>("hoasis-settings", seedSettings, {
  breaker: storageBreaker,
  validate: isCommunitySettings,
});
const amenityStore = new PersistedStore<CommunityAmenity[]>("hoasis-amenities", seedAmenities, {
  breaker: storageBreaker,
  validate: isRecordArray<CommunityAmenity>(),
});
const formStore = new PersistedStore<ArchitecturalForm[]>("hoasis-forms", seedForms, {
  breaker: storageBreaker,
  validate: isRecordArray<ArchitecturalForm>(),
});
const postStore = new PersistedStore<ForumPost[]>("hoasis-posts", seedPosts, {
  breaker: storageBreaker,
  validate: isRecordArray<ForumPost>(),
});
const requestStore = new PersistedStore<HomeRequest[]>("hoasis-requests", seedRequests, {
  breaker: storageBreaker,
  validate: isRecordArray<HomeRequest>(),
});
const ledgerStore = new PersistedStore<LedgerEntry[]>("hoasis-ledger", seedLedger, {
  breaker: storageBreaker,
  validate: isRecordArray<LedgerEntry>(),
});
const payoutStore = new PersistedStore<Payout[]>("hoasis-payouts", seedPayouts, {
  breaker: storageBreaker,
  validate: isRecordArray<Payout>(),
});
const vendorStore = new PersistedStore<Vendor[]>("hoasis-vendors", seedVendors, {
  breaker: storageBreaker,
  validate: isRecordArray<Vendor>(),
});
const threadStore = new PersistedStore<MessageThread[]>("hoasis-threads", seedThreads, {
  breaker: storageBreaker,
  validate: isRecordArray<MessageThread>(),
});
const documentStore = new PersistedStore<DocumentRecord[]>("hoasis-documents", seedDocuments, {
  breaker: storageBreaker,
  validate: isRecordArray<DocumentRecord>(),
});
const ballotStore = new PersistedStore<Ballot[]>("hoasis-ballots", seedBallots, {
  breaker: storageBreaker,
  validate: isRecordArray<Ballot>(),
});
const templateStore = new PersistedStore<MessageTemplate[]>("hoasis-templates", seedTemplates, {
  breaker: storageBreaker,
  validate: isRecordArray<MessageTemplate>(),
});
const instrumentStore = new PersistedStore<PaymentInstrument[]>(
  "hoasis-instruments",
  seedInstruments,
  { breaker: storageBreaker, validate: isRecordArray<PaymentInstrument>() },
);

/** Reset together, so "reset demo data" cannot leave half the app rewritten. */
const stores = [
  accountStore,
  settingsStore,
  amenityStore,
  formStore,
  postStore,
  requestStore,
  instrumentStore,
  ledgerStore,
  payoutStore,
  vendorStore,
  threadStore,
  documentStore,
  ballotStore,
  templateStore,
] as const;

/**
 * Clears every store, session included.
 *
 * These stores are module singletons, which is right for the app and hostile
 * to tests: a value cached in one test would otherwise survive into the next
 * even after localStorage is wiped. The suite calls this between tests. Product
 * code should use `resetDemo`, which deliberately leaves you signed in.
 */
export function resetAllStores(): void {
  sessionStore.reset();
  for (const store of stores) store.reset();
}

/**
 * Runs a destructive change and returns a function that puts it back.
 *
 * Snapshotting the whole collection is the right trade here: these are small,
 * and restoring the exact prior array is simpler and safer than trying to
 * re-insert one record at its old index with its old neighbours.
 */
function destructive<T>(store: Store<T>, mutate: (current: T) => T): () => void {
  const previous = store.getSnapshot();
  store.update(mutate);
  return () => store.set(previous);
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
  const ready = useHydrated();
  const accountList = useStore(accountStore);
  const settings = useStore(settingsStore);
  const amenities = useStore(amenityStore);
  const forms = useStore(formStore);
  const posts = useStore(postStore);
  const requestList = useStore(requestStore);
  const instruments = useStore(instrumentStore);
  const ledger = useStore(ledgerStore);
  const payouts = useStore(payoutStore);
  const vendors = useStore(vendorStore);
  const threads = useStore(threadStore);
  const documents = useStore(documentStore);
  const ballots = useStore(ballotStore);
  const templates = useStore(templateStore);

  const account = useMemo(
    () => accountList.find((candidate) => candidate.id === session.accountId) ?? null,
    [accountList, session.accountId],
  );

  const signIn = useCallback((id: string) => {
    const next = accountStore.getSnapshot().find((a) => a.id === id);
    sessionStore.set({
      accountId: id,
      view: next && next.role !== "resident" ? "admin" : "resident",
    });
  }, []);

  const signOut = useCallback(() => sessionStore.set(NO_SESSION), []);

  const setView = useCallback(
    (view: View) => sessionStore.update((current) => ({ ...current, view })),
    [],
  );

  const can = useCallback(
    (c: Capability) => Boolean(account && account.capabilities[c]),
    [account],
  );

  const updateSettings = useCallback(
    (patch: Partial<CommunitySettings>) =>
      settingsStore.update((current) => ({ ...current, ...patch })),
    [],
  );

  const setAmenities = useCallback((next: CommunityAmenity[]) => amenityStore.set(next), []);
  const setForms = useCallback((next: ArchitecturalForm[]) => formStore.set(next), []);

  const setCapability = useCallback((id: string, capability: Capability, on: boolean) => {
    // The President's grid is deliberately immutable. An association that can
    // strip its President of access has no way back in.
    accountStore.update((list) =>
      list.map((a) =>
        a.id === id && a.role !== "president"
          ? { ...a, capabilities: { ...a.capabilities, [capability]: on } }
          : a,
      ),
    );
  }, []);

  const addPost = useCallback(
    (post: ForumPost) => postStore.update((all) => [post, ...all]),
    [],
  );

  const addRequest = useCallback(
    (request: HomeRequest) => requestStore.update((all) => [request, ...all]),
    [],
  );

  /**
   * Approves or rejects a post. Rejection keeps the record and the reason
   * rather than deleting it, so a resident can be told why and a board can
   * show it did not censor arbitrarily.
   */
  const moderatePost = useCallback(
    (postId: string, decision: "published" | "rejected", reason?: string) => {
      const moderator = accountStore
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      postStore.update((all) =>
        all.map((post) =>
          post.id === postId
            ? {
                ...post,
                status: decision,
                moderatedBy: moderator?.name,
                moderatedAt: TODAY_ISO,
                rejectionReason: decision === "rejected" ? reason : undefined,
              }
            : post,
        ),
      );
    },
    [],
  );

  const togglePinned = useCallback((postId: string) => {
    postStore.update((all) =>
      all.map((post) => (post.id === postId ? { ...post, pinned: !post.pinned } : post)),
    );
  }, []);

  const removePost = useCallback(
    (postId: string) => destructive(postStore, (all) => all.filter((p) => p.id !== postId)),
    [],
  );

  const removeForm = useCallback(
    (formId: string) => destructive(formStore, (all) => all.filter((f) => f.id !== formId)),
    [],
  );

  const removeAmenity = useCallback(
    (amenityId: string) =>
      destructive(amenityStore, (all) => all.filter((a) => a.id !== amenityId)),
    [],
  );

  const saveTemplate = useCallback((template: MessageTemplate) => {
    templateStore.update((all) =>
      all.some((t) => t.id === template.id)
        ? all.map((t) => (t.id === template.id ? template : t))
        : [...all, template],
    );
  }, []);

  const addVendor = useCallback(
    (vendor: Vendor) => vendorStore.update((all) => [vendor, ...all]),
    [],
  );

  const removeVendor = useCallback(
    (vendorId: string) => destructive(vendorStore, (all) => all.filter((v) => v.id !== vendorId)),
    [],
  );

  const removeDocument = useCallback(
    (documentId: string) =>
      destructive(documentStore, (all) => all.filter((d) => d.id !== documentId)),
    [],
  );

  const likePost = useCallback(
    (postId: string) =>
      postStore.update((all) =>
        all.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)),
      ),
    [],
  );

  /**
   * Adds an instrument and returns it. The first one an owner adds becomes
   * their default, because a payment screen with no default selected is a
   * dead end.
   */
  const addInstrument = useCallback(
    (draft: Omit<PaymentInstrument, "id" | "isDefault">): PaymentInstrument => {
      const existing = instrumentStore.getSnapshot();
      const mine = existing.filter((i) => i.ownerId === draft.ownerId);
      const instrument: PaymentInstrument = {
        ...draft,
        id: `pm-${draft.kind}-${draft.mask}-${existing.length}`,
        isDefault: mine.length === 0,
      };
      instrumentStore.set([...existing, instrument]);
      return instrument;
    },
    [],
  );

  /** Removing the default promotes whatever the owner has left. */
  const removeInstrument = useCallback(
    (instrumentId: string) =>
      destructive(instrumentStore, (all) => {
        const removed = all.find((i) => i.id === instrumentId);
        const kept = all.filter((i) => i.id !== instrumentId);
        if (!removed?.isDefault) return kept;
        const successor = kept.find((i) => i.ownerId === removed.ownerId);
        return successor
          ? kept.map((i) => (i.id === successor.id ? { ...i, isDefault: true } : i))
          : kept;
      }),
    [],
  );

  /** Exactly one default per household, enforced on write rather than hoped for. */
  const setDefaultInstrument = useCallback((instrumentId: string) => {
    instrumentStore.update((all) => {
      const target = all.find((i) => i.id === instrumentId);
      if (!target) return all;
      return all.map((i) =>
        i.ownerId === target.ownerId ? { ...i, isDefault: i.id === instrumentId } : i,
      );
    });
  }, []);

  /* ------------------------------------------------------------ admin work */

  /**
   * Clears a transaction out of review. Nothing is auto-categorized: a human
   * either accepts the suggestion or supplies a category, and either way the
   * entry becomes cleared and starts counting toward the reports.
   */
  const confirmLedgerEntry = useCallback((entryId: string, category?: LedgerEntry["category"]) => {
    ledgerStore.update((all) =>
      all.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              status: "cleared",
              category: category ?? entry.suggestedCategory ?? entry.category,
              suggestedCategory: undefined,
              suggestionConfidence: undefined,
              matchedBy: "manual",
            }
          : entry,
      ),
    );
  }, []);

  /** Removes a duplicate. The only ledger action that deletes rather than files. */
  const dismissLedgerEntry = useCallback(
    (entryId: string) => destructive(ledgerStore, (all) => all.filter((e) => e.id !== entryId)),
    [],
  );

  /** Adds the signed in officer's signature, and releases once the threshold is met. */
  const approvePayout = useCallback((payoutId: string) => {
    const approver = accountStore
      .getSnapshot()
      .find((a) => a.id === sessionStore.getSnapshot().accountId);
    if (!approver) return;
    payoutStore.update((all) =>
      all.map((payout) => {
        if (payout.id !== payoutId) return payout;
        if (payout.approvals.some((a) => a.name === approver.name)) return payout;
        const approvals = [...payout.approvals, { name: approver.name, at: TODAY_ISO }];
        return {
          ...payout,
          approvals,
          status: approvals.length >= payout.approvalsRequired ? "scheduled" : payout.status,
        };
      }),
    );
  }, []);

  const markW9Requested = useCallback((vendorId: string) => {
    vendorStore.update((all) =>
      all.map((vendor) => (vendor.id === vendorId ? { ...vendor, w9OnFile: true } : vendor)),
    );
  }, []);

  const replyToThread = useCallback((threadId: string, body: string) => {
    const sender = accountStore
      .getSnapshot()
      .find((a) => a.id === sessionStore.getSnapshot().accountId);
    threadStore.update((all) =>
      all.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              unread: false,
              updatedDate: TODAY_ISO,
              messages: [
                ...thread.messages,
                {
                  id: `m-${thread.id}-${thread.messages.length}`,
                  at: TODAY_ISO,
                  from: sender?.name ?? "Board",
                  fromRole: "board" as const,
                  direction: "outbound" as const,
                  channel: "email" as const,
                  body,
                },
              ],
            }
          : thread,
      ),
    );
  }, []);

  const addDocument = useCallback((document: DocumentRecord) => {
    documentStore.update((all) => [document, ...all]);
  }, []);

  const setDocumentVisibility = useCallback(
    (documentId: string, visibility: DocumentRecord["visibility"]) => {
      documentStore.update((all) =>
        all.map((doc) => (doc.id === documentId ? { ...doc, visibility } : doc)),
      );
    },
    [],
  );

  /** One vote per director per ballot. Changing your mind replaces it. */
  const castBoardVote = useCallback((ballotId: string, optionId: string) => {
    ballotStore.update((all) =>
      all.map((ballot) => {
        if (ballot.id !== ballotId) return ballot;
        const previous = ballot.myVoteOptionId;
        if (previous === optionId) return ballot;
        return {
          ...ballot,
          myVoteOptionId: optionId,
          options: ballot.options.map((option) => {
            if (option.id === optionId) return { ...option, votes: option.votes + 1 };
            if (option.id === previous) return { ...option, votes: Math.max(0, option.votes - 1) };
            return option;
          }),
        };
      }),
    );
  }, []);

  const updateRequestStatus = useCallback(
    (requestId: string, status: HomeRequest["status"], note?: string) => {
      const actor = accountStore
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      requestStore.update((all) =>
        all.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status,
                decisionDate: ["approved", "denied"].includes(status)
                  ? TODAY_ISO
                  : request.decisionDate,
                decidedBy: ["approved", "denied"].includes(status) ? actor?.name : request.decidedBy,
                thread: [
                  ...request.thread,
                  {
                    id: `rt-${request.id}-${request.thread.length}`,
                    at: TODAY_ISO,
                    actor: actor?.name ?? "Board",
                    actorRole: "board" as const,
                    body: note ?? `Status changed to ${status.replace("-", " ")}.`,
                    kind: "status" as const,
                  },
                ],
              }
            : request,
        ),
      );
    },
    [],
  );

  /** Puts the demo back to its seeded state without signing you out. */
  const resetDemo = useCallback(() => {
    for (const store of stores) store.reset();
  }, []);

  const value: AppState = {
    account,
    accounts: accountList,
    view: session.view,
    settings,
    amenities,
    forms,
    posts,
    requests: requestList,
    instruments,
    ledger,
    payouts,
    vendors,
    threads,
    documents,
    ballots,
    templates,
    signIn,
    signOut,
    setView,
    can,
    updateSettings,
    setAmenities,
    setForms,
    setCapability,
    removeForm,
    removeAmenity,
    addVendor,
    saveTemplate,
    removeVendor,
    removeDocument,
    resetDemo,
    addPost,
    moderatePost,
    togglePinned,
    removePost,
    addRequest,
    addInstrument,
    removeInstrument,
    setDefaultInstrument,
    confirmLedgerEntry,
    dismissLedgerEntry,
    approvePayout,
    markW9Requested,
    replyToThread,
    addDocument,
    setDocumentVisibility,
    castBoardVote,
    updateRequestStatus,
    likePost,
    ready,
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
  const { account } = useAppState();
  // Map lookup rather than a linear scan over 88 households on every render.
  return useMemo(() => (account ? (ownersById.get(account.ownerId) ?? null) : null), [account]);
}

/** Charge history is only seeded for one household; everyone else sees an empty ledger. */
export function useOwnerCharges() {
  const owner = useCurrentOwner();
  return owner?.id === "own-042" ? ownerCharges : [];
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
  const { ledger } = useAppState();
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
      staleFeeds: bankAccounts.filter((a) => a.status !== "live"),
      lastSyncMinutes: Math.min(...bankAccounts.map((a) => a.syncedMinutesAgo)),
      tiesOut: needsReview.length === 0,
    };
  }, [ledger]);
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
