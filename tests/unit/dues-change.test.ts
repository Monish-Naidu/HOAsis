import { describe, expect, it } from "vitest";
import {
  duesChangeWords,
  duesTerms,
  homeDues,
  homeDuesChange,
  sameDuesTerms,
  upcomingDuesChange,
} from "@/lib/home-types";
import {
  duesEffectiveProblem,
  DUES_DAY_MESSAGE,
  DUES_DAY_PAST_MESSAGE,
  DUES_DAY_FAR_MESSAGE,
} from "@/lib/input-checks";

/**
 * Dues with a start date: the rate of any day is the stored rate, or the
 * waiting change once the day has come. supabase/migrations/
 * 0117_dues_effective_on.sql makes the same choice when a bill is issued
 * (unit_dues_cents_on), so these selectors and the bills cannot disagree.
 */

const association = {
  duesCents: 28_500,
  duesByType: { condos: 21_000 } as const,
  duesChange: { duesCents: 31_000, effectiveOn: "2027-01-01" },
};

describe("the rate of a day", () => {
  it("is the stored rate before the change's day", () => {
    expect(duesTerms(association, "2026-08-20")).toEqual({
      duesCents: 28_500,
      duesByType: { condos: 21_000 },
    });
  });

  it("is the change on its day and after", () => {
    expect(duesTerms(association, "2027-01-01").duesCents).toBe(31_000);
    expect(duesTerms(association, "2027-06-01").duesCents).toBe(31_000);
  });

  it("is the stored rate when no change is waiting, whatever the day", () => {
    const plain = { duesCents: 28_500 };
    expect(duesTerms(plain, "2030-01-01")).toEqual({ duesCents: 28_500, duesByType: undefined });
  });

  it("carries the change's rates by kind, or clears them for one rate", () => {
    const byKind = {
      duesCents: 28_500,
      duesChange: {
        duesCents: 31_000,
        duesByType: { condos: 24_000 } as const,
        effectiveOn: "2027-01-01",
      },
    };
    expect(duesTerms(byKind, "2027-01-01")).toEqual({
      duesCents: 31_000,
      duesByType: { condos: 24_000 },
    });
    expect(duesTerms(association, "2027-01-01").duesByType).toBeUndefined();
  });
});

describe("a change still to come", () => {
  it("is the change before its day, and nothing on or after it", () => {
    expect(upcomingDuesChange(association, "2026-08-20")?.effectiveOn).toBe("2027-01-01");
    expect(upcomingDuesChange(association, "2027-01-01")).toBeNull();
  });

  it("is nothing when none is waiting", () => {
    expect(upcomingDuesChange({ duesCents: 28_500 }, "2026-08-20")).toBeNull();
  });
});

describe("a coming change as one home feels it", () => {
  it("moves a home that pays the association's rate", () => {
    expect(homeDuesChange(association, { homeType: "townhomes" }, "2026-08-20")).toEqual({
      fromCents: 28_500,
      toCents: 31_000,
      effectiveOn: "2027-01-01",
    });
  });

  it("moves a kind to the change's kind rate", () => {
    const byKind = {
      duesCents: 28_500,
      duesByType: { condos: 21_000 },
      duesChange: {
        duesCents: 31_000,
        duesByType: { condos: 24_000 },
        effectiveOn: "2027-01-01",
      } as const,
    };
    expect(homeDuesChange(byKind, { homeType: "condos" }, "2026-08-20")).toEqual({
      fromCents: 21_000,
      toCents: 24_000,
      effectiveOn: "2027-01-01",
    });
  });

  it("leaves a home with its own amount alone", () => {
    expect(homeDuesChange(association, { duesCents: 20_000 }, "2026-08-20")).toBeNull();
  });

  it("says nothing when the change moves nothing for the home", () => {
    const sameRate = {
      duesCents: 28_500,
      duesChange: { duesCents: 28_500, effectiveOn: "2027-01-01" },
    };
    expect(homeDuesChange(sameRate, { homeType: "townhomes" }, "2026-08-20")).toBeNull();
  });

  it("says nothing once the day has come, because the rate is already the change", () => {
    expect(homeDuesChange(association, { homeType: "townhomes" }, "2027-01-01")).toBeNull();
    // And the rate the home pays is the new one, by the same rule.
    expect(homeDues(duesTerms(association, "2027-01-01"), { homeType: "townhomes" })).toBe(31_000);
  });
});

describe("the one sentence an owner reads", () => {
  it("names the day and the amount", () => {
    expect(duesChangeWords({ toCents: 31_000, effectiveOn: "2027-01-01" }, "2026-08-20")).toBe(
      "From January 1, 2027, dues are $310.",
    );
  });

  it("says today when the change takes effect today", () => {
    expect(duesChangeWords({ toCents: 3_050, effectiveOn: "2026-08-20" }, "2026-08-20")).toBe(
      "From today, dues are $30.50.",
    );
  });
});

describe("the day a change starts", () => {
  it("accepts today and a day within a year", () => {
    expect(duesEffectiveProblem("2026-08-20", "2026-08-20")).toBeNull();
    expect(duesEffectiveProblem("2027-08-20", "2026-08-20")).toBeNull();
  });

  it("refuses the past, the empty box and more than a year out", () => {
    expect(duesEffectiveProblem("2026-08-19", "2026-08-20")).toBe(DUES_DAY_PAST_MESSAGE);
    expect(duesEffectiveProblem("", "2026-08-20")).toBe(DUES_DAY_MESSAGE);
    // A year plus 366 days is the window both sides hold, edge included.
    expect(duesEffectiveProblem("2027-08-21", "2026-08-20")).toBeNull();
    expect(duesEffectiveProblem("2027-08-22", "2026-08-20")).toBe(DUES_DAY_FAR_MESSAGE);
  });
});

describe("whether a form has something new to schedule", () => {
  it("reads the same rates as the same, a community of one rate included", () => {
    // A community that records no kinds of home: the standard rate is the
    // only thing to compare, and a form that re-typed it changes nothing.
    expect(sameDuesTerms({ duesCents: 28_500 }, { duesCents: 28_500 })).toBe(true);
    expect(sameDuesTerms({ duesCents: 29_000 }, { duesCents: 28_500 })).toBe(false);
  });

  it("compares each kind's rate, not the shape of the map", () => {
    const stored = { duesCents: 28_500, duesByType: { condos: 21_000 } as const };
    expect(sameDuesTerms({ duesCents: 28_500, duesByType: { condos: 21_000 } }, stored)).toBe(true);
    expect(sameDuesTerms({ duesCents: 28_500 }, stored)).toBe(false);
    expect(sameDuesTerms({ duesCents: 28_500, duesByType: { condos: 22_000 } }, stored)).toBe(
      false,
    );
  });

  it("holds a kind that pays the standard rate to the same rate either way", () => {
    expect(
      sameDuesTerms({ duesCents: 28_500, duesByType: { condos: 28_500 } }, { duesCents: 28_500 }),
    ).toBe(true);
  });
});
