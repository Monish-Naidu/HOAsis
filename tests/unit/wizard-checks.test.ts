import { describe, expect, it } from "vitest";
import { emptyDraft } from "@/lib/data/new-community";
import {
  WHOLE_CENTS_MESSAGE,
  anyRangeStartProblem,
  billingStartProblem,
  founderRangeProblem,
  rangeStartProblem,
  usablePhases,
  wholeCentsProblem,
} from "@/app/start/wizard-checks";
import { expandPhases } from "@/lib/lots";
import { firstBillDate } from "@/app/start/books";

const phase = (from: number, to: number) => ({ id: "p1", label: "Phase 1", from, to });

describe("wholeCentsProblem", () => {
  it("refuses a third decimal instead of rounding it", () => {
    expect(wholeCentsProblem("1.999")).toBe(WHOLE_CENTS_MESSAGE);
    expect(wholeCentsProblem("285.555")).toBe(WHOLE_CENTS_MESSAGE);
    expect(wholeCentsProblem("12e3")).toBe(WHOLE_CENTS_MESSAGE);
  });
  it("lets whole cents and an empty box through", () => {
    expect(wholeCentsProblem("2")).toBeNull();
    expect(wholeCentsProblem("1.99")).toBeNull();
    expect(wholeCentsProblem("")).toBeNull();
  });
});

describe("ranges", () => {
  it("refuses a start below 1 and builds nothing from it", () => {
    expect(rangeStartProblem(phase(-3, 0))).toBe("Start at 1 or higher.");
    expect(rangeStartProblem(phase(0, 4))).toBe("Start at 1 or higher.");
    expect(rangeStartProblem(phase(1, 4))).toBeNull();
    // An empty box is a range nobody has started, not a mistake.
    expect(rangeStartProblem(phase(Number.NaN, 4))).toBeNull();
    expect(expandPhases(usablePhases([phase(-3, 0)]), "Lot")).toEqual([]);
  });

  it("flags a draft with a bad start", () => {
    expect(anyRangeStartProblem({ ...emptyDraft(), phases: [phase(-3, 0)] })).toBe(true);
    expect(anyRangeStartProblem({ ...emptyDraft(), phases: [phase(1, 3)] })).toBe(false);
  });

  it("checks the founder's own lot against the ranges", () => {
    const base = { ...emptyDraft(), phases: [phase(1, 32)], lotPrefix: "Lot" };
    const draft = (unit: string) => ({ ...base, founder: { ...base.founder, unit } });
    expect(founderRangeProblem(draft("99"))).toContain("not in these ranges");
    expect(founderRangeProblem(draft("12"))).toBeNull();
    expect(founderRangeProblem(draft("Lot 12"))).toBeNull();
    expect(founderRangeProblem(draft(""))).toBeNull();
    expect(founderRangeProblem({ ...draft("99"), phases: [] })).toBeNull();
  });
});

describe("billingStartProblem", () => {
  const today = "2026-10-15";
  it("accepts a date from this month to two years out", () => {
    expect(billingStartProblem("2026-10-01", today)).toBeNull();
    expect(billingStartProblem("2026-11-01", today)).toBeNull();
    expect(billingStartProblem("2028-10-15", today)).toBeNull();
  });
  it("refuses empty, the past and the far future, with a reason", () => {
    expect(billingStartProblem("", today)).toBe("Pick the date of the first bill.");
    expect(billingStartProblem(null, today)).toBe("Pick the date of the first bill.");
    expect(billingStartProblem("2020-01-01", today)).toBe("Pick a date from this month on.");
    expect(billingStartProblem("2026-09-30", today)).toBe("Pick a date from this month on.");
    expect(billingStartProblem("2099-12-31", today)).toBe("Pick a date within the next 24 months.");
  });
  it("accepts the date the question offers when it was left alone", () => {
    expect(billingStartProblem(firstBillDate(emptyDraft(), today), today)).toBeNull();
  });
});
