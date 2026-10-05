import { describe, expect, it } from "vitest";
import { nextDueOnOrAfter as wizardNextDue } from "@/app/start/books";
import { buildCommunity, emptyDraft, yearElapsedFrom } from "@/lib/data/new-community";
import { nextChargeDateFor } from "@/lib/data/remote";
import { nextDueOnOrAfter } from "@/lib/utils";

/**
 * "Next dues" on a resident's home screen, the date in the board's dues
 * email, and the month autopay starts from are all one figure. It was worked
 * out from the due day alone, so anything billed other than monthly was told
 * next month. These pin it to the dates the daily run actually bills.
 */

describe("nextChargeDateFor", () => {
  const quarterly = { due_day: 1, dues_cadence: "quarterly" as const, fiscal_year_start: "01-01" };
  const annual = { due_day: 1, dues_cadence: "annually" as const, fiscal_year_start: "01-01" };
  const monthly = { due_day: 1, dues_cadence: "monthly" as const, fiscal_year_start: "01-01" };

  it("names the next quarter or year, not next month", () => {
    // Opened 2026-10-04. October's quarter fell due on the 1st; the next
    // bill is January 1, and November 1 is no bill at all.
    expect(nextChargeDateFor("2026-10-04", quarterly)).toBe("2027-01-01");
    expect(nextChargeDateFor("2026-10-04", annual)).toBe("2027-01-01");
    expect(nextChargeDateFor("2026-10-04", monthly)).toBe("2026-11-01");
  });

  it("counts quarters and years from the fiscal year start", () => {
    const july = { due_day: 15, dues_cadence: "quarterly" as const, fiscal_year_start: "07-01" };
    expect(nextChargeDateFor("2026-10-04", july)).toBe("2026-10-15");
    expect(nextChargeDateFor("2026-10-15", july)).toBe("2027-01-15");
    expect(nextChargeDateFor("2026-10-04", { ...july, dues_cadence: "annually" })).toBe("2027-07-15");
  });

  it("looks past a bill that fell due today", () => {
    expect(nextChargeDateFor("2026-10-01", monthly)).toBe("2026-11-01");
    expect(nextChargeDateFor("2026-09-30", monthly)).toBe("2026-10-01");
    expect(nextChargeDateFor("2026-12-31", monthly)).toBe("2027-01-01");
  });

  it("waits for the first bill the board set, and ignores one already past", () => {
    expect(nextChargeDateFor("2026-10-04", { ...quarterly, billing_starts_on: "2027-03-10" })).toBe("2027-04-01");
    expect(nextChargeDateFor("2026-10-04", { ...monthly, billing_starts_on: "2027-01-01" })).toBe("2027-01-01");
    expect(nextChargeDateFor("2026-10-04", { ...monthly, billing_starts_on: "2026-02-01" })).toBe("2026-11-01");
  });

  it("reads a missing fiscal year as the calendar year", () => {
    expect(nextChargeDateFor("2026-10-04", { ...annual, fiscal_year_start: null })).toBe("2027-01-01");
  });
});

describe("nextDueOnOrAfter", () => {
  it("agrees with the wizard's own copy on every cadence, fiscal year and day", () => {
    // The wizard keeps a copy for its first-bill default. Until the two are
    // one function, this is what stops them drifting apart.
    const cadences = ["monthly", "quarterly", "annually"] as const;
    for (const cadence of cadences) {
      for (const fiscal of ["01-01", "04-01", "07-01", "10-01"]) {
        for (const day of [1, 15, 28, 31]) {
          for (const from of ["2026-01-01", "2026-02-28", "2026-06-16", "2026-10-04", "2026-12-31"]) {
            expect(nextDueOnOrAfter(from, day, cadence, fiscal)).toBe(wizardNextDue(from, day, cadence, fiscal));
          }
        }
      }
    }
  });
});

describe("a demo association's next charge", () => {
  const draft = {
    ...emptyDraft(),
    name: "Ridgeline",
    city: "Bothell",
    founder: { name: "Pat", email: "pat@example.com", unit: "1" },
  };

  it("follows the cadence it was set up with", () => {
    expect(buildCommunity({ ...draft, duesCadence: "quarterly" }, "2026-10-04").nextChargeDate).toBe("2027-01-01");
    expect(buildCommunity({ ...draft, duesCadence: "annually" }, "2026-10-04").nextChargeDate).toBe("2027-01-01");
    expect(buildCommunity({ ...draft, duesCadence: "monthly", dueDay: 15 }, "2026-10-04").nextChargeDate).toBe("2026-10-15");
    expect(buildCommunity({ ...draft, duesCadence: "monthly", dueDay: 4 }, "2026-10-04").nextChargeDate).toBe("2026-11-04");
  });
});

describe("yearElapsedFrom", () => {
  it("counts from the fiscal year's first month", () => {
    // Fiscal year from July, read on October 4: three months and four days
    // in, about a quarter. The calendar month over twelve said 83%.
    expect(yearElapsedFrom("07-01", "2026-10-04")).toBeCloseTo((3 + 4 / 30) / 12, 10);
    expect(yearElapsedFrom("07-01", "2026-10-04")).toBeCloseTo(0.26, 2);
    expect(yearElapsedFrom("07-01", "2026-06-30")).toBe(1);
    expect(yearElapsedFrom("10-01", "2026-10-01")).toBeCloseTo(1 / 360, 10);
  });

  it("leaves a calendar year where it was", () => {
    expect(yearElapsedFrom("01-01", "2026-08-20")).toBeCloseTo((7 + 20 / 30) / 12, 10);
    expect(yearElapsedFrom("01-01", "2026-01-15")).toBeCloseTo(0.5 / 12, 10);
  });
});
