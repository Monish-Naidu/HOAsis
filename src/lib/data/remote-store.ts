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
import { withReversals } from "@/lib/ledger-corrections";
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
  if (byId) return byId.id;
  // A vanity host names its association on every load, since the address
  // says so. A link's slug is asked for once: see `spendRequests`.
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
 * Forgets what a link or the wizard asked for, once a load has honoured it.
 *
 * Asked for once, because left set it won every later load: arrive by
 * /c/maple-ridge, switch to Oak Hills, and the next full load put Maple Ridge
 * back under whatever was open. But only once the load has landed. Forgotten
 * at the moment of choosing, a load that then failed had nothing left to
 * retry with, and asking again opened the last remembered association
 * instead of the one the link named.
 *
 * Something asked for while that load was away is a newer request and is
 * kept for the next one.
 */
function spendRequests(asked: { slug: string | null; id: string | null }) {
  if (requestedSlug === asked.slug) requestedSlug = null;
  if (requestedId === asked.id) requestedId = null;
}

/**
 * Which read is allowed to land.
 *
 * Every read here is awaited across the network, and the answers do not come
 * back in the order they were asked. Unguarded, a refresh for association A
 * that resolved after a switch to B put A's data under B's name, a refresh in
 * flight at sign-out put the last member's association back into a signed-out
 * browser, and two quick writes could leave the screen on the older read.
 *
 * Two counters, kept apart on purpose. A load or a switch takes a new
 * `loadEpoch`, and only the newest one may write its result. A refresh never
 * takes an epoch, because a refresh that cancelled a load would leave the
 * screen on "loading" with nothing left to finish it. A refresh notes the
 * epoch it began under and lands only if no load, switch or sign-out has
 * happened since, and only if no later refresh has landed before it.
 */
let loadEpoch = 0;
let refreshSeq = 0;
let refreshLanded = 0;

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
    // Signing out outranks anything still in flight.
    loadEpoch += 1;
    set({ ...SIGNED_OUT, message: undefined });
    return;
  }

  const mine = ++loadEpoch;
  // A different person starts from nothing. Keeping the last person's
  // associations on screen while theirs load is showing one member another's.
  if (profileId !== state.profileId) {
    set({ ...SIGNED_OUT, status: "loading", profileId, message: undefined });
  } else {
    set({ status: "loading", profileId });
  }
  const supabase = supabaseBrowser();

  try {
    // A session that predates an invitation still deserves the seat: claim
    // anything listed under this email before asking what we belong to.
    await supabase.rpc("claim_my_seats");
    const associations = await loadMyAssociations(supabase);
    if (mine !== loadEpoch) return;
    if (!associations.length) {
      // Signed in, but belongs to nothing yet. That is a real state with its
      // own screen, not an error.
      set({ status: "empty", associations: [], activeId: null, community: null, message: undefined });
      return;
    }

    const asked = { slug: requestedSlug, id: requestedId };
    const activeId = chooseActive(associations);
    const refreshesBefore = refreshSeq;
    const [community, dismissals] = await Promise.all([
      loadCommunity(supabase, activeId),
      loadDismissals(supabase, activeId),
    ]);
    if (mine !== loadEpoch) return;
    spendRequests(asked);
    remember(activeId);
    set({ status: "ready", associations, activeId, community, dismissals, message: undefined });
    // A write that landed while this was reading may not be in what it read.
    if (refreshSeq !== refreshesBefore) void refreshRemote();
  } catch (error) {
    if (mine !== loadEpoch) return;
    // The status and the message are the whole report: a screen reads them
    // to say what happened, and `retryRemote` asks again.
    set({
      status: "error",
      message: error instanceof Error ? error.message : "Could not load your association",
    });
  }
}

/**
 * Asks again after a failed load, as the same person.
 *
 * Signing in a second time does not: auth sees the same person and has
 * nothing to announce, so without this the only way out of a failed load was
 * a hard reload.
 */
export async function retryRemote(): Promise<void> {
  if (state.status !== "error" || !state.profileId) return;
  await loadRemote(state.profileId);
}

