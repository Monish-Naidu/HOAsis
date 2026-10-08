import { useSyncExternalStore } from "react";
import { allCommunities, communityById, DEFAULT_COMMUNITY_ID } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import { CircuitBreaker } from "@/lib/core/circuit-breaker";
import { todayIsoDate } from "@/lib/utils";
import { newId } from "@/lib/core/ids";
import { PersistedStore, renameLegacyFields, type Store } from "@/lib/core/store";
import { NOTHING_CHANGED, remoteSnapshot, reportRemoteError, type RemoteState } from "@/lib/data/remote-store";
import { isAssociation, isBudgetLines, isChargeLedger, isCommunitySettings, isRecordArray, isSession } from "@/lib/core/guards";
import type { Account, Activity, Capability } from "@/lib/types";
import { meetingJoin } from "@/lib/meetings/video";
import type { SendOutcome } from "@/lib/email/plain-error";
import type { View } from "./types";

export { isUuid, newId } from "@/lib/core/ids";
export { ValidationError } from "@/lib/core/errors";
export { remoteWrite } from "@/lib/data/remote-store";

/** The signed in person's id, read straight from the remote store snapshot. */
export function sessionUserId(): string | null {
  return remoteSnapshot().profileId;
}

/**
 * The association as it stands when a write runs, not when it was asked for.
 *
 * Writes queue, and each waits for the re-read after the one before it. A
 * write that replaces a whole list (a thread's messages, a seat's
 * permissions) calls this inside its callback, so two quick presses build on
 * each other instead of both building on the copy the screen held at the
 * first press. Falls back to that copy if the person has since switched
 * association.
 */
export function latest(rc: Community): Community {
  const now = remoteSnapshot().community;
  return now && now.id === rc.id ? now : rc;
}

export type NoticeKind = "announcement" | "meeting" | "ballot" | "letter" | "message" | "request";

/** What a send that fell short is called in its toast. */
export const NOTICE_LABEL: Record<NoticeKind, string> = {
  announcement: "Emailing the announcement",
  meeting: "Emailing the meeting notice",
  ballot: "Emailing the ballot notice",
  letter: "Emailing the letter",
  message: "Emailing the message",
  request: "Emailing the update",
};

/** Where the thing still lives when its email did not go. */
const SAVED_WHERE: Record<NoticeKind, string> = {
  announcement: "The announcement is posted in Messages",
  meeting: "The meeting is on Meetings",
  ballot: "The vote is on Voting",
  letter: "The letter is saved on the home",
  message: "The message is saved in Messages",
  request: "The update is saved on the request",
};

/**
 * The server sends for under a minute at a time and answers with how many
 * it did not reach. Asked again it carries on from there, so a long roster
 * is a few calls. Twelve is far more than any roster needs; it is only there
 * so a server that keeps answering "more to go" cannot be asked for ever.
 * It is also only asked again while the number left is going down: a call
 * that leaves as many as the one before is not carrying on, and asking it
 * again could only mail the same homes twice.
 */
export const NOTICE_CALLS = 12;

/** A count out of the server's answer, or zero when it sent none. */
export const tally = (value: unknown) => (typeof value === "number" && value > 0 ? value : 0);

/** `NOTHING_CHANGED` as its own sentence, for a screen that shows it bare. */
export const NOT_CHANGED = `${NOTHING_CHANGED[0].toUpperCase()}${NOTHING_CHANGED.slice(1)}`;

/** The notice's line on how to join: one video link, a number only when the board typed one. */
export function joinLine(m: { id: string; dialIn?: string; passcode?: string }, associationId: string): string {
  const join = meetingJoin(m, associationId);
  const phone = join.dialIn ? `, or dial ${join.dialIn}` : "";
  const code = join.passcode ? ` (passcode ${join.passcode})` : "";
  return `Join by video: ${join.videoUrl}${phone}${code}.`;
}

/** Meeting notices being emailed right now, so a second press does not start a second run. */
export const noticesInFlight = new Set<string>();

