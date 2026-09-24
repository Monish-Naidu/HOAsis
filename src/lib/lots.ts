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

import type { HomeType } from "@/lib/types";

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

    const overlaps: number[] = [];
    for (let n = phase.from; n <= phase.to; n += 1) {
      const owner = claimed.get(n);
      if (owner && owner !== phase.label) overlaps.push(n);
      else claimed.set(n, phase.label);
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
      if (lotLabel(prefix, n) === wanted || String(n) === wanted) return true;
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
  const index = phases.length + 1;
  return { id: `phase-${index}`, label: `${group} ${index}`, from: highest + 1, to: 0, homeType };
}
