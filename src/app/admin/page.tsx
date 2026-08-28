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
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import {
  budgetSummary,
  cashPosition,
  delinquency,
  reserveSummary,
} from "@/lib/metrics";
import {
  useAppState,
  usePendingApprovals,
  useReconciliation,
} from "@/lib/app-state";
import { SetupPlanSummary } from "@/components/app/setup-plan";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";
import { useToast } from "@/components/app/toast";
import { daysFromToday, formatDate, money, pluralize } from "@/lib/utils";

export default function BoardDashboard() {
  const { community } = useAppState();
  // Something to run: money has moved, or somebody has asked for something.
  const running =
    community.ledger.length > 0 ||
    community.requests.length > 0 ||
    community.ballots.length > 0 ||
    community.payouts.length > 0;
  const plan = buildPlan(community, profileFromCommunity(community));
  const association = community.association;
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

  return (
    <>
      <PageHeader
        eyebrow={`${association.name} · ${pluralize(association.unitCount, "unit")}`}
        title="Dashboard"
        
        action={
          <ButtonLink href="/admin/money" variant="primary" size="md">
            Open the books
            <ArrowRight className="size-3.5" />
          </ButtonLink>
        }
      />

      {/* One line while setup is unfinished, pointing at the list, which
          lives on its own page. A to-do list living permanently on the
          dashboard is how a board learns to read past it. Gone when done. */}
      <SetupPlanSummary />

      {/* An association with no transactions, no requests and no ballots has
          nothing to run, so a dashboard of four zeroes and two empty cards
          tells them nothing and looks broken. Say so instead. */}
      {!running ? (
        <Card className="p-6">
          <p className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
            Nothing to run yet
          </p>
          <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-fg-muted">
            Once dues are billed, a payment lands, or an owner asks for something, it shows up
            here.{plan.allDone ? "" : " The list above is the way to get there."}
          </p>
        </Card>
      ) : null}

      {running ? (
        <>
      {/* The tie-out banner: the product's central promise, stated up front. */}
      <TieOutBanner
        tiesOut={recon.tiesOut}
        needsReview={recon.needsReview.length}
        lastSync={recon.lastSyncMinutes}
        duplicates={recon.duplicates.length}
        stale={recon.staleFeeds.length}
        connected={community.bankAccounts.length > 0}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Operating cash"
          value={money(cash.operating, { cents: false })}
          hint={`${pluralize(association.unitCount, "unit")} · ${money(association.duesCents, { cents: false })}/mo assessment`}
          icon={<Landmark className="size-4" />}
        />
        <Stat
          label="Set aside for reserves"
          value={money(reserve.funded, { cents: false })}
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

      {/* Two columns, two questions: what needs a decision about money, and
          what needs a decision about everything else. Anything that is
          analysis rather than a decision lives on its own tab, because a
          dashboard that shows everything is one nobody reads. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {/* Needs review */}
          <Card>
            <CardHeader
              title="Needs your review"
              
              icon={<AlertTriangle className="size-4" />}
              action={
                <Link
                  href="/admin/money"
                  className="text-[13px] font-medium text-accent hover:underline"
                >
                  Review all
                </Link>
              }
            />
            {recon.needsReview.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[15px] font-medium text-ok">Nothing left to review</p>
                <p className="mt-1 text-[13px] text-fg-muted">
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
                    <p className="truncate text-[15px] font-medium text-fg">{e.description}</p>
                    {e.duplicateOfId ? (
                      <Badge tone="danger">
                        <Copy className="size-2.5" />
                        Possible duplicate
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[13px] text-fg-muted">
                    {formatDate(e.date)} · {e.counterparty}
                    {e.suggestionConfidence
                      ? ` · suggested "${e.suggestedCategory ?? "uncategorized"}" at ${Math.round(
                          e.suggestionConfidence * 100,
                        )}% confidence`
                      : ""}
                  </p>
                </div>
                <span className="tnum text-[15px] font-semibold text-fg">
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
                    className="h-7 rounded-md border border-border-2 px-2.5 text-[13px] font-medium text-fg hover:bg-surface-2"
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
                    className="h-7 rounded-md px-2.5 text-[13px] font-medium text-fg-muted hover:bg-surface-2"
                  >
                    {e.duplicateOfId ? "Remove" : "Dismiss"}
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* What needs a decision that is not about a transaction. */}
        <div className="space-y-5 lg:col-span-2">
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
                  <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-fg">
                    {r.title}
                  </p>
                  <Badge tone={r.daysLeft <= 5 ? "warn" : "neutral"}>{r.daysLeft}d</Badge>
                </div>
                <p className="mt-0.5 truncate text-[13px] text-fg-muted">
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
              <p className="px-5 py-6 text-center text-[15px] text-fg-muted">
                Nothing waiting on a signature.
              </p>
            ) : null}
            {approvals.map((p) => (
              <div key={p.id} className="border-b border-border px-5 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[15px] font-medium text-fg">{p.vendor}</p>
                  <span className="tnum shrink-0 text-[15px] font-semibold text-fg">
                    {money(p.amountCents, { cents: false })}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-fg-muted">
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
                    className="h-7 rounded-md bg-brand px-2.5 text-[13px] font-medium text-brand-fg"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => notify(`${p.vendor} put on hold`, "warn")}
                    className="h-7 rounded-md px-2.5 text-[13px] font-medium text-fg-muted hover:bg-surface-2"
                  >
                    Hold
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
        </>
      ) : null}
    </>
  );
}

function TieOutBanner({
  tiesOut,
  needsReview,
  lastSync,
  duplicates,
  stale,
  connected,
}: {
  tiesOut: boolean;
  needsReview: number;
  lastSync: number;
  duplicates: number;
  stale: number;
  /** No bank means no feed, so there is nothing to claim was synced. */
  connected: boolean;
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
          <p className={`text-[15px] font-semibold ${tiesOut ? "text-ok" : "text-warn"}`}>
            {!connected
              ? "Connect a bank to start reconciling"
              : tiesOut
              ? "Every number matches. Nothing is waiting on you."
              : `${needsReview} ${needsReview === 1 ? "transaction is" : "transactions are"} holding the books open`}
          </p>
          <p className={`mt-1 text-[15px] leading-relaxed ${tiesOut ? "text-ok" : "text-warn"} opacity-90`}>
            {!connected
              ? "No bank account connected yet, so there is nothing to reconcile."
              : tiesOut
                ? lastSync > 0
                  ? `Bank feed synced ${pluralize(lastSync, "minute")} ago.`
                  : // A typed in account has no feed to sync. Saying it synced
                    // is the sort of small lie that costs trust when somebody
                    // checks.
                    "Nothing has come through the account yet."
                : `Feed synced ${pluralize(lastSync, "minute")} ago.${duplicates > 0 ? ` ${duplicates} looks like a duplicate charge.` : ""}${
                    stale > 0 ? ` ${stale} account feed is running behind.` : ""
                  }`}
          </p>
        </div>
        <Link
          href="/admin/money"
          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold ${
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
