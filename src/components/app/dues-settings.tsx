"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardHeader, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { AddChargeForm } from "@/app/board/homeowners/household-money";
import { chargeAllLine } from "@/lib/payments/charges";
import { dollarsToCents, duesTextProblem } from "@/lib/input-checks";
import {
  HOME_TYPE_LABEL,
  countByType,
  duesFor,
  homeTypesOf,
  homesWithOwnDues,
  totalDues,
} from "@/lib/home-types";
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
  const { community, updateAssociation, addChargeToAll, can } = useAppState();
  const { notify } = useToast();
  const association = community.association;
  const present = countByType(community.homes);
  // Kinds that have homes, plus any the association named at founding.
  const kinds = homeTypesOf({
    homeTypes: [...homeTypesOf(community.profile), ...present.map((p) => p.type)],
  });
  const mixed = kinds.length > 1;
  // Homes that pay an amount of their own, set on Homeowners.
  const ownCount = homesWithOwnDues(community.homes);

  const initial = () =>
    Object.fromEntries(kinds.map((k) => [k, duesFor(association, k) / 100])) as Record<
      HomeType,
      number
    >;
  // Kept as the text typed: a number state read "12e3" as 12,000 and
  // rounded a third decimal away.
  const [base, setBase] = useState(String(association.duesCents / 100));
  const [byKind, setByKind] = useState(() =>
    Object.fromEntries(Object.entries(initial()).map(([k, v]) => [k, String(v)])) as Record<HomeType, string>,
  );
  const [charging, setCharging] = useState(false);
  const homes = community.homes.length;
  const [split, setSplit] = useState(
    mixed && kinds.some((k) => duesFor(association, k) !== association.duesCents),
  );

  const centsOf = (text: string | undefined) => dollarsToCents(text ?? "");
  const nextBase = centsOf(split ? byKind[kinds[0]] : base);
  const nextByType = split
    ? (Object.fromEntries(kinds.map((k) => [k, centsOf(byKind[k])])) as Partial<
        Record<HomeType, number>
      >)
    : {};
  // The setup wizard's limits (duesTextProblem), and the database's: whole
  // cents, above $0, at most $100,000 a period.
  const problemOf = (text: string | undefined) => (text?.trim() ? duesTextProblem(text) : "Enter dues above $0");
  const valid = split ? kinds.every((k) => problemOf(byKind[k]) === null) : problemOf(base) === null;
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
  const projected = totalDues({ duesCents: nextBase, duesByType: nextByType }, community.homes);

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

        <div className="grid gap-4 sm:grid-cols-2">
          {split ? (
            kinds.map((k) => (
              <Amount
                key={k}
                label={`${HOME_TYPE_LABEL[k].many}, per ${cadence}`}
                hint={countLine(present.find((p) => p.type === k)?.count ?? 0)}
                value={byKind[k] ?? ""}
                problem={byKind[k]?.trim() ? duesTextProblem(byKind[k]) : null}
                onChange={(v) => setByKind({ ...byKind, [k]: v })}
              />
            ))
          ) : (
            <Amount
              label={ownCount ? `Standard rate, per ${cadence}` : `Each home, per ${cadence}`}
              hint={countLine(community.homes.length - ownCount)}
              value={base}
              problem={base.trim() ? duesTextProblem(base) : null}
              onChange={setBase}
            />
          )}
        </div>

        {ownCount > 0 ? (
          <p className="text-footnote text-fg-muted">
            {ownCount === 1 ? "1 home pays its own amount" : `${ownCount} homes pay their own amount`}.{" "}
            <Link href="/board/homeowners" className="font-medium text-accent hover:underline">
              See them on Homeowners
            </Link>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-footnote text-fg-muted">
            <span className="tnum font-semibold text-fg">{money(projected, { cents: false })}</span>{" "}
            per {cadence} across {community.homes.length} homes
          </p>
          <Button size="sm" disabled={!valid || !changed} onClick={save}>
            Save dues
          </Button>
        </div>

        {/* A one-off charge is not dues: it draws no late fee and does not
            move the dues figures. It sits here because this is where the
            board looks at what every home is billed. */}
        {can("finances") && homes > 0 ? (
          <div className="border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={() => setCharging((open) => !open)}>
              Charge every home
            </Button>
            {charging ? (
              <AddChargeForm
                heading="A one-off charge for every home"
                summary={(cents) => chargeAllLine(homes, cents)}
                submitLabel={`Charge ${homes} ${homes === 1 ? "home" : "homes"}`}
                onSave={(input) =>
                  Promise.resolve(addChargeToAll(input)).then((ok) => {
                    if (ok) notify(`Charge added to ${homes} ${homes === 1 ? "home" : "homes"}.`, "ok");
                    return ok;
                  })
                }
                onCancel={() => setCharging(false)}
              />
            ) : null}
          </div>
        ) : null}
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
  problem,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  problem: string | null;
  onChange: (next: string) => void;
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          aria-invalid={problem ? true : undefined}
          className={cn(fieldClass, "tnum pl-7 pr-3")}
        />
      </div>
      {problem ? (
        <span role="alert" className="mt-1 block text-caption font-medium text-danger">
          {problem}
        </span>
      ) : null}
      <span className="mt-1 block text-caption text-fg-subtle">{hint}</span>
    </label>
  );
}
