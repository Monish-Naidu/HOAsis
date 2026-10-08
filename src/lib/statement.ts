import type { Community } from "@/lib/data/community";
import { fiscalMonth } from "@/lib/metrics";
import type { ChargeLine, Cents, ISODate } from "@/lib/types";

/**
 * One home's statement, read the same way on every screen.
 *
 * Two questions used to be answered from two places: "what was this home
 * billed" came from the rate times a count of months, and "what does this home
 * owe" came from a stored balance that included bills not yet due. A bill is
 * a line on the statement; the rate is only what the next bill will be made
 * from. These helpers read the lines.
 */

/**
 * True for a line that is a dues bill: not a late fee, a fine, a one-off
 * charge or an opening balance.
 *
 * The database says so in the charge's category, which a loaded line carries
 * as `category`. The demo's lines predate that field and are named instead:
 * "March assessment" there, "March 2026 dues" from the daily run.
 */
export function isDuesLine(line: Pick<ChargeLine, "kind" | "label" | "category">): boolean {
  if (line.kind !== "charge") return false;
  if (line.category) return line.category === "dues";
  if (/late fee|\bfine\b|brought forward|special/i.test(line.label)) return false;
  return /assessment|dues/i.test(line.label);
}

/**
 * True for the line that undoes a payment: "Payment reversed: why" from a
 * board taking back a check (0088) and "Refund of card payment" (0070). Both
 * are charges that put the money back on the home's statement, and neither is
 * dues. The payment itself stays on the statement, so collected has to take
 * this line off in the month it was written.
 */
export function isPaymentReversal(line: Pick<ChargeLine, "kind" | "label" | "category">): boolean {
  if (line.kind !== "charge" || isDuesLine(line)) return false;
  return /^(payment reversed|refund of)\b/i.test(line.label);
}

/**
 * Oldest first: by date, and on one date charges before payments, so a
 * running balance never dips below zero before the bill the payment settles.
 * Stable, so two lines of one kind keep the order they were written in.
 */
export function compareStatement(a: Pick<ChargeLine, "date" | "kind">, b: Pick<ChargeLine, "date" | "kind">): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const rank = (k: ChargeLine["kind"]) => (k === "charge" ? 0 : 1);
  return rank(a.kind) - rank(b.kind);
}

/**
 * A statement newest first, in date order, each line carrying the balance
 * after it.
 *
 * The balance before the first line is whatever the lines on hand do not
 * explain: it is taken from the newest stored balance, which is right however
 * the lines were ordered, so a statement that starts mid-history keeps the
 * balance it was carried into. `lines` may arrive in either order.
 */
export function orderStatement(lines: ChargeLine[], headBalanceCents?: Cents): ChargeLine[] {
  if (lines.length === 0) return lines;
  // Oldest first as written (the stored order is newest first), then a stable
  // sort by date and kind.
  const oldestFirst = [...lines].reverse().sort(compareStatement);
  const total = oldestFirst.reduce((t, l) => t + l.amountCents, 0);
  const head = headBalanceCents ?? lines[0].balanceAfterCents;
  let running = head - total;
  const out = oldestFirst.map((line) => {
    running += line.amountCents;
    return line.balanceAfterCents === running ? line : { ...line, balanceAfterCents: running };
  });
  return out.reverse();
}

/** One line added to a statement, kept in date order with its balances restated. */
export function addStatementLine(lines: ChargeLine[], line: ChargeLine, headBalanceCents: Cents): ChargeLine[] {
  return orderStatement([line, ...lines], headBalanceCents);
}

export interface BalanceSplit {
  /** Owed and due on or before today: what "Current balance" means. */
  owedNowCents: Cents;
  /** Billed and not yet due: the daily run posts a bill up to a week early. */
  notYetDueCents: Cents;
  /** The soonest bill with something still open that is not due yet. */
  nextBill?: { date: ISODate; amountCents: Cents; label: string };
  /**
   * The soonest bill dated after today, paid or not. What a home would pay
   * by paying ahead, and the figure a statement already shows for it: the
   * rate says what the bill after this one will be, not what this one is.
   */
  upcoming?: { date: ISODate; amountCents: Cents; label: string };
}

/**
 * What a home owes now, apart from what is billed but not yet due.
 *
 * Money pays the oldest charges first, so what is still owed is the newest
 * charges whose amounts add up to the balance. Charges dated after `asOf` are
 * the newest by definition: the part of the balance they cover is not due yet,
 * and the rest is owed now. The database finds a home's days past due the same
 * way, so a home that owes only a coming bill is not late.
 */
export function balanceSplit(lines: ChargeLine[], balanceCents: Cents, asOf: ISODate): BalanceSplit {
  const owed = Math.max(0, balanceCents);
  const coming = lines
    .filter((l) => l.kind === "charge" && l.date > asOf)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const comingTotal = coming.reduce((t, l) => t + l.amountCents, 0);
  const notYetDueCents = Math.min(owed, comingTotal);
  const upcoming = coming[0]
    ? { date: coming[0].date, amountCents: coming[0].amountCents, label: coming[0].label }
    : undefined;
  if (notYetDueCents === 0) return { owedNowCents: owed, notYetDueCents: 0, upcoming };
  // The oldest coming charges are the ones money reaches first. Skip what is
  // paid, and the first charge with something left open is the next bill.
  let paid = comingTotal - notYetDueCents;
  let nextBill: BalanceSplit["nextBill"];
  for (const l of coming) {
    if (paid >= l.amountCents) {
      paid -= l.amountCents;
      continue;
    }
    nextBill = { date: l.date, amountCents: l.amountCents - paid, label: l.label };
    break;
  }
  return { owedNowCents: owed - notYetDueCents, notYetDueCents, nextBill, upcoming };
}

