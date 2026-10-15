/**
 * Checks for the amenity settings, each answering with the one short line
 * shown under the control, or null when the input is fine.
 */

/**
 * Whether an amenity's name is already on the list. Compared ignoring case and
 * repeated spaces, so "pool" and "Pool " are one amenity, and owners are not
 * offered two to book.
 */
export function amenityNameProblem(name: string, existing: readonly string[]): string | null {
  const key = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const wanted = key(name);
  if (!wanted) return null;
  return existing.some((n) => key(n) === wanted) ? `${name.trim()} is already on the list.` : null;
}

/** Bookings per day a home may hold, and per week: whole numbers within these. */
export const MAX_BOOKINGS_PER_DAY = 20;
export const MAX_BOOKINGS_PER_WEEK = 50;

/**
 * A booking limit as typed: a whole number from 1 to `max`. Anything else is
 * refused with a reason rather than rounded or clamped to 1, which is what
 * 0, -3 and 2.5 used to turn into without a word.
 */
export function bookingLimitProblem(text: string, max: number): string | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return `Use a whole number from 1 to ${max}.`;
  const n = Number(t);
  return n >= 1 && n <= max ? null : `Use a whole number from 1 to ${max}.`;
}

/**
 * A role that one person is meant to hold held by more than one. Said as a
 * warning, never refused: a board may split a seat on purpose.
 */
export function duplicateHolderNote(
  role: string,
  roleLabel: string,
  holders: readonly { name: string; role: string }[],
): string | null {
  const others = holders.filter((h) => h.role === role);
  if (others.length === 0 || role === "resident") return null;
  const names = others.map((h) => h.name).join(" and ");
  return `${names} already ${others.length === 1 ? "holds" : "hold"} ${roleLabel}. A seat can have two people; check that is what you meant.`;
}
