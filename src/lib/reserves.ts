import type { Cents, ReserveComponent } from "@/lib/types";

/**
 * Reserve funding model.
 *
 * A reserve balance on its own tells a board almost nothing. The question that
 * matters is whether the money will be there on the day the roof has to be
 * replaced, and the only way to answer it is to run the years forward:
 *
 *   closing = opening + contributions + interest - expenditures
 *
 * Every component has a remaining useful life, so its replacement lands in a
 * known year. Costs inflate; the balance earns interest. Roll that forward and
 * the first year the balance goes negative is the year the association has to
 * levy a special assessment. That year is the single most useful number in HOA
 * finance and almost no software surfaces it.
 *
 * Everything here is integer cents and pure, so it is trivially testable and
 * cannot drift from what the screens show.
 */

export interface ProjectionAssumptions {
  /** Reserve cash on hand at the start of year one. */
  openingBalanceCents: Cents;
  /** What the association transfers into reserves each month. */
  monthlyContributionCents: Cents;
  /** Blended yield on reserve cash, as a percent. 4.6 means 4.60%. */
  apyPercent: number;
  /** Annual construction cost inflation, as a percent. */
  inflationPercent: number;
  /** How far to project. Thirty years is the industry convention. */
  years: number;
  /** Percent the board plans to raise contributions each year. */
  contributionGrowthPercent: number;
}

export interface PlannedExpenditure {
  componentId: string;
  name: string;
  /** Inflated to the year it actually happens. */
  costCents: Cents;
}

export interface ProjectionYear {
  /** Calendar year. */
  year: number;
  /** Years from now, starting at 1. */
  offset: number;
  openingCents: Cents;
  contributionsCents: Cents;
  interestCents: Cents;
  expenditures: PlannedExpenditure[];
  expenditureCents: Cents;
  closingCents: Cents;
  /** True when the year ends owing money the association does not have. */
  isShortfall: boolean;
}

export interface Projection {
  years: ProjectionYear[];
  /** The first year the balance goes negative, or null if it never does. */
  firstShortfallYear: number | null;
  /** The worst point in the projection, which is what a lender asks about. */
  lowestBalanceCents: Cents;
  lowestBalanceYear: number;
  totalContributionsCents: Cents;
  totalInterestCents: Cents;
  totalExpendituresCents: Cents;
}

const DEFAULTS: Pick<
  ProjectionAssumptions,
  "inflationPercent" | "years" | "contributionGrowthPercent"
> = {
  inflationPercent: 3,
  years: 30,
  contributionGrowthPercent: 3,
};

export function defaultAssumptions(
  overrides: Partial<ProjectionAssumptions> & {
    openingBalanceCents: Cents;
    monthlyContributionCents: Cents;
    apyPercent: number;
  },
): ProjectionAssumptions {
  return { ...DEFAULTS, ...overrides };
}

/**
 * Rolls the reserve balance forward year by year.
 *
 * Interest is applied to the opening balance plus half the year's
 * contributions, the standard approximation for money arriving monthly rather
 * than all at once. It is deliberately not compounded monthly: reserve studies
 * are annual documents and a board comparing this to their study should see
 * the same convention.
 */
