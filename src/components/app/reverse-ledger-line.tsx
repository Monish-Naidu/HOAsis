"use client";

import { useState } from "react";
import { Button, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { MAX_REVERSAL_REASON, reversalReasonProblem } from "@/lib/payments/manual-payments";
import type { LedgerEntry } from "@/lib/types";

/**
 * Takes a transaction back. It asks why, writes the opposite line and keeps
 * both on the books: money records are not deleted (0106). Used by the
 * Transactions screen and the overview's review list, so the words and the
 * undo are the same in both.
 */
export function ReverseLedgerLine({ entry }: { entry: LedgerEntry }) {
  const { reverseLedgerEntry } = useAppState();
  const { notify } = useToast();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = reversalReasonProblem(reason) === null;

  if (!asking) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-danger hover:bg-danger-soft hover:text-danger"
        onClick={() => setAsking(true)}
      >
        Reverse
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        void Promise.resolve(reverseLedgerEntry(entry.id, reason.trim()))
          .then((result) => {
            if (!result) return;
            setAsking(false);
            notify("Transaction reversed. The original stays on the books.", "warn", {
              label: "Undo",
              onClick: result.undo,
            });
          })
          .finally(() => setBusy(false));
      }}
    >
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Why? Entered twice"
        maxLength={MAX_REVERSAL_REASON}
        aria-label={`Why reverse ${entry.description}`}
        className={`${fieldClass} w-44 text-footnote`}
        autoFocus
      />
      <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)}>
        Cancel
      </Button>
      <Button type="submit" variant="secondary" size="sm" disabled={busy || !ready}>
        Reverse
      </Button>
    </form>
  );
}
