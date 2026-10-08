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
  MessageSquare,
  Percent,
  Receipt,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { Callout, Card, CardHeader, IconTile, Stat, type TintName } from "@/components/ui/primitives";
import { CountUp } from "@/components/ui/count-up";
import { moduleOn } from "@/lib/modules";
import {
  cashPosition,
  dashboardFirstSteps,
  delinquency,
  duesCollection,
  duesPace,
  duesPaceLines,
  insuranceExposure,
  meetingStatus,
  nextMeeting as nextMeetingOf,
  pastDueLine,
  reserveLine,
  runwayLine,
  thisMonthLine,
  unsentDuesBill,
  vendorDecisions,
} from "@/lib/metrics";
import { collectionsLadder, policyFor } from "@/lib/collections";
import { SectionLink } from "@/components/app/finance-ui";
import { useAppState, useReconciliation, useUnreadThreadCount } from "@/lib/app-state";
import { SetupPlanSummary } from "@/components/app/setup-plan";
import { boardModuleFor, mayOpen } from "@/lib/board-routes";
import { cn, daysFromToday, formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";

/**
 * The board dashboard: four questions, then what is waiting on a decision.
 *
 * Is the money OK, who owes, are dues coming in, what is coming up. Each card
 * answers in one number, says what that number means in a line, and names the
 * page that has the rest. 2026-10-06: written for somebody who has never run
 * an HOA, so a card says "2.6 months of running costs" and not just a balance.
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
  const exposure = insuranceExposure(community);

  return (
    <>
      {/* No page title. The photo above names the association and counts
          its homes, the rail's card says who is looking, and the selected
          rail row says "Dashboard"; a heading that repeated all three was
          the same redundancy as the white bar that came off on 2026-09-21. */}

      {/* An association with nothing to run yet leads with the setup list,
          the page for them. The cards below still show, each saying what to
          do first, so the dashboard is never a wall of zeroes that looks
          broken and never an empty page. */}
      {!running && seesSetup ? <SetupPlanSummary /> : null}

      <div className={running || !seesSetup ? undefined : "mt-6"}>
        <StatTiles />
      </div>

      <ThisMonth />

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
      {running && seesSetup ? (
        <div className="mt-6">
          <SetupPlanSummary />
        </div>
      ) : null}
    </>
  );
}

/**
 * Whether a link on this page goes somewhere this seat may open and the
 * launch scope has switched on. A tile that leads to "not switched on yet"
 * is worse than a tile with no link.
 */
