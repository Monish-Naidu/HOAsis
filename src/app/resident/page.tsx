"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Megaphone,
  Radio,
  Receipt,
  Vote,
  Wrench,
} from "lucide-react";
import { Card, CardHeader, EmptyState, IconTile, SectionTitle, TINT_FIELD, type TintName } from "@/components/ui/primitives";
import { calendarEntries } from "@/lib/metrics";
import { ballotPhase } from "@/lib/phases";
import {
  useAppState,
  useCurrentOwner,
  useMyRequests,
  useOwnerCharges,
} from "@/lib/app-state";
import { HomeSchedule } from "@/components/app/home-schedule";
import { cn, formatDate, money, pastDueLabel, relativeDays } from "@/lib/utils";
import { ownerDues } from "@/lib/home-types";

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
    (b) => b.audience === "owners" && ballotPhase(b) === "open" && !b.myVoteOptionId,
  );

  return (
    <div className="stagger space-y-6">
      {/* What expires today, in one card rather than a stack of banners. */}
      {live || toVote.length ? (
        <Card className="divide-y divide-border">
          {live ? (
            <Link
              href="/resident/calendar"
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
            >
              <IconTile icon={Radio} tint="teal" size="sm" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-body font-semibold text-fg">{live.title}</span>
                <span className="block text-footnote text-ok">
                  Meeting on now · {live.attendees.length} joined
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
            </Link>
          ) : null}
          {toVote.length ? (
            <Link
              href="/resident/vote"
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
            >
              <IconTile icon={Vote} tint="violet" size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-fg">
                  {toVote.length === 1 ? "A ballot needs your vote" : `${toVote.length} ballots need your vote`}
                </span>
                <span className="line-clamp-2 block text-footnote text-fg-muted">
                  {toVote[0].title} · closes {relativeDays(toVote[0].closesDate)}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
            </Link>
          ) : null}
        </Card>
      ) : null}

      {/* The huddle's layout: the center of the screen answers "what do I
          owe and how do I pay" with no scrolling. Account summary and Quick
          Actions run the full width; activity and events share the rest.
          Community left the dashboard on purpose (a five-home association
          would see an empty card); it stays a sidebar tab. */}
      <AccountSummary />
      <QuickActions />

      {/* Activity and the schedule side by side on equal footing, both
          stretched to the taller of the two; the board's word runs the full
          width underneath. Monish's 2026-09-21 layout. */}
      <div className="grid gap-6 @3xl:grid-cols-2 @3xl:items-stretch [&>*]:min-w-0">
        <RecentActivity />
        <HomeSchedule entries={calendarEntries(community)} />
      </div>
      <Announcements />
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
  // This home's own amount: in a mixed community kinds pay differently.
  const amount =
    owner.balanceCents > 0 ? owner.balanceCents : ownerDues(community.association, owner);
  const covered = owner.autopay && owner.balanceCents <= 0;

  return (
    <Card>
      <CardHeader
        accent="teal"
        title="Account summary"
        action={
          <Link
            href="/resident/account"
            className="text-footnote font-medium text-accent hover:underline"
          >
            View details
          </Link>
        }
      />
      <div className="flex flex-col gap-4 p-4 @xl:flex-row @xl:items-center @xl:gap-6 @xl:px-5">
        <div className="flex items-center gap-3.5 @xl:flex-1">
          <IconTile icon={CreditCard} tint={past ? "coral" : "blue"} variant="solid" size="lg" />
          <div className="min-w-0">
            <p className="text-footnote font-semibold text-fg-muted">
              {past ? "Past due" : "Current balance"}
            </p>
            <p
              className={cn(
                "tnum mt-1 text-[34px] font-semibold leading-none tracking-[-0.03em]",
                past ? "text-danger" : "text-fg",
              )}
            >
              {/* The figure itself, not a count up from $0: a glance
                  mid-animation read a wrong balance. */}
              {money(owner.balanceCents)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1 @xl:items-end">
          {owner.autopay ? (
            <p className="inline-flex items-center gap-1.5 text-footnote font-semibold text-ok">
              <CheckCircle2 className="size-3.5" />
              Autopay is on
            </p>
          ) : (
            <Link
              href="/resident/pay#autopay"
              className="text-footnote font-semibold text-accent hover:underline"
            >
              Turn on autopay
            </Link>
          )}
          <p className="text-footnote text-fg-muted">
            {past
              ? pastDueLabel(owner.daysPastDue)
              : `Next dues ${formatDate(nextCharge, "long")}`}
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
            "press inline-flex h-11 shrink-0 items-center justify-center rounded-lg px-6 text-body font-semibold",
            covered
              ? "border border-border-2 bg-surface text-fg hover:bg-surface-2"
              : "shimmer bg-brand-gradient text-primary-fg shadow-raised hover:shadow-glow",
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
  // Three, and each goes somewhere different. Five tiles used to resolve to
  // three destinations, two of them already in the tab bar.
  const actions: { href: string; label: string; icon: typeof Wrench; tint: TintName }[] = [
    { href: "/resident/requests/new", label: "New request", icon: Wrench, tint: "blue" },
    { href: "/resident/documents", label: "Documents", icon: FileText, tint: "violet" },
    { href: "/resident/vote", label: "Vote", icon: Vote, tint: "teal" },
  ];
  // A row of three tinted buttons, no card around them. A card titled
  // "Quick actions" wrapping three links was the tallest thing on the page
  // after the photo, for the least information. Each wears the colour its
  // section wears everywhere else.
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-3 gap-3 @xl:gap-4">
      {actions.map(({ href, label, icon, tint }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "press group flex min-h-[4.75rem] flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center transition-colors @xl:min-h-16 @xl:flex-row @xl:gap-3 @xl:px-4",
            TINT_FIELD[tint],
          )}
        >
          <IconTile
            icon={icon}
            tint={tint}
            variant="solid"
            size="md"
            className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105"
          />
          <span className="text-callout font-semibold leading-tight tracking-[-0.01em] text-fg @xl:text-body">
            {label}
          </span>
        </Link>
      ))}
    </nav>
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
    tint: TintName;
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
      tint: c.kind === "payment" ? "teal" : "neutral",
      // A payment carries a minus, as on the statement, so the colour is
      // not the only thing that says which way the money went.
      amount: `${c.kind === "payment" ? "−" : ""}${money(Math.abs(c.amountCents))}`,
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
      // The request by its name, and who moved it. "Request REQ-2026-121
      // updated" was an ID, and the update was usually the owner's own note.
      // The routing line the app writes on submission is not an answer.
      title: `${withUpdate.r.title}: ${
        withUpdate.last.actorRole === "resident"
          ? "you added a note"
          : withUpdate.last.actorRole === "system"
            ? "sent to the board"
            : "the board answered"
      }`,
      href: `/resident/requests/${encodeURIComponent(withUpdate.r.reference)}`,
      icon: Wrench,
      tint: "blue",
    });
  }
  // Announcements deliberately stay out of this feed: they live two cards
  // down under "From the board", and a second copy pointing elsewhere reads
  // as a different item.
  // Four rows. The account page has the rest, one tap away.
  const feed = rows.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);
  if (feed.length === 0) {
    // Returning nothing left Next up alone in a two column grid with an
    // empty half beside it. The card stays, and says what will fill it.
    return (
      <Card className="h-full">
        <CardHeader accent="teal" title="Recent activity" />
        <EmptyState
          icon={<Receipt className="size-5" />}
          title="Nothing yet"
          description="Dues, payments, and answers to your requests show up here."
        />
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader
        accent="teal"
        title="Recent activity"
        action={
          <Link
            href="/resident/account"
            className="text-footnote font-medium text-accent hover:underline"
          >
            View all
          </Link>
        }
      />
      {feed.map(({ icon, ...row }) => (
        <Link
          key={row.id}
          href={row.href}
          className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2"
        >
          <IconTile icon={icon} tint={row.tint} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-body font-medium text-fg">{row.title}</span>
            <span className="block text-footnote text-fg-muted">{formatDate(row.date)}</span>
          </span>
          {row.amount ? (
            <span className={cn("tnum shrink-0 text-body font-semibold", row.amountTone)}>
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
      {/* The pinned notice runs the full width; the rest share it two up
          once there is room, so the band fills the bottom of the page. */}
      <div className="grid gap-3 @3xl:grid-cols-2 [&>*]:min-w-0">
        {pinned ? (
          <Card className="relative overflow-hidden @3xl:col-span-2">
            <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-gradient" aria-hidden />
            <div className="p-4 pl-5">
              <div className="mb-1.5 flex items-center gap-2">
                <IconTile icon={Megaphone} tint="coral" size="xs" />
                <span className="text-footnote font-semibold text-fg-muted">
                  Pinned · {pinned.category}
                </span>
              </div>
              <h3 className="text-body font-semibold leading-snug tracking-[-0.01em] text-fg">
                {pinned.title}
              </h3>
              <p className="mt-1.5 text-body leading-relaxed text-fg-muted">{pinned.body}</p>
              <p className="mt-2.5 text-footnote text-fg-subtle">
                {pinned.author} · {formatDate(pinned.postedDate)}
              </p>
            </div>
          </Card>
        ) : null}
        {rest.map((a) => (
          <Card key={a.id}>
            <div className="p-4">
              <span className="text-footnote font-semibold text-fg-muted">
                {a.category}
              </span>
              <h3 className="mt-1 text-body font-semibold leading-snug tracking-[-0.01em] text-fg">
                {a.title}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-body leading-relaxed text-fg-muted">
                {a.body}
              </p>
              <p className="mt-2.5 text-footnote text-fg-subtle">
                {a.author} · {formatDate(a.postedDate)}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

