"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import { useState } from "react";
import { ChevronDown, CircleDollarSign, Download, History, Receipt } from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";

import { useAppState, useCurrentHome, useHomeCharges } from "@/lib/app-state";
import { loadEarlierStatement } from "@/lib/data/remote-store";
import { formatDate, money, today, todayIsoDate } from "@/lib/utils";
import { balanceSplit } from "@/lib/statement";
import { balanceStanding } from "@/lib/resident-wording";
import { homeLabel } from "@/lib/wording";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { PrintStatementControl } from "@/components/app/statement-print";
import { HOME_TYPE_LABEL, isMixed, homeDues } from "@/lib/home-types";

export default function ResidentAccount() {
  const { community } = useAppState();
  const association = community.association;
  const currentHome = useCurrentHome();
  const homeCharges = useHomeCharges();
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  if (!currentHome) return null;
  const standing = balanceStanding(currentHome);
  // A real association sends the last two years; the rest is one tap away.
  const history = community.history;
  const earlierCount = history
    ? Math.max(0, (history.statementCounts[currentHome.id] ?? 0) - homeCharges.length)
    : 0;
  const hasEarlier = earlierCount > 0 && !history?.statementsLoaded.includes(currentHome.id);

  async function showEarlier() {
    if (!currentHome) return;
    setLoadingEarlier(true);
    await loadEarlierStatement(currentHome.id);
    setLoadingEarlier(false);
  }
  // The rate is what this home pays a bill from now on; a bill already on the
  // statement keeps the amount it was issued at. Said so when they differ.
  const rate = homeDues(association, currentHome);
  const upcoming = balanceSplit(homeCharges, currentHome.balanceCents, todayIsoDate()).upcoming;
  const issuedAtOtherAmount = upcoming && upcoming.amountCents !== rate ? upcoming : null;
  // The year the ledger is actually in, not a constant.
  const paidYear = homeCharges[0]?.date.slice(0, 4) ?? String(today().getUTCFullYear());
  // That year's payments only. Summing every line was right while a statement
  // held one year; with five it put the whole history under "Paid in".
  const paidThisYear = homeCharges
    .filter((c) => c.kind === "payment" && c.date.startsWith(paidYear))
    .reduce((t, c) => t + Math.abs(c.amountCents), 0);

  // Six lines, the last few months, and the rest folded by year. A year of
  // dues and payments was twenty-four rows before the contact details.
  const RECENT = 6;
  const recent = homeCharges.slice(0, RECENT);
  const olderYears = Object.entries(
    homeCharges.slice(RECENT).reduce<Record<string, typeof homeCharges>>((acc, line) => {
      (acc[line.date.slice(0, 4)] ??= []).push(line);
      return acc;
    }, {}),
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const row = (line: (typeof homeCharges)[number], i: number) => {
            const isPayment = line.kind === "payment";
            const body = (
              <>
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                      isPayment ? "bg-ok-soft text-ok" : "bg-surface-3 text-fg-muted"
                    }`}
                  >
                    {isPayment ? <CircleDollarSign className="size-4" /> : <Receipt className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-body font-medium text-fg">{line.label}</p>
                    <p className="mt-0.5 text-footnote text-fg-muted">
                      {formatDate(line.date, "long")}
                      {line.method ? ` · ${line.method}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`tnum text-body font-semibold ${
                        isPayment ? "text-ok" : "text-fg"
                      }`}
                    >
                      {isPayment ? "−" : ""}
                      {money(Math.abs(line.amountCents))}
                    </p>
                    <p className="tnum mt-0.5 text-footnote text-fg-subtle">
                      Balance {money(line.balanceAfterCents)}
                    </p>
                  </div>
                  {line.appliedTo?.length ? (
                    <ChevronDown className="mt-1 size-3.5 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
                  ) : null}
                </div>
              </>
            );

            if (!line.appliedTo?.length) {
              return (
                <div
                  key={line.id}
                  className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  {body}
                </div>
              );
            }

            return (
              <details
                key={line.id}
                className={`group ${i > 0 ? "border-t border-border" : ""}`}
              >
                <summary className="cursor-pointer list-none px-4 py-3 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  {body}
                </summary>
                <div className="border-t border-border bg-surface-2 px-4 py-3">
                  <p className="mb-2 text-footnote font-semibold text-fg-muted">
                    Paid toward
                  </p>
                  <ul className="space-y-1.5">
                    {line.appliedTo.map((a) => (
                      <li key={a.chargeId} className="flex justify-between text-footnote">
                        <span className="text-fg-muted">{a.label}</span>
                        <span className="tnum font-medium text-fg">{money(a.amountCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            );
  };

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle
        title="Statement"
        subtitle={[
          homeLabel(community, currentHome.unit),
          isMixed(community.profile) && currentHome.homeType
            ? HOME_TYPE_LABEL[currentHome.homeType].one
            : null,
          currentHome.displayName,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-footnote font-semibold text-fg-muted">
            Balance
          </p>
          <p className="tnum mt-1.5 text-title2 font-semibold leading-none text-fg">
            {money(currentHome.balanceCents)}
          </p>
          {/* "Paid up" is for a home that owes nothing; the words come from
              one helper so every screen agrees. */}
          <Badge tone={standing.tone} className="mt-2">
            {standing.label}
          </Badge>
        </Card>
        <Card className="p-4">
          <p className="text-footnote font-semibold text-fg-muted">
            Paid in {paidYear}
          </p>
          <p className="tnum mt-1.5 text-title2 font-semibold leading-none text-fg">
            {money(paidThisYear, { cents: false })}
          </p>
          <p className="mt-2 text-footnote text-fg-muted">
            {money(rate, { cents: false })} a{" "}
            {association.duesCadence === "monthly"
              ? "month"
              : association.duesCadence === "quarterly"
                ? "quarter"
                : "year"}{" "}
            in dues
          </p>
          {issuedAtOtherAmount ? (
            <p className="mt-1 text-footnote text-fg-muted">
              The {formatDate(issuedAtOtherAmount.date, "long")} bill is already issued at{" "}
              {money(issuedAtOtherAmount.amountCents, { cents: false })}.
            </p>
          ) : null}
        </Card>
      </div>

      <section>
        <SectionTitle
          action={
            <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              <PrintStatementControl home={currentHome} className="flex items-center gap-2" />
              <button
              type="button"
              onClick={() =>
                // The ledger as a spreadsheet, for a tax return or a lender.
                downloadCsv(
                  `dues-${currentHome.unit}-${paidYear}.csv`,
                  toCsv(homeCharges, [
                    { header: "Date", value: (c) => c.date },
                    { header: "Description", value: (c) => c.label },
                    { header: "Method", value: (c) => c.method ?? "" },
                    { header: "Amount", value: (c) => (c.amountCents / 100).toFixed(2) },
                    { header: "Balance", value: (c) => (c.balanceAfterCents / 100).toFixed(2) },
                  ]),
                )
              }
              className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:underline"
            >
              <Download className="size-3" />
              Download as a spreadsheet
              </button>
            </span>
          }
        >
          Activity
        </SectionTitle>
        <Card>
          {recent.map((line, i) => row(line, i))}
          {olderYears.map(([year, lines]) => (
            <details key={year} className="group/year border-t border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-footnote font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg [&::-webkit-details-marker]:hidden">
                {year === paidYear ? `Earlier in ${year}` : year}
                <span className="flex items-center gap-2 font-medium text-fg-subtle">
                  {lines.length} transactions
                  <ChevronDown className="size-3.5 transition-transform group-open/year:rotate-180" />
                </span>
              </summary>
              {lines.map((line) => row(line, 1))}
            </details>
          ))}
          {hasEarlier ? (
            <button
              type="button"
              onClick={showEarlier}
              disabled={loadingEarlier}
              className="flex min-h-12 w-full items-center justify-between border-t border-border px-4 py-3 text-left text-footnote font-semibold text-accent transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                <History className="size-3.5" />
                {loadingEarlier ? "Loading" : `Show transactions before ${formatDate(history?.from ?? "", "long")}`}
              </span>
              <span className="font-medium text-fg-subtle">{earlierCount} transactions</span>
            </button>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
