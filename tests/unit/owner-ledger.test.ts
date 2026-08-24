import { describe, expect, it } from "vitest";
import { buildOwnerLedger } from "@/lib/data/owner-ledger";
import { communities } from "@/lib/data/communities";
import type { Owner } from "@/lib/types";

const base: Owner = {
  id: "own-001",
  displayName: "Test Household",
  members: ["Test Household"],
  email: "t@example.com",
  phone: "(425) 555-0100",
  unit: "1",
  address: "1 Test Lane",
  moveInDate: "2019-01-01",
  balanceCents: 0,
  autopay: false,
  standing: "current",
  daysPastDue: 0,
};

const opts = { assessmentCents: 28_500, nextChargeDate: "2026-09-01" };

describe("buildOwnerLedger", () => {
  it("closes on the owner's roster balance", () => {
    for (const balanceCents of [0, 28_500, 57_000, 61_900, 96_400]) {
      const lines = buildOwnerLedger({ ...base, balanceCents }, opts);
      expect(lines[0]?.balanceAfterCents ?? 0, `balance ${balanceCents}`).toBe(balanceCents);
    }
  });

  it("is newest first", () => {
    const lines = buildOwnerLedger({ ...base, balanceCents: 57_000 }, opts);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i - 1].date >= lines[i].date).toBe(true);
    }
  });

  it("never bills before the household moved in", () => {
    const lines = buildOwnerLedger({ ...base, moveInDate: "2026-07-15" }, opts);
    expect(lines.every((l) => l.date >= "2026-07-15")).toBe(true);
  });

  it("is deterministic", () => {
    const a = JSON.stringify(buildOwnerLedger(base, opts));
    const b = JSON.stringify(buildOwnerLedger(base, opts));
    expect(a).toBe(b);
  });

  it("turns a balance that is not a clean multiple into a late fee", () => {
    const lines = buildOwnerLedger({ ...base, balanceCents: 61_900 }, opts);
    const late = lines.find((l) => l.label.includes("late fee"));
    expect(late?.amountCents).toBe(61_900 - 2 * 28_500);
  });

  it("gives every household in every community a ledger that agrees with the roster", () => {
    for (const community of communities) {
      for (const owner of community.owners) {
        const lines = community.ownerCharges[owner.id];
        expect(lines, `${community.id} ${owner.id}`).toBeDefined();
        expect(lines[0]?.balanceAfterCents ?? 0, `${community.id} ${owner.displayName}`).toBe(
          owner.balanceCents,
        );
      }
    }
  });
});

describe("deep arrears", () => {
  it("writes enough history to carry a year of missed assessments", () => {
    const lines = buildOwnerLedger({ ...base, balanceCents: 342_000, standing: "collections" }, opts);
    expect(lines[0].balanceAfterCents).toBe(342_000);
    const fees = lines.filter((l) => l.label.includes("late fee"));
    expect(fees).toHaveLength(0);
    expect(lines.filter((l) => l.kind === "charge").length).toBeGreaterThanOrEqual(12);
  });
});
