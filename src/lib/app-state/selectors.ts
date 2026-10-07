"use client";

import { useCallback, useMemo } from "react";
import { seededCommunities } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import { daysFromToday } from "@/lib/utils";
import { createdCommunitiesStore } from "@/lib/data/created-communities";
import { ownerDues } from "@/lib/home-types";
import type { ForumPost, Owner } from "@/lib/types";
import type { PaymentInstrument } from "@/lib/payments/instruments";
import { homeCount } from "@/lib/metrics";
import { ballotPhase, meetingPhase } from "@/lib/phases";
import { homePhotoStore, MUTABLE_SLICES, sliceStore, useHydrated, useStore } from "./core";
import { useAppState } from "./provider";

/**
 * The owner record behind the signed in account. An admin switching to the
 * resident view sees their own unit and their own balance, not a demo one.
 */
export function useCurrentOwner(): Owner | null {
  const { account, community } = useAppState();
  // Indexed per community, so a lookup stays constant time as either grows.
  const index = useMemo(
    () => new Map(community.owners.map((owner) => [owner.id, owner])),
    [community],
  );
  return useMemo(() => (account ? (index.get(account.ownerId) ?? null) : null), [account, index]);
}

/** Charge history is only seeded for a few households; everyone else sees an empty ledger. */
export function useOwnerCharges() {
  const { community } = useAppState();
  const owner = useCurrentOwner();
  return owner ? (community.ownerCharges[owner.id] ?? []) : [];
}

/**
 * The signed-in owner's photo of their home, with a setter. Null clears it.
 *
 * `photo` is always the best image we hold, in this order: what the owner
 * uploaded in this browser, then the photo on their record, then the
 * community's cover. `uploaded` says whether the first of those is in play,
 * which is the only case "Remove photo" makes sense for.
 */
