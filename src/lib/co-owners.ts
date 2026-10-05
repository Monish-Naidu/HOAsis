/**
 * Wording and rules for taking one owner off a home that has two.
 *
 * The database decides (remove_owner, 0090); these only keep the screen from
 * offering what it would refuse, and keep the words in one place.
 */

/** One person's seat on a home, as the household panel needs it. */
export interface OwnerSeat {
  /** The membership id for a real association, the account id in the demo. */
  id: string;
  name: string;
  /** The signed-in account that holds the seat, if anybody has claimed it. */
  accountId?: string;
  /** False for the president, anybody on the board, and anybody with a role. */
  removable: boolean;
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/**
 * The seats the viewer may offer to remove. Never the viewer's own (leaving
 * is a different flow), and never at all unless two people are on the home,
 * because the last owner goes by a recorded sale.
 */
export function removableSeats(seats: readonly OwnerSeat[], viewerAccountId: string | null): OwnerSeat[] {
  if (seats.length < 2) return [];
  return seats.filter((s) => s.removable && !(viewerAccountId && s.accountId === viewerAccountId));
}

export function removeConfirmText(name: string, otherName: string, homeLabel: string): string {
  return `${name} loses access to ${homeLabel} today. ${otherName} stays. Saved payment methods ${name} added are removed.`;
}

export const removedToast = (name: string, homeLabel: string): string =>
  `${name} removed from ${homeLabel}.`;