/**
 * Emails what the board just wrote, after the row is in.
 *
 * The record is already right by the time this runs, the server checks the
 * caller's capability and reads the words back from the row, and every
 * attempt lands in email_log whether it went or not. Nothing waits on it
 * except a caller that needs to know: it resolves with what the server
 * answered (`answered` is false only when it could not be reached). What
 * fell short is said here, in a toast, unless the caller passes `quiet`
 * because it tells the board itself.
 *
 * It used to be fired and forgotten. The server stops a long send before its
 * time limit, and nobody read the answer, so a statutory notice to a large
 * roster reached the first part of it and the board was told nothing. Now
 * the answer is read, the send is asked to carry on while homes remain, and
 * anything still unsent at the end is said through the same toast a failed
 * write uses.
 *
 * The server passes over anybody who got the same notice in the last hour
 * and counts them as `already`. They have it, so they are not a failure.
 * But a send that reached nobody new because everybody already had it (an
 * announcement posted again under the same title) emailed nobody, and the
 * board is told that in so many words rather than nothing at all.
 *
 * Only ever called in remote mode; the demo has nobody to email.
 */
export async function emailNotice(
  associationId: string,
  notice: {
    kind: NoticeKind;
    id?: string;
    unitIds?: string[];
    subject?: string;
    body?: string;
  },
  /**
   * The caller says how it went in its own toast (a meeting notice, a
   * reply), so the generic error toasts below stay quiet.
   */
  quiet = false,
): Promise<SendOutcome> {
  const label = NOTICE_LABEL[notice.kind];
  let sent = 0;
  let already = 0;
  let failed = 0;
  let remaining = 0;
  let left = Infinity;
  let reason: string | undefined;
  const outcome = (answered: boolean): SendOutcome => ({ answered, sent, failed, already, remaining, reason });
  try {
    for (let call = 0; call < NOTICE_CALLS; call++) {
      const response = await fetch("/api/email/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId, ...notice }),
      });
      const answer = ((await response.json().catch(() => null)) ?? {}) as {
        sent?: unknown;
        failed?: unknown;
        already?: unknown;
        remaining?: unknown;
        error?: unknown;
        errors?: unknown;
      };
      if (!reason && Array.isArray(answer.errors) && typeof answer.errors[0] === "string") {
        reason = answer.errors[0];
      }
      if (!response.ok) {
        const why = typeof answer.error === "string" && answer.error ? answer.error : "it could not be sent";
        reason ??= why;
        if (!quiet) reportRemoteError(`${label}: ${why}. It is saved here, but the email did not go`);
        // The route answered, so the caller knows it ran; nothing went.
        return outcome(true);
      }
      remaining = tally(answer.remaining);
      // Every call passes over the same people and counts them again, so
      // it is the most any one call saw, not the sum of them.
      already = Math.max(already, tally(answer.already));
      sent += tally(answer.sent);
      // The server counts the homes it did not reach among the failed. An
      // address that fails is tried again on the next call, so the worst
      // single call is the count, not the sum of them.
      failed = Math.max(failed, Math.max(0, tally(answer.failed) - remaining));
      if (remaining === 0 || remaining >= left) break;
      left = remaining;
    }
  } catch {
    reason = "The mail service could not be reached";
    if (!quiet) {
      reportRemoteError(
        `${label}: the mail service could not be reached. It is saved here, but the email did not go`,
      );
    }
    return outcome(false);
  }
  if (quiet) return outcome(true);
  const unsent = failed + remaining;
  if (unsent > 0) {
    reportRemoteError(
      `${label}: ${unsent} ${unsent === 1 ? "email was" : "emails were"} not sent. ${SAVED_WHERE[notice.kind]}.`,
    );
  }
  if (sent === 0 && already > 0) {
    reportRemoteError(
      `${label}: the same notice already went to ${already} ${already === 1 ? "owner" : "owners"} in the last hour, so it was not emailed again`,
    );
  }
  return outcome(true);
}

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

export interface Session {
  accountId: string | null;
  view: View;
}

export const NO_SESSION: Session = { accountId: null, view: "resident" };

/**
 * One breaker for every store. A browser that refuses site data should trip
 * the circuit once, not once per slice per community.
 */
export const storageBreaker = new CircuitBreaker("localStorage", {
  failureThreshold: 3,
  cooldownMs: 30_000,
});

export const sessionStore = new PersistedStore<Session>("hoasis-session", NO_SESSION, {
  breaker: storageBreaker,
  validate: isSession,
});

/**
 * The home a person with more than one is looking at, as a unit id. Empty
 * until they choose, and read through the same server snapshot as the other
 * stores, so prerendering is unchanged. It is not scoped to an association:
 * an id that is not one of their seats there simply falls back to the first.
 */
