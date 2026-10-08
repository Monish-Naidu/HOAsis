import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import type { ChargeLine } from "@/lib/types";
import {
  agingBuckets,
  budgetVariance,
  compareYears,
  delinquency,
  duesCollection,
  filterLedger,
  invoiceAddress,
  lateFeesOwed,
  isIsoDate,
  firstMoneyOn,
  ledgerSide,
  ledgerTotals,
  ledgerYears,
  monthlyFlows,
  netByYear,
  operatingRunway,
  periodRange,
  periodWords,
  stepPeriod,
  fiscalMonth,
  spendingBetween,
  vendorDecisions,
  yearSummary,
} from "@/lib/metrics";

/**
 * The year comparison exists so two screens cannot disagree about a delta.
 * These pin the arithmetic to the flows every other chart is drawn from.
 */
describe("compareYears", () => {
  const c = mehrMeadows;

  it("has more than one year to compare, or the trends page is empty", () => {
    expect(ledgerYears(c).length).toBeGreaterThanOrEqual(3);
    expect(ledgerYears(c)).toContain(2024);
    expect(ledgerYears(c)).toContain(2025);
  });

  it("sums a full year exactly as monthlyFlows does", () => {
    const flows = monthlyFlows(c, 2025);
    const s = yearSummary(c, 2025);
    expect(s.incomeCents).toBe(flows.reduce((t, m) => t + m.inCents, 0));
    expect(s.spendCents).toBe(flows.reduce((t, m) => t + m.outCents, 0));
    expect(s.netCents).toBe(s.incomeCents - s.spendCents);
    expect(s.monthsWithData).toBe(12);
    expect(s.throughMonth).toBe(12);
  });

  it("cuts both years at the same month when one is partial", () => {
    const cmp = compareYears(c, 2025, 2026);
    expect(cmp.partial).toBe(true);
    expect(cmp.throughMonth).toBe(8);
    expect(cmp.months).toHaveLength(8);
    // The left side is January to August of 2025, not the whole year.
    expect(cmp.a.incomeCents).toBeLessThan(cmp.fullA.incomeCents);
    expect(cmp.a.incomeCents).toBe(yearSummary(c, 2025, 8).incomeCents);
  });

  it("reports deltas as right minus left, with the percent against the left", () => {
    const cmp = compareYears(c, 2024, 2025);
    expect(cmp.partial).toBe(false);
    expect(cmp.income.cents).toBe(cmp.b.incomeCents - cmp.a.incomeCents);
    expect(cmp.income.percent).toBeCloseTo(cmp.income.cents / cmp.a.incomeCents, 10);
    expect(cmp.net.cents).toBe(cmp.income.cents - cmp.spend.cents);
    // The fixture is built so the story reads: 2025 ran above 2024.
    expect(cmp.income.cents).toBeGreaterThan(0);
  });

  it("keeps reserve transfers out of income and spend, and counts them once", () => {
    const s = yearSummary(c, 2024);
    const operatingSide = c.ledger
      .filter((e) => e.category === "Reserve transfer" && e.amountCents < 0 && e.date.startsWith("2024"))
      .reduce((t, e) => t - e.amountCents, 0);
    expect(s.reserveCents).toBe(operatingSide);
    expect(s.reserveCents).toBeGreaterThan(0);
    // The year comparison leaves them out as well; the headline and the
    // spending list already did, and the comparison showed them as the
    // biggest category.
    const cmp = compareYears(c, 2024, 2025);
    expect(cmp.categories.map((r) => r.category)).not.toContain("Reserve contributions");
    expect(cmp.categories.map((r) => r.category)).not.toContain("Reserve transfer");
  });

  it("gives every category the same change arithmetic as the headline", () => {
    const cmp = compareYears(c, 2024, 2025);
    const spendA = cmp.categories.reduce((t, r) => t + r.aCents, 0);
    expect(spendA).toBe(cmp.a.spendCents);
    for (const row of cmp.categories) {
      expect(row.change.cents).toBe(row.bCents - row.aCents);
    }
  });

  it("orders the multi-year trend oldest first and flags the partial year", () => {
    const rows = netByYear(c);
    expect(rows.map((r) => r.year)).toEqual([...rows.map((r) => r.year)].sort((a, b) => a - b));
    expect(rows.find((r) => r.year === 2026)?.partial).toBe(true);
    expect(rows.find((r) => r.year === 2025)?.partial).toBe(false);
  });
});

