"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  Inbox,
  Landmark,
  Megaphone,
  Radio,
  Receipt,
  RefreshCw,
  Users,
  Vote,
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
  cashPosition,
  delinquency,
  monthlyFlows,
  spendingByCategory,
} from "@/lib/metrics";
import { MoneyFlowChart, SpendingDonut } from "@/components/app/board-charts";
import {
  useAppState,
  usePendingApprovals,
  useReconciliation,
} from "@/lib/app-state";
import { SetupPlanSummary } from "@/components/app/setup-plan";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";
import { useToast } from "@/components/app/toast";
import { cn, daysFromToday, formatDate, money, pluralize } from "@/lib/utils";
import type { Capability } from "@/lib/types";

export default function BoardDashboard() {
  const { community, can, requests } = useAppState();
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
  const clocks = requests
    .filter((r) => r.dueDate && !["approved", "denied", "closed"].includes(r.status))
    .map((r) => ({ ...r, daysLeft: daysFromToday(r.dueDate!) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const delinq = delinquency(community);
  const flows = monthlyFlows(community);
  const spending = spendingByCategory(community);

  const openRequests = requests.filter(
    (r) => !["approved", "denied", "closed"].includes(r.status),
  );
  const liveMeeting = community.meetings.find((m) => m.status === "live");
  const nextMeeting =
    liveMeeting ??
    [...community.meetings]
      .filter((m) => m.status === "scheduled" && daysFromToday(m.date) >= 0)
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const approvalsCents = approvals.reduce((t, p) => t + p.amountCents, 0);

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

          {/* The year at a glance: what moved, and where the spending went.
              Both cards draw from the same ledger the Money tab reconciles,
              so the picture and the books cannot disagree. */}
          {flows.length > 0 || spending.rows.length > 0 ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-5">
              {flows.length > 0 ? (
                <Card className={cn(spending.rows.length > 0 ? "xl:col-span-3" : "xl:col-span-5")}>
                  <CardHeader
                    title="Money in, money out"
                    subtitle="By month. Transfers between the association's own accounts don't count."
                    action={
                      <Link
                        href="/admin/money"
                        className="text-[13px] font-medium text-accent hover:underline"
                      >
                        Open the books
                      </Link>
                    }
                  />
                  <MoneyFlowChart months={flows} />
                </Card>
              ) : null}
              {spending.rows.length > 0 ? (
                <Card className={cn(flows.length > 0 ? "xl:col-span-2" : "xl:col-span-5")}>
                  <CardHeader
                    title="Spending by category"
                    subtitle="Largest first. Everything past four folds into Other."
                  />
                  <SpendingDonut rows={spending.rows} totalCents={spending.totalCents} />
                </Card>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="In the bank"
              value={money(cash.total, { cents: false })}
              hint={`${money(cash.operating, { cents: false })} operating · ${money(cash.reserve, { cents: false })} reserves`}
              icon={<Landmark className="size-4" />}
              href="/admin/money"
            />
            <Stat
              label="Past due"
              value={money(delinq.totalCents, { cents: false })}
              tone={delinq.totalCents > 0 ? "warn" : "ok"}
              hint={`${pluralize(delinq.past.length, "home")} behind · ${Math.round(delinq.collectionRate * 100)}% current`}
              icon={<Users className="size-4" />}
              href="/admin/homeowners"
            />
            <Stat
              label="Open requests"
              value={openRequests.length}
              hint={
                clocks.length > 0
                  ? `Nearest clock runs out in ${pluralize(Math.max(0, clocks[0].daysLeft), "day")}`
                  : "Nothing on a deadline"
              }
              icon={<Inbox className="size-4" />}
              href="/admin/requests"
            />
            <Stat
              label="Next meeting"
              value={
                liveMeeting
                  ? "Live now"
                  : nextMeeting
                    ? formatDate(nextMeeting.date)
                    : "None set"
              }
              tone={liveMeeting ? "ok" : "neutral"}
              hint={
                nextMeeting
                  ? `${nextMeeting.title} · ${nextMeeting.time}`
                  : "Schedule one from Voting"
              }
              icon={<CalendarDays className="size-4" />}
              href="/admin/voting"
            />
            <Stat
              label="Invoices to approve"
              value={approvals.length}
              tone={approvals.length > 0 ? "warn" : "neutral"}
              hint={
                approvals.length > 0
                  ? `${money(approvalsCents, { cents: false })} waiting on a signature`
                  : "Nothing waiting on a signature"
              }
              icon={<Receipt className="size-4" />}
              href="/admin/vendors"
            />
          </div>

          {/* Two columns, two questions: what needs a decision about money, and
              what needs a decision about everything else. Anything that is
              analysis rather than a decision lives on its own tab. */}
          <div className="mt-5 grid gap-5 lg:grid-cols-5">
            <div className="space-y-5 lg:col-span-3">
              <NeedsReview />
              <RecentActivity />
            </div>

            {/* What needs a decision that is not about a transaction. */}
            <div className="space-y-5 lg:col-span-2">
              {clocks.length > 0 ? (
                <Card>
                  <CardHeader title="On the clock" icon={<Clock className="size-4" />} />
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
              ) : null}

              <Approvals />
              <UpcomingCard />
              <QuickActions can={can} />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ review */

function NeedsReview() {
  const recon = useReconciliation();
  const { confirmLedgerEntry, dismissLedgerEntry } = useAppState();
  const { notify } = useToast();

  return (
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
  );
}

/* --------------------------------------------------------------- approvals */

function Approvals() {
  const approvals = usePendingApprovals();
  const { approvePayout } = useAppState();
  const { notify } = useToast();

  return (
    <Card>
      <CardHeader title="Waiting on you" icon={<RefreshCw className="size-4" />} />
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
  );
}

/* ---------------------------------------------------------------- activity */

interface ActivityRow {
  id: string;
  date: string;
  title: string;
  detail: string;
  href: string;
  icon: typeof CircleDollarSign;
  tone: string;
  amountCents?: number;
}

/**
 * What just happened, across the whole association, newest first.
 *
 * Merged from the records themselves rather than kept as its own feed, so
 * nothing here can be stale: a payment appears because it is in the ledger,
 * a request because it was filed.
 */
function RecentActivity() {
  const { community, requests } = useAppState();

  const rows: ActivityRow[] = [];
  const ledger = [...community.ledger].sort((a, b) => (a.date < b.date ? 1 : -1));
  const recentRequests = [...requests].sort((a, b) =>
    a.submittedDate < b.submittedDate ? 1 : -1,
  );
  const announcements = [...community.announcements].sort((a, b) =>
    a.postedDate < b.postedDate ? 1 : -1,
  );
  for (const e of ledger.slice(0, 8)) {
    rows.push({
      id: `led-${e.id}`,
      date: e.date,
      title: e.description,
      detail: `${e.category} · ${e.counterparty}`,
      href: "/admin/money",
      icon: e.amountCents >= 0 ? CircleDollarSign : Receipt,
      tone: e.amountCents >= 0 ? "bg-ok-soft text-ok" : "bg-surface-3 text-fg-muted",
      amountCents: e.amountCents,
    });
  }
  for (const r of recentRequests.slice(0, 6)) {
    rows.push({
      id: `req-${r.id}`,
      date: r.submittedDate,
      title: r.title,
      detail: `${r.kind} request${r.unit ? ` · Unit ${r.unit}` : ""}`,
      href: "/admin/requests",
      icon: ClipboardCheck,
      tone: "bg-info-soft text-info",
    });
  }
  for (const a of announcements.slice(0, 2)) {
    rows.push({
      id: `ann-${a.id}`,
      date: a.postedDate,
      title: a.title,
      detail: `Announcement · ${a.author}`,
      href: "/admin/communications",
      icon: Megaphone,
      tone: "bg-brand-soft text-brand-soft-fg",
    });
  }
  const feed = rows.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  if (feed.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Recent activity" icon={<Radio className="size-4" />} />
      {feed.map(({ icon: Icon, ...row }) => (
        <Link
          key={row.id}
          href={row.href}
          className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-b-0 hover:bg-surface-2"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              row.tone,
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-fg">{row.title}</span>
            <span className="block truncate text-[13px] text-fg-muted">
              {formatDate(row.date)} · {row.detail}
            </span>
          </span>
          {row.amountCents !== undefined ? (
            <span
              className={cn(
                "tnum shrink-0 text-[15px] font-semibold",
                row.amountCents >= 0 ? "text-ok" : "text-fg",
              )}
            >
              {money(row.amountCents, { sign: true })}
            </span>
          ) : null}
        </Link>
      ))}
    </Card>
  );
}

/* ---------------------------------------------------------------- upcoming */

function UpcomingCard() {
  const { community } = useAppState();
  const rows: { id: string; date: string; title: string; detail: string }[] = [];
  for (const m of community.meetings) {
    if (m.status === "ended" || daysFromToday(m.date) < 0) continue;
    rows.push({
      id: m.id,
      date: m.date,
      title: m.title,
      detail: m.status === "live" ? "Live now" : `${m.time} · ${m.location}`,
    });
  }
  for (const b of community.ballots) {
    if (b.audience !== "owners") continue;
    if (b.status === "open" && daysFromToday(b.closesDate) >= 0) {
      rows.push({
        id: `${b.id}-close`,
        date: b.closesDate,
        title: b.title,
        detail: "Last day to vote",
      });
    }
  }
  const upcoming = rows.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 4);
  if (upcoming.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Meetings and events" icon={<CalendarDays className="size-4" />} />
      {upcoming.map((row) => (
        <Link
          key={row.id}
          href="/admin/voting"
          className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-b-0 hover:bg-surface-2"
        >
          <span className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-border bg-surface-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle">
              {formatDate(row.date).split(" ")[0]}
            </span>
            <span className="tnum text-[15px] font-semibold leading-tight text-fg">
              {row.date.slice(8, 10).replace(/^0/, "")}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-fg">{row.title}</span>
            <span className="block truncate text-[13px] text-fg-muted">{row.detail}</span>
          </span>
        </Link>
      ))}
    </Card>
  );
}

/* ------------------------------------------------------------ quick actions */

const ACTIONS: {
  href: string;
  label: string;
  icon: typeof Vote;
  tone: string;
  need?: Capability;
}[] = [
  { href: "/admin/voting", label: "New ballot", icon: Vote, tone: "bg-ok-soft text-ok", need: "voting" },
  {
    href: "/admin/communications",
    label: "Announce",
    icon: Megaphone,
    tone: "bg-warn-soft text-warn",
    need: "communications",
  },
  { href: "/admin/requests", label: "Requests", icon: Inbox, tone: "bg-info-soft text-info", need: "requests" },
  {
    href: "/admin/homeowners",
    label: "Homeowners",
    icon: Users,
    tone: "bg-brand-soft text-brand-soft-fg",
    need: "finances",
  },
  {
    href: "/admin/vendors",
    label: "Invoices",
    icon: Receipt,
    tone: "bg-danger-soft text-danger",
    need: "vendors",
  },
  {
    href: "/admin/documents",
    label: "Documents",
    icon: FileText,
    tone: "bg-surface-3 text-fg-muted",
    need: "documents",
  },
];

function QuickActions({ can }: { can: (c: Capability) => boolean }) {
  const actions = ACTIONS.filter((a) => !a.need || can(a.need));
  if (actions.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Quick actions" />
      <div className="grid grid-cols-3 gap-1 p-3">
        {actions.map(({ href, label, icon: Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-center transition-colors hover:bg-surface-2"
          >
            <span className={cn("flex size-9 items-center justify-center rounded-full", tone)}>
              <Icon className="size-4" strokeWidth={2} />
            </span>
            <span className="text-[12px] font-medium text-fg-muted">{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- banner */

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