/** One row of a printed statement: a charge or a payment, with the balance after it. */
export interface StatementRow {
  id: string;
  date: ISODate;
  label: string;
  method?: string;
  /** What was added to the balance on this row, or 0. */
  chargeCents: Cents;
  /** What was taken off the balance on this row (a payment or a credit), shown positive, or 0. */
  paymentCents: Cents;
  balanceCents: Cents;
}

/** One home's statement for one year, ready to print. */
export interface HomeStatement {
  homeId: string;
  year: number;
  from: ISODate;
  to: ISODate;
  /** "2025", or "Jul 2025 to Jun 2026" when the fiscal year does not start in January. */
  periodLabel: string;
  /** Oldest first, the order a statement is read on paper. */
  rows: StatementRow[];
  /** What the home owed on the first day of the period. */
  openingCents: Cents;
  closingCents: Cents;
  /** Dues, fees and one-off charges in the period, not counting a payment taken back. */
  billedCents: Cents;
  /** Payments in the period, net of any payment taken back. */
  paidCents: Cents;
  /** Credits in the period, such as a waived late fee. */
  creditedCents: Cents;
  /**
   * Set when the period starts before the lines this screen holds and the home
   * has earlier lines it has not fetched: the date the held lines begin. The
   * opening balance and the totals cannot be trusted then.
   */
  linesBegin: ISODate | null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** First and last day of the year `year`, counted from the association's fiscal year start. */
export function statementPeriod(fiscalYearStart: string | undefined, year: number): { from: ISODate; to: ISODate } {
  const m = fiscalMonth(fiscalYearStart);
  if (m === 1) return { from: `${year}-01-01`, to: `${year}-12-31` };
  const endYear = year + 1;
  const lastDay = new Date(Date.UTC(endYear, m - 1, 0)).getUTCDate();
  return { from: `${year}-${pad2(m)}-01`, to: `${endYear}-${pad2(m - 1)}-${pad2(lastDay)}` };
}

/** The year a date falls in, counted from the fiscal year start. A fiscal year is named for the year it starts in. */
export function statementYearOf(fiscalYearStart: string | undefined, date: ISODate): number {
  const m = fiscalMonth(fiscalYearStart);
  const y = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= m ? y : y - 1;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** How a period is named on a select and on the paper. */
export function statementPeriodLabel(fiscalYearStart: string | undefined, year: number): string {
  const m = fiscalMonth(fiscalYearStart);
  if (m === 1) return String(year);
  return `${MONTH[m - 1]} ${year} to ${MONTH[(m + 10) % 12]} ${year + 1}`;
}

/**
 * Every year in which some home has a line, newest first. One home when
 * `homeId` is given. An association with no lines yet gets the year of `today`
 * so a select is never empty.
 */
export function statementYears(community: Community, today: ISODate, homeId?: string): number[] {
  const fy = community.association.fiscalYearStart;
  const years = new Set<number>();
  const take = (lines: ChargeLine[] | undefined) => lines?.forEach((l) => years.add(statementYearOf(fy, l.date)));
  if (homeId) take(community.homeCharges[homeId]);
  else Object.values(community.homeCharges).forEach(take);
  if (years.size === 0) years.add(statementYearOf(fy, today));
  return [...years].sort((a, b) => b - a);
}

/**
 * One home's statement for a year: the lines in the period with a running
 * balance, what the home owed coming in and going out, and what was billed and
 * paid. The balance before a date is read from the line after it, so it holds
 * however much earlier history there is. Lines are restated the way
 * `orderStatement` does, so a line stored with a stale balance cannot show one.
 */
export function statementFor(community: Community, homeId: string, year: number): HomeStatement {
  const fy = community.association.fiscalYearStart;
  const { from, to } = statementPeriod(fy, year);
  const stored = community.homeCharges[homeId] ?? [];
  // Oldest first.
  const all = orderStatement(stored).reverse();
  const before = all.filter((l) => l.date < from);
  const inYear = all.filter((l) => l.date >= from && l.date <= to);
  const first = inYear[0];
  const openingCents = first
    ? first.balanceAfterCents - first.amountCents
    : before.length > 0
      ? before[before.length - 1].balanceAfterCents
      : (() => {
          const later = all.find((l) => l.date > to);
          return later ? later.balanceAfterCents - later.amountCents : 0;
        })();

  let billedCents = 0;
  let paidCents = 0;
  let creditedCents = 0;
  const rows: StatementRow[] = inYear.map((l) => {
    if (l.kind === "payment") paidCents += -l.amountCents;
    else if (l.kind === "credit") creditedCents += -l.amountCents;
    else if (isPaymentReversal(l)) paidCents -= l.amountCents;
    else billedCents += l.amountCents;
    return {
      id: l.id,
      date: l.date,
      label: l.label,
      method: l.method,
      chargeCents: l.amountCents > 0 ? l.amountCents : 0,
      paymentCents: l.amountCents < 0 ? -l.amountCents : 0,
      balanceCents: l.balanceAfterCents,
    };
  });

  const history = community.history;
  const held = stored.length;
  const unfetched =
    history !== undefined &&
    !history.statementsLoaded.includes(homeId) &&
    (history.statementCounts[homeId] ?? 0) > held;
  const linesBegin = unfetched && history.from > from ? history.from : null;

  return {
    homeId,
    year,
    from,
    to,
    periodLabel: statementPeriodLabel(fy, year),
    rows,
    openingCents,
    closingCents: rows.length > 0 ? rows[rows.length - 1].balanceCents : openingCents,
    billedCents,
    paidCents,
    creditedCents,
    linesBegin,
  };
}
