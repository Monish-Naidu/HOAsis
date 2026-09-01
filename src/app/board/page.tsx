"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Gavel,
  Home,
  Landmark,
  Megaphone,
  MessageSquareText,
  Receipt,
  Users,
  Video,
  Vote,
} from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import {
  cashPosition,
  delinquency,
  ledgerYears,
  monthlyFlows,
  spendingByCategory,
} from "@/lib/metrics";
import { MoneyFlowChart, SpendingDonut } from "@/components/app/board-charts";
import {
  useAppState,
  usePendingApprovals,
  useVisiblePosts,
} from "@/lib/app-state";
import { SetupPlanSummary } from "@/components/app/setup-plan";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";
import { cn, daysFromToday, formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";
import type { BoardRole } from "@/lib/types";

/**
 * The board dashboard, laid out to the 2026-09-01 design almost exactly
 * (docs/design/dash-2026-09-01). Where a card in the design had nothing real
 * behind it, the nearest true thing stands in: Community Updates shows the
 * forum, not a synthesized safety feed. Reconciliation work lives on
 * Finances, approvals on Vendors, both one click away through their tiles.
 */

const ROLE_LABEL: Record<BoardRole, string> = {
  president: "Board President",
  "vice-president": "Vice President",
  treasurer: "Treasurer",
  secretary: "Secretary",
};

export default function BoardDashboard() {
  const { community, account } = useAppState();
  // Something to run: money has moved, or somebody has asked for something.
  const running =
    community.ledger.length > 0 ||
    community.requests.length > 0 ||
    community.ballots.length > 0 ||
    community.payouts.length > 0;
  const plan = buildPlan(community, profileFromCommunity(community));
  const association = community.association;

  const years = ledgerYears(community);
  const thisYear = Number(todayIsoDate().slice(0, 4));
  const [year, setYear] = useState(years[0] ?? thisYear);
  const flows = monthlyFlows(community, year);
  const spending = spendingByCategory(community, year);
  const hasFlows = flows.some((m) => m.inCents > 0 || m.outCents > 0);

  const role =
    account && account.role !== "resident" ? ROLE_LABEL[account.role] : "Board member";

  const yearSelect =
    years.length > 1 ? (
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        aria-label="Year"
        className="h-8 rounded-lg border border-border-2 bg-surface px-2 text-[13px] font-medium text-fg"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y === thisYear ? "This Year" : y}
          </option>
        ))}
      </select>
    ) : (
      <span className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-[13px] font-medium text-fg-muted">
        This Year
      </span>
    );

  return (
    <>
      <PageHeader
        eyebrow={`${association.name} · ${pluralize(association.unitCount, "unit")}`}
        title="Board Dashboard"
        description={role}
      />

      {/* One line while setup is unfinished, pointing at the list, which
          lives on its own page. A to-do list living permanently on the
          dashboard is how a board learns to read past it. Gone when done. */}
      <SetupPlanSummary />

      {/* An association with no transactions, no requests and no ballots has
          nothing to run, so a dashboard of zeroes and empty cards tells them
          nothing and looks broken. Say so instead. */}
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
          {hasFlows || spending.rows.length > 0 ? (
            <div className="grid gap-5 xl:grid-cols-5">
              {hasFlows ? (
                <Card className={cn(spending.rows.length > 0 ? "xl:col-span-3" : "xl:col-span-5")}>
                  <CardHeader title="Monthly Financial Overview" action={yearSelect} />
                  <MoneyFlowChart months={flows} />
                </Card>
              ) : null}
              {spending.rows.length > 0 ? (
                <Card className={cn(hasFlows ? "xl:col-span-2" : "xl:col-span-5")}>
                  <CardHeader title="Spending by Category" action={yearSelect} />
                  <SpendingDonut
                    rows={spending.rows}
                    totalCents={spending.totalCents}
                    reportHref="/board/money"
                  />
                </Card>
              ) : null}
            </div>
          ) : null}

          <StatTiles />

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <RecentActivity />
            <CommunityUpdates />
            <Announcements />
            <UpcomingEvents />
            <QuickActions />
          </div>
        </>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------- tiles */

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  valueTone,
  sub,
  href,
  action,
}: {
  icon: typeof Landmark;
  tone: string;
  label: string;
  value: string;
  valueTone?: "ok" | "warn";
  sub?: string;
  href: string;
  action: string;
}) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <span
        className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tone)}
      >
        <Icon className="size-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-fg-muted">{label}</p>
        <p
          className={cn(
            "tnum mt-1 truncate text-[22px] font-semibold leading-none tracking-[-0.02em]",
            valueTone === "ok" ? "text-ok" : valueTone === "warn" ? "text-warn" : "text-fg",
          )}
        >
          {value}
        </p>
        {sub ? <p className="mt-1 truncate text-[13px] text-fg-muted">{sub}</p> : null}
        <Link
          href={href}
          className="mt-1.5 inline-flex items-center gap-0.5 text-[13px] font-semibold text-accent hover:underline"
        >
          {action}
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}

