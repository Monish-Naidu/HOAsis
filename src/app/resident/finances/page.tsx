import Link from "next/link";
import { ChevronRight, Landmark, PiggyBank, TrendingUp } from "lucide-react";
import { Badge, Card, Meter, SectionTitle } from "@/components/ui/primitives";
import {
  bankAccounts,
  budgetSummary,
  cashPosition,
  interestSummary,
  ledgerEntries,
  reserveSummary,
} from "@/lib/data";
import { formatDate, money, shortMoney } from "@/lib/utils";

export const metadata = { title: "Association funds" };

export default function ResidentFinances() {
  const cash = cashPosition();
  const interest = interestSummary();
  const reserve = reserveSummary();
  const bud = budgetSummary();
  const recent = ledgerEntries.filter((e) => e.status !== "needs-review").slice(0, 12);
  const urgent = reserve.urgent.slice(0, 4);

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">
          Association funds
        </h1>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            Operating
          </p>
          <p className="tnum mt-1.5 text-[22px] font-semibold leading-none text-fg">
            {money(cash.operating, { cents: false })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            Reserves
          </p>
          <p className="tnum mt-1.5 text-[22px] font-semibold leading-none text-fg">
            {money(cash.reserve, { cents: false })}
          </p>
        </Card>
      </div>

      {/* Interest */}
      <section>
        <SectionTitle>What the reserves earn</SectionTitle>
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-fg-subtle">Blended rate</p>
              <p className="tnum mt-1 text-[17px] font-semibold leading-none text-fg">
                {interest.blendedApy.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] text-fg-subtle">Interest YTD</p>
              <p className="tnum mt-1 text-[17px] font-semibold leading-none text-ok">
                {money(interest.earnedYtd, { cents: false })}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-fg-subtle">Full year</p>
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
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                {a.kind === "operating" ? (
                  <Landmark className="size-4" />
                ) : (
                  <PiggyBank className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{a.name}</p>
                <p className="truncate text-[11px] text-fg-muted">
                  {a.institution} · {a.apy.toFixed(2)}% APY
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tnum text-[13px] font-semibold text-fg">
                  {money(a.balanceCents, { cents: false })}
                </p>
                <p className="tnum text-[11px] text-ok">
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
                  <span className="truncate text-[13px] text-fg">{line.category}</span>
                  <span className="tnum shrink-0 text-[12px] text-fg-muted">
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
            <span className="tnum text-[12px] text-fg-muted">
              {Math.round(reserve.percentFunded * 100)}% funded
            </span>
          }
        >
          What reserves are saved for
        </SectionTitle>
        <Card>
          {urgent.map((c, i) => (
            <div key={c.id} className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[13px] font-medium text-fg">{c.name}</p>
                <p className="tnum shrink-0 text-[12px] text-fg-muted">
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
              <p className="tnum mt-1 text-[11px] text-fg-subtle">
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
            <span className="text-[12px] text-fg-muted">{recent.length} most recent</span>
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
                <p className="truncate text-[13px] font-medium text-fg">{e.description}</p>
                <p className="mt-0.5 truncate text-[11px] text-fg-muted">
                  {formatDate(e.date, "long")} · {e.category}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`tnum text-[13px] font-semibold ${
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
        <p className="mt-2 text-[11px] leading-snug text-fg-subtle">
          Items under board review are excluded until confirmed.
        </p>
      </section>

      <Link
        href="/resident/documents"
        className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2"
      >
        <TrendingUp className="size-4 shrink-0 text-fg-subtle" />
        <span className="flex-1 text-[13px] font-medium text-fg">Budget and reserve study</span>
        <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
      </Link>
    </div>
  );
}
