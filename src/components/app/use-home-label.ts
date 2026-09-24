"use client";

import { useAppState } from "@/lib/app-state";
import { homeLabel } from "@/lib/wording";

/**
 * "Lot 12" in a subdivision, "Unit 4B" in a condominium, in any component.
 *
 * `placeLabel` always said "Unit", so a detached subdivision read "Lot 12" in
 * the sidebar and "Unit 12" on requests, the forum, collections and notices.
 */
export function useHomeLabel(): (unit: string) => string {
  const { community } = useAppState();
  return (unit: string) => homeLabel(community, unit);
}
