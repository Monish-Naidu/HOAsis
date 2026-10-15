"use client";

import Link from "next/link";
import { pinnedFirst } from "@/lib/announcements";
import { ChevronDown, ChevronRight, Megaphone } from "lucide-react";
import { Card, IconTile, SectionTitle } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import type { Announcement } from "@/lib/types";
import { currentAnnouncements, meetingOfAnnouncement, meetingPage } from "@/lib/meeting-notices";
import { formatDate, todayIsoDate } from "@/lib/utils";

/** How many show before the "Earlier announcements" fold: the pinned one and the newest. */
const SHOWN = 3;

/**
 * What the board posted, on the resident home.
 *
 * This is the only place an owner reads announcements, so none of them is
 * cut off for good: a card shows two lines and opens in place to the whole
 * text, and everything past the newest three sits under one fold. The
 * browser's own <details> does the opening, so it works without script and
 * the page stays prerendered.
 */
export function Announcements() {
  const { community } = useAppState();
  const newestFirst = pinnedFirst(
    currentAnnouncements(
      community.announcements,
      community.meetings,
      community.documents,
      todayIsoDate(),
    ),
  );
  const pinned = newestFirst.find((a) => a.pinned);
  const others = newestFirst.filter((a) => a !== pinned);
  const shown = others.slice(0, pinned ? SHOWN - 1 : SHOWN);
  const earlier = others.slice(shown.length);
  if (!pinned && shown.length === 0) return null;

  // The notice the board posted names the meeting in its own words; a card
  // rewritten by the app can drop the day it names, so the match runs on the
  // announcement as it was posted.
  const meetingLink = (a: Announcement): string | null => {
    const original = community.announcements.find((x) => x.id === a.id);
    const meeting = original ? meetingOfAnnouncement(original, community.meetings) : undefined;
    return meeting ? meetingPage(meeting.id) : null;
  };

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
              <AnnouncementTitle announcement={pinned} href={meetingLink(pinned)} />
              <p className="mt-1.5 text-body leading-relaxed text-fg-muted">{pinned.body}</p>
              <p className="mt-2.5 text-footnote text-fg-subtle">
                {pinned.author} · {formatDate(pinned.postedDate)}
              </p>
            </div>
          </Card>
        ) : null}
        {shown.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} href={meetingLink(a)} />
        ))}
      </div>

      {earlier.length > 0 ? (
        <details className="group mt-4">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-card border border-border bg-surface px-4 py-3 text-callout font-medium text-fg transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
            Earlier announcements ({earlier.length})
            <ChevronDown className="size-4 text-fg-subtle transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-3 @3xl:grid-cols-2 [&>*]:min-w-0">
            {earlier.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} href={meetingLink(a)} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

/** The card's title: a plain heading, or the link to the meeting it names. */
function AnnouncementTitle({
  announcement: a,
  href,
  className,
}: {
  announcement: Announcement;
  href: string | null;
  className?: string;
}) {
  if (!href) {
    return (
      <h3
        className={`text-body font-semibold leading-snug tracking-[-0.01em] text-fg${className ? ` ${className}` : ""}`}
      >
        {a.title}
      </h3>
    );
  }
  return (
    <Link
      href={href}
      className={`flex w-fit max-w-full items-start gap-1 text-body font-semibold leading-snug tracking-[-0.01em] text-fg underline decoration-border-2 underline-offset-2 hover:decoration-fg${className ? ` ${className}` : ""}`}
    >
      {a.title}
      <ChevronRight className="mt-1 size-3.5 shrink-0 text-fg-subtle" />
    </Link>
  );
}

/** Two lines of the text while closed, all of it once opened, in the same place. */
function AnnouncementCard({
  announcement: a,
  href,
}: {
  announcement: Announcement;
  /** Set when the announcement is a notice about a meeting, whose own page carries the whole story. */
  href: string | null;
}) {
  if (href) {
    // A meeting notice has a page of its own with the agenda and how to
    // join, so the card shows its short text whole and the title opens it,
    // rather than folding the two sentences behind a "Read more".
    return (
      <Card>
        <div className="px-4 pt-4">
          <span className="block text-footnote font-semibold text-fg-muted">{a.category}</span>
          <AnnouncementTitle announcement={a} href={href} className="mt-1" />
          <p className="mt-1.5 text-body leading-relaxed text-fg-muted">{a.body}</p>
        </div>
        <p className="mt-2.5 px-4 pb-4 text-footnote text-fg-subtle">
          {a.author} · {formatDate(a.postedDate)}
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <details className="group/card">
        <summary className="cursor-pointer list-none px-4 pt-4 [&::-webkit-details-marker]:hidden">
          <span className="block text-footnote font-semibold text-fg-muted">{a.category}</span>
          <AnnouncementTitle announcement={a} href={null} className="mt-1" />
          <p className="mt-1.5 line-clamp-2 text-body leading-relaxed text-fg-muted group-open/card:line-clamp-none">
            {a.body}
          </p>
          <span className="mt-2 flex items-center gap-1 text-footnote font-medium text-accent">
            <span className="group-open/card:hidden">Read more</span>
            <span className="hidden group-open/card:inline">Show less</span>
            <ChevronDown className="size-3 transition-transform group-open/card:rotate-180" />
          </span>
        </summary>
      </details>
      <p className="mt-2.5 px-4 pb-4 text-footnote text-fg-subtle">
        {a.author} · {formatDate(a.postedDate)}
      </p>
    </Card>
  );
}
