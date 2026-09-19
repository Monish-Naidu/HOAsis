"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Home,
  Landmark,
  ListChecks,
  Megaphone,
  Percent,
  Receipt,
  ShieldAlert,
  UserPlus,
  Vote,
} from "lucide-react";
import { Callout, Card, CardHeader, IconTile, PageHeader, type TintName } from "@/components/ui/primitives";
import { CountUp } from "@/components/ui/count-up";
import { moduleOn } from "@/lib/modules";
import {
  cashPosition,
  delinquency,
  duesCollection,
  insuranceExposure,
  ledgerYears,
  monthlyFlows,
  spendingByCategory,
} from "@/lib/metrics";
import { MoneyFlowChart, SpendingDonut } from "@/components/app/board-charts";
import { SectionLink, YearControl } from "@/components/app/finance-ui";
import { useAppState, usePendingApprovals, useReconciliation } from "@/lib/app-state";
import { SetupPlanSummary } from "@/components/app/setup-plan";
import { ActionItems } from "@/components/app/action-items";
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
      {/* The hero banner directly above already names the association and
          counts its homes, so the eyebrow is the one thing it does not say:
          who is looking. */}
      <PageHeader eyebrow={role} title="Dashboard" />

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
              className="mb-6"
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

          <NeedsYou />

          {hasFlows || showDonut ? (
            <section className="mt-6">
              {/* One year control for both charts, in the chart's own header
                  so it reads as the chart's control rather than a floating
                  row of pills. The donut follows the same year. */}
              <div className="grid gap-4 xl:grid-cols-5">
                {hasFlows ? (
                  <Card className={cn(showDonut ? "xl:col-span-3" : "xl:col-span-5")}>
                    <CardHeader
                      title="Money in and out"
                      action={
                        <span className="flex flex-wrap items-center gap-3">
                          {years.length > 1 ? (
                            <YearControl years={years} value={year} onChange={setYear} thisYear={thisYear} />
                          ) : (
                            <span className="text-[13px] font-medium text-fg-muted">This year</span>
                          )}
                          {years.length > 1 && moduleOn("money-compare") ? (
                            <SectionLink href="/board/money/trends">Compare years</SectionLink>
                          ) : null}
                        </span>
                      }
                    />
                    <MoneyFlowChart months={flows} />
                  </Card>
                ) : null}
                {showDonut ? (
                  <Card className={cn(hasFlows ? "xl:col-span-2" : "xl:col-span-5")}>
                    <CardHeader title="Spending by category" />
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
          <div id="action-items">
            <ActionItems className="mt-6" />
          </div>
        </>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- needs you */

/**
 * What is waiting on a decision, and nothing else.
 *
 * The tiles below report; this card asks. Every row is a count of things a
 * board member has to act on today, drawn from the same selectors the tabs
 * use, so the number here is the number there. A zero row is not shown, and
 * an empty card says so calmly rather than listing six zeroes.
 */
function NeedsYou() {
  const { community, requests } = useAppState();
  const recon = useReconciliation();
  const approvals = usePendingApprovals();
  const openRequests = requests.filter(
    (r) => !["approved", "denied", "closed"].includes(r.status),
  );
  const joins = community.joinRequests.filter((j) => j.status === "pending");
  const saysFixed = community.violations.filter(
    (v) => v.stage !== "cured" && Boolean(v.ownerFixedDate),
  );
  const overdueItems = community.actionItems.filter(
    (a) => !a.doneOn && a.dueOn && a.dueOn < community.asOf,
  );

  // Each row wears the tint of the tab it opens, so the eye learns "teal is
  // money, blue is requests" here and finds the same colour on the tab.
  type NeedRow = { count: number; label: string; href: string; icon: typeof Landmark; tint: TintName };
  const all: NeedRow[] = [
    {
      count: recon.needsReview.length,
      label: pluralize(recon.needsReview.length, "transaction") + " to confirm",
      href: "/board/money/transactions",
      icon: Landmark,
      tint: "teal",
    },
    {
      count: openRequests.length,
      label: pluralize(openRequests.length, "request") + " waiting on an answer",
      href: "/board/requests",
      icon: ClipboardCheck,
      tint: "blue",
    },
    {
      count: approvals.length,
      label: pluralize(approvals.length, "invoice") + " awaiting approval",
      href: "/board/vendors",
      icon: Receipt,
      tint: "amber",
    },
    {
      count: joins.length,
      label: pluralize(joins.length, "person") + " asking to join",
      href: "/board/homeowners",
      icon: UserPlus,
      tint: "violet",
    },
    {
      count: saysFixed.length,
      label: pluralize(saysFixed.length, "notice") + " the owner says is fixed",
      href: "/board/violations",
      icon: ShieldAlert,
      tint: "coral",
    },
    {
      count: overdueItems.length,
      label: pluralize(overdueItems.length, "action item") + " overdue",
      href: "#action-items",
      icon: ListChecks,
      tint: "coral",
    },
  ];
  const rows = all.filter((row) => row.count > 0);

  return (
    <Card>
      <CardHeader
        title="Needs you today"
        action={
          rows.length ? (
            <span className="tnum inline-flex h-6 items-center rounded-full bg-brand-gradient px-2.5 text-[12px] font-bold text-primary-fg">
              {rows.reduce((n, row) => n + row.count, 0)}
            </span>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <p className="flex items-center gap-3 px-5 py-3.5 text-[15px] text-ok">
          <IconTile icon={ClipboardCheck} tint="teal" size="sm" className="pop-in" />
          Nothing needs you today.
        </p>
      ) : (
        <ul className="stagger divide-y divide-border">
          {rows.map((row) => (
            <li key={row.href}>
              <Link
                href={row.href}
                className="group flex items-center gap-3 px-5 py-3 text-[15px] text-fg transition-colors hover:bg-surface-2"
              >
                <IconTile icon={row.icon} tint={row.tint} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="tnum font-semibold">{row.count}</span>{" "}
                  {row.label.replace(/^\d+\s/, "")}
                </span>
                <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------- tiles */

const STAT_BAR: Record<TintName, string> = {
  blue: "bg-tint-blue",
  teal: "bg-tint-teal",
  amber: "bg-tint-amber",
  coral: "bg-tint-coral",
  violet: "bg-tint-violet",
  neutral: "bg-border-2",
};

function StatTile({
  icon,
  tint,
  label,
  value,
  valueTone,
  sub,
  href,
  action,
}: {
  icon: typeof Landmark;
  /** The tile's own colour: a hairline along the top and the field behind the icon. */
  tint: TintName;
  label: string;
  value: React.ReactNode;
  valueTone?: "ok" | "warn";
  sub?: string;
  href: string;
  action: string;
}) {
  return (
    <Card className="relative flex items-start gap-3 overflow-hidden p-4">
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", STAT_BAR[tint])} aria-hidden />
      {/* The icon aids recognition: each tile keeps its tint, and only the
          number changes colour when it is a problem. */}
      <IconTile icon={icon} tint={valueTone === "warn" ? "amber" : tint} size="md" />
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
          className="group mt-1.5 inline-flex items-center gap-0.5 text-[13px] font-semibold text-accent hover:underline"
        >
          {action}
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </Card>
  );
}

function StatTiles() {
  const { community } = useAppState();
  const cash = cashPosition(community);
  const delinq = delinquency(community);
  const thisYear = Number(todayIsoDate().slice(0, 4));
  const dues = duesCollection(community, thisYear);
  const liveMeeting = community.meetings.find((m) => m.status === "live");
  const nextMeeting =
    liveMeeting ??
    [...community.meetings]
      .filter((m) => m.status === "scheduled" && daysFromToday(m.date) >= 0)
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];

  // Four numbers that are not already a row in Needs you: what is in the
  // bank, who is behind, how the year is collecting, and when the board
  // next sits. Requests and invoices are decisions, so they live above.
  return (
    <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        icon={Landmark}
        tint="teal"
        label="Cash on hand"
        value={<CountUp cents={cash.operating} />}
        sub="Operating account"
        href="/board/money"
        action="Open finances"
      />
      <StatTile
        icon={Home}
        tint="coral"
        label="Past due"
        value={<CountUp kind="number" value={delinq.past.length} />}
        valueTone={delinq.past.length > 0 ? "warn" : undefined}
        sub={delinq.past.length > 0 ? `${money(delinq.totalCents, { cents: false })} owed` : "Everyone is current"}
        href="/board/money/collections"
        action="See who"
      />
      <StatTile
        icon={Percent}
        tint="blue"
        label={`Dues collected, ${thisYear}`}
        value={dues.measurable ? <CountUp kind="percent" value={Math.round(dues.rate * 100)} /> : "Not yet"}
        valueTone={dues.measurable && dues.rate < 0.9 ? "warn" : undefined}
        sub={
          dues.measurable
            ? `${money(dues.collectedYtd, { cents: false })} of ${money(dues.expectedYtd, { cents: false })}`
            : "Nothing billed yet"
        }
        href="/board/money/collections"
        action="Collections"
      />
      <StatTile
        icon={CalendarDays}
        tint="violet"
        label="Next meeting"
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
        sub={nextMeeting ? `${nextMeeting.title} · ${nextMeeting.time}` : "Schedule one from Meetings"}
        href="/board/meetings"
        action={liveMeeting ? "Join meeting" : nextMeeting ? "Open meetings" : "Schedule one"}
      />
    </div>
  );
}

/* ------------------------------------------------------------ quick actions */

const ACTIONS: { href: string; label: string; icon: typeof Vote; tint: TintName }[] = [
  { href: "/board/voting", label: "New ballot", icon: Vote, tint: "violet" },
  { href: "/board/meetings", label: "Schedule a meeting", icon: CalendarDays, tint: "amber" },
  { href: "/board/requests", label: "Review requests", icon: ClipboardCheck, tint: "blue" },
  { href: "/board/communications", label: "Send an announcement", icon: Megaphone, tint: "coral" },
];

/** The four things a board does most, one row, each wearing its tab's tint. */
function QuickActions() {
  return (
    <Card className="mt-6">
      <CardHeader title="Quick actions" />
      <div className="grid grid-cols-2 gap-1 p-3 sm:grid-cols-4">
        {ACTIONS.map(({ href, label, icon, tint }) => (
          <Link
            key={label}
            href={href}
            className="press group flex flex-col items-center gap-2 rounded-xl px-1 py-4 text-center hover:bg-surface-2"
          >
            <IconTile
              icon={icon}
              tint={tint}
              size="lg"
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105"
            />
            <span className="text-[13px] font-medium leading-tight text-fg">{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
