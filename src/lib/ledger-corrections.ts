import type { Cents, ID, LedgerEntry } from "@/lib/types";

/**
 * Money records are append-only (0106). A mistake is corrected by a new line
 * that points at the old one, so the books keep both and say who did what.
 * These are the pure parts of that, shared by the demo and the real thing.
 */

/** Who may be reversed from the Transactions screen: a bank line nobody has confirmed. */
export function canReverse(entry: LedgerEntry): boolean {
  return entry.status === "needs-review" && !entry.reversedEntryId && !entry.reversedById;
}

/**
 * Marks each line a reversal took back, and each reversal. A reversed line
 * that was still waiting for review is settled by its reversal, so it no
 * longer holds the review queue open and the pair nets to nothing.
 */
export function withReversals(ledger: readonly LedgerEntry[]): LedgerEntry[] {
  const reversedBy = new Map<ID, ID>();
  for (const entry of ledger) {
    if (entry.reversedEntryId) reversedBy.set(entry.reversedEntryId, entry.id);
  }
  if (reversedBy.size === 0) return [...ledger];
  return ledger.map((entry) => {
    const by = reversedBy.get(entry.id);
    if (!by) return entry;
    return {
      ...entry,
      reversedById: by,
      status: entry.status === "needs-review" ? "cleared" : entry.status,
      suggestedCategory: undefined,
      suggestionConfidence: undefined,
    };
  });
}

/** The opposite line, dated today and confirmed, as reverse_ledger_entry writes it. */
export function reversalLine(entry: LedgerEntry, id: ID, date: string): LedgerEntry {
  return {
    id,
    date,
    description: `Reversal: ${entry.description}`,
    counterparty: entry.counterparty,
    category: entry.category,
    accountId: entry.accountId,
    amountCents: -entry.amountCents,
    status: "cleared",
    matchedBy: "manual",
    reversedEntryId: entry.id,
  };
}

/**
 * What to write so a figure that is already on the books becomes `target`.
 * The earlier lines stay; the difference goes on top. Zero means nothing to write.
 */
export function correctionCents(existing: readonly Cents[], target: Cents): Cents {
  return target - existing.reduce((sum, cents) => sum + cents, 0);
}
