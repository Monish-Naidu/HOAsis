import type { Community } from "@/lib/data/community";
import type { Owner } from "@/lib/types";

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

export interface CollectionPolicy {
  /** Days past due before a friendly reminder goes out. */
  reminderDay: number;
  /** Days before the formal notice, which is the one that carries the late fee. */
  lateNoticeDay: number;
  /** Days before a demand letter offering a payment plan. */
  demandDay: number;
  /** Days before the file goes to counsel. */
  counselDay: number;
  /** Charged once, when the account reaches the formal notice. */
  lateFeeCents: number;
  /**
   * The shortest payment plan the board will accept.
   *
   * Several states require one be offered before a lien, and offering it up
   * front settles far more accounts than a demand letter alone.
   */
  minimumPlanMonths: number;
}

export const DEFAULT_COLLECTION_POLICY: CollectionPolicy = {
  reminderDay: 15,
  lateNoticeDay: 30,
  demandDay: 45,
  counselDay: 90,
  lateFeeCents: 25_00,
  minimumPlanMonths: 12,
};

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
  counsel: "Refer to counsel",
};

/** What the board is meant to do next, in the words of the policy. */
export const STAGE_ACTION: Record<CollectionStage, string> = {
  current: "Nothing",
  reminder: "Send a friendly reminder with the amount and how to pay",
  "late-notice": "Send the formal notice, with the late fee stated",
  demand: "Send a demand offering a payment plan, before anything is recorded",
  counsel: "Hand the file to counsel, with every notice attached",
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
      return {
        owner,
        stage,
        nextStage,
        daysToNext: nextDay === undefined ? undefined : nextDay - owner.daysPastDue,
        actionDue: stage !== "current",
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
    skipped: rows.filter((r) => r.owner.daysPastDue > policy.demandDay),
  };
}

/** Whether a household is far enough along that a plan should be offered. */
export function shouldOfferPlan(row: LadderRow): boolean {
  return row.stage === "demand" || row.stage === "counsel";
}

/** Days until this owner's next policy step, for a calendar. */
export function nextStepDate(owner: Owner, policy: CollectionPolicy): number | undefined {
  const stage = stageFor(owner.daysPastDue, policy);
  const index = STAGE_ORDER.indexOf(stage);
  const next = STAGE_ORDER[index + 1];
  if (!next) return undefined;
  const day =
    next === "reminder"
      ? policy.reminderDay
      : next === "late-notice"
        ? policy.lateNoticeDay
        : next === "demand"
          ? policy.demandDay
          : policy.counselDay;
  return day - owner.daysPastDue;
}
