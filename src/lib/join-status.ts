"use client";

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * What the signed in person has asked to join.
 *
 * Somebody who created their account through a join code belongs to nothing
 * until the board says yes. That is a real state with its own screen, and
 * the screen needs to know which board it is waiting on. Read through an
 * external store for the same reason the session is: the answer outlives any
 * one component, and it must not render one frame of "found an association"
 * to a person who is waiting on one.
 */

export interface JoinStatus {
  associationId: string;
  name: string;
  city: string;
  state: string;
  unitLabel: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
  decidedOn: string | null;
}

interface State {
  /** Null until the first load finishes. */
  requests: JoinStatus[] | null;
  loadedFor: string | null;
}

let state: State = { requests: null, loadedFor: null };
const listeners = new Set<() => void>();

function publish(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

/** Loads once per signed in person. Safe to call from anywhere, any number of times. */
export function loadJoinStatus(profileId: string | null, force = false): void {
  if (!hasSupabase || !profileId) {
    if (state.requests !== null || state.loadedFor !== null) publish({ requests: null, loadedFor: null });
    return;
  }
  if (!force && state.loadedFor === profileId) return;
  state = { ...state, loadedFor: profileId };
  void fetchJoinStatus().then((requests) => {
    if (state.loadedFor === profileId) publish({ requests, loadedFor: profileId });
  });
}

/** The raw answer, for the places that decide where to send somebody. */
export async function fetchJoinStatus(): Promise<JoinStatus[]> {
  try {
    const { data } = await supabaseBrowser().rpc("my_join_requests");
    const rows = (data ?? []) as {
      association_id: string;
      name: string;
      city: string | null;
      state: string | null;
      unit_label: string;
      status: string;
      created_at: string;
      decided_on: string | null;
    }[];
    return rows.map((row) => ({
      associationId: row.association_id,
      name: row.name,
      city: row.city ?? "",
      state: row.state ?? "",
      unitLabel: row.unit_label,
      status: row.status as JoinStatus["status"],
      createdAt: row.created_at,
      decidedOn: row.decided_on,
    }));
  } catch {
    return [];
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = (): State => ({ requests: null, loadedFor: null });

export function useJoinStatus(profileId: string | null): JoinStatus[] | null {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Kicks off the load on first read. Not an effect: the store guards against
  // a second call, and a subscription is the moment the answer is wanted.
  if (profileId && snapshot.loadedFor !== profileId) loadJoinStatus(profileId);
  return snapshot.loadedFor === profileId ? snapshot.requests : null;
}
