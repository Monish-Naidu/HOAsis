"use client";

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import {
  loadCommunity,
  loadLedgerBefore,
  loadMyAssociations,
  loadWholeStatement,
  type RemoteCommunitySummary,
} from "./remote";
import { slugFromHost } from "@/lib/community-links";
import type { Community } from "./community";

/**
 * The association a signed in person is actually looking at.
 *
 * An external store rather than component state, for the same reason the rest
 * of this app uses one: the data outlives any single screen, and mirroring it
 * into `useState` from an effect is both a lint error here and a guaranteed
 * frame of wrong content.
 *
 * A person with no account never reaches this. The demo runs on fixtures, and
 * the two worlds do not mix: nothing here can leak into a demo community, and
 * nothing a demo does is ever written to Postgres.
 */

export type RemoteStatus = "signed-out" | "loading" | "ready" | "empty" | "error";

export interface RemoteState {
  status: RemoteStatus;
  associations: RemoteCommunitySummary[];
  activeId: string | null;
  community: Community | null;
  /** The signed in person's own profile id, which is their account id here. */
  profileId: string | null;
  /** Setup tasks this association has declared do not apply to them. */
  dismissals: string[];
  message?: string;
}

const SIGNED_OUT: RemoteState = {
  status: "signed-out",
  associations: [],
  activeId: null,
  community: null,
  profileId: null,
  dismissals: [],
};

let state: RemoteState = SIGNED_OUT;
const listeners = new Set<() => void>();

