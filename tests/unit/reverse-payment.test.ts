import { describe, expect, it } from "vitest";
import {
  duplicatePaymentWarning,
  findDuplicatePayment,
  pairManualPayments,
  recentManualPayments,
  reversalReasonProblem,
  type ManualPaymentRow,
} from "@/lib/payments/manual-payments";

const row = (over: Partial<ManualPaymentRow> = {}): ManualPaymentRow => ({
  id: "p1",
  amountCents: 28_500,
  method: "check",
  receivedOn: "2026-08-20",
  reference: "1042",
  reversed: false,
  ...over,
});

describe("reversalReasonProblem", () => {
  it("accepts 3 to 120 characters after trimming", () => {
    expect(reversalReasonProblem("abc")).toBeNull();
    expect(reversalReasonProblem("  Entered twice  ")).toBeNull();
    expect(reversalReasonProblem("x".repeat(120))).toBeNull();
  });
  it("refuses a reason that is too short or too long", () => {
    expect(reversalReasonProblem("")).not.toBeNull();
    expect(reversalReasonProblem("a")).not.toBeNull();
    expect(reversalReasonProblem("  ab  ")).not.toBeNull();
    expect(reversalReasonProblem("x".repeat(121))).not.toBeNull();
  });
});

describe("findDuplicatePayment", () => {
  const next = { amountCents: 28_500, receivedOn: "2026-08-20" };
  it("finds a live payment with the same amount and date", () => {
    expect(findDuplicatePayment([row()], next)?.id).toBe("p1");
  });
  it("ignores a different reference or method", () => {
    expect(findDuplicatePayment([row({ reference: "9", method: "cash" })], next)).not.toBeNull();
  });
  it("ignores a reversed payment", () => {
    expect(findDuplicatePayment([row({ reversed: true })], next)).toBeNull();
  });
  it("ignores a different amount or date", () => {
    expect(findDuplicatePayment([row({ amountCents: 100 })], next)).toBeNull();
    expect(findDuplicatePayment([row({ receivedOn: "2026-08-19" })], next)).toBeNull();
  });
  it("finds nothing for an empty form", () => {
    expect(findDuplicatePayment([row()], { amountCents: 0, receivedOn: "2026-08-20" })).toBeNull();
    expect(findDuplicatePayment([row()], { amountCents: 28_500, receivedOn: "" })).toBeNull();
  });
});

describe("duplicatePaymentWarning", () => {
  it("names the home, the amount, the method and the date", () => {
    // formatDate leaves the year off for the current one.
    expect(duplicatePaymentWarning("Unit 4", row())).toMatch(
      /^Unit 4 already has a \$285\.00 check recorded for Aug 20(, 2026)?\.$/,
    );
    expect(duplicatePaymentWarning("Unit 4", row({ method: "cash" }))).toMatch(/\$285\.00 cash payment recorded/);
  });
});

describe("recentManualPayments", () => {
  it("lists newest first and at most ten", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row({ id: `p${i}`, receivedOn: `2026-08-${String(i + 1).padStart(2, "0")}` }),
    );
    const out = recentManualPayments(rows);
    expect(out).toHaveLength(10);
    expect(out[0].id).toBe("p11");
  });
});

describe("pairManualPayments", () => {
  it("reads the date and reference off the matching statement line, in order", () => {
    const rows = pairManualPayments(
      [
        { id: "a", amountCents: 100, method: "check", reversed: true, createdOn: "2026-08-20" },
        { id: "b", amountCents: 100, method: "check", reversed: false, createdOn: "2026-08-20" },
        { id: "c", amountCents: 50, method: "cash", reversed: false, createdOn: "2026-08-20" },
      ],
      [
        { label: "Check payment #1", amountCents: 100, date: "2026-08-01" },
        { label: "Check payment #2", amountCents: 100, date: "2026-08-02" },
        { label: "Cash payment", amountCents: 50, date: "2026-08-03" },
      ],
    );
    expect(rows.map((r) => [r.id, r.receivedOn, r.reference])).toEqual([
      ["a", "2026-08-01", "1"],
      ["b", "2026-08-02", "2"],
      ["c", "2026-08-03", ""],
    ]);
    expect(rows[0].reversed).toBe(true);
  });
  it("falls back to the day it was recorded when no line matches", () => {
    const [r] = pairManualPayments(
      [{ id: "a", amountCents: 100, method: "cash", reversed: false, createdOn: "2026-08-20" }],
      [],
    );
    expect(r.receivedOn).toBe("2026-08-20");
  });
});