export function projectReserves(
  components: ReserveComponent[],
  assumptions: ProjectionAssumptions,
  startYear: number,
): Projection {
  const years: ProjectionYear[] = [];
  let balance = assumptions.openingBalanceCents;
  let monthly = assumptions.monthlyContributionCents;

  let lowestBalanceCents = balance;
  let lowestBalanceYear = startYear;
  let firstShortfallYear: number | null = null;
  let totalContributionsCents = 0;
  let totalInterestCents = 0;
  let totalExpendituresCents = 0;

  for (let offset = 1; offset <= assumptions.years; offset++) {
    const year = startYear + offset - 1;
    const opening = balance;

    const contributions = monthly * 12;

    // Interest on the opening balance plus half the year's inflow.
    const averageBalance = opening + contributions / 2;
    const interest = Math.round((averageBalance * assumptions.apyPercent) / 100);

    // Anything whose remaining life runs out this year gets replaced, at a
    // cost inflated from today to then.
    const expenditures: PlannedExpenditure[] = components
      .filter((component) => component.remainingLifeYears === offset)
      .map((component) => ({
        componentId: component.id,
        name: component.name,
        costCents: Math.round(
          component.replacementCostCents *
            Math.pow(1 + assumptions.inflationPercent / 100, offset),
        ),
      }));
    const expenditureCents = expenditures.reduce((sum, e) => sum + e.costCents, 0);

    const closing = opening + contributions + interest - expenditureCents;

    if (closing < 0 && firstShortfallYear === null) firstShortfallYear = year;
    if (closing < lowestBalanceCents) {
      lowestBalanceCents = closing;
      lowestBalanceYear = year;
    }

    totalContributionsCents += contributions;
    totalInterestCents += interest;
    totalExpendituresCents += expenditureCents;

    years.push({
      year,
      offset,
      openingCents: opening,
      contributionsCents: contributions,
      interestCents: interest,
      expenditures,
      expenditureCents,
      closingCents: closing,
      isShortfall: closing < 0,
    });

    balance = closing;
    monthly = Math.round(monthly * (1 + assumptions.contributionGrowthPercent / 100));
  }

  return {
    years,
    firstShortfallYear,
    lowestBalanceCents,
    lowestBalanceYear,
    totalContributionsCents,
    totalInterestCents,
    totalExpendituresCents,
  };
}

/**
 * The smallest monthly contribution that keeps the balance non negative for
 * the whole projection.
 *
 * Solved by bisection rather than algebraically: inflation, interest, and
 * annual contribution growth compound against each other, so there is no
 * clean closed form. Monotonic in the contribution, which is what makes
 * bisection valid, and forty iterations lands well inside a cent.
 */
export function requiredMonthlyContribution(
  components: ReserveComponent[],
  assumptions: ProjectionAssumptions,
  startYear: number,
): Cents {
  const solvent = (monthlyContributionCents: Cents) =>
    projectReserves(components, { ...assumptions, monthlyContributionCents }, startYear)
      .firstShortfallYear === null;

  if (solvent(assumptions.monthlyContributionCents)) {
    return assumptions.monthlyContributionCents;
  }

  let low = assumptions.monthlyContributionCents;
  // Double until solvent, so the search always has a valid upper bound.
  let high = Math.max(low * 2, 100_00);
  let guard = 0;
  while (!solvent(high) && guard++ < 40) high *= 2;

  for (let i = 0; i < 40; i++) {
    const mid = Math.round((low + high) / 2);
    if (solvent(mid)) high = mid;
    else low = mid;
  }
  return high;
}

/**
 * Percent funded: cash on hand against the accrued liability.
 *
 * The liability is not the full replacement cost. It is the share of each
 * component's life already used up, which is what the association should have
 * saved by now. A roof halfway through its life should be half funded.
 */
export function percentFunded(
  components: ReserveComponent[],
  balanceCents: Cents,
): { accruedLiabilityCents: Cents; percent: number; measurable: boolean } {
  const accruedLiabilityCents = components.reduce((sum, component) => {
    const usedYears = component.usefulLifeYears - component.remainingLifeYears;
    const share = Math.max(0, Math.min(1, usedYears / component.usefulLifeYears));
    return sum + Math.round(component.replacementCostCents * share);
  }, 0);

  // An association with no components has not been measured. Reporting 100%
  // would tell a board with nothing saved that it is fully funded, which is
  // the single most dangerous thing this screen could say.
  const measurable = components.length > 0;

  return {
    accruedLiabilityCents,
    percent: !measurable || accruedLiabilityCents === 0 ? 0 : balanceCents / accruedLiabilityCents,
    measurable,
  };
}

/** How a reserve study describes the funding level. */
export function fundingBand(percent: number): {
  label: string;
  tone: "ok" | "warn" | "danger";
  meaning: string;
} {
  if (percent >= 0.7) {
    return {
      label: "Strong",
      tone: "ok",
      meaning: "Special assessments are unlikely. Lenders and buyers see this as healthy.",
    };
  }
  if (percent >= 0.3) {
    return {
      label: "Fair",
      tone: "warn",
      meaning: "Workable, but a large repair arriving early would force a decision.",
    };
  }
  return {
    label: "Weak",
    tone: "danger",
    meaning:
      "Special assessment risk is real. Some lenders decline mortgages in associations funded below 10%.",
  };
}
