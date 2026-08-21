import { describe, expect, it } from "vitest";
import { daysFromToday, formatDate, money, pluralize, shortMoney, TODAY } from "@/lib/utils";
import { monthGrid, upcomingFrom, type CalendarEntry } from "@/lib/calendar";
import {
  budgetSummary,
  cashPosition,
  complianceSummary,
  delinquency,
  insuranceExposure,
  interestSummary,
  ownersById,
  reserveSummary,
  yieldOpportunity,
  association,
  owners,
} from "@/lib/data";

const TODAY_ISO = TODAY.toISOString().slice(0, 10);

describe("money formatting", () => {
  it("renders integer cents as currency", () => {
    expect(money(28_500)).toBe("$285.00");
    expect(money(28_500, { cents: false })).toBe("$285");
  });

  it("marks negatives and optional positives", () => {
    expect(money(-1_00)).toBe("-$1.00");
    expect(money(1_00, { sign: true })).toBe("+$1.00");
  });

  it("abbreviates large figures without lying about the magnitude", () => {
    expect(shortMoney(56_286_000)).toBe("$563k");
    expect(shortMoney(150_000_00)).toBe("$150k");
    expect(shortMoney(1_50)).toBe("$2");
  });
});

describe("dates", () => {
  it("is pinned so the demo reads the same on every machine", () => {
    expect(TODAY_ISO).toBe("2026-08-20");
  });

  it("measures distance from the pinned today", () => {
    expect(daysFromToday("2026-08-25")).toBe(5);
    expect(daysFromToday("2026-08-15")).toBe(-5);
  });

  it("formats without drifting a day across time zones", () => {
    expect(formatDate("2026-09-01", "long")).toBe("September 1, 2026");
  });
});

describe("pluralize", () => {
  it("agrees with its count", () => {
    expect(pluralize(1, "account")).toBe("1 account");
    expect(pluralize(2, "account")).toBe("2 accounts");
  });
});

describe("association arithmetic", () => {
  it("splits cash into operating and reserve, and the parts sum to the whole", () => {
    const cash = cashPosition();
    expect(cash.operating + cash.reserve).toBe(cash.total);
    expect(cash.total).toBeGreaterThan(0);
  });

  it("derives the collection rate from the roster rather than a constant", () => {
    const d = delinquency();
    const pastDue = owners.filter((o) => o.daysPastDue > 0);
    expect(d.past).toHaveLength(pastDue.length);
    expect(d.totalCents).toBe(pastDue.reduce((sum, o) => sum + o.balanceCents, 0));
    expect(d.collectionRate).toBeCloseTo((owners.length - pastDue.length) / owners.length, 5);
  });

  it("has one owner record per unit, all 88 of them", () => {
    expect(owners).toHaveLength(association.unitCount);
    expect(new Set(owners.map((o) => o.unit)).size).toBe(association.unitCount);
  });

  it("indexes owners by id for constant time lookup", () => {
    expect(ownersById.size).toBe(owners.length);
    expect(ownersById.get("own-042")?.displayName).toBe("Monish Naidu");
  });

  it("keeps percent funded between zero and one", () => {
    const reserve = reserveSummary();
    expect(reserve.percentFunded).toBeGreaterThan(0);
    expect(reserve.percentFunded).toBeLessThanOrEqual(1);
    expect(reserve.funded).toBeLessThanOrEqual(reserve.required);
  });

  it("blends reserve yield by balance, not by a simple average", () => {
    const { blendedApy, balance, projectedAnnual } = interestSummary();
    expect(blendedApy).toBeGreaterThan(0);
    // A simple average of 1.20 and 4.25 would be 2.725. Weighting by the much
    // larger savings balance has to pull it well below that.
    expect(blendedApy).toBeLessThan(2.725);
    expect(projectedAnnual).toBe(Math.round((balance * blendedApy) / 100));
  });

  it("flags only the balance above the insured limit at a single institution", () => {
    const exposure = insuranceExposure();
    for (const row of exposure.rows) {
      expect(row.uninsured).toBe(Math.max(0, row.balance - row.limit));
    }
    expect(exposure.totalUninsured).toBeGreaterThan(0);
  });

  it("prices the yield opportunity off the movable savings balance", () => {
    const opportunity = yieldOpportunity();
    const expected = Math.round(
      (opportunity.movable * (opportunity.recommended.apy - opportunity.current!.apy)) / 100,
    );
    expect(opportunity.gainAnnual).toBe(expected);
    expect(opportunity.gainAnnual).toBeGreaterThan(0);
  });

  it("reports budget pace against the elapsed year", () => {
    const budget = budgetSummary();
    expect(budget.netYtd).toBe(budget.incomeYtd - budget.expenseYtd);
    expect(budget.yearElapsed).toBeGreaterThan(0);
    expect(budget.yearElapsed).toBeLessThan(1);
  });

  it("treats a past due date as overdue, never as the next deadline", () => {
    const comp = complianceSummary();
    if (comp.nextDeadline?.dueDate) {
      expect(daysFromToday(comp.nextDeadline.dueDate)).toBeGreaterThanOrEqual(0);
    }
    for (const item of comp.overdue) {
      if (item.dueDate) expect(daysFromToday(item.dueDate)).toBeLessThan(0);
    }
  });
});

describe("calendar grid", () => {
  const entries: CalendarEntry[] = [
    { id: "a", date: "2026-08-20", title: "Today", kind: "meeting" },
    { id: "b", date: "2026-09-03", title: "Next month", kind: "event" },
  ];

  it("always renders six weeks so the layout never jumps between months", () => {
    expect(monthGrid(2026, 7, entries, TODAY_ISO)).toHaveLength(42);
  });

  it("starts on the Sunday on or before the first of the month", () => {
    const grid = monthGrid(2026, 7, entries, TODAY_ISO);
    expect(new Date(`${grid[0].date}T12:00:00Z`).getUTCDay()).toBe(0);
  });

  it("marks the current day and attaches entries to their date", () => {
    const grid = monthGrid(2026, 7, entries, TODAY_ISO);
    const today = grid.find((cell) => cell.date === "2026-08-20");
    expect(today?.isToday).toBe(true);
    expect(today?.entries).toHaveLength(1);
  });

  it("distinguishes days inside the month from the padding around it", () => {
    const grid = monthGrid(2026, 7, entries, TODAY_ISO);
    expect(grid.filter((cell) => cell.inMonth)).toHaveLength(31);
  });

  it("lists what is still ahead, soonest first", () => {
    const upcoming = upcomingFrom(entries, TODAY_ISO);
    expect(upcoming.map((e) => e.id)).toEqual(["a", "b"]);
    expect(upcomingFrom(entries, "2026-08-21")).toHaveLength(1);
  });
});
