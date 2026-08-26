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
import { caps, DEFAULT_ROLE_CAPABILITIES, NO_CAPABILITIES } from "@/lib/data/accounts";
import { daysFromToday, setToday, todayIsoDate } from "@/lib/utils";
import { PersistedStore, type Store } from "@/lib/core/store";
import { createdCommunitiesStore, saveCreatedCommunity } from "@/lib/data/created-communities";
import {
  useRemote,
  setRemoteAssociation,
  loadRemote,
  refreshRemote,
  remoteSnapshot,
} from "@/lib/data/remote-store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { signOutOfSupabase } from "@/lib/auth";

/** The signed in person's id, read straight from the remote store snapshot. */
function sessionUserId(): string | null {
  return remoteSnapshot().profileId;
}
import { buildCommunity, type CommunityDraft } from "@/lib/data/new-community";
import {
  isBudgetLines,
  isChargeLedger,
  isCommunitySettings,
  isRecordArray,
  isSession,
} from "@/lib/core/guards";
import type {
  Account,
  Capability,
  ForumPost,
  HomeRequest,
  Owner,
  BankAccount,
  AccountRole,
} from "@/lib/types";
import type { PaymentInstrument } from "@/lib/payments/instruments";

export type View = "resident" | "admin";

/**
 * Everything a screen can read or change.
 *
 * Collections are typed off the Community bundle rather than restated, so
 * adding a field to a community cannot leave this interface silently behind.
 */
interface AppState {
  /** Which association is being viewed, and what else is available. */
  community: Community;
  communities: { id: string; label: string }[];
  setCommunity: (communityId: string) => void;

  account: Account | null;
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
  vendors: Community["vendors"];
  threads: Community["threads"];
  documents: Community["documents"];
  ballots: Community["ballots"];
  templates: Community["templates"];

  signIn: (accountId: string) => void;
  signOut: () => void;
  setView: (v: View) => void;
  can: (c: Capability) => boolean;

  updateSettings: (patch: Partial<Community["settings"]>) => void;
  setAmenities: (next: Community["amenities"]) => void;
  setForms: (next: Community["forms"]) => void;
  removeForm: (formId: string) => () => void;
  removeAmenity: (amenityId: string) => () => void;
  addVendor: (vendor: Community["vendors"][number]) => void;
  saveTemplate: (template: Community["templates"][number]) => void;
  removeVendor: (vendorId: string) => () => void;
  removeDocument: (documentId: string) => () => void;
  setCapability: (accountId: string, capability: Capability, on: boolean) => void;
  resetDemo: () => void;
  /** Adds a household to the register, with the account that lets them sign in. */
  addOwner: (input: { name: string; email: string; unit: string }) => Owner;
  removeOwner: (ownerId: string) => () => void;
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
  /** Builds an association from onboarding and signs its founder in. */
  createCommunity: (draft: CommunityDraft) => Community;
  /** Founds one in Postgres, for a signed in person. */
  createRemoteAssociation: (draft: CommunityDraft) => Promise<string>;
  /** True when a real association is on screen rather than a demo. */
  isRemote: boolean;

