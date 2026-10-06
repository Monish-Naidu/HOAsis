/**
 * The late-payment ladder: which stage a household is at and what the policy says is next.
 *
 * The ladder is derived from days past due and the board's written policy, never
 * stored per owner, so the same household gets the same step on every screen.
 */

import type { Community } from "@/lib/data/community";
import type { CollectionPolicy, CommunitySettings, Owner } from "@/lib/types";
import { addDays } from "@/lib/utils";

export type { CollectionPolicy };

/**
 * Chasing money without losing a neighbour.
 *
 * The legal advice on this is unanimous and boards rarely follow it: a written
 * policy, the same ladder for everybody, every step dated and recorded. The
 * reason is not tidiness. Selective enforcement is the defence an owner raises
 * when a lien is challenged, and "we sent the notice to him but not to her"
 * loses. Running the ladder from the balance and the calendar, rather than from
 * whoever the board is annoyed with this month, is the whole point.
 *
 * The escalation below is the common shape across published policies: a
 * reminder while it is merely late, a formal notice with the fee, a demand
 * offering a payment plan before anything is recorded, and only then counsel.
 * Days are the board's to set, because their documents and their state decide
 * them.
 */

export type CollectionStage =
  | "current"
  | "reminder"
  | "late-notice"
  | "demand"
  | "counsel";

export const DEFAULT_COLLECTION_POLICY: CollectionPolicy = {
  reminderDay: 15,
  lateNoticeDay: 30,
  demandDay: 45,
  counselDay: 90,
  // No fee until the board sets one. A charge the board never chose, taken
  // from owners on the strength of a default, is the one to avoid.
  lateFeeCents: 0,
  minimumPlanMonths: 12,
};

/**
 * The policy a founder's late fee answer makes.
 *
 * The fee falls on the formal notice, so "days after the due date" is the
 * notice day. The other rungs keep their usual days unless the notice moves
 * past them, because a ladder that does not climb is refused
 * (`policyProblems`). No fee, or an amount of nothing, leaves every day at
 * its default and the fee at zero.
 */
export function policyWithLateFee(lateFeeCents: number, days: number): CollectionPolicy {
  const base = DEFAULT_COLLECTION_POLICY;
  if (!(lateFeeCents > 0) || !Number.isInteger(days) || days < 2) return { ...base };
  const reminderDay = Math.min(base.reminderDay, days - 1);
  const demandDay = Math.max(base.demandDay, days + 1);
  return {
    ...base,
    reminderDay,
    lateNoticeDay: days,
    demandDay,
    counselDay: Math.max(base.counselDay, demandDay + 1),
    lateFeeCents,
  };
}

/** The board's own ladder where it set one, the default where it did not. */
export function policyFor(settings: Pick<CommunitySettings, "collectionPolicy">): CollectionPolicy {
  return { ...DEFAULT_COLLECTION_POLICY, ...(settings.collectionPolicy ?? {}) };
}

/**
 * What is wrong with a policy, in the board's words. Empty when nothing is.
 *
 * The rungs have to climb: a demand before the notice would send the harder
 * letter first, and a ladder like that is the selective enforcement the
 * policy exists to rule out.
 */
export function policyProblems(policy: CollectionPolicy): string[] {
  const problems: string[] = [];
  const days = [policy.reminderDay, policy.lateNoticeDay, policy.demandDay, policy.counselDay];
  if (days.some((d) => !Number.isFinite(d) || d < 1)) {
    problems.push("Every step needs a day past due, starting at 1.");
  }
  if (!(policy.reminderDay < policy.lateNoticeDay)) {
    problems.push("The reminder has to come before the notice.");
  }
  if (!(policy.lateNoticeDay < policy.demandDay)) {
    problems.push("The notice has to come before the demand.");
  }
  if (!(policy.demandDay < policy.counselDay)) {
    problems.push("The demand has to come before the referral to the attorney.");
  }
  if (!Number.isFinite(policy.lateFeeCents) || policy.lateFeeCents < 0) {
    problems.push("The late fee cannot be negative. Zero means no fee.");
  }
  if (!Number.isFinite(policy.minimumPlanMonths) || policy.minimumPlanMonths < 1) {
    problems.push("A payment plan needs at least one month.");
  }
  return problems;
}

const STAGE_ORDER: CollectionStage[] = [
  "current",
  "reminder",
  "late-notice",
  "demand",
  "counsel",
];

export const STAGE_LABEL: Record<CollectionStage, string> = {
  current: "Current",
  reminder: "Reminder due",
  "late-notice": "Notice due",
  demand: "Demand due",
  counsel: "Refer to attorney",
};

export function stageFor(daysPastDue: number, policy: CollectionPolicy): CollectionStage {
  if (daysPastDue >= policy.counselDay) return "counsel";
  if (daysPastDue >= policy.demandDay) return "demand";
  if (daysPastDue >= policy.lateNoticeDay) return "late-notice";
  if (daysPastDue >= policy.reminderDay) return "reminder";
  return "current";
}

export interface LadderRow {
  owner: Owner;
  stage: CollectionStage;
  /** The stage after this one, and how many days until they reach it. */
  nextStage?: CollectionStage;
  daysToNext?: number;
  /** True when the policy says a step is owed now and nothing has gone out. */
  actionDue: boolean;
  /** The day this rung's letter went out, when one has. */
  sentOn?: string;
}

