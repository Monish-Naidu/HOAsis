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
  owners,
  ownerCharges,
  requests,
  accounts as seedAccounts,
  architecturalForms as seedForms,
  communityAmenities as seedAmenities,
  communitySettings as seedSettings,
  forumPosts as seedPosts,
} from "@/lib/data";
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

const KEY = "hoasis-session";

/* -------------------------------------------------------------------------- */
/* The session lives in localStorage, which is outside React. Reading it with  */
/* useSyncExternalStore avoids a setState-in-effect cascade on every mount.    */
/* -------------------------------------------------------------------------- */

interface Session {
  accountId: string | null;
  view: View;
}

const EMPTY: Session = { accountId: null, view: "resident" };

let listeners: (() => void)[] = [];
let cached: Session | null = null;

function readSession(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Session>;
    return {
      accountId: parsed.accountId ?? null,
      view: parsed.view === "admin" ? "admin" : "resident",
    };
  } catch {
    return EMPTY;
  }
}

function sessionSnapshot(): Session {
  if (cached === null) cached = readSession();
  return cached;
}

function serverSnapshot(): Session {
  return EMPTY;
}

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function writeSession(next: Session) {
  cached = next;
  try {
    if (next.accountId) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked, the session stays in memory */
  }
  listeners.forEach((l) => l());
}

/**
 * A tiny localStorage backed store.
 *
 * Everything the demo lets you change lives in one of these, so submitting a
 * request or flipping a setting survives a reload. useSyncExternalStore keeps
 * it hydration safe: the server snapshot is always the seed.
 */
function createStore<T>(key: string, seed: T) {
  let listeners: (() => void)[] = [];
  let cached: T | null = null;

  const read = (): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : seed;
    } catch {
      return seed;
    }
  };

  return {
    subscribe(cb: () => void) {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    },
    get(): T {
      if (cached === null) cached = read();
      return cached;
    },
    server(): T {
      return seed;
    },
    set(next: T) {
      cached = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage blocked, the change stays in memory */
      }
      listeners.forEach((l) => l());
    },
    reset() {
      cached = seed;
      try {
        localStorage.removeItem(key);
      } catch {
        /* nothing to clear */
      }
      listeners.forEach((l) => l());
    },
  };
}

const accountStore = createStore("hoasis-accounts", seedAccounts);
const settingsStore = createStore("hoasis-settings", seedSettings);
const amenityStore = createStore("hoasis-amenities", seedAmenities);
const formStore = createStore("hoasis-forms", seedForms);
const postStore = createStore("hoasis-posts", seedPosts);
const requestStore = createStore("hoasis-requests", requests);

const stores = [accountStore, settingsStore, amenityStore, formStore, postStore, requestStore];

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
  const session = useSyncExternalStore(subscribe, sessionSnapshot, serverSnapshot);
  const ready = useHydrated();
  const accountList = useSyncExternalStore(
    accountStore.subscribe,
    accountStore.get,
    accountStore.server,
  );
  const settings = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.get,
    settingsStore.server,
  );
  const amenities = useSyncExternalStore(
    amenityStore.subscribe,
    amenityStore.get,
    amenityStore.server,
  );
  const forms = useSyncExternalStore(formStore.subscribe, formStore.get, formStore.server);
  const posts = useSyncExternalStore(postStore.subscribe, postStore.get, postStore.server);
  const requestList = useSyncExternalStore(
    requestStore.subscribe,
    requestStore.get,
    requestStore.server,
  );

  const account = useMemo(
    () => accountList.find((a) => a.id === session.accountId) ?? null,
    [accountList, session.accountId],
  );

  const signIn = useCallback((id: string) => {
    const next = seedAccounts.find((a) => a.id === id);
    writeSession({ accountId: id, view: next && next.role !== "resident" ? "admin" : "resident" });
  }, []);

  const signOut = useCallback(() => writeSession(EMPTY), []);

  const setView = useCallback(
    (v: View) => writeSession({ accountId: session.accountId, view: v }),
    [session.accountId],
  );

  const can = useCallback(
    (c: Capability) => Boolean(account && account.capabilities[c]),
    [account],
  );

  const updateSettings = useCallback(
    (patch: Partial<CommunitySettings>) => settingsStore.set({ ...settingsStore.get(), ...patch }),
    [],
  );

  const setAmenities = useCallback((next: CommunityAmenity[]) => amenityStore.set(next), []);
  const setForms = useCallback((next: ArchitecturalForm[]) => formStore.set(next), []);

  const setCapability = useCallback((id: string, capability: Capability, on: boolean) => {
    accountStore.set(
      accountStore
        .get()
        .map((a) =>
          a.id === id && a.role !== "president"
            ? { ...a, capabilities: { ...a.capabilities, [capability]: on } }
            : a,
        ),
    );
  }, []);

  const addPost = useCallback((post: ForumPost) => postStore.set([post, ...postStore.get()]), []);

  const addRequest = useCallback(
    (request: HomeRequest) => requestStore.set([request, ...requestStore.get()]),
    [],
  );

  const likePost = useCallback(
    (postId: string) =>
      postStore.set(
        postStore.get().map((x) => (x.id === postId ? { ...x, likes: x.likes + 1 } : x)),
      ),
    [],
  );

  /** Puts the demo back to its seeded state without signing you out. */
  const resetDemo = useCallback(() => stores.forEach((s) => s.reset()), []);

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
  return useMemo(
    () => (account ? (owners.find((o) => o.id === account.ownerId) ?? null) : null),
    [account],
  );
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
