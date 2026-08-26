import { PersistedStore } from "@/lib/core/store";
import { emptyDraft, type CommunityDraft } from "@/lib/data/new-community";

/**
 * Setup a visitor completed before they had an account.
 *
 * The "Get started" button used to build the whole association in the browser
 * and never mention signing up. Four steps, a roster of eighty-eight
 * households typed by hand, and a board that reasonably believed their
 * association was set up. It was not: none of it existed anywhere but that one
 * browser, and it was silently stranded the moment they later created an
 * account.
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