describe("agingBuckets", () => {
  const c = mehrMeadows;

  it("partitions the roster: counts sum to every household, cents to every balance", () => {
    const aging = agingBuckets(c);
    expect(aging.buckets.map((b) => b.key)).toEqual(["current", "1-30", "31-60", "61+"]);
    expect(aging.buckets.reduce((t, b) => t + b.count, 0)).toBe(c.homes.length);
    expect(aging.totalCents).toBe(c.homes.reduce((t, o) => t + o.balanceCents, 0));
    expect(aging.buckets.reduce((t, b) => t + b.cents, 0)).toBe(aging.totalCents);
  });

  it("puts each household in exactly one bucket by days past due", () => {
    const aging = agingBuckets(c);
    const seen = new Set<string>();
    for (const b of aging.buckets) {
      for (const o of b.homes) {
        expect(seen.has(o.id), `${o.id} is in two buckets`).toBe(false);
        seen.add(o.id);
      }
    }
    const sixtyPlus = aging.buckets.find((b) => b.key === "61+")!;
    expect(sixtyPlus.homes.every((o) => o.daysPastDue > 60)).toBe(true);
  });

  it("agrees with the past-due total the dashboard shows", () => {
    const aging = agingBuckets(c);
    const pastDue = c.homes.filter((o) => o.daysPastDue > 0);
    expect(aging.pastDueCount).toBe(pastDue.length);
    expect(aging.pastDueCents).toBe(pastDue.reduce((t, o) => t + o.balanceCents, 0));
  });
});

describe("duesCollection", () => {
  it("rates only months that have transactions, against units times dues", () => {
    const d = duesCollection(mehrMeadows, 2026);
    expect(d.expectedCents).toBe(mehrMeadows.association.unitCount * mehrMeadows.association.duesCents);
    expect(d.months).toHaveLength(8);
    expect(d.rate).toBeGreaterThan(0.85);
    expect(d.rate).toBeLessThanOrEqual(1);
  });
});

describe("duesCollection, gross of fees", () => {
  it("reads a month everyone paid as 100%, though the bank got the net", () => {
    const homes = mehrMeadows.homes.slice(0, 2).map((o) => ({ ...o, homeType: undefined }));
    const dues = mehrMeadows.association.duesCents;
    const ledger = homes.map((o, i) => ({
      id: `net-${i}`,
      date: "2026-03-02",
      description: "Assessment payment",
      counterparty: o.displayName,
      category: "Assessments" as const,
      accountId: "acct-operating",
      amountCents: dues - 900, // the processor's cut, taken out of the deposit
      status: "cleared" as const,
    }));
    const homeCharges = Object.fromEntries(
      homes.map((o) => [
        o.id,
        [{ id: `p-${o.id}`, date: "2026-03-02", label: "Card payment", kind: "payment" as const, amountCents: -dues, balanceAfterCents: 0 }],
      ]),
    );
    const c = {
      ...mehrMeadows,
      association: { ...mehrMeadows.association, unitCount: 2, duesCadence: "monthly" as const },
      homes,
      ledger,
      homeCharges,
    };
    const d = duesCollection(c, 2026);
    expect(d.months).toHaveLength(1);
    expect(d.months[0].collectedCents).toBe(d.months[0].expectedCents);
    expect(d.rate).toBe(1);
  });
});

/** A bare association for the dues tests: so many homes, each at one amount. */
function billing(
  patch: Pick<Community["association"], "unitCount" | "duesCents" | "duesCadence" | "fiscalYearStart">,
  asOf: string,
  lines: [date: string, category: Community["ledger"][number]["category"], amountCents: number][],
): Community {
  return {
    ...mehrMeadows,
    asOf,
    association: { ...mehrMeadows.association, duesByType: undefined, ...patch },
    homes: [],
    homeCharges: {},
    ledger: lines.map(([date, category, amountCents], i) => ({
      id: `l-${i}`,
      date,
      description: category,
      counterparty: "Somebody",
      category,
      accountId: "acct-operating",
      amountCents,
      status: "cleared" as const,
    })),
  };
}

