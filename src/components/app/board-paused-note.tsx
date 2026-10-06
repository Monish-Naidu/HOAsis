"use client";

import { boardLocked } from "@/lib/billing";
import { usePhase } from "./trial-banner";

/**
 * One quiet line for owners when the board's subscription lapsed.
 *
 * The board side is read-only then (0105), so a request or a notice they
 * expect to be answered may wait. Residents are never locked out of their
 * own statement, so the line says so. Nothing here for a paid association
 * or for the demo.
 */
export function BoardPausedNote() {
  const phase = usePhase();
  if (!phase || !boardLocked(phase)) return null;
  return (
    <p className="text-footnote text-fg-muted">
      The board&apos;s subscription is not paid, so the board side is paused. Your statement is still here.
    </p>
  );
}