export const homeStore = new PersistedStore<string>("hoasis-home", "", {
  breaker: storageBreaker,
  validate: (v): v is string => typeof v === "string",
});

export const communityStore = new PersistedStore<string>(
  "hoasis-community",
  DEFAULT_COMMUNITY_ID,
  { breaker: storageBreaker, validate: (v): v is string => typeof v === "string" },
);

/**
 * Photographs owners add of their own homes, keyed by owner id.
 *
 * Browser-only on purpose, for now: the photo is a personal touch on the
 * owner's own dashboard, nothing else reads it, and shipping it without a
 * migration means the card can fall back to the community photo the moment
 * the browser forgets. Syncing it to storage is a later, deliberate step.
 */
export const homePhotoStore = new PersistedStore<Record<string, string>>(
  "hoasis-home-photos",
  {},
  {
    breaker: storageBreaker,
    validate: (v): v is Record<string, string> =>
      typeof v === "object" &&
      v !== null &&
      !Array.isArray(v) &&
      Object.values(v).every((x) => typeof x === "string"),
  },
);

/** The slices a board can actually change. Everything else is reference data. */
export const MUTABLE_SLICES = [
  "settings",
  "accounts",
  "homes",
  "bankAccounts",
  "homeCharges",
  "budget",
  "amenities",
  "forms",
  "posts",
  "requests",
  "instruments",
  "ledger",
  "payouts",
  "invoices",
  "vendors",
  "threads",
  "documents",
  "ballots",
  "templates",
  "sharedCosts",
  "sharedCostBills",
  // Both were read-only, which meant four tasks on the setup plan pointed at
  // screens that could not complete them. A plan that cannot be finished is
  // worse than no plan.
  "association",
  "reserveComponents",
  // A board could not create a ballot or schedule a meeting, so for a new
  // association the voting page was four permanent zeroes.
  "meetings",
  // Text imported from an uploaded declaration has to land somewhere, and it
  // is the board's own document rather than reference data.
  "governingDocs",
  // Residents can report, and a board can raise a notice off the back of one
  // once somebody has been out to look.
  "violations",
  "violationReports",
  // What the board tells everyone. Was fixture-only, which meant a real
  // association's residents were reading announcements nobody had written.
  "announcements",
  // What the board agreed to do, and who is waiting to be let in.
  "actionItems",
  "joinRequests",
] as const;

export type MutableSlice = (typeof MUTABLE_SLICES)[number];

/**
 * Stores are created on demand, one per community and slice, and cached.
 *
 * Creating them lazily rather than up front means adding a community is a data
 * change with no wiring, and a community you never visit costs nothing. The
 * cache is what keeps `subscribe` and `getSnapshot` referentially stable, which
 * useSyncExternalStore requires.
 */
export const registry = new Map<string, PersistedStore<never>>();

/**
 * Bump when the demo fixtures change in a way a browser's remembered copy
 * would hide: a renamed association, a home that moved street. Persisted
 * demo slices are keyed by this, so an old browser starts from the new
 * fixture instead of showing last month's name over this month's data.
 * Session, theme and the chosen community are keyed separately and survive.
 */
export const DEMO_FIXTURE_VERSION = 2;

/**
 * The slices that were renamed after browsers had already stored them. The
 * storage key keeps the old name: renaming it would drop every demo browser's
 * remembered state.
 */
const STORED_AS: Partial<Record<MutableSlice, string>> = { homes: "owners", homeCharges: "ownerCharges" };

export function sliceStore<K extends MutableSlice>(
  communityId: string,
  slice: K,
): PersistedStore<Community[K]> {
  const key = `hoasis:${communityId}:v${DEMO_FIXTURE_VERSION}:${STORED_AS[slice] ?? slice}`;
  const existing = registry.get(key);
  if (existing) return existing as unknown as PersistedStore<Community[K]>;

  const seed = communityById(communityId)[slice];
  const store = new PersistedStore(key, seed, {
    breaker: storageBreaker,
    migrate: renameLegacyFields,
    validate:
      slice === "association"
        ? (isAssociation as (v: unknown) => v is Community[K])
        : slice === "settings"
        ? (isCommunitySettings as (v: unknown) => v is Community[K])
        : slice === "homeCharges"
          ? (isChargeLedger as (v: unknown) => v is Community[K])
          : slice === "budget"
            ? (isBudgetLines as (v: unknown) => v is Community[K])
          : (isRecordArray<{ id: string }>() as unknown as (v: unknown) => v is Community[K]),
  });
  registry.set(key, store as unknown as PersistedStore<never>);
  return store;
}

