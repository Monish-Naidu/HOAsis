import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import {
  dashboardFirstSteps,
  duesCollection,
  duesPace,
  duesPaceLines,
  ledgerFilterCounts,
  meetingStatus,
  nextMeeting,
  oldestPastDueDays,
  pastDueLine,
  periodRange,
  reserveLine,
  runwayLine,
  thisMonthLine,
  widerPeriod,
} from "@/lib/metrics";

/**
 * The line under each dashboard number. Every one is a pure function of the
 * community, so the same fixtures the demo serves can pin the wording.
 */
const c = mehrMeadows;

/** A new association: nothing on the books, no homes, no bank. */
const empty: Community = {
  ...c,
  homes: [],
  bankAccounts: [],
  ledger: [],
  meetings: [],
  homeCharges: {},
  reserveComponents: [],
  recentDuesBill: undefined,
};

describe("cash and reserves", () => {
  it("says how many months of running costs the operating account covers", () => {
    expect(runwayLine(c, c.asOf)).toMatch(/^\d+(\.\d)? months of running costs$/);
  });

  it("says nothing when there is no spending to measure against", () => {
    expect(runwayLine(empty, empty.asOf)).toBeNull();
  });

  it("puts the reserve balance and percent funded on one line", () => {
    expect(reserveLine(c)).toMatch(/^Reserves \$[\d,]+ · \d+% funded$/);
  });

  it("leaves the percent off without a reserve study, and the line off without a balance", () => {
    const noStudy = { ...c, reserveComponents: [] };
    expect(reserveLine(noStudy)).toMatch(/^Reserves \$[\d,]+$/);
    expect(reserveLine(empty)).toBeNull();
  });
});

describe("past due", () => {
  it("names the homes, the dollars and the oldest balance", () => {
    expect(pastDueLine(c)).toMatch(/^\d+ homes? · \$[\d,]+ · oldest \d+ days?$/);
    expect(oldestPastDueDays(c)).toBe(Math.max(...c.homes.map((o) => o.daysPastDue)));
  });

  it("says everyone is current when nobody is behind", () => {
    const current = { ...c, homes: c.homes.map((o) => ({ ...o, daysPastDue: 0, balanceCents: 0 })) };
    expect(pastDueLine(current)).toBe("Everyone is current");
  });
});

describe("dues pace", () => {
  it("is on pace at or above 95% of what was billed so far, behind below", () => {
    expect(duesPace({ measurable: true, rate: 0.95 })).toBe("on");
    expect(duesPace({ measurable: true, rate: 0.949 })).toBe("behind");
  });

  it("has no pace when nothing is billed", () => {
    expect(duesPace({ measurable: false, rate: 0 })).toBeNull();
  });

  it("reads the demo's year from its own collection", () => {
    const dues = duesCollection(c, 2026);
    expect(duesPaceLines(c, 2026)[0]).toBe(dues.rate >= 0.95 ? "On pace" : "Behind pace");
  });

  it("says when this month's bill posts, if it has not", () => {
    // Statements on hand with no line in the as-of month: the bill has not posted.
    const asOf = "2026-10-06";
    const lines = duesPaceLines({ ...c, asOf }, 2026, asOf);
    expect(lines.some((l) => /^October bill posts on the \d+(st|nd|rd|th)$/.test(l))).toBe(true);
  });
});

describe("next meeting", () => {
  it("counts yes answers and says whether notice went out", () => {
    const m = {
      noticeSentDate: "2026-08-01",
      rsvps: [
        { name: "A", unit: "1", response: "yes" as const, at: "2026-08-02" },
        { name: "B", unit: "2", response: "yes" as const, at: "2026-08-02" },
        { name: "C", unit: "3", response: "no" as const, at: "2026-08-02" },
      ],
    };
    expect(meetingStatus(m)).toEqual({ coming: 2, noticeSent: true, line: "2 coming · notice sent" });
  });

  it("flags a notice that has not gone out, and no answers yet", () => {
    expect(meetingStatus({}).line).toBe("No RSVPs yet · Notice not sent");
  });

  it("is the live meeting first, then the soonest to come, and undefined with none", () => {
    expect(nextMeeting(empty)).toBeUndefined();
    const base = c.meetings[0];
    const mk = (id: string, date: string, status: "scheduled" | "live" | "ended") => ({ ...base, id, date, status });
    const meetings = [mk("far", "2026-09-30", "scheduled"), mk("soon", "2026-08-25", "scheduled"), mk("past", "2026-08-01", "scheduled")];
    expect(nextMeeting({ ...c, meetings })?.id).toBe("soon");
    expect(nextMeeting({ ...c, meetings: [...meetings, mk("now", "2026-08-20", "live")] })?.id).toBe("now");
  });
});

