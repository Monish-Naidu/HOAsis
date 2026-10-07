import { describe, expect, it } from "vitest";
import {
  balanceStanding,
  liveMeetingLine,
  noticeSummary,
  openNoticesForHome,
} from "@/lib/resident-wording";
import type { Violation } from "@/lib/types";

describe("balanceStanding", () => {
  const home = (
    balanceCents: number,
    standing: "current" | "grace" | "late" | "collections" = "current",
    daysPastDue = 0,
  ) => ({
    balanceCents,
    standing,
    daysPastDue,
  });

  it("says Paid up only for a balance of zero or less", () => {
    expect(balanceStanding(home(0)).label).toBe("Paid up");
    expect(balanceStanding(home(-5000)).label).toBe("Paid up");
    expect(balanceStanding(home(28500)).label).toBe("Not late");
    expect(balanceStanding(home(1)).label).not.toBe("Paid up");
  });

  it("says how late, or collections, when the home is not current", () => {
    expect(balanceStanding(home(28500, "late", 12))).toMatchObject({ tone: "warn" });
    expect(balanceStanding(home(28500, "late", 12)).label).toMatch(/12 days/);
    expect(balanceStanding(home(28500, "collections", 90))).toEqual({
      label: "In collections",
      tone: "danger",
    });
  });
});

const v = (over: Partial<Violation>) =>
  ({
    homeId: "own-1",
    unit: "1",
    stage: "first-notice",
    rule: "Trash bins visible",
    nextActionDate: "2026-09-02",
    ...over,
  }) as Violation;

describe("notices about a home", () => {
  const me = { id: "own-1", unit: "1" };

  it("keeps only open notices addressed to this home", () => {
    const list = [v({}), v({ stage: "cured" }), v({ homeId: "own-2", unit: "2" }), v({ homeId: "own-0" })];
    // The last one is addressed by unit, as after a sale.
    expect(openNoticesForHome(list, me)).toHaveLength(2);
    expect(openNoticesForHome(list, null)).toEqual([]);
  });

  it("names the rule and the next step", () => {
    expect(noticeSummary([v({})])).toEqual({
      title: "A notice about your home",
      detail: "Trash bins visible · next step Sep 2",
    });
    expect(noticeSummary([v({}), v({ rule: "Fence", nextActionDate: "2026-08-30" })])).toEqual({
      title: "2 notices about your home",
      detail: "Fence · next step Aug 30",
    });
  });
});

describe("liveMeetingLine", () => {
  it("prints the joined count only when somebody joined", () => {
    expect(liveMeetingLine(0)).toBe("Meeting on now");
    expect(liveMeetingLine(5)).toBe("Meeting on now · 5 joined");
  });
});
