import { describe, expect, it } from "vitest";
import {
  defaultAssumptions,
  fundingBand,
  percentFunded,
  projectReserves,
  requiredMonthlyContribution,
} from "@/lib/reserves";
import type { ReserveComponent } from "@/lib/types";

const START = 2026;

/** One component, replaced in year three, so the arithmetic is checkable by hand. */
const SIMPLE: ReserveComponent[] = [
  {
    id: "rc-roof",
    name: "Roof",
    usefulLifeYears: 20,
    remainingLifeYears: 3,
    replacementCostCents: 100_000_00,
    fundedCents: 50_000_00,
  },
];

const FLAT = defaultAssumptions({
  openingBalanceCents: 0,
  monthlyContributionCents: 1_000_00,
  apyPercent: 0,
  inflationPercent: 0,
  contributionGrowthPercent: 0,
  years: 5,
});

describe("projectReserves", () => {
  it("projects the requested number of years", () => {
    expect(projectReserves(SIMPLE, FLAT, START).years).toHaveLength(5);
  });

  it("carries each closing balance into the next opening balance", () => {
    const { years } = projectReserves(SIMPLE, FLAT, START);
    for (let i = 1; i < years.length; i++) {
      expect(years[i].openingCents).toBe(years[i - 1].closingCents);
    }
  });

  it("adds twelve monthly contributions a year", () => {
    const { years } = projectReserves(SIMPLE, FLAT, START);
    expect(years[0].contributionsCents).toBe(12_000_00);
    expect(years[0].closingCents).toBe(12_000_00);
  });

  it("spends a component in the year its remaining life runs out", () => {
    const { years } = projectReserves(SIMPLE, FLAT, START);
    expect(years[2].expenditures.map((e) => e.name)).toEqual(["Roof"]);
    expect(years[0].expenditures).toHaveLength(0);
    expect(years[3].expenditures).toHaveLength(0);
  });

  it("finds the first year the balance goes negative", () => {
    // $12k a year for three years is $36k against a $100k roof.
    const projection = projectReserves(SIMPLE, FLAT, START);
    expect(projection.firstShortfallYear).toBe(START + 2);
    expect(projection.years[2].isShortfall).toBe(true);
  });

  it("reports no shortfall when the money is there", () => {
    const funded = projectReserves(
      SIMPLE,
      { ...FLAT, openingBalanceCents: 100_000_00 },
      START,
    );
    expect(funded.firstShortfallYear).toBeNull();
    expect(funded.years.every((y) => !y.isShortfall)).toBe(true);
  });

  it("inflates a replacement to the year it happens", () => {
    const inflated = projectReserves(SIMPLE, { ...FLAT, inflationPercent: 10 }, START);
    // Three years of 10% on $100,000 is $133,100.
    expect(inflated.years[2].expenditures[0].costCents).toBe(133_100_00);
  });

  it("earns interest on the opening balance plus half the year's inflow", () => {
    const earning = projectReserves(
      SIMPLE,
      { ...FLAT, openingBalanceCents: 100_000_00, apyPercent: 10 },
      START,
    );
    // 10% of ($100,000 + $6,000) is $10,600.
    expect(earning.years[0].interestCents).toBe(10_600_00);
  });

  it("grows the contribution each year when the board plans to", () => {
    const growing = projectReserves(SIMPLE, { ...FLAT, contributionGrowthPercent: 10 }, START);
    expect(growing.years[0].contributionsCents).toBe(12_000_00);
    expect(growing.years[1].contributionsCents).toBe(13_200_00);
  });

  it("tracks the low point, which is what a lender asks about", () => {
    const projection = projectReserves(SIMPLE, FLAT, START);
    const lowest = Math.min(...projection.years.map((y) => y.closingCents));
    expect(projection.lowestBalanceCents).toBe(lowest);
  });

  it("totals reconcile with the yearly rows", () => {
    const projection = projectReserves(SIMPLE, FLAT, START);
    expect(projection.totalContributionsCents).toBe(
      projection.years.reduce((sum, y) => sum + y.contributionsCents, 0),
    );
    expect(projection.totalExpendituresCents).toBe(
      projection.years.reduce((sum, y) => sum + y.expenditureCents, 0),
    );
  });

  it("keeps every figure in whole cents", () => {
    const projection = projectReserves(SIMPLE, { ...FLAT, apyPercent: 4.37 }, START);
    for (const year of projection.years) {
      expect(Number.isInteger(year.interestCents)).toBe(true);
      expect(Number.isInteger(year.closingCents)).toBe(true);
    }
  });
});

describe("requiredMonthlyContribution", () => {
  it("leaves a solvent plan alone", () => {
    const solvent = { ...FLAT, openingBalanceCents: 200_000_00 };
    expect(requiredMonthlyContribution(SIMPLE, solvent, START)).toBe(
      solvent.monthlyContributionCents,
    );
  });

  it("finds a contribution that removes the shortfall", () => {
    const required = requiredMonthlyContribution(SIMPLE, FLAT, START);
    const fixed = projectReserves(
      SIMPLE,
      { ...FLAT, monthlyContributionCents: required },
      START,
    );
    expect(fixed.firstShortfallYear).toBeNull();
  });

  it("finds the smallest such contribution, not merely a large one", () => {
    const required = requiredMonthlyContribution(SIMPLE, FLAT, START);
    // A dollar less must fail, or the answer was not minimal.
    const justUnder = projectReserves(
      SIMPLE,
      { ...FLAT, monthlyContributionCents: required - 100 },
      START,
    );
    expect(justUnder.firstShortfallYear).not.toBeNull();
  });

  it("is higher than the current contribution when there is a shortfall", () => {
    expect(requiredMonthlyContribution(SIMPLE, FLAT, START)).toBeGreaterThan(
      FLAT.monthlyContributionCents,
    );
  });
});

describe("percentFunded", () => {
  it("measures against the accrued share, not the full replacement cost", () => {
    // 17 of 20 years used, so the association should have saved 85% of $100k.
    const { accruedLiabilityCents, percent } = percentFunded(SIMPLE, 85_000_00);
    expect(accruedLiabilityCents).toBe(85_000_00);
    expect(percent).toBe(1);
  });

  it("calls a brand new component nothing to have saved for yet", () => {
    const fresh: ReserveComponent[] = [
      { ...SIMPLE[0], remainingLifeYears: 20, usefulLifeYears: 20 },
    ];
    expect(percentFunded(fresh, 0).accruedLiabilityCents).toBe(0);
  });

  it("never reports a negative share for an overdue component", () => {
    const overdue: ReserveComponent[] = [{ ...SIMPLE[0], remainingLifeYears: -5 }];
    const { accruedLiabilityCents } = percentFunded(overdue, 0);
    expect(accruedLiabilityCents).toBe(SIMPLE[0].replacementCostCents);
  });
});

describe("fundingBand", () => {
  it("uses the bands a reserve study uses", () => {
    expect(fundingBand(0.85).label).toBe("Strong");
    expect(fundingBand(0.45).label).toBe("Fair");
    expect(fundingBand(0.12).label).toBe("Weak");
  });

  it("puts the boundaries where the industry puts them", () => {
    expect(fundingBand(0.7).tone).toBe("ok");
    expect(fundingBand(0.699).tone).toBe("warn");
    expect(fundingBand(0.3).tone).toBe("warn");
    expect(fundingBand(0.299).tone).toBe("danger");
  });
});
