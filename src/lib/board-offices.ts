import { ROLE_LABEL, type Account, type MessageThread, type Office, type ThreadAddress } from "./types";

/**
 * The offices an owner can write to, and the rules that follow from it.
 *
 * A thread is addressed to an office, not a person, so it follows the office
 * when officers change at an election. Everyone on the board can still read
 * it; the address only says whose it is.
 */

export const OFFICES: readonly Office[] = ["president", "vice-president", "treasurer", "secretary"];

/** One line each, in words an owner uses, on what the office handles. */
const HANDLES: Record<Office, string> = {
  president: "Anything, and the final say.",
  "vice-president": "Steps in when the President is away.",
  treasurer: "Dues, payments and the budget.",
  secretary: "Records, minutes and meetings.",
};

export interface BoardOffice {
  office: Office;
  /** "Treasurer". */
  label: string;
  /** Who holds it today, or null when nobody does. */
  holder: string | null;
  handles: string;
}

/**
 * The four offices with whoever holds each today, from the community's
 * accounts. When two accounts hold one office the first listed is named.
 */
export function boardOffices(accounts: readonly Pick<Account, "name" | "role">[]): BoardOffice[] {
  return OFFICES.map((office) => ({
    office,
    label: ROLE_LABEL[office],
    holder: accounts.find((a) => a.role === office)?.name ?? null,
    handles: HANDLES[office],
  }));
}

/** "Treasurer, Dana Whitcomb", or "Treasurer, nobody holds this office yet". */
export function officeChoiceLabel(o: BoardOffice): string {
  return o.holder ? `${o.label}, ${o.holder}` : `${o.label}, nobody holds this office yet`;
}

/** What a thread's address reads as on a label: "Treasurer" or "The board". */
export function addressLabel(to: ThreadAddress): string {
  return to === "board" ? "The board" : ROLE_LABEL[to];
}

/** The small label on a thread: "To the board" or "To the Treasurer". */
export function toLabel(to: ThreadAddress): string {
  return to === "board" ? "To the board" : `To the ${ROLE_LABEL[to]}`;
}

/** The office a seat holds, or null for a resident. */
export function officeOf(role: Account["role"] | undefined): Office | null {
  return role && role !== "resident" ? role : null;
}

/**
 * The "Mine" filter: threads addressed to the office the viewer holds, and
 * to the board as a whole, which is everyone's. A viewer with no office sees
 * only the board's.
 */
export function isMine(thread: Pick<MessageThread, "toRole">, viewer: Account["role"] | undefined): boolean {
  return thread.toRole === "board" || thread.toRole === officeOf(viewer);
}

/**
 * Unanswered threads per address: the last word is the owner's. Counts every
 * address, so the dashboard can show a number per office.
 */
export function unansweredByAddress(
  threads: readonly Pick<MessageThread, "toRole" | "messages">[],
): Record<ThreadAddress, number> {
  const counts: Record<ThreadAddress, number> = {
    board: 0,
    president: 0,
    "vice-president": 0,
    treasurer: 0,
    secretary: 0,
  };
  for (const t of threads) {
    if (t.messages[t.messages.length - 1]?.fromRole === "resident") counts[t.toRole] += 1;
  }
  return counts;
}

/**
 * How a board reply is signed: "Dana Whitcomb, Treasurer, for the board", or
 * "Dana Whitcomb, for the board" for a seat with no office. A message with
 * no name is the board.
 */
export function boardSignature(name: string | undefined, office: Office | null | undefined): string {
  const who = (name ?? "").trim();
  if (!who) return office ? `${ROLE_LABEL[office]}, for the board` : "The board";
  return office ? `${who}, ${ROLE_LABEL[office]}, for the board` : `${who}, for the board`;
}
