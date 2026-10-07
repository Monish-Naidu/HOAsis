import { CircuitBreaker } from "@/lib/core/circuit-breaker";
import { PersistedStore, renameLegacyFields } from "@/lib/core/store";
import { isRecord } from "@/lib/core/guards";
import type { Community } from "./community";

/**
 * Associations built through onboarding, rather than written as fixtures.
 *
 * The two demo communities ship with the app. Anything a person creates by
 * going through setup lands here instead, which keeps invented data and real
 * data in separate places and makes "reset the demo" a safe thing to offer.
 *
 * This is the store a Supabase table replaces. Everything above it, including
 * every onboarding screen, reads through the same functions either way.
 */

const breaker = new CircuitBreaker("localStorage", { failureThreshold: 3, cooldownMs: 30_000 });

/** A stored community only has to be recognizable, not exhaustively valid. */
function isCommunityArray(value: unknown): value is Community[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.id === "string" &&
        typeof entry.label === "string" &&
        isRecord(entry.association) &&
        isRecord(entry.settings) &&
        Array.isArray(entry.homes) &&
        Array.isArray(entry.accounts),
    )
  );
}

/** A community stored before homes stopped being called owners keeps its homes. */
function migrateCommunities(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    const next = renameLegacyFields(entry);
    if (!isRecord(next)) return next;
    const { owners, ownerCharges, ...rest } = next;
    return {
      ...rest,
      ...(owners !== undefined && rest.homes === undefined ? { homes: owners } : {}),
      ...(ownerCharges !== undefined && rest.homeCharges === undefined ? { homeCharges: ownerCharges } : {}),
    };
  });
}

export const createdCommunitiesStore = new PersistedStore<Community[]>(
  "hoasis:created-communities",
  [],
  {
    breaker,
    validate: isCommunityArray,
    migrate: migrateCommunities,
  },
);

/** Adds a community, replacing any earlier one with the same id. */
export function saveCreatedCommunity(community: Community): void {
  createdCommunitiesStore.update((all) => [
    ...all.filter((existing) => existing.id !== community.id),
    community,
  ]);
}

export function createdCommunities(): Community[] {
  return createdCommunitiesStore.getSnapshot();
}
