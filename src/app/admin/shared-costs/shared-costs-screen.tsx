"use client";

import { useState } from "react";
import { Droplets, Download, Flame, Plug, Trash2, Wifi, Waves, HandCoins } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Meter,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { assessmentProgress, communitySlug, sharedCostSummary } from "@/lib/metrics";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { useToast } from "@/components/app/toast";
import { formatDate, money, shortMoney } from "@/lib/utils";
import type { AllocationMethod, SharedCostKind } from "@/lib/types";
import { CostTrend } from "./cost-trend";

const ICON: Record<SharedCostKind, typeof Droplets> = {
  water: Droplets,
  sewer: Waves,
  trash: Trash2,
  gas: Flame,
  electric: Plug,
  internet: Wifi,
  other: HandCoins,
};

/** Plain English for how a bill is split. Owners read these words, not the enum. */
const ALLOCATION_LABEL: Record<AllocationMethod, string> = {
  equal: "Split evenly",
  square_feet: "By floor area",
  bedrooms: "By bedrooms",
  occupants: "By people living there",
  submeter: "By meter reading",
};

export function SharedCostsScreen() {
  const { community } = useAppState();
  const { notify } = useToast();
  const shared = sharedCostSummary(community);
  const assessments = assessmentProgress(community);
  const [open, setOpen] = useState<string | null>(shared.rows[0]?.cost.id ?? null);

  // An association that bills one flat due sees this and nothing else. The
  // screen exists so the layer can be turned on, not so it can be nagged about.
  if (!shared.enabled && !assessments.enabled) {
    return (
      <>
        <PageHeader
          eyebrow="Shared costs"
          title="Bills the association passes on"
          description="Most associations bill one flat amount and never need this. Turn it on if the association pays a bill on everyone's behalf, like a shared water meter or one trash contract."
        />
        <Card>
          <EmptyState
            icon={<Droplets className="size-6" />}
            title="Nothing shared yet"
            description="Add a provider and the amount each home owes is worked out for you, added to their statement, and shown to them alongside what the community paid."
          />
        </Card>
      </>
    );
  }

  function exportTrend() {
    const rows = community.sharedCostBills
      .slice()
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    const nameOf = (id: string) => community.sharedCosts.find((c) => c.id === id);
    const csv = toCsv(rows, [
      { header: "Period", value: (b) => b.periodStart },
      { header: "Cost", value: (b) => nameOf(b.sharedCostId)?.name ?? "" },
      { header: "Provider", value: (b) => nameOf(b.sharedCostId)?.provider ?? "" },
      { header: "Community total", value: (b) => (b.totalCents / 100).toFixed(2) },
      { header: "Homes", value: (b) => b.homes },
      { header: "Per home", value: (b) => (b.averageShareCents / 100).toFixed(2) },
      { header: "Usage", value: (b) => b.usageAmount ?? "" },
      { header: "Unit", value: (b) => nameOf(b.sharedCostId)?.usageUnit ?? "" },
    ]);
    downloadCsv(`${communitySlug(community)}-shared-costs.csv`, csv);
    notify("Downloaded every bill, ready for the budget");
  }

  return (
    <>
      <PageHeader
        eyebrow="Shared costs"
        title="Bills the association passes on"
        description="What the community actually pays each provider, how it is split, and what that works out to per home. Owners see the same figures."
        action={
          shared.enabled ? (
            <Button variant="secondary" size="sm" onClick={exportTrend}>
              <Download className="size-4" />
              Export
            </Button>
          ) : undefined
        }
      />

      {shared.enabled ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="This month, all providers"
            value={money(shared.monthlyCents)}
            hint={`${money(shared.perHomeMonthlyCents)} a home`}
          />
          <Stat
            label="Last twelve months"
            value={shortMoney(shared.trailingYearCents)}
            hint="What the community paid, before dues"
          />
          <Stat
            label="Per home, per year"
            value={money(shared.rows.reduce((t, r) => t + r.perHomeYearCents, 0))}
            hint="The number an owner asks for at the annual meeting"
          />
        </div>
      ) : null}

      {shared.enabled ? (
        <div className="mt-5 space-y-4">
          {shared.rows.map((row) => {
            const Icon = ICON[row.cost.kind];
            const expanded = open === row.cost.id;
            const change = row.changeYearOverYear;
            return (
              <Card key={row.cost.id}>
                <CardHeader
                  icon={<Icon className="size-4" />}
                  title={row.cost.name}
                  subtitle={
                    <>
                      {row.cost.provider}
                      {row.cost.accountRef ? ` · ${row.cost.accountRef}` : ""}
                      {" · "}
                      {ALLOCATION_LABEL[row.cost.allocation]}
                    </>
                  }
                  action={
                    <div className="flex items-center gap-2">
                      {change === undefined ? null : (
                        <Badge tone={change > 0.1 ? "warn" : change > 0 ? "neutral" : "ok"}>
                          {change >= 0 ? "+" : ""}
                          {Math.round(change * 100)}% on last year
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpen(expanded ? null : row.cost.id)}
                      >
                        {expanded ? "Hide" : "History"}
                      </Button>
                    </div>
                  }
                />
                <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[13px] font-semibold text-fg-muted">Latest bill</p>
                    <p className="tnum mt-1 text-[20px] font-semibold text-fg">
                      {money(row.latest?.totalCents ?? 0)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                      {row.latest ? formatDate(row.latest.periodStart, "medium") : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-fg-muted">Each home</p>
                    <p className="tnum mt-1 text-[20px] font-semibold text-fg">
                      {money(row.latest?.averageShareCents ?? 0)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                      Across {row.latest?.homes ?? 0} homes
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-fg-muted">Last twelve months</p>
                    <p className="tnum mt-1 text-[20px] font-semibold text-fg">
                      {shortMoney(row.trailingYearCents)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                      {money(row.perHomeYearCents)} a home
                    </p>
                  </div>
                </div>

                {/* Collapsed by default. The summary answers the common
                    question; the history answers the argument. */}
                {expanded ? (
                  <div className="border-t border-border px-5 py-4">
                    <CostTrend
                      bills={row.bills}
                      peakCents={row.bills.reduce((m, b) => Math.max(m, b.totalCents), 0)}
                      label={row.cost.name}
                    />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}

      {assessments.enabled ? (
        <div className="mt-8 space-y-4">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">
            Special assessments
          </h2>
          {assessments.rows.map((row) => (
            <Card key={row.assessment.id}>
              <CardHeader
                icon={<HandCoins className="size-4" />}
                title={row.assessment.title}
                subtitle={`${ALLOCATION_LABEL[row.assessment.allocation]} · ${
                  row.assessment.installments
                } payments from ${formatDate(row.assessment.firstDueOn, "medium")}`}
                action={
                  <Badge tone={row.assessment.status === "complete" ? "ok" : "neutral"}>
                    {row.assessment.status === "complete" ? "Paid off" : "In progress"}
                  </Badge>
                }
              />
              <div className="px-5 py-4">
                <p className="text-[15px] leading-relaxed text-fg-muted">
                  {row.assessment.reason}
                </p>
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <p className="tnum text-[20px] font-semibold text-fg">
                    {shortMoney(row.collectedCents)}{" "}
                    <span className="text-[15px] font-normal text-fg-muted">
                      of {shortMoney(row.assessment.totalCents)}
                    </span>
                  </p>
                  <p className="tnum text-[13px] text-fg-muted">
                    {row.installmentsLeft} payments left
                  </p>
                </div>
                <Meter
                  value={row.percent}
                  tone="brand"
                  className="mt-2"
                  aria-label={`${Math.round(row.percent * 100)}% collected`}
                />
                <p className="mt-2 text-[13px] text-fg-muted">
                  About {money(row.perHomeRemainingCents)} a home still to come. A buyer&apos;s
                  lender asks for this figure by name.
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
