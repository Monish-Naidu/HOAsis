"use client";

import Link from "next/link";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Megaphone,
  Radio,
  Receipt,
  Video,
  Vote,
  Wrench,
} from "lucide-react";
import { Card, CardHeader, SectionTitle } from "@/components/ui/primitives";
import { calendarEntries } from "@/lib/metrics";
import {
  useAppState,
  useCurrentOwner,
  useMyRequests,
  useOwnerCharges,
} from "@/lib/app-state";
import { HomeSchedule } from "@/components/app/home-schedule";
import { cn, formatDate, money, relativeDays } from "@/lib/utils";

/**
 * The resident home, laid out to the 2026-09-01 dashboard design.
 *
 * Authored against the container rather than the viewport: one column at phone
 * width, two above `@3xl`, so the identical markup serves the website, the
 * phone frame preview, and a real phone.
 */
export default function ResidentHome() {
  const { community } = useAppState();
  const live = community.meetings.find((m) => m.status === "live");
  const toVote = community.ballots.filter(
    (b) => b.audience === "owners" && b.status === "open" && !b.myVoteOptionId,
  );

  return (
    <div className="animate-rise space-y-5">
      {/* Live meeting and open ballots outrank everything: they expire. */}
      {live ? (
        <Link
          href="/resident/vote"
          className="flex items-center gap-3 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 transition-opacity hover:opacity-90"
        >
          <Radio className="size-4 shrink-0 text-ok" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ok">{live.title}</span>
            <span className="block text-[13px] text-ok opacity-90">
              Live now · {live.attendees.length} joined · tap to join
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-ok" />
        </Link>
      ) : null}

      {toVote.length ? (
        <Link
          href="/resident/vote"
          className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn">
            <Vote className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-fg">
              {toVote.length === 1 ? "A ballot needs your vote" : `${toVote.length} ballots need your vote`}
            </span>
            <span className="block truncate text-[13px] text-fg-muted">
              {toVote[0].title} · closes {relativeDays(toVote[0].closesDate)}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
        </Link>
      ) : null}

      {/* The huddle's layout: the center of the screen answers "what do I
          owe and how do I pay" with no scrolling. Account summary and Quick
          Actions run the full width; activity and events share the rest.
          Community left the dashboard on purpose (a five-home association
          would see an empty card); it stays a sidebar tab. */}
      <AccountSummary />
      <QuickActions />

      <div className="grid gap-5 @3xl:grid-cols-2 @3xl:items-start [&>*]:min-w-0">
        <RecentActivity />
        <div className="space-y-5">
          <HomeSchedule entries={calendarEntries(community)} />
          <Announcements />
        </div>
      </div>
    </div>
  );
}



/**
 * The number an owner opens the app for, and the button that settles it.
 *
 * Full width and first on the page, per the huddle: balance, a Pay Now that
 * is always present, autopay standing, and the next assessment date. The
 * open-requests half this card used to carry moved out with the huddle's
 * decision that requests surface through Recent Activity instead.
 */
