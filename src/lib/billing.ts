import { PRICE_PER_HOME_CENTS, TRIAL_DAYS } from "@/lib/pricing";
import type { ISODate } from "@/lib/types";
import { DAY_MS, addDays, daysBetween } from "@/lib/utils";

/**
 * The free period and what follows it, as arithmetic.
 *
 * Nothing here talks to Stripe or the database. The banner, the settings
 * card, the daily sweep and the checkout route all ask this module the same
 * questions ("how long is left", "which notice is due", "may the board still
 * work") so that they cannot disagree about a date. The database holds
 * `trial_ends_at` and `subscription_status`; this turns the pair into a phase.
 */

/** What the associations row can say about itself. */
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "ended";

/**
 * Days a board keeps working after the trial ends with nothing on file.
 *
 * A treasurer who finds the door shut on the morning dues are due will not
 * come back. Two weeks of a red banner is a nudge; a lock on day 91 is a
 * lost association and, worse, owners who cannot see their own statements.
 */
export const GRACE_DAYS = 14;

/** Trial notices, most distant first. Keys are stored in `billing_notices`. */
export const TRIAL_NOTICES = [
  { key: "14-days", daysBefore: 14 },
  { key: "3-days", daysBefore: 3 },
  { key: "ended", daysBefore: 0 },
] as const;

export type TrialNoticeKey = (typeof TRIAL_NOTICES)[number]["key"];

export interface BillingFacts {
  status: SubscriptionStatus;
  /** The date the free period ends, `YYYY-MM-DD`. */
  trialEndsOn: ISODate;
  /** Homes billed: every unit, sold or not, because every unit is a record. */
  homes: number;
  /** A Stripe subscription exists, which means a card is on file. */
  hasSubscription: boolean;
}

export type BillingPhase =
  | { phase: "trialing"; daysLeft: number; endsOn: ISODate; closing: boolean }
  | { phase: "ended"; daysOver: number; endsOn: ISODate; locked: boolean }
  | { phase: "active" }
  | { phase: "past_due" }
  | { phase: "canceled" };

/** Ninety days after founding. */
export function trialEndsOn(foundedOn: ISODate): ISODate {
  return addDays(foundedOn, TRIAL_DAYS);
}

/**
 * Where the association stands today.
 *
 * The stored status wins when Stripe has spoken (active, past due,
 * canceled). For an association Stripe has never heard of, the phase is a
 * function of the date alone, so a sweep that has not run yet and a sweep that
 * ran an hour ago describe the same association the same way.
 */
export function billingPhase(facts: BillingFacts, today: ISODate): BillingPhase {
  if (facts.status === "canceled") return { phase: "canceled" };
  if (facts.status === "past_due") return { phase: "past_due" };
  if (facts.status === "active" || facts.hasSubscription) return { phase: "active" };

  const daysLeft = daysBetween(today, facts.trialEndsOn);
  if (daysLeft > 0) {
    return { phase: "trialing", daysLeft, endsOn: facts.trialEndsOn, closing: daysLeft <= 14 };
  }
  const daysOver = Math.max(0, -daysLeft);
  return { phase: "ended", daysOver, endsOn: facts.trialEndsOn, locked: daysOver > GRACE_DAYS };
}

/** Whether board screens are shut behind the billing wall. */
export function boardLocked(phase: BillingPhase): boolean {
  return phase.phase === "ended" && phase.locked;
}

/**
 * The one trial notice to send today, if any.
 *
 * Returns the most urgent notice whose day has arrived and that has not gone
 * out, and every earlier key that should be marked sent alongside it. A sweep
 * that missed a week (or a trial shortened by hand) sends one email, not
 * three: the 3 day notice on its own says everything the 14 day one would.
 */
export function trialNoticeDue(
  endsOn: ISODate,
  today: ISODate,
  sent: readonly string[],
): { send: TrialNoticeKey; markSent: TrialNoticeKey[] } | null {
  const daysLeft = daysBetween(today, endsOn);
  const due = TRIAL_NOTICES.filter((n) => daysLeft <= n.daysBefore);
  if (due.length === 0) return null;
  const unsent = due.filter((n) => !sent.includes(n.key));
  if (unsent.length === 0) return null;
  const send = unsent[unsent.length - 1].key;
  return { send, markSent: due.map((n) => n.key) };
}

/** Stripe refuses a trial shorter than this. */
const MIN_STRIPE_TRIAL_MS = 2 * DAY_MS;

/**
 * The `trial_end` to hand Stripe Checkout, as unix seconds.
 *
 * A card added on day 20 must not be charged until day 91, so the remaining
 * free days ride along as a Stripe trial. Stripe refuses a trial shorter than
 * two days, so with less than that left the subscription simply starts and
 * the first invoice is the first invoice.
 */
export function checkoutTrialEnd(endsOn: ISODate, now: Date): number | null {
  const end = new Date(`${endsOn}T12:00:00Z`).getTime();
  if (end - now.getTime() < MIN_STRIPE_TRIAL_MS) return null;
  return Math.floor(end / 1000);
}

/** A per home line for a Stripe subscription, in the shape Checkout wants. */
export function subscriptionLine(homes: number) {
  return {
    quantity: Math.max(1, homes),
    price_data: {
      currency: "usd",
      unit_amount: PRICE_PER_HOME_CENTS,
      recurring: { interval: "month" as const },
      product_data: { name: "Your HOAsis, per home per month" },
    },
  };
}

/** Stripe's subscription status vocabulary, folded into ours. */
export function statusFromStripe(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "active";
  }
}
