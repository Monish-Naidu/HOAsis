import type { Announcement } from "@/lib/types";

/**
 * Pinned announcements first, then newest first within each group.
 *
 * A pin is the board saying "read this before the rest", so a newer unpinned
 * post must never sit above it, on the board list or on the residents' page.
 */
export function pinnedFirst<T extends Pick<Announcement, "pinned" | "postedDate">>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    if (a.postedDate === b.postedDate) return 0;
    return a.postedDate < b.postedDate ? 1 : -1;
  });
}