function StatTiles() {
  const { community, requests } = useAppState();
  const approvals = usePendingApprovals();
  const cash = cashPosition(community);
  const delinq = delinquency(community);
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
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatTile
        icon={Landmark}
        tone="bg-info-soft text-info"
        label="Total in Account"
        value={money(cash.operating)}
        sub="Operating account"
        href="/board/money"
        action="View financials"
      />
      <StatTile
        icon={Home}
        tone="bg-warn-soft text-warn"
        label="Past Due Homes"
        value={String(delinq.past.length)}
        valueTone={delinq.past.length > 0 ? "warn" : undefined}
        sub={money(delinq.totalCents)}
        href="/board/homeowners"
        action="View details"
      />
      <StatTile
        icon={ClipboardCheck}
        tone="bg-brand-soft text-brand-soft-fg"
        label="Open Requests"
        value={String(openRequests.length)}
        sub={`${pluralize(community.violations.filter((v) => v.stage !== "cured").length, "open violation")}`}
        href="/board/requests"
        action="View requests"
      />
      <StatTile
        icon={CalendarDays}
        tone="bg-ok-soft text-ok"
        label="Next Board Meeting"
        value={
          liveMeeting
            ? "Live now"
            : nextMeeting
              ? daysFromToday(nextMeeting.date) === 0
                ? "Tonight"
                : formatDate(nextMeeting.date)
              : "None set"
        }
        valueTone={liveMeeting ? "ok" : undefined}
        sub={
          nextMeeting
            ? `${formatDate(nextMeeting.date)} · ${nextMeeting.time}`
            : "Schedule one from Meetings"
        }
        href="/board/meetings"
        action="Join meeting"
      />
      <StatTile
        icon={Receipt}
        tone="bg-warn-soft text-warn"
        label="Invoices Awaiting Approval"
        value={String(approvals.length)}
        sub={approvals.length > 0 ? money(approvalsCents) : "Nothing waiting"}
        href="/board/vendors"
        action="Review invoices"
      />
    </div>
  );
}

/* ------------------------------------------------------------ bottom cards */

function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 text-[13px] font-medium text-accent hover:underline"
    >
      View all
    </Link>
  );
}

/** The five bottom cards are narrow; the shared CardHeader's 17px truncates. */
function DenseHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
      <h2 className="min-w-0 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
        {title}
      </h2>
      {action}
    </div>
  );
}

interface FeedRow {
  id: string;
  date: string;
  title: string;
  detail?: string;
  href: string;
  icon: typeof CircleDollarSign;
  tone: string;
  amountCents?: number;
}