export function useHomePhoto(): {
  photo: string | null;
  uploaded: boolean;
  setPhoto: (dataUrl: string | null) => void;
} {
  const owner = useCurrentOwner();
  const { settings } = useAppState();
  const all = useStore(homePhotoStore);
  const ownerId = owner?.id;
  const setPhoto = useCallback(
    (dataUrl: string | null) => {
      if (!ownerId) return;
      homePhotoStore.update((current) => {
        const next = { ...current };
        if (dataUrl) next[ownerId] = dataUrl;
        else delete next[ownerId];
        return next;
      });
    },
    [ownerId],
  );
  const own = ownerId ? (all[ownerId] ?? null) : null;
  return {
    photo: own ?? owner?.photoUrl ?? settings.photoUrl ?? null,
    uploaded: Boolean(own),
    setPhoto,
  };
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

/**
 * What a resident is allowed to see: published posts, plus their own pending
 * ones so they can tell the post was received rather than lost.
 */
export function useVisiblePosts(): ForumPost[] {
  const { posts, account } = useAppState();
  return useMemo(
    () =>
      posts.filter(
        (post) =>
          post.status === "published" ||
          (account && post.author === account.name && post.status !== "rejected"),
      ),
    [posts, account],
  );
}

/** The moderation queue, oldest first so nothing sits forever. */
export function usePendingPosts(): ForumPost[] {
  const { posts } = useAppState();
  return useMemo(
    () =>
      posts.filter((p) => p.status === "pending").sort((a, b) => (a.at < b.at ? -1 : 1)),
    [posts],
  );
}

/**
 * Reconciliation over the live ledger rather than the frozen fixture, so
 * confirming a transaction updates every count that depends on it.
 */
export function useReconciliation() {
  const { ledger, community } = useAppState();
  return useMemo(() => {
    const needsReview = ledger.filter((e) => e.status === "needs-review");
    const pending = ledger.filter((e) => e.status === "pending");
    const cleared = ledger.filter((e) => e.status === "cleared");
    const duplicates = ledger.filter((e) => e.duplicateOfId);
    return {
      needsReview,
      pending,
      cleared,
      duplicates,
      staleFeeds: community.bankAccounts.filter((a) => a.status !== "live"),
      lastSyncMinutes: community.bankAccounts.length
        ? Math.min(...community.bankAccounts.map((a) => a.syncedMinutesAgo))
        : 0,
      tiesOut: needsReview.length === 0,
    };
  }, [ledger, community]);
}

/** Payouts still short of the signatures they need. */
export function usePendingApprovals() {
  const { payouts } = useAppState();
  return useMemo(
    () => payouts.filter((p) => p.approvals.length < p.approvalsRequired),
    [payouts],
  );
}

export function useUnreadThreadCount() {
  const { threads } = useAppState();
  return useMemo(() => threads.filter((t) => t.unread).length, [threads]);
}

/** Vendor paperwork the board still owes someone. */
export function useVendorGaps() {
  const { vendors } = useAppState();
  return useMemo(
    () => ({
      missingW9: vendors.filter((v) => !v.w9OnFile),
      noAch: vendors.filter((v) => !v.achEnabled),
      expiringCoi: vendors.filter(
        (v) => v.coiExpires && daysFromToday(v.coiExpires) < 60 && daysFromToday(v.coiExpires) >= 0,
      ),
    }),
    [vendors],
  );
}

/**
 * The snapshot the in-app assistant answers from.
 *
 * Built on the client from live state rather than rendered on the server, so it
 * follows the signed in household and the active association. The assistant is
 * only trustworthy if it reads the same data the screens do.
 */
export function useAssistantContext() {
  const { community, settings, requests, documents, amenities } = useAppState();
  const owner = useCurrentOwner();
  const charges = useOwnerCharges();

  return useMemo(() => {
    const lastPayment = charges.find((c) => c.kind === "payment");
    const live = community.meetings.find((m) => m.status === "live");
    const cash = community.bankAccounts.reduce(
      (acc, a) =>
        a.kind === "operating"
          ? { ...acc, operating: acc.operating + a.balanceCents }
          : { ...acc, reserve: acc.reserve + a.balanceCents },
      { operating: 0, reserve: 0 },
    );
    const reserveBalance = cash.reserve;
    const blendedApy = reserveBalance
      ? community.bankAccounts
          .filter((a) => a.kind !== "operating")
          .reduce((t, a) => t + a.apy * a.balanceCents, 0) / reserveBalance
      : 0;
    const required = community.reserveComponents.reduce(
      (t, c) => t + c.replacementCostCents,
      0,
    );
    const funded = community.reserveComponents.reduce((t, c) => t + c.fundedCents, 0);

    return {
      owner: {
        name: owner?.members[0] ?? "",
        unit: owner?.unit ?? "",
        balanceCents: owner?.balanceCents ?? 0,
        nextChargeDate: community.nextChargeDate as string | undefined,
        standing: owner?.standing ?? "current",
        daysPastDue: owner?.daysPastDue ?? 0,
        autopay: owner?.autopay ?? false,
        lastPayment: lastPayment
          ? {
              date: lastPayment.date,
              amountCents: Math.abs(lastPayment.amountCents),
              method: lastPayment.method,
              appliedTo: lastPayment.appliedTo?.map((a) => a.label) ?? [],
            }
          : undefined,
      },
      association: {
        name: community.association.name,
        // What this owner's home pays, which is the one figure the assistant
        // says about dues.
        duesCents: ownerDues(community.association, owner ?? undefined),
        unitCount: homeCount(community),
        operatingCents: cash.operating,
        reserveCents: reserveBalance,
        interestYtdCents: community.bankAccounts.reduce((t, a) => t + a.interestYtdCents, 0),
        blendedApy,
        reservePercentFunded: required ? funded / required : 0,
      },
      methods: community.instruments.map((m) => ({
        label: m.label,
        kind: m.kind,
        feeCents: 0,
        feePercent: 0,
      })),
      meetings: community.meetings
        // By phase, as every screen reads them: nothing marks a real
        // association's meeting ended, so its date does.
        .filter((m) => meetingPhase(m) !== "ended")
        .map((m) => ({
          title: m.title,
          date: m.date,
          time: m.time,
          location: m.location,
          dialIn: m.dialIn,
          status: m.status,
        })),
      liveMeeting: live ? { title: live.title, attendees: live.attendees.length } : undefined,
      events: [] as { title: string; date: string; time: string; location: string }[],
      ballots: community.ballots
        // A ballot past its closing date is closed, pressed or not.
        .filter((b) => b.audience === "owners" && ballotPhase(b) === "open")
        .map((b) => ({ title: b.title, closesDate: b.closesDate, voted: Boolean(b.myVoteOptionId) })),
      requests: requests
        .filter((r) => r.ownerId === owner?.id)
        .map((r) => ({
          reference: r.reference,
          title: r.title,
          status: r.status,
          submittedDate: r.submittedDate,
        })),
      documentCount: documents.filter((d) => d.visibility !== "board").length,
      amenities: amenities.map((a) => ({ name: a.name, status: a.status, detail: a.detail })),
      fundsVisible: settings.showFundsToResidents,
    };
  }, [community, settings, requests, documents, amenities, owner, charges]);
}

/** The signed in household's payment instruments, default first. */
export function useMyInstruments(): PaymentInstrument[] {
  const owner = useCurrentOwner();
  const { instruments } = useAppState();
  return useMemo(
    () =>
      owner
        ? instruments
            .filter((i) => i.ownerId === owner.id)
            .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
        : [],
    [owner, instruments],
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

/**
 * Any association by id, including ones built through onboarding.
 *
 * Created associations live in a store that only has content after hydration,
 * so a component resolving one during the first render sees the server
 * snapshot and finds nothing. Subscribing here means the lookup re-runs once
 * storage has been read, which is what an invitation link needs.
 */
export function useCommunityById(id: string | null | undefined): Community | null {
  const created = useStore(createdCommunitiesStore);
  return useMemo(() => {
    if (!id) return null;
    const base = [...seededCommunities, ...created].find((c) => c.id === id);
    return base ? withLiveSlices(base) : null;
  }, [id, created]);
}

/**
 * A community with its stored slices laid over the seed.
 *
 * Every association exists in two halves: a seed, which is either a fixture or
 * the bundle onboarding wrote, and the slice stores that hold everything
 * changed since. Reading only the seed is how a household added this morning
 * fails to exist. The provider does the same overlay through hooks so the
 * active community stays reactive; this is the one-shot version, for reading
 * an association you are not signed into.
 */
export function withLiveSlices(base: Community): Community {
  const next = { ...base };
  for (const slice of MUTABLE_SLICES) {
    (next as Record<string, unknown>)[slice] = sliceStore(base.id, slice).getSnapshot();
  }
  return next;
}

/** True once storage has been read, so a caller can tell missing from not-yet-loaded. */
export function useStorageReady(): boolean {
  return useHydrated();
}
