"use client";

import { useState } from "react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { NetTrendChart, YearCompareChart } from "@/components/app/board-charts";
import { DeltaChip, InlineBar, Segmented, SelectField, StatTile } from "@/components/app/finance-ui";
import { useAppState } from "@/lib/app-state";
import { compareYears, ledgerYears, monthName, netByYear } from "@/lib/metrics";
import { money, todayIsoDate } from "@/lib/utils";

type Measure = "income" | "spend";

/**
 * Year over year.
 *
 * Two pickers, three figures with how they moved, the months as grouped
 * bars, every category with its change, and the run of years underneath.
 * Partial years are cut to the same month on both sides so August is never
 * compared with December.
 */
export function TrendsScreen() {
  const { community } = useAppState();
  const years = ledgerYears(community);
  const thisYear = Number(todayIsoDate().slice(0, 4));
  const newest = years[0] ?? thisYear;
  const [b, setB] = useState(years.includes(thisYear) ? thisYear : newest);
  const [a, setA] = useState(years.find((y) => y < b) ?? b);
  const [measure, setMeasure] = useState<Measure>("income");

  const options = years.map((y) => ({ value: String(y), label: y === thisYear ? `${y}, this year` : String(y) }));
  const trend = netByYear(community);

  if (years.length < 2) {
    return (
      <>
        <PageHeader title="Trends" description="Year over year." />
        <Card className="p-6">
          <p className="text-headline font-semibold tracking-[-0.015em] text-fg">One year of history so far</p>
          <p className="mt-1.5 max-w-[60ch] text-body leading-relaxed text-fg-muted">
            Comparisons start once the books cover a second calendar year. Until then the Overview
            shows this year month by month.
          </p>
        </Card>
      </>
    );
  }

  const cmp = compareYears(community, a, b);
  const months = cmp.months.map((m) => ({
    label: m.label,
    a: measure === "income" ? m.aIn : m.aOut,
    b: measure === "income" ? m.bIn : m.bOut,
  }));
  const span = cmp.partial ? `January to ${monthName(cmp.throughMonth, "long")}` : "Full year";
  const yearLabel = (y: number) => (cmp.partial ? `${y} to ${monthName(cmp.throughMonth)}` : String(y));

  return (
    <>
      <PageHeader
        title="Trends"
        description={`${span} of each year. Reserve funding is shown separately.`}
        action={
          <div className="flex items-center gap-2 text-footnote text-fg-muted">
            <SelectField label="Earlier year" value={String(a)} onChange={(v) => setA(Number(v))} options={options} />
            <span>against</span>
            <SelectField label="Later year" value={String(b)} onChange={(v) => setB(Number(v))} options={options} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Money in"
          value={money(cmp.b.incomeCents, { cents: false })}
          delta={cmp.income}
          goodWhen="up"
          hint={`${money(cmp.a.incomeCents, { cents: false })} in ${yearLabel(a)}`}
        />
        <StatTile
          label="Money out"
          value={money(cmp.b.spendCents, { cents: false })}
          delta={cmp.spend}
          goodWhen="down"
          hint={`${money(cmp.a.spendCents, { cents: false })} in ${yearLabel(a)}`}
        />
        <StatTile
          label="Net"
          value={money(cmp.b.netCents, { sign: cmp.b.netCents > 0, cents: false })}
          delta={cmp.net}
          goodWhen="up"
          hint={`${money(cmp.a.netCents, { sign: cmp.a.netCents > 0, cents: false })} in ${yearLabel(a)}`}
        />
      </div>
      <p className="tnum mt-3 flex flex-wrap items-center gap-x-2 text-footnote text-fg-muted">
        <span>
          Reserve funding {money(cmp.b.reserveCents, { cents: false })} in {b}, {money(cmp.a.reserveCents, { cents: false })} in {a}
        </span>
        <DeltaChip delta={cmp.reserve} goodWhen="neither" />
      </p>

      <Card className="mt-5">
        <CardHeader
          title="Month by month"
          action={
            <Segmented<Measure>
              ariaLabel="Measure"
              value={measure}
              onChange={setMeasure}
              options={[
                { value: "income", label: "Money in" },
                { value: "spend", label: "Money out" },
              ]}
            />
          }
        />
        <YearCompareChart
          months={months}
          aLabel={String(a)}
          bLabel={String(b)}
          caption={`${measure === "income" ? "Money in" : "Money out"} by month, ${a} and ${b}`}
        />
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="By category" subtitle={`${span}, where the money went`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-border text-footnote font-semibold text-fg-muted">
                  <th className="px-5 py-2.5 font-semibold">Category</th>
                  <th className="tnum px-3 py-2.5 text-right font-semibold">{a}</th>
                  <th className="tnum px-3 py-2.5 text-right font-semibold">{b}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Change</th>
                  <th className="w-36 px-5 py-2.5 font-semibold">
                    <span className="sr-only">Scale</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cmp.categories.map((row) => (
                  <tr key={row.category} className="border-b border-border text-body last:border-b-0 hover:bg-surface-2">
                    <td className="px-5 py-2.5 font-medium text-fg">{row.category}</td>
                    <td className="tnum px-3 py-2.5 text-right text-fg-muted">{money(row.aCents, { cents: false })}</td>
                    <td className="tnum px-3 py-2.5 text-right font-semibold text-fg">{money(row.bCents, { cents: false })}</td>
                    <td className="px-3 py-2.5 text-right">
                      <DeltaChip
                        delta={row.change}
                        goodWhen={row.category === "Reserve contributions" ? "neither" : "down"}
                      />
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="flex flex-col gap-1">
                        <InlineBar value={row.aCents} max={cmp.peakCategoryCents} colorClass="bg-chart-other" />
                        <InlineBar value={row.bCents} max={cmp.peakCategoryCents} colorClass="bg-chart-1" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Net by year" subtitle="Before reserve funding" />
          <NetTrendChart years={trend} />
        </Card>
      </div>
    </>
  );
}
