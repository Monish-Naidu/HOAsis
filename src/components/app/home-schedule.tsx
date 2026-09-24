"use client";

import Link from "next/link";
import { CalendarOff, Megaphone } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { kindLabel, kindTone, upcomingFrom, type CalendarEntry } from "@/lib/calendar";
import { formatDate, relativeDays } from "@/lib/utils";

/**
 * Not every association runs a calendar. Some just meet quarterly, so the
 * admin can swap the whole block for a single banner they edit by hand.
 */
export function HomeSchedule({ entries }: { entries: CalendarEntry[] }) {
  const { settings, community } = useAppState();

  if (settings.homeLayout === "banner") {
    if (!settings.banner.enabled) return null;
    return (
      <Card className="overflow-hidden border-navy-800 bg-navy-900 text-navy-50 dark:border-navy-700">
        <div className="flex items-start gap-3 p-4">
          <Megaphone className="mt-0.5 size-4 shrink-0 text-navy-300" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-snug">{settings.banner.title}</p>
            {settings.banner.detail ? (
              <p className="mt-1 text-[13px] leading-relaxed text-navy-200">
                {settings.banner.detail}
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  const next = upcomingFrom(entries, community.asOf, 3);

  return (
    // The same card and header Recent activity wears, so the two sit side by
    // side on the dashboard as equals rather than a card next to a heading.
    <Card className="h-full">
      <CardHeader
        accent="amber"
        title="Next up"
        action={
          <Link
            href="/resident/calendar"
            className="text-[13px] font-medium text-accent hover:underline"
          >
            Full calendar
          </Link>
        }
      />
      <div>
        {next.length ? (
          <>
            {next.map((e, i) => (
              <Link
                key={e.id}
                href={e.href ?? "/resident/calendar"}
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-3">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">
                    {formatDate(e.date).split(" ")[0]}
                  </span>
                  <span className="tnum text-[15px] font-semibold leading-none text-fg">
                    {formatDate(e.date).split(" ")[1]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  {/* Two lines before it cuts: at 320px one line left
                      "Special board me..." and nothing to go on. */}
                  <p className="line-clamp-2 text-[15px] font-medium leading-snug text-fg">{e.title}</p>
                  <p className="truncate text-[13px] text-fg-muted">
                    {/* On a phone the kind leads this line instead of
                        taking a badge's width from the title. */}
                    <span className="@md:hidden">{kindLabel[e.kind]} · </span>
                    {relativeDays(e.date)}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </p>
                </div>
                <span className="hidden shrink-0 @md:inline-flex">
                  <Badge tone={kindTone[e.kind]}>{kindLabel[e.kind]}</Badge>
                </span>
              </Link>
            ))}
          </>
        ) : (
          <EmptyState
            icon={<CalendarOff className="size-5" />}
            title="Nothing scheduled"
            description="Meetings and events show up here once the board sets them."
          />
        )}
      </div>
    </Card>
  );
}
