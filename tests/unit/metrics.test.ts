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
  ledgerTotals,
  ledgerYears,
  monthlyFlows,
  netByYear,
  operatingRunway,
  periodRange,
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
    const cmp = compareYears(c, 2024, 2025);
    expect(cmp.categories.find((r) => r.category === "Reserve contributions")?.aCents).toBe(operatingSide);
  });

  it("gives every category the same change arithmetic as the headline", () => {
    const cmp = compareYears(c, 2024, 2025);
    const spendA = cmp.categories
      .filter((r) => r.category !== "Reserve contributions")
      .reduce((t, r) => t + r.aCents, 0);
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
    expect(aging.buckets.reduce((t, b) => t + b.count, 0)).toBe(c.owners.length);
    expect(aging.totalCents).toBe(c.owners.reduce((t, o) => t + o.balanceCents, 0));
    expect(aging.buckets.reduce((t, b) => t + b.cents, 0)).toBe(aging.totalCents);
  });

  it("puts each household in exactly one bucket by days past due", () => {
    const aging = agingBuckets(c);
    const seen = new Set<string>();
    for (const b of aging.buckets) {
      for (const o of b.owners) {
        expect(seen.has(o.id), `${o.id} is in two buckets`).toBe(false);
        seen.add(o.id);
      }
    }
    const sixtyPlus = aging.buckets.find((b) => b.key === "61+")!;
    expect(sixtyPlus.owners.every((o) => o.daysPastDue > 60)).toBe(true);
  });

  it("agrees with the past-due total the dashboard shows", () => {
    const aging = agingBuckets(c);
    const pastDue = c.owners.filter((o) => o.daysPastDue > 0);
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
    const owners = mehrMeadows.owners.slice(0, 2).map((o) => ({ ...o, homeType: undefined }));
    const dues = mehrMeadows.association.duesCents;
    const ledger = owners.map((o, i) => ({
      id: `net-${i}`,
      date: "2026-03-02",
      description: "Assessment payment",
      counterparty: o.displayName,
      category: "Assessments" as const,
      accountId: "acct-operating",
      amountCents: dues - 900, // the processor's cut, taken out of the deposit
      status: "cleared" as const,
    }));
    const ownerCharges = Object.fromEntries(
      owners.map((o) => [
        o.id,
        [{ id: `p-${o.id}`, date: "2026-03-02", label: "Card payment", kind: "payment" as const, amountCents: -dues, balanceAfterCents: 0 }],
      ]),
    );
    const c = {
      ...mehrMeadows,
      association: { ...mehrMeadows.association, unitCount: 2, duesCadence: "monthly" as const },
      owners,
      ledger,
      ownerCharges,
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
    owners: [],
    ownerCharges: {},
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
    const owners = [
      { ...mehrMeadows.owners[0], homeType: undefined, duesCents: 34_000 },
      { ...mehrMeadows.owners[1], homeType: undefined, duesCents: undefined },
      { ...mehrMeadows.owners[2], homeType: undefined, duesCents: undefined },
    ];
    const c: Community = {
      ...billing(
        { unitCount: 3, duesCents: 21_000, duesCadence: "monthly", fiscalYearStart: "01-01" },
        "2026-08-20",
        [["2026-08-05", "Assessments", 76_000]],
      ),
      owners,
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
    ownerCharges: {},
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
  const owner = (id: string, balanceCents: number) => ({ ...mehrMeadows.owners[0], id, balanceCents });

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
    owners: [
      owner("never", 65_000),
      owner("again", 32_500),
      owner("sameDay", 20_000),
      owner("partly", 1_500),
      owner("paid", 0),
    ],
    ownerCharges: statements,
  };
  const only = (id: string): Community => ({ ...c, owners: c.owners.filter((o) => o.id === id) });

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
  it("does not count a home with nobody on record as a household paying on time", () => {
    const owners = mehrMeadows.owners.slice(0, 4).map((o) => ({ ...o, daysPastDue: 0, balanceCents: 0 }));
    owners.push({ ...owners[0], id: "empty", placeholder: true, displayName: "Lot 99" });
    const d = delinquency({ ...mehrMeadows, owners });
    expect(d.households).toBe(4);
    expect(d.current).toBe(4);
    expect(d.collectionRate).toBe(1);
  });
});
