"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import Link from "next/link";
import { FundsGate } from "./guard";
import { ChevronRight, Landmark, PiggyBank, TrendingUp } from "lucide-react";
import { Badge, Card, IconTile, Meter, SectionTitle, Stat } from "@/components/ui/primitives";
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
      <ResidentTitle title="Association funds" />

      {/* Totals */}
      <div className="grid grid-cols-1 gap-3 @xs:grid-cols-2">
        <Stat
          label="Operating"
          value={money(cash.operating, { cents: false })}
          icon={<Landmark className="size-4" />}
          accent="teal"
          hint="Day to day bills"
        />
        <Stat
          label="Reserves"
          value={money(cash.reserve, { cents: false })}
          icon={<PiggyBank className="size-4" />}
          accent="violet"
          hint="Saved for big repairs"
        />
      </div>

      <SharedCostCard community={community} />

      {/* Interest */}
      <section>
        <SectionTitle>What the reserves earn</SectionTitle>
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[13px] text-fg-muted">Blended rate</p>
              <p className="tnum mt-1 text-[17px] font-semibold leading-none text-fg">
                {interest.blendedApy.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[13px] text-fg-muted">This year</p>
              <p className="tnum mt-1 text-[17px] font-semibold leading-none text-ok">
                {money(interest.earnedYtd, { cents: false })}
              </p>
            </div>
            <div>
              <p className="text-[13px] text-fg-muted">Full year</p>
              <p className="tnum mt-1 text-[17px] font-semibold leading-none text-fg">
                {money(interest.projectedAnnual, { cents: false })}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Accounts */}
      <section>
        <SectionTitle>Accounts</SectionTitle>
        <Card>
          {bankAccounts.map((a, i) => (
            <div
              key={a.id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <IconTile
                icon={a.kind === "operating" ? Landmark : PiggyBank}
                tint={a.kind === "operating" ? "teal" : "violet"}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-fg">{a.name}</p>
                <p className="truncate text-[13px] text-fg-muted">
                  {a.institution} · {a.apy.toFixed(2)}% APY
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tnum text-[15px] font-semibold text-fg">
                  {money(a.balanceCents, { cents: false })}
                </p>
                <p className="tnum text-[13px] text-ok">
                  {money(a.interestYtdCents, { cents: false })} earned
                </p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* Where dues go */}
      <section>
        <SectionTitle>Where your dues go</SectionTitle>
        <Card className="p-4">
          <div className="space-y-3">
            {bud.expense.map((line) => (
              <div key={line.category}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] text-fg">{line.category}</span>
                  <span className="tnum shrink-0 text-[13px] text-fg-muted">
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
            <span className="tnum text-[13px] text-fg-muted">
              {reserve.hasStudy ? `${Math.round(reserve.percentFunded * 100)}% funded` : "No study"}
            </span>
          }
        >
          What reserves are saved for
        </SectionTitle>
        <Card>
          {urgent.map((c, i) => (
            <div key={c.id} className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[15px] font-medium text-fg">{c.name}</p>
                <p className="tnum shrink-0 text-[13px] text-fg-muted">
                  {c.remainingLifeYears} yr left
                </p>
              </div>
              <div className="mt-1.5">
                <Meter
                  value={c.fundedCents / c.replacementCostCents}
                  tone={c.remainingLifeYears <= 2 ? "warn" : "brand"}
                  aria-label={`${c.name} funding`}
                />
              </div>
              <p className="tnum mt-1 text-[13px] text-fg-subtle">
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
            <span className="text-[13px] text-fg-muted">{recent.length} most recent</span>
          }
        >
          Transactions
        </SectionTitle>
        <Card>
          {recent.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] font-medium leading-snug text-fg">{e.description}</p>
                <p className="mt-0.5 truncate text-[13px] text-fg-muted">
                  {formatDate(e.date, "long")} · {e.category}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`tnum text-[15px] font-semibold ${
                    e.amountCents >= 0 ? "text-ok" : "text-fg"
                  }`}
                >
                  {money(e.amountCents, { sign: e.amountCents > 0 })}
                </p>
                {e.status === "pending" ? (
                  <Badge tone="neutral" className="mt-0.5">
                    Pending
                  </Badge>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-[13px] leading-snug text-fg-subtle">
          Items under board review are excluded until confirmed.
        </p>
      </section>

      <Link
        href="/resident/documents"
        className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2"
      >
        <IconTile icon={TrendingUp} tint="violet" size="sm" />
        <span className="flex-1 text-[15px] font-medium text-fg">Budget and reserve study</span>
        <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
      </Link>
    </div>
    </FundsGate>
  );
}
