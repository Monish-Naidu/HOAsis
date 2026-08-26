/**
 * What HOAsis charges, in one place.
 *
 * The pricing page and the front page both quote a figure, and they drifted
 * once already: the front page was still selling a per door rate months after
 * pricing moved to flat bands, which put our own price three times higher than
 * it actually is. Both now read this.
 *
 * Flat bands rather than per door because that is how this market prices, and
 * because a board comparing two products is comparing one monthly number to
 * another. Per door is a management company convention, and a board looking at
 * us has already decided to leave one of those.
 */

export interface PricingTier {
  name: string;
  /** Inclusive upper bound. The last band is open ended above `maxHomes`. */
  maxHomes: number;
  monthlyCents: number;
  homes: string;
  note: string;
  highlight?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Small",
    maxHomes: 25,
    monthlyCents: 39_00,
    homes: "Up to 25 homes",
    note: "Cheaper than anyone else at this size. Same product as the largest plan.",
  },
  {
    name: "Standard",
    maxHomes: 75,
    monthlyCents: 69_00,
    homes: "26 to 75 homes",
    note: "The most common size for a self-managed association.",
    highlight: true,
  },
  {
    name: "Large",
    maxHomes: 150,
    monthlyCents: 109_00,
    homes: "76 to 150 homes",
    note: "Where reserve planning starts to carry real money.",
  },
  {
    name: "Very large",
    maxHomes: 400,
    monthlyCents: 179_00,
    homes: "151 to 400 homes",
    note: "Above 400 homes, talk to us and we will quote it.",
  },
];

/** The band an association of this size falls into. */
export function tierFor(homes: number): PricingTier {
  return PRICING_TIERS.find((t) => homes <= t.maxHomes) ?? PRICING_TIERS[PRICING_TIERS.length - 1];
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
 * Payment costs, published because they are checkable.
 *
 * PayHOA's own help pages state $2.45 per bank payment and 3.50% plus 50 cents
 * on cards. Stripe publishes 2.9% plus 30 cents. A board can verify all of
 * this without asking us, which is the point of printing it.
 */
export const PAYMENT_COSTS = {
  achCents: 2_35,
  cardPercent: 2.9,
  cardFixedCents: 30,
};
