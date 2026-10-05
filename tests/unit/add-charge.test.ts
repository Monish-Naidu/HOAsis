import { describe, expect, it } from "vitest";
import {
  MAX_CHARGE_CENTS,
  chargeAllLine,
  chargeCents,
  chargeProblem,
} from "@/lib/payments/charges";

const TODAY = "2026-08-20";
const ok = { amountCents: 8500, label: "Gate remote replacement", dueOn: TODAY };

describe("chargeCents", () => {
  it("reads dollars as whole cents", () => {
    expect(chargeCents("85")).toBe(8500);
    expect(chargeCents("85.5")).toBe(8550);
    expect(chargeCents("0.07")).toBe(7);
  });
  it("reads anything that is not a positive amount as 0", () => {
    expect(chargeCents("")).toBe(0);
    expect(chargeCents("-5")).toBe(0);
    expect(chargeCents("abc")).toBe(0);
  });
});

describe("chargeProblem", () => {
  it("accepts a normal charge", () => {
    expect(chargeProblem(ok, TODAY)).toBeNull();
  });
  it("accepts the limits themselves", () => {
    expect(chargeProblem({ ...ok, amountCents: 1 }, TODAY)).toBeNull();
    expect(chargeProblem({ ...ok, amountCents: MAX_CHARGE_CENTS }, TODAY)).toBeNull();
    expect(chargeProblem({ ...ok, label: "x".repeat(80) }, TODAY)).toBeNull();
    expect(chargeProblem({ ...ok, dueOn: "2027-08-21" }, TODAY)).toBeNull();
    expect(chargeProblem({ ...ok, dueOn: "2025-08-19" }, TODAY)).toBeNull();
  });
  it("refuses an amount outside 1 cent to $100,000", () => {
    expect(chargeProblem({ ...ok, amountCents: 0 }, TODAY)).toMatch(/amount/i);
    expect(chargeProblem({ ...ok, amountCents: -100 }, TODAY)).toMatch(/amount/i);
    expect(chargeProblem({ ...ok, amountCents: 1.5 }, TODAY)).toMatch(/amount/i);
    expect(chargeProblem({ ...ok, amountCents: MAX_CHARGE_CENTS + 1 }, TODAY)).toMatch(/at most/i);
  });
  it("refuses an empty or long label, trimmed", () => {
    expect(chargeProblem({ ...ok, label: "   " }, TODAY)).toMatch(/what the charge is for/i);
    expect(chargeProblem({ ...ok, label: "x".repeat(81) }, TODAY)).toMatch(/80/);
    expect(chargeProblem({ ...ok, label: `  ${"x".repeat(80)}  ` }, TODAY)).toBeNull();
  });
  it("refuses a due date more than 366 days either way, or none", () => {
    expect(chargeProblem({ ...ok, dueOn: "2027-08-22" }, TODAY)).toMatch(/within a year/i);
    expect(chargeProblem({ ...ok, dueOn: "2025-08-18" }, TODAY)).toMatch(/within a year/i);
    expect(chargeProblem({ ...ok, dueOn: "" }, TODAY)).toMatch(/due date/i);
  });
});

describe("chargeAllLine", () => {
  it("shows homes times amount equals total", () => {
    expect(chargeAllLine(12, 25000)).toBe("12 homes × $250.00 = $3,000.00");
  });
  it("says home for one", () => {
    expect(chargeAllLine(1, 8500)).toBe("1 home × $85.00 = $85.00");
  });
});
