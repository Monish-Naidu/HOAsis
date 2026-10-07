import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import {
  duesCollection,
  homeCount,
  ledgerTotals,
  monthlyFlowsBetween,
  operatingRunway,
  spendingBetween,
  vendorPaidThisYear,
  yearSummary,
} from "@/lib/metrics";
import { addStatementLine, balanceSplit, compareStatement, isDuesLine, orderStatement } from "@/lib/statement";
import { statementLines } from "@/lib/data/remote";
import type { ChargeLine, LedgerEntry, Home } from "@/lib/types";

const c = mehrMeadows;
const AUG_20 = "2026-08-20";

describe("what was billed is the dues lines on the statements", () => {
  const before = duesCollection(c, 2026);

  it("is the sum of every dues line that has fallen due, month by month", () => {
    // Eight months billed, every home on every one: 88 homes at $285.
    expect(before.months).toHaveLength(8);
    expect(before.expectedYtd).toBe(88 * 28_500 * 8);
    const lines = Object.values(c.homeCharges)
      .flat()
      .filter((l) => isDuesLine(l) && l.date >= "2026-01-01" && l.date < "2026-09-01");
    expect(before.expectedYtd).toBe(lines.reduce((t, l) => t + l.amountCents, 0));
  });

  it("does not move when a home's dues change", () => {
    const homes = c.homes.map((o) => (o.unit === "42" ? { ...o, duesCents: 31_000 } : o));
    const after = duesCollection({ ...c, homes }, 2026);
    expect(after.expectedYtd).toBe(before.expectedYtd);
    expect(after.rate).toBe(before.rate);
    // The next bill is what the rate moves.
    expect(after.expectedCents).toBe(before.expectedCents + 2_500);
  });

  it("does not move when a home is added, and counts it from its first bill", () => {
    const added: Home = { ...c.homes[1], id: "own-new", unit: "999", duesCents: undefined };
    const withHome: Community = { ...c, homes: [...c.homes, added] };
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
    const billed = duesCollection({ ...withHome, homeCharges: { ...c.homeCharges, "own-new": [augBill] } }, 2026);
    expect(billed.expectedYtd).toBe(before.expectedYtd + 28_500);
    expect(billed.months[0].expectedCents).toBe(before.months[0].expectedCents);
  });

  it("leaves a bill that has not fallen due out of the year so far", () => {
    // September's bill is on the statements on August 20 and is not billed yet.
    const posted = Object.values(c.homeCharges).flat().filter((l) => l.date === "2026-09-01");
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
    expect(homeCount(c)).toBe(c.homes.length);
    const added: Home = { ...c.homes[1], id: "own-new", unit: "999" };
    // The stored count says 88 and the register says 89: the register wins.
    expect(homeCount({ ...c, homes: [...c.homes, added] })).toBe(c.association.unitCount + 1);
  });

  it("falls back to the stored count only before the register has loaded", () => {
    expect(homeCount({ ...c, homes: [] })).toBe(c.association.unitCount);
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
    const me = c.homes.find((o) => o.unit === "42")!;
    const split = balanceSplit(c.homeCharges[me.id], me.balanceCents, AUG_20);
    expect(me.daysPastDue).toBe(0);
    expect(split.owedNowCents).toBe(0);
    expect(split.notYetDueCents).toBe(me.balanceCents);
    // And for every home: nothing owed now exactly when it is not past due.
    for (const o of c.homes) {
      const s = balanceSplit(c.homeCharges[o.id] ?? [], o.balanceCents, AUG_20);
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

/** The two lines a hand-recorded check writes, and the two a reversal adds, as the database and the demo write them (0083, 0088). */
function checkAndReversal(homeId: string, paidOn: string, reversedOn: string, cents: number) {
  const ledger = (id: string, date: string, description: string, amountCents: number): LedgerEntry => ({
    id, date, description, counterparty: "Owner", category: "Assessments", accountId: "acct-operating",
    amountCents, status: "cleared", homeId,
  });
  return {
    payment: { id: "chk", date: paidOn, label: "Check payment #1", kind: "payment", amountCents: -cents, balanceAfterCents: 0 } as ChargeLine,
    reversal: { id: "rev", date: reversedOn, label: "Payment reversed: entered twice", kind: "charge", amountCents: cents, balanceAfterCents: 0, category: "other" } as ChargeLine,
    deposit: ledger("led-chk", paidOn, "Assessment payment, unit 42", cents),
    takenBack: ledger("led-rev", reversedOn, "Payment reversed, unit 42", -cents),
  };
}

describe("a payment recorded and then reversed", () => {
  const home = c.homes[0];
  const homeCharges = (extra: ChargeLine[]) => ({ ...c.homeCharges, [home.id]: [...extra, ...(c.homeCharges[home.id] ?? [])] });
  const figures = (x: Community) => ({
    collected: duesCollection(x, 2026),
    flows: monthlyFlowsBetween(x, "2026-01-01", AUG_20),
    spending: spendingBetween(x, "2026-01-01", "2026-12-31"),
    year: yearSummary(x, 2026),
    totals: ledgerTotals(x.ledger),
  });
  const before = figures(c);
  const { payment, reversal, deposit, takenBack } = checkAndReversal(home.id, "2026-08-10", "2026-08-12", 100);

  it("leaves collected, money in and spending exactly where they were", () => {
    const after = figures({
      ...c,
      homeCharges: homeCharges([reversal, payment]),
      ledger: [takenBack, deposit, ...c.ledger],
    });
    expect(after.collected.collectedYtd).toBe(before.collected.collectedYtd);
    expect(after.collected.rate).toBe(before.collected.rate);
    expect(after.flows).toEqual(before.flows);
    expect(after.spending).toEqual(before.spending);
    expect(after.year.incomeCents).toBe(before.year.incomeCents);
    expect(after.year.spendCents).toBe(before.year.spendCents);
    expect(after.totals.inCents).toBe(before.totals.inCents);
    expect(after.totals.outCents).toBe(before.totals.outCents);
  });

  it("is not spending, and not a category, while the payment alone is money in", () => {
    const only = figures({ ...c, ledger: [takenBack, ...c.ledger] });
    expect(only.spending).toEqual(before.spending);
    const paid = figures({ ...c, homeCharges: homeCharges([payment]), ledger: [deposit, ...c.ledger] });
    expect(paid.collected.collectedYtd).toBe(before.collected.collectedYtd + 100);
    expect(paid.year.incomeCents).toBe(before.year.incomeCents + 100);
  });

  it("takes a reversal off in the month it happens, not the month of the payment", () => {
    // Paid in July, taken back in August: July keeps the dollar, August loses it.
    const lines = checkAndReversal(home.id, "2026-07-10", "2026-08-12", 100);
    const x: Community = { ...c, homeCharges: homeCharges([lines.reversal, lines.payment]), ledger: [lines.takenBack, lines.deposit, ...c.ledger] };
    const flows = monthlyFlowsBetween(x, "2026-07-01", AUG_20);
    const base = monthlyFlowsBetween(c, "2026-07-01", AUG_20);
    expect(flows[0].inCents).toBe(base[0].inCents + 100);
    expect(flows[1].inCents).toBe(base[1].inCents - 100);
    expect(flows[1].outCents).toBe(base[1].outCents);
    const months = duesCollection(x, 2026).months;
    const baseMonths = duesCollection(c, 2026).months;
    expect(months.find((m) => m.label === "Jul")!.collectedCents).toBe(baseMonths.find((m) => m.label === "Jul")!.collectedCents + 100);
    expect(months.find((m) => m.label === "Aug")!.collectedCents).toBe(baseMonths.find((m) => m.label === "Aug")!.collectedCents - 100);
  });

  it("does not take a card fee pass-through for a reversal", () => {
    const fee: LedgerEntry = { ...takenBack, id: "fee", description: "Card fee pass-through, August", amountCents: -4_120 };
    expect(spendingBetween({ ...c, ledger: [fee, ...c.ledger] }, "2026-08-01", AUG_20).totalCents)
      .toBe(spendingBetween(c, "2026-08-01", AUG_20).totalCents + 4_120);
  });
});

describe("the current month does not flip the year", () => {
  const OCT_6 = "2026-10-06";
  const home = c.homes[0];
  const at = (x: Community): Community => ({ ...x, asOf: OCT_6 });
  const base = at(c);
  const paid: Community = at({
    ...c,
    homeCharges: {
      ...c.homeCharges,
      [home.id]: [
        { id: "oct", date: OCT_6, label: "Check payment", kind: "payment", amountCents: -100, balanceAfterCents: 0 },
        ...(c.homeCharges[home.id] ?? []),
      ],
    },
    ledger: [
      { id: "oct-led", date: OCT_6, description: "Assessment payment, unit 1", counterparty: "Owner", category: "Assessments", accountId: "acct-operating", amountCents: 100, status: "cleared" },
      ...c.ledger,
    ],
  });

  it("keeps the year's rate and totals when a payment lands before the month's bill posts", () => {
    const a = duesCollection(base, 2026, OCT_6);
    const b = duesCollection(paid, 2026, OCT_6);
    expect(b.months).toEqual(a.months);
    expect(b.expectedYtd).toBe(a.expectedYtd);
    expect(b.collectedYtd).toBe(a.collectedYtd);
    expect(b.rate).toBe(a.rate);
    expect(b.months.map((m) => m.label)).not.toContain("Oct");
  });

  it("shows the month's own bill apart, as not yet posted", () => {
    const b = duesCollection(paid, 2026, OCT_6);
    expect(b.thisMonth).toEqual({ month: 10, label: "Oct", expectedCents: b.expectedCents, collectedCents: 100 });
    // A month whose dues line exists is a billed month, not "this month's".
    expect(duesCollection(c, 2026).thisMonth).toBeUndefined();
  });

  it("counts a month once its dues line exists, and rates a past month nobody paid at zero", () => {
    const x = duesCollection(base, 2026, OCT_6);
    // September's bill is posted and unpaid on October 6: billed, nothing in.
    const sep = x.months.find((m) => m.label === "Sep")!;
    const posted = Object.values(c.homeCharges).flat().filter((l) => isDuesLine(l) && l.date === "2026-09-01");
    expect(sep.expectedCents).toBe(posted.reduce((t, l) => t + l.amountCents, 0));
    expect(sep.collectedCents).toBe(0);
  });

  it("leaves the typical month alone while the month is still going", () => {
    const a = operatingRunway(base, OCT_6);
    const b = operatingRunway(paid, OCT_6);
    expect(b).toEqual(a);
  });
});

describe("what a vendor was paid this year is what Transactions lists", () => {
  const vendor = { id: "v-walk", name: "Walk Test Plumbing" };
  const line = (id: string, date: string, amountCents: number, patch: Partial<LedgerEntry> = {}): LedgerEntry => ({
    id, date, description: "Plumbing", counterparty: vendor.name, category: "Repairs & maintenance",
    accountId: "acct-operating", amountCents, status: "cleared", ...patch,
  });
  const x = (ledger: LedgerEntry[], payouts: Community["payouts"] = []): Community => ({ ...c, ledger, payouts, vendors: [] });

  it("sums ledger lines by counterparty when there is no payout row", () => {
    const ledger = [line("a", "2026-08-01", -100), line("b", "2026-03-02", -2_500)];
    expect(vendorPaidThisYear(x(ledger), vendor, AUG_20)).toBe(2_600);
  });

  it("matches by payout when the line carries one, whatever the counterparty says", () => {
    const payouts = [{ id: "po-1", vendorId: vendor.id } as Community["payouts"][number]];
    const ledger = [line("a", "2026-08-01", -700, { counterparty: "Walk Plumbing LLC", payoutId: "po-1" })];
    expect(vendorPaidThisYear(x(ledger, payouts), vendor, AUG_20)).toBe(700);
  });

  it("leaves out other years, money in, lines held for review and other vendors", () => {
    const ledger = [
      line("old", "2025-12-30", -9_000),
      line("refund", "2026-05-01", 400),
      line("held", "2026-06-01", -300, { status: "needs-review" }),
      line("other", "2026-06-02", -500, { counterparty: "Someone Else" }),
      line("ok", "2026-06-03", -100),
    ];
    expect(vendorPaidThisYear(x(ledger), vendor, AUG_20)).toBe(100);
  });

  it("is the sum Transactions shows for that vendor in the year", () => {
    const some = c.vendors[0];
    const listed = ledgerTotals(c.ledger.filter((e) => e.counterparty === some.name && e.date.startsWith("2026"))).outCents;
    expect(vendorPaidThisYear(c, some, AUG_20)).toBe(listed);
  });
});
