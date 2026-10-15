"use client";

import { useSyncExternalStore } from "react";
import { createdCommunitiesStore } from "@/lib/data/created-communities";

/**
 * Whether this browser built the association through setup, as opposed to
 * the sample that ships with the app. The plan page reads it: opened cold,
 * it has nothing of the visitor's to show, and the sample's name there read
 * as though the sample were theirs.
 */
export function useFoundedHere(communityId: string): boolean {
  const created = useSyncExternalStore(
    createdCommunitiesStore.subscribe,
    createdCommunitiesStore.getSnapshot,
    createdCommunitiesStore.getSnapshot,
  );
  return created.some((c) => c.id === communityId);
}