describe("duesCollection, with homes on their own amounts", () => {
  it("holds each bill against what every home pays, by the one rule", () => {
    const homes = [
      { ...mehrMeadows.homes[0], homeType: undefined, duesCents: 34_000 },
      { ...mehrMeadows.homes[1], homeType: undefined, duesCents: undefined },
      { ...mehrMeadows.homes[2], homeType: undefined, duesCents: undefined },
    ];
    const c: Community = {
      ...billing(
        { unitCount: 3, duesCents: 21_000, duesCadence: "monthly", fiscalYearStart: "01-01" },
        "2026-08-20",
        [["2026-08-05", "Assessments", 76_000]],
      ),
      homes,
    };
    const d = duesCollection(c, 2026);
    expect(d.expectedCents).toBe(34_000 + 21_000 + 21_000);
  });
});

describe("duesCollection, billed other than monthly", () => {
  it("holds an annual bill against the whole bill, not three months' share of it", () => {
    // Forty homes at $1,200, billed January 1. By March 15 thirty have paid.
    // Spread over twelve months the bill read $12,000 expected and 100%.
    const c = billing(
      { unitCount: 40, duesCents: 120_000, duesCadence: "annually", fiscalYearStart: "01-01" },
      "2026-03-15",
      [
        ["2026-01-10", "Assessments", 2_400_000],
        ["2026-02-12", "Assessments", 1_200_000],
        ["2026-03-03", "Landscaping", -50_000],
      ],
    );
    const d = duesCollection(c, 2026);
    expect(d.months).toEqual([
      { month: 1, label: "Jan", expectedCents: 4_800_000, collectedCents: 3_600_000, rate: 0.75 },
    ]);
    expect(d.expectedYtd).toBe(4_800_000);
    expect(d.collectedYtd).toBe(3_600_000);
    expect(d.rate).toBe(0.75);
    expect(d.measurable).toBe(true);
  });

  it("gives each quarter its own row, counted from the fiscal year start", () => {
    // Fiscal year from July: bills fall due in July, October, January, April.
    // Ten homes at $300. Money between two bills is paying the earlier one.
    const c = billing(
      { unitCount: 10, duesCents: 30_000, duesCadence: "quarterly", fiscalYearStart: "07-01" },
      "2026-08-20",
      [
        ["2025-12-05", "Insurance", -10_000],
        ["2026-01-12", "Assessments", 240_000],
        ["2026-02-03", "Assessments", 30_000],
        ["2026-04-08", "Assessments", 300_000],
        ["2026-07-06", "Assessments", 150_000],
        ["2026-08-04", "Assessments", 60_000],
      ],
    );
    const d = duesCollection(c, 2026);
    expect(d.months).toEqual([
      { month: 1, label: "Jan", expectedCents: 300_000, collectedCents: 270_000, rate: 0.9 },
      { month: 4, label: "Apr", expectedCents: 300_000, collectedCents: 300_000, rate: 1 },
      { month: 7, label: "Jul", expectedCents: 300_000, collectedCents: 210_000, rate: 0.7 },
    ]);
    // October's bill has not fallen due on August 20.
    expect(d.expectedYtd).toBe(900_000);
    expect(d.collectedYtd).toBe(780_000);
    expect(d.rate).toBeCloseTo(780 / 900, 10);
  });

  it("does not hold a bill against an association that did not exist yet", () => {
    // First on the books in February, so January's quarter was never billed.
    const c = billing(
      { unitCount: 10, duesCents: 30_000, duesCadence: "quarterly", fiscalYearStart: "01-01" },
      "2026-05-10",
      [
        ["2026-02-20", "Assessments", 50_000],
        ["2026-04-05", "Assessments", 200_000],
      ],
    );
    const d = duesCollection(c, 2026);
    expect(d.months.map((m) => m.month)).toEqual([4]);
    expect(d.collectedYtd).toBe(200_000);
    expect(d.expectedYtd).toBe(300_000);
  });

  it("says nothing is billed until the year's first bill arrives", () => {
    // An annual bill due in July, read in March: activity, but no bill yet.
    const c = billing(
      { unitCount: 10, duesCents: 30_000, duesCadence: "annually", fiscalYearStart: "07-01" },
      "2026-03-15",
      [["2026-01-10", "Assessments", 90_000]],
    );
    const d = duesCollection(c, 2026);
    expect(d.months).toEqual([]);
    expect(d.measurable).toBe(false);
    // The same association the year before, read from the same day: the
    // whole of 2025 is behind it, so July 2025's bill counts.
    const before = billing(
      { unitCount: 10, duesCents: 30_000, duesCadence: "annually", fiscalYearStart: "07-01" },
      "2026-03-15",
      [
        ["2025-03-01", "Insurance", -10_000],
        ["2025-07-09", "Assessments", 240_000],
      ],
    );
    expect(duesCollection(before, 2025).months).toEqual([
      { month: 7, label: "Jul", expectedCents: 300_000, collectedCents: 240_000, rate: 0.8 },
    ]);
  });
});

