"use client";

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
  Users,
} from "lucide-react";
import { Callout, Card, CardHeader, IconTile, Stat, type TintName } from "@/components/ui/primitives";
import { CountUp } from "@/components/ui/count-up";
import { moduleOn } from "@/lib/modules";
import { cashPosition, delinquency, duesCollection, insuranceExposure, lateFeesOwed, vendorDecisions } from "@/lib/metrics";
import { SectionLink } from "@/components/app/finance-ui";
import { useAppState, useReconciliation } from "@/lib/app-state";
import { SetupPlanSummary } from "@/components/app/setup-plan";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";
import { mayOpen } from "@/lib/board-routes";
import { daysFromToday, formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";

/**
 * The board dashboard: four numbers, then what is waiting on a decision.
 *
 * It started as the 2026-09-01 design almost exactly
 * (docs/design/dash-2026-09-01), and the 2026-09-24 board pass took three
 * things off it. The money chart is on Finances, where the year control and
 * the export are. The quick actions only switched tabs, which the rail
 * already does in one click. The action items live on Meetings, where they
 * are made and ticked off; an overdue one still shows here as a row in
 * Needs you. What is left is what a director should see on arrival.
 */

export default function BoardDashboard() {
  const { community, can } = useAppState();
  // The plan counts things only the finance and settings holders can see,
  // so anybody else would be told a finished setup was two steps short.
  const seesSetup = mayOpen("/board/setup", can);
  // Something to run: money has moved, or somebody has asked for something.
  const running =
    community.ledger.length > 0 ||
    (community.history?.ledgerCount ?? 0) > 0 ||
    community.requests.length > 0 ||
    community.ballots.length > 0 ||
    community.payouts.length > 0;
  const plan = buildPlan(community, profileFromCommunity(community));
  const exposure = insuranceExposure(community);

  return (
    <>
      {/* No page title. The photo above names the association and counts
          its homes, the rail's card says who is looking, and the selected
          rail row says "Dashboard"; a heading that repeated all three was
          the same redundancy as the white bar that came off on 2026-09-21. */}

      {/* An association with no transactions, no requests and no ballots has
          nothing to run, so a dashboard of zeroes and empty cards tells them
          nothing and looks broken. The setup plan is the page for them. */}
      {!running ? (
        <>
          {seesSetup ? <SetupPlanSummary /> : null}
          <Card className="p-6">
            <p className="text-headline font-semibold tracking-[-0.015em] text-fg">
              Nothing to run yet
            </p>
            <p className="mt-1.5 max-w-[60ch] text-body leading-relaxed text-fg-muted">
              Once dues are billed, a payment lands, or an owner asks for something, it shows up
              here.{plan.allDone ? "" : " The list above is the way to get there."}
            </p>
          </Card>
        </>
      ) : (
        <>
          <StatTiles />

          {/* The one finding on Finances that a president should not have
              to click through to see. Money above the insured limit is a
              decision, not a report. */}
          {moduleOn("deposit-insurance") && exposure.totalUninsured > 0 ? (
            <Callout
              tone="warn"
              className="mt-6"
              icon={<ShieldAlert className="size-4" />}
              title={`${money(exposure.totalUninsured, { cents: false })} is over the insured limit`}
              action={<SectionLink href="/board/money">See where</SectionLink>}
            >
              {exposure.rows
                .filter((row) => row.uninsured > 0)
                .map((row) => `${row.institution} holds ${money(row.balance, { cents: false })} against a ${money(row.limit, { cents: false })} limit.`)
                .join(" ")}
            </Callout>
          ) : null}

          <NeedsYou />

          {/* One line while setup is unfinished, pointing at the list, which
              lives on its own page. Below the work, because once dues are
              moving the work is what a director opens this for. */}
          {seesSetup ? (
            <div className="mt-6">
              <SetupPlanSummary />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------- needs you */

/**
 * What is waiting on a decision, and nothing else.
 *
 * The tiles above report; this card asks. Every row is a count of things a
 * board member has to act on today, drawn from the same selectors the tabs
 * and the rail badges use, so the number here is the number there. A zero
 * row is not shown, and an empty card says so calmly rather than listing
 * six zeroes.
 */
function NeedsYou() {
  const { community, requests, sees } = useAppState();
  const recon = useReconciliation();
  const vendors = vendorDecisions(community);
  const openRequests = requests.filter(
    (r) => !["approved", "denied", "closed"].includes(r.status),
  );
  const joins = community.joinRequests.filter((j) => j.status === "pending");
  const saysFixed = community.violations.filter(
    (v) => v.stage !== "cured" && Boolean(v.ownerFixedDate),
  );
  const unnoticed = community.meetings.filter(
    (m) =>
      m.status === "scheduled" &&
      !m.noticeSentDate &&
      daysFromToday(m.date) >= 0 &&
      daysFromToday(m.date) <= 60,
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
      href: "/board/money/transactions?status=needs-review",
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
      count: vendors.count,
      label: pluralize(vendors.count, "vendor bill") + " waiting on you",
      href: "/board/vendors",
      icon: Receipt,
      tint: "amber",
    },
    {
      count: joins.length,
      label: pluralize(joins.length, "person", "people") + " asking to join",
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
      // Owners are owed notice of a meeting, and the annual meeting's window
      // is set by statute. Quiet grey text on the Meetings page was the only
      // place it was said.
      count: unnoticed.length,
      label: pluralize(unnoticed.length, "meeting") + " without notice to owners",
      href: "/board/meetings",
      icon: Megaphone,
      tint: "amber",
    },
    {
      count: overdueItems.length,
      label: pluralize(overdueItems.length, "action item") + " overdue",
      href: "/board/meetings#action-items",
      icon: ListChecks,
      tint: "coral",
    },
  ];
  // Only what this seat can act on, so the count here is work they can do.
  const rows = all.filter((row) => row.count > 0 && mayOpen(row.href, sees));

  return (
    <Card className="mt-6">
      <CardHeader
        accent="blue"
        title="Needs you today"
        action={
          rows.length ? (
            <span className="tnum inline-flex h-6 items-center rounded-full bg-primary-soft px-2.5 text-caption font-bold text-primary">
              {rows.reduce((n, row) => n + row.count, 0)}
            </span>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <p className="flex items-center gap-3 px-5 py-3.5 text-body text-ok">
          <IconTile icon={ClipboardCheck} tint="teal" size="sm" className="pop-in" />
          Nothing needs you today.
        </p>
      ) : (
        <ul className="stagger divide-y divide-border">
          {rows.map((row) => (
            <li key={row.href}>
              <Link
                href={row.href}
                className="group flex min-h-12 items-center gap-3 px-5 py-3 text-body text-fg transition-colors hover:bg-surface-2"
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

/**
 * Four numbers that are not already a row in Needs you: what is in the bank,
 * who is behind, how the year is collecting, and when the board next sits.
 * Each tile is the way into the page that has the rest.
 */
function StatTiles() {
  const { community, sees } = useAppState();
  const seesMoney = mayOpen("/board/money", sees);
  const households = community.owners.filter((o) => !o.placeholder).length;
  const signedUp = community.owners.filter(
    (o) => !o.placeholder && community.accounts.some((a) => a.ownerId === o.id),
  ).length;
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

  // Money tiles only for those who can read the books. Without the finances
  // capability the ledger comes back empty, and "$0, everyone is current"
  // is a false statement, not a hidden one.
  // Two across even on a phone: stacked one per row, four tiles filled the
  // first screen and pushed Needs you below the fold.
  const columns = seesMoney ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-2";
  return (
    <div className={`stagger grid gap-3 sm:gap-4 ${columns}`}>
      {seesMoney ? (
        <>
      <Stat
        icon={<Landmark className="size-4" />}
        accent="teal"
        label="Cash on hand"
        value={<CountUp cents={cash.operating} />}
        hint="Operating account"
        href="/board/money"
      />
      <Stat
        icon={<Home className="size-4" />}
        accent="coral"
        label="Past due"
        value={<CountUp kind="number" value={delinq.past.length} />}
        tone={delinq.past.length > 0 ? "warn" : "neutral"}
        hint={
          delinq.past.length > 0
            ? `${delinq.past.length === 1 ? "Household" : "Households"}, ${money(delinq.totalCents, { cents: false })} owed${lateFeesOwed(community) ? `, ${money(lateFeesOwed(community), { cents: false })} of it fees` : ""}`
            : "Everyone is current"
        }
        href="/board/money/collections"
      />
      <Stat
        icon={<Percent className="size-4" />}
        accent="blue"
        label={`Dues collected, ${thisYear}`}
        value={dues.measurable ? <CountUp kind="percent" value={Math.round(dues.rate * 100)} /> : "Not yet"}
        tone={dues.measurable && dues.rate < 0.9 ? "warn" : "neutral"}
        hint={
          dues.measurable
            ? `${money(dues.collectedYtd, { cents: false })} of ${money(dues.expectedYtd, { cents: false })}`
            : "Nothing billed yet"
        }
        href="/board/money/collections"
      />
        </>
      ) : (
        // In place of the money: who is here yet. The officers who keep
        // owners informed are the ones who chase the sign-ups.
        <Stat
          icon={<Users className="size-4" />}
          accent="violet"
          label="Homes signed up"
          value={<CountUp kind="number" value={signedUp} />}
          hint={`of ${pluralize(households, "home")}`}
          href={mayOpen("/board/homeowners", sees) ? "/board/homeowners" : undefined}
        />
      )}
      <Stat
        icon={<CalendarDays className="size-4" />}
        accent="amber"
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
        tone={liveMeeting ? "ok" : "neutral"}
        hint={nextMeeting ? `${nextMeeting.title} · ${nextMeeting.time}` : "Schedule one from Meetings"}
        href={mayOpen("/board/meetings", sees) ? "/board/meetings" : undefined}
      />
    </div>
  );
}
