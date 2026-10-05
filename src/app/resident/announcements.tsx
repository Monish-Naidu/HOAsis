"use client";

import { pinnedFirst } from "@/lib/announcements";
import { ChevronDown, Megaphone } from "lucide-react";
import { Card, IconTile, SectionTitle } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import type { Announcement } from "@/lib/types";
import { formatDate } from "@/lib/utils";

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
  const newestFirst = pinnedFirst(community.announcements);
  const pinned = newestFirst.find((a) => a.pinned);
  const others = newestFirst.filter((a) => a !== pinned);
  const shown = others.slice(0, pinned ? SHOWN - 1 : SHOWN);
  const earlier = others.slice(shown.length);
  if (!pinned && shown.length === 0) return null;

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
        {shown.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} />
        ))}
      </div>

      {earlier.length > 0 ? (
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-footnote font-semibold text-fg-muted [&::-webkit-details-marker]:hidden">
            Earlier announcements ({earlier.length})
            <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-3 @3xl:grid-cols-2 [&>*]:min-w-0">
            {earlier.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

/** Two lines of the text while closed, all of it once opened, in the same place. */
function AnnouncementCard({ announcement: a }: { announcement: Announcement }) {
  return (
    <Card>
      <details className="group/card">
        <summary className="cursor-pointer list-none px-4 pt-4 [&::-webkit-details-marker]:hidden">
          <span className="text-footnote font-semibold text-fg-muted">{a.category}</span>
          <h3 className="mt-1 text-body font-semibold leading-snug tracking-[-0.01em] text-fg">
            {a.title}
          </h3>
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
