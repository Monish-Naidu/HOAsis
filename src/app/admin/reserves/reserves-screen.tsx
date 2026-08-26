"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, PiggyBank, TrendingUp } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Meter,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { communitySlug, interestSummary } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import {
  defaultAssumptions,
  fundingBand,
  percentFunded,
  projectReserves,
  requiredMonthlyContribution,
} from "@/lib/reserves";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { useToast } from "@/components/app/toast";
import { money, shortMoney, today } from "@/lib/utils";
import { ProjectionChart } from "./projection-chart";

const START_YEAR = today().getUTCFullYear();

export function ReservesScreen() {
  const { notify } = useToast();
  const { community } = useAppState();
  const reserveComponents = community.reserveComponents;
  const interest = interestSummary(community);

  // Seeded from what this association currently transfers, not a constant. A
  // five home community being shown Mehr Meadows' $6,120 default is nonsense.
  const seededContribution = useMemo(() => {
    const transfer = community.budget.find((b) => b.category === "Reserve transfer");
    if (transfer) return Math.round(transfer.annualCents / 12) / 100;
    const income = community.budget
      .filter((b) => b.kind === "income")
      .reduce((t, b) => t + b.annualCents, 0);
    const expense = community.budget
      .filter((b) => b.kind === "expense")
      .reduce((t, b) => t + b.annualCents, 0);
    return Math.max(0, Math.round((income - expense) / 12) / 100);
  }, [community]);
  const [monthlyContribution, setMonthlyContribution] = useState(seededContribution);
  const [apy, setApy] = useState(interest.blendedApy);
  const [inflation, setInflation] = useState(3);
  const [growth, setGrowth] = useState(3);

  const assumptions = useMemo(
    () =>
      defaultAssumptions({
        openingBalanceCents: interest.balance,
        monthlyContributionCents: Math.round(monthlyContribution * 100),
        apyPercent: apy,
        inflationPercent: inflation,
        contributionGrowthPercent: growth,
        years: 30,
      }),
    [interest.balance, monthlyContribution, apy, inflation, growth],
  );

  const projection = useMemo(
    () => projectReserves(reserveComponents, assumptions, START_YEAR),
    [reserveComponents, assumptions],
  );

  const required = useMemo(
    () => requiredMonthlyContribution(reserveComponents, assumptions, START_YEAR),
    [reserveComponents, assumptions],
  );

  const funding = percentFunded(reserveComponents, interest.balance);
  const band = fundingBand(funding.percent);
  const shortfall = projection.firstShortfallYear;

  if (!funding.measurable) {
    return (
      <>
        <PageHeader eyebrow="Reserves" title="Funding plan" />
        <Callout
          tone="warn"
          icon={<AlertTriangle className="size-4" />}
          title="No reserve study, so none of this can be measured"
        >
          Percent funded compares what you have saved against what you should have saved by now.
          Without a study there is no second number, so the honest answer is that nobody knows.
        </Callout>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Reserve cash"
            value={money(interest.balance, { cents: false })}
            tone={interest.balance === 0 ? "warn" : "neutral"}
            hint={
              interest.balance === 0
                ? "Nothing set aside for a shared repair"
                : `Across ${interest.reserveAccounts.length} accounts`
            }
            icon={<PiggyBank className="size-4" />}
          />
          <Stat
            label="Set aside each month"
            value={money(Math.round(seededContribution * 100), { cents: false })}
            tone={seededContribution === 0 ? "warn" : "neutral"}
            hint="From the adopted budget"
          />
          <Stat
            label="Components tracked"
            value="0"
            tone="warn"
            hint="Roofs, paving, fencing, shared drainage"
          />
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
                title: "Open a separate reserve account",
                body: "Reserve money in the operating account gets spent. Separating it is free and takes an afternoon.",
              },
              {
                title: "Start transferring something, even if it is small",
                body: "A number picked from a study beats a number picked from a surplus, but any transfer beats none.",
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
          <p className="border-t border-border px-5 py-3 text-[13px] leading-relaxed text-fg-subtle">
            The projection below returns as soon as there is a component schedule to project.
          </p>
        </Card>
      </>
    );
  }

  function exportProjection() {
    const csv = toCsv(projection.years, [
      { header: "Year", value: (y) => y.year },
      { header: "Opening", value: (y) => (y.openingCents / 100).toFixed(2) },
      { header: "Contributions", value: (y) => (y.contributionsCents / 100).toFixed(2) },
      { header: "Interest", value: (y) => (y.interestCents / 100).toFixed(2) },
      { header: "Expenditures", value: (y) => (y.expenditureCents / 100).toFixed(2) },
      { header: "Replaced", value: (y) => y.expenditures.map((e) => e.name).join("; ") },
      { header: "Closing", value: (y) => (y.closingCents / 100).toFixed(2) },
    ]);
    downloadCsv(`${communitySlug(community)}-reserve-projection.csv`, csv);
    notify("Exported the 30 year projection");
  }

  return (
    <>
      <PageHeader
        eyebrow="Reserves"
        title="Funding plan"
        action={
          <Button variant="secondary" size="md" onClick={exportProjection}>
            <Download className="size-3.5" />
            Export projection
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Reserve cash"
          value={money(interest.balance, { cents: false })}
          hint={`Across ${interest.reserveAccounts.length} accounts`}
          icon={<PiggyBank className="size-4" />}
        />
        <Stat
          label="Percent funded"
          value={`${Math.round(funding.percent * 100)}%`}
          tone={band.tone}
          hint={`${band.label} · against ${money(funding.accruedLiabilityCents, { cents: false })} accrued`}
        />
        <Stat
          label="Interest earned YTD"
          value={money(interest.earnedYtd, { cents: false })}
          tone="ok"
          hint={`${interest.blendedApy.toFixed(2)}% blended`}
          icon={<TrendingUp className="size-4" />}
        />
        <Stat
          label="First shortfall"
          value={shortfall ? String(shortfall) : "None"}
          tone={shortfall ? "danger" : "ok"}
          hint={
            shortfall
              ? `${shortfall - START_YEAR} years away`
              : "Solvent for the whole 30 year plan"
          }
        />
      </div>

      {shortfall ? (
        <Callout
          tone="danger"
          className="mt-5"
          icon={<AlertTriangle className="size-4" />}
          title={`Reserves run dry in ${shortfall}`}
        >
          At {money(assumptions.monthlyContributionCents)} a month the balance goes negative in{" "}
          {shortfall}, which means a special assessment unless something changes. Raising the
          monthly transfer to{" "}
          <button
            type="button"
            onClick={() => setMonthlyContribution(required / 100)}
            className="font-semibold underline underline-offset-2"
          >
            {money(required)}
          </button>{" "}
          keeps the plan solvent for all 30 years. That is{" "}
          {money(Math.round((required - assumptions.monthlyContributionCents) / 88))} per home per
          month.
        </Callout>
      ) : (
        <Callout
          tone="ok"
          className="mt-5"
          icon={<CheckCircle2 className="size-4" />}
          title="The plan holds for 30 years"
        >
          At {money(assumptions.monthlyContributionCents)} a month the balance never goes negative.
          The low point is {money(projection.lowestBalanceCents, { cents: false })} in{" "}
          {projection.lowestBalanceYear}.
        </Callout>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Assumptions */}
        <Card>
          <CardHeader
            title="Assumptions"
            subtitle="Change one and the projection re-runs"
          />
          <div className="space-y-4 px-5 py-4">
            <Slider
              label="Monthly transfer to reserves"
              value={monthlyContribution}
              min={0}
              max={20000}
              step={100}
              onChange={setMonthlyContribution}
              format={(v) => money(Math.round(v * 100), { cents: false })}
            />
            <Slider
              label="Blended yield"
              value={apy}
              min={0}
              max={6}
              step={0.05}
              onChange={setApy}
              format={(v) => `${v.toFixed(2)}%`}
            />
            <Slider
              label="Construction inflation"
              value={inflation}
              min={0}
              max={8}
              step={0.5}
              onChange={setInflation}
              format={(v) => `${v.toFixed(1)}%`}
            />
            <Slider
              label="Annual contribution increase"
              value={growth}
              min={0}
              max={10}
              step={0.5}
              onChange={setGrowth}
              format={(v) => `${v.toFixed(1)}%`}
            />
            <p className="border-t border-border pt-3 text-[13px] leading-relaxed text-fg-subtle">
              Moving reserves to a higher yield is the one lever that costs owners nothing. Every
              other lever raises somebody&apos;s assessment.
            </p>
          </div>
        </Card>

        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Balance over 30 years"
            subtitle="Each drop is a component being replaced"
          />
          <div className="px-5 py-4">
            <ProjectionChart projection={projection} />
          </div>
        </Card>
      </div>

      {/* Accounts */}
      <Card className="mt-5">
        <CardHeader title="Where the reserve cash sits" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                <th className="px-5 py-2.5 font-semibold">Account</th>
                <th className="px-3 py-2.5 text-right font-semibold">Balance</th>
                <th className="px-3 py-2.5 text-right font-semibold">Yield</th>
                <th className="px-3 py-2.5 text-right font-semibold">Interest YTD</th>
                <th className="px-5 py-2.5 text-right font-semibold">Insured</th>
              </tr>
            </thead>
            <tbody>
              {interest.reserveAccounts.map((account) => {
                const uninsured = Math.max(0, account.balanceCents - account.insuredLimitCents);
                return (
                  <tr key={account.id} className="border-b border-border text-[15px] last:border-b-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-fg">{account.name}</p>
                      <p className="text-[13px] text-fg-muted">
                        {account.institution} ••{account.mask}
                      </p>
                    </td>
                    <td className="tnum px-3 py-3 text-right font-semibold text-fg">
                      {money(account.balanceCents, { cents: false })}
                    </td>
                    <td className="tnum px-3 py-3 text-right text-fg-muted">
                      {account.apy.toFixed(2)}%
                    </td>
                    <td className="tnum px-3 py-3 text-right text-ok">
                      {money(account.interestYtdCents, { cents: false })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {uninsured > 0 ? (
                        <Badge tone="warn">{shortMoney(uninsured)} over</Badge>
                      ) : (
                        <Badge tone="ok">Covered</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Component schedule */}
      <Card className="mt-5">
        <CardHeader
          title="What the money is for"
          subtitle="Replacement year and the inflated cost when it lands"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                <th className="px-5 py-2.5 font-semibold">Component</th>
                <th className="px-3 py-2.5 text-right font-semibold">Replaced</th>
                <th className="px-3 py-2.5 text-right font-semibold">Cost today</th>
                <th className="px-3 py-2.5 text-right font-semibold">Cost then</th>
                <th className="w-40 px-5 py-2.5 font-semibold">Funded</th>
              </tr>
            </thead>
            <tbody>
              {[...reserveComponents]
                .sort((a, b) => a.remainingLifeYears - b.remainingLifeYears)
                .map((component) => {
                  const year = START_YEAR + component.remainingLifeYears;
                  const inflated = Math.round(
                    component.replacementCostCents *
                      Math.pow(1 + inflation / 100, component.remainingLifeYears),
                  );
                  const share = component.fundedCents / component.replacementCostCents;
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
                          {year}
                        </span>
                      </td>
                      <td className="tnum px-3 py-3 text-right text-fg-muted">
                        {shortMoney(component.replacementCostCents)}
                      </td>
                      <td className="tnum px-3 py-3 text-right font-medium text-fg">
                        {shortMoney(inflated)}
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

      {/* Year by year */}
      <Card className="mt-5">
        <CardHeader
          title="Year by year"
          subtitle="What you start with, plus savings and interest, less what you replace"
        />
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                <th className="px-5 py-2.5 font-semibold">Year</th>
                <th className="px-3 py-2.5 text-right font-semibold">Opening</th>
                <th className="px-3 py-2.5 text-right font-semibold">In</th>
                <th className="px-3 py-2.5 text-right font-semibold">Interest</th>
                <th className="px-3 py-2.5 text-right font-semibold">Out</th>
                <th className="px-5 py-2.5 text-right font-semibold">Closing</th>
              </tr>
            </thead>
            <tbody>
              {projection.years.map((year) => (
                <tr
                  key={year.year}
                  className={`border-b border-border text-[15px] last:border-b-0 ${
                    year.isShortfall ? "bg-danger-soft/40" : ""
                  }`}
                >
                  <td className="tnum px-5 py-2 font-medium text-fg">
                    {year.year}
                    {year.expenditures.length ? (
                      <span className="ml-2 text-[13px] text-fg-muted">
                        {year.expenditures.map((e) => e.name).join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-fg-muted">
                    {shortMoney(year.openingCents)}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-fg-muted">
                    {shortMoney(year.contributionsCents)}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-ok">
                    {shortMoney(year.interestCents)}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-fg-muted">
                    {year.expenditureCents ? shortMoney(-year.expenditureCents) : "—"}
                  </td>
                  <td
                    className={`tnum px-5 py-2 text-right font-semibold ${
                      year.isShortfall ? "text-danger" : "text-fg"
                    }`}
                  >
                    {shortMoney(year.closingCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  format: (value: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between">
        <span className="text-[13px] text-fg-muted">{label}</span>
        <span className="tnum text-[15px] font-semibold text-fg">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full accent-navy-700 dark:accent-navy-200"
      />
    </label>
  );
}