function set(next: Partial<RemoteState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => SIGNED_OUT;

/** The current snapshot, for callers outside React. */
export function remoteSnapshot(): RemoteState {
  return state;
}

export function useRemote(): RemoteState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Which setup tasks this association has skipped. */
async function loadDismissals(
  supabase: ReturnType<typeof supabaseBrowser>,
  associationId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("setup_dismissals")
    .select("task_key")
    .eq("association_id", associationId);
  return (data ?? []).map((row) => row.task_key as string);
}

/** Which association to open, remembered so a reload lands where you left. */
const LAST_KEY = "hoasis:last-association";

function remember(id: string) {
  try {
    window.localStorage.setItem(LAST_KEY, id);
  } catch {
    // Private mode, or site data switched off. Losing the preference is not
    // worth failing the load over.
  }
}

function remembered(): string | null {
  try {
    return window.localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

/**
 * Which association to open first. A vanity host names one and wins; a
 * link under /c/<slug> sets the same preference before it navigates; failing
 * both, the one this browser had open last, then the first on the list.
 */
let requestedSlug: string | null = null;
let requestedId: string | null = null;

/** Asks for an association by slug ahead of the next load. */
export function preferRemoteSlug(slug: string | null) {
  requestedSlug = slug;
}

/**
 * Asks for an association by id ahead of the next load, once. The wizard
 * uses it so founding a second association lands in the new one rather
 * than in whichever this browser had open last.
 */
export function preferRemoteAssociation(id: string | null) {
  requestedId = id;
}

function chooseActive(associations: RemoteCommunitySummary[]): string {
  const byId = requestedId ? associations.find((a) => a.id === requestedId) : undefined;
  requestedId = null;
  if (byId) return byId.id;
  const slug = requestedSlug ?? slugFromHost(window.location.hostname);
  const bySlug = slug ? associations.find((a) => a.slug === slug) : undefined;
  if (bySlug) return bySlug.id;
  const preferred = remembered();
  // This browser's last choice, then the person's own home association,
  // then the first by name. The home choice travels with the account.
  return (
    associations.find((a) => a.id === preferred)?.id ??
    associations.find((a) => a.isHome)?.id ??
    associations[0].id
  );
}

/**
 * Loads everything the signed in person can reach.
 *
 * Called when auth settles and after any write, because a write that is not
 * reflected is indistinguishable to the person doing it from a write that
 * failed.
 */
export async function loadRemote(profileId: string | null): Promise<void> {
  if (!hasSupabase) return;
  if (!profileId) {
    set(SIGNED_OUT);
    return;
  }

  set({ status: "loading", profileId });
  const supabase = supabaseBrowser();

  try {
    // A session that predates an invitation still deserves the seat: claim
    // anything listed under this email before asking what we belong to.
    await supabase.rpc("claim_my_seats");
    const associations = await loadMyAssociations(supabase);
    if (!associations.length) {
      // Signed in, but belongs to nothing yet. That is a real state with its
      // own screen, not an error.
      set({ status: "empty", associations: [], activeId: null, community: null });
      return;
    }

    const activeId = chooseActive(associations);
    const [community, dismissals] = await Promise.all([
      loadCommunity(supabase, activeId),
      loadDismissals(supabase, activeId),
    ]);
    remember(activeId);
    set({ status: "ready", associations, activeId, community, dismissals, message: undefined });
  } catch (error) {
    set({
      status: "error",
      message: error instanceof Error ? error.message : "Could not load your association",
    });
  }
}

/** Switches association without signing out, since one person can hold several. */
export async function setRemoteAssociation(id: string): Promise<void> {
  if (!hasSupabase) return;
  set({ status: "loading" });
  try {
    const client = supabaseBrowser();
    const [community, dismissals] = await Promise.all([
      loadCommunity(client, id),
      loadDismissals(client, id),
    ]);
    remember(id);
    set({ status: "ready", activeId: id, community, dismissals, message: undefined });
    // A deliberate switch is also the answer to "where should I land next
    // time, on any device". Best effort; the browser memory above still works.
    const profileId = state.profileId;
    if (profileId) {
      void client.from("profiles").update({ home_association_id: id }).eq("id", profileId);
    }
  } catch (error) {
    set({
      status: "error",
      message: error instanceof Error ? error.message : "Could not open that association",
    });
  }
}

/**
 * Opens the association a link names, once the list is known. Returns what
 * happened so the caller can send a stranger to the join page.
 */
export async function setRemoteAssociationBySlug(
  slug: string,
): Promise<"switched" | "already" | "not-a-member" | "not-ready"> {
  if (state.status !== "ready" && state.status !== "empty") return "not-ready";
  const match = state.associations.find((a) => a.slug === slug);
  if (!match) return "not-a-member";
  if (match.id === state.activeId && state.community) return "already";
  await setRemoteAssociation(match.id);
  return state.status === "ready" ? "switched" : "not-ready";
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Failures from writes that were fired without being awaited.
 *
 * Most mutations keep a synchronous signature because forty screens call them
 * that way, so a database write runs in the background. A background failure
 * still has to reach the person who clicked, and the state layer sits above
 * the toast provider, so it comes out through here and a small component
 * inside the provider turns it into a toast.
 */
const errorListeners = new Set<(message: string) => void>();

export function subscribeRemoteErrors(listener: (message: string) => void) {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

export function reportRemoteError(message: string) {
  for (const listener of errorListeners) listener(message);
}

/**
 * Runs a write, then re-reads the association so the screen shows what
 * landed. A failure is reported rather than thrown, because nothing awaits
 * this; the screen has already moved on.
 */
export async function remoteWrite(
  label: string,
  // PromiseLike, because a query builder is a thenable rather than a Promise.
  write: () => PromiseLike<{ error: { message: string } | null } | void>,
): Promise<boolean> {
  try {
    const result = await write();
    if (result && result.error) throw new Error(result.error.message);
    await refreshRemote();
    return true;
  } catch (error) {
    reportRemoteError(
      `${label}: ${error instanceof Error ? error.message : "the database refused it"}`,
    );
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Earlier rows, on request                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every ledger line before the loaded window, added to what is on screen.
 *
 * The lines are appended under the window's, and the server's month sums
 * step aside for them (`history.ledgerLoaded`), so nothing is counted twice.
 * Resolves false when there was nothing to fetch or it could not be fetched;
 * the screen keeps what it has either way.
 */
export async function loadEarlierLedger(): Promise<boolean> {
  const c = state.community;
  if (!hasSupabase || !c?.history || c.history.ledgerLoaded) return false;
  try {
    const earlier = await loadLedgerBefore(supabaseBrowser(), c.id, c.history.from);
    const current = state.community;
    if (!current?.history || current.id !== c.id) return false;
    set({
      community: {
        ...current,
        ledger: [...current.ledger, ...earlier],
        history: { ...current.history, ledgerLoaded: true },
      },
    });
    return true;
  } catch (error) {
    reportRemoteError(error instanceof Error ? error.message : "Could not load earlier transactions");
    return false;
  }
}

/** One home's whole statement, replacing the windowed lines on screen. */
export async function loadEarlierStatement(unitId: string): Promise<boolean> {
  const c = state.community;
  if (!hasSupabase || !c?.history || c.history.statementsLoaded.includes(unitId)) return false;
  try {
    const lines = await loadWholeStatement(supabaseBrowser(), unitId);
    const current = state.community;
    if (!current?.history || current.id !== c.id) return false;
    set({
      community: {
        ...current,
        ownerCharges: { ...current.ownerCharges, [unitId]: lines },
        history: {
          ...current.history,
          statementsLoaded: [...current.history.statementsLoaded, unitId],
        },
      },
    });
    return true;
  } catch (error) {
    reportRemoteError(error instanceof Error ? error.message : "Could not load the earlier statement");
    return false;
  }
}

/** Re-reads the active association. Call after any write. */
export async function refreshRemote(): Promise<void> {
  if (!hasSupabase || !state.activeId) return;
  try {
    const client = supabaseBrowser();
    const [community, dismissals] = await Promise.all([
      loadCommunity(client, state.activeId),
      loadDismissals(client, state.activeId),
    ]);
    set({ community, dismissals, status: "ready" });
  } catch {
    // Leave the last good copy on screen rather than blanking it. The write
    // that prompted this either landed or reported its own failure.
  }
}
