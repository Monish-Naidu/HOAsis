/**
 * The month grid and the upcoming list behind the calendar screens.
 *
 * Pure date arithmetic on `YYYY-MM-DD` strings, with no clock of its own: the
 * caller says what today is, so the demo's pinned date and each association's
 * `asOf` read the same way here as everywhere else.
 */

import { DAY_MS, parseDate } from "@/lib/utils";

export type CalendarKind = "meeting" | "event" | "ballot-opens" | "ballot-closes" | "deadline";

export interface CalendarEntry {
  id: string;
  date: string;
  title: string;
  detail?: string;
  kind: CalendarKind;
  href?: string;
}

export const kindLabel: Record<CalendarKind, string> = {
  meeting: "Meeting",
  event: "Event",
  "ballot-opens": "Ballot opens",
  "ballot-closes": "Ballot closes",
  deadline: "Deadline",
};

export const kindTone: Record<CalendarKind, "brand" | "ok" | "warn" | "info" | "neutral"> = {
  meeting: "brand",
  event: "ok",
  "ballot-opens": "info",
  "ballot-closes": "warn",
  deadline: "warn",
};

export interface MonthCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  entries: CalendarEntry[];
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** A six week grid starting on the Sunday on or before the first of the month. */
export function monthGrid(
  year: number,
  month: number,
  entries: CalendarEntry[],
  todayIso: string,
): MonthCell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * DAY_MS);
  const byDate = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY_MS);
    const key = iso(d);
    return {
      date: key,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
      isToday: key === todayIso,
      entries: byDate.get(key) ?? [],
    };
  });
}

export function monthName(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Entries on or after a date, soonest first. */
export function upcomingFrom(entries: CalendarEntry[], fromIso: string, limit?: number) {
  const from = parseDate(fromIso).getTime();
  const rows = entries
    .filter((e) => parseDate(e.date).getTime() >= from)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return limit ? rows.slice(0, limit) : rows;
}

/**
 * The month the calendar opens on: the next meeting's, so it does not open on
 * a month with nothing in it. When no meeting is coming, the next thing of
 * any kind; when nothing is coming at all, the community's own "today". A
 * meeting counts whatever its state, because a cancelled one stays on the
 * calendar marked, and the reader decides what to do with it there.
 */
export function openingMonth(
  entries: CalendarEntry[],
  asOf: string,
): { year: number; month: number } {
  const upcoming = upcomingFrom(entries, asOf);
  const next = upcoming.find((e) => e.kind === "meeting") ?? upcoming[0] ?? { date: asOf };
  const [year, month] = next.date.split("-").map(Number);
  return { year, month: month - 1 };
}
