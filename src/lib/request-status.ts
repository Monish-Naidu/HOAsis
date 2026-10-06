/**
 * How a request's status and kind are named and toned on screen.
 *
 * Kept in one place because the board list, the resident list and the badges all
 * show the same status, and a status that wears two names reads as two states.
 */

import type { RequestStatus } from "@/lib/types";

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
  "in-review": "In review",
  "info-needed": "Needs info",
  submitted: "Submitted",
  closed: "Closed",
  draft: "Draft",
};
