import { describe, expect, it } from "vitest";
import { buildOwnerLedger } from "@/lib/data/owner-ledger";
import { allCommunities } from "@/lib/data/communities";
import type { Owner } from "@/lib/types";
import { buildCommunity } from "@/lib/data/new-community";

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
    for (const community of allCommunities()) {
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

describe("a community built through onboarding", () => {
  const draft = {
    name: "Cedar Hollow Homeowners Association",
    city: "Bothell",
    state: "WA",
    stateName: "Washington",
    duesCents: 4_500,
    duesCadence: "monthly" as const,
    dueDay: 1,
    founder: { name: "Dana Whitcomb", email: "dana@example.com", unit: "1" },
    households: [
      { name: "Marcus Bell", email: "marcus@example.com", unit: "2" },
      { name: "Yuki Tanaka", email: "yuki@example.com", unit: "3" },
    ],
    collects: [],
    sharedSpaces: [],
  };

  it("starts empty rather than seeded with sample data", () => {
    const c = buildCommunity(draft, "2026-08-24");
    for (const slice of ["ledger", "vendors", "payouts", "requests", "documents", "ballots", "posts", "bankAccounts", "reserveComponents"] as const) {
      expect(c[slice], slice).toHaveLength(0);
    }
  });

  it("makes the founder President with the permissions capability", () => {
    const c = buildCommunity(draft, "2026-08-24");
    const president = c.accounts.find((a) => a.role === "president")!;
    expect(president.name).toBe("Dana Whitcomb");
    expect(president.capabilities.permissions).toBe(true);
  });

  it("makes everyone else a resident, since officers are appointed later", () => {
    const c = buildCommunity(draft, "2026-08-24");
    const others = c.accounts.filter((a) => a.role !== "president");
    expect(others).toHaveLength(2);
    expect(others.every((a) => a.role === "resident")).toBe(true);
    expect(others.every((a) => a.capabilities.finances === false)).toBe(true);
  });

  it("counts the roster as the association's homes", () => {
    // One number, not two that have to agree.
    const c = buildCommunity(draft, "2026-08-24");
    expect(c.association.unitCount).toBe(3);
    expect(c.owners).toHaveLength(3);
  });

  it("budgets the assessment income it can infer, and nothing it cannot", () => {
    const c = buildCommunity(draft, "2026-08-24");
    expect(c.budget).toHaveLength(1);
    expect(c.budget[0].annualCents).toBe(4_500 * 12 * 3);
    expect(c.budget[0].ytdActualCents).toBe(0);
  });

  it("bills on the next occurrence of the due day", () => {
    expect(buildCommunity(draft, "2026-08-24").nextChargeDate).toBe("2026-09-01");
    expect(buildCommunity({ ...draft, dueDay: 28 }, "2026-08-24").nextChargeDate).toBe("2026-08-28");
  });

  it("gives every household an account and an empty ledger", () => {
    const c = buildCommunity(draft, "2026-08-24");
    expect(c.owners).toHaveLength(3);
    expect(c.accounts).toHaveLength(3);
    for (const owner of c.owners) expect(c.ownerCharges[owner.id]).toEqual([]);
  });

  it("keeps two associations of the same name apart", () => {
    const a = buildCommunity(draft, "2026-08-24");
    const b = buildCommunity(
      { ...draft, city: "Kirkland", founder: { ...draft.founder, email: "other@example.com" } },
      "2026-08-24",
    );
    expect(a.id).not.toBe(b.id);
  });
});