function FeedList({ rows }: { rows: FeedRow[] }) {
  return (
    <>
      {rows.map(({ icon: Icon, ...row }) => (
        <Link
          key={row.id}
          href={row.href}
          className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-2"
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
            <span className="block truncate text-[14px] font-medium leading-snug text-fg">
              {row.title}
            </span>
            <span className="block truncate text-[12px] text-fg-muted">
              {formatDate(row.date)}
              {row.detail ? ` · ${row.detail}` : ""}
            </span>
          </span>
          {row.amountCents !== undefined ? (
            <span
              className={cn(
                "tnum shrink-0 text-[13px] font-semibold",
                row.amountCents >= 0 ? "text-ok" : "text-fg",
              )}
            >
              {money(row.amountCents, { sign: true })}
            </span>
          ) : null}
        </Link>
      ))}
    </>
  );
}

/**
 * What just happened, across the association, newest first. Merged from the
 * records themselves rather than kept as its own feed, so nothing here can be
 * stale: a payment appears because it is in the ledger, a request because it
 * was filed, a violation because a notice went out.
 */
function RecentActivity() {
  const { community, requests } = useAppState();

  const rows: FeedRow[] = [];
  const ledger = [...community.ledger].sort((a, b) => (a.date < b.date ? 1 : -1));
  const payment = ledger.find((e) => e.amountCents > 0 && e.category === "Assessments");
  if (payment) {
    rows.push({
      id: `led-${payment.id}`,
      date: payment.date,
      title: "Payment received",
      detail: payment.description,
      href: "/board/money",
      icon: CircleDollarSign,
      tone: "bg-ok-soft text-ok",
      amountCents: payment.amountCents,
    });
  }
  const request = [...requests].sort((a, b) =>
    a.submittedDate < b.submittedDate ? 1 : -1,
  )[0];
  if (request) {
    rows.push({
      id: `req-${request.id}`,
      date: request.submittedDate,
      title: `${request.kind === "architectural" ? "ARC" : "New"} request submitted`,
      detail: `Unit ${request.unit} · ${request.title}`,
      href: "/board/requests",
      icon: ClipboardCheck,
      tone: "bg-info-soft text-info",
    });
  }
  const violation = [...community.violations].sort((a, b) =>
    a.openedDate < b.openedDate ? 1 : -1,
  )[0];
  if (violation) {
    rows.push({
      id: `vio-${violation.id}`,
      date: violation.openedDate,
      title: "Violation updated",
      detail: `Unit ${violation.unit} · ${violation.rule}`,
      href: "/board/violations",
      icon: Gavel,
      tone: "bg-brand-soft text-brand-soft-fg",
    });
  }
  const invoice = [...community.payouts].sort((a, b) =>
    a.issuedDate < b.issuedDate ? 1 : -1,
  )[0];
  if (invoice) {
    rows.push({
      id: `pay-${invoice.id}`,
      date: invoice.issuedDate,
      title: "Vendor invoice received",
      detail: `${invoice.vendor} · ${invoice.invoiceNumber}`,
      href: "/board/vendors",
      icon: FileText,
      tone: "bg-ok-soft text-ok",
    });
  }
  const feed = rows.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);
  if (feed.length === 0) return null;

  return (
    <Card>
      <DenseHeader title="Recent Activity" action={<ViewAll href="/board/money" />} />
      <FeedList rows={feed} />
    </Card>
  );
}

/**
 * The design's Community Updates card, carried by the one record that is
 * actually the community talking: the forum. A synthesized safety feed would
 * be an invention.
 */
function CommunityUpdates() {
  const posts = useVisiblePosts();
  const recent = [...posts].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 3);
  if (recent.length === 0) return null;

  return (
    <Card>
      <DenseHeader title="Community Updates" action={<ViewAll href="/board/forum" />} />
      {recent.map((p) => (
        <Link
          key={p.id}
          href="/board/forum"
          className="flex items-start gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-2"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
            <MessageSquareText className="size-4" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium leading-snug text-fg">
              {p.title}
            </span>
            <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-fg-muted">
              {p.body}
            </span>
            <span className="mt-0.5 block text-[12px] text-fg-subtle">{formatDate(p.at)}</span>
          </span>
        </Link>
      ))}
    </Card>
  );
}

