"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardHeader, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { AddChargeForm } from "@/app/board/homeowners/household-money";
import { chargeAllLine } from "@/lib/payments/charges";
import {
  DUES_DAY_MESSAGE,
  dollarsToCents,
  duesEffectiveProblem,
  duesTextProblem,
} from "@/lib/input-checks";
import {
  HOME_TYPE_LABEL,
  countByType,
  duesFor,
  duesTerms,
  homeTypesOf,
  homesWithOwnDues,
  sameDuesTerms,
  totalDues,
} from "@/lib/home-types";
import type { Cents, HomeType } from "@/lib/types";
import { cn, addDays, formatDate, money, todayIsoDate } from "@/lib/utils";

/**
 * What a home pays, changed after founding.
 *
 * Dues were set once in onboarding and nowhere after, so the first annual
 * increase had no screen. A change now carries the day it bills from, so a
 * board can adopt next year's rate in budget season: bills due before that
 * day keep the old amount, bills due on or after it the new one, and the
 * daily run moves the change into the stored rate on its day. A mixed
 * community sets one amount per kind of home. A home with an amount of its
 * own keeps it across a change; that amount is set on Homeowners.
 */
export function DuesSettings() {
  const { community, scheduleDuesChange, addChargeToAll, can } = useAppState();
  const { notify } = useToast();
  const association = community.association;
  const today = todayIsoDate();
  const present = countByType(community.homes);
  // Kinds that have homes, plus any the association named at founding.
  const kinds = homeTypesOf({
    homeTypes: [...homeTypesOf(community.profile), ...present.map((p) => p.type)],
  });
  const mixed = kinds.length > 1;
  // Homes that pay an amount of their own, set on Homeowners.
  const ownCount = homesWithOwnDues(community.homes);

  // What every home pays today, change included: a change whose day has come
  // is already the rate, even before the daily run has moved it into the
  // stored columns, so this block and the bills never disagree.
  const current = duesTerms(association, today);
  // The change on file, waiting for its day or freshly landed; the form
  // starts from it so a board can adjust what they scheduled.
  const waiting = association.duesChange;
  const initialSource = waiting ?? current;

  // Kept as the text typed: a number state read "12e3" as 12,000 and
  // rounded a third decimal away.
  const [base, setBase] = useState(String(initialSource.duesCents / 100));
  const [byKind, setByKind] = useState(
    () =>
      Object.fromEntries(kinds.map((k) => [k, String(duesFor(initialSource, k) / 100)])) as Record<
        HomeType,
        string
      >,
  );
  const [startsOn, setStartsOn] = useState(waiting?.effectiveOn ?? "");
  const [charging, setCharging] = useState(false);
  const homes = community.homes.length;
  const [split, setSplit] = useState(
    mixed && kinds.some((k) => duesFor(initialSource, k) !== initialSource.duesCents),
  );

  const centsOf = (text: string | undefined) => dollarsToCents(text ?? "");
  const nextBase = centsOf(split ? byKind[kinds[0]] : base);
  const nextByType = split
    ? (Object.fromEntries(kinds.map((k) => [k, centsOf(byKind[k])])) as Partial<
        Record<HomeType, Cents>
      >)
    : undefined;
  // The setup wizard's limits (duesTextProblem), and the database's: whole
  // cents, above $0, at most $100,000 a period.
  const problemOf = (text: string | undefined) =>
    text?.trim() ? duesTextProblem(text) : "Enter dues above $0";
  const amountsValid = split
    ? kinds.every((k) => problemOf(byKind[k]) === null)
    : problemOf(base) === null;
  const dayProblem = startsOn ? duesEffectiveProblem(startsOn, today) : DUES_DAY_MESSAGE;
  const valid = amountsValid && dayProblem === null;
  // A schedule is something new to say: a rate that differs from what is on
  // file, or the same rate moved to another day. Scheduling the current rate
  // for tomorrow is a no-op the button stays quiet for.
  const baseline = waiting ?? current;
  const next = { duesCents: nextBase, duesByType: nextByType };
  const changed =
    !sameDuesTerms(next, baseline) || (waiting ? startsOn !== waiting.effectiveOn : false);
  const cadence =
    association.duesCadence === "monthly"
      ? "month"
      : association.duesCadence === "quarterly"
        ? "quarter"
        : "year";
  const projected = totalDues({ duesCents: nextBase, duesByType: nextByType }, community.homes);

  async function schedule() {
    if (!valid || !changed) return;
    const ok = await scheduleDuesChange({
      duesCents: nextBase,
      duesByType: split ? nextByType : undefined,
      effectiveOn: startsOn,
    });
    if (!ok) return;
    notify(
      `Scheduled. From ${formatDate(startsOn, "long")}, ${money(projected, { cents: projected % 100 !== 0 })} per ${cadence} across every home.`,
    );
  }

  async function cancelChange() {
    const ok = await scheduleDuesChange(null);
    if (ok) notify("Cancelled. Dues stay as they are.");
  }

  return (
    <Card id="dues" className="scroll-mt-24">
      <CardHeader
        title="Dues"
        subtitle="A new rate starts on the day you pick. Bills already sent keep their amount."
      />
      <div className="flex flex-col gap-4 px-5 py-4">
        {/* What every home pays now. */}
        <div className="space-y-1.5 rounded-card bg-surface-2 px-4 py-3">
          {kinds.filter((k) => (current.duesByType?.[k] ?? 0) > 0).length ? (
            kinds
              .filter((k) => (current.duesByType?.[k] ?? 0) > 0)
              .map((k) => {
                const c = current.duesByType?.[k] ?? 0;
                return (
                  <p
                    key={k}
                    className="flex items-baseline justify-between gap-3 text-body text-fg"
                  >
                    <span>{HOME_TYPE_LABEL[k].many}</span>
                    <span className="tnum font-semibold">
                      {money(c, { cents: c % 100 !== 0 })}{" "}
                      <span className="font-normal text-fg-muted">a {cadence}</span>
                    </span>
                  </p>
                );
              })
          ) : (
            <p className="flex items-baseline justify-between gap-3 text-body text-fg">
              <span>{ownCount ? "Standard rate" : "Every home"}</span>
              <span className="tnum font-semibold">
                {money(current.duesCents, { cents: current.duesCents % 100 !== 0 })}{" "}
                <span className="font-normal text-fg-muted">a {cadence}</span>
              </span>
            </p>
          )}
          <p className="border-t border-border pt-1.5 text-footnote text-fg-muted">
            <span className="tnum font-semibold text-fg">
              {money(totalDues(current, community.homes), {
                cents: totalDues(current, community.homes) % 100 !== 0,
              })}
            </span>{" "}
            per {cadence} across {community.homes.length} homes
          </p>
        </div>

        {/* The new rates, and the day they start. */}
        <div className="space-y-3">
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
                label={`New rate, per ${cadence}`}
                hint={countLine(community.homes.length - ownCount)}
                value={base}
                problem={base.trim() ? duesTextProblem(base) : null}
                onChange={setBase}
              />
            )}
            <label className="block">
              <span className="text-footnote font-semibold text-fg-muted">Starts on</span>
              <input
                type="date"
                value={startsOn}
                min={today}
                max={addDays(today, 366)}
                onChange={(e) => setStartsOn(e.target.value)}
                aria-label="The day the new dues start"
                aria-invalid={dayProblem ? true : undefined}
                className={cn(fieldClass, "tnum mt-1.5")}
              />
              {startsOn && dayProblem ? (
                <span role="alert" className="mt-1 block text-caption font-medium text-danger">
                  {dayProblem}
                </span>
              ) : null}
            </label>
          </div>

          {ownCount > 0 ? (
            <p className="text-footnote text-fg-muted">
              {ownCount === 1
                ? "1 home pays its own amount"
                : `${ownCount} homes pay their own amount`}
              , and keeps it.{" "}
              <Link href="/board/homeowners" className="font-medium text-accent hover:underline">
                See them on Homeowners
              </Link>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-footnote text-fg-muted">
              {startsOn && !dayProblem ? (
                <>
                  <span className="tnum font-semibold text-fg">
                    {money(projected, { cents: projected % 100 !== 0 })}
                  </span>{" "}
                  per {cadence} across every home from {formatDate(startsOn, "long")}
                </>
              ) : (
                "Pick the day the new dues start"
              )}
            </p>
            <div className="flex items-center gap-2">
              {waiting ? (
                <Button variant="ghost" size="sm" onClick={cancelChange}>
                  Cancel the change
                </Button>
              ) : null}
              <Button size="sm" disabled={!valid || !changed} onClick={schedule}>
                Schedule the change
              </Button>
            </div>
          </div>
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
                    if (ok)
                      notify(`Charge added to ${homes} ${homes === 1 ? "home" : "homes"}.`, "ok");
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
