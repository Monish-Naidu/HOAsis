"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CircleDollarSign,
  CreditCard,
  FileText,
  Megaphone,
  MessageSquareText,
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
  useHomePhoto,
  useMyRequests,
  useOwnerCharges,
  useVisiblePosts,
} from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { HomeSchedule } from "@/components/app/home-schedule";
import { MyOpenRequests } from "@/components/app/my-open-requests";
import { cn, formatDate, money, pluralize, relativeDays } from "@/lib/utils";

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

      <div className="grid gap-5 @3xl:grid-cols-2">
        <div className="space-y-5">
          <MyHomeCard />
          <AccountSummary />
          <QuickActions />
        </div>
        <div className="space-y-5">
          <RecentActivity />
          <MyOpenRequests />
        </div>
      </div>

      <div className="grid gap-5 @3xl:grid-cols-2 @3xl:items-start">
        <Announcements />
        <div className="space-y-5">
          <CommunityCard />
          <HomeSchedule entries={calendarEntries(community)} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- home */

/**
 * The design's My Home card: the photograph, the address, the association.
 *
 * The owner can add a photo of their own home; until they do, the community's
 * cover photo stands in, which is the closest true image we hold. The photo
 * lives in this browser (see `useHomePhoto`), so losing it costs a picture,
 * never a record.
 */
