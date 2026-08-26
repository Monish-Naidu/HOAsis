"use client";

import Link from "next/link";
import { CalendarDays, CalendarOff, ChevronRight, Megaphone } from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
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
    <section>
      <SectionTitle
        action={
          <Link href="/resident/calendar" className="text-[13px] font-medium text-accent">
            Full calendar
          </Link>
        }
      >
        Next up
      </SectionTitle>
      <Card>
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
                  <p className="truncate text-[15px] font-medium text-fg">{e.title}</p>
                  <p className="truncate text-[13px] text-fg-muted">
                    {relativeDays(e.date)}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </p>
                </div>
                <Badge tone={kindTone[e.kind]}>{kindLabel[e.kind]}</Badge>
              </Link>
            ))}
            <Link
              href="/resident/calendar"
              className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-[13px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <CalendarDays className="size-3.5" />
              Open the calendar
              <ChevronRight className="ml-auto size-3.5" />
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center px-6 py-8 text-center">
            <CalendarOff className="mb-2 size-5 text-fg-subtle" />
            <p className="text-[15px] font-medium text-fg">Nothing scheduled</p>
            <p className="mt-1 text-[13px] text-fg-muted">
              The board posts meetings and events here as they are set.
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}
