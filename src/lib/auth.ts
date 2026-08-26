"use client";

import { useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { loadRemote } from "@/lib/data/remote-store";

/**
 * The signed in person, as an external store.
 *
 * Supabase hands out auth changes through a subscription, which is exactly the
 * shape `useSyncExternalStore` wants. Mirroring it into `useState` from an
 * effect would fight this repo's lint rule and, worse, would render one frame
 * of "signed out" to somebody who is signed in.
 *
 * The snapshot is cached because React compares it by identity: returning a
 * fresh object each call is an infinite render loop.
 */

export interface AuthState {
  user: User | null;
  /** True until the first auth event arrives, so nothing redirects too early. */
  loading: boolean;
}

const SIGNED_OUT: AuthState = { user: null, loading: false };
const LOADING: AuthState = { user: null, loading: true };

let snapshot: AuthState = hasSupabase ? LOADING : SIGNED_OUT;
const listeners = new Set<() => void>();
let started = false;

function publish(next: AuthState) {
  // Identity is what React diffs on, so only replace it on a real change.
  if (next.user?.id === snapshot.user?.id && next.loading === snapshot.loading) return;
  const changedPerson = next.user?.id !== snapshot.user?.id;
  snapshot = next;
  for (const listener of listeners) listener();

  // Loading the association is driven from here rather than from an effect in
  // a component, so it happens once per sign in rather than once per mount of
  // whatever happened to be on screen.
  if (changedPerson) void loadRemote(next.user?.id ?? null);
}

/** Starts the subscription once, on first use, and never on the server. */
function start() {
  if (started || !hasSupabase || typeof window === "undefined") return;
  started = true;

  const client = supabaseBrowser();

  client.auth
    .getSession()
    .then(({ data }) => publish({ user: data.session?.user ?? null, loading: false }))
    .catch(() => publish(SIGNED_OUT));

  client.auth.onAuthStateChange((_event, session: Session | null) => {
    publish({ user: session?.user ?? null, loading: false });
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => (hasSupabase ? LOADING : SIGNED_OUT);

/** The signed in person, or null. `loading` is true until we actually know. */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

export interface AuthResult {
  ok: boolean;
  /** Written for the person reading it, not copied from the wire. */
  message?: string;
}

/** Turns provider errors into something a homeowner can act on. */
function readable(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login")) return "That email and password do not match.";
  if (text.includes("already registered")) return "There is already an account for that email.";
  if (text.includes("password")) return "Passwords need at least 8 characters.";
  if (text.includes("rate limit")) return "Too many attempts. Wait a minute and try again.";
  return message;
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResult> {
  const client = supabaseBrowser();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });
  if (error) return { ok: false, message: readable(error.message) };

  // A project with email confirmation switched on returns a user and no
  // session. Saying so beats a silent redirect to a page they cannot load.
  if (data.user && !data.session) {
    return { ok: true, message: "Check your email to confirm the address, then sign in." };
  }
  return { ok: true };
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  const client = supabaseBrowser();
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, message: readable(error.message) } : { ok: true };
}

export async function signOutOfSupabase(): Promise<void> {
  if (!hasSupabase) return;
  await supabaseBrowser().auth.signOut();
}
