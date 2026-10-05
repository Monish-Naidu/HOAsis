import type { AutopayPlan } from "@/lib/types";
import { isChargeable } from "@/lib/payments/autopay";

/**
 * What the autopay card on the pay screen says, worked out in one place.
 *
 * Pure, like `decideAutopay` beside it, and written against the same rules:
 * the card is a promise about what the daily run will do, so the two must
 * read a plan the same way.
 */

/** "2026-12" plus one is "2027-01". */
function monthAfter(ym: string): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** The plan's day in a month, held to the month's last day so it is a real date. */
function dayIn(ym: string, day: number): string {
  const year = Number(ym.slice(0, 4));
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const last = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(ym.slice(5, 7)) - 1];
  return `${ym}-${String(Math.min(Math.max(1, day), last)).padStart(2, "0")}`;
}

/**
 * The next day autopay runs for a plan, as YYYY-MM-DD.
 *
 * It used to be the plan's day in the month of the next dues charge. Dues
 * due on the 1st and autopay on the 5th: on November 3 the next charge is
 * December 1, so the card said December 5 while the run took the money on
 * November 5. The other way round, dues on the 15th and autopay on the 1st,
 * it named a day already gone.
 *
 * The run decides inside the current month, so this does too: this month
 * while the plan's day has not passed, next month once it has, never before
 * the month the plan starts, and never in the month it skips. The answer is
 * today or later by construction.
 *
 * One case is not the plan's day at all. Dues due on the 15th and autopay
 * on the 1st: on the 1st nothing is owed, so the run waits and records
 * nothing, and it draws on the first daily run after dues post on the 15th.
 * Naming next month's 1st there promised a debit two weeks later than the
 * one that lands. So once the plan's day has passed in a month the plan is
 * live for, and the association's next charge falls later in that same
 * month, the answer is the day of that charge.
 *
 * What is left over: if autopay has already drawn this month, a second
 * charge posted later in the month is not taken again until next month, and
 * the screen cannot see that it ran. Without a next charge date this names
 * the next plan day it can be sure of and no earlier one.
 */
export function nextAutopayDate(input: {
  plan: Pick<AutopayPlan, "day" | "startMonth" | "skipMonth">;
  /** YYYY-MM-DD, the association's clock. */
  today: string;
  /** YYYY-MM-DD, the day the association next bills dues, where it is known. */
  nextChargeDate?: string;
}): string {
  const { plan, today, nextChargeDate } = input;
  const thisMonth = today.slice(0, 7);
  const dayPassed = Number(today.slice(8, 10)) > plan.day;
  const liveThisMonth =
    !(plan.startMonth && plan.startMonth > thisMonth) && plan.skipMonth !== thisMonth;
  if (
    dayPassed &&
    liveThisMonth &&
    nextChargeDate &&
    nextChargeDate.slice(0, 7) === thisMonth &&
    nextChargeDate >= today
  ) {
    return nextChargeDate;
  }
  let month = dayPassed ? monthAfter(thisMonth) : thisMonth;
  if (plan.startMonth && plan.startMonth > month) month = plan.startMonth;
  if (plan.skipMonth === month) month = monthAfter(month);
  return dayIn(month, plan.day);
}

/**
 * The saved method autopay draws from: the one the card names, the one the
 * switch is gated on, and the one the plan is saved with.
 *
 * Those were three different readings. The card named the household's
 * default, the plan saved whatever was picked in the pay panel, and the
 * switch was live with only an unconfirmed bank on file, which the run then
 * failed on. One answer now.
 *
 * For a real association it has to be a method that can be charged with
 * nobody present. A plan already saved keeps its own method, so paying once
 * with another card does not quietly move autopay onto it. A new plan takes
 * the method picked in the pay panel if that can be charged, then the
 * default, then any that can. The demo has no processor and uses whatever
 * is selected.
 */
export function autopaySource<
  T extends { id: string; isDefault: boolean; token?: string; status?: string },
>(input: {
  isRemote: boolean;
  instruments: T[];
  /** The method on the saved plan, if there is a plan. */
  planInstrumentId?: string;
  /** What is picked in the pay panel; may be "new-ach" or "new-card". */
  panelSelection?: string;
  /** The demo's selected row. */
  selected?: T;
}): T | undefined {
  const { instruments } = input;
  if (!input.isRemote) return input.selected;
  const usable = instruments.filter((i) => isChargeable(i));
  return (
    usable.find((i) => i.id === input.planInstrumentId) ??
    usable.find((i) => i.id === input.panelSelection) ??
    usable.find((i) => i.isDefault) ??
    usable[0]
  );
}
