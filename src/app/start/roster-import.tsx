"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { RosterPreview } from "@/components/app/roster-preview";
import { founderLabel, founderUnit, type CommunityDraft, type DraftHousehold } from "@/lib/data/new-community";
import { homeTypesOf } from "@/lib/home-types";
import type { RosterRow } from "@/lib/roster/csv";
import { withExtras } from "./books";

/**
 * The roster from a spreadsheet, on the homes question.
 *
 * The rows become draft households: the file's unit or address is the
 * register key, the owner's name and email ride along, and the phone and
 * opening balance are kept on the row for the follow-up call the wizard
 * makes once the association exists. A home already in the list takes the
 * file's details where the list had none; the founder's own home is never
 * touched.
 */
export function RosterImport({
  draft,
  patch,
  homeWord,
}: {
  draft: CommunityDraft;
  patch: (next: Partial<CommunityDraft>) => void;
  homeWord: string;
}) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  // The founder's own home, as typed and as the ranges print it.
  const mine = new Set([founderUnit(draft).toLowerCase(), founderLabel(draft).toLowerCase()]);
  const types = homeTypesOf(draft);

  function add(rows: RosterRow[]) {
    const byUnit = new Map(draft.households.map((h) => [h.unit.trim().toLowerCase(), h]));
    let count = 0;
    for (const row of rows) {
      const key = row.unit.trim().toLowerCase();
      if (!key || mine.has(key)) continue;
      const existing = byUnit.get(key);
      const merged: DraftHousehold = withExtras(
        {
          ...(existing ?? { name: "", email: "", unit: row.unit.trim(), homeType: types[0] }),
          name: existing?.name.trim() || row.name,
          email: existing?.email.trim() || row.email,
          address: existing?.address?.trim() || row.address || undefined,
        },
        { phone: row.phone || undefined, openingBalanceCents: row.openingBalanceCents },
      );
      byUnit.set(key, merged);
      count++;
    }
    patch({ households: [...byUnit.values()] });
    setAdded(count);
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <FileSpreadsheet className="size-3.5" />
          Import a spreadsheet
        </Button>
        {added !== null ? (
          <span className="text-footnote text-fg-muted">
            {added} {added === 1 ? homeWord : `${homeWord}s`} added from the file. Check the list below.
          </span>
        ) : (
          <span className="text-footnote text-fg-subtle">
            Names, emails, phones and what each {homeWord} owes, from the list you already keep.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface-2/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-body font-semibold text-fg">From a spreadsheet</p>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <RosterPreview
        existingUnits={draft.households.map((h) => h.unit)}
        homeWord={homeWord}
        onConfirm={add}
        showBalances={draft.origin !== "builder"}
      />
    </div>
  );
}
