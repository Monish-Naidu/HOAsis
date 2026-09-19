"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import {
  kindLabel,
  kindTone,
  monthGrid,
  monthName,
  upcomingFrom,
  type CalendarEntry,
} from "@/lib/calendar";
import { cn, formatDate, relativeDays, todayIsoDate } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarView({
  entries,
  asOf = todayIsoDate(),
}: {
  entries: CalendarEntry[];
  /** The community's own "today", so it does not open on an empty month. */
  asOf?: string;
}) {
  const today = new Date(`${asOf}T12:00:00Z`);
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [selected, setSelected] = useState<string | null>(asOf);

  const cells = monthGrid(year, month, entries, asOf);
  const selectedEntries = selected ? entries.filter((e) => e.date === selected) : [];
  const upcoming = upcomingFrom(entries, asOf, 5);

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
    setSelected(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shift(-1)}
            className="flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-[15px] font-semibold text-fg">{monthName(year, month)}</p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shift(1)}
            className="flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-border px-2 py-1.5">
          {WEEKDAYS.map((d, i) => (
            <span
              key={i}
              className="text-center text-[12px] font-semibold uppercase tracking-wide text-fg-subtle"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-border p-px">
          {cells.map((c) => {
            const isSelected = c.date === selected;
            return (
              <button
                key={c.date}
                type="button"
                onClick={() => setSelected(c.date)}
                aria-label={`${formatDate(c.date, "long")}, ${c.entries.length} items`}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center gap-1 bg-surface transition-colors",
                  !c.inMonth && "opacity-35",
                  isSelected ? "bg-brand-soft" : "hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "tnum flex size-6 items-center justify-center rounded-full text-[13px]",
                    c.isToday
                      ? "bg-navy-900 font-semibold text-navy-50 dark:bg-navy-100 dark:text-navy-950"
                      : "font-medium text-fg",
                  )}
                >
                  {c.day}
                </span>
                {c.entries.length ? (
                  <span className="flex gap-0.5">
                    {c.entries.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={cn(
                          "size-1 rounded-full",
                          e.kind === "meeting" && "bg-navy-600 dark:bg-navy-300",
                          e.kind === "event" && "bg-ok",
                          e.kind === "ballot-opens" && "bg-info",
                          (e.kind === "ballot-closes" || e.kind === "deadline") && "bg-warn",
                        )}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="size-1" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {selected ? (
        <Card>
          <p className="border-b border-border px-4 py-2.5 text-[13px] font-semibold text-fg-muted">
            {formatDate(selected, "long")}
          </p>
          {selectedEntries.length ? (
            selectedEntries.map((e, i) => (
              <EntryRow key={e.id} entry={e} divided={i > 0} />
            ))
          ) : (
            <EmptyState
              icon={<CalendarOff className="size-5" />}
              title="Nothing on this day"
            />
          )}
        </Card>
      ) : null}

      <div>
        <h2 className="mb-3 text-[13px] font-semibold text-fg-muted">
          Next up
        </h2>
        <Card>
          {upcoming.length ? (
            upcoming.map((e, i) => <EntryRow key={e.id} entry={e} divided={i > 0} showDate />)
          ) : (
            <EmptyState
              icon={<CalendarOff className="size-5" />}
              title="Nothing scheduled"
              description="Meetings and events appear here once scheduled."
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  divided,
  showDate,
}: {
  entry: CalendarEntry;
  divided?: boolean;
  showDate?: boolean;
}) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-medium text-fg">{entry.title}</p>
          <Badge tone={kindTone[entry.kind]}>{kindLabel[entry.kind]}</Badge>
        </div>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          {showDate ? `${formatDate(entry.date, "long")} · ${relativeDays(entry.date)}` : null}
          {showDate && entry.detail ? " · " : null}
          {entry.detail}
        </p>
      </div>
    </>
  );
  const cls = cn(
    "flex items-center gap-3 px-4 py-3",
    divided && "border-t border-border",
    entry.href && "transition-colors hover:bg-surface-2",
  );
  return entry.href ? (
    <Link href={entry.href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
