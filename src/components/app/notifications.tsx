"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  CircleDollarSign,
  ClipboardCheck,
  Inbox,
  Mail,
  Megaphone,
  MessagesSquare,
  Radio,
  Receipt,
  Vote,
} from "lucide-react";
import {
  useAppState,
  useCurrentOwner,
  usePendingApprovals,
  useReconciliation,
  useUnreadThreadCount,
} from "@/lib/app-state";
import { noticeKey, readStore, useReadNotices } from "@/lib/notifications-read";
import { cn, daysFromToday, money, pluralize, relativeDays } from "@/lib/utils";

/**
 * The bell on the top right, from the 2026-09-01 design.
 *
 * Every line in the panel is derived from a record that needs somebody, so
 * the panel can never show an item with nothing behind it. Which lines the
 * person has already seen lives in the browser (`notifications-read.ts`):
 * clicking one marks it read and the badge counts only what is unread. A
 * notice whose words change comes back as unread; an unchanged one stays
 * quiet until the record itself goes away.
 */

interface Notice {
  id: string;
  title: string;
  detail: string;
  href: string;
  icon: typeof Bell;
  tone: string;
}

function useBoardNotices(): Notice[] {
  const { community, requests, can } = useAppState();
  const recon = useReconciliation();
  const approvals = usePendingApprovals();
  const unread = useUnreadThreadCount();
  const notices: Notice[] = [];

  const live = community.meetings.find((m) => m.status === "live");
  if (live) {
    notices.push({
      id: "live",
      title: live.title,
      detail: `Meeting on now · ${live.attendees.length} joined`,
      href: "/board/meetings",
      icon: Radio,
      tone: "bg-ok-soft text-ok",
    });
  }
  if (can("finances") && recon.needsReview.length > 0) {
    notices.push({
      id: "review",
      title: `${pluralize(recon.needsReview.length, "transaction")} to look at`,
      detail: "The books close once each one is confirmed",
      href: "/board/money",
      icon: CircleDollarSign,
      tone: "bg-warn-soft text-warn",
    });
  }
  if (can("vendors") && approvals.length > 0) {
    notices.push({
      id: "approvals",
      title: `${pluralize(approvals.length, "invoice")} awaiting approval`,
      detail: money(approvals.reduce((t, p) => t + p.amountCents, 0)),
      href: "/board/vendors",
      icon: Receipt,
      tone: "bg-warn-soft text-warn",
    });
  }
  if (can("requests")) {
    const open = requests.filter((r) => !["approved", "denied", "closed"].includes(r.status));
    if (open.length > 0) {
      notices.push({
        id: "requests",
        title: `${pluralize(open.length, "open request")}`,
        detail: open[0].title,
        href: "/board/requests",
        icon: Inbox,
        tone: "bg-info-soft text-info",
      });
    }
  }
  if (can("communications") && unread > 0) {
    notices.push({
      id: "unread",
      title: `${pluralize(unread, "unread message thread")}`,
      detail: "An owner is waiting on a reply",
      href: "/board/communications",
      icon: MessagesSquare,
      tone: "bg-brand-soft text-brand-soft-fg",
    });
  }
  return notices;
}

function useResidentNotices(): Notice[] {
  const { community } = useAppState();
  const owner = useCurrentOwner();
  const notices: Notice[] = [];

  const live = community.meetings.find((m) => m.status === "live");
  if (live) {
    notices.push({
      id: "live",
      title: live.title,
      detail: `Meeting on now · ${live.attendees.length} joined`,
      href: "/resident/calendar",
      icon: Radio,
      tone: "bg-ok-soft text-ok",
    });
  }
  if (owner && owner.balanceCents > 0) {
    notices.push({
      id: "balance",
      title: owner.daysPastDue > 0 ? "Your account is past due" : "A payment is coming up",
      detail: `${money(owner.balanceCents)} ${owner.daysPastDue > 0 ? `· ${owner.daysPastDue} days past due` : `· due ${relativeDays(community.nextChargeDate)}`}`,
      href: "/resident/pay",
      icon: CircleDollarSign,
      tone: owner.daysPastDue > 0 ? "bg-danger-soft text-danger" : "bg-info-soft text-info",
    });
  }
  const toVote = community.ballots.filter(
    (b) => b.audience === "owners" && b.status === "open" && !b.myVoteOptionId,
  );
  if (toVote.length > 0) {
    notices.push({
      id: "vote",
      title: toVote.length === 1 ? "A ballot needs your vote" : `${toVote.length} ballots need your vote`,
      detail: `${toVote[0].title} · closes ${relativeDays(toVote[0].closesDate)}`,
      href: "/resident/vote",
      icon: Vote,
      tone: "bg-warn-soft text-warn",
    });
  }
  const announcement = [...community.announcements].sort((a, b) =>
    a.postedDate < b.postedDate ? 1 : -1,
  )[0];
  if (announcement && daysFromToday(announcement.postedDate) >= -7) {
    notices.push({
      id: "announcement",
      title: announcement.title,
      detail: `${announcement.author} · ${relativeDays(announcement.postedDate)}`,
      // Announcements live on the home screen under "From the board".
      href: "/resident",
      icon: Megaphone,
      tone: "bg-brand-soft text-brand-soft-fg",
    });
  }
  const requests = community.requests;
  const mine = owner ? requests.filter((r) => r.ownerId === owner.id) : [];
  const updated = mine
    .map((r) => ({ r, last: [...r.thread].sort((a, b) => (a.at < b.at ? 1 : -1))[0] }))
    // The app's own routing line on a new request is not news from the board.
    .filter(
      (x) =>
        x.last &&
        x.last.actorRole !== "resident" &&
        x.last.actorRole !== "system" &&
        daysFromToday(x.last.at) >= -14,
    )
    .sort((a, b) => (a.last.at < b.last.at ? 1 : -1))[0];
  const answered = owner
    ? community.threads
        .filter((t) => t.ownerId === owner.id)
        .map((t) => ({ t, last: t.messages[t.messages.length - 1] }))
        .filter((x) => x.last && x.last.fromRole !== "resident" && daysFromToday(x.last.at) >= -14)
        .sort((a, b) => (a.t.updatedDate < b.t.updatedDate ? 1 : -1))[0]
    : undefined;
  if (answered) {
    notices.push({
      id: "message",
      title: `The board replied: ${answered.t.subject}`,
      detail: answered.last.body,
      href: "/resident/messages",
      icon: Mail,
      tone: "bg-info-soft text-info",
    });
  }
  if (updated) {
    notices.push({
      id: "request",
      title: `The board answered: ${updated.r.title}`,
      detail: updated.last.body,
      href: `/resident/requests/${encodeURIComponent(updated.r.reference)}`,
      icon: ClipboardCheck,
      tone: "bg-info-soft text-info",
    });
  }
  return notices;
}

