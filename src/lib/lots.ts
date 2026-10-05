/**
 * Homes in a community that does not have residents yet.
 *
 * A new build has no residents and will not have them for two or three years.
 * What it has is numbered lots released in phases, and buyers who arrive one
 * closing at a time. An established association does have a list, but it lives
 * in a spreadsheet or a manager's system we are deliberately not importing.
 *
 * Both know their numbers, so both type ranges. Every home exists from day one,
 * which
 * is the state that makes the rest of the product correct: an unsold lot still
 * owes an assessment, still counts toward a quorum, and still has to be
 * somewhere on the roster. An association that only knows about sold lots gets
 * both its budget and its vote thresholds wrong.
 */

import type { Cents, HomeType } from "@/lib/types";

export interface LotPhase {
  /** Stable across edits so a list can key on it. */
  id: string;
  /** "Phase 1", "The Meadows". Whatever the plat calls it. */
  label: string;
  /** Inclusive. */
  from: number;
  to: number;
  /**
   * What kind of homes this run is, in a mixed community. A builder's phase
   * or a condo building is almost always one kind throughout.
   */
  homeType?: HomeType;
  /**
   * What each home in this run pays, when the board bills by home and this
   * run differs from the rest. Unset means the fallback amount.
   */
  duesCents?: Cents;
}

/**
 * The most lots one phase may create.
 *
 * A guard against a typo rather than a product limit. "1 to 1000" is a real
 * phase; "1 to 10000" is a missed decimal point, and finding out by way of ten
 * thousand rows is worse than being told.
 */
export const MAX_LOTS_PER_PHASE = 1_000;

export interface PhaseProblem {
  phaseId: string;
  kind: "reversed" | "too-many" | "overlap";
  message: string;
}

/** How many lots a phase covers, or zero if the range does not make sense. */
export function lotsInPhase(phase: LotPhase): number {
  if (!Number.isFinite(phase.from) || !Number.isFinite(phase.to)) return 0;
  if (phase.to < phase.from) return 0;
  return phase.to - phase.from + 1;
}

/**
 * A lot number as it will be printed.
 *
 * The prefix is whatever the plat uses and is stored on the home rather than
 * added at render time, because it appears on a notice, in a citation and on a
 * cheque, and those have to agree with the recorded document.
 */
export function lotLabel(prefix: string, number: number): string {
  const clean = prefix.trim();
  if (!clean) return String(number);
  // "A-" and "Lot" want different spacing, and a builder types one or the
  // other. Trailing punctuation means they have already said how it joins.
  return /[-/.\s]$/.test(prefix) ? `${prefix}${number}` : `${clean} ${number}`;
}

/**
 * What a board should be told before the homes are created.
 *
 * Overlap is the one that matters. A builder typing Phase 2 as 44 to 88 when
 * Phase 1 ended at 44 produces two Lot 44s, and the failure that follows is two
 * owners billed for one home, or one of them silently missing. Better to say so
 * than to quietly drop the duplicate.
 */
export function phaseProblems(phases: LotPhase[], homeNoun = "Lot"): PhaseProblem[] {
  const problems: PhaseProblem[] = [];
  const claimed = new Map<number, string>();

  for (const phase of phases) {
    // `to` is zero until somebody types one, and a range nobody has finished
    // entering is not an error. Reporting it as backwards put a warning under
    // the very first row of an untouched form, which reads as "you have done
    // something wrong" before they have done anything at all.
    const started = Number.isFinite(phase.to) && phase.to > 0;
    if (Number.isFinite(phase.from) && started && phase.to < phase.from) {
      problems.push({
        phaseId: phase.id,
        kind: "reversed",
        message: `${phase.label} runs from ${phase.from} down to ${phase.to}. Swap them round.`,
      });
      continue;
    }

    const count = lotsInPhase(phase);
    if (count > MAX_LOTS_PER_PHASE) {
      problems.push({
        phaseId: phase.id,
        kind: "too-many",
        message: `${phase.label} would create ${count.toLocaleString()} homes. Check the numbers.`,
      });
      continue;
    }

    // Claimed by id, not by label: two ranges a board gave the same name are
    // still two ranges, and a number in both is still listed twice.
    const overlaps: number[] = [];
    for (let n = phase.from; n <= phase.to; n += 1) {
      const owner = claimed.get(n);
      if (owner && owner !== phase.id) overlaps.push(n);
      else claimed.set(n, phase.id);
    }
    if (overlaps.length) {
      const shown = overlaps.slice(0, 3).join(", ");
      problems.push({
        phaseId: phase.id,
        kind: "overlap",
        message:
          overlaps.length === 1
            ? `${homeNoun} ${shown} is listed twice.`
            : `${homeNoun}s ${shown}${overlaps.length > 3 ? " and others" : ""} are listed twice.`,
      });
    }
  }

  return problems;
}

