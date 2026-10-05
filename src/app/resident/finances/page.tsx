"use client";

import { Term } from "@/components/app/term";
import { ResidentTitle } from "@/components/app/resident-title";
import Link from "next/link";
import { FundsGate } from "./guard";
import { ChevronRight, TrendingUp } from "lucide-react";
import { Badge, Card, Meter, SectionTitle, Segmented } from "@/components/ui/primitives";
import { useState } from "react";

/** A list with nothing in it yet, and the one line that says why. */
function Waiting({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-4 text-body text-fg-muted">{children}</p>;
}
import {
  PERIOD_LABEL,
  type PeriodPreset,
  budgetSummary,
  cashPosition,
  filterLedger,
  interestSummary,
  ledgerTotals,
  periodRange,
  reserveSummary,
} from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import { SharedCostCard } from "@/components/app/shared-cost-card";
import { formatDate, money, shortMoney, todayIsoDate } from "@/lib/utils";
import { moduleOn } from "@/lib/modules";
import { bankLine } from "@/lib/funds-wording";

export default function ResidentFinances() {
  const { community, ledger } = useAppState();
  const cash = cashPosition(community);
  const interest = interestSummary(community);
  // The reserve accounts' own interest, not the operating account's.
  const reserveInterestCents = interest.reserveAccounts.reduce((t, a) => t + a.interestYtdCents, 0);
  const operatingBank = bankLine(community.bankAccounts, "operating");
  const reserveBank = bankLine(community.bankAccounts, "reserve");
  const reserve = reserveSummary(community);
  const bud = budgetSummary(community);
  // The period an owner can look through. Twelve most recent lines told
  // nobody what last winter cost.
  const [period, setPeriod] = useState<PeriodPreset>("this-month");
  const [showAll, setShowAll] = useState(false);
  const range = periodRange(period, todayIsoDate());
  const inPeriod = filterLedger(ledger, { from: range.from, to: range.to }).filter(
    (e) => e.status !== "needs-review",
  );
  const totals = ledgerTotals(inPeriod);
  const recent = showAll ? inPeriod : inPeriod.slice(0, 12);
  const urgent = reserve.urgent.slice(0, 4);

  return (
    <FundsGate>
    <div className="animate-rise space-y-6">
      <ResidentTitle title="Association funds" subtitle="Where the association's money is" />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-footnote font-semibold text-fg-muted">
            Operating
          </p>
          <p className="tnum mt-1.5 text-title2 font-semibold leading-none text-fg">
            {money(cash.operating, { cents: false })}
          </p>
          <p className="mt-1.5 truncate text-footnote text-fg-muted">
            {operatingBank ? `${operatingBank} · everyday bills` : "Everyday bills"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-footnote font-semibold text-fg-muted">
            <Term k="reserves">Reserves</Term>
          </p>
          <p className="tnum mt-1.5 text-title2 font-semibold leading-none text-fg">
            {money(cash.reserve, { cents: false })}
          </p>
          <p className="mt-1.5 truncate text-footnote text-fg-muted">
            {reserveBank ? `${reserveBank} · big repairs` : "Savings for big repairs"}
          </p>
        </Card>
      </div>

      {/* Utility shares only where the association has switched shared costs
          on; the special assessment stays either way. */}
      <SharedCostCard
        community={moduleOn("shared-costs") ? community : { ...community, sharedCosts: [] }}
      />

      {/* Where dues go */}
      <section>
        <SectionTitle>Where your dues go</SectionTitle>
        <Card className={bud.expense.length ? "p-4" : ""}>
          {bud.expense.length === 0 ? (
            <Waiting>No budget yet. The board sets one before the year starts.</Waiting>
          ) : null}
          <div className="space-y-3">
            {bud.expense.map((line) => (
              <div key={line.category}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="truncate text-body text-fg">{line.category}</span>
                  <span className="tnum shrink-0 text-footnote text-fg-muted">
                    {shortMoney(line.ytdActualCents)}
                    <span className="text-fg-subtle"> / {shortMoney(line.annualCents)}</span>
                  </span>
                </div>
                <Meter
                  value={line.ytdActualCents / line.annualCents}
                  aria-label={`${line.category} spending`}
                />
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Reserve components */}
      <section>
        <SectionTitle
          action={
            <span className="tnum text-footnote text-fg-muted">
              {reserve.hasStudy ? (
                <>
                  {Math.round(reserve.percentFunded * 100)}% <Term k="funded">funded</Term>
                </>
              ) : (
                "No reserve study yet"
              )}
            </span>
          }
        >
          What reserves are saved for
        </SectionTitle>
        <Card>
          {/* One line, and only when there is interest to report. The rate
              and a full-year figure need the bank's APY, which only a bank
              feed knows, so only what the books show is shown. */}
          {reserveInterestCents > 0 ? (
            <p className="tnum border-b border-border px-4 py-3 text-footnote text-fg-muted">
              <span className="font-semibold text-ok">{money(reserveInterestCents, { cents: false })}</span>{" "}
              interest this year
            </p>
          ) : null}
          {urgent.length === 0 ? (
            <Waiting>
              {reserve.hasStudy
                ? "Nothing is due for replacement soon."
                : "The roof, paving, and the like appear here once the board has a reserve study."}
            </Waiting>
          ) : null}
          {urgent.map((c, i) => (
            <div key={c.id} className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-body font-medium text-fg">{c.name}</p>
                <p className="tnum shrink-0 text-footnote text-fg-muted">
                  {c.remainingLifeYears === 1 ? "1 year left" : `${c.remainingLifeYears} years left`}
                </p>
              </div>
              <div className="mt-1.5">
                <Meter
                  value={c.fundedCents / c.replacementCostCents}
                  tone={c.remainingLifeYears <= 2 ? "warn" : "brand"}
                  aria-label={`${c.name} funding`}
                />
              </div>
              <p className="tnum mt-1 text-footnote text-fg-subtle">
                {shortMoney(c.fundedCents)} of {shortMoney(c.replacementCostCents)}
              </p>
            </div>
          ))}
        </Card>
      </section>

      {/* Transactions */}
      <section>
        <SectionTitle
          action={
            <span className="tnum text-footnote text-fg-muted">
              {inPeriod.length} {inPeriod.length === 1 ? "transaction" : "transactions"}
            </span>
          }
        >
          Transactions
        </SectionTitle>
        <Segmented
          label="Period"
          value={period}
          onChange={(next) => {
            setPeriod(next);
            setShowAll(false);
          }}
          className="mb-3"
          options={(["this-month", "last-month", "this-year", "last-12-months"] as PeriodPreset[]).map(
            // "12 months" so all four fit a phone without the last one clipping.
            (v) => ({ value: v, label: v === "last-12-months" ? "12 months" : PERIOD_LABEL[v] }),
          )}
        />
        <Card>
          {ledger.length === 0 ? (
            <Waiting>Nothing has moved yet. The first dues and bills show up here.</Waiting>
          ) : inPeriod.length === 0 ? (
            <Waiting>Nothing moved in this period.</Waiting>
          ) : (
            <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-border px-4 py-3 text-footnote text-fg-muted">
              <span>
                In <span className="tnum font-semibold text-ok">{money(totals.inCents, { cents: false })}</span>
              </span>
              <span>
                Out <span className="tnum font-semibold text-fg">{money(totals.outCents, { cents: false })}</span>
              </span>
              <span>
                Net{" "}
                <span className={`tnum font-semibold ${totals.netCents >= 0 ? "text-fg" : "text-danger"}`}>
                  {money(totals.netCents, { sign: totals.netCents > 0, cents: false })}
                </span>
              </span>
            </p>
          )}
          {recent.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-start gap-3 border-t border-border px-4 py-3 ${i === 0 ? "border-t-0" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-fg">{e.description}</p>
                <p className="mt-0.5 truncate text-footnote text-fg-muted">
                  {formatDate(e.date, "long")} · {e.category}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`tnum text-body font-semibold ${
                    e.amountCents >= 0 ? "text-ok" : "text-fg"
                  }`}
                >
                  {money(e.amountCents, { sign: e.amountCents > 0 })}
                </p>
                {e.status === "pending" ? (
                  <Badge tone="neutral" className="mt-0.5">
                    pending
                  </Badge>
                ) : null}
              </div>
            </div>
          ))}
          {inPeriod.length > recent.length ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full border-t border-border px-4 py-3 text-center text-footnote font-medium text-primary transition-colors hover:bg-surface-2"
            >
              Show all {inPeriod.length}
            </button>
          ) : null}
        </Card>
        <p className="mt-2 text-footnote leading-snug text-fg-subtle">
          Items the board is still checking are not shown yet.
        </p>
      </section>

      <Link
        href="/resident/documents"
        className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2"
      >
        <TrendingUp className="size-4 shrink-0 text-fg-subtle" />
        <span className="flex-1 text-body font-medium text-fg">Budget and other financial documents</span>
        <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
      </Link>
    </div>
    </FundsGate>
  );
}
