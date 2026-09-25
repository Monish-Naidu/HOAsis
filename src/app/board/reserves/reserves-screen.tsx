"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, PiggyBank, Plus } from "lucide-react";
import { Button, Callout, Card, CardHeader, Meter, PageHeader, Stat } from "@/components/ui/primitives";
import { AddReserveComponent } from "@/components/app/add-reserve-component";
import { ReserveStudyCard } from "@/components/app/reserve-study-card";
import { ReserveTransferForm } from "@/components/app/reserve-transfer-form";
import { cashPosition, reserveSummary } from "@/lib/metrics";
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
  const [open, setOpen] = useState<"component" | "transfer" | null>(null);
  const hasAccounts =
    community.bankAccounts.some((b) => b.kind === "operating") &&
    community.bankAccounts.some((b) => b.kind !== "operating");
  const addButton = open ? undefined : (
    <div className="flex flex-wrap gap-2">
      {hasAccounts ? (
        <Button variant="secondary" size="md" onClick={() => setOpen("transfer")}>
          <ArrowRightLeft className="size-3.5" />
          Move money to reserves
        </Button>
      ) : null}
      <Button variant="secondary" size="md" onClick={() => setOpen("component")}>
        <Plus className="size-3.5" />
        Add a component
      </Button>
    </div>
  );
  const addForm =
    open === "component" ? (
      <AddReserveComponent onClose={() => setOpen(null)} />
    ) : open === "transfer" ? (
      <ReserveTransferForm onClose={() => setOpen(null)} />
    ) : null;
  const components = community.reserveComponents;
  const summary = reserveSummary(community);
  const band = fundingBand(summary.percentFunded);
  const year = today().getUTCFullYear();

  // What the adopted budget sends to reserves each month, and only that. It
  // used to fall back to income minus expenses, so a new association with a
  // dues line and nothing else was told it set aside $360 a month "from the
  // adopted budget" it did not have. No reserve line means no figure.
  const monthlyCents = useMemo(() => {
    const transfer = community.budget.find((b) => b.category === "Reserve transfer");
    return transfer ? Math.round(transfer.annualCents / 12) : null;
  }, [community.budget]);
  const inAccounts = cashPosition(community).reserve;
  const unassigned = inAccounts - summary.funded;

  const next = summary.urgent[0] ?? [...components].sort((a, b) => a.remainingLifeYears - b.remainingLifeYears)[0];

  if (!summary.hasStudy) {
    return (
      <>
        <PageHeader
          title="Reserves"
          description="Components, replacement dates, and funds set aside."
          action={addButton}
        />
        {addForm}
        <Callout
          tone="warn"
          icon={<AlertTriangle className="size-4" />}
          title="No reserve study, so nothing here can be measured"
        >
          Percent funded compares what you have set aside against what the things you own
          will cost to replace. Without a study there is no second number, so the honest
          answer is that nobody knows.
        </Callout>

        <ReserveStudyCard />

        <Card className="mt-6">
          <CardHeader title="What to do about it" subtitle="Three steps, in order" />
          <ol className="px-5 py-4">
            {[
              community.settings.reserveStudy
                ? {
                    title: "Open the study on file",
                    body: "It is above, and under Documents. Everything below comes out of it.",
                  }
                : {
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
                <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-footnote font-semibold text-brand-soft-fg">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-fg">{step.title}</span>
                  <span className="mt-0.5 block text-footnote leading-relaxed text-fg-muted">
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

  const sorted = [...components].sort((a, b) => a.remainingLifeYears - b.remainingLifeYears);
  const behind = components.filter(
    (c) => c.remainingLifeYears <= 3 && c.fundedCents < c.replacementCostCents,
  );

  return (
    <>
      <PageHeader
        title="Reserves"
        description="Components, replacement dates, and funds set aside."
        action={addButton}
      />
      {addForm}

      {/* The first figure is the bank's, the same number Finances shows as
          Reserve accounts. What is assigned to components is named as that,
          so "set aside" never means two amounts on two screens. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="In reserve accounts"
          value={money(inAccounts, { cents: false })}
          hint={
            unassigned > 0
              ? `${money(summary.funded, { cents: false })} assigned, ${money(unassigned, { cents: false })} not yet`
              : `${money(summary.funded, { cents: false })} assigned to components`
          }
          icon={<PiggyBank className="size-4" />}
        />
        <Stat
          label="Percent funded"
          value={`${Math.round(summary.percentFunded * 100)}%`}
          tone={band.tone}
          hint={`${band.label}. ${money(summary.funded, { cents: false })} of ${money(summary.required, { cents: false })}`}
        />
        <Stat
          label="Budgeted each month"
          value={monthlyCents === null ? "None" : money(monthlyCents, { cents: false })}
          tone={monthlyCents ? "neutral" : "warn"}
          hint={monthlyCents === null ? "No reserve line in the budget" : "The budget's reserve line"}
        />
        <Stat
          label="Replacing next"
          value={next ? String(year + next.remainingLifeYears) : "None"}
          tone={next && next.remainingLifeYears <= 2 ? "warn" : "neutral"}
          hint={next ? `${next.name}, ${shortMoney(next.replacementCostCents)}` : ""}
        />
      </div>

      {/* Components cannot hold more than the accounts do. When they claim
          to, the funding figure above is a promise, not a balance. */}
      {summary.funded > inAccounts ? (
        <Callout
          tone="warn"
          icon={<AlertTriangle className="size-4" />}
          title={`Components claim ${money(summary.funded, { cents: false })}, the reserve account holds ${money(inAccounts, { cents: false })}`}
          className="mt-6"
        >
          Record the transfers that moved money in, or lower what each component has set aside.
        </Callout>
      ) : null}

      {behind.length ? (
        <Callout
          tone="warn"
          className="mt-6"
          icon={<AlertTriangle className="size-4" />}
          title={`${pluralize(behind.length, "component")} due within three years ${behind.length === 1 ? "is" : "are"} not fully set aside`}
        >
          {behind
            .map(
              (c) =>
                `${c.name} in ${year + c.remainingLifeYears}: ${shortMoney(c.fundedCents)} of ${shortMoney(c.replacementCostCents)}`,
            )
            .join(". ")}
          .
        </Callout>
      ) : null}

      <Card className="mt-6">
        <CardHeader title="What the money is for" subtitle="Each component, when it is due, and what is set aside" />
        {/* On a phone, one row per component: name and cost on a line, the
            year and how much is set aside under it. The table's money
            columns were off the edge at 375 with nothing saying so. */}
        <ul className="divide-y divide-border sm:hidden">
          {sorted.map((component) => {
            const share = component.replacementCostCents
              ? component.fundedCents / component.replacementCostCents
              : 0;
            return (
              <li key={component.id} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-body font-medium text-fg">{component.name}</p>
                  <p className="tnum shrink-0 text-body font-semibold text-fg">
                    {shortMoney(component.replacementCostCents)}
                  </p>
                </div>
                <p className="mt-0.5 text-footnote text-fg-muted">
                  <span
                    className={
                      component.remainingLifeYears <= 2 ? "tnum font-semibold text-warn" : "tnum"
                    }
                  >
                    {year + component.remainingLifeYears}
                  </span>
                  {" · "}
                  <span className="tnum">{shortMoney(component.fundedCents)}</span> set aside,{" "}
                  <span className="tnum">{Math.round(share * 100)}%</span>
                </p>
                <Meter
                  value={share}
                  tone={share >= 0.8 ? "ok" : share >= 0.4 ? "brand" : "warn"}
                  className="mt-2"
                  aria-label={`${component.name} ${Math.round(share * 100)} percent funded`}
                />
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-border text-footnote font-semibold text-fg-muted">
                <th className="px-5 py-2.5 font-semibold">Component</th>
                <th className="px-3 py-2.5 text-right font-semibold">Replaced</th>
                <th className="px-3 py-2.5 text-right font-semibold">Cost</th>
                <th className="px-3 py-2.5 text-right font-semibold">Set aside</th>
                <th className="w-40 px-5 py-2.5 font-semibold">Funded</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((component) => {
                  const share = component.replacementCostCents
                    ? component.fundedCents / component.replacementCostCents
                    : 0;
                  return (
                    <tr
                      key={component.id}
                      className="border-b border-border text-body last:border-b-0"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-fg">{component.name}</p>
                        {component.note ? (
                          <p className="text-footnote text-fg-muted">{component.note}</p>
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
                        <span className="tnum mt-1 block text-footnote text-fg-subtle">
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

      <ReserveStudyCard />
    </>
  );
}
