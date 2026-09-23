import type { Cents } from "@/lib/types";

export type DuesCadence = "monthly" | "quarterly" | "annually";

/**
 * Which dues bill, if any, an association should have on its books today.
 *
 * Pure, so the cron's judgement can be tested without a clock. Every
 * association bills on its own due day; quarterly and annual dues count from
 * the fiscal year start. The bill for a period exists once its due date has
 * arrived, and a cron that missed a day still bills as long as the due date
 * is within the last week, because issue_assessment refuses a second bill
 * for the same due date and so catching up is safe.
 */
export interface DuesPeriod {
  /** The date the charge is due, YYYY-MM-DD. */
  dueOn: string;
  /** "October dues", "Q4 2026 dues", "2027 dues". */
  label: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number): string {
  const d = Math.min(day, daysIn(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** The most recent period whose due date is on or before today. */
export function currentDuesPeriod(input: {
  cadence: DuesCadence;
  dueDay: number;
  /** "MM-DD", the first day of the fiscal year. */
  fiscalYearStart: string;
  today: string;
}): DuesPeriod {
  const { cadence, dueDay, today } = input;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const fyMonth = Number(input.fiscalYearStart.slice(0, 2)) || 1;

  if (cadence === "monthly") {
    let y = year;
    let m = month;
    if (iso(y, m, dueDay) > today) {
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    return { dueOn: iso(y, m, dueDay), label: `${MONTHS[m - 1]} dues` };
  }

  if (cadence === "quarterly") {
    // Quarters start at the fiscal year start and every three months after.
    const candidates: DuesPeriod[] = [];
    for (let y = year - 1; y <= year; y++) {
      for (let k = 0; k < 4; k++) {
        const total = fyMonth - 1 + k * 3;
        const m = (total % 12) + 1;
        const yy = y + Math.floor(total / 12);
        candidates.push({ dueOn: iso(yy, m, dueDay), label: `Q${k + 1} ${yy} dues` });
      }
    }
    return candidates.filter((c) => c.dueOn <= today).sort((a, b) => (a.dueOn < b.dueOn ? 1 : -1))[0];
  }

  const thisFy = iso(year, fyMonth, dueDay);
  const y = thisFy <= today ? year : year - 1;
  return { dueOn: iso(y, fyMonth, dueDay), label: `${y} dues` };
}

/**
 * What the daily run should bill today, or null. A period is billed the day
 * it falls due and, if that day was missed, any day in the week after.
 */
export function duesToIssue(input: {
  cadence: DuesCadence;
  dueDay: number;
  fiscalYearStart: string;
  today: string;
  duesCents: Cents;
  /** The association's first day on the platform; nothing before it is billed. */
  since: string;
}): DuesPeriod | null {
  if (input.duesCents <= 0) return null;
  const period = currentDuesPeriod(input);
  if (period.dueOn < input.since.slice(0, 10)) return null;
  const age = daysBetween(period.dueOn, input.today);
  if (age < 0 || age > 7) return null;
  return period;
}
