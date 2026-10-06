import type { Cents } from "@/lib/types";

/** One failed row of `autopay_runs`, as the Past due screen reads it. */
export interface AutopayFailure {
  unitId: string;
  /** YYYY-MM, the month autopay was trying to collect. */
  month: string;
  amountCents: Cents;
  /** Plain English already: the job writes it for the owner's email. */
  reason: string | null;
  attempts: number;
  /** YYYY-MM-DD, or null on a row written before 0085. */
  lastAttemptOn: string | null;
}

/** "2026-08-20" is month "2026-08". */
export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** The month before `isoDate`'s, as YYYY-MM. January rolls back into December. */
export function previousMonth(isoDate: string): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return month === 1
    ? `${String(year - 1).padStart(4, "0")}-12`
    : `${String(year).padStart(4, "0")}-${String(month - 1).padStart(2, "0")}`;
}

/**
 * The two months worth asking about. Last month is included because a
 * failure on the 28th is still the reason a home is behind on the 2nd.
 */
export function failureMonths(today: string): [string, string] {
  return [monthOf(today), previousMonth(today)];
}

/**
 * The failures that still explain a balance: both months, newest first, one
 * per home. A home that failed last month and again this month shows the
 * newest row only, so the card never lists a home twice.
 */
export function failuresToShow(rows: readonly AutopayFailure[], today: string): AutopayFailure[] {
  const months = failureMonths(today);
  const sorted = rows
    .filter((r) => months.includes(r.month))
    .sort(
      (a, b) =>
        b.month.localeCompare(a.month) ||
        (b.lastAttemptOn ?? "").localeCompare(a.lastAttemptOn ?? ""),
    );
  const seen = new Set<string>();
  return sorted.filter((r) => (seen.has(r.unitId) ? false : (seen.add(r.unitId), true)));
}

/** Homes that failed this calendar month, for the chip on the past-due list. */
export function failedThisMonth(rows: readonly AutopayFailure[], today: string): Set<string> {
  const month = monthOf(today);
  return new Set(rows.filter((r) => r.month === month).map((r) => r.unitId));
}

/** "Tried 3 times, last on Oct 4". `formatDate` is passed in to keep this pure. */
export function triedLine(
  failure: Pick<AutopayFailure, "attempts" | "lastAttemptOn">,
  formatDate: (iso: string) => string,
): string {
  const n = Math.max(1, failure.attempts);
  const times = n === 1 ? "once" : `${n} times`;
  return failure.lastAttemptOn
    ? `Tried ${times}, last on ${formatDate(failure.lastAttemptOn)}`
    : `Tried ${times}`;
}
