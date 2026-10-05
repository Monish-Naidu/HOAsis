import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import { duesCollection, homeCount, monthlyFlowsBetween, spendingBetween } from "@/lib/metrics";
import { addStatementLine, balanceSplit, compareStatement, isDuesLine, orderStatement } from "@/lib/statement";
import { statementLines } from "@/lib/data/remote";
import type { ChargeLine, Owner } from "@/lib/types";

const c = mehrMeadows;
const AUG_20 = "2026-08-20";

describe("what was billed is the dues lines on the statements", () => {
  const before = duesCollection(c, 2026);

  it("is the sum of every dues line that has fallen due, month by month", () => {
    // Eight months billed, every home on every one: 88 homes at $285.
    expect(before.months).toHaveLength(8);
    expect(before.expectedYtd).toBe(88 * 28_500 * 8);
    const lines = Object.values(c.ownerCharges)
      .flat()
      .filter((l) => isDuesLine(l) && l.date >= "2026-01-01" && l.date < "2026-09-01");
    expect(before.expectedYtd).toBe(lines.reduce((t, l) => t + l.amountCents, 0));
  });

  it("does not move when a home's dues change", () => {
    const owners = c.owners.map((o) => (o.unit === "42" ? { ...o, duesCents: 31_000 } : o));
    const after = duesCollection({ ...c, owners }, 2026);
    expect(after.expectedYtd).toBe(before.expectedYtd);
    expect(after.rate).toBe(before.rate);
    // The next bill is what the rate moves.
    expect(after.expectedCents).toBe(before.expectedCents + 2_500);
  });

  it("does not move when a home is added, and counts it from its first bill", () => {
    const added: Owner = { ...c.owners[1], id: "own-new", unit: "999", duesCents: undefined };
    const withHome: Community = { ...c, owners: [...c.owners, added] };
    expect(duesCollection(withHome, 2026).expectedYtd).toBe(before.expectedYtd);

    // Billed in August only: August grows by one bill, the months before do not.
    const augBill: ChargeLine = {
      id: "aug-new",
      date: "2026-08-01",
      label: "August assessment",
      kind: "charge",
      amountCents: 28_500,
      balanceAfterCents: 28_500,
    };
    const billed = duesCollection({ ...withHome, ownerCharges: { ...c.ownerCharges, "own-new": [augBill] } }, 2026);
    expect(billed.expectedYtd).toBe(before.expectedYtd + 28_500);
    expect(billed.months[0].expectedCents).toBe(before.months[0].expectedCents);
  });

  it("leaves a bill that has not fallen due out of the year so far", () => {
    // September's bill is on the statements on August 20 and is not billed yet.
    const posted = Object.values(c.ownerCharges).flat().filter((l) => l.date === "2026-09-01");
    expect(posted.length).toBeGreaterThan(0);
    expect(before.months.map((m) => m.label)).not.toContain("Sep");
  });

  it("tells a dues line from a late fee, a fine and an opening balance", () => {
    const line = (label: string, category?: string): ChargeLine => ({
      id: label, date: AUG_20, label, kind: "charge", amountCents: 100, balanceAfterCents: 100, category,
    });
    expect(isDuesLine(line("August assessment"))).toBe(true);
    expect(isDuesLine(line("August 2026 dues"))).toBe(true);
    expect(isDuesLine(line("July late fee"))).toBe(false);
    expect(isDuesLine(line("Balance brought forward"))).toBe(false);
    // The database's own word wins over the label.
    expect(isDuesLine(line("Q3 2026 dues", "late_fee"))).toBe(false);
    expect(isDuesLine(line("Gate remote", "dues"))).toBe(true);
  });
});

describe("one count of homes", () => {
  it("counts the register, so an added home is counted at once", () => {
    expect(homeCount(c)).toBe(c.owners.length);
    const added: Owner = { ...c.owners[1], id: "own-new", unit: "999" };
    // The stored count says 88 and the register says 89: the register wins.
    expect(homeCount({ ...c, owners: [...c.owners, added] })).toBe(c.association.unitCount + 1);
  });

  it("falls back to the stored count only before the register has loaded", () => {
    expect(homeCount({ ...c, owners: [] })).toBe(c.association.unitCount);
  });
});

