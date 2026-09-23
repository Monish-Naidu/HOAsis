"use client";

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { loadCommunity, loadMyAssociations, type RemoteCommunitySummary } from "./remote";
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

    const preferred = remembered();
    const activeId =
      associations.find((a) => a.id === preferred)?.id ?? associations[0].id;
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
  } catch (error) {
    set({
      status: "error",
      message: error instanceof Error ? error.message : "Could not open that association",
    });
  }
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
