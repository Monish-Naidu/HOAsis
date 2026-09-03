import { PersistedStore } from "@/lib/core/store";
import { emptyDraft, type CommunityDraft } from "@/lib/data/new-community";

/**
 * Setup a visitor completed before their email was confirmed.
 *
 * The account is created on the first step of the wizard and the confirmation
 * link is left until the end, so the work is never blocked on an inbox. That
 * leaves a gap: a finished draft, an account that exists, and no session yet
 * to create the association under.
 *
 * So the draft is held here while they confirm their email, and offered back
 * the moment they return signed in. Nothing is lost, and nobody is asked to
 * type a roster twice.
 */
export interface PendingDraft {
  draft: CommunityDraft;
  /** Which address they signed up with, so we only offer it back to them. */
  email: string;
  savedAt: string;
}

export const pendingDraftStore = new PersistedStore<PendingDraft | null>(
  "hoasis:pending-draft",
  null,
  {
    validate: (value): value is PendingDraft | null =>
      value === null ||
      (typeof value === "object" &&
        value !== null &&
        "draft" in value &&
        "email" in value),
  },
);

export function savePendingDraft(draft: CommunityDraft, email: string): void {
  pendingDraftStore.set({ draft, email, savedAt: new Date().toISOString() });
}

export function clearPendingDraft(): void {
  pendingDraftStore.set(null);
}

/** A draft merged over the current defaults, so an older shape still loads. */
export function restoreDraft(pending: PendingDraft): CommunityDraft {
  return { ...emptyDraft(), ...pending.draft };
}
