/**
 * How a request's status and kind are named and toned on screen.
 *
 * Kept in one place because the board list, the resident list and the badges all
 * show the same status, and a status that wears two names reads as two states.
 */

import type { RequestStatus } from "@/lib/types";
import { daysFromToday, formatDate } from "@/lib/utils";

export const statusTone: Record<RequestStatus, "ok" | "danger" | "info" | "warn" | "neutral"> = {
  approved: "ok",
  denied: "danger",
  "in-review": "info",
  "info-needed": "warn",
  submitted: "neutral",
  closed: "neutral",
  draft: "neutral",
};

export const kindLabel = {
  architectural: "Home changes",
  maintenance: "Maintenance",
  records: "Records",
  amenity: "Booking",
  "violation-appeal": "Appeal",
} as const;

/**
 * The words a status wears on screen. The enum is kebab case for the
 * database; "in review" in lowercase on a badge read as a leaked value.
 */
export const statusLabel: Record<RequestStatus, string> = {
  approved: "Approved",
  denied: "Denied",
  "in-review": "Under review",
  "info-needed": "Needs info",
  submitted: "Sent",
  closed: "Closed",
  draft: "Draft",
};

/* ------------------------------------------------------------------------
 * What the board has to do next.
 *
 * Two kinds of request, each with its own states and verbs. The database keeps
 * one set of status strings, so the same string is worded by the kind:
 *
 *   Needs a decision (home changes, records, bookings, appeals):
 *     Sent -> Under review -> Approved / Denied (with a reason) -> Closed
 *   Needs work (maintenance):
 *     Sent -> Scheduled (an optional date) -> Closed (the board marks it fixed)
 *
 * "Scheduled" is the stored "in-review" on a maintenance request, so no new
 * database value is needed. Everything below derives from kind and status, so
 * the list, the badges, the sidebar count and the owner's page cannot disagree.
 * ------------------------------------------------------------------------ */

export type RequestGroup = "decision" | "scheduling" | "progress" | "done";

type Shaped = { kind: string; status: RequestStatus; workOrder?: { completedOn?: string } };

export function isMaintenanceRequest(r: { kind: string }): boolean {
  return r.kind === "maintenance";
}

/** The group that says what the board owes this request next. */
export function requestGroup(r: Shaped): RequestGroup {
  if (r.status === "approved" || r.status === "denied" || r.status === "closed") return "done";
  if (!isMaintenanceRequest(r)) return "decision";
  // A work order the board has opened and not finished is work in progress,
  // whatever the status string still says.
  if (r.status === "in-review" || (r.workOrder && !r.workOrder.completedOn)) return "progress";
  return "scheduling";
}

/** A request is open until it is approved, denied or closed. */
export function isOpenRequest(r: { status: RequestStatus }): boolean {
  return r.status !== "approved" && r.status !== "denied" && r.status !== "closed";
}

export function openRequestCount(rows: { status: RequestStatus }[]): number {
  return rows.filter(isOpenRequest).length;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * The day a maintenance request is scheduled for, if anyone said. The work
 * order's date wins; otherwise it is the date in the board's "Scheduled for
 * August 3, 2026." note, which is the only place a bare "Schedule it" keeps it.
 */
export function scheduledFor(r: {
  workOrder?: { scheduledOn?: string };
  thread: { at: string; kind: string; body?: string }[];
}): string | undefined {
  if (r.workOrder?.scheduledOn) return r.workOrder.scheduledOn;
  for (const e of [...r.thread].reverse()) {
    const m = /^Scheduled for ([A-Za-z]+) (\d{1,2}), (\d{4})\./.exec(e.body ?? "");
    const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    if (m && month >= 0) return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return undefined;
}

/**
 * The status in the words of its kind, derived from the same group the board
 * list sorts by, so a row never wears a pill that contradicts its heading:
 * under "Needs scheduling" it is not scheduled, under "Needs a decision" it is
 * sent or under review, and a finished repair is Fixed.
 */
export function requestStatusLabel(
  r: Shaped & { workOrder?: { scheduledOn?: string; completedOn?: string }; thread?: { at: string; kind: string; body?: string }[] },
): string {
  switch (requestGroup(r)) {
    case "done":
      return r.status === "closed" && isMaintenanceRequest(r) ? "Fixed" : statusLabel[r.status];
    case "scheduling":
      return "Not scheduled";
    case "progress": {
      const on = scheduledFor({ workOrder: r.workOrder, thread: r.thread ?? [] });
      return on ? `Scheduled ${formatDate(on)}` : "Scheduled";
    }
    case "decision":
      return r.status === "submitted" || r.status === "draft" ? statusLabel[r.status] : "Under review";
  }
}

export function requestStatusTone(r: Shaped): (typeof statusTone)[RequestStatus] {
  // The tone follows the label, which follows the group.
  switch (requestGroup(r)) {
    case "done":
      return statusTone[r.status];
    case "scheduling":
      return "neutral";
    case "progress":
      return "info";
    case "decision":
      return r.status === "submitted" || r.status === "draft" ? "neutral" : "info";
  }
}

/** When the board last answered in words, while the request still reads Sent. */
export function repliedOn(r: {
  status: RequestStatus;
  thread: { at: string; actorRole: string; kind: string }[];
}): string | undefined {
  if (r.status !== "submitted") return undefined;
  return [...r.thread].reverse().find((e) => e.actorRole === "board" && e.kind === "note")?.at;
}

/** The status a reply leaves behind: a decision request moves from Sent to Under review. */
export function statusAfterReply(r: { kind: string; status: RequestStatus }): RequestStatus {
  return r.status === "submitted" && !isMaintenanceRequest(r) ? "in-review" : r.status;
}

/** A closed request stays in Done for this many days, then moves to the Closed filter. */
export const RECENT_DAYS = 30;

export function groupRequests<
  T extends Shaped & { thread: { at: string }[]; decisionDate?: string; submittedDate: string },
>(rows: T[]) {
  const groups: Record<RequestGroup, T[]> = { decision: [], scheduling: [], progress: [], done: [] };
  const closed: T[] = [];
  for (const r of rows) {
    const group = requestGroup(r);
    if (group === "done" && r.status === "closed") {
      const last = r.thread.at(-1)?.at ?? r.decisionDate ?? r.submittedDate;
      if (daysFromToday(last) < -RECENT_DAYS) {
        closed.push(r);
        continue;
      }
    }
    groups[group].push(r);
  }
  // Every closed request, recent or not, is what the Closed filter lists.
  const allClosed = rows.filter((r) => r.status === "closed");
  return { ...groups, older: closed, allClosed };
}