describe("this month sentence", () => {
  it("builds the month from the records", () => {
    const line = thisMonthLine(c)!;
    expect(line).toMatch(/^August: billed \$[\d,]+ on the 1st, \$[\d,]+ collected so far \(\d+%\), autopay covers \d+ homes, reminders go out on the 16th\.$/);
    const homes = c.homes.filter((o) => !o.placeholder && o.autopay).length;
    expect(line).toContain(`autopay covers ${homes} homes`);
  });

  it("uses the reminder day the policy sets", () => {
    const sooner = { ...c, settings: { ...c.settings, collectionPolicy: { reminderDay: 5, lateNoticeDay: 30, demandDay: 45, counselDay: 90, lateFeeCents: 0, minimumPlanMonths: 12 } } };
    expect(thisMonthLine(sooner)).toContain("reminders go out on the 6th");
  });

  it("says the bill has not posted when it has not", () => {
    const asOf = "2026-10-06";
    expect(thisMonthLine({ ...c, asOf }, asOf)).toMatch(/^October: the bill of \$[\d,]+ posts on the 1st, /);
  });

  it("has nothing to say for an association with no homes", () => {
    expect(thisMonthLine(empty)).toBeNull();
  });
});

describe("a new association's cards", () => {
  it("says what to do first on each", () => {
    expect(dashboardFirstSteps(empty)).toEqual({
      cash: "Add your bank account to see your balance",
      owed: "Add your homes to see what is owed",
      dues: expect.stringMatching(/^(Set the dues amount|Add your homes) to see how collection is going$/),
    });
  });

  it("asks for the dues amount before the homes when there is none", () => {
    const noDues = { ...empty, association: { ...empty.association, duesCents: 0 } };
    expect(dashboardFirstSteps(noDues).dues).toBe("Set the dues amount to see how collection is going");
    const dues = { ...empty, association: { ...empty.association, duesCents: 25000 } };
    expect(dashboardFirstSteps(dues).dues).toBe("Add your homes to see how collection is going");
  });

  it("has nothing to say once there is something to read", () => {
    expect(dashboardFirstSteps(c)).toEqual({ cash: null, owed: null, dues: null });
  });
});

describe("transactions defaults", () => {
  it("the last 30 days count today, so the first of the month is not empty", () => {
    expect(periodRange("last-30-days", "2026-10-01")).toEqual({ from: "2026-09-02", to: "2026-10-01" });
  });

  it("offers the next wider period, and none past a year", () => {
    expect(widerPeriod("this-month")).toBe("this-year");
    expect(widerPeriod("last-30-days")).toBe("last-12-months");
    expect(widerPeriod("last-12-months")).toBeNull();
    expect(widerPeriod("last-year")).toBeNull();
  });

  it("counts each status and category as picking it would show", () => {
    const all = { from: "1900-01-01", to: "2999-12-31" };
    const counts = ledgerFilterCounts(c.ledger, all);
    expect(counts.status.any).toBe(c.ledger.length);
    expect(counts.status["needs-review"]).toBe(c.ledger.filter((e) => e.status === "needs-review").length);
    expect(counts.categoryAll).toBe(c.ledger.length);
    // A status already chosen does not zero the other statuses' counts.
    const narrowed = ledgerFilterCounts(c.ledger, { ...all, status: "cleared" });
    expect(narrowed.status["needs-review"]).toBe(counts.status["needs-review"]);
    // But it does narrow the categories.
    expect(narrowed.categoryAll).toBe(counts.status.cleared);
  });
});