/** Puts one community back to its seeded state. */
export function resetCommunity(communityId: string): void {
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
export function destructive<T>(store: Store<T>, mutate: (current: T) => T): () => void {
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
export function voteReceipt(ballotId: string, optionId: string): string {
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
export const dismissRegistry = new Map<string, PersistedStore<string[]>>();

export function dismissStore(communityId: string): PersistedStore<string[]> {
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

/**
 * The demo's Activity record: what a signed in association gets from the
 * database, kept here in the browser so the demo's Settings, Activity shows
 * the same lines for the same writes. Words come from lib/activity.ts.
 */
export const activityRegistry = new Map<string, PersistedStore<Activity[]>>();

export function demoActivityStore(communityId: string): PersistedStore<Activity[]> {
  const key = `hoasis:${communityId}:v${DEMO_FIXTURE_VERSION}:activity`;
  const existing = activityRegistry.get(key);
  if (existing) return existing;
  const store = new PersistedStore<Activity[]>(key, [], {
    breaker: storageBreaker,
    validate: isRecordArray<Activity>() as (v: unknown) => v is Activity[],
  });
  activityRegistry.set(key, store);
  return store;
}

/** Writes one line to the demo's Activity, in the signed in seat's name. */
export function logDemoActivity(
  communityId: string,
  subjectKind: string,
  summary: string,
  details: Record<string, unknown> = {},
) {
  const actor = sliceStore(communityId, "accounts")
    .getSnapshot()
    .find((a) => a.id === sessionStore.getSnapshot().accountId);
  // The date is the demo's pinned today and the time is the clock's, with no
  // zone, so it reads back as written. This runs in event handlers only.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const at = `${todayIsoDate()}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  demoActivityStore(communityId).update((all) => [
    { id: newId(), at, actorId: actor?.id, actorName: actor?.name ?? "The board", subjectKind, summary, details },
    ...all,
  ]);
}

/** Reads any Store through React, with the three snapshot callbacks bound once. */
export function useStore<T>(store: Store<T>): T {
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
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, alwaysTrue, alwaysFalse);
}

/**
 * What the provider reads before any action exists: the session, the remote
 * store, and one live copy of every slice. Each area's hook is handed this (or
 * a part of it) once per render, so a callback closes over the same values it
 * did when it was written inline in the provider and its dependency list stays
 * as it was.
 */
export interface BaseDeps {
  session: Session;
  chosenHome: string;
  remote: RemoteState;
  communityId: string;
  /** The seed community for the active id; the live slices are the fields below. */
  community: Community;
  settings: Community["settings"];
  accountList: Community["accounts"];
  homeList: Community["homes"];
  bankAccountList: Community["bankAccounts"];
  budgetLines: Community["budget"];
  localDismissals: string[];
  homeChargeMap: Community["homeCharges"];
  amenities: Community["amenities"];
  forms: Community["forms"];
  posts: Community["posts"];
  requestList: Community["requests"];
  instruments: Community["instruments"];
  ledger: Community["ledger"];
  payouts: Community["payouts"];
  invoices: Community["invoices"];
  vendors: Community["vendors"];
  threads: Community["threads"];
  documents: Community["documents"];
  governingDocs: Community["governingDocs"];
  violationList: Community["violations"];
  reportList: Community["violationReports"];
  associationRow: Community["association"];
  meetingList: Community["meetings"];
  reserveComponentList: Community["reserveComponents"];
  sharedCosts: Community["sharedCosts"];
  sharedCostBills: Community["sharedCostBills"];
  ballots: Community["ballots"];
  templates: Community["templates"];
  announcementList: Community["announcements"];
  actionItemList: Community["actionItems"];
  joinRequestList: Community["joinRequests"];
  demoActivity: Activity[];
}

/** `BaseDeps` plus who is acting, which the session hook works out first. */
export interface AppDeps extends BaseDeps {
  mySeats: Account[];
  account: Account | null;
  can: (c: Capability) => boolean;
}
