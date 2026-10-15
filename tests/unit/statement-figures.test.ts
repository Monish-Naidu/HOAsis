import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import {
  compareStatement,
  isDuesLine,
  isOpeningLine,
  paidInYear,
  recentStatementLines,
  statementAmountText,
} from "@/lib/statement";
import { duesCollection, duesPaceLines, fiscalYearFlows, thisMonthLine } from "@/lib/metrics";
import type { ChargeLine } from "@/lib/types";

const line = (over: Partial<ChargeLine> & Pick<ChargeLine, "id" | "kind" | "amountCents">) =>
  ({ date: "2026-08-01", label: over.id, balanceAfterCents: 0, ...over }) as ChargeLine;

describe("paid in a year", () => {
  const lines = [
    line({ id: "p1", kind: "payment", amountCents: -28_500, date: "2026-03-01" }),
    line({ id: "p2", kind: "payment", amountCents: -2_000, date: "2026-04-01" }),
    // p2 taken back: the payment stays on the statement and a charge undoes it.
    line({
      id: "r2",
      kind: "charge",
      amountCents: 2_000,
      date: "2026-04-02",
      label: "Payment reversed: bounced",
      category: "other",
    }),
    line({ id: "old", kind: "payment", amountCents: -9_900, date: "2025-12-31" }),
  ];

  it("leaves out a payment taken back and the line that took it back", () => {
    expect(paidInYear(lines, 2026)).toBe(28_500);
    expect(paidInYear(lines, "2026")).toBe(28_500);
  });

  it("counts only the year asked for", () => {
    expect(paidInYear(lines, 2025)).toBe(9_900);
    expect(paidInYear(lines, 2027)).toBe(0);
  });

  it("agrees with the board's total for the same year", () => {
    // The board's statement reads these lines through statementTotals.
    expect(paidInYear([], 2026)).toBe(0);
    expect(paidInYear([lines[0], lines[0]], 2026)).toBe(57_000);
  });
});

describe("the sign on a statement line", () => {
  it("gives a payment and a credit the same minus, and a charge none", () => {
    expect(statementAmountText({ kind: "payment", amountCents: -200 })).toBe("−$2.00");
    expect(statementAmountText({ kind: "credit", amountCents: -100 })).toBe("−$1.00");
    expect(statementAmountText({ kind: "charge", amountCents: 28_500 })).toBe("$285.00");
    expect(statementAmountText({ kind: "payment", amountCents: 0 })).toBe("−$0.00");
  });
});

describe("lines of one day", () => {
  it("keeps charges ahead of payments, and orders a kind by when it was written", () => {
    const a = { date: "2026-08-01", kind: "charge" as const, createdAt: "2026-08-01T09:00" };
    const b = { date: "2026-08-01", kind: "charge" as const, createdAt: "2026-08-01T08:00" };
    const pay = { date: "2026-08-01", kind: "payment" as const, createdAt: "2026-08-01T07:00" };
    expect(compareStatement(b, a)).toBeLessThan(0);
    expect(compareStatement(pay, a)).toBeGreaterThan(0);
    expect(compareStatement(a, a)).toBe(0);
    expect(
      compareStatement(
        { date: "2026-07-31", kind: "payment" },
        { date: "2026-08-01", kind: "charge" },
      ),
    ).toBeLessThan(0);
  });

  it("lists the newest first for recent activity, whatever the statement's own order", () => {
    // The statement keeps this charge above the payment, but it was written last.
    const lines = [
      line({ id: "pay", kind: "payment", amountCents: -100, createdAt: "2026-08-01T09:00" }),
      line({ id: "bill", kind: "charge", amountCents: 100, createdAt: "2026-08-01T10:00" }),
      line({ id: "yesterday", kind: "charge", amountCents: 1, date: "2026-07-31" }),
    ];
    expect(recentStatementLines(lines, 2).map((l) => l.id)).toEqual(["bill", "pay"]);
    expect(recentStatementLines(lines, 10).map((l) => l.id)).toEqual(["bill", "pay", "yesterday"]);
    expect(recentStatementLines(lines, 0)).toEqual([]);
  });

  it("falls back to the position when nothing says which was written last", () => {
    const lines = [
      line({ id: "newer", kind: "payment", amountCents: -1 }),
      line({ id: "older", kind: "payment", amountCents: -2 }),
    ];
    expect(recentStatementLines(lines, 1).map((l) => l.id)).toEqual(["newer"]);
  });
});

describe("a balance brought forward", () => {
  const opening = line({
    id: "o",
    kind: "charge",
    amountCents: 6_400,
    label: "Balance brought forward",
    category: "dues",
  });

  it("is an opening line, and never a dues bill, whatever category it was written under", () => {
    expect(isOpeningLine(opening)).toBe(true);
    expect(isDuesLine(opening)).toBe(false);
    expect(isDuesLine({ ...opening, category: undefined })).toBe(false);
    expect(
      isDuesLine(
        line({ id: "d", kind: "charge", amountCents: 1, label: "March dues", category: "dues" }),
      ),
    ).toBe(true);
  });

  const fresh = (patch: Partial<Community> = {}): Community => ({
    ...mehrMeadows,
    asOf: "2026-10-15",
    homeCharges: {},
    history: undefined,
    recentDuesBill: undefined,
    nextChargeDate: "2026-11-01",
    ledger: [],
    ...patch,
  });
  const bankStart = {
    id: "open",
    date: "2026-10-01",
    description: "Opening balance",
    counterparty: "",
    category: "Opening balance" as const,
    accountId: "acct",
    amountCents: 500_000,
    status: "cleared" as const,
  };

  it("makes a starting bank balance neither a bill nor pace", () => {
    const c = fresh({ ledger: [bankStart] });
    const dues = duesCollection(c, 2026, "2026-10-15");
    expect(dues.months).toEqual([]);
    expect(dues.measurable).toBe(false);
    expect(duesPaceLines(c, 2026, "2026-10-15")).not.toContain("Behind pace");
    expect(thisMonthLine(c, "2026-10-15")).toMatch(/^First bill goes out/);
  });

  it("makes a home's opening balance no bill either", () => {
    const home = mehrMeadows.homes[0];
    const c = fresh({
      ledger: [bankStart],
      homeCharges: { [home.id]: [opening] },
    });
    expect(duesCollection(c, 2026, "2026-10-15").months).toEqual([]);
    expect(thisMonthLine(c, "2026-10-15")).toMatch(/^First bill goes out/);
  });
});

describe("a closed year's money in and out", () => {
  it("leaves out starting balances and moves between the association's own accounts", () => {
    expect(
      fiscalYearFlows([
        { category: "Assessments", inCents: 20_000_00, outCents: 0 },
        { category: "Opening balance", inCents: 168_000_00, outCents: 0 },
        { category: "Reserve transfer", inCents: 5_000_00, outCents: 5_000_00 },
        { category: "Landscaping", inCents: 0, outCents: 8_000_00 },
        { category: "Interest income", inCents: 596_00, outCents: 0 },
      ]),
    ).toEqual({ inCents: 20_596_00, outCents: 8_000_00 });
  });

  it("nets a payment given back against money in, as Transactions does", () => {
    expect(
      fiscalYearFlows([{ category: "Assessments", inCents: 10_000, outCents: 2_500 }]),
    ).toEqual({ inCents: 7_500, outCents: 0 });
    expect(fiscalYearFlows([{ category: "Assessments", inCents: 1_000, outCents: 2_500 }])).toEqual(
      { inCents: 0, outCents: 1_500 },
    );
    expect(fiscalYearFlows([])).toEqual({ inCents: 0, outCents: 0 });
  });
});