/** Switches association without signing out, since one person can hold several. */
export async function setRemoteAssociation(id: string): Promise<void> {
  if (!hasSupabase) return;
  // A deliberate switch outranks a link still waiting on a load it has just
  // overtaken, or the next full load would drag the member back to it.
  requestedSlug = null;
  requestedId = null;
  const mine = ++loadEpoch;
  set({ status: "loading" });
  try {
    const client = supabaseBrowser();
    const refreshesBefore = refreshSeq;
    const [community, dismissals] = await Promise.all([
      loadCommunity(client, id),
      loadDismissals(client, id),
    ]);
    if (mine !== loadEpoch) return;
    remember(id);
    set({ status: "ready", activeId: id, community, dismissals, message: undefined });
    if (refreshSeq !== refreshesBefore) void refreshRemote();
    // A deliberate switch is also the answer to "where should I land next
    // time, on any device". Best effort; the browser memory above still works.
    const profileId = state.profileId;
    if (profileId) {
      void client.from("profiles").update({ home_association_id: id }).eq("id", profileId);
    }
  } catch (error) {
    if (mine !== loadEpoch) return;
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
 *
 * Row level security does not refuse an update or a delete it will not
 * allow. It hides the row, the statement matches nothing, and the database
 * answers with no error. So a write aimed at a row known to exist asks for a
 * count (`.update(values, { count: "exact" })`, `.delete({ count: "exact" })`)
 * and a count of zero is treated here as the refusal it is. A write that did
 * not ask for a count is taken at its word, since some legitimately match
 * nothing.
 *
 * Writes run one at a time, in the order they were asked for, and each waits
 * for the re-read that follows the one before it. Several of them replace a
 * whole list (a thread's messages, a seat's permissions) with the old list
 * plus one thing. Run side by side, two quick presses each built on the same
 * old list and the second erased the first. In a queue, a write that builds
 * its value inside its callback from `remoteSnapshot()` sees what the write
 * before it left. A write must not start another from inside its own
 * callback and wait for it: the second would be queued behind the first.
 *
 * A failed write re-reads too. Some writes are more than one statement, and
 * a later one failing leaves the earlier ones in the database; a retry built
 * on the copy from before would repeat them.
 *
 * Nothing in the queue is waited on for ever. A browser request has no time
 * limit of its own, so one that never came back (a train going into a
 * tunnel) held every later write behind it until the tab was reloaded, with
 * nothing on screen to say so. A write that has not answered in
 * `WRITE_TIMEOUT_MS` is reported as failed and the queue moves on, and so is
 * a re-read after `REREAD_TIMEOUT_MS`. The request itself cannot be called
 * back, so a write given up on may still land; the message says so. When it
 * does answer, late, the association is read again: the re-read that
 * followed the timeout ran before the write landed, so without a second one
 * the screen the message sends the person to look at would still show it
 * missing, and they would enter it twice.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

/** How long one write may go unanswered. A write of many rows may ask for longer. */
export const WRITE_TIMEOUT_MS = 30_000;
/** How long the re-read after a write may take before the queue stops waiting for it. */
export const REREAD_TIMEOUT_MS = 20_000;

/** What a counted write that matched no row is told. Row level security hid the row. */
export const NOTHING_CHANGED = "nothing was changed. You may not have access to change this";

type RemoteWrite = () => PromiseLike<
  { error: { message: string } | null; count?: number | null } | void
>;

export function remoteWrite(
  label: string,
  // PromiseLike, because a query builder is a thenable rather than a Promise.
  write: RemoteWrite,
  options?: { timeoutMs?: number },
): Promise<boolean> {
  // `runWrite` never rejects, so one failure cannot stall the queue.
  const mine = writeQueue.then(() => runWrite(label, write, options?.timeoutMs ?? WRITE_TIMEOUT_MS));
  writeQueue = mine;
  return mine;
}

/**
 * Settles as `work` does, or rejects with `message` if it has not by then.
 * `late` is called if the work settles, either way, after it was given up on.
 */
function within<T>(
  work: PromiseLike<T>,
  ms: number,
  message: string,
  late?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let gaveUp = false;
    const timer = setTimeout(() => {
      gaveUp = true;
      reject(new Error(message));
    }, ms);
    const settled = () => {
      clearTimeout(timer);
      if (gaveUp) late?.();
    };
    Promise.resolve(work).then(
      (value) => {
        settled();
        resolve(value);
      },
      (reason) => {
        settled();
        reject(reason);
      },
    );
  });
}

/**
 * The re-read after a write. One that never answers is given up on quietly,
 * the way a failed one is: the write has already been reported either way,
 * and the next write's re-read brings the screen up to date.
 */
async function reread(): Promise<void> {
  try {
    await within(refreshRemote(), REREAD_TIMEOUT_MS, "no answer");
  } catch {
    // The last good copy stays on screen.
  }
}

async function runWrite(label: string, write: RemoteWrite, timeoutMs: number): Promise<boolean> {
  try {
    const result = await within(
      write(),
      timeoutMs,
      `no answer after ${Math.round(timeoutMs / 1000)} seconds. Check your connection. It may still have gone through, so look before you try again`,
      // Outside the queue, which moved on at the timeout. A refresh that
      // lands out of turn is dropped by `refreshRemote` itself.
      () => void refreshRemote(),
    );
    if (result && result.error) throw new Error(result.error.message);
    if (result && result.count === 0) throw new Error(NOTHING_CHANGED);
    await reread();
    return true;
  } catch (error) {
    reportRemoteError(
      `${label}: ${error instanceof Error ? error.message : "it was not saved"}`,
    );
    await reread();
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
        ledger: withReversals([...current.ledger, ...earlier]),
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
  // What this read is of, and under which load it began.
  const id = state.activeId;
  const who = state.profileId;
  const epoch = loadEpoch;
  const mine = ++refreshSeq;
  try {
    const client = supabaseBrowser();
    const [community, dismissals] = await Promise.all([
      loadCommunity(client, id),
      loadDismissals(client, id),
    ]);
    // Dropped if the person switched, signed out or reloaded while it was
    // away, or if a refresh that began later has already landed.
    if (epoch !== loadEpoch || state.activeId !== id || state.profileId !== who) return;
    if (mine < refreshLanded) return;
    refreshLanded = mine;
    set({ community, dismissals, status: "ready" });
  } catch {
    // Leave the last good copy on screen rather than blanking it. The write
    // that prompted this either landed or reported its own failure.
  }
}
