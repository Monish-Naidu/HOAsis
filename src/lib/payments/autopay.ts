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
}): AutopayDecision {
  const { plan, today, balanceCents, duesCents } = input;
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

/** A saved instrument the cron can actually charge: a Stripe method, verified. */
export function isChargeable(instrument: {
  token?: string;
  status?: string;
}): boolean {
  return Boolean(instrument.token?.startsWith("pm_")) && instrument.status !== "verifying";
}
