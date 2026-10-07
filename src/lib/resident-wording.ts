import type { Home, Violation } from "@/lib/types";
import { formatDate, pastDueLabel, pluralize } from "@/lib/utils";

/**
 * Words the resident screens share, so the home card, the bell, the rail and
 * the pages say one thing about one fact.
 */

/**
 * The badge under a balance.
 *
 * "Paid up" is for a home that owes nothing, a credit included. A home with a
 * bill that is not late yet is "Not late", which is true and does not
 * contradict the amount printed above it.
 */
export function balanceStanding(
  home: Pick<Home, "balanceCents" | "standing" | "daysPastDue">,
): { label: string; tone: "ok" | "neutral" | "warn" | "danger" } {
  if (home.standing === "current") {
    return home.balanceCents > 0
      ? { label: "Not late", tone: "neutral" }
      : { label: "Paid up", tone: "ok" };
  }
  if (home.standing === "collections") return { label: "In collections", tone: "danger" };
  return { label: pastDueLabel(home.daysPastDue), tone: "warn" };
}

/**
 * Notices that are open and addressed to this home. The same test the
 * Requests page and the notices screen use: by owner, or by unit when the
 * home changed hands.
 */
export function openNoticesForHome(
  violations: Violation[],
  home: Pick<Home, "id" | "unit"> | null | undefined,
): Violation[] {
  if (!home) return [];
  return violations.filter(
    (v) => v.stage !== "cured" && (v.homeId === home.id || v.unit === home.unit),
  );
}

/** One row for the home card and the bell: what it is, and what happens next. */
export function noticeSummary(notices: Violation[]): { title: string; detail: string } {
  const first = [...notices].sort((a, b) => (a.nextActionDate < b.nextActionDate ? -1 : 1))[0];
  return {
    title:
      notices.length === 1 ? "A notice about your home" : `${pluralize(notices.length, "notice")} about your home`,
    detail: `${first.rule} · next step ${formatDate(first.nextActionDate)}`,
  };
}

/**
 * The line under a live meeting. The count is how many joined, and for a real
 * association nothing records that, so "0 joined" is shown to nobody.
 */
export function liveMeetingLine(joined: number): string {
  return joined > 0 ? `Meeting on now · ${joined} joined` : "Meeting on now";
}
