/**
 * The request number a confirmation screen may show.
 *
 * The form numbers a request from the requests it can see, and an owner sees
 * only their own. The database then gives a number already taken in the
 * association the next free one. So for a real association the form's number
 * is a guess: owner B, with no requests of their own, was told "Reference
 * REQ-2026-200" for a request stored as REQ-2026-201, and REQ-2026-200 was a
 * neighbour's. A wrong number is worse than none, so the guess is never
 * shown there. Only what the database stored is, once the state layer hands
 * it back.
 *
 * The demo has no database to renumber anything, so the form's number is the
 * number.
 *
 * Null means "no number to show": the screen says where to find it instead.
 */
export function confirmedReference(input: {
  isRemote: boolean;
  /** The number the form made up. */
  guessed: string;
  /** What the write answered with, if it answers with anything. */
  stored?: unknown;
}): string | null {
  if (typeof input.stored === "string" && input.stored.trim()) return input.stored.trim();
  return input.isRemote ? null : input.guessed;
}
