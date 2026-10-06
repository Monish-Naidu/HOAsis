import { CAPABILITY_LABEL } from "@/lib/data/accounts";
import type { Activity } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

/**
 * The words of the Activity record.
 *
 * Signed in, the database writes each row's summary (migration 0059, 0103);
 * the demo writes the same sentences from here so both show the same lines.
 * What the database cannot know is the community's word for a home ("Lot 1")
 * or the name an area has on the access grid, so those are put in when a row
 * is shown, not when it is stored.
 */

/** The raw home label in a row ("1"), from its details or the home it points at. */
function rawHome(row: Activity, unitLabelById: (id: string) => string | undefined): string | undefined {
  const named = row.details.home;
  if (typeof named === "string" && named) return named;
  const id = row.details.unit_id;
  return typeof id === "string" ? unitLabelById(id) : undefined;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A capability list as the access grid names the areas: "Messages, Meetings". */
function areaWords(list: unknown): string {
  if (!Array.isArray(list) || list.length === 0) return "nothing";
  return list
    .map((c) => CAPABILITY_LABEL[c as keyof typeof CAPABILITY_LABEL] ?? String(c))
    .sort()
    .join(", ");
}

/**
 * A row as it reads on screen. `placeLabel` turns "1" into "Lot 1";
 * `unitLabelById` finds a home's raw label for rows that only carry its id.
 */
export function activityText(
  row: Activity,
  placeLabel: (unit: string) => string,
  unitLabelById: (id: string) => string | undefined,
): string {
  let text = row.summary;

  // "Jo can change Communications, Voting and see ..." in the grid's own words.
  const to = (row.details.can_change as { to?: unknown } | undefined)?.to;
  const seen = (row.details.can_see as { to?: unknown } | undefined)?.to;
  if (row.subjectKind === "seat" && to !== undefined && seen !== undefined) {
    const at = text.indexOf(" can change ");
    if (at > 0) text = `${text.slice(0, at)} can change ${areaWords(to)} and see ${areaWords(seen)}`;
  }

  // "... for 1" becomes "... for Lot 1".
  const home = rawHome(row, unitLabelById);
  if (home) {
    text = text.replace(
      new RegExp(`\\b(for|to) ${escape(home)}(?![\\w])`),
      (_, word: string) => `${word} ${placeLabel(home)}`,
    );
  }
  // A stored date (2026-10-14) as the screens write dates everywhere else.
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) => formatDate(iso, "medium"));
}

/** The demo's rows, worded as the database words them. */
export const activityWords = {
  credit: (cents: number, home: string, reason: string) =>
    `Credit of ${money(cents)} added for ${home}: ${reason}`,
  dues: (home: string, cents: number | null) =>
    cents === null
      ? `Dues for ${home} set back to the standard amount`
      : `Dues for ${home} set to ${money(cents)}`,
  email: (home: string, from: string, to: string) => `Email for ${home} changed from ${from} to ${to}`,
  vendor: (name: string) => `Vendor ${name} added`,
  // The date goes in as stored; activityText reads it with formatDate.
  meeting: (title: string, date: string) => `Meeting "${title}" scheduled for ${date}`,
  meetingNotice: (title: string) => `Notice of meeting "${title}" sent to owners`,
  notice: (home: string, rule: string) => `Notice sent for ${home}: ${rule}`,
  reply: (home: string) => `Reply posted to ${home}`,
  posted: (title: string) => `Notice posted: ${title}`,
};
