import type { Cents } from "@/lib/types";
import { daysBetween, money, pluralize } from "@/lib/utils";

/**
 * A one-off charge: a special assessment, a key fob fee, a repair billed to
 * one home. These limits are the ones add_charge and add_charge_to_all (0086)
 * enforce, so a form refuses what the database would, in the same words.
 */
export const MAX_CHARGE_CENTS: Cents = 10_000_000;
export const MAX_CHARGE_LABEL = 80;
/** How far from today a due date may be, either way. */
export const MAX_CHARGE_DAYS = 366;

/** Dollars as typed to whole cents, or 0 when it is not a positive amount. */
export function chargeCents(text: string): Cents {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/**
 * What is wrong with a charge, in words for the board, or null when it can be
 * posted. `today` is passed in so the check is pure and testable.
 */
export function chargeProblem(
  input: { amountCents: Cents; label: string; dueOn: string },
  today: string,
): string | null {
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1) {
    return "Enter an amount.";
  }
  if (input.amountCents > MAX_CHARGE_CENTS) {
    return `A charge can be at most ${money(MAX_CHARGE_CENTS, { cents: false })}.`;
  }
  const label = input.label.trim();
  if (!label) return "Say what the charge is for.";
  if (label.length > MAX_CHARGE_LABEL) {
    return `Keep what it is for to ${MAX_CHARGE_LABEL} characters.`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) || Number.isNaN(Date.parse(input.dueOn))) {
    return "Pick a due date.";
  }
  if (Math.abs(daysBetween(today, input.dueOn)) > MAX_CHARGE_DAYS) {
    return "The due date has to be within a year of today.";
  }
  return null;
}

/** "12 homes × $250.00 = $3,000.00", worked out from the records. */
export function chargeAllLine(homes: number, amountCents: Cents): string {
  return `${pluralize(homes, "home")} × ${money(amountCents)} = ${money(homes * amountCents)}`;
}
