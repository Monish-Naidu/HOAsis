import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import type { CommunityHistory, LedgerMonth, StatementMonth } from "@/lib/types";
import { historyWindowFrom, statementLines } from "@/lib/data/remote";
import {
  categoryTrend,
  compareYears,
  duesCollection,
  lateFeesOwed,
  ledgerFlows,
  ledgerYears,
  monthlyFlows,
  monthlyFlowsBetween,
  netByYear,
  operatingRunway,
  spendingBetween,
  spendingByCategory,
  yearSummary,
} from "@/lib/metrics";

/**
 * A real association's old rows never reach the browser: the server sums
 * them by month (`community.history`) and the selectors read the sums in
 * place of the lines. These prove the sums give the same answer as the
 * lines, by summing a fixture the way the database does and comparing every
 * selector's output against the fixture read whole.
 */

/** What association_overview would return for a fixture, before `from`. */
function summarise(c: Community, from: string): CommunityHistory {
  const months = new Map<string, LedgerMonth>();
  for (const e of c.ledger) {
    if (e.date >= from) continue;
    const key = `${e.date.slice(0, 7)}|${e.category}`;
    const row = months.get(key) ?? { month: e.date.slice(0, 7), category: e.category, inCents: 0, outCents: 0, count: 0 };
    if (e.amountCents >= 0) row.inCents += e.amountCents;
    else row.outCents += -e.amountCents;
    row.count += 1;
    months.set(key, row);
  }
  const statements = new Map<string, StatementMonth>();
  const counts: Record<string, number> = {};
  for (const [unitId, lines] of Object.entries(c.homeCharges)) {
    counts[unitId] = lines.length;
    for (const line of lines) {
      if (line.date >= from) continue;
      const key = `${line.date.slice(0, 7)}|${line.kind}`;
      const row = statements.get(key) ?? { month: line.date.slice(0, 7), kind: line.kind, cents: 0, count: 0 };
      row.cents += line.amountCents;
      row.count += 1;
      statements.set(key, row);
    }
  }
  return {
    from,
    ledgerCount: c.ledger.length,
    ledgerFrom: [...c.ledger].map((e) => e.date).sort()[0],
    ledgerMonths: [...months.values()],
    statementMonths: [...statements.values()],
    statementCounts: counts,
    lateFeesOwedCents: lateFeesOwed(c),
    statementsLoaded: [],
    ledgerLoaded: false,
  };
}

/** The fixture as the app would hold it: rows from `from`, sums before. */
function windowed(c: Community, from: string): Community {
  return {
    ...c,
    ledger: c.ledger.filter((e) => e.date >= from),
    homeCharges: Object.fromEntries(
      Object.entries(c.homeCharges).map(([id, lines]) => [id, lines.filter((l) => l.date >= from)]),
    ),
    history: summarise(c, from),
  };
}

const whole = mehrMeadows;
const FROM = "2025-06-01";
const part = windowed(whole, FROM);