/**
 * Every lot the phases describe, in order, with no duplicates.
 *
 * A phase carrying a problem contributes nothing rather than contributing
 * something wrong. `phaseProblems` is what tells the builder why, and the two
 * are meant to be shown together.
 */
export function expandPhases(phases: LotPhase[], prefix = ""): string[] {
  const problems = new Set(phaseProblems(phases).map((p) => p.phaseId));
  const seen = new Set<string>();
  const lots: string[] = [];

  for (const phase of phases) {
    if (problems.has(phase.id)) continue;
    for (let n = phase.from; n <= phase.to; n += 1) {
      const label = lotLabel(prefix, n);
      if (seen.has(label)) continue;
      seen.add(label);
      lots.push(label);
    }
  }

  return lots;
}

/**
 * The range a printed number came from, or undefined.
 *
 * Answers "which phase is Lot 12 in", so a home generated from a range can
 * carry that range's kind of home.
 */
export function phaseFor(phases: LotPhase[], prefix: string, label: string): LotPhase | undefined {
  const problems = new Set(phaseProblems(phases).map((p) => p.phaseId));
  const wanted = label.trim();
  if (!wanted) return undefined;
  return phases.find((phase) => {
    if (problems.has(phase.id)) return false;
    for (let n = phase.from; n <= phase.to; n += 1) {
      // Trimmed like `wanted`: a prefix with a space in front prints one too.
      if (lotLabel(prefix, n).trim() === wanted || String(n) === wanted) return true;
    }
    return false;
  });
}

/**
 * Every lot the phases describe, each with its range's kind of home.
 *
 * Same order and the same de-duplication as `expandPhases`, so the two can
 * be used side by side.
 */
export function typedLots(
  phases: LotPhase[],
  prefix = "",
): { unit: string; homeType?: HomeType }[] {
  const problems = new Set(phaseProblems(phases).map((p) => p.phaseId));
  const seen = new Set<string>();
  const lots: { unit: string; homeType?: HomeType }[] = [];
  for (const phase of phases) {
    if (problems.has(phase.id)) continue;
    for (let n = phase.from; n <= phase.to; n += 1) {
      const unit = lotLabel(prefix, n);
      if (seen.has(unit)) continue;
      seen.add(unit);
      lots.push({ unit, homeType: phase.homeType });
    }
  }
  return lots;
}

/** How many homes the phases add up to, for a count shown while typing. */
export function totalLots(phases: LotPhase[], prefix = ""): number {
  return expandPhases(phases, prefix).length;
}

/**
 * The row the screen starts with, so it is never empty.
 *
 * `group` is what this association calls a run of numbers. A builder releases
 * land in phases; an association that has been running for years has groups.
 */
export function firstPhase(group = "Phase"): LotPhase {
  return { id: "phase-1", label: `${group} 1`, from: 1, to: 0 };
}

/** The next one, numbered and starting where the last left off. */
export function nextPhase(
  phases: LotPhase[],
  group = "Phase",
  homeType?: HomeType,
): LotPhase {
  const highest = phases.reduce(
    (max, phase) => (lotsInPhase(phase) > 0 ? Math.max(max, phase.to) : max),
    0,
  );
  // One past the highest number any row already carries, not one past the
  // count. Remove Phase 2 of three and the count says the next is 3 again,
  // which hands the new row the id of the one still on screen: the two then
  // edit and delete as one. An id with no number in it counts as nothing.
  const taken = phases.reduce((max, phase) => {
    const suffix = Number(/(\d+)$/.exec(phase.id)?.[1] ?? 0);
    return Math.max(max, suffix);
  }, 0);
  const index = Math.max(taken, phases.length) + 1;
  return { id: `phase-${index}`, label: `${group} ${index}`, from: highest + 1, to: 0, homeType };
}

/**
 * What a home made from a range carries. The wizard's rows hold more (an
 * address, a phone, an opening balance) and whatever is there rides along.
 */
export interface LotHome {
  unit: string;
  name: string;
  email: string;
  homeType?: HomeType;
}

/**
 * The lot number a label stands for, or undefined when it is not one.
 *
 * The whole label has to be the number, bare or behind one of the prefixes
 * given: "12" and "Lot 12" are lot 12, and "12 Oak St" is an address that
 * happens to start with a number. Case does not matter.
 */
export function lotNumberOf(unit: string, prefixes: string[] = []): number | undefined {
  const wanted = unit.trim().toLowerCase();
  const digits = /(\d+)$/.exec(wanted)?.[1];
  if (!digits) return undefined;
  const n = Number(digits);
  if (String(n) === wanted) return n;
  // The printed label keeps the prefix as typed where it ends in punctuation,
  // leading space and all, so it is trimmed the same way the row was. Left
  // untrimmed, " A-" printed " A-12" and no row ever matched its own label.
  return prefixes.some((prefix) => lotLabel(prefix, n).trim().toLowerCase() === wanted)
    ? n
    : undefined;
}

