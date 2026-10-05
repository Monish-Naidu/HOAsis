"use client";

import { useState } from "react";
import { Landmark, ShieldAlert } from "lucide-react";
import { Button, Callout, Card, CardHeader, Meter, PageHeader, Segmented } from "@/components/ui/primitives";
import { AddBudgetLine } from "@/components/app/add-budget-line";
import { BankConnect } from "@/components/app/bank-connect";
import { MoneyFlowChart, SpendingDonut } from "@/components/app/board-charts";
import { DeltaChip, SectionLink, StatTile } from "@/components/app/finance-ui";
import { OpeningBalances } from "./opening-balances";
import { useToast } from "@/components/app/toast";
import { useAppState, useReconciliation } from "@/lib/app-state";
import {
  agingBuckets,
  budgetVariance,
  cashPosition,
  compareYears,
  insuranceExposure,
  lateFeesOwed,
  ledgerYears,
  monthName,
  monthlyFlowsBetween,
  operatingRunway,
  pastDueHint,
  periodRange,
  spendingBetween,
} from "@/lib/metrics";
import { cn, formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";
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

  const accounts = community.bankAccounts;
  const primary = accounts.find((a) => a.kind === "operating") ?? accounts[0];
  const reserveAccounts = accounts.filter((a) => a.kind !== "operating");
  const cash = cashPosition(community);
  const exposure = insuranceExposure(community);

  const thisYear = Number(todayIsoDate().slice(0, 4));
  const years = ledgerYears(community);
  // The charts read one window: the last twelve months, or a calendar
  // year. A treasurer in February wants the winter they just paid for, not
  // six weeks of a new year.
  const [span, setSpan] = useState<string>("rolling");
  const rolling = span === "rolling";
  const year = rolling ? (years[0] ?? thisYear) : Number(span);
  const today = todayIsoDate();
  const window = rolling
    ? periodRange("last-12-months", today)
    : { from: `${year}-01-01`, to: year === thisYear ? today : `${year}-12-31` };
  const flows = monthlyFlowsBetween(community, window.from, window.to);
  const spending = spendingBetween(community, window.from, window.to);
  const flowIn = flows.reduce((t, m) => t + m.inCents, 0);
  const flowOut = flows.reduce((t, m) => t + m.outCents, 0);
  const monthOf = (iso: string) => Number(iso.slice(5, 7));
  const spanLabel = rolling
    ? `${monthName(monthOf(window.from))} ${window.from.slice(0, 4)} to ${monthName(monthOf(window.to))} ${window.to.slice(0, 4)}`
    : year === thisYear
      ? `January to ${monthName(monthOf(today), "long")}`
      : `All of ${year}`;
  const runway = operatingRunway(community, today);
  const hasFlows = flows.some((m) => m.inCents > 0 || m.outCents > 0);

  const lastYear = years.find((y) => y < year);
  const cmp =
    moduleOn("money-compare") && lastYear !== undefined
      ? compareYears(community, lastYear, year)
      : null;
  const showBudget = moduleOn("money-budget");

  const budget = budgetVariance(community);
  const aging = agingBuckets(community);
  const needsReview = recon.needsReview;

  return (
    <>
      <PageHeader
        title="Finances"
        description="Balances, recent activity, and items to review."
      />

      {moduleOn("deposit-insurance") && exposure.totalUninsured > 0 ? (
        <Callout
          tone="warn"
          className="mb-6"
          icon={<ShieldAlert className="size-4" />}
          title={`${money(exposure.totalUninsured, { cents: false })} is over the insured limit`}
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
              ? // There is no bank feed for a real association yet, so nothing
                // has been matched to anything; the figure is the books' own.
                isRemote
                ? `${primary.institution}${primary.mask ? ` ••${primary.mask}` : ""} · from the books`
                : `${primary.institution} ••${primary.mask} · confirmed through ${formatDate(primary.reconciledThroughDate)}`
              : "No bank account connected yet"
          }
        />
        {/* The bank's figure, named as one. The Reserves tab shows the same
            number first and then what of it is assigned to each component,
            so the two screens cannot be read as disagreeing. */}
        <StatTile
          label="Reserve accounts"
          value={money(cash.reserve, { cents: false })}
          hint={
            reserveAccounts.length
              ? reserveAccounts.map((a) => `${a.name} ••${a.mask}`).join(", ")
              : "Nothing set aside yet"
          }
          href="/board/reserves"
        />
        <StatTile
          // The dashboard's row for the same lines says "to confirm"; "waiting
          // on you" there means vendor bills, so this tile says what it counts.
          label="To confirm"
          value={String(needsReview.length)}
          tone={needsReview.length ? "warn" : undefined}
          hint={needsReview.length ? "Not counted in the totals until confirmed" : "Every transaction is confirmed"}
          href="/board/money/transactions?status=needs-review"
        />
        <StatTile
          label="Past due"
          value={money(aging.pastDueCents, { cents: false })}
          tone={aging.pastDueCount ? "warn" : undefined}
          hint={pastDueHint(aging.pastDueCount, lateFeesOwed(community))}
          href="/board/money/collections"
        />
      </div>

      <OpeningBalances />

      {!primary ? (
        <Card className="mt-6 p-5">
          <div className="mb-4">
            <h2 className="text-headline font-semibold tracking-[-0.015em] text-fg">
              Connect the association&apos;s bank account
            </h2>
            <p className="mt-1 text-body leading-relaxed text-fg-muted">
              Dues have nowhere to land until an account in the association&apos;s name is
              connected.
            </p>
          </div>
          <BankConnect
            linked={false}
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
            subtitle="Confirm each transaction, or remove it."
            action={<SectionLink href="/board/money/transactions?status=needs-review">Open in Transactions</SectionLink>}
          />
          <ul className="divide-y divide-border">
            {needsReview.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                {/* The text keeps at least 12rem, so on a phone the amount and
                    the two buttons drop under it instead of squeezing it to a
                    word per line. */}
                <span className="min-w-[12rem] flex-1">
                  <span className="block truncate text-body font-medium text-fg">{e.description}</span>
                  <span className="block text-footnote text-fg-subtle">
                    <span className="tnum">{formatDate(e.date)}</span> · {e.counterparty}
                    {e.duplicateOfId ? " · looks like a duplicate" : null}
                    {e.suggestedCategory ? ` · ${e.suggestedCategory}?` : null}
                  </span>
                </span>
                <span className={`tnum text-body font-semibold ${e.amountCents >= 0 ? "text-ok" : "text-fg"}`}>
                  {money(e.amountCents, { sign: e.amountCents > 0 })}
                </span>
                <span className="ml-auto flex gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const undo = confirmLedgerEntry(e.id);
                      notify(`Confirmed ${e.description}`, "ok", { label: "Undo", onClick: undo });
                    }}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger-soft hover:text-danger"
                    onClick={() => {
                      const undo = dismissLedgerEntry(e.id);
                      notify("Transaction removed", "warn", { label: "Undo", onClick: undo });
                    }}
                  >
                    Remove
                  </Button>
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
                <dt className="flex items-center justify-between text-footnote font-semibold text-fg-muted">
                  {row.label}
                  <DeltaChip delta={row.delta} goodWhen={row.goodWhen} />
                </dt>
                <dd className="tnum mt-2 text-title2 font-semibold leading-none tracking-[-0.03em] text-fg">
                  {money(row.now, { cents: false })}
                </dd>
                <dd className="tnum mt-1.5 text-footnote text-fg-muted">
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
            <h2 className="text-headline font-semibold tracking-[-0.015em] text-fg">Through the year</h2>
            <Segmented
              label="Period"
              value={span}
              onChange={setSpan}
              options={[
                { value: "rolling", label: "Last 12 months" },
                ...[...years]
                  .sort((a, b) => a - b)
                  .map((y) => ({ value: String(y), label: y === thisYear ? "This year" : String(y) })),
              ]}
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-5">
            {hasFlows ? (
              <Card className={cn("flex flex-col", spending.rows.length > 0 ? "xl:col-span-3" : "xl:col-span-5")}>
                <CardHeader
                  title="Money in and out"
                  subtitle={`${spanLabel}: ${money(flowIn, { cents: false })} in, ${money(flowOut, { cents: false })} out`}
                />
                <MoneyFlowChart months={flows} />
                {/* The number a treasurer is asked at the annual meeting. */}
                {runway.months > 0 ? (
                  <p className="mt-auto border-t border-border px-5 py-3 text-footnote leading-relaxed text-fg-muted">
                    A typical month brings in {money(runway.avgInCents, { cents: false })} and pays out{" "}
                    {money(runway.avgOutCents, { cents: false })}.
                    {runway.coversMonths !== null
                      ? ` With nothing coming in, the operating account would cover ${Math.round(runway.coversMonths * 10) / 10} months of bills.`
                      : ""}
                  </p>
                ) : null}
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

      {/* Budget pace, a glance and a link, once the budget module is on.
          The dues collection card that sat beside it said what the
          Past due tab says in more detail, one click away. */}
      {showBudget ? (
          <Card className="mt-6">
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
                      <p className="text-footnote font-semibold text-fg-muted">{row.label}</p>
                      <p className="tnum text-footnote text-fg-muted">
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
                <p className="text-footnote text-fg-muted">
                  {budget.flagged.length
                    ? `${pluralize(budget.flagged.length, "line")} off pace: ${budget.flagged.map((r) => r.category).join(", ")}.`
                    : "Every line is on pace."}
                </p>
              </div>
            ) : (
              <div className="px-5 py-4">
                <p className="mb-3 text-body text-fg-muted">
                  No budget yet. Add the lines you spend on and this page starts measuring against them.
                </p>
                <AddBudgetLine />
              </div>
            )}
          </Card>
      ) : null}

      {primary && recon.staleFeeds.length ? (
        <p className="mt-4 flex items-center gap-1.5 text-footnote text-fg-muted">
          <Landmark className="size-3.5" />
          {recon.staleFeeds.map((a) => `${a.institution} ••${a.mask}`).join(", ")}{" "}
          {recon.staleFeeds.length === 1 ? "has" : "have"} not updated recently.
        </p>
      ) : null}
    </>
  );
}
