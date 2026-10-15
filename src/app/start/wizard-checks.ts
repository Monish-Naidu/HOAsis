import { expandPhases, type LotPhase } from "@/lib/lots";
import { dollarsToCents } from "@/lib/input-checks";
import { founderLabel, founderUnit, type CommunityDraft } from "@/lib/data";
import { addDays } from "@/lib/utils";

/**
 * Checks the setup wizard makes on top of the shared ones.
 *
 * They live beside the wizard because they read its draft; each answers with
 * the one short line shown under the control, or null when the answer is
 * fine, the way `input-checks` does.
 */

export const WHOLE_CENTS_MESSAGE = "Whole cents only, like 12.50";

/**
 * Why text typed into a dollar field is not an amount, or null. A third
 * decimal used to be rounded away, so $1.999 was saved as $2.00 without a
 * word; it is refused instead, so what is saved is what was typed.
 */
export function wholeCentsProblem(text: string): string | null {
  if (!text.trim()) return null;
  return Number.isFinite(dollarsToCents(text)) ? null : WHOLE_CENTS_MESSAGE;
}

/**
 * The first number of a range. A range that starts below 1 would print
 * "Lot -2, Lot -1, Lot 0", and no plat is numbered that way. An empty box is
 * not an error yet: it is a range nobody has started typing.
 */
export function rangeStartProblem(phase: Pick<LotPhase, "from">): string | null {
  if (!Number.isFinite(phase.from)) return null;
  return phase.from >= 1 ? null : "Start at 1 or higher.";
}

/**
 * The ranges with the ones that start below 1 emptied, so the homes built
 * from them never include a Lot 0 or a negative lot while the box still shows
 * what was typed.
 */
export function usablePhases(phases: LotPhase[]): LotPhase[] {
  return phases.map((p) => (rangeStartProblem(p) ? { ...p, from: Number.NaN } : p));
}

/**
 * The founder's own number against the ranges, when homes go by number.
 *
 * The number is asked a screen before the ranges, so a typo there (Lot 99 on
 * a plat of 1 to 32) only shows now. Left alone it quietly took some other
 * home's place. An address-only founder has no number to check.
 */
export function founderRangeProblem(draft: CommunityDraft): string | null {
  const phases = usablePhases(draft.phases ?? []);
  if (!draft.founder.unit.trim() || phases.length === 0) return null;
  const lots = expandPhases(phases, draft.lotPrefix ?? "").map((l) => l.trim());
  if (lots.length === 0) return null;
  const mine = founderLabel({ ...draft, phases });
  if (lots.includes(mine)) return null;
  return `${founderUnit(draft)} is not in these ranges. Add it to a range, or go back and change your number.`;
}

/** The ranges' own start problems, for Continue to wait on. */
export function anyRangeStartProblem(draft: CommunityDraft): boolean {
  return (draft.phases ?? []).some((p) => rangeStartProblem(p) !== null);
}

const FIRST_BILL_WINDOW_DAYS = 731;

/**
 * Whether the first-bill date is one a board could mean: no earlier than the
 * start of the current month, which is the month the association moves in,
 * and no later than two years out. An empty box has no date to bill from.
 */
export function billingStartProblem(date: string | null | undefined, today: string): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick the date of the first bill.";
  if (date < `${today.slice(0, 7)}-01`) return "Pick a date from this month on.";
  if (date > addDays(today, FIRST_BILL_WINDOW_DAYS))
    return "Pick a date within the next 24 months.";
  return null;
}
