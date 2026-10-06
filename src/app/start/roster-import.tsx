"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { RosterPreview } from "@/components/app/roster-preview";
import {
  defaultHomeNaming,
  founderLabel,
  founderUnit,
  type CommunityDraft,
  type DraftHousehold,
} from "@/lib/data";
import { homeTypesOf } from "@/lib/home-types";
import { lotNumberOf, rebuildLotHomes } from "@/lib/lots";
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
 *
 * Where homes go by number, a row is matched to its lot by the number, so
 * the file's "12" lands on "Lot 12" and not on a second home beside it. A
 * row no range covers yet is parked on the draft, not made a home and not
 * dropped: the ranges are often typed after the file comes in, and it joins
 * the list when one covers it.
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
  const [result, setResult] = useState<{ added: number; waiting: number; withDues: number } | null>(
    null,
  );

  function add(rows: RosterRow[]) {
    const merged = mergeRoster(draft, rows);
    patch(merged.patch);
    setResult({ added: merged.added, waiting: merged.waiting, withDues: merged.withDues });
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <FileSpreadsheet className="size-3.5" />
          Import a spreadsheet
        </Button>
        {result !== null ? (
          <span className="text-footnote text-fg-muted">
            {result.added} {result.added === 1 ? homeWord : `${homeWord}s`} added from the file.
            {/* Said apart, because a row waiting for a range is not a home
                yet and "60 added" over a list of 40 hid the other 20. */}
            {result.waiting > 0
              ? ` ${result.waiting} more ${result.waiting === 1 ? "is" : "are"} not on the list yet. See below.`
              : " Check the list below."}
            {/* Dues in the file switch the dues answer, so say so. */}
            {result.withDues > 0
              ? ` ${result.withDues} ${result.withDues === 1 ? "has" : "have"} their own dues, so dues are now set by home.`
              : ""}
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
        showDues
      />
    </div>
  );
}

/**
 * A file's rows folded into the draft, and what became of them.
 *
 * `added` is the homes on the list that took a row from this file. `waiting`
 * is the rows from this file that are not homes yet, because no range covers
 * them or their label is not a number the ranges print. The two are counted
 * apart so the line under the button never says a row was added when it was
 * only parked.
 */
export function mergeRoster(
  draft: CommunityDraft,
  rows: RosterRow[],
): { patch: Partial<CommunityDraft>; added: number; waiting: number; withDues: number } {
  const numbered = (draft.homeNaming ?? defaultHomeNaming(draft)) === "numbers";
  const prefix = draft.lotPrefix ?? "";
  // One key per home however it is spelled: by lot number where homes are
  // numbered, by the label itself otherwise.
  const keyOf = (unit: string) => {
    const n = numbered ? lotNumberOf(unit, [prefix]) : undefined;
    // A key no typed label can equal, so "Lot 5" in a file is never taken
    // for lot 5 by accident where the ranges print a bare "5".
    return n === undefined ? unit.trim().toLowerCase() : `\u0000${n}`;
  };
  // The founder's own home, as typed and as the ranges print it.
  const mine = new Set([keyOf(founderUnit(draft)), keyOf(founderLabel(draft))]);
  const types = homeTypesOf(draft);

  const parked = numbered ? (draft.parkedHouseholds ?? []) : [];
  // The rows on the list first. A parked row joins only where its number is
  // free; one that shares a number with a listed row stays parked. Built
  // from both at once, the parked row came last and took the listed row's
  // place: the owner on lot 3 was swapped for a duplicate, with no line said.
  const byUnit = new Map(draft.households.map((h) => [keyOf(h.unit), h]));
  const held: DraftHousehold[] = [];
  for (const h of parked) {
    const key = keyOf(h.unit);
    if (byUnit.has(key)) held.push(h);
    else byUnit.set(key, h);
  }
  // The homes this file touched, each once however many rows named it.
  const fromFile = new Set<string>();
  // A row's amount rides on its home. Any amount in the file turns dues to
  // "by home", or the amounts would be kept and never billed.
  const withDues = rows.filter((r) => r.duesCents !== undefined && r.duesCents > 0).length;
  const duesPatch: Partial<CommunityDraft> =
    withDues > 0 ? { duesByHome: true, duesByType: undefined } : {};
  for (const row of rows) {
    const key = keyOf(row.unit);
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
    if (row.duesCents !== undefined && row.duesCents > 0) merged.duesCents = row.duesCents;
    byUnit.set(key, merged);
    fromFile.add(key);
  }
  if (!numbered) {
    return {
      patch: { households: [...byUnit.values()], ...duesPatch },
      added: fromFile.size,
      waiting: 0,
      withDues,
    };
  }
  // Back through the ranges, so each row sits on its lot under the label the
  // ranges print, and the rest wait for a range.
  const rebuilt = rebuildLotHomes<DraftHousehold>({
    phases: draft.phases ?? [],
    prefix,
    households: [...byUnit.values()],
    fallbackType: types[0],
  });
  // Counted from where each row ended up, not from the file: a row with a
  // number outside every range and nothing on it is neither.
  const touched = (h: DraftHousehold) => fromFile.has(keyOf(h.unit));
  const stillParked = [...rebuilt.parked, ...held];
  return {
    patch: {
      households: rebuilt.households,
      parkedHouseholds: stillParked.length ? stillParked : undefined,
      ...duesPatch,
    },
    added: rebuilt.households.filter(touched).length,
    waiting: rebuilt.parked.filter(touched).length,
    withDues,
  };
}
