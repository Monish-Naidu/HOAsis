/**
 * What HOAsis charges, in one place.
 *
 * The pricing page and the front page both quote a figure, and they drifted
 * once already: the front page went on selling a per door rate months after
 * pricing had moved to flat bands, which put our published price at three
 * times the real one. Both read this now, so a change lands in both.
 *
 * Priced per home per month. It is the convention a board already understands,
 * because it is how a management proposal is quoted, so the
 * comparison needs no arithmetic from them.
 */

/** Per home, per month. */
export const PRICE_PER_HOME_CENTS = 4_00;

/** Per payment, whatever rail it arrives on. */
export const PRICE_PER_TRANSACTION_CENTS = 2_00;

/** The whole software bill for an association of this size, monthly. */
export function monthlyFor(homes: number): number {
  return PRICE_PER_HOME_CENTS * Math.max(0, homes);
}

/** And annually, which is the number a board budgets against. */
export function annualFor(homes: number): number {
  return monthlyFor(homes) * 12;
}

/**
 * What a full service management company charges, per home per month.
 *
 * Not our number and not a survey we ran, so it is stated as the published
 * industry range rather than a single figure, and every board can check it
 * against the contract they are already signing. Understating it would be more
 * flattering to us and less useful to them.
 */
export const MANAGEMENT_RANGE_PER_HOME = { low: 10_00, high: 20_00 };

/**
 * Worked examples, at sizes that actually exist.
 *
 * Shown as a table rather than as tiers because there are no tiers: one rate
 * multiplied by the homes. A board finds their own row and stops reading.
 */
export const PRICE_EXAMPLES = [
  { homes: 12, note: "A duplex row or a small court" },
  { homes: 40, note: "A single street" },
  { homes: 88, note: "A common single phase subdivision", highlight: true },
  { homes: 250, note: "A large development" },
];
