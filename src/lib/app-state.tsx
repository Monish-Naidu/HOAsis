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
} from "@/lib/data";
import { CircuitBreaker } from "@/lib/core/circuit-breaker";
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
  signIn: (accountId: string) => void;
  signOut: () => void;
  setView: (v: View) => void;
  can: (c: Capability) => boolean;
  updateSettings: (patch: Partial<CommunitySettings>) => void;
  setAmenities: (next: CommunityAmenity[]) => void;
  setForms: (next: ArchitecturalForm[]) => void;
  setCapability: (accountId: string, capability: Capability, on: boolean) => void;
  resetDemo: () => void;
  addPost: (post: ForumPost) => void;
  addRequest: (request: HomeRequest) => void;
  likePost: (postId: string) => void;
  ready: boolean;
}

const Ctx = createContext<AppState | null>(null);

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

/** Reset together, so "reset demo data" cannot leave half the app rewritten. */
const stores = [
  accountStore,
  settingsStore,
  amenityStore,
  formStore,
  postStore,
  requestStore,
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

  const likePost = useCallback(
    (postId: string) =>
      postStore.update((all) =>
        all.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)),
      ),
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
    signIn,
    signOut,
    setView,
    can,
    updateSettings,
    setAmenities,
    setForms,
    setCapability,
    resetDemo,
    addPost,
    addRequest,
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
