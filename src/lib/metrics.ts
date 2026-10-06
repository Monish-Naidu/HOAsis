import type { Community } from "@/lib/data/community";
import type { CommunityHistory, LedgerCategory, LedgerEntry } from "@/lib/types";
import { complianceRegister } from "@/lib/compliance";
import { ballotPhase } from "@/lib/phases";
import { daysBetween, daysFromToday, money } from "@/lib/utils";
import { totalDues } from "@/lib/home-types";
import { isDuesLine, isPaymentReversal } from "@/lib/statement";

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

/**
 * How many homes the association has: the register, counted. Unsold lots are
 * homes. A stored count (`association.unitCount`) was set once and drifted the
 * moment a household was added; it is only the answer before the register has
 * loaded.
 */
export function homeCount(c: Pick<Community, "owners" | "association">): number {
  return c.owners.length || c.association.unitCount;
}

/** Operating and reserve balances, and their total, from the bank accounts. */
export function cashPosition(c: Community) {
  const operating = c.bankAccounts
    .filter((a) => a.kind === "operating")
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const reserve = c.bankAccounts
    .filter((a) => a.kind !== "operating")
    .reduce((sum, a) => sum + a.balanceCents, 0);
  return { operating, reserve, total: operating + reserve };
}

/** Who is behind on dues and by how much, from the owners' balances and days past due. */
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

/**
 * Late fees inside what is owed right now.
 *
 * Past due is dues plus late fees, and dues collected counts dues alone, so
 * the two figures never reconcile by eye. Each owing household's statement is
 * read back to the last time it stood at zero, and the late fees since then
 * are what it still owes in fees.
 */
export function lateFeesOwed(c: Community): number {
  // A real association's statements are on hand for the recent months only;
  // the server read each whole statement back to its last zero.
  if (c.history) return c.history.lateFeesOwedCents;
  let total = 0;
  for (const owner of c.owners) {
    if (owner.balanceCents <= 0) continue;
    // Oldest first. A statement is kept newest first, and a sort by date
    // alone leaves two lines of one day in that order, so a fee and the
    // payment that cleared it the same afternoon read as payment, then fee:
    // a fee still owed that was in fact paid. Turned over first, the stable
    // sort keeps a day's lines in the order they happened.
    const lines = [...(c.ownerCharges[owner.id] ?? [])].reverse().sort((a, b) => a.date.localeCompare(b.date));
    let since = 0;
    lines.forEach((line, i) => {
      if (line.balanceAfterCents <= 0) since = i + 1;
    });
    let fees = 0;
    for (const line of lines.slice(since)) {
      if (line.kind === "charge" && /late fee/i.test(line.label)) fees += line.amountCents;
    }
    // Never more than the household still owes. $325 billed and $310 paid
    // leaves $15 past due, and "$15 past due, $25 of it late fees" is a
    // sentence nobody can add up. The database caps its figure the same way.
    total += Math.min(owner.balanceCents, fees);
  }
  return total;
}

/** "4 households, $75 of it late fees": the past due figure, reconciled. */
export function pastDueHint(households: number, feesCents: number): string {
  const who = `${households} ${households === 1 ? "household" : "households"}`;
  return feesCents > 0 ? `${who}, ${money(feesCents, { cents: false })} of it late fees` : who;
}

/** Budget income and expense, annual and year to date, with how the year is pacing. */
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

/** How much of the reserve components' replacement cost is funded, and which are due soonest. */
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

/**
 * A ledger line as the flow selectors read it: when, what for, how much.
 * The status rides along on a real line; a month the server summed has none.
 */
export type LedgerFlow = Pick<LedgerEntry, "date" | "category" | "amountCents"> &
  Partial<Pick<LedgerEntry, "status" | "description">>;

const flowCache = new WeakMap<
  Community["ledger"],
  { history: CommunityHistory | undefined; lines: LedgerFlow[] }
>();

