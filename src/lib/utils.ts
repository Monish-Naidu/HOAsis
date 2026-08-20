import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

/** Fixed "today" so the prototype reads identically on every machine and date. */
export const TODAY = new Date("2026-08-20T12:00:00Z");

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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function daysFromToday(iso: string) {
  return Math.round((parseDate(iso).getTime() - TODAY.getTime()) / DAY);
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

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