function MyHomeCard() {
  const { settings } = useAppState();
  const owner = useCurrentOwner();
  const { photo, setPhoto } = useHomePhoto();
  const { notify } = useToast();
  const input = useRef<HTMLInputElement>(null);
  if (!owner) return null;

  async function choose(file: File) {
    if (!file.type.startsWith("image/")) {
      notify("That is not an image", "warn");
      return;
    }
    // Shrunk before it is kept: localStorage holds megabytes, not a camera
    // roll, and a card thumbnail never needs more than ~800px.
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not read that image"));
        image.src = url;
      });
      const scale = Math.min(1, 800 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL("image/jpeg", 0.82));
      notify("Home photo added", "ok");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not read that image", "warn");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <Card className="flex items-stretch overflow-hidden">
      <div className="relative w-28 shrink-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${photo ?? settings.photoUrl})` }}
          aria-hidden
        />
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void choose(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={photo ? "Change the photo of your home" : "Add a photo of your home"}
          title={photo ? "Change the photo of your home" : "Add a photo of your home"}
          className="absolute bottom-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65"
        >
          <Camera className="size-3.5" />
        </button>
      </div>
      <div className="min-w-0 flex-1 p-4">
        <p className="text-[17px] font-semibold tracking-[-0.015em] text-fg">My Home</p>
        <p className="mt-0.5 truncate text-[15px] text-fg-muted">{owner.address}</p>
        <p className="truncate text-[13px] text-fg-subtle">{settings.displayName}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <Link
            href="/resident/account"
            className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-accent hover:underline"
          >
            View home details
            <ChevronRight className="size-3.5" />
          </Link>
          {photo ? (
            <button
              type="button"
              onClick={() => {
                setPhoto(null);
                notify("Back to the community photo");
              }}
              className="text-[13px] font-medium text-fg-subtle hover:text-fg-muted hover:underline"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- summary */

/**
 * The two numbers an owner opens the app for: what they owe, and where their
 * asks stand. Balance and standing come off the owner record, the same one
 * the board's delinquency screen reads, so the two sides cannot disagree.
 */
function AccountSummary() {
  const { community } = useAppState();
  const owner = useCurrentOwner();
  const requests = useMyRequests();
  if (!owner) return null;

  const open = requests.filter((r) => !["approved", "denied", "closed"].includes(r.status));
  const past = owner.daysPastDue > 0;
  const nextCharge = community.nextChargeDate;
  const amount = owner.balanceCents > 0 ? owner.balanceCents : community.association.duesCents;

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
      <div className="grid divide-y divide-border @sm:grid-cols-2 @sm:divide-x @sm:divide-y-0">
        <div className="p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-info-soft text-info">
              <CreditCard className="size-4" strokeWidth={2} />
            </span>
            <p className="text-[13px] font-semibold text-fg-muted">
              {past ? "Past due" : "Current balance"}
            </p>
          </div>
          <p
            className={cn(
              "tnum mt-2.5 text-[30px] font-semibold leading-none tracking-[-0.03em]",
              past ? "text-danger" : "text-fg",
            )}
          >
            {money(owner.balanceCents)}
          </p>
          {owner.autopay ? (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok">
              <CheckCircle2 className="size-3.5" />
              Autopay is on
            </p>
          ) : (
            <Link
              href="/resident/pay#autopay"
              className="mt-2.5 inline-block text-[13px] font-semibold text-accent hover:underline"
            >
              Turn on autopay
            </Link>
          )}
          <p className="mt-1 text-[13px] text-fg-muted">
            {past
              ? `${owner.daysPastDue} days past due`
              : `Next assessment ${formatDate(nextCharge, "long")}`}
          </p>
          {owner.balanceCents > 0 ? (
            <Link
              href="/resident/pay"
              className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-brand px-4 text-[15px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
            >
              Pay {money(amount, { cents: false })}
            </Link>
          ) : null}
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-brand-soft-fg">
              <ClipboardList className="size-4" strokeWidth={2} />
            </span>
            <p className="text-[13px] font-semibold text-fg-muted">Open requests</p>
          </div>
          <p className="tnum mt-2.5 text-[30px] font-semibold leading-none tracking-[-0.03em] text-fg">
            {open.length}
          </p>
          <p className="mt-2.5 text-[13px] text-fg-muted">
            {open.length === 0
              ? "Nothing waiting on the board"
              : `${pluralize(open.length, "request")} with the board`}
          </p>
          <Link
            href="/resident/requests"
            className="mt-1 inline-block text-[13px] font-semibold text-accent hover:underline"
          >
            View requests
          </Link>
        </div>
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
  const { community } = useAppState();
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

  const rows: ActivityRow[] = [...charges]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 2)
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
  const announcement = [...community.announcements].sort((a, b) =>
    a.postedDate < b.postedDate ? 1 : -1,
  )[0];
  if (announcement) {
    rows.push({
      id: `ann-${announcement.id}`,
      date: announcement.postedDate,
      title: announcement.title,
      href: "/resident/notices",
      icon: Megaphone,
      tone: "bg-warn-soft text-warn",
    });
  }

  const feed = rows.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);
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

/* ---------------------------------------------------------------- community */

/**
 * What the neighbors are talking about. Real threads from the forum, not a
 * synthesized safety feed: if the association has nothing going on, the card
 * is simply absent.
 */
function CommunityCard() {
  const { settings } = useAppState();
  const posts = useVisiblePosts();
  if (!settings.forumEnabled) return null;
  const recent = [...posts].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 3);
  if (recent.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Community"
        icon={<MessageSquareText className="size-4" />}
        action={
          <Link
            href="/resident/forum"
            className="text-[13px] font-medium text-accent hover:underline"
          >
            Open forum
          </Link>
        }
      />
      {recent.map((p) => (
        <Link
          key={p.id}
          href="/resident/forum"
          className="block border-b border-border px-5 py-2.5 last:border-b-0 hover:bg-surface-2"
        >
          <p className="truncate text-[15px] font-medium text-fg">{p.title}</p>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {p.author} · {formatDate(p.at)} · {pluralize(p.replies.length, "reply", "replies")}
          </p>
        </Link>
      ))}
      <Link
        href="/resident/forum"
        className="flex items-center justify-between px-5 py-2.5 text-[13px] font-semibold text-accent hover:underline"
      >
        View all community updates
        <ChevronRight className="size-3.5" />
      </Link>
    </Card>
  );
}