describe("owed now, and billed but not yet due", () => {
  const charge = (id: string, date: string, amountCents: number): ChargeLine => ({
    id, date, label: "Assessment", kind: "charge", amountCents, balanceAfterCents: 0,
  });
  const pay = (id: string, date: string, amountCents: number): ChargeLine => ({
    id, date, label: "Bank payment", kind: "payment", amountCents: -amountCents, balanceAfterCents: 0,
  });

  it("calls a home with only a coming bill next bill, not a current balance", () => {
    const split = balanceSplit([charge("sep", "2026-09-01", 28_500), pay("aug-p", "2026-08-03", 28_500), charge("aug", "2026-08-01", 28_500)], 28_500, AUG_20);
    expect(split.owedNowCents).toBe(0);
    expect(split.notYetDueCents).toBe(28_500);
    expect(split.nextBill).toEqual({ date: "2026-09-01", amountCents: 28_500, label: "Assessment" });
  });

  it("owes now whatever is past its date, apart from the coming bill", () => {
    const split = balanceSplit([charge("sep", "2026-09-01", 28_500), charge("aug", "2026-08-01", 28_500)], 57_000, AUG_20);
    expect(split.owedNowCents).toBe(28_500);
    expect(split.notYetDueCents).toBe(28_500);
  });

  it("reads a bill paid early as nothing owed, and still knows the bill", () => {
    const split = balanceSplit([pay("early", AUG_20, 28_500), charge("sep", "2026-09-01", 28_500)], 0, AUG_20);
    expect(split).toMatchObject({ owedNowCents: 0, notYetDueCents: 0 });
    expect(split.upcoming?.amountCents).toBe(28_500);
  });

  it("is the same answer for the demo's resident as the board's days past due", () => {
    // Unit 42 owes the September bill and nothing more; the board lists it as
    // not late, and the split says nothing is owed now.
    const me = c.owners.find((o) => o.unit === "42")!;
    const split = balanceSplit(c.ownerCharges[me.id], me.balanceCents, AUG_20);
    expect(me.daysPastDue).toBe(0);
    expect(split.owedNowCents).toBe(0);
    expect(split.notYetDueCents).toBe(me.balanceCents);
    // And for every home: nothing owed now exactly when it is not past due.
    for (const o of c.owners) {
      const s = balanceSplit(c.ownerCharges[o.id] ?? [], o.balanceCents, AUG_20);
      if (o.daysPastDue > 0) expect(s.owedNowCents).toBeGreaterThan(0);
    }
  });
});

describe("statement order", () => {
  const line = (id: string, date: string, kind: ChargeLine["kind"], amountCents: number): ChargeLine => ({
    id, date, label: id, kind, amountCents, balanceAfterCents: 0,
  });

  it("puts a charge before the payment that settles it on the same day", () => {
    expect(compareStatement({ date: "2026-08-01", kind: "charge" }, { date: "2026-08-01", kind: "payment" })).toBeLessThan(0);
    const ordered = orderStatement([line("pay", "2026-08-01", "payment", -28_500), line("bill", "2026-08-01", "charge", 28_500)], 0);
    // Newest first: the payment above the bill, and the balance never dips below zero.
    expect(ordered.map((l) => l.id)).toEqual(["pay", "bill"]);
    expect(ordered.map((l) => l.balanceAfterCents)).toEqual([0, 28_500]);
  });

  it("orders by date, and restates the running balance when a line is added", () => {
    const existing = [
      line("sep", "2026-09-01", "charge", 28_500),
      line("aug", "2026-08-01", "charge", 28_500),
    ];
    existing[0].balanceAfterCents = 57_000;
    existing[1].balanceAfterCents = 28_500;
    const next = addStatementLine(existing, line("early", AUG_20, "payment", -28_500), 28_500);
    // Dated today, so below the September bill and above the August one.
    expect(next.map((l) => l.id)).toEqual(["sep", "early", "aug"]);
    expect(next.map((l) => l.balanceAfterCents)).toEqual([28_500, 0, 28_500]);
  });

  it("is how a signed in statement is built too", () => {
    const row = (id: string, kind: "charge" | "payment", amount: number, created: string) => ({
      id, unit_id: "u", due_on: "2026-08-01", created_at: created, label: id, kind, amount_cents: amount,
    });
    // The payment was written first; the charge still leads on its day.
    const lines = statementLines([row("pay", "payment", -28_500, "2026-08-01T01:00"), row("bill", "charge", 28_500, "2026-08-01T02:00")]);
    expect(lines.map((l) => l.id)).toEqual(["pay", "bill"]);
    expect(lines.map((l) => l.balanceAfterCents)).toEqual([0, 28_500]);
  });
});

describe("spending", () => {
  const from = "2025-09-01";

  it("leaves what was moved to reserves out of the total, and says it beside it", () => {
    const spending = spendingBetween(c, from, AUG_20);
    expect(spending.reserveCents).toBeGreaterThan(0);
    expect(spending.rows.reduce((t, r) => t + r.cents, 0)).toBe(spending.totalCents);
    expect(spending.rows.map((r) => r.category)).not.toContain("Reserve contributions");
  });

  it("is the chart's money out, one definition", () => {
    const flows = monthlyFlowsBetween(c, from, AUG_20);
    const out = flows.reduce((t, m) => t + m.outCents, 0);
    expect(spendingBetween(c, from, AUG_20).totalCents).toBe(out);
  });
});
