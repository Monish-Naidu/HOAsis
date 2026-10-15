import type { Ballot, ISODate } from "@/lib/types";

/**
 * Ballots as the board reads them back: what is wrong with the choices on a
 * new one, and the count per choice once voting is over. Pure, so the form,
 * the mutation and the tests ask the same questions.
 */

/** A choice's label as it is compared: case and repeated spaces do not make a different choice. */
function choiceKey(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * What is wrong with the choices on a new ballot, or null. Every choice needs
 * a name, and no two may read the same: "Same" and "same " would split one
 * answer across two counts.
 */
export function ballotChoicesProblem(options: readonly { label: string }[]): string | null {
  const seen = new Set<string>();
  for (const option of options) {
    const key = choiceKey(option.label);
    if (!key) return "Give every choice a name.";
    if (seen.has(key))
      return `"${option.label.trim()}" is listed twice. Give each choice its own name.`;
    seen.add(key);
  }
  return null;
}

export interface BallotResult {
  optionId: string;
  label: string;
  votes: number;
}

/** The count for each choice, in the order the ballot lists them. */
export function ballotResults(ballot: Pick<Ballot, "options">): BallotResult[] {
  return ballot.options.map((o) => ({ optionId: o.id, label: o.label, votes: o.votes }));
}

/**
 * The day voting ended, when the record has it. A ballot still open has none,
 * and neither does a closed one whose row predates the date being kept.
 */
export function ballotClosedOn(ballot: Pick<Ballot, "status" | "closedDate">): ISODate | undefined {
  return ballot.status === "closed" || ballot.status === "certified"
    ? ballot.closedDate
    : undefined;
}

/** What the board is shown after a ballot closes: the count per choice and the day it closed. */
export function closedBallotSummary(ballot: Pick<Ballot, "options" | "status" | "closedDate">): {
  results: BallotResult[];
  closedOn: ISODate | undefined;
} {
  return { results: ballotResults(ballot), closedOn: ballotClosedOn(ballot) };
}