function BellPanel({
  notices,
  compact,
}: {
  notices: Notice[];
  /** Fits inside the phone frame rather than hanging off the viewport. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const read = useReadNotices();
  const keyed = notices.map((n) => ({ ...n, key: noticeKey(n), read: read.has(noticeKey(n)) }));
  const present = keyed.map((n) => n.key);
  const unread = keyed.filter((n) => !n.read).length;

  function markRead(keys: string[]) {
    readStore().markRead(keys, present);
  }
  // Where the panel sits, measured from the bell when it opens. Anchoring it
  // to the bell's right edge with a fixed width ran it 40px off the left of
  // a 320px screen, since the bell is not at the screen's edge.
  const [place, setPlace] = useState<{ top: number; right: number; width: number } | null>(null);

  // Escape closes it, and so does opening search: the panel sat on top of
  // the search overlay with nothing but a click to get rid of it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle(bell: HTMLButtonElement) {
    if (open) {
      setOpen(false);
      return;
    }
    const r = bell.getBoundingClientRect();
    const gutter = 8;
    const width = Math.min(compact ? 304 : 320, window.innerWidth - gutter * 2);
    // Right-aligned under the bell when it fits, pulled in when it does not.
    const right = Math.min(
      Math.max(gutter, window.innerWidth - r.right),
      window.innerWidth - width - gutter,
    );
    setPlace({ top: r.bottom + 8, right, width });
    setOpen(true);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          unread === 0 ? "Notifications" : `Notifications, ${pluralize(unread, "unread")}`
        }
        aria-expanded={open}
        onClick={(e) => toggle(e.currentTarget)}
        className="press relative flex size-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:size-9"
      >
        <Bell className="size-[18px]" strokeWidth={1.9} />
        {unread > 0 ? (
          <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {/* Portalled to the body. The dashboard's bell sits in a frosted tray,
          and a backdrop filter makes its box the frame for anything fixed
          inside it, so the panel landed inside the photo and was cut off. */}
      {open && place
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close notifications"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setOpen(false)}
              />
              <div
                className="fixed z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-card border border-border bg-surface shadow-float"
                style={{ top: place.top, right: place.right, width: place.width }}
              >
                <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border px-4 py-2">
                  <p className="text-footnote font-semibold text-fg-muted">Notifications</p>
                  {unread > 0 ? (
                    <button
                      type="button"
                      onClick={() => markRead(present)}
                      className="press -mr-2 rounded-md px-2 py-1 text-footnote font-medium text-brand hover:bg-surface-2"
                    >
                      Mark all as read
                    </button>
                  ) : null}
                </div>
                {keyed.length === 0 ? (
                  <p className="px-4 py-6 text-center text-callout text-fg-muted">
                    Nothing needs you right now.
                  </p>
                ) : (
                  keyed.map(({ icon: Icon, ...n }) => (
                    <Link
                      key={n.key}
                      href={n.href}
                      onClick={() => {
                        markRead([n.key]);
                        setOpen(false);
                      }}
                      className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-2"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                          n.read ? "bg-surface-2 text-fg-subtle" : n.tone,
                        )}
                      >
                        <Icon className="size-4" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-callout leading-snug",
                            n.read ? "font-normal text-fg-muted" : "font-medium text-fg",
                          )}
                        >
                          {n.title}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-caption leading-snug text-fg-muted">
                          {n.detail}
                        </span>
                      </span>
                      {n.read ? null : (
                        <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-brand" />
                      )}
                      <span className="sr-only">{n.read ? "Read" : "Unread"}</span>
                    </Link>
                  ))
                )}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

export function BoardBell() {
  return <BellPanel notices={useBoardNotices()} />;
}

export function ResidentBell({ compact }: { compact?: boolean }) {
  return <BellPanel notices={useResidentNotices()} compact={compact} />;
}
