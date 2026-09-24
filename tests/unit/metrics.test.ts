import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import {
  agingBuckets,
  budgetVariance,
  compareYears,
  delinquency,
  duesCollection,
  filterLedger,
  ledgerTotals,
  ledgerYears,
  monthlyFlows,
  netByYear,
  periodRange,
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

  it("counts bills to approve, bills to pay and payments to sign, and nothing else", () => {
    const d = vendorDecisions(c);
    expect(d.count).toBe(d.toApprove.length + d.toPay.length + d.toSign.length);
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