function AccountSummary() {
  const { community } = useAppState();
  const owner = useCurrentOwner();
  if (!owner) return null;

  const past = owner.daysPastDue > 0;
  const nextCharge = community.nextChargeDate;
  const amount = owner.balanceCents > 0 ? owner.balanceCents : community.association.duesCents;
  const covered = owner.autopay && owner.balanceCents <= 0;

  return (
    <Card>
      <CardHeader
        title="Account summary"
        action={
          <Link
            href="/resident/account"
            className="text-[13px] font-medium text-accent hover:underline"
          >
            View details
          </Link>
        }
      />
      <div className="flex flex-col gap-4 p-4 @xl:flex-row @xl:items-center @xl:gap-6 @xl:px-5">
        <div className="flex items-center gap-3.5 @xl:flex-1">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
            <CreditCard className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-fg-muted">
              {past ? "Past due" : "Current balance"}
            </p>
            <p
              className={cn(
                "tnum mt-1 text-[34px] font-semibold leading-none tracking-[-0.03em]",
                past ? "text-danger" : "text-fg",
              )}
            >
              {money(owner.balanceCents)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1 @xl:items-end">
          {owner.autopay ? (
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok">
              <CheckCircle2 className="size-3.5" />
              Autopay is on
            </p>
          ) : (
            <Link
              href="/resident/pay#autopay"
              className="text-[13px] font-semibold text-accent hover:underline"
            >
              Turn on autopay
            </Link>
          )}
          <p className="text-[13px] text-fg-muted">
            {past
              ? `${owner.daysPastDue} days past due`
              : `Next assessment ${formatDate(nextCharge, "long")}`}
          </p>
        </div>
        {/* Present even at a zero balance: paying ahead of the next
            assessment is a real thing owners do, and the pay screen
            handles it. But when autopay is on and nothing is owed, a navy
            "Pay $285" next to a $0.00 balance reads as two answers to one
            question, so the button steps back to an outline and says what
            it does. */}
        <Link
          href="/resident/pay"
          className={cn(
            "inline-flex h-11 shrink-0 items-center justify-center rounded-lg px-6 text-[16px] font-semibold transition-opacity hover:opacity-90",
            covered
              ? "border border-border-2 bg-surface text-fg"
              : "bg-brand text-brand-fg",
          )}
        >
          {covered ? "Pay early" : `Pay ${money(amount, { cents: false })}`}
        </Link>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- actions */

function QuickActions() {
  const actions = [
    { href: "/resident/vote", label: "Vote", icon: Vote, tone: "bg-ok-soft text-ok" },
    {
      // Meetings are joined from the voting page, where the room lives.
      href: "/resident/vote",
      label: "Join Meeting",
      icon: Video,
      tone: "bg-info-soft text-info",
    },
    {
      href: "/resident/requests/new",
      label: "Submit Request",
      icon: Wrench,
      tone: "bg-brand-soft text-brand-soft-fg",
    },
    {
      href: "/resident/requests/new",
      label: "Reserve Amenity",
      icon: CalendarCheck,
      tone: "bg-warn-soft text-warn",
    },
    {
      href: "/resident/documents",
      label: "View Documents",
      icon: FileText,
      tone: "bg-surface-3 text-fg-muted",
    },
  ];
  return (
    <Card>
      <CardHeader title="Quick actions" />
      <div className="grid grid-cols-3 gap-1 p-3 @sm:grid-cols-5">
        {actions.map(({ href, label, icon: Icon, tone }) => (
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

/* ---------------------------------------------------------------- activity */

/**
 * The owner's own recent history, mixed the way the design mixes it: money
 * that moved on their account, the latest word on their requests, the latest
 * announcement. Every row is read from the record it reports on.
 */
function RecentActivity() {
  const charges = useOwnerCharges();
  const requests = useMyRequests();

  interface ActivityRow {
    id: string;
    date: string;
    title: string;
    href: string;
    icon: typeof CircleDollarSign;
    tone: string;
    amount?: string;
    amountTone?: string;
  }

  // TODO(ui-spec): requests currently surface only as these activity lines;
  // Monish is deciding whether they need a clearer signal than this.
  const rows: ActivityRow[] = [...charges]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      date: c.date,
      title: c.label,
      href: "/resident/account",
      icon: c.kind === "payment" ? CircleDollarSign : Receipt,
      tone: c.kind === "payment" ? "bg-ok-soft text-ok" : "bg-surface-3 text-fg-muted",
      amount: money(Math.abs(c.amountCents)),
      amountTone: c.kind === "payment" ? "text-ok" : "text-fg",
    }));

  const withUpdate = requests
    .map((r) => ({ r, last: [...r.thread].sort((a, b) => (a.at < b.at ? 1 : -1))[0] }))
    .filter((x) => x.last)
    .sort((a, b) => (a.last.at < b.last.at ? 1 : -1))[0];
  if (withUpdate) {
    rows.push({
      id: `req-${withUpdate.r.id}`,
      date: withUpdate.last.at,
      title: `Request ${withUpdate.r.reference} updated`,
      href: "/resident/requests",
      icon: Wrench,
      tone: "bg-brand-soft text-brand-soft-fg",
    });
  }
  // Announcements deliberately stay out of this feed: they live two cards
  // down under "From the board", and a second copy pointing elsewhere reads
  // as a different item.
  const feed = rows.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  if (feed.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Recent activity"
        action={
          <Link
            href="/resident/account"
            className="text-[13px] font-medium text-accent hover:underline"
          >
            View all
          </Link>
        }
      />
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
            <span className="block text-[13px] text-fg-muted">{formatDate(row.date)}</span>
          </span>
          {row.amount ? (
            <span className={cn("tnum shrink-0 text-[15px] font-semibold", row.amountTone)}>
              {row.amount}
            </span>
          ) : (
            <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
          )}
        </Link>
      ))}
    </Card>
  );
}

/* ------------------------------------------------------------ announcements */

function Announcements() {
  const { community } = useAppState();
  const announcements = community.announcements;
  const pinned = announcements.find((a) => a.pinned);
  const rest = announcements.filter((a) => !a.pinned).slice(0, 2);
  if (!pinned && rest.length === 0) return null;

  return (
    <section>
      <SectionTitle>From the board</SectionTitle>
      <div className="space-y-3">
        {pinned ? (
          <Card className="border-l-2 border-l-navy-700 dark:border-l-navy-300">
            <div className="p-4">
              <div className="mb-1.5 flex items-center gap-2">
                <Megaphone className="size-3.5 text-fg-subtle" />
                <span className="text-[13px] font-semibold text-fg-muted">
                  Pinned · {pinned.category}
                </span>
              </div>
              <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
                {pinned.title}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{pinned.body}</p>
              <p className="mt-2.5 text-[13px] text-fg-subtle">
                {pinned.author} · {formatDate(pinned.postedDate)}
              </p>
            </div>
          </Card>
        ) : null}
        {rest.map((a) => (
          <Card key={a.id}>
            <div className="p-4">
              <span className="text-[13px] font-semibold text-fg-muted">
                {a.category}
              </span>
              <h3 className="mt-1 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
                {a.title}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-fg-muted">
                {a.body}
              </p>
              <p className="mt-2.5 text-[13px] text-fg-subtle">
                {a.author} · {formatDate(a.postedDate)}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

