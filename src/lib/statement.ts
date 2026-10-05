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
