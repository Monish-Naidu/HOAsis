"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, ShieldAlert } from "lucide-react";
import { Badge, Button, Callout, Card, CardHeader, Meter, PageHeader } from "@/components/ui/primitives";
import { MoneyTabs } from "@/components/app/money-tabs";
import { AddBudgetLine } from "@/components/app/add-budget-line";
import { BankConnect } from "@/components/app/bank-connect";
import { MoneyFlowChart, SpendingDonut } from "@/components/app/board-charts";
import { DeltaChip, SectionLink, StatTile, YearControl } from "@/components/app/finance-ui";
import { useToast } from "@/components/app/toast";
import { useAppState, useReconciliation } from "@/lib/app-state";
import {
  agingBuckets,
  budgetVariance,
  cashPosition,
  compareYears,
  duesCollection,
  insuranceExposure,
  ledgerYears,
  monthName,
  monthlyFlows,
  spendingByCategory,
} from "@/lib/metrics";
import { formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";
import { moduleOn } from "@/lib/modules";

/**
 * Finances, the overview: where the money stands today, and the one or two
 * things a treasurer should do about it. Every figure is a selector; every
 * card links to the tab that has the rest.
 */
export function OverviewScreen() {
  const { community, confirmLedgerEntry, dismissLedgerEntry, addBankAccount, isRemote } = useAppState();
  const recon = useReconciliation();
  const { notify } = useToast();
  const router = useRouter();

  const accounts = community.bankAccounts;
  const primary = accounts.find((a) => a.kind === "operating") ?? accounts[0];
  const reserveAccounts = accounts.filter((a) => a.kind !== "operating");
  const cash = cashPosition(community);
  const exposure = insuranceExposure(community);

  const thisYear = Number(todayIsoDate().slice(0, 4));
  const years = ledgerYears(community);
  const [year, setYear] = useState(years[0] ?? thisYear);
  const flows = monthlyFlows(community, year);
  const spending = spendingByCategory(community, year);
  const hasFlows = flows.some((m) => m.inCents > 0 || m.outCents > 0);

  const lastYear = years.find((y) => y < year);
  const cmp =
    moduleOn("money-compare") && lastYear !== undefined
      ? compareYears(community, lastYear, year)
      : null;
  const showBudget = moduleOn("money-budget");

  const budget = budgetVariance(community);
  const dues = duesCollection(community, thisYear);
  const aging = agingBuckets(community);
  const needsReview = recon.needsReview;

  return (
    <>
      <MoneyTabs />
      <PageHeader
        title="Finances"
        description="Balances, recent activity, and items to review."
        action={
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              if (needsReview.length === 0) {
                notify("The books are matched. Every report agrees.");
                return;
              }
              router.push("/board/money/transactions?status=needs-review");
            }}
          >
            Match transactions
          </Button>
        }
      />

      {moduleOn("deposit-insurance") && exposure.totalUninsured > 0 ? (
        <Callout
          tone="warn"
          className="mb-6"
          icon={<ShieldAlert className="size-4" />}
          title={`${money(exposure.totalUninsured, { cents: false })} sits above deposit insurance`}
        >
          {exposure.rows
            .filter((row) => row.uninsured > 0)
            .map((row) => (
              <span key={row.institution} className="block">
                {row.institution} holds {money(row.balance, { cents: false })} against a{" "}
                {money(row.limit, { cents: false })} limit. The limit is per bank, not per account,
                so a second account there does not extend it.
              </span>
            ))}
        </Callout>
      ) : null}

      {/* The bank position. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Operating"
          value={money(cash.operating, { cents: false })}
          hint={
            primary
              ? `${primary.institution} ••${primary.mask} · matched through ${formatDate(primary.reconciledThroughDate)}`
              : "No bank account connected yet"
          }
        />
        <StatTile
          label="Reserves"
          value={money(cash.reserve, { cents: false })}
          hint={
            reserveAccounts.length
              ? reserveAccounts.map((a) => `${a.name} ••${a.mask}`).join(", ")
              : "Nothing set aside yet"
          }
          href="/board/reserves"
        />
        <StatTile
          label="Waiting on you"
          value={String(needsReview.length)}
          tone={needsReview.length ? "warn" : undefined}
          hint="Held out of reports until confirmed"
          href="/board/money/transactions?status=needs-review"
        />
        <StatTile
          label="Past due"
          value={money(aging.pastDueCents, { cents: false })}
          tone={aging.pastDueCount ? "warn" : undefined}
          hint={pluralize(aging.pastDueCount, "household")}
          href="/board/money/collections"
        />
      </div>

      {!primary ? (
        <Card className="mt-6 p-5">
          <div className="mb-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
              Connect the association&apos;s bank account
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
              Dues have nowhere to land until an account in the association&apos;s name is
              connected.
            </p>
          </div>
          <BankConnect
            linked={!isRemote}
            onConnect={(account) => {
              addBankAccount(account);
              notify(`${account.institution} ••${account.mask} connected`, "ok");
            }}
          />
        </Card>
      ) : null}

      {/* The decisions, while there are any. Confirming here keeps the
          review out of the way of the books, one line per transaction. */}
      {needsReview.length > 0 ? (
        <Card className="mt-6">
          <CardHeader
            title={`${pluralize(needsReview.length, "transaction")} ${needsReview.length === 1 ? "needs" : "need"} a decision`}
            subtitle="Confirm each category, or remove the line."
            action={<SectionLink href="/board/money/transactions?status=needs-review">Open in Transactions</SectionLink>}
          />
          <ul className="divide-y divide-border">
            {needsReview.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="tnum w-14 shrink-0 text-[13px] text-fg-muted">{formatDate(e.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-fg">{e.description}</span>
                  <span className="block text-[13px] text-fg-subtle">
                    {e.counterparty}
                    {e.duplicateOfId ? " · looks like a duplicate" : null}
                    {e.suggestedCategory ? ` · ${e.suggestedCategory}?` : null}
                  </span>
                </span>
                <span className={`tnum text-[15px] font-semibold ${e.amountCents >= 0 ? "text-ok" : "text-fg"}`}>
                  {money(e.amountCents, { sign: e.amountCents > 0 })}
                </span>
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const undo = confirmLedgerEntry(e.id);
                      notify(`Confirmed ${e.description}`, "ok", { label: "Undo", onClick: undo });
                    }}
                    className="h-7 rounded-md border border-border-2 px-2 text-[13px] font-medium text-fg hover:bg-surface-2"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const undo = dismissLedgerEntry(e.id);
                      notify("Removed from the ledger", "warn", { label: "Undo", onClick: undo });
                    }}
                    className="h-7 rounded-md px-2 text-[13px] font-medium text-danger hover:bg-danger-soft"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* This year against last, like for like. */}
      {cmp ? (
        <Card className="mt-6">
          <CardHeader
            title={`${year} against ${lastYear}`}
            subtitle={
              cmp.partial
                ? `January to ${monthName(cmp.throughMonth, "long")} of both years. Reserve funding sits outside these.`
                : "Full years. Reserve funding sits outside these."
            }
            action={<SectionLink href="/board/money/trends">Compare years</SectionLink>}
          />
          <dl className="grid gap-px bg-border sm:grid-cols-3">
            {[
              { label: "Money in", now: cmp.b.incomeCents, then: cmp.a.incomeCents, delta: cmp.income, goodWhen: "up" as const },
              { label: "Money out", now: cmp.b.spendCents, then: cmp.a.spendCents, delta: cmp.spend, goodWhen: "down" as const },
              { label: "Net", now: cmp.b.netCents, then: cmp.a.netCents, delta: cmp.net, goodWhen: "up" as const },
            ].map((row) => (
              <div key={row.label} className="bg-surface px-5 py-4">
                <dt className="flex items-center justify-between text-[13px] font-semibold text-fg-muted">
                  {row.label}
                  <DeltaChip delta={row.delta} goodWhen={row.goodWhen} />
                </dt>
                <dd className="tnum mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em] text-fg">
                  {money(row.now, { cents: false })}
                </dd>
                <dd className="tnum mt-1.5 text-[13px] text-fg-muted">
                  {money(row.then, { cents: false })} in {lastYear}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {/* The charts, one year control for both. */}
      {hasFlows || spending.rows.length > 0 ? (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">Through the year</h2>
            {years.length > 1 ? (
              <YearControl years={years} value={year} onChange={setYear} thisYear={thisYear} />
            ) : null}
          </div>
          <div className="grid gap-4 xl:grid-cols-5">
            {hasFlows ? (
              <Card className={spending.rows.length > 0 ? "xl:col-span-3" : "xl:col-span-5"}>
                <CardHeader title="Money in and out" />
                <MoneyFlowChart months={flows} />
              </Card>
            ) : null}
            {spending.rows.length > 0 ? (
              <Card className={hasFlows ? "xl:col-span-2" : "xl:col-span-5"}>
                <CardHeader title="Where it went" />
                <SpendingDonut
                  rows={spending.rows}
                  totalCents={spending.totalCents}
                  reportHref="/board/money/transactions"
                />
              </Card>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Budget pace and dues collection, each a glance and a link. Budget
          waits behind the launch switch; dues collection stands alone then. */}
      <div className={showBudget ? "mt-6 grid gap-4 lg:grid-cols-2" : "mt-6 grid gap-4"}>
        {showBudget ? (
        <Card>
          <CardHeader
            title="Budget pace"
            subtitle={`${Math.round(budget.yearElapsed * 100)}% of the year gone`}
            action={budget.hasBudget ? <SectionLink href="/board/money/budget">Budget</SectionLink> : undefined}
          />
          {budget.hasBudget ? (
            <div className="space-y-4 px-5 py-4">
              {[
                { label: "Money in", total: budget.incomeTotal, tone: "ok" as const },
                { label: "Money out", total: budget.expenseTotal, tone: "brand" as const },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-semibold text-fg-muted">{row.label}</p>
                    <p className="tnum text-[13px] text-fg-muted">
                      <span className="font-semibold text-fg">{money(row.total.ytdActualCents, { cents: false })}</span>{" "}
                      of {money(row.total.annualCents, { cents: false })} · {Math.round(row.total.pace * 100)}%
                    </p>
                  </div>
                  <Meter
                    value={row.total.pace}
                    tone={row.label === "Money out" && row.total.pace > budget.yearElapsed + 0.02 ? "warn" : row.tone}
                    className="mt-2"
                    aria-label={`${row.label}, ${Math.round(row.total.pace * 100)}% of budget`}
                  />
                </div>
              ))}
              <p className="text-[13px] text-fg-muted">
                {budget.flagged.length
                  ? `${pluralize(budget.flagged.length, "line")} off pace: ${budget.flagged.map((r) => r.category).join(", ")}.`
                  : "Every line is on pace."}
              </p>
            </div>
          ) : (
            <div className="px-5 py-4">
              <p className="mb-3 text-[15px] text-fg-muted">
                No budget yet. Add the lines you spend on and this page starts measuring against them.
              </p>
              <AddBudgetLine />
            </div>
          )}
        </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Dues collection"
            subtitle={dues.measurable ? `${thisYear}, billed against collected` : "Nothing billed yet"}
            action={<SectionLink href="/board/money/collections">Collections</SectionLink>}
          />
          <div className="px-5 py-4">
            {dues.measurable ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <p className="tnum text-[28px] font-semibold leading-none tracking-[-0.03em] text-fg">
                    {Math.round(dues.rate * 100)}%
                  </p>
                  <p className="tnum text-right text-[13px] text-fg-muted">
                    {money(dues.collectedYtd, { cents: false })} of {money(dues.expectedYtd, { cents: false })}
                  </p>
                </div>
                <Meter value={dues.rate} tone={dues.rate >= 0.95 ? "ok" : "warn"} className="mt-3" aria-label="Dues collected" />
              </>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-3 text-[13px]">
              <span className="text-fg-muted">Past due</span>
              <span className="flex items-center gap-2">
                <span className="tnum font-semibold text-fg">{money(aging.pastDueCents, { cents: false })}</span>
                <Badge tone={aging.pastDueCount ? "warn" : "ok"}>{pluralize(aging.pastDueCount, "household")}</Badge>
              </span>
            </div>
          </div>
        </Card>
      </div>

      {primary && recon.staleFeeds.length ? (
        <p className="mt-4 flex items-center gap-1.5 text-[13px] text-fg-muted">
          <Landmark className="size-3.5" />
          {recon.staleFeeds.map((a) => `${a.institution} ••${a.mask}`).join(", ")}{" "}
          {recon.staleFeeds.length === 1 ? "has" : "have"} not synced recently.
        </p>
      ) : null}
    </>
  );
}
