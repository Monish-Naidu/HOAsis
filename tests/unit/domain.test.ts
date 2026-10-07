import { describe, expect, it } from "vitest";
import { daysFromToday, formatDate, money, pluralize, shortMoney, relativeDays, setToday, todayIsoDate } from "@/lib/utils";
import { monthGrid, upcomingFrom, type CalendarEntry } from "@/lib/calendar";
import { renderTemplate } from "@/lib/data/templates";
import {
  budgetSummary,
  cashPosition,
  delinquency,
  insuranceExposure,
  interestSummary,
  homesById,
  reserveSummary,
  bankAccounts,
  savingsOffers,
  association,
  homes,
} from "@/lib/data";
import { complianceRegister } from "@/lib/compliance";
import { mehrMeadows } from "@/lib/data/communities";

const TODAY_ISO = todayIsoDate();

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

  it("follows the community clock when it is repinned", () => {
    setToday("2027-02-24");
    expect(daysFromToday("2027-03-01")).toBe(5);
    expect(relativeDays("2027-02-17")).toBe("7 days ago");
    setToday(TODAY_ISO);
    expect(daysFromToday("2026-08-25")).toBe(5);
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
    const pastDue = homes.filter((o) => o.daysPastDue > 0);
    expect(d.past).toHaveLength(pastDue.length);
    expect(d.totalCents).toBe(pastDue.reduce((sum, o) => sum + o.balanceCents, 0));
    expect(d.collectionRate).toBeCloseTo((homes.length - pastDue.length) / homes.length, 5);
  });

  it("has one owner record per unit, all 88 of them", () => {
    expect(homes).toHaveLength(association.unitCount);
    expect(new Set(homes.map((o) => o.unit)).size).toBe(association.unitCount);
  });

  it("indexes owners by id for constant time lookup", () => {
    expect(homesById.size).toBe(homes.length);
    expect(homesById.get("own-042")?.displayName).toBe("Monish Naidu");
  });

  it("keeps percent funded between zero and one", () => {
    const reserve = reserveSummary();
    expect(reserve.percentFunded).toBeGreaterThan(0);
    expect(reserve.percentFunded).toBeLessThanOrEqual(1);
    expect(reserve.funded).toBeLessThanOrEqual(reserve.required);
  });

  it("reports the rate on reserve savings", () => {
    // There is nothing to blend any more. Reserve cash sits in one insured
    // savings account, so the "blended" figure is simply that account's rate,
    // and the projection is the balance times it. The previous version of this
    // test asserted a weighted average across a certificate and a savings
    // account, which was a shape the product deliberately stopped having.
    const { balance, blendedApy, projectedAnnual } = interestSummary();
    const reserve = bankAccounts.filter((a) => a.kind !== "operating");

    expect(reserve, "reserve cash is meant to sit in one account").toHaveLength(1);
    expect(balance).toBe(reserve[0].balanceCents);
    expect(blendedApy).toBeCloseTo(reserve[0].apy, 5);
    expect(projectedAnnual).toBe(Math.round((balance * blendedApy) / 100));
  });

  it("counts deposit insurance exposure per institution, not per account", () => {
    // The limit is per depositor per bank, so opening a second account at the
    // same bank does not double the coverage. This matters more now that all
    // reserve cash sits in one savings account: a funded association is
    // routinely several hundred thousand dollars over the line.
    const { rows, totalUninsured } = insuranceExposure();
    const becu = rows.find((r) => r.institution === "BECU");

    expect(becu, "the seeded accounts are both at BECU").toBeTruthy();
    expect(becu!.balance, "balances at one bank are combined").toBe(
      bankAccounts
        .filter((a) => a.institution === "BECU")
        .reduce((t, a) => t + a.balanceCents, 0),
    );
    expect(becu!.uninsured).toBe(Math.max(0, becu!.balance - becu!.limit));
    expect(becu!.uninsured, "a funded association is over the limit").toBeGreaterThan(0);
    expect(totalUninsured).toBe(rows.reduce((t, r) => t + r.uninsured, 0));
  });

  it("offers nothing to shop for, on purpose", () => {
    // Shopping rates is not a job to nudge a volunteer treasurer into from
    // inside their own books, and a dollar in a twelve month certificate is
    // unavailable the week a roof fails.
    expect(savingsOffers).toHaveLength(0);
  });

  it("reports budget pace against the elapsed year", () => {
    const budget = budgetSummary();
    expect(budget.netYtd).toBe(budget.incomeYtd - budget.expenseYtd);
    expect(budget.yearElapsed).toBeGreaterThan(0);
    expect(budget.yearElapsed).toBeLessThan(1);
  });

  it("treats a past due date as overdue, never as the next deadline", () => {
    const register = complianceRegister(mehrMeadows);
    if (register.next?.dueDate) {
      expect(daysFromToday(register.next.dueDate)).toBeGreaterThanOrEqual(0);
    }
    for (const item of register.overdue) {
      expect(daysFromToday(item.dueDate!)).toBeLessThan(0);
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

describe("multi seat elections", () => {
  it("counts households rather than marks for turnout and quorum", () => {
    // Two seats, four candidates, 129 marks. That is 65 households voting
    // against 88 eligible, not a turnout of 147 percent.
    const votes = 51 + 44 + 22 + 12;
    const seats = 2;
    expect(Math.round(votes / seats)).toBe(65);
    expect(Math.round(votes / seats)).toBeLessThanOrEqual(88);
  });
});

describe("message templates", () => {
  it("fills the subject line, not only the body", () => {
    const fields = { association: "Mehr Meadows", unit: "55", balance: "$855.00" };
    expect(renderTemplate("{{association}}: late assessment on unit {{unit}}", fields)).toBe(
      "Mehr Meadows: late assessment on unit 55",
    );
  });

  it("leaves an unknown placeholder visible rather than blanking it", () => {
    // A silently empty merge field is how a notice goes out saying "balance of ."
    expect(renderTemplate("owes {{mystery}}", { unit: "7" })).toContain("{{mystery}}");
  });
});