describe("a bill from last year still being paid", () => {
  it("leads the year with last July's bill, and what has come in against it since", () => {
    // Annual, fiscal year from July, read in March 2026. The July 2025 bill
    // is the one being collected: 240,000 by December, 30,000 more in
    // February. It used to read "nothing billed yet".
    const c = billing(
      { unitCount: 10, duesCents: 30_000, duesCadence: "annually", fiscalYearStart: "07-01" },
      "2026-03-15",
      [
        ["2025-03-01", "Insurance", -10_000],
        ["2025-07-09", "Assessments", 240_000],
        ["2026-02-03", "Assessments", 30_000],
      ],
    );
    const d = duesCollection(c, 2026);
    expect(d.months).toEqual([
      { month: 7, label: "Jul 2025", expectedCents: 300_000, collectedCents: 270_000, rate: 0.9 },
    ]);
    expect(d.measurable).toBe(true);
    expect(d.collectedYtd).toBe(270_000);
    expect(d.expectedYtd).toBe(300_000);
  });

  it("carries a quarter that straddles the new year the same way", () => {
    // Quarterly from February: bills in Feb, May, Aug, Nov. January's money
    // is paying November's bill.
    const c = billing(
      { unitCount: 10, duesCents: 10_000, duesCadence: "quarterly", fiscalYearStart: "02-01" },
      "2026-01-20",
      [
        ["2025-08-05", "Assessments", 100_000],
        ["2025-11-12", "Assessments", 60_000],
        ["2026-01-08", "Assessments", 25_000],
      ],
    );
    expect(duesCollection(c, 2026).months).toEqual([
      { month: 11, label: "Nov 2025", expectedCents: 100_000, collectedCents: 85_000, rate: 0.85 },
    ]);
  });

  it("adds nothing for a cadence that starts in January", () => {
    const c = billing(
      { unitCount: 10, duesCents: 30_000, duesCadence: "annually", fiscalYearStart: "01-01" },
      "2026-03-15",
      [
        ["2025-01-09", "Assessments", 300_000],
        ["2026-01-09", "Assessments", 150_000],
      ],
    );
    expect(duesCollection(c, 2026).months.map((m) => m.label)).toEqual(["Jan"]);
  });
});

