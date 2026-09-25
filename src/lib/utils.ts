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

export function shortMoney(cents: number) {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `$${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1000).toFixed(1)}k`;
  return money(cents, { cents: false });
}

const DAY = 86_400_000;

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

export function parseDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

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

export function daysFromToday(iso: string) {
  return Math.round((parseDate(iso).getTime() - today().getTime()) / DAY);
}

/** The same calendar day, some years on. A study dated Feb 29 comes due Mar 1. */
export function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y + years, m - 1, d));
  return date.toISOString().slice(0, 10);
}

export function relativeDays(iso: string) {
  const d = daysFromToday(iso);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  if (d > 0) return `in ${d} days`;
  return `${Math.abs(d)} days ago`;
}

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

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
