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
  architectural: "Architectural",
  maintenance: "Maintenance",
  records: "Records",
  amenity: "Amenity",
  "violation-appeal": "Appeal",
} as const;
