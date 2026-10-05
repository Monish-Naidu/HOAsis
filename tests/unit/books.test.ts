import { describe, expect, it } from "vitest";
import { emptyDraft } from "@/lib/data/new-community";
import {
  booksOf,
  extrasOf,
  householdsNeedingBooks,
  nextDueOnOrAfter,
  withBooks,
  wallToday,
  withExtras,
} from "@/app/start/books";

describe("nextDueOnOrAfter", () => {
  it("finds the next monthly due day, this month if it has not passed", () => {
    expect(nextDueOnOrAfter("2026-09-26", 1, "monthly", "01-01")).toBe("2026-10-01");
    expect(nextDueOnOrAfter("2026-09-01", 1, "monthly", "01-01")).toBe("2026-09-01");
    expect(nextDueOnOrAfter("2026-09-10", 15, "monthly", "01-01")).toBe("2026-09-15");
  });

  it("counts quarters and years from the fiscal year", () => {
    expect(nextDueOnOrAfter("2026-09-26", 1, "quarterly", "01-01")).toBe("2026-10-01");
    expect(nextDueOnOrAfter("2026-09-26", 1, "quarterly", "07-01")).toBe("2026-10-01");
    expect(nextDueOnOrAfter("2026-08-02", 1, "quarterly", "07-01")).toBe("2026-10-01");
    expect(nextDueOnOrAfter("2026-09-26", 1, "annually", "01-01")).toBe("2027-01-01");
    expect(nextDueOnOrAfter("2026-09-26", 1, "annually", "10-01")).toBe("2026-10-01");
  });

  it("clamps the due day to the 28th", () => {
    expect(nextDueOnOrAfter("2026-02-01", 31, "monthly", "01-01")).toBe("2026-02-28");
  });
});

describe("books on the draft", () => {
  it("defaults to a calendar year, billing from founding, balances as of today", () => {
    expect(booksOf(emptyDraft(), "2026-09-26")).toEqual({
      fiscalYearStart: "01-01",
      billingStartsOn: null,
      openingAsOf: "2026-09-26",
    });
  });

  it("survives a round trip through JSON, which is how the wizard saves progress", () => {
    const draft = withBooks(emptyDraft(), { fiscalYearStart: "07-01", billingStartsOn: "2026-11-01", openingAsOf: "2026-09-20" });
    const back = JSON.parse(JSON.stringify(draft));
    expect(booksOf(back, "2026-09-26").fiscalYearStart).toBe("07-01");
    expect(booksOf(back, "2026-09-26").billingStartsOn).toBe("2026-11-01");
  });

  it("keeps a phone and an opening balance on a household without the draft knowing", () => {
    const home = withExtras({ name: "Pat", email: "", unit: "12" }, { phone: "425-555-0114", openingBalanceCents: 18500 });
    expect(home.unit).toBe("12");
    expect(extrasOf(home)).toEqual({ phone: "425-555-0114", openingBalanceCents: 18500 });
  });

  it("lists only the homes the follow-up call has something to say about", () => {
    const draft = {
      ...emptyDraft(),
      households: [
        withExtras({ name: "A", email: "", unit: "1" }, { openingBalanceCents: 0 }),
        withExtras({ name: "B", email: "", unit: "2" }, { phone: "1" }),
        { name: "C", email: "", unit: "3" },
        withExtras({ name: "D", email: "", unit: "" }, { openingBalanceCents: 5 }),
      ],
    };
    expect(householdsNeedingBooks(draft).map((h) => h.unit)).toEqual(["1", "2"]);
  });
});

describe("wallToday", () => {
  it("is the date on the person's own clock, not the UTC date", () => {
    // 8:30 pm on the 4th wherever this runs. In a US time zone the UTC date
    // is already the 5th, which is what the form used to offer.
    expect(wallToday(new Date(2026, 9, 4, 20, 30))).toBe("2026-10-04");
    expect(wallToday(new Date(2026, 9, 4, 0, 5))).toBe("2026-10-04");
    expect(wallToday(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("pads the month and the day", () => {
    expect(wallToday(new Date(2026, 0, 3, 12))).toBe("2026-01-03");
  });

  it("makes a first bill suggestion that is not a day ahead on a US evening", () => {
    const today = wallToday(new Date(2026, 9, 1, 21, 0));
    expect(nextDueOnOrAfter(today, 1, "monthly", "01-01")).toBe("2026-10-01");
  });
});
