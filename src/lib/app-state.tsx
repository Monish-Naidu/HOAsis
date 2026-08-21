"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
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
  signIn: (accountId: string) => void;
  signOut: () => void;
  setView: (v: View) => void;
  can: (c: Capability) => boolean;
  updateSettings: (patch: Partial<CommunitySettings>) => void;
  setAmenities: (next: CommunityAmenity[]) => void;
  setForms: (next: ArchitecturalForm[]) => void;
  setCapability: (accountId: string, capability: Capability, on: boolean) => void;
  addPost: (post: ForumPost) => void;
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
  const [accountList, setAccountList] = useState<Account[]>(seedAccounts);
  const [settings, setSettings] = useState<CommunitySettings>(seedSettings);
  const [amenities, setAmenities] = useState<CommunityAmenity[]>(seedAmenities);
  const [forms, setForms] = useState<ArchitecturalForm[]>(seedForms);
  const [posts, setPosts] = useState<ForumPost[]>(seedPosts);

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

  const updateSettings = useCallback((patch: Partial<CommunitySettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const setCapability = useCallback(
    (id: string, capability: Capability, on: boolean) => {
      setAccountList((list) =>
        list.map((a) =>
          a.id === id && a.role !== "president"
            ? { ...a, capabilities: { ...a.capabilities, [capability]: on } }
            : a,
        ),
      );
    },
    [],
  );

  const addPost = useCallback((post: ForumPost) => setPosts((p) => [post, ...p]), []);

  const likePost = useCallback(
    (postId: string) =>
      setPosts((p) => p.map((x) => (x.id === postId ? { ...x, likes: x.likes + 1 } : x))),
    [],
  );

  const value: AppState = {
    account,
    accounts: accountList,
    view: session.view,
    settings,
    amenities,
    forms,
    posts,
    signIn,
    signOut,
    setView,
    can,
    updateSettings,
    setAmenities,
    setForms,
    setCapability,
    addPost,
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
  return useMemo(
    () =>
      owner
        ? requests
            .filter((r) => r.ownerId === owner.id)
            .sort((a, b) => (a.submittedDate < b.submittedDate ? 1 : -1))
        : [],
    [owner],
  );
}