describe("lines waiting on review", () => {
  const base = { accountId: "acct-operating", counterparty: "Ace Gate & Access", status: "cleared" as const };
  const c: Community = {
    ...mehrMeadows,
    asOf: "2026-08-20",
    homeCharges: {},
    ledger: [
      { ...base, id: "dep", date: "2026-08-12", description: "Deposit", category: "Assessments", amountCents: 57_000, status: "needs-review" },
      { ...base, id: "gate", date: "2026-08-11", description: "Gate motor", category: "Repairs & maintenance", amountCents: -138_000 },
      { ...base, id: "gate-again", date: "2026-08-10", description: "Gate motor", category: "Repairs & maintenance", amountCents: -138_000, status: "needs-review", duplicateOfId: "gate" },
      { ...base, id: "dues", date: "2026-08-03", description: "Dues", category: "Assessments", amountCents: 28_500 },
    ],
  };

  it("stay out of the month's money in and out, so a duplicate is not spent twice", () => {
    expect(monthlyFlows(c, 2026, c.asOf).at(-1)).toEqual({ month: "2026-08", inCents: 28_500, outCents: 138_000 });
    expect(spendingBetween(c, "2026-08-01", "2026-08-31").totalCents).toBe(138_000);
    expect(yearSummary(c, 2026).spendCents).toBe(138_000);
    expect(operatingRunway(c, c.asOf).avgOutCents).toBe(138_000);
  });

  it("read the same on the overview as on Transactions, for the real August", () => {
    const m = mehrMeadows;
    const held = m.ledger.filter((e) => e.status === "needs-review" && e.date.startsWith("2026-08"));
    expect(held.map((e) => e.amountCents).sort((a, b) => a - b)).toEqual([-138_000, 57_000]);
    const overview = monthlyFlows(m, 2026, m.asOf).at(-1)!;
    const transactions = ledgerTotals(filterLedger(m.ledger, periodRange("this-month", m.asOf)));
    expect(overview.month).toBe("2026-08");
    expect(overview.inCents).toBe(transactions.inCents);
    expect(overview.outCents).toBe(transactions.outCents);
  });
});

describe("lateFeesOwed", () => {
  const line = (
    id: string,
    date: string,
    label: string,
    amountCents: number,
    balanceAfterCents: number,
  ): ChargeLine => ({ id, date, label, kind: amountCents < 0 ? "payment" : "charge", amountCents, balanceAfterCents });
  const home = (id: string, balanceCents: number) => ({ ...mehrMeadows.homes[0], id, balanceCents });

  // Five statements written out by hand, each kept newest first as the app
  // keeps them. Dues are $300 and a late fee is $25.
  const statements: Record<string, ChargeLine[]> = {
    // Never back to zero: both fees are still owed.
    never: [
      line("n4", "2026-07-16", "Late fee", 2_500, 65_000),
      line("n3", "2026-07-01", "July dues", 30_000, 62_500),
      line("n2", "2026-06-16", "Late fee", 2_500, 32_500),
      line("n1", "2026-06-01", "June dues", 30_000, 30_000),
    ],
    // Cleared in May, fee and all, then late again: only July's fee is owed.
    again: [
      line("a5", "2026-07-16", "Late fee", 2_500, 32_500),
      line("a4", "2026-07-01", "July dues", 30_000, 30_000),
      line("a3", "2026-05-20", "Payment", -32_500, 0),
      line("a2", "2026-05-16", "Late fee", 2_500, 32_500),
      line("a1", "2026-05-01", "May dues", 30_000, 30_000),
    ],
    // Paid the fee the day it was charged, then part of August: no fee owed.
    sameDay: [
      line("s5", "2026-08-10", "Payment", -10_000, 20_000),
      line("s4", "2026-08-01", "August dues", 30_000, 30_000),
      line("s3", "2026-07-16", "Payment", -32_500, 0),
      line("s2", "2026-07-16", "Late fee", 2_500, 32_500),
      line("s1", "2026-07-01", "July dues", 30_000, 30_000),
    ],
    // Billed $325 and paid $310 of it without ever reaching zero: $15 is
    // owed, so $15 is the most that can be fees, not the whole $25.
    partly: [
      line("y3", "2026-07-20", "Payment", -31_000, 1_500),
      line("y2", "2026-07-16", "Late fee", 2_500, 32_500),
      line("y1", "2026-07-01", "July dues", 30_000, 30_000),
    ],
    // Owes nothing, so an old fee on the statement is not a fee owed.
    paid: [
      line("p3", "2026-07-20", "Payment", -32_500, 0),
      line("p2", "2026-07-16", "Late fee", 2_500, 32_500),
      line("p1", "2026-07-01", "July dues", 30_000, 30_000),
    ],
  };
  const c: Community = {
    ...mehrMeadows,
    history: undefined,
    homes: [
      home("never", 65_000),
      home("again", 32_500),
      home("sameDay", 20_000),
      home("partly", 1_500),
      home("paid", 0),
    ],
    homeCharges: statements,
  };
  const only = (id: string): Community => ({ ...c, homes: c.homes.filter((o) => o.id === id) });

  it("counts the fees charged since each household last stood at zero", () => {
    expect(lateFeesOwed(only("never"))).toBe(5_000);
    expect(lateFeesOwed(only("again"))).toBe(2_500);
    expect(lateFeesOwed(only("paid"))).toBe(0);
    expect(lateFeesOwed(c)).toBe(9_000);
  });

  it("never counts more in fees than the household still owes", () => {
    expect(lateFeesOwed(only("partly"))).toBe(1_500);
  });

  it("reads a fee and the payment that cleared it the same day in the order they happened", () => {
    // Kept newest first and sorted by date alone, the payment came before
    // the fee, and a fee paid that afternoon was counted as still owed.
    expect(lateFeesOwed(only("sameDay"))).toBe(0);
  });
});

