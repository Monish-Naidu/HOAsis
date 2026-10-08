import { describe, expect, it } from "vitest";
import type { Community } from "@/lib/data/community";
import type { ChargeLine } from "@/lib/types";
import { statementFor, statementPeriod, statementPeriodLabel, statementYearOf, statementYears } from "@/lib/statement";

const line = (id: string, date: string, kind: ChargeLine["kind"], cents: number, label = "March assessment"): ChargeLine => ({
  id,
  date,
  label,
  kind,
  amountCents: kind === "charge" ? cents : -cents,
  balanceAfterCents: 0,
});

/** Newest first, as a loaded statement is stored. */
function community(lines: ChargeLine[], fiscalYearStart = "01-01", history?: Community["history"]): Community {
  return {
    association: { fiscalYearStart },
    homeCharges: { h1: lines },
    history,
  } as unknown as Community;
}

// 2024: billed 200, paid 100. 2025: billed 200, paid 300 (a late catch-up), credit 50.
const lines = [
  line("c5", "2025-12-01", "charge", 10_000),
  line("c4", "2025-11-15", "credit", 5_000, "Late fee waived"),
  line("c3", "2025-06-10", "payment", 30_000),
  line("c2", "2025-03-01", "charge", 10_000),
  line("c1", "2024-12-01", "payment", 10_000),
  line("c0", "2024-02-01", "charge", 20_000),
];
// Only the head balance is stored; the rest is restated from it: ends 50 in credit.
lines[0].balanceAfterCents = -5_000;

describe("statementFor", () => {
  it("brings the opening balance in from earlier lines and carries a running balance", () => {
    const s = statementFor(community(lines), "h1", 2025);
    expect(s.openingCents).toBe(10_000);
    expect(s.rows.map((r) => r.balanceCents)).toEqual([20_000, -10_000, -15_000, -5_000]);
    expect(s.closingCents).toBe(-5_000);
    expect(s.billedCents).toBe(20_000);
    expect(s.paidCents).toBe(30_000);
    expect(s.creditedCents).toBe(5_000);
    expect(s.openingCents + s.billedCents - s.paidCents - s.creditedCents).toBe(s.closingCents);
  });

  it("puts a charge before a payment on the same day", () => {
    const same = [line("p", "2025-03-01", "payment", 10_000), line("c", "2025-03-01", "charge", 10_000)];
    same[0].balanceAfterCents = 0;
    const s = statementFor(community(same), "h1", 2025);
    expect(s.rows.map((r) => r.id)).toEqual(["c", "p"]);
    expect(s.rows.map((r) => r.balanceCents)).toEqual([10_000, 0]);
  });

  it("is empty for a year with nothing, owing what the year before ended on", () => {
    const s = statementFor(community(lines), "h1", 2026);
    expect(s.rows).toEqual([]);
    expect(s.openingCents).toBe(-5_000);
    expect(s.closingCents).toBe(-5_000);
    expect(s.billedCents + s.paidCents + s.creditedCents).toBe(0);
  });

  it("opens an early year with nothing from what the first later line was brought in at", () => {
    const s = statementFor(community(lines), "h1", 2023);
    expect(s.rows).toEqual([]);
    expect(s.openingCents).toBe(0);
  });

  it("has no lines and no balance for a home with no statement", () => {
    const s = statementFor(community([]), "h1", 2025);
    expect(s.openingCents).toBe(0);
    expect(s.closingCents).toBe(0);
  });

  it("takes a refunded payment off what was paid, not onto what was billed", () => {
    const l = [
      line("r", "2025-05-01", "charge", 10_000, "Refund of card payment"),
      line("p", "2025-04-01", "payment", 10_000),
    ];
    l[0].balanceAfterCents = 10_000;
    const s = statementFor(community(l), "h1", 2025);
    expect(s.paidCents).toBe(0);
    expect(s.billedCents).toBe(0);
    expect(s.closingCents).toBe(10_000);
  });

  it("follows a fiscal year that starts in July", () => {
    const c = community(lines, "07-01");
    expect(statementPeriod("07-01", 2025)).toEqual({ from: "2025-07-01", to: "2026-06-30" });
    const s = statementFor(c, "h1", 2024);
    // July 2024 to June 2025: the December 2024 payment, the March 2025 bill and the June payment.
    expect(s.rows.map((r) => r.id)).toEqual(["c1", "c2", "c3"]);
    expect(s.openingCents).toBe(20_000);
    expect(s.periodLabel).toBe("Jul 2024 to Jun 2025");
  });

  it("says where the held lines begin when the year starts before them", () => {
    const history = {
      from: "2025-01-01",
      statementCounts: { h1: 6 },
      statementsLoaded: [],
    } as unknown as Community["history"];
    const held = lines.slice(0, 4);
    const c = community(held, "01-01", history);
    expect(statementFor(c, "h1", 2024).linesBegin).toBe("2025-01-01");
    expect(statementFor(c, "h1", 2025).linesBegin).toBeNull();
    const loaded = { ...history, statementsLoaded: ["h1"] } as unknown as Community["history"];
    expect(statementFor(community(held, "01-01", loaded), "h1", 2024).linesBegin).toBeNull();
  });
});

describe("statementYears and periods", () => {
  it("lists years with lines newest first, and the current year when there are none", () => {
    expect(statementYears(community(lines), "2026-08-20")).toEqual([2025, 2024]);
    expect(statementYears(community([]), "2026-08-20")).toEqual([2026]);
  });

  it("names a fiscal year for the year it starts in", () => {
    expect(statementYearOf("07-01", "2026-06-30")).toBe(2025);
    expect(statementYearOf("07-01", "2026-07-01")).toBe(2026);
    expect(statementYearOf("01-01", "2026-01-01")).toBe(2026);
    expect(statementPeriodLabel("01-01", 2025)).toBe("2025");
    expect(statementPeriod("03-01", 2024)).toEqual({ from: "2024-03-01", to: "2025-02-28" });
    expect(statementPeriod("03-01", 2023)).toEqual({ from: "2023-03-01", to: "2024-02-29" });
  });
});
