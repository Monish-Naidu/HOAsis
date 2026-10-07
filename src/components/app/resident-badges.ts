"use client";

/**
 * The counts beside the resident navigation rows.
 *
 * A count appears only where the page it opens shows the same number in its own
 * words, so a badge can always be cleared by doing what the page asks.
 */

import { useMemo } from "react";
import { useAppState, useCurrentHome } from "@/lib/app-state";
import type { Community } from "@/lib/data/community";
import type { Home } from "@/lib/types";
import { ballotPhase } from "@/lib/phases";
import { openNoticesForHome } from "@/lib/resident-wording";

export interface ResidentBadge {
  count: number;
  tone: "warn" | "danger" | "neutral";
  /** What the number counts, in words, shown on hover and read aloud. */
  hint?: string;
}

/**
 * Counts beside the resident sections, keyed by the section row's href.
 *
 * A number on a row is a number the page it opens shows under its own
 * words, or it is not there:
 *
 * - Meetings: ballots this owner has not voted on. The Meetings page opens
 *   with "N ballots need your vote", linking to Voting.
 * - Requests: open notices about this home. The Requests page opens with
 *   "N open notices about your home".
 *
 * Payments has no count. A balance is an amount, not a number of things, and
 * the home card and the bell already say it; a "1" there counted nothing.
 * Replies from the board have none either: the page marks no reply as
 * unseen, so a count of them could never clear. The bell lists them.
 */
export function residentBadges(
  community: Pick<Community, "ballots" | "violations">,
  home: Pick<Home, "id" | "unit"> | null,
): Partial<Record<string, ResidentBadge>> {
  const badges: Partial<Record<string, ResidentBadge>> = {};
  if (!home) return badges;

  const toVote = community.ballots.filter(
    (b) => b.audience === "owners" && ballotPhase(b) === "open" && !b.myVoteOptionId,
  ).length;
  if (toVote > 0) {
    badges["/resident/calendar"] = {
      count: toVote,
      tone: "warn",
      hint: toVote === 1 ? "ballot to cast" : "ballots to cast",
    };
  }

  const notices = openNoticesForHome(community.violations, home).length;
  if (notices > 0) {
    badges["/resident/requests"] = {
      count: notices,
      tone: "warn",
      hint: notices === 1 ? "open notice about your home" : "open notices about your home",
    };
  }
  return badges;
}

export function useResidentBadges(): Partial<Record<string, ResidentBadge>> {
  const { community } = useAppState();
  const home = useCurrentHome();
  return useMemo(() => residentBadges(community, home), [community, home]);
}
