import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookmarkPlus,
  Copy,
  Download,
  Filter,
  Landmark,
  PiggyBank,
  ShieldAlert,
  Star,
} from "lucide-react";
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
import {
  bankAccounts,
  budgetSummary,
  cashPosition,
  insuranceExposure,
  interestSummary,
  ledgerEntries,
  reconciliation,
  reserveComponents,
  reserveSummary,
  yieldOpportunity,
} from "@/lib/data";
import { formatDate, money, shortMoney } from "@/lib/utils";

export const metadata = { title: "Money" };

const savedViews = [
  { name: "Everything, this month", starred: true },
  { name: "Needs review", starred: false },
  { name: "Reserve activity only", starred: false },
  { name: "Vendor payments > $1k", starred: false },
];

export default function BoardMoney() {
  const cash = cashPosition();
  const recon = reconciliation();
  const reserve = reserveSummary();
  const bud = budgetSummary();
  const interest = interestSummary();
  const exposure = insuranceExposure();
  const opportunity = yieldOpportunity();

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Money"
        
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="md">
              <Download className="size-3.5" />
              Export
            </Button>
            <Button variant="primary" size="md">
              Reconcile
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total cash"
          value={money(cash.total, { cents: false })}
          hint="Across 3 accounts"
          icon={<Landmark className="size-4" />}
        />
        <Stat
          label="Income YTD"
          value={money(bud.incomeYtd, { cents: false })}
          tone="ok"
          hint={`${Math.round((bud.incomeYtd / bud.incomeAnnual) * 100)}% of budget · ${Math.round(bud.yearElapsed * 100)}% of year`}
          icon={<ArrowUpRight className="size-4" />}
        />
        <Stat
          label="Expenses YTD"
          value={money(bud.expenseYtd, { cents: false })}
          hint={`${Math.round((bud.expenseYtd / bud.expenseAnnual) * 100)}% of budget`}
          icon={<ArrowDownRight className="size-4" />}
        />
        <Stat
          label="Needs review"
          value={String(recon.needsReview.length)}
          tone={recon.needsReview.length ? "warn" : "ok"}
          hint="Held out of reports until confirmed"
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      {/* Accounts */}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {bankAccounts.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-fg">{a.name}</p>
                <p className="truncate text-[11px] text-fg-muted">
                  {a.institution} ••{a.mask}
                </p>
              </div>
              <Badge tone={a.status === "live" ? "ok" : "warn"} dot>
                {a.status}
              </Badge>
            </div>
            <p className="tnum mt-3 text-[22px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {money(a.balanceCents)}
            </p>
            <dl className="mt-3 space-y-1 border-t border-border pt-2.5">
              <div className="flex justify-between text-[11px]">
                <dt className="text-fg-muted">Reconciled through</dt>
                <dd className="tnum font-medium text-fg">
                  {formatDate(a.reconciledThroughDate, "long")}
                </dd>
              </div>
              <div className="flex justify-between text-[11px]">
                <dt className="text-fg-muted">Unreconciled</dt>
                <dd
                  className={`tnum font-medium ${a.unreconciledCount ? "text-warn" : "text-ok"}`}
                >
                  {a.unreconciledCount}
                </dd>
              </div>
              <div className="flex justify-between text-[11px]">
                <dt className="text-fg-muted">Yield</dt>
                <dd className="tnum font-medium text-fg">
                  {a.apy.toFixed(2)}% APY
                  {a.maturityDate ? `, matures ${formatDate(a.maturityDate)}` : ""}
                </dd>
              </div>
              <div className="flex justify-between text-[11px]">
                <dt className="text-fg-muted">Interest YTD</dt>
                <dd className="tnum font-medium text-ok">{money(a.interestYtdCents)}</dd>
              </div>
              <div className="flex justify-between text-[11px]">
                <dt className="text-fg-muted">Feed</dt>
                <dd className="font-medium text-fg">
                  {a.status === "live"
                    ? `${a.syncedMinutesAgo} min ago`
                    : `${Math.round(a.syncedMinutesAgo / 60)}h ago`}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      {/* Ledger */}
      <Card className="mt-5">
        <CardHeader
          title="General ledger"
          subtitle={`${ledgerEntries.length} transactions · August 2026`}
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <Filter className="size-3.5" />
                Filters
              </Button>
              <Button variant="secondary" size="sm">
                <BookmarkPlus className="size-3.5" />
                Save view
              </Button>
            </div>
          }
        />

        {/* Saved views. Filters survive a reload. */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border px-5 py-2.5">
          {savedViews.map((v, i) => (
            <button
              key={v.name}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                i === 0
                  ? "border-navy-700 bg-brand-soft text-brand-soft-fg dark:border-navy-300"
                  : "border-border text-fg-muted hover:bg-surface-2"
              }`}
            >
              {v.starred ? <Star className="size-3 fill-current" /> : null}
              {v.name}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                <th className="px-5 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Description</th>
                <th className="px-3 py-2.5 font-semibold">Category</th>
                <th className="px-3 py-2.5 font-semibold">Account</th>
                <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((e) => {
                const account = bankAccounts.find((a) => a.id === e.accountId);
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-border text-[13px] transition-colors last:border-b-0 hover:bg-surface-2 ${
                      e.status === "needs-review" ? "bg-warn-soft/40" : ""
                    }`}
                  >
                    <td className="tnum whitespace-nowrap px-5 py-2.5 text-fg-muted">
                      {formatDate(e.date)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-fg">{e.description}</span>
                        {e.duplicateOfId ? (
                          <Badge tone="danger">
                            <Copy className="size-2.5" />
                            Duplicate?
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-fg-subtle">{e.counterparty}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {e.status === "needs-review" && e.suggestedCategory ? (
                        <span className="text-[12px] italic text-fg-muted">
                          {e.suggestedCategory}?
                        </span>
                      ) : (
                        <span className="text-[12px] text-fg-muted">{e.category}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-fg-muted">
                      {account?.name} ••{account?.mask}
                    </td>
                    <td
                      className={`tnum whitespace-nowrap px-3 py-2.5 text-right font-semibold ${
                        e.amountCents >= 0 ? "text-ok" : "text-fg"
                      }`}
                    >
                      {money(e.amountCents, { sign: e.amountCents > 0 })}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge
                        tone={
                          e.status === "cleared"
                            ? "ok"
                            : e.status === "pending"
                              ? "neutral"
                              : "warn"
                        }
                      >
                        {e.status === "needs-review" ? "review" : e.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[12px] text-fg-muted">
          <span>
            {recon.cleared.length} cleared · {recon.pending.length} pending ·{" "}
            <span className="font-medium text-warn">{recon.needsReview.length} need review</span>
          </span>
          
        </div>
      </Card>


      {/* Reserve cash: what it holds, what it earns, where it could earn more. */}
      <Card className="mt-5">
        <CardHeader
          title="Reserve cash and yield"
          
          icon={<PiggyBank className="size-4" />}
        />
        <div className="grid gap-5 px-5 py-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Reserve balance
            </p>
            <p className="tnum mt-1.5 text-[22px] font-semibold leading-none text-fg">
              {money(interest.balance, { cents: false })}
            </p>
            <p className="mt-1 text-[11px] text-fg-muted">
              Across {interest.reserveAccounts.length} accounts
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Blended yield
            </p>
            <p className="tnum mt-1.5 text-[22px] font-semibold leading-none text-fg">
              {interest.blendedApy.toFixed(2)}%
            </p>
            <p className="mt-1 text-[11px] text-fg-muted">Weighted by balance</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Interest earned YTD
            </p>
            <p className="tnum mt-1.5 text-[22px] font-semibold leading-none text-ok">
              {money(interest.earnedYtd, { cents: false })}
            </p>
            <p className="mt-1 text-[11px] text-fg-muted">Posted and reconciled</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Projected, full year
            </p>
            <p className="tnum mt-1.5 text-[22px] font-semibold leading-none text-fg">
              {money(interest.projectedAnnual, { cents: false })}
            </p>
            <p className="mt-1 text-[11px] text-fg-muted">At today&apos;s rates</p>
          </div>
        </div>

        {exposure.totalUninsured > 0 ? (
          <div className="px-5 pb-4">
            <Callout
              tone="warn"
              icon={<ShieldAlert className="size-4" />}
              title={`${money(exposure.totalUninsured, { cents: false })} sits above deposit insurance`}
            >
              {exposure.rows
                .filter((r) => r.uninsured > 0)
                .map((r) => (
                  <span key={r.institution}>
                    {r.institution} holds {money(r.balance, { cents: false })} against a{" "}
                    {money(r.limit, { cents: false })} limit. A sweep spreads the balance across
                    member banks so all of it stays covered.
                  </span>
                ))}
            </Callout>
          </div>
        ) : null}

        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Where the savings balance could sit
            </p>
            <p className="text-[12px] text-fg-muted">
              Moving {money(opportunity.movable, { cents: false })} from{" "}
              {opportunity.current?.apy.toFixed(2)}% to {opportunity.recommended.apy.toFixed(2)}%
              earns{" "}
              <span className="tnum font-semibold text-ok">
                {money(opportunity.gainAnnual, { cents: false })}
              </span>{" "}
              more a year.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {opportunity.offers.map((o) => (
              <div
                key={o.id}
                className={`rounded-card border p-4 ${
                  o.recommended
                    ? "border-navy-700 bg-brand-soft dark:border-navy-300"
                    : "border-border bg-surface-2"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-fg">{o.name}</p>
                    <p className="truncate text-[11px] text-fg-muted">{o.institution}</p>
                  </div>
                  {o.recommended ? <Badge tone="ok">Best fit</Badge> : null}
                </div>
                <p className="tnum mt-2.5 text-[24px] font-semibold leading-none tracking-[-0.03em] text-fg">
                  {o.apy.toFixed(2)}%
                  <span className="ml-1 text-[11px] font-medium text-fg-muted">APY</span>
                </p>
                <dl className="mt-3 space-y-1.5 border-t border-border pt-2.5 text-[11px]">
                  <div>
                    <dt className="text-fg-subtle">Access</dt>
                    <dd className="text-fg-muted">{o.liquidity}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-subtle">Coverage</dt>
                    <dd className="text-fg-muted">{o.insuranceNote}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-subtle">Minimum</dt>
                    <dd className="tnum text-fg-muted">{money(o.minimumCents, { cents: false })}</dd>
                  </div>
                </dl>
                <Button
                  variant={o.recommended ? "primary" : "secondary"}
                  size="sm"
                  className="mt-3 w-full"
                >
                  Open account
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
          
        </div>
      </Card>

      {/* Reserves */}
      <Card className="mt-5">
        <CardHeader
          title="Reserve schedule"
          subtitle={`${Math.round(reserve.percentFunded * 100)}% funded · ${money(reserve.funded, { cents: false })} of ${money(reserve.required, { cents: false })} in replacement obligations`}
          action={
            <Link href="/board/compliance" className="text-[12px] font-medium text-accent hover:underline">
              Why this matters
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                <th className="px-5 py-2.5 font-semibold">Component</th>
                <th className="px-3 py-2.5 text-right font-semibold">Remaining life</th>
                <th className="px-3 py-2.5 text-right font-semibold">Replacement</th>
                <th className="px-3 py-2.5 text-right font-semibold">Funded</th>
                <th className="w-40 px-5 py-2.5 font-semibold">Progress</th>
              </tr>
            </thead>
            <tbody>
              {reserveComponents.map((c) => {
                const pct = c.fundedCents / c.replacementCostCents;
                const urgent = c.remainingLifeYears <= 2;
                return (
                  <tr key={c.id} className="border-b border-border text-[13px] last:border-b-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-fg">{c.name}</p>
                      {c.note ? (
                        <p className="mt-0.5 text-[11px] text-fg-muted">{c.note}</p>
                      ) : c.lastInspection ? (
                        <p className="mt-0.5 text-[11px] text-fg-subtle">
                          Last inspected {formatDate(c.lastInspection, "long")}
                        </p>
                      ) : null}
                    </td>
                    <td className="tnum px-3 py-3 text-right">
                      <span className={urgent ? "font-semibold text-warn" : "text-fg-muted"}>
                        {c.remainingLifeYears} yr
                      </span>
                    </td>
                    <td className="tnum px-3 py-3 text-right text-fg">
                      {shortMoney(c.replacementCostCents)}
                    </td>
                    <td className="tnum px-3 py-3 text-right text-fg-muted">
                      {shortMoney(c.fundedCents)}
                    </td>
                    <td className="px-5 py-3">
                      <Meter
                        value={pct}
                        tone={pct >= 0.8 ? "ok" : urgent ? "warn" : "brand"}
                        aria-label={`${c.name} ${Math.round(pct * 100)}% funded`}
                      />
                      <span className="tnum mt-1 block text-[11px] text-fg-subtle">
                        {Math.round(pct * 100)}%
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
