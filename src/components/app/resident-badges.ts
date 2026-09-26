"use client";

import { useMemo } from "react";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { daysFromToday } from "@/lib/utils";

export interface ResidentBadge {
  count: number;
  tone: "warn" | "danger" | "neutral";
}

/**
 * Counts beside the resident sections, keyed by the section row's href.
 *
 * A badge means something waits on the owner, the way the board's mean a
 * decision is owed: a balance to pay, a ballot to cast, an answer from the
 * board they have not seen. Nothing else earns one, or the numbers stop
 * meaning anything.
 */
export function useResidentBadges(): Partial<Record<string, ResidentBadge>> {
  const { community } = useAppState();
  const owner = useCurrentOwner();
  return useMemo(() => {
    const badges: Partial<Record<string, ResidentBadge>> = {};
    if (!owner) return badges;

    if (owner.balanceCents > 0) {
      badges["/resident/pay"] = { count: 1, tone: owner.daysPastDue > 0 ? "danger" : "neutral" };
    }

    const toVote = community.ballots.filter(
      (b) => b.audience === "owners" && b.status === "open" && !b.myVoteOptionId,
    ).length;
    if (toVote > 0) badges["/resident/calendar"] = { count: toVote, tone: "warn" };

    // Replies in the last two weeks: on a request, or in a message thread.
    const answered = community.requests
      .filter((r) => r.ownerId === owner.id)
      .filter((r) => {
        const last = [...r.thread].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
        return (
          last &&
          last.actorRole !== "resident" &&
          last.actorRole !== "system" &&
          daysFromToday(last.at) >= -14
        );
      }).length;
    const replied = community.threads
      .filter((t) => t.ownerId === owner.id)
      .filter((t) => {
        const last = t.messages[t.messages.length - 1];
        return last && last.fromRole !== "resident" && daysFromToday(last.at) >= -14;
      }).length;
    if (answered + replied > 0) {
      badges["/resident/requests"] = { count: answered + replied, tone: "neutral" };
    }
    return badges;
  }, [community, owner]);
}
