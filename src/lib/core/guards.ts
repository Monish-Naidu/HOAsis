import type { CommunitySettings } from "@/lib/types";

/**
 * Runtime type guards for anything that crosses a trust boundary.
 *
 * Stored JSON is not trustworthy: it was written by an older build, possibly
 * hand edited, possibly truncated. These guards are deliberately shallow. They
 * check the shape a screen depends on, not every field, because the goal is to
 * catch "this is yesterday's schema" without turning into a second copy of the
 * type system that drifts from the first.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lifts a guard for one item into a guard for an array of them. */
export function isArrayOf<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T[] => Array.isArray(value) && value.every(guard);
}

/** Almost every domain record is identified by a string id. */
export function hasId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === "string";
}

/**
 * Guards a collection of domain records.
 *
 * The check is intentionally shallow: an array whose every element carries a
 * string id. That is enough to reject a value written by an incompatible build
 * or a truncated write, and it stops short of restating the whole type, which
 * would be a second schema to keep in sync with the first.
 */
export function isRecordArray<T extends { id: string }>() {
  return (value: unknown): value is T[] => Array.isArray(value) && value.every(hasId);
}

export interface StoredSession {
  accountId: string | null;
  view: "resident" | "admin";
}

export function isSession(value: unknown): value is StoredSession {
  if (!isRecord(value)) return false;
  const accountOk = value.accountId === null || typeof value.accountId === "string";
  const viewOk = value.view === "resident" || value.view === "admin";
  return accountOk && viewOk;
}

export function isCommunitySettings(value: unknown): value is CommunitySettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.displayName === "string" &&
    typeof value.photoUrl === "string" &&
    (value.homeLayout === "calendar" || value.homeLayout === "banner") &&
    typeof value.showFundsToResidents === "boolean" &&
    typeof value.showLiveVoteResults === "boolean" &&
    typeof value.autopayLateAfterDay === "number" &&
    typeof value.paymentFeeCents === "number" &&
    (value.paymentFeePaidBy === "owner" || value.paymentFeePaidBy === "association") &&
    typeof value.forumEnabled === "boolean" &&
    isRecord(value.banner)
  );
}
