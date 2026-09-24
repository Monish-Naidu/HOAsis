import type { Community } from "@/lib/data/community";
import type { LedgerCategory } from "@/lib/types";
import { complianceRegister } from "@/lib/compliance";
import { daysFromToday } from "@/lib/utils";
import { totalDues } from "@/lib/home-types";

/**
 * Derived figures, as pure functions of one community.
 *
 * Nothing here is stored. Collection rate, percent funded, budget pace, and
 * the rest are all computed from the underlying records every time, so the
 * number on a summary tile cannot drift from the number on the detail screen.
 *
 * Taking the community as an argument rather than importing fixtures is what
 * makes a second association possible, and is also exactly the shape these
 * become once the data comes from a server.
 */

export function cashPosition(c: Community) {
  const operating = c.bankAccounts
    .filter((a) => a.kind === "operating")
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const reserve = c.bankAccounts
    .filter((a) => a.kind !== "operating")
    .reduce((sum, a) => sum + a.balanceCents, 0);
  return { operating, reserve, total: operating + reserve };
}

export function delinquency(c: Community) {
  const past = c.owners.filter((o) => o.daysPastDue > 0);
  // A home with nobody on record is not a household that is paying on time.
  // It was counted as one, so a new build with forty unsold lots read as
  // ninety percent current before anybody had paid anything.
  const households = c.owners.filter((o) => !o.placeholder).length;
  const billed = households || 1;
  return {
    past,
    households,
    current: households - past.filter((o) => !o.placeholder).length,
    totalCents: past.reduce((sum, o) => sum + o.balanceCents, 0),
    byBucket: {
      grace: past.filter((o) => o.standing === "grace"),
      late: past.filter((o) => o.standing === "late"),
      collections: past.filter((o) => o.standing === "collections"),
    },
    collectionRate: (households - past.filter((o) => !o.placeholder).length) / billed,
    autopayRate: c.owners.filter((o) => o.autopay && !o.placeholder).length / billed,
  };
}

export function budgetSummary(c: Community) {
  const income = c.budget.filter((b) => b.kind === "income");
  const expense = c.budget.filter((b) => b.kind === "expense");
  const sum = (rows: typeof c.budget, key: "annualCents" | "ytdActualCents") =>
    rows.reduce((total, r) => total + r[key], 0);
  const incomeYtd = sum(income, "ytdActualCents");
  const expenseYtd = sum(expense, "ytdActualCents");
  return {
    income,
    expense,
    incomeAnnual: sum(income, "annualCents"),
    expenseAnnual: sum(expense, "annualCents"),
    incomeYtd,
    expenseYtd,
    netYtd: incomeYtd - expenseYtd,
    /**
     * Share of budget spent or collected, or undefined when there is no budget
     * to measure against. A new association has an income line and no expense
     * lines, and dividing by that zero printed "NaN% of budget".
     */
    incomePace: sum(income, "annualCents") > 0 ? incomeYtd / sum(income, "annualCents") : undefined,
    expensePace:
      sum(expense, "annualCents") > 0 ? expenseYtd / sum(expense, "annualCents") : undefined,
    netAnnual: sum(income, "annualCents") - sum(expense, "annualCents"),
    yearElapsed: c.yearElapsed,
  };
}

export function reserveSummary(c: Community) {
  const funded = c.reserveComponents.reduce((t, x) => t + x.fundedCents, 0);
  const required = c.reserveComponents.reduce((t, x) => t + x.replacementCostCents, 0);
  return {
    funded,
    required,
    // An association with no study is not fully funded, it is unmeasured.
    percentFunded: required === 0 ? 0 : funded / required,
    hasStudy: c.reserveComponents.length > 0,
    urgent: c.reserveComponents
      .filter((x) => x.remainingLifeYears <= 3)
      .sort((a, b) => a.remainingLifeYears - b.remainingLifeYears),
  };
}