/** The day past due at which each rung is reached. */
function rungDay(stage: CollectionStage, policy: CollectionPolicy): number | undefined {
  if (stage === "reminder") return policy.reminderDay;
  if (stage === "late-notice") return policy.lateNoticeDay;
  if (stage === "demand") return policy.demandDay;
  if (stage === "counsel") return policy.counselDay;
  return undefined;
}

/**
 * The day the board last wrote to this home about its dues, on or after
 * `since`. Undefined when it has not.
 *
 * Read from the letters themselves, not from the thread's last activity: an
 * owner replying to last month's reminder moves the thread's date, and that
 * reply is not this month's notice having gone out.
 */
function billingLetterSince(c: Community, ownerId: string, since: string): string | undefined {
  let latest: string | undefined;
  for (const thread of c.threads) {
    if (thread.ownerId !== ownerId || thread.tag !== "Billing") continue;
    for (const message of thread.messages ?? []) {
      if (message.direction !== "outbound") continue;
      const day = message.at.slice(0, 10);
      if (day >= since && (!latest || day > latest)) latest = day;
    }
  }
  return latest;
}

/**
 * Every past due household, placed on the ladder.
 *
 * Sorted by how far along they are rather than by how much they owe, because
 * the account that needs a decision today is the one nearest a deadline, not
 * the largest one.
 */
export function collectionsLadder(c: Community, policy: CollectionPolicy) {
  const rows: LadderRow[] = c.owners
    .filter((o) => o.daysPastDue > 0)
    .map((owner) => {
      const stage = stageFor(owner.daysPastDue, policy);
      const index = STAGE_ORDER.indexOf(stage);
      const nextStage = STAGE_ORDER[index + 1];
      const nextDay =
        nextStage === "reminder"
          ? policy.reminderDay
          : nextStage === "late-notice"
            ? policy.lateNoticeDay
            : nextStage === "demand"
              ? policy.demandDay
              : nextStage === "counsel"
                ? policy.counselDay
                : undefined;
      // A rung's letter is owed once. Without looking at what went out, the
      // same homes read as owed a notice the moment after it was sent, and
      // the next officer to open the page sent it again. A letter counts for
      // this rung when it is dated on or after the day the home reached it;
      // an earlier one belongs to the rung before. Only loaded threads are
      // seen, so a letter outside what was loaded reads as not sent, which
      // offers it again rather than hiding a notice that is owed.
      const reached = rungDay(stage, policy);
      const sentOn =
        reached === undefined
          ? undefined
          : billingLetterSince(c, owner.id, addDays(c.asOf, -(owner.daysPastDue - reached)));
      return {
        owner,
        stage,
        nextStage,
        daysToNext: nextDay === undefined ? undefined : nextDay - owner.daysPastDue,
        actionDue: stage !== "current" && !sentOn,
        sentOn,
      };
    })
    .sort((a, b) => STAGE_ORDER.indexOf(b.stage) - STAGE_ORDER.indexOf(a.stage));

  const byStage = (stage: CollectionStage) => rows.filter((r) => r.stage === stage);

  return {
    rows,
    /** What the board owes somebody today. This is the actionable number. */
    dueNow: rows.filter((r) => r.actionDue),
    reminder: byStage("reminder"),
    lateNotice: byStage("late-notice"),
    demand: byStage("demand"),
    counsel: byStage("counsel"),
    totalCents: rows.reduce((t, r) => t + r.owner.balanceCents, 0),
    /**
     * Anybody the ladder has skipped past.
     *
     * A board that never sent the notice at day thirty and is now at day
     * sixty has a gap in the record, and the gap is what an owner's lawyer
     * points at. Naming it is more useful than quietly moving on.
     */
    skipped: rows.filter(
      (r) =>
        r.owner.daysPastDue > policy.demandDay &&
        // "No notice on record" has to mean the record: a billing letter to
        // this home since it fell behind. Counting days alone flagged a
        // household that had been sent every letter on the ladder.
        !c.threads.some(
          (t) =>
            t.ownerId === r.owner.id &&
            t.tag === "Billing" &&
            t.updatedDate >= addDays(c.asOf, -r.owner.daysPastDue),
        ),
    ),
  };
}

/**
 * The chips over the past due list: all of it, one rung of the ladder, or the
 * homes whose autopay failed. One predicate serves the list and its counts,
 * so a chip never promises more homes than it opens.
 */
export const LADDER_FILTERS = ["all", "current", "reminder", "late-notice", "demand", "counsel", "autopay-failed"] as const;
export type LadderFilter = (typeof LADDER_FILTERS)[number];

export function matchesLadderFilter(
  row: Pick<LadderRow, "stage"> & { owner: Pick<Owner, "id"> },
  filter: LadderFilter,
  autopayFailed: ReadonlySet<string> = new Set(),
): boolean {
  if (filter === "all") return true;
  if (filter === "autopay-failed") return autopayFailed.has(row.owner.id);
  return row.stage === filter;
}

export function ladderFilterCounts(
  rows: readonly (Pick<LadderRow, "stage"> & { owner: Pick<Owner, "id"> })[],
  autopayFailed: ReadonlySet<string> = new Set(),
): Record<LadderFilter, number> {
  const counts = {} as Record<LadderFilter, number>;
  for (const f of LADDER_FILTERS) counts[f] = rows.filter((r) => matchesLadderFilter(r, f, autopayFailed)).length;
  return counts;
}
