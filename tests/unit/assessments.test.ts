import { describe, expect, it } from "vitest";
import { currentDuesPeriod, duesToIssue } from "@/lib/payments/assessments";

describe("currentDuesPeriod", () => {
  it("names the month whose due day has passed", () => {
    expect(currentDuesPeriod({ cadence: "monthly", dueDay: 1, fiscalYearStart: "01-01", today: "2026-10-15" }))
      .toEqual({ dueOn: "2026-10-01", label: "October 2026 dues" });
    expect(currentDuesPeriod({ cadence: "monthly", dueDay: 20, fiscalYearStart: "01-01", today: "2026-10-15" }))
      .toEqual({ dueOn: "2026-09-20", label: "September 2026 dues" });
  });

  it("clamps a due day the month does not have", () => {
    expect(currentDuesPeriod({ cadence: "monthly", dueDay: 31, fiscalYearStart: "01-01", today: "2026-02-28" }).dueOn)
      .toBe("2026-02-28");
  });

  it("counts quarters from the fiscal year start", () => {
    expect(currentDuesPeriod({ cadence: "quarterly", dueDay: 1, fiscalYearStart: "07-01", today: "2026-11-05" }))
      .toEqual({ dueOn: "2026-10-01", label: "Q2 2026 dues" });
  });

  it("bills once a year on the fiscal year start", () => {
    expect(currentDuesPeriod({ cadence: "annually", dueDay: 1, fiscalYearStart: "01-01", today: "2026-06-01" }))
      .toEqual({ dueOn: "2026-01-01", label: "2026 dues" });
  });
});

describe("duesToIssue", () => {
  const base = { cadence: "monthly" as const, dueDay: 1, fiscalYearStart: "01-01", duesCents: 18500, since: "2026-09-23" };

  it("bills on the due day", () => {
    expect(duesToIssue({ ...base, today: "2026-10-01" })?.label).toBe("October 2026 dues");
  });

  it("catches up within a week of a missed day, then stops", () => {
    expect(duesToIssue({ ...base, today: "2026-10-06" })?.dueOn).toBe("2026-10-01");
    expect(duesToIssue({ ...base, today: "2026-10-09" })).toBeNull();
  });

  it("never bills a period from before the association joined", () => {
    expect(duesToIssue({ ...base, today: "2026-09-23" })).toBeNull();
  });

  it("bills nothing when dues are zero", () => {
    expect(duesToIssue({ ...base, duesCents: 0, today: "2026-10-01" })).toBeNull();
  });
});
