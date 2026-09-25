"use client";

import { Term } from "@/components/app/term";
import { ResidentTitle } from "@/components/app/resident-title";
import Link from "next/link";
import { FundsGate } from "./guard";
import { ChevronRight, Landmark, PiggyBank, TrendingUp } from "lucide-react";
import { Badge, Card, Meter, SectionTitle } from "@/components/ui/primitives";

/** A list with nothing in it yet, and the one line that says why. */
function Waiting({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-4 text-body text-fg-muted">{children}</p>;
}
import { budgetSummary, cashPosition, interestSummary, reserveSummary } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import { SharedCostCard } from "@/components/app/shared-cost-card";
import { formatDate, money, shortMoney } from "@/lib/utils";

export default function ResidentFinances() {
  const { community, ledger } = useAppState();
  const bankAccounts = community.bankAccounts;
  const cash = cashPosition(community);
  const interest = interestSummary(community);
  const reserve = reserveSummary(community);
  const bud = budgetSummary(community);
  const recent = ledger.filter((e) => e.status !== "needs-review").slice(0, 12);
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
          <p className="mt-1.5 text-footnote text-fg-muted">Everyday bills</p>
        </Card>
        <Card className="p-4">
          <p className="text-footnote font-semibold text-fg-muted">
            <Term k="reserves">Reserves</Term>
          </p>
          <p className="tnum mt-1.5 text-title2 font-semibold leading-none text-fg">
            {money(cash.reserve, { cents: false })}
          </p>
          <p className="mt-1.5 text-footnote text-fg-muted">Savings for big repairs</p>
        </Card>
      </div>

      <SharedCostCard community={community} />

      {/* Interest. The rate and the full-year figure need the bank's APY,
          which only a bank feed knows; without one they read 0.00% and $0
          beside real interest payments, so only what the books show is shown. */}
      <section>
        <SectionTitle>What the reserves earn</SectionTitle>
        <Card className="p-4">
          <div className={interest.blendedApy > 0 ? "grid grid-cols-3 gap-3" : ""}>
            {interest.blendedApy > 0 ? (
              <div>
                <p className="text-footnote text-fg-subtle">Interest rate</p>
                <p className="tnum mt-1 text-headline font-semibold leading-none text-fg">
                  {interest.blendedApy.toFixed(2)}%
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-footnote text-fg-subtle">Interest this year</p>
              <p className="tnum mt-1 text-headline font-semibold leading-none text-ok">
                {money(interest.earnedYtd, { cents: false })}
              </p>
            </div>
            {interest.blendedApy > 0 ? (
              <div>
                <p className="text-footnote text-fg-subtle">Expected this year</p>
                <p className="tnum mt-1 text-headline font-semibold leading-none text-fg">
                  {money(interest.projectedAnnual, { cents: false })}
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      {/* Accounts */}
      <section>
        <SectionTitle>Accounts</SectionTitle>
        <Card>
          {bankAccounts.length === 0 ? (
            <Waiting>No bank account connected yet. The board adds one in Finances.</Waiting>
          ) : null}
          {bankAccounts.map((a, i) => (
            <div
              key={a.id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                {a.kind === "operating" ? (
                  <Landmark className="size-4" />
                ) : (
                  <PiggyBank className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-fg">{a.name}</p>
                <p className="truncate text-footnote text-fg-muted">
                  {a.institution}
                  {a.apy > 0 ? ` · ${a.apy.toFixed(2)}% interest` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tnum text-body font-semibold text-fg">
                  {money(a.balanceCents, { cents: false })}
                </p>
                {a.interestYtdCents > 0 ? (
                  <p className="tnum text-footnote text-ok">
                    {money(a.interestYtdCents, { cents: false })} earned
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      </section>

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
            <span className="text-footnote text-fg-muted">{recent.length} most recent</span>
          }
        >
          Transactions
        </SectionTitle>
        <Card>
          {recent.length === 0 ? (
            <Waiting>Nothing has moved yet. The first dues and bills show up here.</Waiting>
          ) : null}
          {recent.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
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
        <span className="flex-1 text-body font-medium text-fg">Budget and reserve study</span>
        <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
      </Link>
    </div>
    </FundsGate>
  );
}
