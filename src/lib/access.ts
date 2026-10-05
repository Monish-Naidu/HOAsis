import type { AccessLevel } from "@/lib/types";

/**
 * Where one press on a cell of the permissions grid goes next.
 *
 * Change, then see, then none, then change. A "can change" cell steps down to
 * "can see" first, so the first press never strips access entirely.
 */
export const NEXT_ACCESS: Record<AccessLevel, AccessLevel> = {
  change: "view",
  view: "none",
  none: "change",
};
