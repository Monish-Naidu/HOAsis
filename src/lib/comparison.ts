import { percentChange } from "@/lib/metrics";
import type { Cents } from "@/lib/types";

/** Below this, an earlier figure is too small for a percentage to mean anything. */
const NEAR_ZERO_CENTS = 10_000;
/** More than this many times the earlier figure reads as noise, not a trend. */
const MAX_RATIO = 5;

/**
 * "+12%" against an earlier figure, or null when a percentage would mislead.
 *
 * A year that began with $80 in the bank and ended at $850 is "+963%", which
 * reads as a mistake. The comparison is shown only when the earlier figure is
 * a real amount (at least $100) and the change is within five times it; the
 * two figures are printed beside it either way.
 */
export function comparisonNote(now: Cents, earlier: Cents): string | null {
  if (earlier < NEAR_ZERO_CENTS) return null;
  if (now > earlier * MAX_RATIO) return null;
  return percentChange(now, earlier);
}
