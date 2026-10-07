import type { Account } from "./types";

/**
 * Which of a person's seats they are looking at.
 *
 * Someone who owns two homes in one association holds two seats, one per
 * home, and the resident screens show one at a time. The choice is the unit
 * id they last picked. A unit they no longer hold (sold, or picked in another
 * association, since the remembered id is not scoped to one) matches nothing,
 * and the first seat stands in, which is what the app did before a choice
 * existed.
 */
export function pickSeat(seats: Account[], chosenUnitId: string | null | undefined): Account | null {
  if (seats.length === 0) return null;
  return seats.find((s) => s.homeId === chosenUnitId) ?? seats[0];
}

/** The quiet line above the balance when someone holds more than one home. */
export function homesLine(count: number, showingLabel: string): string {
  return `You own ${count} homes here. Showing ${showingLabel}.`;
}

/** The ballot card's note: one choice, counted for each home. */
export function voteCountLine(count: number): string {
  return `Counts once for each of your ${count} homes.`;
}
