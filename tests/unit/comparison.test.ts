import { describe, expect, it } from "vitest";
import { comparisonNote } from "@/lib/comparison";

describe("comparisonNote", () => {
  it("gives the percent change against a real earlier figure", () => {
    expect(comparisonNote(112_000, 100_000)).toBe("+12%");
    expect(comparisonNote(92_000, 100_000)).toBe("-8%");
    expect(comparisonNote(100_000, 100_000)).toBe("+0%");
  });

  it("says nothing when the earlier figure is zero or near it", () => {
    expect(comparisonNote(500_000, 0)).toBeNull();
    expect(comparisonNote(500_000, -100)).toBeNull();
    expect(comparisonNote(500_000, 9_999)).toBeNull();
  });

  it("says nothing for a jump that large, such as +973%", () => {
    expect(comparisonNote(1_073_000, 100_000)).toBeNull();
    expect(comparisonNote(500_000, 100_000)).toBe("+400%");
    expect(comparisonNote(500_001, 100_000)).toBeNull();
  });
});
