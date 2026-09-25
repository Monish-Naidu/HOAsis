"use client";

import { useState } from "react";
import { Button, Card, CardHeader, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { HOME_TYPE_LABEL, countByType, duesFor, homeTypesOf, totalDues } from "@/lib/home-types";
import type { HomeType } from "@/lib/types";
import { cn, money } from "@/lib/utils";

/**
 * What a home pays, changed after founding.
 *
 * Dues were set once in onboarding and nowhere after, so the first annual
 * increase had no screen. A change applies from the next bill: statements
 * already issued keep their amount, because an owner's history never moves
 * behind them. A mixed community sets one amount per kind of home.
 *
 * Saved with a button rather than on every keystroke, because this is the
 * one number every household is billed from.
 */
export function DuesSettings() {
  const { community, updateAssociation } = useAppState();
  const { notify } = useToast();
  const association = community.association;
  const present = countByType(community.owners);
  // Kinds that have homes, plus any the association named at founding.
  const kinds = homeTypesOf({
    homeTypes: [...homeTypesOf(community.profile), ...present.map((p) => p.type)],
  });
  const mixed = kinds.length > 1;

  const initial = () =>
    Object.fromEntries(kinds.map((k) => [k, duesFor(association, k) / 100])) as Record<
      HomeType,
      number
    >;
  const [base, setBase] = useState(association.duesCents / 100);
  const [byKind, setByKind] = useState(initial);
  const [split, setSplit] = useState(
    mixed && kinds.some((k) => duesFor(association, k) !== association.duesCents),
  );

  const nextBase = Math.round((split ? byKind[kinds[0]] : base) * 100);
  const nextByType = split
    ? (Object.fromEntries(kinds.map((k) => [k, Math.round((byKind[k] ?? 0) * 100)])) as Partial<
        Record<HomeType, number>
      >)
    : {};
  const valid = split ? kinds.every((k) => (byKind[k] ?? 0) > 0) : base > 0;
  const changed =
    nextBase !== association.duesCents ||
    JSON.stringify(nextByType) !==
      JSON.stringify(split ? Object.fromEntries(kinds.map((k) => [k, duesFor(association, k)])) : {});
  const cadence =
    association.duesCadence === "monthly"
      ? "month"
      : association.duesCadence === "quarterly"
        ? "quarter"
        : "year";
  const projected = totalDues({ duesCents: nextBase, duesByType: nextByType }, community.owners);

  function save() {
    if (!valid) return;
    updateAssociation({ duesCents: nextBase, duesByType: nextByType });
    notify(`Saved. The next bill is ${money(projected, { cents: false })} across every home.`);
  }

  return (
    <Card id="dues" className="scroll-mt-24">
      <CardHeader
        title="Dues"
        subtitle="Changes apply from the next bill. Bills already sent keep their amount."
      />
      <div className="flex flex-col gap-4 px-5 py-4">
        {mixed ? (
          <div
            className="inline-flex w-fit gap-1 rounded-xl bg-surface-2 p-1"
            role="radiogroup"
            aria-label="Do kinds of home pay the same"
          >
            {[
              { id: false, label: "Same for every home" },
              { id: true, label: "Different by kind" },
            ].map((mode) => (
              <button
                key={String(mode.id)}
                type="button"
                role="radio"
                aria-checked={split === mode.id}
                onClick={() => setSplit(mode.id)}
                className={
                  split === mode.id
                    ? "rounded-lg bg-surface px-3 py-1.5 text-footnote font-medium text-fg shadow-card"
                    : "rounded-lg px-3 py-1.5 text-footnote font-medium text-fg-muted hover:text-fg"
                }
              >
                {mode.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          {split ? (
            kinds.map((k) => (
              <Amount
                key={k}
                label={`${HOME_TYPE_LABEL[k].many}, per ${cadence}`}
                hint={countLine(present.find((p) => p.type === k)?.count ?? 0)}
                value={byKind[k] ?? 0}
                onChange={(v) => setByKind({ ...byKind, [k]: v })}
              />
            ))
          ) : (
            <Amount
              label={`Each home, per ${cadence}`}
              hint={countLine(community.owners.length)}
              value={base}
              onChange={setBase}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-footnote text-fg-muted">
            <span className="tnum font-semibold text-fg">{money(projected, { cents: false })}</span>{" "}
            per {cadence} across {community.owners.length} homes
          </p>
          <Button size="sm" disabled={!valid || !changed} onClick={save}>
            Save dues
          </Button>
        </div>
      </div>
    </Card>
  );
}

function countLine(n: number): string {
  return `${n} ${n === 1 ? "home" : "homes"}`;
}

function Amount({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-footnote font-semibold text-fg-muted">{label}</span>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-fg-subtle">
          $
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className={cn(fieldClass, "tnum pl-7 pr-3")}
        />
      </div>
      <span className="mt-1 block text-caption text-fg-subtle">{hint}</span>
    </label>
  );
}