/**
 * Every ledger line the selectors below add up.
 *
 * For the fixtures that is the ledger itself. For a real association the
 * lines on hand cover the recent months only, and the server summed the
 * rest by month and category (`community.history`): each of those months
 * stands in here as one line for money in and one for money out, dated the
 * first of its month. Every window a screen opens starts on the first of a
 * month, so a month's stand-in falls on the same side of the line as its
 * rows would. Once the earlier lines have been fetched the stand-ins step
 * aside, so nothing is counted twice.
 *
 * A line waiting on review is left out here, once, for every selector. The
 * overview says such lines are held out of reports until confirmed, and
 * Transactions already held them out; the charts, the runway and dues
 * collected counted them, so a bank line imported twice was spending twice
 * on one screen and once on the next.
 */
export function ledgerFlows(c: Community): LedgerFlow[] {
  const h = c.history;
  const cached = flowCache.get(c.ledger);
  if (cached && cached.history === h) return cached.lines;
  const lines: LedgerFlow[] = c.ledger.filter(
    (e) => e.status !== "needs-review" && (!h || h.ledgerLoaded || e.date >= h.from),
  );
  if (h && !h.ledgerLoaded) {
    for (const m of h.ledgerMonths) {
      const date = `${m.month}-01`;
      if (m.inCents > 0) lines.push({ date, category: m.category, amountCents: m.inCents });
      if (m.outCents > 0) lines.push({ date, category: m.category, amountCents: -m.outCents });
      // A month of nothing but zero lines still counts as a month with activity.
      if (m.inCents === 0 && m.outCents === 0 && m.count > 0) {
        lines.push({ date, category: m.category, amountCents: 0 });
      }
    }
  }
  flowCache.set(c.ledger, { history: h, lines });
  return lines;
}

/**
 * A negative line in Assessments worded "Payment reversed" (0088) or
 * "Refund" (0070). Money an owner paid that the association gave back, so it nets
 * against money in and collected and is never a spending category.
 */
function isPaymentReturn(e: { category: string; amountCents: number; description?: string }) {
  if (e.category !== "Assessments" || e.amountCents >= 0) return false;
  // The demo's older months carry a card fee pass-through here, which is a
  // cost, so the wording decides. A month the server summed has no
  // description and stays as it was; the server's sums do not split these
  // out, which is only a gap for a reversal older than the loaded months.
  return e.description !== undefined && /^(payment reversed|refund)\b/i.test(e.description);
}

