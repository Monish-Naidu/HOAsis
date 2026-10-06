import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type scale in globals.css. Without this, tailwind-merge reads
// `text-footnote` as a colour and drops it next to `text-fg-muted`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "footnote", "callout", "body", "headline", "title3", "title2", "title1"],
    },
  },
});

/** Joins class names, letting a later Tailwind class win over an earlier one that sets the same thing. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Money is stored in integer cents everywhere. Never floats on a ledger. */
export function money(cents: number, opts: { sign?: boolean; cents?: boolean } = {}) {
  const { sign = false, cents: showCents = true } = opts;
  const value = Math.abs(cents) / 100;
  const formatted = value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  if (cents < 0) return `-${formatted}`;
  return sign ? `+${formatted}` : formatted;
}

/** Cents as a compact figure for tight places: $1.2k, $45k, $1.5M. */
export function shortMoney(cents: number) {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `$${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1000).toFixed(1)}k`;
  return money(cents, { cents: false });
}

/** Milliseconds in a day. */
export const DAY_MS = 86_400_000;

/**
 * The prototype runs on a pinned clock rather than the wall clock, so relative
 * dates read identically on every machine and on every day someone opens it.
 *
 * It is pinned per association, not globally, because each one's fixture data
 * is written as of its own date. Reading Test Community #1's February 2027 books
 * against a 2026 clock renders an overdue item as "in 133 days" and opens the
 * calendar on a month with nothing in it.
 *
 * `setToday` is called by the app state when the active community resolves.
 */
const DEFAULT_TODAY = "2026-08-20";
let todayIso = DEFAULT_TODAY;

/** Pins "today" to the given date for the active association. */
export function setToday(iso: string): void {
  todayIso = iso;
}

/** The pinned "now" as a Date. */
export function today(): Date {
  return new Date(`${todayIso}T12:00:00Z`);
}

/** The pinned "now" as a `YYYY-MM-DD` string. */
export function todayIsoDate(): string {
  return todayIso;
}

/**
 * "18:30" as "6:30 PM", the way every other time in the product reads. A
 * time input stores the 24 hour form, so a meeting scheduled here read
 * "18:30" beside an announcement that said "6:30pm". Anything else passes
 * through ("All day").
 */
export function clockTime(value: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return value;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** A `YYYY-MM-DD` string as a Date at noon UTC, so no timezone shifts it to another day. */
export function parseDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

/** A date string for display: `short` is 8/20, `medium` the default, `long` August 20, 2026. */
export function formatDate(iso: string, style: "short" | "medium" | "long" = "medium") {
  const d = parseDate(iso);
  if (style === "short") {
    return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" });
  }
  if (style === "long") {
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  // A date from another year says which. Five years in, a notice, a request
  // and a letter all read "Aug 18", and two of them were years apart.
  const year = d.getUTCFullYear() === today().getUTCFullYear() ? undefined : "numeric";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year, timeZone: "UTC" });
}

/**
 * A date a number of days after another, as a plain YYYY-MM-DD string.
 *
 * Response deadlines are counted in days from a submission, and doing that with
 * `new Date()` arithmetic in a component reintroduces the drift the pinned
 * clock exists to prevent.
 */
export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The next date dues fall due on or after `from`.
 *
 * Dues are billed on the association's due day, in the months its cadence
 * lands on: every month, every third month counted from the fiscal year
 * start, or the fiscal year's first month alone. A helper that knows only the
 * day told a quarterly association in October that its next bill was November
 * 1, and the dues email said so to every owner; the bill was January 1.
 * The due day is held to 1 through 28, as the database holds it.
 */
export function nextDueOnOrAfter(
  from: string,
  dueDay: number,
  cadence: "monthly" | "quarterly" | "annually",
  fiscalYearStart: string,
): string {
  const day = Math.min(Math.max(1, dueDay), 28);
  const fyMonth = Number(fiscalYearStart.slice(0, 2)) || 1;
  const step = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  const [y, m] = from.split("-").map(Number);
  // Walk month by month from this month, keeping only months on the cadence.
  for (let i = 0; i < 24; i++) {
    const total = y * 12 + (m - 1) + i;
    const yy = Math.floor(total / 12);
    const mm = (total % 12) + 1;
    const onCadence = ((mm - fyMonth) % step + step) % step === 0;
    if (!onCadence) continue;
    const candidate = `${yy}-${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (candidate >= from) return candidate;
  }
  return addDays(from, 30);
}

/** Whole days from one date to another; negative when `to` is before `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY_MS);
}

/** Whole days from the pinned today to the date; negative for a date in the past. */
export function daysFromToday(iso: string) {
  return Math.round((parseDate(iso).getTime() - today().getTime()) / DAY_MS);
}

/** The same calendar day, some years on. A study dated Feb 29 comes due Mar 1. */
export function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y + years, m - 1, d));
  return date.toISOString().slice(0, 10);
}

/** A date in words relative to today: "today", "tomorrow", "in 5 days", "3 days ago". */
export function relativeDays(iso: string) {
  const d = daysFromToday(iso);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  if (d > 0) return `in ${d} days`;
  return `${Math.abs(d)} days ago`;
}

/** Up to two capital letters from the first two words of a name. */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** 1st, 2nd, 3rd, 4th. Used wherever a day of the month is shown. */
export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = n % 100;
  return `${n}${suffixes[(remainder - 20) % 10] ?? suffixes[remainder] ?? suffixes[0]}`;
}

/** The count with its noun, singular for exactly one: "1 home", "3 homes". */
export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * How late a balance is, in words. A balance that fell due this morning is
 * owed and zero days late, and "0 days past due" read as a bug.
 */
export function pastDueLabel(days: number): string {
  return days <= 0 ? "Due today" : `${pluralize(days, "day")} past due`;
}