function useCanLink() {
  const { sees } = useAppState();
  return (href: string) => mayOpen(href, sees) && moduleOn(boardModuleFor(href.split(/[?#]/)[0]));
}

/* -------------------------------------------------------------- this month */

/**
 * One sentence about the month in progress, built from the books by
 * `thisMonthLine`: what was billed, what is in, how many homes pay by
 * themselves and when the reminders start. Money, so only for those who can
 * read the books.
 */
function ThisMonth() {
  const { community, sees } = useAppState();
  if (!mayOpen("/board/money", sees)) return null;
  const line = thisMonthLine(community);
  if (!line) return null;
  return <p className="mt-4 max-w-[80ch] text-body leading-relaxed text-fg-muted">{line}</p>;
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
  const { community, requests } = useAppState();
  const recon = useReconciliation();
  // The same count as the Messages badge in the nav.
  const waitingThreads = useUnreadThreadCount();
  const vendors = vendorDecisions(community);
  const openRequests = requests.filter(
    (r) => !["approved", "denied", "closed"].includes(r.status),
  );
  const joins = community.joinRequests.filter((j) => j.status === "pending");
  const saysFixed = community.violations.filter(
    (v) => v.stage !== "cured" && Boolean(v.ownerFixedDate),
  );
  // The next meeting's missing notice is a button on its own card, so it is
  // not a row here as well; any other meeting soon without one still is.
  const upcoming = nextMeetingOf(community);
  const unnoticed = community.meetings.filter(
    (m) =>
      m.status === "scheduled" &&
      m.id !== upcoming?.id &&
      !m.noticeSentDate &&
      daysFromToday(m.date) >= 0 &&
      daysFromToday(m.date) <= 60,
  );
  const unsentBill = unsentDuesBill(community);
  const overdueItems = community.actionItems.filter(
    (a) => !a.doneOn && a.dueOn && a.dueOn < community.asOf,
  );

  // Each row wears the tint of the tab it opens, so the eye learns "teal is
  // money, blue is requests" here and finds the same colour on the tab.
  type NeedRow = { count: number; label: string; href: string; icon: typeof Landmark; tint: TintName; whole?: boolean };
  // In the order a board acts: money, then people, then requests, then the
  // board's own loose ends. Each says what to do, not what is the matter.
  const all: NeedRow[] = [
    {
      // Only for a board that turned the automatic bill email off. The label
      // is the whole sentence, so it is not counted like the rows below.
      count: unsentBill ? 1 : 0,
      label: unsentBill ? `${unsentBill.label}. Send the bill to owners` : "",
      href: "/board/communications/announcements",
      icon: Receipt,
      tint: "teal",
      whole: true,
    },
    {
      count: recon.needsReview.length,
      label: pluralize(recon.needsReview.length, "transaction") + " to confirm",
      // The oldest line waiting is rarely this month's, so the link asks for
      // the whole year.
      href: "/board/money/transactions?status=needs-review&period=this-year",
      icon: Landmark,
      tint: "teal",
    },
    {
      count: vendors.count,
      label: pluralize(vendors.count, "vendor payment") + " to approve",
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
      count: openRequests.length,
      label: pluralize(openRequests.length, "request") + " to answer",
      href: "/board/requests",
      icon: ClipboardCheck,
      tint: "blue",
    },
    {
      count: waitingThreads,
      label: pluralize(waitingThreads, "conversation") + " waiting on a reply",
      href: "/board/communications",
      icon: MessageSquare,
      tint: "blue",
    },
    {
      count: saysFixed.length,
      label: pluralize(saysFixed.length, "notice") + " to recheck, the owner says fixed",
      href: "/board/violations",
      icon: ShieldAlert,
      tint: "coral",
    },
    {
      // Owners are owed notice of a meeting, and the annual meeting's window
      // is set by statute. Quiet grey text on the Meetings page was the only
      // place it was said.
      count: unnoticed.length,
      label: pluralize(unnoticed.length, "meeting") + " to send notice for",
      href: "/board/meetings",
      icon: Megaphone,
      tint: "amber",
    },
    {
      count: overdueItems.length,
      label: pluralize(overdueItems.length, "board to-do", "board to-dos") + " overdue",
      href: "/board/meetings#action-items",
      icon: ListChecks,
      tint: "coral",
    },
  ];
  // Only what this seat can act on, so the count here is work they can do.
  const canLink = useCanLink();
  const rows = all.filter((row) => row.count > 0 && canLink(row.href));

  return (
    <Card className="mt-6">
      <CardHeader
        accent="blue"
        title="Needs you today"
        action={
          rows.length ? (
            <span className="tnum inline-flex h-6 items-center rounded-full bg-brand-soft px-2.5 text-caption font-bold text-brand-soft-fg">
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
                  {row.whole ? (
                    row.label
                  ) : (
                    <>
                      <span className="tnum font-semibold">{row.count}</span>{" "}
                      {row.label.replace(/^\d+\s/, "")}
                    </>
                  )}
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

type CardLink = { href: string; label: string };

/**
 * The line under a card's number and the way into the page behind it.
 *
 * The whole card is one link (the primary action, stretched over it by its
 * own pseudo element), and a second action sits above that layer so it can
 * be pressed on its own. Two anchors cannot nest, so `Stat` is not given an
 * href here.
 */
function cardHint(lines: (string | null | undefined)[], primary: CardLink | null, secondary?: CardLink | null) {
  return (
    <>
      {lines.filter(Boolean).map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
      {primary || secondary ? (
        <span className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {primary ? (
            <Link
              href={primary.href}
              className="font-semibold text-primary hover:underline after:absolute after:inset-0 after:content-['']"
            >
              {primary.label}
            </Link>
          ) : null}
          {secondary ? (
            <Link href={secondary.href} className="relative z-10 font-semibold text-primary hover:underline">
              {secondary.label}
            </Link>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

const LINKED = "press transition-colors hover:border-border-2 hover:bg-surface-2";

/**
 * Four questions a board asks on arrival: is the money OK, who owes, are
 * dues coming in, and what is coming up. Each tile gives the number, what it
 * means, and the page that has the rest. Needs you holds everything else.
 */
function StatTiles() {
  const { community, sees } = useAppState();
  const canLink = useCanLink();
  const seesMoney = mayOpen("/board/money", sees);
  const households = community.homes.filter((o) => !o.placeholder).length;
  const signedUp = community.homes.filter(
    (o) => !o.placeholder && community.accounts.some((a) => a.homeId === o.id),
  ).length;
  const cash = cashPosition(community);
  const delinq = delinquency(community);
  const thisYear = Number(todayIsoDate().slice(0, 4));
  const dues = duesCollection(community, thisYear);
  const pace = duesPace(dues);
  const first = dashboardFirstSteps(community);
  const ladder = collectionsLadder(community, policyFor(community.settings));
  const meeting = nextMeetingOf(community);
  const live = meeting?.status === "live";
  const status = meeting ? meetingStatus(meeting) : null;
  const setup = canLink("/board/setup") ? { href: "/board/setup", label: "Open the setup list" } : null;
  const to = (href: string, label: string): CardLink | null => (canLink(href) ? { href, label } : null);

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
            className={LINKED}
            icon={<Landmark className="size-4" />}
            label="Cash on hand"
            value={<CountUp cents={cash.operating} />}
            hint={
              first.cash
                ? cardHint([first.cash], setup)
                : cardHint([runwayLine(community) ?? "Operating account", reserveLine(community)], to("/board/money", "Open Finances"))
            }
          />
          <Stat
            className={LINKED}
            icon={<Home className="size-4" />}
            accent={delinq.past.length > 0 ? "amber" : undefined}
            label="Past due"
            value={<CountUp kind="number" value={delinq.past.length} />}
            tone={delinq.past.length > 0 ? "warn" : "neutral"}
            hint={
              first.owed
                ? cardHint([first.owed], setup)
                : cardHint(
                    [pastDueLine(community)],
                    to("/board/money/collections", "Open Past due"),
                    // Only when the policy says a letter is owed and has not
                    // gone out, the same test as the button on Past due.
                    ladder.dueNow.length > 0 ? to("/board/homeowners?remind=1", "Send reminders") : null,
                  )
            }
          />
          <Stat
            className={LINKED}
            icon={<Percent className="size-4" />}
            accent={pace === "behind" ? "amber" : undefined}
            label={`Dues collected, ${thisYear}`}
            value={dues.measurable ? <CountUp kind="percent" value={Math.round(dues.rate * 100)} /> : "Not yet"}
            tone={pace === "behind" ? "warn" : "neutral"}
            hint={
              first.dues
                ? cardHint([first.dues], setup)
                : cardHint(
                    [
                      dues.measurable
                        ? `${money(dues.collectedYtd, { cents: false })} of ${money(dues.expectedYtd, { cents: false })}`
                        : "Nothing billed yet",
                      ...duesPaceLines(community, thisYear),
                    ],
                    to("/board/money", "Open Finances"),
                  )
            }
          />
        </>
      ) : (
        // In place of the money: who is here yet. The officers who keep
        // owners informed are the ones who chase the sign-ups.
        <Stat
          className={cn(canLink("/board/homeowners") && LINKED)}
          icon={<Users className="size-4" />}
          label="Homes signed up"
          value={<CountUp kind="number" value={signedUp} />}
          hint={cardHint([`of ${pluralize(households, "home")}`], to("/board/homeowners", "Open Homeowners"))}
        />
      )}
      <Stat
        className={LINKED}
        icon={<CalendarDays className="size-4" />}
        accent={live ? "teal" : undefined}
        label="Next meeting"
        value={
          live
            ? "Live now"
            : meeting
              ? daysFromToday(meeting.date) === 0
                ? "Tonight"
                : formatDate(meeting.date)
              : "Not set"
        }
        tone={live ? "ok" : "neutral"}
        hint={
          meeting && status
            ? cardHint(
                [`${meeting.title} \u00b7 ${meeting.time}`, status.line],
                // An unsent notice is the thing to do; otherwise the page.
                status.noticeSent || live ? to("/board/meetings", "Open Meetings") : to("/board/meetings", "Send notice"),
              )
            : cardHint(["No meeting scheduled"], to("/board/meetings", "Schedule one"))
        }
      />
    </div>
  );
}
