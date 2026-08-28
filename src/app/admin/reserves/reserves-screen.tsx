"use client";

import { useMemo } from "react";
import { AlertTriangle, PiggyBank } from "lucide-react";
import { Callout, Card, CardHeader, Meter, PageHeader, Stat } from "@/components/ui/primitives";
import { MoneyTabs } from "@/components/app/money-tabs";
import { AddReserveComponent } from "@/components/app/add-reserve-component";
import { reserveSummary } from "@/lib/metrics";
import { fundingBand } from "@/lib/reserves";
import { useAppState } from "@/lib/app-state";
import { money, pluralize, shortMoney, today } from "@/lib/utils";

/**
 * Reserves: what wears out, when, and how much of it is already set aside.
 *
 * The thirty year projection that used to live here, with its sliders and
 * its chart, is out for now. Monish asked for it on 2026-08-28: a board's
 * first question is what it is saving for and whether it is behind, and a
 * page that answers that in four numbers and a table is the one they read.
 * The projection code stays in src/lib/reserves.ts for when it comes back.
 */
export function ReservesScreen() {
  const { community } = useAppState();
  const components = community.reserveComponents;
  const summary = reserveSummary(community);
  const band = fundingBand(summary.percentFunded);
  const year = today().getUTCFullYear();

  // What the budget already sends to reserves each month, or the surplus if
  // the budget has no such line. Seeded from this association, never a
  // constant: a five home community shown a big default is nonsense.
  const monthlyCents = useMemo(() => {
    const transfer = community.budget.find((b) => b.category === "Reserve transfer");
    if (transfer) return Math.round(transfer.annualCents / 12);
    const income = community.budget
      .filter((b) => b.kind === "income")
      .reduce((t, b) => t + b.annualCents, 0);
    const expense = community.budget
      .filter((b) => b.kind === "expense")
      .reduce((t, b) => t + b.annualCents, 0);
    return Math.max(0, Math.round((income - expense) / 12));
  }, [community.budget]);

  const next = summary.urgent[0] ?? [...components].sort((a, b) => a.remainingLifeYears - b.remainingLifeYears)[0];

  if (!summary.hasStudy) {
    return (
      <>
        <MoneyTabs />
        <PageHeader eyebrow="Reserves" title="Reserves" />
        <AddReserveComponent />
        <Callout
          tone="warn"
          icon={<AlertTriangle className="size-4" />}
          title="No reserve study, so nothing here can be measured"
        >
          Percent funded compares what you have set aside against what the things you own
          will cost to replace. Without a study there is no second number, so the honest
          answer is that nobody knows.
        </Callout>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Set aside each month"
            value={money(monthlyCents, { cents: false })}
            tone={monthlyCents === 0 ? "warn" : "neutral"}
            hint="From the adopted budget"
            icon={<PiggyBank className="size-4" />}
          />
          <Stat label="Things to replace" value="0" tone="warn" hint="Roofs, paving, fencing, shared drainage" />
          <Stat label="Percent funded" value="Unknown" tone="warn" hint="Needs a study" />
        </div>

        <Card className="mt-5">
          <CardHeader
            title="What to do about it"
            subtitle="Three steps, in order, none of which need a vote to start"
          />
          <ol className="px-5 py-4">
            {[
              {
                title: "Get a quote for a reserve study",
                body: "For a community this size it is usually a few hundred dollars, and it is the input everything else needs.",
              },
              {
                title: "Put a reserve line in the budget",
                body: "A number picked from a study beats a number picked from a surplus, but any transfer beats none.",
              },
              {
                title: "Add each component above as the study names it",
                body: "Roof, paving, pool equipment: what it costs, when it is due, what is set aside. The page fills in from there.",
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3 border-b border-border py-3 last:border-b-0">
                <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-soft-fg">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-fg">{step.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </>
    );
  }

  const behind = components.filter(
    (c) => c.remainingLifeYears <= 3 && c.fundedCents < c.replacementCostCents,
  );

  return (
    <>
      <MoneyTabs />
      <PageHeader
        eyebrow="Reserves"
        title="Reserves"
        description="What wears out, when, and how much of it is already set aside."
      />
      <AddReserveComponent />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Set aside"
          value={money(summary.funded, { cents: false })}
          hint={`Against ${money(summary.required, { cents: false })} to replace everything`}
          icon={<PiggyBank className="size-4" />}
        />
        <Stat
          label="Percent funded"
          value={`${Math.round(summary.percentFunded * 100)}%`}
          tone={band.tone}
          hint={band.label}
        />
        <Stat
          label="Set aside each month"
          value={money(monthlyCents, { cents: false })}
          tone={monthlyCents === 0 ? "warn" : "neutral"}
          hint="From the adopted budget"
        />
        <Stat
          label="Replacing next"
          value={next ? String(year + next.remainingLifeYears) : "None"}
          tone={next && next.remainingLifeYears <= 2 ? "warn" : "neutral"}
          hint={next ? `${next.name}, ${shortMoney(next.replacementCostCents)}` : ""}
        />
      </div>

      {behind.length ? (
        <Callout
          tone="warn"
          className="mt-5"
          icon={<AlertTriangle className="size-4" />}
          title={`${pluralize(behind.length, "component")} due within three years ${behind.length === 1 ? "is" : "are"} not fully set aside`}
        >
          {behind
            .map(
              (c) =>
                `${c.name} in ${year + c.remainingLifeYears}: ${shortMoney(c.fundedCents)} of ${shortMoney(c.replacementCostCents)}`,
            )
            .join(". ")}
          . The gap is a special assessment unless the monthly transfer covers it first.
        </Callout>
      ) : null}

      <Card className="mt-5">
        <CardHeader
          title="What the money is for"
          subtitle="Each thing the association will replace, when, and how much is set aside"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                <th className="px-5 py-2.5 font-semibold">Component</th>
                <th className="px-3 py-2.5 text-right font-semibold">Replaced</th>
                <th className="px-3 py-2.5 text-right font-semibold">Cost</th>
                <th className="px-3 py-2.5 text-right font-semibold">Set aside</th>
                <th className="w-40 px-5 py-2.5 font-semibold">Funded</th>
              </tr>
            </thead>
            <tbody>
              {[...components]
                .sort((a, b) => a.remainingLifeYears - b.remainingLifeYears)
                .map((component) => {
                  const share = component.replacementCostCents
                    ? component.fundedCents / component.replacementCostCents
                    : 0;
                  return (
                    <tr
                      key={component.id}
                      className="border-b border-border text-[15px] last:border-b-0"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-fg">{component.name}</p>
                        {component.note ? (
                          <p className="text-[13px] text-fg-muted">{component.note}</p>
                        ) : null}
                      </td>
                      <td className="tnum px-3 py-3 text-right">
                        <span
                          className={
                            component.remainingLifeYears <= 2
                              ? "font-semibold text-warn"
                              : "text-fg-muted"
                          }
                        >
                          {year + component.remainingLifeYears}
                        </span>
                      </td>
                      <td className="tnum px-3 py-3 text-right text-fg-muted">
                        {shortMoney(component.replacementCostCents)}
                      </td>
                      <td className="tnum px-3 py-3 text-right font-medium text-fg">
                        {shortMoney(component.fundedCents)}
                      </td>
                      <td className="px-5 py-3">
                        <Meter
                          value={share}
                          tone={share >= 0.8 ? "ok" : share >= 0.4 ? "brand" : "warn"}
                          aria-label={`${component.name} ${Math.round(share * 100)} percent funded`}
                        />
                        <span className="tnum mt-1 block text-[13px] text-fg-subtle">
                          {Math.round(share * 100)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
