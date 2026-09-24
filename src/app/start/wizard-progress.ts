import { emptyDraft, type CommunityDraft } from "@/lib/data/new-community";

/**
 * The wizard's answers so far, held across a reload.
 *
 * QA found on 2026-09-24 that a reload halfway through setup threw away every
 * answer, which on the homes question can be forty lots and a dozen buyers.
 * So the draft and the question the reader is on are written to
 * sessionStorage as they change, restored when the wizard mounts, and cleared
 * once the association exists.
 *
 * sessionStorage rather than localStorage: a reload or a stray back button
 * should keep the work, but a half-finished setup should not greet whoever
 * opens /start on this computer next week. The account step's password is
 * never in here; it lives in that step's own state and nowhere else.
 */

const KEY = "hoasis-setup-progress";

export interface WizardProgress {
  draft: CommunityDraft;
  /** The question on screen, by id. */
  current: string;
  /** Chose "Look around first", so finishing builds a browser copy. */
  exploring: boolean;
  /** Made an account on the first step, email not yet confirmed. */
  awaitingConfirmation: boolean;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Blocked storage (a locked-down browser, some private windows) throws
    // on access. The wizard still works; it just forgets on a reload.
    return null;
  }
}

/**
 * Read once per visit to the wizard, then held.
 *
 * `useSyncExternalStore` calls its snapshot on every render and wants the
 * same answer back. The saved progress changes on every keystroke, and the
 * wizard must not remount on each one, so the first read is kept until the
 * wizard unmounts and `forgetRead` lets the next visit read afresh.
 */
let firstRead: string | null | undefined;

export function readProgressOnce(): string | null {
  if (firstRead === undefined) {
    try {
      firstRead = storage()?.getItem(KEY) ?? null;
    } catch {
      firstRead = null;
    }
  }
  return firstRead;
}

export function forgetRead(): void {
  firstRead = undefined;
}

/** Parsed and merged over the current defaults, so an older shape still loads. */
export function parseProgress(raw: string | null): WizardProgress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WizardProgress> | null;
    if (!value || typeof value !== "object" || !value.draft || typeof value.current !== "string") {
      return null;
    }
    return {
      draft: { ...emptyDraft(), ...value.draft },
      current: value.current,
      exploring: Boolean(value.exploring),
      awaitingConfirmation: Boolean(value.awaitingConfirmation),
    };
  } catch {
    return null;
  }
}

export function saveProgress(progress: WizardProgress): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Full or blocked. Losing the reload safety net is not worth an error.
  }
}

export function clearProgress(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // As above.
  }
  firstRead = undefined;
}