/** The calendar years the ledger touches, newest first, for the chart filter. */
export function ledgerYears(c: Community): number[] {
  const years = new Set<number>();
  for (const e of c.ledger) years.add(Number(e.date.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

/**
 * Money in and money out of the association, one row per month of the given
 * calendar year, January through December.
 *
 * Reserve transfers are excluded from both sides: moving cash between the
 * association's own accounts is neither income nor spending, and counting it
 * would inflate every month a board does the responsible thing.
 *
 * Figures, not pixels, so the same rows can back a chart and a CSV.
 */
export function monthlyFlows(c: Community, year: number, through?: string) {
  // A year still under way stops at the given month. Four empty months after
  // it read as four months of nothing coming in, and a screen reader table
  // said "$0.00" for money that simply has not had a chance to arrive.
  const last =
    through && Number(through.slice(0, 4)) === year ? Number(through.slice(5, 7)) : 12;
  const months = Array.from({ length: last }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    inCents: 0,
    outCents: 0,
  }));
  for (const e of c.ledger) {
    if (e.category === "Reserve transfer") continue;
    if (Number(e.date.slice(0, 4)) !== year) continue;
    const row = months[Number(e.date.slice(5, 7)) - 1];
    if (!row) continue;
    if (e.amountCents >= 0) row.inCents += e.amountCents;
    else row.outCents += -e.amountCents;
  }
  return months;
}

/**
 * Where the association's money went in the given year, largest first.
 *
 * The top five categories keep their own line; everything after folds into
 * "Other", because a sixth slice is where a donut stops being readable.
 * Money moved into reserves is shown as its own category, "Reserve
 * contributions", counting only the operating side of the transfer so the
 * receiving entry cannot double it.
 */
export function spendingByCategory(c: Community, year: number) {
  const totals = new Map<string, number>();
  for (const e of c.ledger) {
    if (e.amountCents >= 0) continue;
    if (Number(e.date.slice(0, 4)) !== year) continue;
    const label: LedgerCategory | "Reserve contributions" =
      e.category === "Reserve transfer" ? "Reserve contributions" : e.category;
    totals.set(label, (totals.get(label) ?? 0) - e.amountCents);
  }
  const sorted = [...totals.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents);
  const top = sorted.slice(0, 5);
  const otherCents = sorted.slice(5).reduce((t, r) => t + r.cents, 0);
  const rows = otherCents > 0 ? [...top, { category: "Other", cents: otherCents }] : top;
  const totalCents = rows.reduce((t, r) => t + r.cents, 0);
  return {
    rows: rows.map((r) => ({ ...r, share: totalCents ? r.cents / totalCents : 0 })),
    totalCents,
  };
}

/* -------------------------------------------------------------------------- */
/* Years: one year on its own, two side by side, and the run of them.          */
/* -------------------------------------------------------------------------- */

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthName(month: number, style: "short" | "long" = "short") {
  const long = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return style === "long" ? long[month - 1] : SHORT_MONTHS[month - 1];
}

/** The month (1 to 12) of the given entry. */
const monthOf = (date: string) => Number(date.slice(5, 7));
const yearOf = (date: string) => Number(date.slice(0, 4));

/**
 * One calendar year, totalled.
 *
 * Income and spend follow `monthlyFlows`: reserve transfers sit outside both,
 * and are reported on their own as `reserveCents`, the operating side of each
 * transfer. `throughMonth` is the last month with anything in it, which is
 * what makes a partial year comparable to a full one: August against August,
 * never eight months against twelve.
 */
export function yearSummary(c: Community, year: number, throughMonth = 12) {
  const flows = monthlyFlows(c, year).slice(0, throughMonth);
  const incomeCents = flows.reduce((t, m) => t + m.inCents, 0);
  const spendCents = flows.reduce((t, m) => t + m.outCents, 0);
  let reserveCents = 0;
  for (const e of c.ledger) {
    if (e.category !== "Reserve transfer" || e.amountCents >= 0) continue;
    if (yearOf(e.date) !== year || monthOf(e.date) > throughMonth) continue;
    reserveCents -= e.amountCents;
  }
  const withData = flows.map((m, i) => (m.inCents > 0 || m.outCents > 0 ? i + 1 : 0)).filter(Boolean);
  return {
    year,
    incomeCents,
    spendCents,
    netCents: incomeCents - spendCents,
    reserveCents,
    netAfterReserveCents: incomeCents - spendCents - reserveCents,
    monthsWithData: withData.length,
    /** Last month with a transaction, or 0 for a year with nothing. */
    throughMonth: withData.length ? withData[withData.length - 1] : 0,
    months: flows,
  };
}

export interface Delta {
  cents: number;
  /** Undefined when the earlier side is zero, because a change from nothing has no percent. */
  percent?: number;
}

export function delta(from: number, to: number): Delta {
  return { cents: to - from, percent: from ? (to - from) / Math.abs(from) : undefined };
}

/** Every spending category for one year, reserve funding included as its own line. */
function spendAllCategories(c: Community, year: number, throughMonth: number) {
  const totals = new Map<string, number>();
  for (const e of c.ledger) {
    if (e.amountCents >= 0) continue;
    if (yearOf(e.date) !== year || monthOf(e.date) > throughMonth) continue;
    const label = e.category === "Reserve transfer" ? "Reserve contributions" : e.category;
    totals.set(label, (totals.get(label) ?? 0) - e.amountCents);
  }
  return totals;
}

/**
 * Two years, side by side, like for like.
 *
 * When either year is partial, both are cut at the same month, so a treasurer
 * in August is reading January to August of each. The full-year figures stay
 * available on each side for the footnote.
 */
export function compareYears(c: Community, a: number, b: number) {
  const fullA = yearSummary(c, a);
  const fullB = yearSummary(c, b);
  const throughMonth = Math.min(fullA.throughMonth || 12, fullB.throughMonth || 12);
  const partial = throughMonth < 12;
  const left = yearSummary(c, a, throughMonth);
  const right = yearSummary(c, b, throughMonth);

  const months = Array.from({ length: throughMonth }, (_, i) => ({
    month: i + 1,
    label: SHORT_MONTHS[i],
    aIn: left.months[i].inCents,
    aOut: left.months[i].outCents,
    bIn: right.months[i].inCents,
    bOut: right.months[i].outCents,
  }));

  const catA = spendAllCategories(c, a, throughMonth);
  const catB = spendAllCategories(c, b, throughMonth);
  const categories = [...new Set([...catA.keys(), ...catB.keys()])]
    .map((category) => {
      const aCents = catA.get(category) ?? 0;
      const bCents = catB.get(category) ?? 0;
      return { category, aCents, bCents, change: delta(aCents, bCents) };
    })
    .sort((x, y) => y.bCents - x.bCents);

  return {
    a: left,
    b: right,
    fullA,
    fullB,
    throughMonth,
    partial,
    income: delta(left.incomeCents, right.incomeCents),
    spend: delta(left.spendCents, right.spendCents),
    net: delta(left.netCents, right.netCents),
    reserve: delta(left.reserveCents, right.reserveCents),
    months,
    categories,
    peakCategoryCents: categories.reduce((m, r) => Math.max(m, r.aCents, r.bCents), 0),
  };
}

/** Net by calendar year, oldest first, with each year's income and spend beside it. */
export function netByYear(c: Community) {
  return ledgerYears(c)
    .sort((x, y) => x - y)
    .map((year) => {
      const s = yearSummary(c, year);
      return {
        year,
        incomeCents: s.incomeCents,
        spendCents: s.spendCents,
        netCents: s.netCents,
        reserveCents: s.reserveCents,
        throughMonth: s.throughMonth,
        partial: s.throughMonth < 12,
      };
    });
}

/** One spending category across every year the ledger covers, oldest first. */
export function categoryTrend(c: Community, category: string) {
  return ledgerYears(c)
    .sort((x, y) => x - y)
    .map((year) => ({ year, cents: spendAllCategories(c, year, 12).get(category) ?? 0 }));
}

/**
 * Dues billed against dues collected, month by month.
 *
 * Expected is what the association bills: every unit at its dues, converted
 * to a monthly figure whatever the cadence. Collected is the positive side of
 * the Assessments category; the card fee pass-through sits in that category
 * as a negative and is left out, since it is a cost and not a shortfall.
 * Only months with any transaction at all are rated, so a future month does
 * not read as zero collected.
 */
export function duesCollection(c: Community, year: number) {
  const { unitCount, duesCents, duesCadence } = c.association;
  // Every home at its own amount. In a mixed community kinds pay differently,
  // and a roster that has not loaded yet falls back to the unit count.
  const perPeriod = c.owners.length ? totalDues(c.association, c.owners) : unitCount * duesCents;
  const perMonth =
    duesCadence === "monthly" ? perPeriod : duesCadence === "quarterly" ? perPeriod / 3 : perPeriod / 12;
  const expectedCents = Math.round(perMonth);
  // Collected means what owners paid, before the processor's cut. The ledger
  // books each deposit net of the fee, so a month in which every home paid
  // read 96% against a gross bill (found in the five year run, 2026-09-24).
  // Owners' statements carry the gross payment, so a month they cover is
  // measured from them; a month they do not reach falls back to the ledger.
  const deposited = Array.from({ length: 12 }, () => 0);
  const paid = Array.from({ length: 12 }, () => 0);
  const active = Array.from({ length: 12 }, () => false);
  for (const e of c.ledger) {
    if (yearOf(e.date) !== year) continue;
    active[monthOf(e.date) - 1] = true;
    if (e.category === "Assessments" && e.amountCents > 0) deposited[monthOf(e.date) - 1] += e.amountCents;
  }
  for (const lines of Object.values(c.ownerCharges ?? {})) {
    for (const line of lines) {
      if (line.kind !== "payment" || yearOf(line.date) !== year) continue;
      paid[monthOf(line.date) - 1] += -line.amountCents;
    }
  }
  const collected = deposited.map((net, i) => (paid[i] > 0 ? paid[i] : net));
  const months = collected
    .map((collectedCents, i) => ({
      month: i + 1,
      label: SHORT_MONTHS[i],
      expectedCents,
      collectedCents,
      rate: expectedCents ? Math.min(1, collectedCents / expectedCents) : 0,
    }))
    .filter((_, i) => active[i]);
  const collectedYtd = months.reduce((t, m) => t + m.collectedCents, 0);
  const expectedYtd = expectedCents * months.length;
  return {
    months,
    expectedCents,
    collectedYtd,
    expectedYtd,
    rate: expectedYtd ? Math.min(1, collectedYtd / expectedYtd) : 0,
    /** False when there are no dues to measure against, or nothing collected yet. */
    measurable: expectedCents > 0 && months.length > 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Collections: how far behind, in the four buckets every auditor asks for.    */
/* -------------------------------------------------------------------------- */

export type AgingKey = "current" | "1-30" | "31-60" | "61+";

/**
 * Every household's balance, in one of four buckets by days past due.
 *
 * The buckets partition the roster: every owner lands in exactly one, so the
 * counts sum to the roster and the cents sum to every balance on it. Current
 * means not past due, which still includes balances that are simply not due
 * yet.
 */
export function agingBuckets(c: Community) {
  const spec: { key: AgingKey; label: string; test: (days: number) => boolean }[] = [
    { key: "current", label: "Current", test: (d) => d <= 0 },
    { key: "1-30", label: "1 to 30 days", test: (d) => d >= 1 && d <= 30 },
    { key: "31-60", label: "31 to 60 days", test: (d) => d >= 31 && d <= 60 },
    { key: "61+", label: "Over 60 days", test: (d) => d > 60 },
  ];
  const buckets = spec.map((b) => {
    const owners = c.owners.filter((o) => b.test(o.daysPastDue));
    return {
      key: b.key,
      label: b.label,
      owners,
      count: owners.length,
      cents: owners.reduce((t, o) => t + o.balanceCents, 0),
    };
  });
  const totalCents = buckets.reduce((t, b) => t + b.cents, 0);
  const pastDueCents = buckets.filter((b) => b.key !== "current").reduce((t, b) => t + b.cents, 0);
  return {
    buckets: buckets.map((b) => ({ ...b, share: totalCents ? b.cents / totalCents : 0 })),
    totalCents,
    pastDueCents,
    pastDueCount: buckets.filter((b) => b.key !== "current").reduce((t, b) => t + b.count, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Budget: each line against the share of the year that has gone.             */
/* -------------------------------------------------------------------------- */

/**
 * Budget against actual, line by line.
 *
 * Pace is the share of the annual figure used so far. A line is over pace
 * when it has used more of its budget than the year has used of itself, with
 * two points of slack so a bill that landed a day early is not a flag.
 * Variance is signed the way a treasurer reads it: positive is good news,
 * spending under the to-date allowance or income above it.
 */
export function budgetVariance(c: Community) {
  const elapsed = c.yearElapsed;
  const rows = c.budget.map((line) => {
    const pace = line.annualCents > 0 ? line.ytdActualCents / line.annualCents : 0;
    const toDateCents = Math.round(line.annualCents * elapsed);
    const varianceCents =
      line.kind === "expense" ? toDateCents - line.ytdActualCents : line.ytdActualCents - toDateCents;
    return {
      ...line,
      pace,
      toDateCents,
      varianceCents,
      overPace: line.kind === "expense" && pace > elapsed + 0.02,
      behind: line.kind === "income" && pace < elapsed - 0.02,
      remainingCents: line.annualCents - line.ytdActualCents,
    };
  });
  const total = (kind: "income" | "expense") => {
    const lines = rows.filter((r) => r.kind === kind);
    const annualCents = lines.reduce((t, r) => t + r.annualCents, 0);
    const ytdActualCents = lines.reduce((t, r) => t + r.ytdActualCents, 0);
    const toDateCents = lines.reduce((t, r) => t + r.toDateCents, 0);
    return {
      annualCents,
      ytdActualCents,
      toDateCents,
      pace: annualCents ? ytdActualCents / annualCents : 0,
      varianceCents: lines.reduce((t, r) => t + r.varianceCents, 0),
    };
  };
  return {
    income: rows.filter((r) => r.kind === "income"),
    expense: rows.filter((r) => r.kind === "expense"),
    incomeTotal: total("income"),
    expenseTotal: total("expense"),
    flagged: rows.filter((r) => r.overPace || r.behind),
    yearElapsed: elapsed,
    hasBudget: rows.length > 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Transactions: the ledger through a filter, and the totals of what is left.  */
/* -------------------------------------------------------------------------- */

export type PeriodPreset = "this-month" | "last-month" | "this-year" | "last-year" | "custom";

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "this-year": "This year",
  "last-year": "Last year",
  custom: "Custom",
};

/** The first and last day a preset covers, measured from the given day. */
export function periodRange(preset: PeriodPreset, asOf: string): { from: string; to: string } {
  const year = yearOf(asOf);
  const month = monthOf(asOf);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  switch (preset) {
    case "this-month":
      return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay(year, month))}` };
    case "last-month": {
      const y = month === 1 ? year - 1 : year;
      const m = month === 1 ? 12 : month - 1;
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
    }
    case "this-year":
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case "last-year":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case "custom":
      return { from: `${year}-01-01`, to: asOf };
  }
}

export interface LedgerFilter {
  from?: string;
  to?: string;
  accountId?: string;
  category?: string;
  status?: "cleared" | "pending" | "needs-review";
  direction?: "in" | "out";
  search?: string;
}

/** The rows a filter keeps, newest first, in the ledger's own order. */
export function filterLedger(ledger: Community["ledger"], f: LedgerFilter) {
  const q = f.search?.trim().toLowerCase();
  return ledger.filter((e) => {
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (f.accountId && e.accountId !== f.accountId) return false;
    if (f.category && e.category !== f.category) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.direction === "in" && e.amountCents < 0) return false;
    if (f.direction === "out" && e.amountCents >= 0) return false;
    if (q && !`${e.description} ${e.counterparty} ${e.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * Totals for a filtered set, plus a running balance per row.
 *
 * Two kinds of line stay out of Money in and Money out. A line waiting on
 * review is held out of every report until somebody confirms it, which the
 * Finances overview promises in so many words; counting it here made the
 * page disagree with that promise and doubled any duplicate the bank sent.
 * And a transfer into reserves is the association moving its own money: it
 * appears once as money out of operating and once as money into reserves,
 * and counting both inflated each side by the same amount.
 *
 * The running figure accumulates from the oldest row up, so the newest row at
 * the top of the table carries the total: the number a treasurer checks the
 * bank statement against. Held lines do not move it either; transfers do,
 * because each account's balance really changes.
 */
export function ledgerTotals(rows: Community["ledger"]) {
  const counted = rows.filter((e) => e.status !== "needs-review");
  const flows = counted.filter((e) => e.category !== "Reserve transfer");
  const inCents = flows.reduce((t, e) => t + (e.amountCents > 0 ? e.amountCents : 0), 0);
  const outCents = flows.reduce((t, e) => t + (e.amountCents < 0 ? -e.amountCents : 0), 0);
  const running = new Map<string, number>();
  let sum = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].status !== "needs-review") sum += rows[i].amountCents;
    running.set(rows[i].id, sum);
  }
  return {
    inCents,
    outCents,
    netCents: inCents - outCents,
    count: rows.length,
    needsReview: rows.length - counted.length,
    /** Moved between the association's own accounts, net. Neither in nor out. */
    transferCents: counted
      .filter((e) => e.category === "Reserve transfer")
      .reduce((t, e) => t + e.amountCents, 0),
    running,
  };
}

/** Every category the ledger uses, alphabetical, for a filter's options. */
export function ledgerCategories(ledger: Community["ledger"]): LedgerCategory[] {
  return [...new Set(ledger.map((e) => e.category))].sort() as LedgerCategory[];
}

/**
 * The payment and invoice behind a ledger line, when it is a vendor payment.
 *
 * Links are followed in both directions: the payout names its invoice, or the
 * invoice names its payout, and either is enough to open the file.
 */
export function ledgerAttachment(c: Community, entry: Community["ledger"][number]) {
  if (!entry.payoutId) return null;
  const payout = c.payouts.find((p) => p.id === entry.payoutId);
  if (!payout) return null;
  const invoice =
    (payout.invoiceId ? c.invoices.find((i) => i.id === payout.invoiceId) : undefined) ??
    c.invoices.find((i) => i.payoutId === payout.id);
  return { payout, invoice };
}

export function interestSummary(c: Community) {
  const reserveAccounts = c.bankAccounts.filter((a) => a.kind !== "operating");
  const balance = reserveAccounts.reduce((t, a) => t + a.balanceCents, 0);
  const earnedYtd = c.bankAccounts.reduce((t, a) => t + a.interestYtdCents, 0);
  const blendedApy = balance
    ? reserveAccounts.reduce((t, a) => t + a.apy * a.balanceCents, 0) / balance
    : 0;
  return {
    reserveAccounts,
    balance,
    earnedYtd,
    blendedApy,
    projectedAnnual: Math.round((balance * blendedApy) / 100),
  };
}

/**
 * Balance sitting above deposit insurance at a single institution.
 *
 * This matters more now that reserve cash lives in one savings account rather
 * than being spread across a CD and a sweep. A single account holding several
 * hundred thousand dollars is the normal shape for a funded association, and
 * the coverage limit is per depositor per bank, so the excess is genuinely at
 * risk rather than a technicality.
 */
export function insuranceExposure(c: Community) {
  const byInstitution = new Map<string, { balance: number; limit: number }>();
  for (const a of c.bankAccounts) {
    const row = byInstitution.get(a.institution) ?? { balance: 0, limit: a.insuredLimitCents };
    row.balance += a.balanceCents;
    byInstitution.set(a.institution, row);
  }
  const rows = [...byInstitution.entries()].map(([institution, r]) => ({
    institution,
    balance: r.balance,
    limit: r.limit,
    uninsured: Math.max(0, r.balance - r.limit),
  }));
  return { rows, totalUninsured: rows.reduce((t, r) => t + r.uninsured, 0) };
}


/**
 * The badge on the nav, from the same source as the screen behind it.
 *
 * This used to count a hand written fixture while the register counted
 * something else, which is the exact drift this product is positioned
 * against: two surfaces disagreeing about one number. Both now derive from
 * `complianceRegister`.
 */
export function complianceSummary(c: Community) {
  const register = complianceRegister(c);
  return {
    overdue: register.overdue,
    dueSoon: register.dueSoon,
    nextDeadline: register.next,
    // What the badge shows: things a board has a date on and has not passed.
    openCount: register.overdue.length + register.dueSoon.length,
    total: register.items.length,
  };
}

export function payoutSpeed(c: Community) {
  const byMethod = (m: "ach" | "check") => {
    const rows = c.payouts.filter((p) => p.method === m);
    if (!rows.length) return 0;
    return (
      rows.reduce(
        (t, p) => t + (daysFromToday(p.expectedDate) - daysFromToday(p.issuedDate)),
        0,
      ) / rows.length
    );
  };
  return { ach: byMethod("ach"), check: byMethod("check") };
}

/**
 * Every vendor decision the board owes, as one list and one number.
 *
 * The rail said five, the dashboard said two and the Vendors page said three,
 * because each counted something different: one added missing W-9s while the
 * tax paperwork was switched off, one counted payments and called them
 * invoices. Now all three read this. A bill is owed a decision when it is
 * new (approve or reject), approved and unpaid (pay it), or a payment is
 * still short of the signatures it needs. Paperwork is not a decision and
 * does not count.
 */
export function vendorDecisions(c: Community) {
  const toApprove = c.invoices.filter((i) => i.status === "new");
  const toPay = c.invoices.filter((i) => i.status === "approved");
  const toSign = c.payouts.filter((p) => p.approvals.length < p.approvalsRequired);
  return {
    toApprove,
    toPay,
    toSign,
    count: toApprove.length + toPay.length + toSign.length,
  };
}

export function vendorGaps(c: Community) {
  return {
    missingW9: c.vendors.filter((v) => !v.w9OnFile),
    noAch: c.vendors.filter((v) => !v.achEnabled),
    expiringCoi: c.vendors.filter(
      (v) => v.coiExpires && daysFromToday(v.coiExpires) < 60 && daysFromToday(v.coiExpires) >= 0,
    ),
  };
}

export type CalendarKind =
  | "meeting"
  | "event"
  | "ballot-opens"
  | "ballot-closes"
  | "deadline";

/** Everything dated that a resident might want on a calendar. */
export function calendarEntries(c: Community) {
  const rows: {
    id: string;
    date: string;
    title: string;
    detail?: string;
    kind: CalendarKind;
    href?: string;
  }[] = [];

  for (const m of c.meetings) {
    rows.push({
      id: `cal-${m.id}`,
      date: m.date,
      title: m.title,
      detail: `${m.time} · ${m.location}`,
      kind: "meeting",
      href: "/resident/vote",
    });
  }
  for (const b of c.ballots) {
    if (b.audience !== "owners") continue;
    if (b.status === "scheduled") {
      rows.push({
        id: `cal-${b.id}-open`,
        date: b.opensDate,
        title: b.title,
        detail: "Voting opens",
        kind: "ballot-opens",
        href: "/resident/vote",
      });
    }
    if (b.status === "open" || b.status === "scheduled") {
      rows.push({
        id: `cal-${b.id}-close`,
        date: b.closesDate,
        title: b.title,
        detail: "Last day to vote",
        kind: "ballot-closes",
        href: "/resident/vote",
      });
    }
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Owner correspondence, measured from the threads themselves.
 *
 * Every figure here used to be a literal on the screen, which meant a brand new
 * association with five households and no messages was told it had delivered 88
 * of them. A number nobody can trace is worse than no number.
 */
export function communicationsSummary(c: Community) {
  const threads = c.threads;
  const messages = threads.flatMap((t) => t.messages);
  const outbound = messages.filter((m) => m.direction === "outbound");

  // Board reply time: for each inbound message, how long until the next
  // outbound one in the same thread.
  const gaps: number[] = [];
  for (const thread of threads) {
    const ordered = [...thread.messages].sort((a, b) => (a.at < b.at ? -1 : 1));
    for (let i = 0; i < ordered.length - 1; i++) {
      if (ordered[i].direction !== "inbound") continue;
      const reply = ordered.slice(i + 1).find((m) => m.direction === "outbound");
      if (!reply) continue;
      gaps.push(daysBetween(ordered[i].at, reply.at));
      break;
    }
  }

  return {
    threadCount: threads.length,
    unread: threads.filter((t) => t.unread).length,
    sent: outbound.length,
    /** Households we hold an email for, which is who a notice can actually reach. */
    // Homes with nobody on record have nobody to reach, so they are neither.
    reachable: c.owners.filter((o) => !o.placeholder && o.email.trim().length > 0).length,
    households: c.owners.filter((o) => !o.placeholder).length,
    /** Undefined when nothing has been answered yet, rather than zero. */
    avgReplyDays: gaps.length
      ? Math.round((gaps.reduce((t, g) => t + g, 0) / gaps.length) * 10) / 10
      : undefined,
  };
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * The association's own slug, for record URLs and export filenames.
 *
 * Derived from the display name rather than the community id, because the id
 * carries a disambiguating suffix that nobody should see in a filename.
 */
export function communitySlug(c: Community): string {
  return (
    c.settings.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "association"
  );
}

/** Where an association publishes the records it has to make available. */
export function publicRecordsUrl(c: Community): string {
  return `${communitySlug(c).replace(/-/g, "")}.yourhoasis.com/records`;
}

/* -------------------------------------------------------------------------- */
/* Shared costs: what the association pays on everyone's behalf.               */
/* -------------------------------------------------------------------------- */

/**
 * The most recent bill for each active shared cost, with its trend.
 *
 * `changeYearOverYear` compares against the same month a year earlier rather
 * than last month, because every utility is seasonal and a December to January
 * comparison says nothing. A board that sees "water is up 6% on last July"
 * knows whether to look for a leak; "water is up 40% on January" is just
 * summer.
 */
export function sharedCostSummary(c: Community) {
  const active = c.sharedCosts.filter((s) => s.active);

  const rows = active.map((cost) => {
    const bills = c.sharedCostBills
      .filter((b) => b.sharedCostId === cost.id)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    const latest = bills.at(-1);
    const yearAgo = bills.at(-13);
    const trailingYear = bills.slice(-12).reduce((t, b) => t + b.totalCents, 0);

    return {
      cost,
      bills,
      latest,
      trailingYearCents: trailingYear,
      /** What one home paid over the last twelve months, on average. */
      perHomeYearCents: latest?.homes ? Math.round(trailingYear / latest.homes) : 0,
      changeYearOverYear:
        latest && yearAgo && yearAgo.totalCents > 0
          ? (latest.totalCents - yearAgo.totalCents) / yearAgo.totalCents
          : undefined,
    };
  });

  const monthlyCents = rows.reduce((t, r) => t + (r.latest?.totalCents ?? 0), 0);
  const homes = rows[0]?.latest?.homes ?? c.owners.length;

  return {
    rows,
    enabled: active.length > 0,
    monthlyCents,
    /** What the average home pays a month for everything the association passes on. */
    perHomeMonthlyCents: homes ? Math.round(monthlyCents / homes) : 0,
    trailingYearCents: rows.reduce((t, r) => t + r.trailingYearCents, 0),
  };
}

/**
 * Every month of one shared cost, oldest first, for a chart.
 *
 * Returns the figures rather than pixels so the same numbers can be exported to
 * CSV, which is what a treasurer actually wants at budget time.
 */
export function sharedCostTrend(c: Community, sharedCostId: string) {
  const cost = c.sharedCosts.find((s) => s.id === sharedCostId);
  const bills = c.sharedCostBills
    .filter((b) => b.sharedCostId === sharedCostId)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const peak = bills.reduce((m, b) => Math.max(m, b.totalCents), 0);
  return { cost, bills, peakCents: peak };
}

/* -------------------------------------------------------------------------- */
/* Special assessments: the ones that end.                                     */
/* -------------------------------------------------------------------------- */

export function assessmentProgress(c: Community) {
  const rows = c.specialAssessments.map((a) => {
    const collected = Math.min(a.collectedCents, a.totalCents);
    const remaining = a.totalCents - collected;
    const paidInstallments = a.totalCents
      ? Math.floor((collected / a.totalCents) * a.installments)
      : 0;
    return {
      assessment: a,
      collectedCents: collected,
      remainingCents: remaining,
      percent: a.totalCents ? collected / a.totalCents : 0,
      installmentsPaid: paidInstallments,
      installmentsLeft: Math.max(0, a.installments - paidInstallments),
      /** What one home still owes on it, on average. Buyers ask this. */
      perHomeRemainingCents: c.owners.length
        ? Math.round(remaining / c.owners.length)
        : remaining,
    };
  });
  return {
    rows,
    active: rows.filter((r) => r.assessment.status === "active"),
    /** Nothing to show, which is the state most associations are in. */
    enabled: rows.length > 0,
    outstandingCents: rows.reduce((t, r) => t + r.remainingCents, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Records: what is on file, and what is not.                                  */
/* -------------------------------------------------------------------------- */

/**
 * The records an association is expected to hold, whatever state it is in.
 *
 * Every state's records statute is worded differently and most enumerate more
 * than this. These are the ones that appear on essentially every list, that a
 * buyer's lender asks for by name, and that an owner is entitled to inspect.
 * Anything state specific belongs in the compliance register, which cites its
 * own statute; this is the floor.
 */
const EXPECTED_RECORDS = [
  {
    key: "declaration",
    label: "Declaration or CC&Rs",
    match: /declaration|cc&r|covenant/i,
    why: "The recorded document that creates the association. Every closing needs it.",
  },
  {
    key: "bylaws",
    label: "Bylaws",
    match: /bylaw/i,
    why: "How the association governs itself. An owner disputing a fine will ask for this first.",
  },
  {
    key: "articles",
    label: "Articles of Incorporation",
    match: /articles of incorporation/i,
    why: "Proof the association exists as a corporation. A bank asks for it to open an account.",
  },
  {
    key: "rules",
    label: "Rules and Regulations",
    match: /rules|regulation/i,
    why: "A fine for breaking a rule that is not written down does not survive a challenge.",
  },
  {
    key: "budget",
    label: "Current adopted budget",
    match: /budget/i,
    why: "Owners are entitled to it, and most states require it be delivered before the year starts.",
  },
  {
    key: "financials",
    label: "Most recent financial statements",
    match: /financial statement|balance sheet|income statement/i,
    why: "The annual figures owners can inspect. Lenders ask for the last two years.",
  },
  {
    key: "reserve",
    label: "Reserve study",
    match: /reserve stud/i,
    why: "Several states require one, and a buyer's lender uses it to judge the association.",
  },
  {
    key: "insurance",
    label: "Insurance certificate",
    match: /insurance|certificate of coverage|policy/i,
    why: "Owners need it for their own HO-6 policy, and it is requested at every closing.",
  },
  {
    key: "minutes",
    label: "Meeting minutes",
    match: /minutes/i,
    why: "The record of what the board decided. Usually the most requested document there is.",
  },
] as const;

/**
 * Which expected records are on file, and which are not.
 *
 * The old summary counted documents, which told a board nothing they could act
 * on. What a board can act on is the gap, so the gap is what this returns.
 */
export function recordsGaps(c: Community) {
  const names = c.documents.map((d) => d.name);
  const rows = EXPECTED_RECORDS.map((record) => ({
    ...record,
    onFile: names.some((name) => record.match.test(name)),
  }));
  const missing = rows.filter((r) => !r.onFile);
  return {
    rows,
    missing,
    onFileCount: rows.length - missing.length,
    total: rows.length,
    /** Nothing missing, which is worth saying plainly rather than not saying. */
    complete: missing.length === 0,
  };
}
