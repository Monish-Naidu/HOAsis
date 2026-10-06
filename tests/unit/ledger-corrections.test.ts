import { describe, expect, it } from "vitest";
import { canReverse, correctionCents, reversalLine, withReversals } from "@/lib/ledger-corrections";
import type { LedgerEntry } from "@/lib/types";

const line = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: "a",
  date: "2026-08-01",
  description: "Lawn service",
  counterparty: "Evergreen",
  category: "Landscaping",
  accountId: "acct",
  amountCents: -45_000,
  status: "needs-review",
  suggestedCategory: "Landscaping",
  ...over,
});

describe("reversalLine", () => {
  it("is the opposite amount, dated today, confirmed, and points at the original", () => {
    const r = reversalLine(line(), "r", "2026-08-20");
    expect(r).toMatchObject({
      id: "r",
      date: "2026-08-20",
      description: "Reversal: Lawn service",
      amountCents: 45_000,
      category: "Landscaping",
      accountId: "acct",
      status: "cleared",
      reversedEntryId: "a",
    });
  });
});

describe("withReversals", () => {
  it("marks the reversed line and settles it out of the review queue", () => {
    const out = withReversals([reversalLine(line(), "r", "2026-08-20"), line()]);
    const original = out.find((e) => e.id === "a")!;
    expect(original.reversedById).toBe("r");
    expect(original.status).toBe("cleared");
    expect(original.suggestedCategory).toBeUndefined();
    // The pair nets to nothing.
    expect(out.reduce((t, e) => t + e.amountCents, 0)).toBe(0);
  });

  it("leaves other lines and a confirmed line's status alone", () => {
    const other = line({ id: "b" });
    const confirmed = line({ status: "cleared" });
    const out = withReversals([reversalLine(confirmed, "r", "2026-08-20"), confirmed, other]);
    expect(out.find((e) => e.id === "a")!.status).toBe("cleared");
    expect(out.find((e) => e.id === "b")).toBe(other);
  });

  it("is a plain copy when nothing was reversed", () => {
    const input = [line()];
    expect(withReversals(input)).toEqual(input);
  });
});

describe("canReverse", () => {
  it("is for a waiting line that is not a reversal and was not reversed", () => {
    expect(canReverse(line())).toBe(true);
    expect(canReverse(line({ status: "cleared" }))).toBe(false);
    expect(canReverse(line({ reversedById: "r" }))).toBe(false);
    expect(canReverse(line({ reversedEntryId: "z" }))).toBe(false);
  });
});

describe("correctionCents", () => {
  it("is what to add on top of what is already on the books", () => {
    expect(correctionCents([], 50_000)).toBe(50_000);
    expect(correctionCents([30_000], 50_000)).toBe(20_000);
    expect(correctionCents([30_000, 5_000], 4_000)).toBe(-31_000);
    expect(correctionCents([30_000], 30_000)).toBe(0);
  });
});
