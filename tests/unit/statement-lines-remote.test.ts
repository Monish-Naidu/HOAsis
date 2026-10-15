import { describe, expect, it } from "vitest";
import { fundsLedger, paymentLineDetails, statementLines } from "@/lib/data/remote";
import { ledgerTotals } from "@/lib/metrics";

const row = (
  id: string,
  kind: "charge" | "payment" | "credit",
  amount: number,
  created: string,
  over: Record<string, unknown> = {},
) => ({
  id,
  unit_id: "u1",
  due_on: "2026-08-01",
  created_at: created,
  label: id,
  kind,
  amount_cents: amount,
  ...over,
});

describe("a signed in statement's payment lines", () => {
  const rows = [
    row("bill-a", "charge", 28_500, "2026-07-01T00:00:00+00:00", {
      due_on: "2026-07-01",
      label: "July dues",
    }),
    row("bill-b", "charge", 28_500, "2026-08-01T00:00:00+00:00", { label: "August dues" }),
    row("pay", "payment", -40_000, "2026-08-03T10:00:00.123456+00:00", {
      due_on: "2026-08-03",
      label: "Bank payment",
    }),
  ];
  const paid = {
    payments: [
      {
        id: "pm1",
        unit_id: "u1",
        amount_cents: 40_000,
        rail: "ach",
        created_at: "2026-08-03T10:00:00.123456+00:00",
      },
      // Another home's payment of the same amount at the same instant is not this one.
      {
        id: "pm2",
        unit_id: "u2",
        amount_cents: 40_000,
        rail: "card",
        created_at: "2026-08-03T10:00:00.123456+00:00",
      },
    ],
    allocations: [
      {
        payment_id: "pm1",
        charge_id: "bill-a",
        amount_cents: 28_500,
        charges: { label: "July dues" },
      },
      { payment_id: "pm1", charge_id: "bill-b", amount_cents: 11_500 },
    ],
  };

  it("carries the method and what it was applied to, as the demo's statement does", () => {
    const lines = statementLines(rows, 0, paid);
    const pay = lines.find((l) => l.id === "pay")!;
    expect(pay.method).toBe("Bank");
    expect(pay.appliedTo).toEqual([
      { chargeId: "bill-a", label: "July dues", amountCents: 28_500 },
      { chargeId: "bill-b", label: "August dues", amountCents: 11_500 },
    ]);
    expect(lines.find((l) => l.id === "bill-a")!.method).toBeUndefined();
  });

  it("matches each payments row once", () => {
    const twin = [
      row("pay1", "payment", -100, "2026-08-03T10:00:00+00:00"),
      row("pay2", "payment", -100, "2026-08-03T10:00:00+00:00"),
    ];
    const details = paymentLineDetails(twin, {
      payments: [
        {
          id: "only",
          unit_id: "u1",
          amount_cents: 100,
          rail: "check",
          created_at: "2026-08-03T10:00:00+00:00",
        },
      ],
      allocations: [],
    });
    expect([...details.keys()]).toEqual(["pay1"]);
    expect(details.get("pay1")?.method).toBe("Check");
  });

  it("shows no details, and still every line, when the payments could not be read", () => {
    const lines = statementLines(rows);
    expect(lines.map((l) => l.id)).toEqual(["pay", "bill-b", "bill-a"]);
    expect(lines[0].method).toBeUndefined();
    expect(lines[0].appliedTo).toBeUndefined();
  });

  it("keeps the time each line was written, and orders one kind of one day by it", () => {
    const lines = statementLines([
      row("second", "charge", 100, "2026-08-01T10:00:00+00:00", { label: "Second" }),
      row("first", "charge", 100, "2026-08-01T09:00:00+00:00", { label: "First" }),
    ]);
    // Newest first, so the one written last leads.
    expect(lines.map((l) => l.id)).toEqual(["second", "first"]);
    expect(lines[0].createdAt).toBe("2026-08-01T10:00:00+00:00");
  });

  it("leaves a payment with no payments row (older than the rows were kept) without details", () => {
    const lines = statementLines(
      [row("old", "payment", -500, "2020-01-01T00:00:00+00:00")],
      0,
      paid,
    );
    expect(lines[0].method).toBeUndefined();
  });
});

describe("what an owner sees of the ledger", () => {
  const funds = {
    accounts: [],
    by_category: [],
    recent: [
      {
        id: "e1",
        occurred_on: "2026-10-03",
        description: "Pool service",
        counterparty: "Aqua",
        category: "Utilities",
        amount_cents: -200,
        bank_account_id: null,
      },
    ],
  };

  it("has dues coming in once the database sends the monthly sums", () => {
    const lines = fundsLedger({
      ...funds,
      assessments_by_month: [{ month: "2026-10-01", in_cents: 28_500, out_cents: 0 }],
    });
    const totals = ledgerTotals(lines);
    expect(totals.inCents).toBe(28_500);
    expect(totals.outCents).toBe(200);
    // Newest first.
    expect(lines.map((l) => l.id)).toEqual(["e1", "funds-dues-2026-10"]);
    expect(lines.find((l) => l.category === "Assessments")?.counterparty).toBe("Homeowners");
  });

  it("nets a reversal against the month's dues and skips a month that came to nothing", () => {
    const lines = fundsLedger({
      ...funds,
      assessments_by_month: [
        { month: "2026-10", in_cents: 5_000, out_cents: 2_000 },
        { month: "2026-09-01", in_cents: 1_000, out_cents: 1_000 },
        { month: "2026-08-01", in_cents: 0, out_cents: 700 },
      ],
    });
    const dues = lines.filter((l) => l.category === "Assessments");
    expect(dues.map((l) => [l.date, l.amountCents])).toEqual([
      ["2026-10-01", 3_000],
      ["2026-08-01", -700],
    ]);
    // A month in which more went back than came in nets against money in.
    expect(ledgerTotals(lines).inCents).toBe(3_000 - 700);
  });

  it("is just the recent lines before the database sends the sums", () => {
    expect(fundsLedger(funds).map((l) => l.id)).toEqual(["e1"]);
  });
});
