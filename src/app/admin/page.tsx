"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Landmark,
  PiggyBank,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  Meter,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import {
  budgetSummary,
  cashPosition,
  complianceSummary,
  delinquency,
  reserveSummary,
} from "@/lib/metrics";
import {
  useAppState,
  usePendingApprovals,
  useReconciliation,
} from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { daysFromToday } from "@/lib/utils";
import { formatDate, money, relativeDays, shortMoney } from "@/lib/utils";

export default function BoardDashboard() {
  const { community } = useAppState();
  const association = community.association;
  const bankAccounts = community.bankAccounts;
  const cash = cashPosition(community);
  const recon = useReconciliation();
  const approvals = usePendingApprovals();
  const { requests, confirmLedgerEntry, dismissLedgerEntry, approvePayout } = useAppState();
  const { notify } = useToast();
  const clocks = requests
    .filter((r) => r.dueDate && !["approved", "denied", "closed"].includes(r.status))
    .map((r) => ({ ...r, daysLeft: daysFromToday(r.dueDate!) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const delinq = delinquency(community);
  const bud = budgetSummary(community);
  const reserve = reserveSummary(community);
  const comp = complianceSummary(community);

  return (
    <>
      <PageHeader
        eyebrow={`${association.name} · ${association.unitCount} units`}
        title="Dashboard"
        
        action={
          <ButtonLink href="/admin/money" variant="primary" size="md">
            Open the books
            <ArrowRight className="size-3.5" />
          </ButtonLink>
        }
      />

      {/* The tie-out banner: the product's central promise, stated up front. */}
      <TieOutBanner
        tiesOut={recon.tiesOut}
        needsReview={recon.needsReview.length}
        lastSync={recon.lastSyncMinutes}
        duplicates={recon.duplicates.length}
        stale={recon.staleFeeds.length}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Operating cash"
          value={money(cash.operating, { cents: false })}
          hint={`${association.unitCount} units · ${money(association.duesCents, { cents: false })}/mo assessment`}
          icon={<Landmark className="size-4" />}
        />
        <Stat
          label="Reserves"
          value={money(cash.reserve, { cents: false })}
          tone={reserve.hasStudy ? "neutral" : "warn"}
          hint={
            reserve.hasStudy
              ? `${Math.round(reserve.percentFunded * 100)}% funded against the study`
              : "No reserve study, so this is unmeasured"
          }
          icon={<PiggyBank className="size-4" />}
        />
        <Stat
          label="Past due"
          value={money(delinq.totalCents, { cents: false })}
          tone={delinq.totalCents > 0 ? "warn" : "ok"}
          hint={`${delinq.past.length} of ${association.unitCount} accounts · ${Math.round(delinq.collectionRate * 100)}% current`}
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Net YTD"
          value={money(bud.netYtd, { cents: false })}
          tone={bud.netYtd >= 0 ? "ok" : "danger"}
          hint={`${Math.round(bud.yearElapsed * 100)}% of the fiscal year elapsed`}
          icon={<TrendingUp className="size-4" />}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Needs review */}
          <Card>
            <CardHeader
              title="Needs your review"
              
              icon={<AlertTriangle className="size-4" />}
              action={
                <Link
                  href="/admin/money"
                  className="text-[12px] font-medium text-accent hover:underline"
                >
                  Review all
                </Link>
              }
            />
            {recon.needsReview.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] font-medium text-ok">Nothing left to review</p>
                <p className="mt-1 text-[12px] text-fg-muted">
                  Every transaction is cleared, so every report agrees.
                </p>
              </div>
            ) : null}
            {recon.needsReview.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-medium text-fg">{e.description}</p>
                    {e.duplicateOfId ? (
                      <Badge tone="danger">
                        <Copy className="size-2.5" />
                        Possible duplicate
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    {formatDate(e.date)} · {e.counterparty}
                    {e.suggestionConfidence
                      ? ` · suggested "${e.suggestedCategory ?? "uncategorized"}" at ${Math.round(
                          e.suggestionConfidence * 100,
                        )}% confidence`
                      : ""}
                  </p>
                </div>
                <span className="tnum text-[13px] font-semibold text-fg">
                  {money(e.amountCents)}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const undo = confirmLedgerEntry(e.id);
                      notify(`Confirmed ${e.description}`, "ok", {
                        label: "Undo",
                        onClick: undo,
                      });
                    }}
                    className="h-7 rounded-md border border-border-2 px-2.5 text-[12px] font-medium text-fg hover:bg-surface-2"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const undo = dismissLedgerEntry(e.id);
                      notify(
                        e.duplicateOfId
                          ? "Duplicate removed from the ledger"
                          : "Transaction dismissed",
                        "warn",
                        { label: "Undo", onClick: undo },
                      );
                    }}
                    className="h-7 rounded-md px-2.5 text-[12px] font-medium text-fg-muted hover:bg-surface-2"
                  >
                    {e.duplicateOfId ? "Remove" : "Dismiss"}
                  </button>
                </div>
              </div>
            ))}
          </Card>

          {/* Budget vs actual */}
          <Card>
            <CardHeader
              title="Budget vs. actual"
              subtitle={`Fiscal year 2026 · ${Math.round(bud.yearElapsed * 100)}% elapsed`}
              icon={<TrendingUp className="size-4" />}
            />
            <div className="px-5 py-4">
              <div className="space-y-3.5">
                {bud.expense.map((line) => {
                  const pace = line.ytdActualCents / line.annualCents;
                  const over = pace > bud.yearElapsed + 0.06;
                  return (
                    <div key={line.category}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13px] text-fg">{line.category}</span>
                        <span className="tnum shrink-0 text-[12px] text-fg-muted">
                          {shortMoney(line.ytdActualCents)}
                          <span className="text-fg-subtle"> / {shortMoney(line.annualCents)}</span>
                        </span>
                      </div>
                      <div className="relative">
                        <Meter
                          value={pace}
                          tone={over ? "warn" : "brand"}
                          aria-label={`${line.category}: ${Math.round(pace * 100)}% of annual budget spent`}
                        />
                        {/* Where spending "should" be today */}
                        <span
                          className="absolute -top-0.5 h-2.5 w-px bg-fg-subtle"
                          style={{ left: `${bud.yearElapsed * 100}%` }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[11px] text-fg-subtle">
                <span className="inline-block h-2.5 w-px bg-fg-subtle" />
                Tick marks today.
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Compliance */}
          <Card>
            <CardHeader
              title="Compliance"
              subtitle={`${comp.compliant.length} of ${comp.compliant.length + comp.openCount} obligations clear`}
              icon={<CheckCircle2 className="size-4" />}
            />
            <div className="px-5 py-4">
              <Meter value={comp.score} tone={comp.overdue.length ? "warn" : "ok"} />
              <p className="mt-2 text-[12px] text-fg-muted">
                {comp.overdue.length
                  ? `${comp.overdue.length} overdue · ${comp.dueSoon.length} due soon`
                  : `${comp.dueSoon.length} due soon`}
              </p>
            </div>
            {[...comp.overdue, ...comp.dueSoon].slice(0, 3).map((item) => (
              <Link
                key={item.id}
                href="/admin/compliance"
                className="block border-t border-border px-5 py-3 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium leading-snug text-fg">{item.title}</p>
                  <Badge tone={item.status === "overdue" ? "danger" : "warn"}>
                    {item.dueDate ? relativeDays(item.dueDate) : item.status}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-fg-muted">{item.citation}</p>
              </Link>
            ))}
            <Link
              href="/admin/compliance"
              className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[12px] font-medium text-accent hover:bg-surface-2"
            >
              Full register
              <ArrowRight className="size-3.5" />
            </Link>
          </Card>

          {/* Clocks */}
          <Card>
            <CardHeader
              title="On the clock"
              
              icon={<Clock className="size-4" />}
            />
            {clocks.map((r) => (
              <Link
                key={r.id}
                href="/admin/requests"
                className="block border-b border-border px-5 py-3 last:border-b-0 hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                    {r.title}
                  </p>
                  <Badge tone={r.daysLeft <= 5 ? "warn" : "neutral"}>{r.daysLeft}d</Badge>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-fg-muted">
                  {r.unit ? `Unit ${r.unit} · ` : ""}
                  {r.dueReason}
                </p>
              </Link>
            ))}
          </Card>

          {/* Approvals */}
          <Card>
            <CardHeader
              title="Waiting on you"
              
              icon={<RefreshCw className="size-4" />}
            />
            {approvals.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-fg-muted">
                Nothing waiting on a signature.
              </p>
            ) : null}
            {approvals.map((p) => (
              <div key={p.id} className="border-b border-border px-5 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[13px] font-medium text-fg">{p.vendor}</p>
                  <span className="tnum shrink-0 text-[13px] font-semibold text-fg">
                    {money(p.amountCents, { cents: false })}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-fg-muted">
                  {p.invoiceNumber} · {p.approvals.length} of {p.approvalsRequired} approvals ·{" "}
                  {p.method === "ach" ? "ACH, lands in 2 days" : "check"}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      approvePayout(p.id);
                      notify(`Approved ${p.vendor}`);
                    }}
                    className="h-7 rounded-md bg-brand px-2.5 text-[12px] font-medium text-brand-fg"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => notify(`${p.vendor} put on hold`, "warn")}
                    className="h-7 rounded-md px-2.5 text-[12px] font-medium text-fg-muted hover:bg-surface-2"
                  >
                    Hold
                  </button>
                </div>
              </div>
            ))}
          </Card>

          {/* Accounts */}
          <Card>
            <CardHeader title="Accounts" />
            {bankAccounts.map((a) => (
              <div key={a.id} className="border-b border-border px-5 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg">{a.name}</p>
                    <p className="truncate text-[11px] text-fg-muted">
                      {a.institution} ••{a.mask}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-[13px] font-semibold text-fg">
                      {money(a.balanceCents, { cents: false })}
                    </p>
                    <p
                      className={`text-[10px] font-medium ${
                        a.status === "live" ? "text-ok" : "text-warn"
                      }`}
                    >
                      {a.status === "live"
                        ? `synced ${a.syncedMinutesAgo}m ago`
                        : `${Math.round(a.syncedMinutesAgo / 60)}h stale`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}

function TieOutBanner({
  tiesOut,
  needsReview,
  lastSync,
  duplicates,
  stale,
}: {
  tiesOut: boolean;
  needsReview: number;
  lastSync: number;
  duplicates: number;
  stale: number;
}) {
  return (
    <div
      className={`rounded-card border p-4 ${
        tiesOut ? "border-ok/25 bg-ok-soft" : "border-warn/30 bg-warn-soft"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${tiesOut ? "text-ok" : "text-warn"}`}>
          {tiesOut ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] font-semibold ${tiesOut ? "text-ok" : "text-warn"}`}>
            {tiesOut
              ? "Books tie out. Every report agrees."
              : `${needsReview} ${needsReview === 1 ? "transaction is" : "transactions are"} holding the books open`}
          </p>
          <p className={`mt-1 text-[13px] leading-relaxed ${tiesOut ? "text-ok" : "text-warn"} opacity-90`}>
            {tiesOut
              ? `Bank feed synced ${lastSync} minutes ago.`
              : `Feed synced ${lastSync} minutes ago.${duplicates > 0 ? ` ${duplicates} looks like a duplicate charge.` : ""}${
                  stale > 0 ? ` ${stale} account feed is running behind.` : ""
                }`}
          </p>
        </div>
        <Link
          href="/admin/money"
          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold ${
            tiesOut ? "bg-ok text-white" : "bg-warn text-white"
          }`}
        >
          Reconcile
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