function Announcements() {
  const { community } = useAppState();
  const recent = [...community.announcements]
    .sort((a, b) => (a.postedDate < b.postedDate ? 1 : -1))
    .slice(0, 3);
  if (recent.length === 0) return null;

  return (
    <Card>
      <DenseHeader title="Announcements" action={<ViewAll href="/board/communications" />} />
      {recent.map((a) => (
        <Link
          key={a.id}
          href="/board/communications"
          className="flex items-start gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-2"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
            <Megaphone className="size-4" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium leading-snug text-fg">
              {a.title}
            </span>
            <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-fg-muted">
              {a.body}
            </span>
            <span className="mt-0.5 block text-[12px] text-fg-subtle">
              {formatDate(a.postedDate)}
            </span>
          </span>
        </Link>
      ))}
    </Card>
  );
}

function UpcomingEvents() {
  const { community } = useAppState();
  const rows: { id: string; date: string; title: string; detail: string; live?: boolean }[] = [];
  for (const m of community.meetings) {
    if (m.status === "ended" || daysFromToday(m.date) < 0) continue;
    rows.push({
      id: m.id,
      date: m.date,
      title: m.title,
      detail: m.status === "live" ? "Live now" : `${m.time} · ${m.location}`,
      live: m.status === "live",
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
      <DenseHeader title="Upcoming Meetings & Events" action={<ViewAll href="/board/meetings" />} />
      {upcoming.map((row) => (
        <Link
          key={row.id}
          href="/board/meetings"
          className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-2"
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
            <span className="block truncate text-[14px] font-medium leading-snug text-fg">
              {row.title}
            </span>
            <span className="block truncate text-[12px] text-fg-muted">{row.detail}</span>
          </span>
          {row.live ? (
            <span className="shrink-0 rounded-md bg-ok-soft px-1.5 py-0.5 text-[11px] font-bold text-ok">
              Live
            </span>
          ) : daysFromToday(row.date) === 0 ? (
            <span className="shrink-0 rounded-md bg-info-soft px-1.5 py-0.5 text-[11px] font-bold text-info">
              Tonight!
            </span>
          ) : null}
        </Link>
      ))}
    </Card>
  );
}

/* ------------------------------------------------------------ quick actions */

const ACTIONS = [
  { href: "/board/voting", label: "Create Vote", icon: Vote, tone: "bg-ok-soft text-ok" },
  { href: "/board/meetings", label: "Join Meeting", icon: Video, tone: "bg-info-soft text-info" },
  {
    href: "/board/requests",
    label: "Review Requests",
    icon: ClipboardCheck,
    tone: "bg-brand-soft text-brand-soft-fg",
  },
  {
    href: "/board/communications",
    label: "Send Announcement",
    icon: Megaphone,
    tone: "bg-warn-soft text-warn",
  },
  {
    href: "/board/vendors",
    label: "Review Invoices",
    icon: Receipt,
    tone: "bg-danger-soft text-danger",
  },
  {
    href: "/board/communications",
    label: "Message Owners",
    icon: Users,
    tone: "bg-info-soft text-info",
  },
];

function QuickActions() {
  return (
    <Card>
      <DenseHeader title="Quick Actions" />
      <div className="grid grid-cols-3 gap-1 p-3 xl:grid-cols-2">
        {ACTIONS.map(({ href, label, icon: Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-lg px-1 py-3 text-center transition-colors hover:bg-surface-2"
          >
            <span className={cn("flex size-10 items-center justify-center rounded-full", tone)}>
              <Icon className="size-[18px]" strokeWidth={2} />
            </span>
            <span className="text-[12px] font-medium leading-tight text-fg-muted">{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