/** The calendar years the ledger touches, newest first, for the chart filter. */
export function ledgerYears(c: Community): number[] {
  const years = new Set<number>();
  for (const e of ledgerFlows(c)) years.add(Number(e.date.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

/**
 * Money in and money out of the association, one row per month of the given
 * calendar year, January through December.
 *
 * Reserve transfers are excluded from both sides: moving cash between the
 * association's own accounts is neither income nor spending, and counting it
 * would inflate every month a board does the responsible thing. Opening
 * balances are left out for the same reason: the money was already there.
 *
 * Figures, not pixels, so the same rows can back a chart and a CSV.
 */
export function monthlyFlows(c: Community, year: number, through?: string) {
  // A year still under way stops at the given month. Four empty months after
  // it read as four months of nothing coming in, and a screen reader table
  // said "$0.00" for money that simply has not had a chance to arrive.
  const last =
    through && Number(through.slice(0, 4)) === year ? Number(through.slice(5, 7)) : 12;
  return monthlyFlowsBetween(c, `${year}-01-01`, `${year}-${String(last).padStart(2, "0")}-31`);
}

/**
 * The same rows for any window, one per calendar month from the month of
 * `from` to the month of `to`, so "the last twelve months" can cross a year
 * end without the chart knowing.
 */
export function monthlyFlowsBetween(c: Community, from: string, to: string) {
  const months: { month: string; inCents: number; outCents: number }[] = [];
  let y = yearOf(from);
  let m = monthOf(from);
  const endY = yearOf(to);
  const endM = monthOf(to);
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ month: `${y}-${String(m).padStart(2, "0")}`, inCents: 0, outCents: 0 });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const index = new Map(months.map((row, i) => [row.month, i]));
  for (const e of ledgerFlows(c)) {
    if (e.category === "Reserve transfer" || e.category === "Opening balance") continue;
    if (e.date < from || e.date > to) continue;
    const row = months[index.get(e.date.slice(0, 7)) ?? -1];
    if (!row) continue;
    // A reversed or refunded payment comes back out of money in, in the month
    // it happens. It is not spending.
    if (e.amountCents >= 0 || isPaymentReturn(e)) row.inCents += e.amountCents;
    else row.outCents += -e.amountCents;
  }
  return months;
}

/**
 * What the operating account covers, at the pace of the last twelve months.
 *
 * Months of bills in the bank is the number a treasurer is asked for at the
 * annual meeting, and the one that says whether a surprise repair is a
 * problem. Reserve transfers are left out: they are savings, not bills.
 */
export function operatingRunway(c: Community, asOf: string) {
  // The month in progress is left out: a payment on the 2nd and nothing else
  // yet is not a typical month, and it moved the average the moment one
  // landed. Twelve complete months before it; only when there are none does
  // the current month stand in, so a new association still reads something.
  const asOfMonth = asOf.slice(0, 7);
  const from = shiftMonths(asOf, -12).slice(0, 7) + "-01";
  const active = (r: { inCents: number; outCents: number }) => r.inCents !== 0 || r.outCents !== 0;
  const all = monthlyFlowsBetween(c, from, asOf).filter(active);
  const complete = all.filter((r) => r.month < asOfMonth);
  const rows = complete.length ? complete : all.filter((r) => r.month === asOfMonth);
  const months = rows.length;
  const avgInCents = months ? Math.round(rows.reduce((t, r) => t + r.inCents, 0) / months) : 0;
  const avgOutCents = months ? Math.round(rows.reduce((t, r) => t + r.outCents, 0) / months) : 0;
  const operating = cashPosition(c).operating;
  return {
    months,
    avgInCents,
    avgOutCents,
    /** Months the operating balance would last with nothing coming in. */
    coversMonths: avgOutCents ? operating / avgOutCents : null,
  };
}

/** The same day `n` months away, clamped to the month's last day. */
function shiftMonths(iso: string, n: number): string {
  const y = yearOf(iso);
  const m = monthOf(iso) - 1 + n;
  const d = Number(iso.slice(8, 10));
  const target = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`;
}

/**
 * Where the association's money went in the given year, largest first.
 *
 * The top five categories keep their own line; everything after folds into
 * "Other", because a sixth slice is where a donut stops being readable.
 * Money moved into reserves is not spending: it is the association's own
 * money going from one of its accounts to another, the same rule the money
 * in and out chart follows. It is returned beside the rows as `reserveCents`
 * (the operating side of each transfer, so the receiving entry cannot double
 * it) for a screen that wants to say so, and the total leaves it out.
 */
export function spendingByCategory(c: Community, year: number) {
  return spendingBetween(c, `${year}-01-01`, `${year}-12-31`);
}

/** `spendingByCategory` for any window of days. */
export function spendingBetween(c: Community, from: string, to: string) {
  const totals = new Map<string, number>();
  let reserveCents = 0;
  for (const e of ledgerFlows(c)) {
    if (e.amountCents >= 0 || isPaymentReturn(e)) continue;
    if (e.date < from || e.date > to) continue;
    // Moving money between the association's own accounts, and a starting
    // balance, are neither spending: the same two lines the money in and out
    // chart leaves out.
    if (e.category === "Opening balance") continue;
    if (e.category === "Reserve transfer") {
      reserveCents -= e.amountCents;
      continue;
    }
    totals.set(e.category, (totals.get(e.category) ?? 0) - e.amountCents);
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
    reserveCents,
  };
}

/* -------------------------------------------------------------------------- */
/* Years: one year on its own, two side by side, and the run of them.          */
/* -------------------------------------------------------------------------- */

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The name of a month by its number, 1 to 12, short or long. */
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
  for (const e of ledgerFlows(c)) {
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

/** The change from one figure to another, with a percent unless the earlier figure is zero. */
export function delta(from: number, to: number): Delta {
  return { cents: to - from, percent: from ? (to - from) / Math.abs(from) : undefined };
}

/** Every spending category for one year, reserve funding included as its own line. */
function spendAllCategories(c: Community, year: number, throughMonth: number) {
  const totals = new Map<string, number>();
  for (const e of ledgerFlows(c)) {
    if (e.amountCents >= 0 || isPaymentReturn(e)) continue;
    if (yearOf(e.date) !== year || monthOf(e.date) > throughMonth) continue;
    // The same two lines spendingBetween leaves out: moving money to the
    // reserve account is not spending, and the year comparison used to show
    // it as the biggest category of all.
    if (e.category === "Reserve transfer" || e.category === "Opening balance") continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) - e.amountCents);
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
 * Dues billed against dues collected, bill by bill.
 *
 * Expected is what the association billed: the dues lines on the homes'
 * statements, bill by bill, so a dues change or a new home reaches only the
 * bills issued after it and what was billed never moves. A bill with no dues
 * line on hand (no statements yet, or a month the server summed and did not
 * itemise) is held at every unit's dues today, the best figure known. A bill
 * counts once it has fallen due. A monthly association has a row per month.
 * A quarterly or annual one has a row per bill, in the month it fell due,
 * and what came in during the months after it, up to the next bill, counts
 * toward that row; money in before the year's first bill was paying last
 * year's last one, which leads the list as its own row, labelled with its
 * year. Spreading an annual bill evenly over twelve months read
 * 100% collected in March with a quarter of the homes unpaid, since three
 * months' share of the bill was all it was held against.
 *
 * Collected is the Assessments category net of what was given back: a
 * reversed check or a refund (a negative line there, 0070 and 0088) comes off
 * collected in the month it happens, so recording a payment and reversing it
 * leaves collected where it was. The processor's fee is its own category
 * ("Processing fees") and is not in it. When the statements are on hand
 * collected is read from them instead, the same way: payments in, the
 * "Payment reversed" and "Refund of" lines out.
 *
 * What counts as billed is one rule: a month is billed only when a dues line
 * exists for it and it has arrived (the as-of month or before). A month with
 * no dues line is not billed, and a payment that lands in it is not
 * collected against anything yet, so one October payment before October's
 * bill posts no longer swaps the year's 96% of $61,560 for 87% of $68,400.
 * That month's expected figure is returned apart as `thisMonth` ("this
 * month's bill, not yet posted"). The rate stands in only where nothing
 * better is known: a community with no dues lines at all, and months before
 * the statements on hand begin. For monthly dues, such a month with no line
 * is rated only if the ledger has activity in it, as before. A quarterly or annual bill counts once its month has arrived
 * (`asOf`, the association's own clock unless told otherwise) and only from
 * the first month the association has anything on its books, so a bill
 * that fell due before it existed is not held against it.
 */
export function duesCollection(c: Community, year: number, asOf: string = c.asOf) {
  const { unitCount, duesCents, duesCadence, fiscalYearStart } = c.association;
  // Every home at its own amount. In a mixed community kinds pay differently,
  // and a roster that has not loaded yet falls back to the unit count.
  const perPeriod = c.owners.length ? totalDues(c.association, c.owners) : unitCount * duesCents;
  // What the next bill comes to, every home together, at today's rates.
  const expectedCents = Math.round(perPeriod);
  // What each bill was, from the dues lines the statements carry. A month
  // with no dues line on hand is held at today's rate, since nothing better
  // is known. Lines before `history.from` are left out: only some homes'
  // earlier statements may have been fetched, and a partial sum would
  // understate the bill.
  const statementsFrom = c.history?.from ?? "";
  const billedIn = (y: number) => {
    const cents = Array.from({ length: 12 }, () => 0);
    const seen = Array.from({ length: 12 }, () => false);
    for (const lines of Object.values(c.ownerCharges ?? {})) {
      for (const line of lines) {
        if (!isDuesLine(line) || yearOf(line.date) !== y || line.date < statementsFrom) continue;
        cents[monthOf(line.date) - 1] += line.amountCents;
        seen[monthOf(line.date) - 1] = true;
      }
    }
    return { cents, seen };
  };
  const billedThisYear = billedIn(year);
  // Any dues line at all, on hand. Without one, nothing says what was billed.
  const hasDuesLines = Object.values(c.ownerCharges ?? {}).some((lines) =>
    lines.some((l) => isDuesLine(l) && l.date >= statementsFrom),
  );
  // Months before the statements on hand were summed by the server, which
  // says a charge was posted but not whether it was dues.
  const chargedByServer = new Set(
    (c.history?.statementMonths ?? []).filter((m) => m.kind === "charge" && m.count > 0).map((m) => m.month),
  );
  // What a month was billed, or null for a month with no bill. The rate
  // fills in only where the statements cannot speak: none at all, or a month
  // before the ones on hand in which the server counted a charge.
  const expectedFor = (b: typeof billedThisYear, y: number, i: number): number | null => {
    if (b.seen[i]) return b.cents[i];
    const ym = `${y}-${String(i + 1).padStart(2, "0")}`;
    if (!hasDuesLines) return expectedCents;
    return ym < statementsFrom.slice(0, 7) && chargedByServer.has(ym) ? expectedCents : null;
  };
  // Collected means what owners paid, before the processor's cut. The ledger
  // books each deposit net of the fee, so a month in which every home paid
  // read 96% against a gross bill (found in the five year run, 2026-09-24).
  // Owners' statements carry the gross payment, so a month they cover is
  // measured from them; a month they do not reach falls back to the ledger.
  // The first month with anything on the books, in any year.
  let firstActive = "";
  for (const e of ledgerFlows(c)) {
    const ym = e.date.slice(0, 7);
    if (!firstActive || ym < firstActive) firstActive = ym;
  }
  // Statement lines on hand, then the months the server summed before them.
  // A home whose whole statement was fetched still counts through the sums
  // for the earlier months, so the two never overlap.
  const linesFrom = c.history?.from ?? "";
  const tally = (y: number) => {
    const deposited = Array.from({ length: 12 }, () => 0);
    const paid = Array.from({ length: 12 }, () => 0);
    const covered = Array.from({ length: 12 }, () => false);
    const active = Array.from({ length: 12 }, () => false);
    for (const e of ledgerFlows(c)) {
      if (yearOf(e.date) !== y) continue;
      active[monthOf(e.date) - 1] = true;
      // Net: a reversal or refund (negative) comes off what was deposited.
      if (e.category === "Assessments") deposited[monthOf(e.date) - 1] += e.amountCents;
    }
    for (const lines of Object.values(c.ownerCharges ?? {})) {
      for (const line of lines) {
        if (yearOf(line.date) !== y || line.date < linesFrom) continue;
        const m = monthOf(line.date) - 1;
        if (line.kind === "payment") {
          paid[m] += -line.amountCents;
          covered[m] = true;
        } else if (isPaymentReversal(line)) {
          // The home owes it again: the payment it undoes stays on the
          // statement, so this line is what takes it back out of collected.
          paid[m] -= line.amountCents;
          covered[m] = true;
        }
      }
    }
    for (const m of c.history?.statementMonths ?? []) {
      if (m.kind !== "payment" || Number(m.month.slice(0, 4)) !== y) continue;
      paid[Number(m.month.slice(5, 7)) - 1] += -m.cents;
      covered[Number(m.month.slice(5, 7)) - 1] = true;
    }
    return { collected: deposited.map((net, i) => (covered[i] ? paid[i] : net)), active };
  };
  const { collected, active } = tally(year);

  // Which months a bill falls due in: every month, every third counted from
  // the fiscal year start, or the fiscal year's first month alone. The same
  // rule the daily run bills by.
  const monthly = duesCadence === "monthly";
  const step = monthly ? 1 : duesCadence === "quarterly" ? 3 : 12;
  const fyMonth = Number((fiscalYearStart ?? "").slice(0, 2)) || 1;
  const onCadence = (i: number) => (((i + 1 - fyMonth) % step) + step) % step === 0;
  const asOfMonth = asOf.slice(0, 7);
  // The bill a month carries, or null when it is not one of the rows: no
  // bill posted for it, not yet arrived, or before the books begin.
  const billOf = (y: number, b: ReturnType<typeof billedIn>, i: number): number | null => {
    const ym = `${y}-${String(i + 1).padStart(2, "0")}`;
    const cents = expectedFor(b, y, i);
    if (cents === null || firstActive === "" || ym < firstActive || ym > asOfMonth) return null;
    // Monthly with no dues line (the rate stands in): only a month the
    // ledger has anything in.
    if (monthly && !b.seen[i] && !(y === year && active[i])) return null;
    return monthly || onCadence(i) ? cents : null;
  };

  const months: { month: number; label: string; expectedCents: number; collectedCents: number; rate: number }[] = [];
  for (let i = 0; i < 12; i += 1) {
    const billedCents = billOf(year, billedThisYear, i);
    if (billedCents === null) continue;
    let collectedCents = collected[i];
    // Money that arrives between two bills is paying the earlier one.
    if (!monthly) {
      for (let j = i + 1; j < 12 && !onCadence(j); j += 1) collectedCents += collected[j];
    }
    months.push({
      month: i + 1,
      label: SHORT_MONTHS[i],
      expectedCents: billedCents,
      collectedCents,
      rate: billedCents ? Math.max(0, Math.min(1, collectedCents / billedCents)) : 0,
    });
  }
  // A bill from last year that this year is still paying. When the cadence
  // does not land on January (a fiscal year from July, say), the months
  // before this year's first bill belong to last year's last one. Without
  // this row an annual association read in March said "nothing billed yet"
  // with a July bill four fifths collected, and money paid January to June
  // was counted in no year at all.
  if (!monthly) {
    let first = 0;
    while (first < 12 && !onCadence(first)) first += 1;
    let last = 11;
    while (last > 0 && !onCadence(last)) last -= 1;
    const ym = `${year - 1}-${String(last + 1).padStart(2, "0")}`;
    const billedBefore = expectedFor(billedIn(year - 1), year - 1, last);
    if (billedBefore !== null && first > 0 && first < 12 && firstActive !== "" && ym >= firstActive && ym <= asOfMonth) {
      const before = tally(year - 1).collected;
      let collectedCents = 0;
      for (let j = last; j < 12; j += 1) collectedCents += before[j];
      for (let j = 0; j < first; j += 1) collectedCents += collected[j];
      months.unshift({
        month: last + 1,
        label: `${SHORT_MONTHS[last]} ${year - 1}`,
        expectedCents: billedBefore,
        collectedCents,
        rate: billedBefore ? Math.max(0, Math.min(1, collectedCents / billedBefore)) : 0,
      });
    }
  }
  // The as-of month's own bill, when it has not posted: shown apart, never
  // inside the year's totals.
  const nowI = monthOf(asOf) - 1;
  const thisMonth =
    yearOf(asOf) === year && hasDuesLines && !billedThisYear.seen[nowI] && (monthly || onCadence(nowI))
      ? { month: nowI + 1, label: SHORT_MONTHS[nowI], expectedCents, collectedCents: collected[nowI] }
      : undefined;
  const collectedYtd = months.reduce((t, m) => t + m.collectedCents, 0);
  const expectedYtd = months.reduce((t, m) => t + m.expectedCents, 0);
  return {
    months,
    expectedCents,
    collectedYtd,
    expectedYtd,
    thisMonth,
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

export type PeriodPreset =
  | "this-month"
  | "last-month"
  | "this-year"
  | "last-year"
  | "last-12-months"
  | "custom";

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "this-year": "This year",
  "last-year": "Last year",
  "last-12-months": "Last 12 months",
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
    case "last-12-months":
      // Twelve whole months ending today, so the window starts on the first
      // of the month a year back rather than on an arbitrary day.
      return { from: shiftMonths(asOf, -11).slice(0, 7) + "-01", to: asOf };
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
    // The amount as a person would type it, so "285" and "285.00" both find
    // the line. Search from the top bar lands here with one.
    if (
      q &&
      !`${e.description} ${e.counterparty} ${e.category} ${(Math.abs(e.amountCents) / 100).toFixed(2)}`
        .toLowerCase()
        .includes(q.replace(/[$,]/g, ""))
    )
      return false;
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
  // A starting balance is money the association already had, not money in.
  const flows = counted.filter(
    (e) => e.category !== "Reserve transfer" && e.category !== "Opening balance",
  );
  // A reversed or refunded payment nets against money in, as monthlyFlows has
  // it, so this page and the overview read one figure.
  const inCents = flows.reduce((t, e) => t + (e.amountCents > 0 || isPaymentReturn(e) ? e.amountCents : 0), 0);
  const outCents = flows.reduce((t, e) => t + (e.amountCents < 0 && !isPaymentReturn(e) ? -e.amountCents : 0), 0);
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

/**
 * What a filtered set adds up to, by category, largest first.
 *
 * Answers "how much did we spend on landscaping last year" from the same
 * rows the table shows, so the two cannot disagree. Held lines stay out,
 * as everywhere; transfers to reserves appear under their own name.
 */
export function totalsByCategory(rows: Community["ledger"]) {
  const map = new Map<string, { category: string; inCents: number; outCents: number; count: number }>();
  for (const e of rows) {
    if (e.status === "needs-review" || e.category === "Opening balance") continue;
    const row = map.get(e.category) ?? { category: e.category, inCents: 0, outCents: 0, count: 0 };
    if (e.amountCents >= 0) row.inCents += e.amountCents;
    else row.outCents += -e.amountCents;
    row.count += 1;
    map.set(e.category, row);
  }
  return [...map.values()].sort((a, b) => b.outCents + b.inCents - (a.outCents + a.inCents));
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

/** Interest earned and the blended yield across the reserve accounts. */
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

/** Average days from issue to funds landing, for ACH and for check. */
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
    // What a board can act on from the Vendors screen. Bills that arrive by
    // email, and approving and paying them from here, were taken off the
    // screen on 2026-10-05 because none of it was real; counting them left
    // the dashboard and the rail saying "4 waiting on you" over a page with
    // nothing to decide. A payment short of its signatures is still real.
    count: toSign.length,
  };
}

/**
 * What was paid to a vendor in the calendar year of `asOf`: the ledger lines
 * that went out to them, which is what Transactions lists, so the two screens
 * cannot disagree. A line is theirs by its `payoutId` when it has one (a
 * payout of this vendor), else by the counterparty's name. A payment the
 * board recorded straight onto the ledger has no payout row at all, which is
 * why the old sum over payouts read $0 beside a Transactions list of
 * payments. Calendar year, not fiscal: the $600 line for a 1099 is measured
 * on the calendar. Lines waiting on review are held out, as everywhere.
 */
export function vendorPaidThisYear(c: Community, vendor: Pick<Community["vendors"][number], "id" | "name">, asOf: string = c.asOf) {
  const year = asOf.slice(0, 4);
  const name = vendor.name.trim().toLowerCase();
  const payoutIds = new Set(c.payouts.filter((p) => p.vendorId === vendor.id).map((p) => p.id));
  let paid = 0;
  for (const e of c.ledger) {
    if (e.amountCents >= 0 || e.status === "needs-review") continue;
    if (e.category === "Reserve transfer" || e.date.slice(0, 4) !== year || e.date > asOf) continue;
    const theirs = e.payoutId ? payoutIds.has(e.payoutId) : e.counterparty.trim().toLowerCase() === name;
    if (theirs) paid -= e.amountCents;
  }
  return paid;
}

/** Vendors missing a W-9 or ACH setup, and those whose insurance certificate expires within 60 days. */
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
      // The meeting's own row on the calendar page, where the RSVP is.
      href: `/resident/calendar#meeting-${m.id}`,
    });
  }
  for (const b of c.ballots) {
    if (b.audience !== "owners") continue;
    // By phase, so a ballot past its closing date drops its "Last day to
    // vote" row the same way one the board closed by hand does.
    const phase = ballotPhase(b);
    if (phase === "scheduled") {
      rows.push({
        id: `cal-${b.id}-open`,
        date: b.opensDate,
        title: b.title,
        detail: "Voting opens",
        kind: "ballot-opens",
        href: "/resident/vote",
      });
    }
    if (phase === "open" || phase === "scheduled") {
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

/**
 * The address vendors email bills to, or null where there is none to give.
 *
 * Nothing receives mail at it yet. In the demo it shows what the inbox will
 * look like. A real board that copied it and handed it to the landscaper
 * had the invoice bounce, so a real association is not shown one until mail
 * sent there is kept.
 */
export function invoiceAddress(c: Community, isRemote: boolean): string | null {
  return isRemote ? null : `invoices@${communitySlug(c)}.yourhoasis.com`;
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

/* -------------------------------------------------------------------------- */
/* Special assessments: the ones that end.                                     */
/* -------------------------------------------------------------------------- */

/** How far each special assessment has been collected, and what is left per home. */
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
    // "Year end financials 2025" is what most boards call the thing.
    match: /financial statement|financials|year[- ]end|balance sheet|income statement/i,
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

/* -------------------------------------------------------------------------- */
/* A bill the board still has to send                                          */
/* -------------------------------------------------------------------------- */

/** How long after a bill posts the dashboard keeps asking the board to send it. */
export const UNSENT_BILL_DAYS = 7;

/**
 * "October dues posted" for a board that turned the automatic bill email
 * off, until the bill has gone out some other way: a bill posted in the last
 * seven days, with no assessment email logged on or after the day it posted.
 * Null when the email is on (the daily job sends it), when no bill posted
 * recently, or when one has been sent.
 *
 * The month is the one the bill falls due in. The demo has no email log and
 * no posted bill, so there the row appears whenever the switch is off, for
 * the month of the next charge, which is what a visitor needs to see it.
 */
export function unsentDuesBill(c: Community): { label: string } | null {
  if (c.association.billsByEmail !== false) return null;
  const bill = c.recentDuesBill;
  if (!bill) {
    // A signed in association without a bill on the books has nothing to send.
    if (c.history) return null;
    return { label: `${monthName(monthOf(c.nextChargeDate), "long")} dues posted` };
  }
  // A bill posted after today cannot be waiting yet. The older helper clamps
  // at zero, so that case is its own check.
  if (bill.postedOn > c.asOf || Math.max(0, daysBetween(bill.postedOn, c.asOf)) > UNSENT_BILL_DAYS) return null;
  const sent = c.emailLog.some(
    (e) => e.category === "assessment" && !e.error && e.sentAt.slice(0, 10) >= bill.postedOn,
  );
  if (sent) return null;
  return { label: `${monthName(monthOf(bill.dueOn), "long")} dues posted` };
}