describe("invoiceAddress", () => {
  it("shows the demo the address its seeded invoices arrived at", () => {
    expect(invoiceAddress(mehrMeadows, false)).toMatch(/^invoices@[a-z0-9-]+\.yourhoasis\.com$/);
  });

  it("gives a real association no address, since mail sent to it is not kept", () => {
    expect(invoiceAddress(mehrMeadows, true)).toBeNull();
  });
});

describe("budgetVariance", () => {
  it("signs variance so positive is good on both kinds of line", () => {
    const v = budgetVariance(mehrMeadows);
    for (const r of v.expense) expect(r.varianceCents).toBe(r.toDateCents - r.ytdActualCents);
    for (const r of v.income) expect(r.varianceCents).toBe(r.ytdActualCents - r.toDateCents);
    expect(v.expenseTotal.ytdActualCents).toBe(v.expense.reduce((t, r) => t + r.ytdActualCents, 0));
  });
});

describe("ledger filters", () => {
  const c = mehrMeadows;

  it("measures presets from the given day", () => {
    expect(periodRange("this-month", "2026-08-20")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(periodRange("last-month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodRange("last-year", "2026-08-20")).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("runs a balance from the oldest row up so the top row carries the total", () => {
    const rows = filterLedger(c.ledger, { ...periodRange("this-month", c.asOf), direction: "out" });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((e) => e.amountCents < 0)).toBe(true);
    const totals = ledgerTotals(rows);
    expect(totals.inCents).toBe(0);
    // Held lines move nothing; transfers move the balance but are not spending.
    const counted = rows.filter((e) => e.status !== "needs-review");
    expect(totals.running.get(rows[0].id)).toBe(
      counted.reduce((t, e) => t + e.amountCents, 0),
    );
    expect(totals.running.get(rows[0].id)).toBe(-totals.outCents + totals.transferCents);
  });

  it("holds unconfirmed lines out of the totals, as the overview promises", () => {
    const base = { accountId: "acct-operating", category: "Repairs & maintenance" as const, counterparty: "Ace" };
    const rows = [
      { ...base, id: "a", date: "2026-08-11", description: "Gate", amountCents: -138_000, status: "cleared" as const },
      { ...base, id: "b", date: "2026-08-10", description: "Gate again", amountCents: -138_000, status: "needs-review" as const, duplicateOfId: "a" },
      { ...base, id: "c", date: "2026-08-09", description: "Dues", category: "Assessments" as const, amountCents: 28_500, status: "pending" as const },
    ];
    const totals = ledgerTotals(rows);
    expect(totals.outCents).toBe(138_000);
    expect(totals.inCents).toBe(28_500);
    expect(totals.needsReview).toBe(1);
    expect(totals.count).toBe(3);
    expect(totals.running.get("a")).toBe(28_500 - 138_000);
  });

  it("counts a reserve transfer as neither money in nor money out", () => {
    const base = { counterparty: "Mehr Meadows", category: "Reserve transfer" as const, status: "cleared" as const, date: "2026-08-01", description: "Monthly reserve contribution" };
    const rows = [
      { ...base, id: "out", accountId: "acct-operating", amountCents: -500_000 },
      { ...base, id: "in", accountId: "acct-reserve", amountCents: 500_000 },
    ];
    const totals = ledgerTotals(rows);
    expect(totals.inCents).toBe(0);
    expect(totals.outCents).toBe(0);
    expect(totals.netCents).toBe(0);
    expect(totals.transferCents).toBe(0);
  });

  it("agrees with the real ledger: no held line and no transfer in any total", () => {
    const rows = filterLedger(c.ledger, periodRange("this-year", c.asOf));
    const totals = ledgerTotals(rows);
    const plain = rows.filter((e) => e.status !== "needs-review" && e.category !== "Reserve transfer");
    expect(totals.inCents).toBe(plain.filter((e) => e.amountCents > 0).reduce((t, e) => t + e.amountCents, 0));
    expect(totals.outCents).toBe(plain.filter((e) => e.amountCents < 0).reduce((t, e) => t - e.amountCents, 0));
  });

  it("searches description and counterparty, case blind", () => {
    const rows = filterLedger(c.ledger, { search: "cascade" });
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.every((e) => e.counterparty === "Cascade Grounds Co.")).toBe(true);
  });
});

describe("vendorDecisions", () => {
  const c = mehrMeadows;

  it("counts what the Vendors screen still lets a board decide: payments to sign", () => {
    const d = vendorDecisions(c);
    // Emailed-in bills are off the screen, so they are off the count too.
    expect(d.count).toBe(d.toSign.length);
    expect(d.toApprove.every((i) => i.status === "new")).toBe(true);
    expect(d.toPay.every((i) => i.status === "approved")).toBe(true);
    expect(d.toSign.every((p) => p.approvals.length < p.approvalsRequired)).toBe(true);
  });

  it("does not ask for a signature on money the bank says already left", () => {
    // Ace Gate cleared on August 11; its payment sat a signature short.
    const cleared = c.ledger.filter((e) => e.status === "cleared" && e.amountCents < 0);
    for (const payout of vendorDecisions(c).toSign) {
      const paid = cleared.some(
        (e) => e.counterparty === payout.vendor && -e.amountCents === payout.amountCents,
      );
      expect(paid, `${payout.vendor} is waiting on approval but already cleared`).toBe(false);
    }
  });
});

describe("delinquency", () => {
  it("counts every home on the register, as the aging table does", () => {
    const homes = mehrMeadows.homes.slice(0, 4).map((o) => ({ ...o, daysPastDue: 0, balanceCents: 0 }));
    homes.push({ ...homes[0], id: "empty", placeholder: true, displayName: "Lot 99" });
    const d = delinquency({ ...mehrMeadows, homes });
    expect(d.households).toBe(5);
    expect(d.current).toBe(5);
    expect(d.collectionRate).toBe(1);
  });

  it("reads 24 of 24 current for homes that have no charges yet", () => {
    const base = mehrMeadows.homes[0];
    const homes = Array.from({ length: 24 }, (_, i) => ({
      ...base,
      id: `h${i}`,
      placeholder: true,
      daysPastDue: 0,
      balanceCents: 0,
    }));
    const c = { ...mehrMeadows, homes, homeCharges: {} };
    const d = delinquency(c);
    expect(d.households).toBe(24);
    expect(d.current).toBe(24);
    expect(d.households).toBe(agingBuckets(c).buckets.reduce((t, b) => t + b.count, 0));
  });
});

describe("ledgerSide", () => {
  const line = (over: Partial<(typeof mehrMeadows.ledger)[number]>) => ({ ...mehrMeadows.ledger[0], ...over });

  it("puts a line in exactly the headline that counts it", () => {
    expect(ledgerSide(line({ amountCents: 100, category: "Assessments", status: "cleared" }))).toBe("in");
    const rows = [
      line({ id: "a", amountCents: 5000, category: "Assessments", status: "cleared" }),
      line({ id: "b", amountCents: -2000, category: "Landscaping", status: "cleared" }),
      line({ id: "c", amountCents: -9000, category: "Reserve transfer", status: "cleared" }),
      line({ id: "d", amountCents: 9000, category: "Reserve transfer", status: "cleared" }),
      line({ id: "e", amountCents: -700, category: "Assessments", description: "Payment reversed: Lot 3", status: "cleared" }),
      line({ id: "f", amountCents: -400, category: "Landscaping", status: "needs-review" }),
    ];
    const t = ledgerTotals(rows);
    const side = (d: "in" | "out") => filterLedger(rows, { direction: d });
    expect(side("in").map((e) => e.id)).toEqual(["a", "e"]);
    expect(side("out").map((e) => e.id)).toEqual(["b"]);
    expect(t.inCents).toBe(4300);
    expect(t.outCents).toBe(2000);
    expect(ledgerTotals(side("in")).inCents).toBe(t.inCents);
    expect(ledgerTotals(side("out")).outCents).toBe(t.outCents);
  });
});

describe("period words and stepping", () => {
  const asOf = "2026-10-07";

  it("names a preset and shows its dates", () => {
    expect(periodWords("last-30-days", periodRange("last-30-days", asOf))).toEqual({
      label: "Last 30 days",
      dates: "Sep 8 to Oct 7, 2026",
    });
  });

  it("reads the fiscal month from either way it is written", () => {
    expect(fiscalMonth("07-01")).toBe(7);
    expect(fiscalMonth("July 1")).toBe(7);
    expect(fiscalMonth("January 1")).toBe(1);
    expect(fiscalMonth(undefined)).toBe(1);
  });

  it("makes this year and last year fiscal when the year does not start in January", () => {
    expect(periodRange("this-year", asOf, 7)).toEqual({ from: "2026-07-01", to: "2027-06-30" });
    expect(periodRange("last-year", asOf, 7)).toEqual({ from: "2025-07-01", to: "2026-06-30" });
    // Before the start month, this year is the one that began last calendar year.
    expect(periodRange("this-year", "2026-03-10", 7)).toEqual({ from: "2025-07-01", to: "2026-06-30" });
    expect(periodRange("this-year", asOf)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("says which year a fiscal year is", () => {
    const r = periodRange("this-year", asOf, 7);
    expect(periodWords("this-year", r, 7)).toEqual({ label: "Fiscal year 2026", dates: "Jul 1, 2026 to Jun 30, 2027" });
    expect(periodWords("this-year", periodRange("this-year", asOf)).label).toBe("This year");
  });

  it("steps a month back through the presets and then as custom dates", () => {
    const thisMonth = periodRange("this-month", asOf);
    const back = stepPeriod("this-month", thisMonth, -1, asOf)!;
    expect(back).toEqual({ preset: "last-month", from: "2026-09-01", to: "2026-09-30" });
    expect(stepPeriod(back.preset, back, -1, asOf)).toEqual({ preset: "custom", from: "2026-08-01", to: "2026-08-31" });
    expect(stepPeriod("this-month", thisMonth, 1, asOf)).toBeNull();
    // Leap February.
    expect(stepPeriod("custom", { from: "2024-03-01", to: "2024-03-31" }, -1, asOf)).toMatchObject({ to: "2024-02-29" });
  });

  it("steps a fiscal year by its own unit", () => {
    const r = periodRange("this-year", asOf, 7);
    expect(stepPeriod("this-year", r, -1, asOf, 7)).toEqual({ preset: "last-year", from: "2025-07-01", to: "2026-06-30" });
    expect(stepPeriod("this-year", r, 1, asOf, 7)).toBeNull();
    const cal = periodRange("this-year", asOf);
    expect(stepPeriod("this-year", cal, -1, asOf)).toEqual({ preset: "last-year", from: "2025-01-01", to: "2025-12-31" });
  });

  it("does not step 30 days, 12 months or an odd custom range", () => {
    expect(stepPeriod("last-30-days", periodRange("last-30-days", asOf), -1, asOf)).toBeNull();
    expect(stepPeriod("last-12-months", periodRange("last-12-months", asOf), -1, asOf)).toBeNull();
    expect(stepPeriod("custom", { from: "2026-03-05", to: "2026-04-09" }, -1, asOf)).toBeNull();
  });
});

describe("period guards", () => {
  it("accepts real dates only", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-1-1")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it("finds the first money row, and null with none", () => {
    const first = firstMoneyOn(mehrMeadows);
    expect(first).toBe([...mehrMeadows.ledger].map((e) => e.date).sort()[0]);
    expect(firstMoneyOn({ ...mehrMeadows, ledger: [], history: undefined })).toBeNull();
  });
});
