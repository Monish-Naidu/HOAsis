"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Home,
  Landmark,
  Megaphone,
  Receipt,
  ShieldAlert,
  Vote,
} from "lucide-react";
import { Callout, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { moduleOn } from "@/lib/modules";
import {
  cashPosition,
  delinquency,
  insuranceExposure,
  ledgerYears,
  monthlyFlows,
  spendingByCategory,
} from "@/lib/metrics";
import { MoneyFlowChart, SpendingDonut } from "@/components/app/board-charts";
import { SectionLink, YearControl } from "@/components/app/finance-ui";
import {
  useAppState,
  usePendingApprovals,
} from "@/lib/app-state";
import { SetupPlanSummary } from "@/components/app/setup-plan";
import { ActionItems } from "@/components/app/action-items";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";
import { cn, daysFromToday, formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";
import { homeWording } from "@/lib/wording";
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
  const exposure = insuranceExposure(community);
  const showDonut = moduleOn("money-compare") && spending.rows.length > 0;

  const role =
    account && account.role !== "resident" ? ROLE_LABEL[account.role] : "Board member";

  return (
    <>
      <PageHeader
        eyebrow={`${association.name} · ${pluralize(association.unitCount, homeWording(community).home)}`}
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
          {/* The one finding on Finances that a president should not have
              to click through to see. Money above the insured limit is a
              decision, not a report. */}
          {moduleOn("deposit-insurance") && exposure.totalUninsured > 0 ? (
            <Callout
              tone="warn"
              className="mb-5"
              icon={<ShieldAlert className="size-4" />}
              title={`${money(exposure.totalUninsured, { cents: false })} sits above deposit insurance`}
              action={<SectionLink href="/board/money">See where</SectionLink>}
            >
              {exposure.rows
                .filter((row) => row.uninsured > 0)
                .map((row) => `${row.institution} holds ${money(row.balance, { cents: false })} against a ${money(row.limit, { cents: false })} limit.`)
                .join(" ")}
            </Callout>
          ) : null}

          {hasFlows || showDonut ? (
            <section>
              {/* One year control for both charts, and the way into the
                  comparison. Two dropdowns off one piece of state read as
                  two settings, and a board member changed one expecting
                  the other to stay. */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                {years.length > 1 ? (
                  <YearControl years={years} value={year} onChange={setYear} thisYear={thisYear} />
                ) : (
                  <span className="text-[13px] font-medium text-fg-muted">This year</span>
                )}
                {years.length > 1 && moduleOn("money-compare") ? (
                  <SectionLink href="/board/money/trends">Compare years</SectionLink>
                ) : null}
              </div>
              <div className="grid gap-5 xl:grid-cols-5">
                {hasFlows ? (
                  <Card className={cn(showDonut ? "xl:col-span-3" : "xl:col-span-5")}>
                    <CardHeader title="Monthly Financial Overview" />
                    <MoneyFlowChart months={flows} />
                  </Card>
                ) : null}
                {showDonut ? (
                  <Card className={cn(hasFlows ? "xl:col-span-2" : "xl:col-span-5")}>
                    <CardHeader title="Spending by Category" />
                    <SpendingDonut
                      rows={spending.rows}
                      totalCents={spending.totalCents}
                      reportHref="/board/money"
                    />
                  </Card>
                ) : null}
              </div>
            </section>
          ) : null}

          <StatTiles />

          {/* Everything resident-facing (activity, community, announcements,
              events) left this page per the huddle: the board view is
              admin-level only, and board members flip to the resident view
              for the rest. Quick Actions is what remains. */}
          <QuickActions />

          {/* The last meeting's homework. Lives here rather than only on
              Meetings because it is the thing a director should see on
              arrival, not the thing they go looking for. */}
          <ActionItems className="mt-5" />
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
  // Waiting a week is the point at which a volunteer board starts to look
  // slow to the person asking, so that is the number under the count.
  const waitingAWeek = openRequests.filter((r) => daysFromToday(r.submittedDate) <= -7);
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
        sub={
          openRequests.length === 0
            ? "Nothing waiting"
            : waitingAWeek.length > 0
              ? `${waitingAWeek.length} waiting over a week`
              : "All under a week old"
        }
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
        action={liveMeeting ? "Join meeting" : nextMeeting ? "Open meetings" : "Schedule one"}
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

/* ------------------------------------------------------------ quick actions */

const ACTIONS = [
  { href: "/board/voting", label: "New Ballot", icon: Vote, tone: "bg-ok-soft text-ok" },
  {
    href: "/board/meetings",
    label: "Schedule Meeting",
    icon: CalendarDays,
    tone: "bg-info-soft text-info",
  },
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
];

/**
 * The four actions the huddle confirmed, as one full-width bar. A two-by-two
 * list was tried beside it behind a toggle; the bar won and the toggle went
 * with the 2026-09-19 launch scope.
 */
function QuickActions() {
  return (
    <Card className="mt-5">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="min-w-0 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
          Quick Actions
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-1 p-3 sm:grid-cols-4">
        {ACTIONS.map(({ href, label, icon: Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-lg px-1 py-4 text-center transition-colors hover:bg-surface-2"
          >
            <span className={cn("flex size-11 items-center justify-center rounded-full", tone)}>
              <Icon className="size-5" strokeWidth={2} />
            </span>
            <span className="text-[13px] font-medium leading-tight text-fg-muted">{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
