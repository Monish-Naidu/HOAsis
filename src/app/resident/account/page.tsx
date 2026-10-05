"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import { useState } from "react";
import { ChevronDown, ChevronRight, CircleDollarSign, Download, History, Landmark, Receipt, Settings } from "lucide-react";
import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";

import { useAppState, useCurrentOwner, useOwnerCharges } from "@/lib/app-state";
import { loadEarlierStatement } from "@/lib/data/remote-store";
import { formatDate, money, pastDueLabel, today } from "@/lib/utils";
import { homeLabel } from "@/lib/wording";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { HOME_TYPE_LABEL, isMixed, ownerDues } from "@/lib/home-types";

export default function ResidentAccount() {
  const { community } = useAppState();
  const association = community.association;
  const currentOwner = useCurrentOwner();
  const ownerCharges = useOwnerCharges();
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  if (!currentOwner) return null;
  // A real association sends the last two years; the rest is one tap away.
  const history = community.history;
  const earlierCount = history
    ? Math.max(0, (history.statementCounts[currentOwner.id] ?? 0) - ownerCharges.length)
    : 0;
  const hasEarlier = earlierCount > 0 && !history?.statementsLoaded.includes(currentOwner.id);

  async function showEarlier() {
    if (!currentOwner) return;
    setLoadingEarlier(true);
    await loadEarlierStatement(currentOwner.id);
    setLoadingEarlier(false);
  }
  // The year the ledger is actually in, not a constant.
  const paidYear = ownerCharges[0]?.date.slice(0, 4) ?? String(today().getUTCFullYear());
  // That year's payments only. Summing every line was right while a statement
  // held one year; with five it put the whole history under "Paid in".
  const paidThisYear = ownerCharges
    .filter((c) => c.kind === "payment" && c.date.startsWith(paidYear))
    .reduce((t, c) => t + Math.abs(c.amountCents), 0);

  // Six lines, the last few months, and the rest folded by year. A year of
  // dues and payments was twenty-four rows before the contact details.
  const RECENT = 6;
  const recent = ownerCharges.slice(0, RECENT);
  const olderYears = Object.entries(
    ownerCharges.slice(RECENT).reduce<Record<string, typeof ownerCharges>>((acc, line) => {
      (acc[line.date.slice(0, 4)] ??= []).push(line);
      return acc;
    }, {}),
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const row = (line: (typeof ownerCharges)[number], i: number) => {
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
                    Applied to
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
        title="Account"
        subtitle={[
          homeLabel(community, currentOwner.unit),
          isMixed(community.profile) && currentOwner.homeType
            ? HOME_TYPE_LABEL[currentOwner.homeType].one
            : null,
          currentOwner.displayName,
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
            {money(currentOwner.balanceCents)}
          </p>
          <Badge
            tone={
              currentOwner.standing === "current"
                ? "ok"
                : currentOwner.standing === "collections"
                  ? "danger"
                  : "warn"
            }
            className="mt-2"
          >
            {currentOwner.standing === "current"
              ? "Paid up"
              : currentOwner.standing === "collections"
                ? "In collections"
                : pastDueLabel(currentOwner.daysPastDue)}
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
            {money(ownerDues(association, currentOwner), { cents: false })} a{" "}
            {association.duesCadence === "monthly"
              ? "month"
              : association.duesCadence === "quarterly"
                ? "quarter"
                : "year"}{" "}
            in dues
          </p>
        </Card>
      </div>

      <section>
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() =>
                // The ledger as a spreadsheet, for a tax return or a lender.
                downloadCsv(
                  `dues-${currentOwner.unit}-${paidYear}.csv`,
                  toCsv(ownerCharges, [
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
              Statement
            </button>
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
                  {lines.length} entries
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
                {loadingEarlier ? "Loading" : `Show entries before ${formatDate(history?.from ?? "", "long")}`}
              </span>
              <span className="font-medium text-fg-subtle">{earlierCount} entries</span>
            </button>
          ) : null}
        </Card>
      </section>

      {/* On a phone these two have no tab of their own, so Account is the
          way in. On the website the rail already lists both. */}
      <Link
        href="/resident/finances"
        className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2 lg:hidden"
      >
        <Landmark className="size-4 shrink-0 text-fg-subtle" />
        <span className="flex-1 text-body font-medium text-fg">Association funds</span>
        <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
      </Link>

      <Link
        href="/resident/settings"
        className="flex min-h-12 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2 lg:hidden"
      >
        <Settings className="size-4 shrink-0 text-fg-subtle" />
        <span className="flex-1 text-body font-medium text-fg">
          Settings
          <span className="block text-footnote font-normal text-fg-muted">
            Text size, light or dark, and your contact details
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
      </Link>
    </div>
  );
}
