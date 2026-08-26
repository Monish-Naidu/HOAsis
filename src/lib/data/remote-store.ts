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
  message?: string;
}

const SIGNED_OUT: RemoteState = {
  status: "signed-out",
  associations: [],
  activeId: null,
  community: null,
  profileId: null,
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
    const community = await loadCommunity(supabase, activeId);
    remember(activeId);
    set({ status: "ready", associations, activeId, community, message: undefined });
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
    const community = await loadCommunity(supabaseBrowser(), id);
    remember(id);
    set({ status: "ready", activeId: id, community, message: undefined });
  } catch (error) {
    set({
      status: "error",
      message: error instanceof Error ? error.message : "Could not open that association",
    });
  }
}

/** Re-reads the active association. Call after any write. */
export async function refreshRemote(): Promise<void> {
  if (!hasSupabase || !state.activeId) return;
  try {
    const community = await loadCommunity(supabaseBrowser(), state.activeId);
    set({ community, status: "ready" });
  } catch {
    // Leave the last good copy on screen rather than blanking it. The write
    // that prompted this either landed or reported its own failure.
  }
}
