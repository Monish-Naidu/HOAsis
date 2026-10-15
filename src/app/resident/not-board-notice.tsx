"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, X } from "lucide-react";

/**
 * The one line a resident sees after opening a board address. They are sent
 * home (`BoardOnly`), and without a word that looked like the link was broken.
 * Dismissing it drops the marker from the address, so a reload does not
 * bring it back.
 */
export function NotBoardNotice() {
  return (
    <Suspense fallback={null}>
      <Notice />
    </Suspense>
  );
}

function Notice() {
  const params = useSearchParams();
  const router = useRouter();
  if (params.get("from") !== "board") return null;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-card border border-border bg-surface-2 px-4 py-3"
    >
      <Lock className="size-4 shrink-0 text-fg-muted" aria-hidden />
      <p className="min-w-0 flex-1 text-body text-fg">
        You are not on the board of this association.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => router.replace("/resident")}
        className="press -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