  addPost: (post: ForumPost) => void;
  /** Returns an undo, because publishing broadcasts and rejecting discards. */
  moderatePost: (
    postId: string,
    decision: "published" | "rejected",
    reason?: string,
  ) => () => void;
  togglePinned: (postId: string) => void;
  removePost: (postId: string) => () => void;
  addRequest: (request: HomeRequest) => void;
  addInstrument: (instrument: Omit<PaymentInstrument, "id" | "isDefault">) => PaymentInstrument;
  removeInstrument: (instrumentId: string) => () => void;
  setDefaultInstrument: (instrumentId: string) => void;
  /** Returns an undo: confirming moves a transaction into every report. */
  confirmLedgerEntry: (
    entryId: string,
    category?: Community["ledger"][number]["category"],
  ) => () => void;
  dismissLedgerEntry: (entryId: string) => () => void;
  approvePayout: (payoutId: string) => void;
  markW9Requested: (vendorId: string) => void;
  replyToThread: (threadId: string, body: string) => void;
  addDocument: (document: Community["documents"][number]) => void;
  /**
   * Switching the shared cost layer on, and recording a provider bill.
   *
   * Both live here rather than in the screen because an owner's statement and
   * the board's trend read the same rows. A screen that kept its own copy would
   * be the exact drift this product argues against.
   */
  addSharedCost: (cost: Community["sharedCosts"][number]) => void;
  removeSharedCost: (costId: string) => void;
  postSharedCostBill: (bill: Community["sharedCostBills"][number]) => void;
  setDocumentVisibility: (
    documentId: string,
    visibility: Community["documents"][number]["visibility"],
  ) => void;
  /** Records a vote and returns the receipt the voter is shown. */
  castVote: (ballotId: string, optionId: string) => string;
  updateRequestStatus: (requestId: string, status: HomeRequest["status"], note?: string) => void;
  likePost: (postId: string) => void;
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

const communityStore = new PersistedStore<string>(
  "hoasis-community",
  DEFAULT_COMMUNITY_ID,
  { breaker: storageBreaker, validate: (v): v is string => typeof v === "string" },
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
  "vendors",
  "threads",
  "documents",
  "ballots",
  "templates",
  "sharedCosts",
  "sharedCostBills",
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

function sliceStore<K extends MutableSlice>(
  communityId: string,
  slice: K,
): PersistedStore<Community[K]> {
  const key = `hoasis:${communityId}:${slice}`;
  const existing = registry.get(key);
  if (existing) return existing as unknown as PersistedStore<Community[K]>;

  const seed = communityById(communityId)[slice];
  const store = new PersistedStore(key, seed, {
    breaker: storageBreaker,
    validate:
      slice === "settings"
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
  // every derived figure below this line sees the same "today".
  setToday(community.asOf);

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
  const vendors = useStore(sliceStore(communityId, "vendors"));
  const threads = useStore(sliceStore(communityId, "threads"));
  const documents = useStore(sliceStore(communityId, "documents"));
  const sharedCosts = useStore(sliceStore(communityId, "sharedCosts"));
  const sharedCostBills = useStore(sliceStore(communityId, "sharedCostBills"));
  const ballots = useStore(sliceStore(communityId, "ballots"));
  const templates = useStore(sliceStore(communityId, "templates"));

  const account = useMemo(() => {
    if (remote.community) {
      // Their account id is their profile id, so there is no seat to pick and
      // no way to be looking at somebody else's.
      return remote.community.accounts.find((a) => a.id === remote.profileId) ?? null;
    }
    return accountList.find((candidate) => candidate.id === session.accountId) ?? null;
  }, [remote.community, remote.profileId, accountList, session.accountId]);

  /* --------------------------------------------------------------- session */

  const signIn = useCallback(
    (id: string) => {
      const next = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === id);
      sessionStore.set({
        accountId: id,
        view: next && next.role !== "resident" ? "admin" : "resident",
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
    (nextId: string) => {
      // A real member holding two associations switches between them without
      // signing out, because the database knows which they belong to. Demo
      // seats still sign out, since picking a seat is how you choose a person.
      if (remote.associations.some((a) => a.id === nextId)) {
        void setRemoteAssociation(nextId);
        return;
      }
      sessionStore.set(NO_SESSION);
      communityStore.set(nextId);
    },
    [remote.associations],
  );

  const can = useCallback(
    (c: Capability) => Boolean(account && account.capabilities[c]),
    [account],
  );

  /* -------------------------------------------------------------- settings */

  const updateSettings = useCallback(
    (patch: Partial<Community["settings"]>) =>
      sliceStore(communityId, "settings").update((current) => ({ ...current, ...patch })),
    [communityId],
  );

  const setAmenities = useCallback(
    (next: Community["amenities"]) => sliceStore(communityId, "amenities").set(next),
    [communityId],
  );

  const setForms = useCallback(
    (next: Community["forms"]) => sliceStore(communityId, "forms").set(next),
    [communityId],
  );

  const removeForm = useCallback(
    (formId: string) =>
      destructive(sliceStore(communityId, "forms"), (all) => all.filter((f) => f.id !== formId)),
    [communityId],
  );

  const removeAmenity = useCallback(
    (amenityId: string) =>
      destructive(sliceStore(communityId, "amenities"), (all) =>
        all.filter((a) => a.id !== amenityId),
      ),
    [communityId],
  );

  const setCapability = useCallback(
    (id: string, capability: Capability, on: boolean) => {
      // The President's grid is deliberately immutable. An association that can
      // strip its President of access has no way back in.
      sliceStore(communityId, "accounts").update((list) =>
        list.map((a) =>
          a.id === id && a.role !== "president"
            ? { ...a, capabilities: { ...a.capabilities, [capability]: on } }
            : a,
        ),
      );
    },
    [communityId],
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
    });
    if (error) throw new Error(error.message);

    const associationId = data as string;

    // The bank the founder connected during setup, if they got that far.
    if (draft.bankAccount) {
      await supabase.from("bank_accounts").insert({
        association_id: associationId,
        kind: "operating",
        institution: draft.bankAccount.institution,
        mask: draft.bankAccount.mask,
      });
    }

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
      sliceStore(communityId, "accounts").update((all) =>
        all.map((account) =>
          account.id === accountId && account.role !== "president"
            ? {
                ...account,
                role,
                capabilities: caps(DEFAULT_ROLE_CAPABILITIES[role] ?? []),
              }
            : account,
        ),
      );
    },
    [communityId],
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
      void supabaseBrowser()
        .from("setup_dismissals")
        .upsert(
          { association_id: remote.community.id, task_key: key },
          { onConflict: "association_id,task_key" },
        )
        .then(() => refreshRemote());
    },
    [remote.community, communityId],
  );

  const restoreSetupTask = useCallback(
    (key: string) => {
      if (!remote.community) {
        dismissStore(communityId).update((all) => all.filter((k) => k !== key));
        return;
      }
      void supabaseBrowser()
        .from("setup_dismissals")
        .delete()
        .eq("association_id", remote.community.id)
        .eq("task_key", key)
        .then(() => refreshRemote());
    },
    [remote.community, communityId],
  );

  /* ----------------------------------------------------------------- money */

  /** Connects an account the association can receive dues into. */
  const addBankAccount = useCallback(
    (account: BankAccount) => {
      sliceStore(communityId, "bankAccounts").update((all) => [
        ...all.filter((a) => a.id !== account.id),
        account,
      ]);
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
      const date = todayIsoDate();
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
      let remaining = input.amountCents;
      const appliedTo: { chargeId: string; label: string; amountCents: number }[] = [];
      for (const line of [...existing].reverse()) {
        if (remaining <= 0) break;
        if (line.kind !== "charge") continue;
        const open = line.amountCents - (paidAgainst.get(line.id) ?? 0);
        if (open <= 0) continue;
        const take = Math.min(open, remaining);
        appliedTo.push({ chargeId: line.id, label: line.label, amountCents: take });
        remaining -= take;
      }

      const owners = sliceStore(communityId, "owners");
      const owner = owners.getSnapshot().find((o) => o.id === input.ownerId);
      const balanceAfter = Math.max(0, (owner?.balanceCents ?? 0) - input.amountCents);

      charges.update((all) => ({
        ...all,
        [input.ownerId]: [
          {
            id: `pay-${date}-${input.ownerId}-${existing.length + 1}`,
            date,
            label: input.kind === "ach" ? "Bank payment" : `Card payment, ${input.method}`,
            kind: "payment" as const,
            amountCents: -input.amountCents,
            balanceAfterCents: balanceAfter,
            method: input.method,
            feeCents: input.processorCents,
            feePaidBy: "association" as const,
            // An early payment covers nothing yet, and saying so beats
            // inventing a charge for it to have paid.
            ...(appliedTo.length ? { appliedTo } : {}),
          },
          ...all[input.ownerId] ?? [],
        ],
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
        {
          id: `led-${date}-${input.ownerId}-${all.length + 1}`,
          date,
          description: `Assessment payment, unit ${owner?.unit ?? "?"}`,
          counterparty: owner?.displayName ?? "Owner",
          category: "Assessments" as const,
          accountId: operating?.id ?? "unassigned",
          amountCents: input.amountCents - absorbed,
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
   * Adds a household to the roster, with the account that lets them sign in.
   *
   * An owner and an account are created together because in an association
   * they are the same fact: the register says who the members are, and every
   * member gets access. Splitting them lets the two drift.
   */
  const addOwner = useCallback(
    (input: { name: string; email: string; unit: string }) => {
      const owners = sliceStore(communityId, "owners");
      const unit = input.unit.trim();
      if (owners.getSnapshot().some((o) => o.unit === unit)) {
        throw new ValidationError(`Unit ${unit} is already on the roster`, { unit });
      }

      const ownerId = `${communityId}-own-${unit}`;
      const owner: Owner = {
        id: ownerId,
        displayName: input.name.trim(),
        members: [input.name.trim()],
        email: input.email.trim(),
        phone: "",
        unit,
        address: `Unit ${unit}`,
        moveInDate: todayIsoDate(),
        balanceCents: 0,
        autopay: false,
        standing: "current",
        daysPastDue: 0,
      };

      owners.update((all) => [...all, owner]);
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
        },
      ]);
      return owner;
    },
    [communityId],
  );

  /** Removes a household and its account together, returning one undo for both. */
  const removeOwner = useCallback(
    (ownerId: string) => {
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
    },
    [communityId],
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
    sessionStore.set({ accountId: built.accounts[0].id, view: "admin" });
    return built;
  }, []);

  /* ----------------------------------------------------------------- forum */

  const addPost = useCallback(
    (post: ForumPost) => sliceStore(communityId, "posts").update((all) => [post, ...all]),
    [communityId],
  );

  const moderatePost = useCallback(
    (postId: string, decision: "published" | "rejected", reason?: string) => {
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
    [communityId],
  );

  const togglePinned = useCallback(
    (postId: string) =>
      sliceStore(communityId, "posts").update((all) =>
        all.map((post) => (post.id === postId ? { ...post, pinned: !post.pinned } : post)),
      ),
    [communityId],
  );

  const removePost = useCallback(
    (postId: string) =>
      destructive(sliceStore(communityId, "posts"), (all) => all.filter((p) => p.id !== postId)),
    [communityId],
  );

  const likePost = useCallback(
    (postId: string) =>
      sliceStore(communityId, "posts").update((all) =>
        all.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)),
      ),
    [communityId],
  );

  /* -------------------------------------------------------------- requests */

  const addRequest = useCallback(
    (request: HomeRequest) =>
      sliceStore(communityId, "requests").update((all) => [request, ...all]),
    [communityId],
  );

  const updateRequestStatus = useCallback(
    (requestId: string, status: HomeRequest["status"], note?: string) => {
      const actor = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      sliceStore(communityId, "requests").update((all) =>
        all.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status,
                decisionDate: ["approved", "denied"].includes(status)
                  ? todayIsoDate()
                  : request.decisionDate,
                decidedBy: ["approved", "denied"].includes(status) ? actor?.name : request.decidedBy,
                thread: [
                  ...request.thread,
                  {
                    id: `rt-${request.id}-${request.thread.length}`,
                    at: todayIsoDate(),
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
    [communityId],
  );

  /* ----------------------------------------------------------- instruments */

  const addInstrument = useCallback(
    (draft: Omit<PaymentInstrument, "id" | "isDefault">): PaymentInstrument => {
      const store = sliceStore(communityId, "instruments");
      const existing = store.getSnapshot();
      const mine = existing.filter((i) => i.ownerId === draft.ownerId);
      const instrument: PaymentInstrument = {
        ...draft,
        id: `pm-${draft.kind}-${draft.mask}-${existing.length}`,
        // The first one an owner adds becomes their default, because a payment
        // screen with nothing selected is a dead end.
        isDefault: mine.length === 0,
      };
      store.set([...existing, instrument]);
      return instrument;
    },
    [communityId],
  );

  const removeInstrument = useCallback(
    (instrumentId: string) =>
      destructive(sliceStore(communityId, "instruments"), (all) => {
        const removed = all.find((i) => i.id === instrumentId);
        const kept = all.filter((i) => i.id !== instrumentId);
        if (!removed?.isDefault) return kept;
        const successor = kept.find((i) => i.ownerId === removed.ownerId);
        return successor
          ? kept.map((i) => (i.id === successor.id ? { ...i, isDefault: true } : i))
          : kept;
      }),
    [communityId],
  );

  const setDefaultInstrument = useCallback(
    (instrumentId: string) =>
      sliceStore(communityId, "instruments").update((all) => {
        const target = all.find((i) => i.id === instrumentId);
        if (!target) return all;
        // Exactly one default per household, enforced on write.
        return all.map((i) =>
          i.ownerId === target.ownerId ? { ...i, isDefault: i.id === instrumentId } : i,
        );
      }),
    [communityId],
  );

  /* ----------------------------------------------------------- admin work */

  const confirmLedgerEntry = useCallback(
    (entryId: string, category?: Community["ledger"][number]["category"]) =>
      destructive(sliceStore(communityId, "ledger"), (all) =>
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
      ),
    [communityId],
  );

  const dismissLedgerEntry = useCallback(
    (entryId: string) =>
      destructive(sliceStore(communityId, "ledger"), (all) =>
        all.filter((e) => e.id !== entryId),
      ),
    [communityId],
  );

  const approvePayout = useCallback(
    (payoutId: string) => {
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
    [communityId],
  );

  const markW9Requested = useCallback(
    (vendorId: string) =>
      sliceStore(communityId, "vendors").update((all) =>
        all.map((vendor) => (vendor.id === vendorId ? { ...vendor, w9OnFile: true } : vendor)),
      ),
    [communityId],
  );

  const addVendor = useCallback(
    (vendor: Community["vendors"][number]) =>
      sliceStore(communityId, "vendors").update((all) => [vendor, ...all]),
    [communityId],
  );

  const removeVendor = useCallback(
    (vendorId: string) =>
      destructive(sliceStore(communityId, "vendors"), (all) =>
        all.filter((v) => v.id !== vendorId),
      ),
    [communityId],
  );

  const replyToThread = useCallback(
    (threadId: string, body: string) => {
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
                messages: [
                  ...thread.messages,
                  {
                    id: `m-${thread.id}-${thread.messages.length}`,
                    at: todayIsoDate(),
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
    },
    [communityId],
  );

  const addDocument = useCallback(
    (document: Community["documents"][number]) =>
      sliceStore(communityId, "documents").update((all) => [document, ...all]),
    [communityId],
  );

  const addSharedCost = useCallback(
    (cost: Community["sharedCosts"][number]) =>
      sliceStore(communityId, "sharedCosts").update((all) => [...all, cost]),
    [communityId],
  );

  const removeSharedCost = useCallback(
    (costId: string) => {
      sliceStore(communityId, "sharedCosts").update((all) =>
        all.filter((cost) => cost.id !== costId),
      );
      // The bills go with it. Leaving them would keep the cost in every total
      // while it no longer appears in any list, which is worse than losing it.
      sliceStore(communityId, "sharedCostBills").update((all) =>
        all.filter((bill) => bill.sharedCostId !== costId),
      );
    },
    [communityId],
  );

  const postSharedCostBill = useCallback(
    (bill: Community["sharedCostBills"][number]) =>
      sliceStore(communityId, "sharedCostBills").update((all) => [...all, bill]),
    [communityId],
  );

  const setDocumentVisibility = useCallback(
    (documentId: string, visibility: Community["documents"][number]["visibility"]) =>
      sliceStore(communityId, "documents").update((all) =>
        all.map((doc) => (doc.id === documentId ? { ...doc, visibility } : doc)),
      ),
    [communityId],
  );

  const removeDocument = useCallback(
    (documentId: string) =>
      destructive(sliceStore(communityId, "documents"), (all) =>
        all.filter((d) => d.id !== documentId),
      ),
    [communityId],
  );

  const castVote = useCallback(
    (ballotId: string, optionId: string) => {
      const store = sliceStore(communityId, "ballots");
      const existing = store.getSnapshot().find((b) => b.id === ballotId);
      const receipt = existing?.myVoteReceipt ?? voteReceipt(ballotId, optionId);

      store.update((all) =>
        all.map((ballot) => {
          if (ballot.id !== ballotId) return ballot;
          const previous = ballot.myVoteOptionId;
          if (previous === optionId) return ballot;
          // One vote per household. Changing your mind replaces it rather than
          // adding a second, and keeps the original receipt so the number a
          // voter wrote down still resolves.
          return {
            ...ballot,
            myVoteOptionId: optionId,
            myVoteReceipt: receipt,
            options: ballot.options.map((option) => {
              if (option.id === optionId) return { ...option, votes: option.votes + 1 };
              if (option.id === previous)
                return { ...option, votes: Math.max(0, option.votes - 1) };
              return option;
            }),
          };
        }),
      );

      return receipt;
    },
    [communityId],
  );

  const saveTemplate = useCallback(
    (template: Community["templates"][number]) =>
      sliceStore(communityId, "templates").update((all) =>
        all.some((t) => t.id === template.id)
          ? all.map((t) => (t.id === template.id ? template : t))
          : [...all, template],
      ),
    [communityId],
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
      vendors,
      threads,
      documents,
      ballots,
      templates,
      sharedCosts,
      sharedCostBills,
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
      vendors,
      threads,
      documents,
      ballots,
      templates,
      sharedCosts,
      sharedCostBills,
    ],
  );

  // A signed in person looking at a real association sees Postgres. Everyone
  // else sees the demo. The two never blend: `remote.community` is either the
  // whole world or none of it.
  const community_ = remote.community ?? liveCommunity;

  const value: AppState = {
    community: community_,
    communities: remote.community
      ? remote.associations.map((a) => ({ id: a.id, label: a.name }))
      : communityList.map((c) => ({ id: c.id, label: c.label })),
    setCommunity,
    account,
    // Every slice is read off the active community rather than off the local
    // stores directly, so remote and demo cannot disagree about which world
    // a screen is in. In demo mode community_ is the local overlay, so this
    // is the same data by a shorter route.
    accounts: community_.accounts,
    view: session.view,
    ready,
    settings: community_.settings,
    amenities: community_.amenities,
    forms: community_.forms,
    posts: community_.posts,
    requests: community_.requests,
    instruments: community_.instruments,
    ledger: community_.ledger,
    payouts: community_.payouts,
    vendors: community_.vendors,
    threads: community_.threads,
    documents: community_.documents,
    ballots: community_.ballots,
    templates: community_.templates,
    signIn,
    signOut,
    setView,
    can,
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
    removeOwner,
    setAccountRole,
    dismissedSetupTasks,
    dismissSetupTask,
    restoreSetupTask,
    addBankAccount,
    recordPayment,
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
    addSharedCost,
    removeSharedCost,
    postSharedCostBill,
    setDocumentVisibility,
    castVote,
    updateRequestStatus,
    likePost,
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
        duesCents: community.association.duesCents,
        unitCount: community.association.unitCount,
        operatingCents: cash.operating,
        reserveCents: reserveBalance,
        interestYtdCents: community.bankAccounts.reduce((t, a) => t + a.interestYtdCents, 0),
        blendedApy,
        reservePercentFunded: required ? funded / required : 0,
      },
      methods: community.instruments.map((m) => ({
        label: m.label,
        kind: m.kind,
        feeCents: settings.paymentFeeCents,
        feePercent: 0,
      })),
      meetings: community.meetings
        .filter((m) => m.status !== "ended")
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
        .filter((b) => b.audience === "owners" && b.status === "open")
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
      support: { phone: "(888) 555-0199", hours: "7am to 11pm, every day" },
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
