import type { ChargeLine, Cents, ISODate, Owner } from "@/lib/types";

/**
 * Per-owner account history.
 *
 * Every household needs one. The resident Account and Pay screens read the
 * ledger, while the board delinquency screens read `owner.balanceCents`, so an
 * owner with no ledger reads as "$0.00, in good standing" on one side of the
 * product and "62 days past due" on the other. Hand writing 88 of these is not
 * practical, so they are derived from facts the roster already carries.
 *
 * The generated history is deterministic: same roster in, same ledger out, and
 * it closes on exactly `owner.balanceCents` so the two sides always agree.
 */

/** Flat cost a bank charges to move an ACH debit. */
const ACH_FEE_CENTS = 35;
/** Card processing: percentage of the amount plus a fixed authorization cost. */
const CARD_RATE = 0.029;
const CARD_FIXED_CENTS = 30;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface LedgerOptions {
  /** The monthly assessment every unit is billed. */
  assessmentCents: Cents;
  /** The next assessment date. History is generated backwards from here. */
  nextChargeDate: ISODate;
  /** How many months of history to write. */
  months?: number;
  /** Hand written ledgers, which always win over a generated one. */
  handWritten?: Record<string, ChargeLine[]>;
}

/** Shifts an ISO date by whole months, holding the day of month. */
function shiftMonths(iso: ISODate, delta: number): { year: number; month: number; iso: ISODate } {
  const [y, m] = iso.split("-").map(Number);
  const zero = y * 12 + (m - 1) + delta;
  const year = Math.floor(zero / 12);
  const month = zero % 12;
  return { year, month, iso: `${year}-${String(month + 1).padStart(2, "0")}-01` };
}

function onDay(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A stable small number from an owner id, so the same owner always pays on the same day. */
function seedOf(owner: Owner): number {
  let hash = 0;
  for (const ch of owner.id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return hash;
}

function processingCost(amountCents: Cents, isAch: boolean): Cents {
  return isAch ? ACH_FEE_CENTS : Math.round(amountCents * CARD_RATE) + CARD_FIXED_CENTS;
}

/**
 * Builds one household's history, newest entry first.
 *
 * Months are paid until the unpaid window at the end, whose length is whatever
 * the owner's balance divides into. Any remainder becomes a late fee, which is
 * what a real balance that is not a clean multiple of the assessment usually is.
 */
export function buildOwnerLedger(owner: Owner, options: LedgerOptions): ChargeLine[] {
  const { assessmentCents, nextChargeDate, months = 7 } = options;
  if (assessmentCents <= 0) return [];

  const seed = seedOf(owner);
  const isAch = owner.autopay || seed % 2 === 0;
  const method = owner.autopayMethod ?? (isAch ? `Bank ••${2000 + (seed % 7000)}` : `Visa ••${1000 + (seed % 8000)}`);
  const payDay = 2 + (seed % 6);

  const unpaidMonths = Math.floor(owner.balanceCents / assessmentCents);
  const lateFeeCents = owner.balanceCents - unpaidMonths * assessmentCents;
  // A household twelve months behind needs twelve months of history, otherwise
  // the whole arrears collapses into one implausible late fee.
  const span = Math.max(months, unpaidMonths + 1);

  const lines: ChargeLine[] = [];
  let balance: Cents = 0;
  let seq = 0;
  const nextId = () => `${owner.id}-ch-${String(++seq).padStart(2, "0")}`;

  // Oldest first while the running balance is walked forward, reversed at the end.
  for (let offset = span - 1; offset >= 0; offset--) {
    const { year, month, iso } = shiftMonths(nextChargeDate, -offset);
    if (iso < owner.moveInDate) continue;
    // An owner who owes nothing has not been billed for the coming month yet.
    // Emitting that charge would close the ledger a month above their balance.
    if (offset === 0 && unpaidMonths === 0) continue;

    const charge: ChargeLine = {
      id: nextId(),
      date: iso,
      label: `${MONTH_NAMES[month]} assessment`,
      kind: "charge",
      amountCents: assessmentCents,
      balanceAfterCents: (balance += assessmentCents),
    };
    lines.push(charge);

    const isOpen = offset < unpaidMonths;
    if (isOpen) {
      // The oldest open month is where a late fee lands, since that is the one
      // that actually aged past the grace period.
      if (lateFeeCents > 0 && offset === unpaidMonths - 1) {
        lines.push({
          id: nextId(),
          date: onDay(year, month, 16),
          label: `${MONTH_NAMES[month]} late fee`,
          kind: "charge",
          amountCents: lateFeeCents,
          balanceAfterCents: (balance += lateFeeCents),
        });
      }
      continue;
    }

    const paid = balance;
    const fee = processingCost(paid, isAch);
    lines.push({
      id: nextId(),
      date: onDay(year, month, payDay),
      label: isAch ? "Bank payment" : `Card payment, ${method}`,
      kind: "payment",
      amountCents: -paid,
      balanceAfterCents: (balance -= paid),
      method,
      feeCents: fee,
      feePaidBy: "association",
      appliedTo: [{ chargeId: charge.id, label: charge.label, amountCents: paid }],
    });
  }

  return lines.reverse();
}

/** Builds the whole roster, letting hand written histories through untouched. */
export function buildOwnerLedgers(
  owners: Owner[],
  options: LedgerOptions,
): Record<string, ChargeLine[]> {
  const handWritten = options.handWritten ?? {};
  const ledgers: Record<string, ChargeLine[]> = {};
  for (const owner of owners) {
    ledgers[owner.id] = handWritten[owner.id] ?? buildOwnerLedger(owner, options);
  }
  return ledgers;
}