describe("the server's month sums read the same as the lines", () => {
  it("drops rows before the window and keeps the ones after", () => {
    expect(part.ledger.length).toBeLessThan(whole.ledger.length);
    expect(part.ledger.every((e) => e.date >= FROM)).toBe(true);
    expect(part.history?.ledgerMonths.length).toBeGreaterThan(0);
  });

  it("lists the same years", () => {
    expect(ledgerYears(part)).toEqual(ledgerYears(whole));
  });

  it("sums every month of every year the same, in and out", () => {
    for (const year of ledgerYears(whole)) {
      expect(monthlyFlows(part, year)).toEqual(monthlyFlows(whole, year));
      expect(monthlyFlows(part, year, whole.asOf)).toEqual(monthlyFlows(whole, year, whole.asOf));
    }
  });

  it("spends the same by category, for a year and for a window", () => {
    for (const year of ledgerYears(whole)) {
      expect(spendingByCategory(part, year)).toEqual(spendingByCategory(whole, year));
    }
    expect(spendingBetween(part, "2024-09-01", whole.asOf)).toEqual(spendingBetween(whole, "2024-09-01", whole.asOf));
    expect(monthlyFlowsBetween(part, "2024-09-01", whole.asOf)).toEqual(monthlyFlowsBetween(whole, "2024-09-01", whole.asOf));
  });

  it("totals each year, compares two, and trends a category the same", () => {
    for (const year of ledgerYears(whole)) {
      expect(yearSummary(part, year)).toEqual(yearSummary(whole, year));
      expect(yearSummary(part, year, 6)).toEqual(yearSummary(whole, year, 6));
    }
    expect(compareYears(part, 2025, 2026)).toEqual(compareYears(whole, 2025, 2026));
    expect(compareYears(part, 2024, 2025)).toEqual(compareYears(whole, 2024, 2025));
    expect(netByYear(part)).toEqual(netByYear(whole));
    expect(categoryTrend(part, "Landscaping")).toEqual(categoryTrend(whole, "Landscaping"));
  });

  it("rates dues collection and the operating runway the same", () => {
    for (const year of ledgerYears(whole)) {
      expect(duesCollection(part, year)).toEqual(duesCollection(whole, year));
    }
    expect(operatingRunway(part, whole.asOf)).toEqual(operatingRunway(whole, whole.asOf));
  });

  it("hands back the server's late fee figure untouched when there is one", () => {
    // Only the pass-through is checked here: the helper above fills the
    // figure from `lateFeesOwed` itself, so comparing part with whole would
    // be the function against itself. The arithmetic is pinned to statements
    // written out by hand in metrics.test.ts.
    const served: Community = { ...part, history: { ...part.history!, lateFeesOwedCents: 12_345 } };
    expect(lateFeesOwed(served)).toBe(12_345);
  });

  it("steps the sums aside once every line has been fetched", () => {
    const loaded: Community = { ...part, ledger: whole.ledger, history: { ...part.history!, ledgerLoaded: true } };
    // Every line, less the ones waiting on review, which no report counts.
    expect(ledgerFlows(loaded)).toEqual(whole.ledger.filter((e) => e.status !== "needs-review"));
    expect(netByYear(loaded)).toEqual(netByYear(whole));
  });

  it("reads the fixtures line for line, less the ones waiting on review", () => {
    expect(whole.history).toBeUndefined();
    const held = whole.ledger.filter((e) => e.status === "needs-review");
    expect(held.length).toBeGreaterThan(0);
    expect(ledgerFlows(whole)).toEqual(whole.ledger.filter((e) => e.status !== "needs-review"));
    expect(ledgerFlows(whole)).toHaveLength(whole.ledger.length - held.length);
    // Worked out once per ledger, since every chart on a screen asks.
    expect(ledgerFlows(whole)).toBe(ledgerFlows(whole));
  });
});

describe("statementLines", () => {
  const rows = [
    { id: "b", unit_id: "u", due_on: "2026-02-01", created_at: "2026-02-01T00:00:00Z", label: "February dues", kind: "charge" as const, amount_cents: 100 },
    { id: "a", unit_id: "u", due_on: "2026-01-01", created_at: "2026-01-01T00:00:00Z", label: "January dues", kind: "charge" as const, amount_cents: 100 },
    { id: "c", unit_id: "u", due_on: "2026-02-01", created_at: "2026-02-01T09:00:00Z", label: "Payment", kind: "payment" as const, amount_cents: -150 },
  ];

  it("runs the balance oldest first and lists newest first", () => {
    const lines = statementLines(rows);
    expect(lines.map((l) => l.id)).toEqual(["c", "b", "a"]);
    expect(lines.map((l) => l.balanceAfterCents)).toEqual([50, 200, 100]);
  });

  it("starts from the balance carried into the window", () => {
    const lines = statementLines(rows, 1_000);
    expect(lines[0].balanceAfterCents).toBe(1_050);
    expect(lines.at(-1)?.balanceAfterCents).toBe(1_100);
  });
});

describe("historyWindowFrom", () => {
  it("is the first of the month twenty-four months back, this one included", () => {
    expect(historyWindowFrom("2026-09-25")).toBe("2024-10-01");
    expect(historyWindowFrom("2026-01-15")).toBe("2024-02-01");
    expect(historyWindowFrom("2026-12-31")).toBe("2025-01-01");
  });
});
