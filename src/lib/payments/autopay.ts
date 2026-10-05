import type { AutopayPlan, Cents } from "@/lib/types";

/**
 * What autopay should do for one home on one day.
 *
 * Pure, so the cron's judgement can be tested without a database or a clock.
 * The rules are the ones the pay screen promises in its own copy:
 *
 *   - Nothing happens before the chosen day of the month, or before the month
 *     the plan was switched on for ("Next autopay: October 1").
 *   - A skipped month sits out and carries on after.
 *   - With no cap, the whole balance goes out.
 *   - Above the cap, "regular dues still go out": the dues amount, and the
 *     rest waits for the owner to pay it by hand.
 *   - A day with nothing due is not a decision at all. It waits, so dues
 *     posted on the 3rd are still collected on the 4th.
 *   - Money already on its way counts. A bank payment takes days to settle
 *     and writes no statement line until it does, so the balance alone would
 *     have autopay pull the same dues a second time. What is in flight comes
 *     off first; if that covers everything, the day waits like any other
 *     day with nothing due, and is asked again tomorrow.
 */
export type AutopayDecision =
  | { action: "wait"; reason: string }
  | { action: "skip"; reason: string }
  | { action: "charge"; amountCents: Cents; reason: string };

export function decideAutopay(input: {
  plan: AutopayPlan;
  /** YYYY-MM-DD, the association's clock. */
  today: string;
  balanceCents: Cents;
  duesCents: Cents;
  /**
   * Payments made but not yet settled: the home's `pending` rows, summed.
   * The caller bounds them by age (see pendingSince), so a row whose failure
   * was never heard about cannot hold autopay off forever.
   */
  pendingCents?: Cents;
}): AutopayDecision {
  const { plan, today, duesCents } = input;
  const pendingCents = Math.max(0, input.pendingCents ?? 0);
  // What autopay may still take: the balance less what is already coming.
  const balanceCents = Math.max(0, input.balanceCents - pendingCents);
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));

  if (plan.startMonth && plan.startMonth > month) {
    return { action: "wait", reason: `Starts ${plan.startMonth}` };
  }
  if (day < plan.day) {
    return { action: "wait", reason: `Runs on the ${plan.day}` };
  }
  if (plan.skipMonth === month) {
    return { action: "skip", reason: "Skipped this month" };
  }
  if (balanceCents <= 0) {
    if (input.balanceCents > 0) return { action: "wait", reason: "Payment processing" };
    return { action: "wait", reason: "Nothing due" };
  }
  if (plan.capCents !== undefined && balanceCents > plan.capCents) {
    const amount = Math.min(duesCents, balanceCents);
    if (amount <= 0) return { action: "wait", reason: "Nothing due" };
    return {
      action: "charge",
      amountCents: amount,
      reason: "Balance is above the cap, so only regular dues went out",
    };
  }
  return { action: "charge", amountCents: balanceCents, reason: "Full balance" };
}

/**
 * How long a pending payment is believed. A bank debit settles or fails
 * within about a week; past two, the likelier story is a failure event that
 * never arrived, and a home must not sit out autopay forever on its account.
 */
export const PENDING_PAYMENT_MAX_AGE_DAYS = 14;

/** The earliest day a pending payment may date from and still count, YYYY-MM-DD. */
export function pendingSince(today: string): string {
  const at = new Date(`${today}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - PENDING_PAYMENT_MAX_AGE_DAYS);
  return at.toISOString().slice(0, 10);
}

/** A saved instrument the cron can actually charge: a Stripe method, verified. */
export function isChargeable(instrument: {
  token?: string;
  status?: string;
}): boolean {
  return Boolean(instrument.token?.startsWith("pm_")) && instrument.status !== "verifying";
}

/** The most times one month is ever attempted. */
export const AUTOPAY_MAX_ATTEMPTS = 3;

/** The reason written when there was nothing to charge at all. */
export const NO_CHARGEABLE_METHOD = "No payment method that can be charged automatically";

/**
 * Whether a month that failed should be tried again today.
 *
 * A failed month used to be final, so an owner who replaced a declined card
 * the next day still went past due. Trying again every morning would be the
 * opposite mistake: the same decline and the same email, daily. So a retry
 * needs a reason to expect a different answer:
 *
 *   - the failure was having nothing to charge, and now there is something; or
 *   - a method was added on or after the day of the last attempt.
 *
 * And never twice in a day, and never past the cap.
 */
export function mayRetryAutopay(input: {
  run: { state: string; attempts: number; lastAttemptOn: string; reason: string | null };
  /** YYYY-MM-DD, the same clock the run uses. */
  today: string;
  /** The day each method that can be charged now was added. */
  chargeableAddedOn: string[];
}): boolean {
  const { run, today, chargeableAddedOn } = input;
  if (run.state !== "failed") return false;
  if (run.attempts >= AUTOPAY_MAX_ATTEMPTS) return false;
  if (run.lastAttemptOn >= today) return false;
  if (run.reason === NO_CHARGEABLE_METHOD) return chargeableAddedOn.length > 0;
  return chargeableAddedOn.some((added) => added >= run.lastAttemptOn);
}