/** Whether somebody typed or imported anything against this home. */
export function hasDetails(home: LotHome): boolean {
  return Object.entries(home).some(([key, value]) => {
    // The label and the kind of home come from the range, not from a person.
    if (key === "unit" || key === "homeType") return false;
    if (typeof value === "string") return value.trim() !== "";
    // A balance of zero is still a balance somebody entered.
    return value !== undefined && value !== null;
  });
}

/**
 * The homes the ranges describe, with nobody's details lost on the way.
 *
 * The list is rebuilt on every keystroke in a range or the prefix, and it
 * used to be rebuilt from the printed labels alone. Changing "44" to "48"
 * passes through "4", which is four lots, and the buyers on lots 5 to 44
 * were gone before the 8 was typed. One letter of a prefix renamed every lot
 * and matched none of them. A spreadsheet imported before the ranges kept
 * only the rows the first digit happened to cover.
 *
 * So a row with details is matched by its lot number, not its label, and one
 * that no range covers right now is parked rather than dropped. Parked rows
 * come back the moment a range covers their number again. They are not homes:
 * nothing counts them, bills them or creates them while they wait.
 *
 * `previousPrefix` is what the current rows were printed with, so a prefix
 * that is being typed still finds them.
 */
export function rebuildLotHomes<T extends LotHome>(input: {
  phases: LotPhase[];
  prefix: string;
  previousPrefix?: string;
  households: T[];
  parked?: T[];
  /** The kind of home for a range that does not say. */
  fallbackType?: HomeType;
}): { households: T[]; parked: T[] } {
  const { phases, prefix, households, fallbackType } = input;
  const prefixes = [input.previousPrefix ?? prefix, prefix];

  // Everything with details, the rows on screen ahead of the parked ones so
  // the one the board is looking at wins a number both claim.
  const kept = [...households, ...(input.parked ?? [])].filter(hasDetails);
  const byNumber = new Map<number, T>();
  const unclaimed = new Set<T>(kept);
  for (const row of kept) {
    const n = lotNumberOf(row.unit, prefixes);
    if (n !== undefined && !byNumber.has(n)) byNumber.set(n, row);
  }

  const problems = new Set(phaseProblems(phases).map((p) => p.phaseId));
  const seen = new Set<number>();
  const next: T[] = [];
  for (const phase of phases) {
    if (problems.has(phase.id)) continue;
    for (let n = phase.from; n <= phase.to; n += 1) {
      if (seen.has(n)) continue;
      seen.add(n);
      const match = byNumber.get(n);
      if (match) unclaimed.delete(match);
      // Each home takes its range's kind, every time the ranges change, so
      // moving Building A from townhomes to condos moves every home in it.
      next.push({
        ...(match ?? { name: "", email: "" }),
        unit: lotLabel(prefix, n),
        homeType: phase.homeType ?? fallbackType,
      } as T);
    }
  }

  // Parked under the bare number where there is one, so the row is found
  // again whatever the prefix has become by then. Anything else keeps the
  // label it came with.
  const parked = kept
    .filter((row) => unclaimed.has(row))
    .map((row) => {
      const n = lotNumberOf(row.unit, prefixes);
      return n === undefined ? row : { ...row, unit: String(n) };
    });

  return { households: next, parked };
}

/**
 * The parked rows, split by whether a range can still bring them back.
 *
 * `waiting` rows have a lot number no range covers right now: type a range
 * over the number and they return. `unplaced` rows never will on their own.
 * Either the label is not a lot number as this list prints them ("Lot 3"
 * with no prefix typed, "012", "12A"), or the number is already another
 * row's. The screen says which is which, because telling a board a row comes
 * back when it cannot is how forty owners are waited for and never arrive.
 */
export function sortParked<T extends LotHome>(input: {
  parked: T[];
  phases: LotPhase[];
  prefix: string;
}): { waiting: T[]; unplaced: T[] } {
  const problems = new Set(phaseProblems(input.phases).map((p) => p.phaseId));
  const sound = input.phases.filter((phase) => !problems.has(phase.id));
  const covered = (n: number) => sound.some((phase) => n >= phase.from && n <= phase.to);
  const waiting: T[] = [];
  const unplaced: T[] = [];
  for (const row of input.parked) {
    const n = lotNumberOf(row.unit, [input.prefix]);
    if (n !== undefined && !covered(n)) waiting.push(row);
    else unplaced.push(row);
  }
  return { waiting, unplaced };
}
