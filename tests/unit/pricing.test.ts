import { describe, expect, it } from "vitest";
import {
  MANAGEMENT_RANGE_PER_HOME,
  PRICE_EXAMPLES,
  PRICE_PER_HOME_CENTS,
  PRICE_PER_TRANSACTION_CENTS,
  annualFor,
  monthlyFor,
} from "@/lib/pricing";

/**
 * The front page and the pricing page both quote a figure, and they drifted
 * once: the front page went on selling a per door rate months after pricing
 * moved to flat bands, publishing our own price at three times the real one.
 * Both read this module now, so these guard the arithmetic they share.
 */
describe("pricing", () => {
  it("charges per home, per month", () => {
    expect(monthlyFor(1)).toBe(PRICE_PER_HOME_CENTS);
    expect(monthlyFor(88)).toBe(PRICE_PER_HOME_CENTS * 88);
  });

  it("annual is twelve months, not eleven or thirteen", () => {
    expect(annualFor(88)).toBe(monthlyFor(88) * 12);
  });

  it("never charges a negative association", () => {
    // A homes count of zero or below is a bad input, not a refund.
    expect(monthlyFor(0)).toBe(0);
    expect(monthlyFor(-5)).toBe(0);
    expect(annualFor(-5)).toBe(0);
  });

  it("stays whole cents at every size", () => {
    for (const homes of [1, 7, 12, 40, 88, 250, 401]) {
      expect(Number.isInteger(monthlyFor(homes))).toBe(true);
      expect(Number.isInteger(annualFor(homes))).toBe(true);
    }
  });

  it("states the management range as a range, not a single figure", () => {
    // Not our number and not a survey we ran, so it is published as the range
    // a board can check against their own contract.
    expect(MANAGEMENT_RANGE_PER_HOME.low).toBeLessThan(MANAGEMENT_RANGE_PER_HOME.high);
    expect(MANAGEMENT_RANGE_PER_HOME.low).toBeGreaterThan(PRICE_PER_HOME_CENTS);
  });

  it("keeps the worked examples in ascending size with one marked typical", () => {
    const sizes = PRICE_EXAMPLES.map((e) => e.homes);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    expect(PRICE_EXAMPLES.filter((e) => e.highlight)).toHaveLength(1);
  });

  it("charges a flat fee per payment rather than a percentage", () => {
    // The whole argument for it: a fee that does not grow with the assessment.
    expect(PRICE_PER_TRANSACTION_CENTS).toBe(2_00);
  });
});
