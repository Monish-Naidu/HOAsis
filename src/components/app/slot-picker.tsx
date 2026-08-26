"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { bookableDays, describeRules, formatMinute, slotsFor } from "@/lib/bookings";
import type { AmenityBooking, CommunityAmenity } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * Picking a time, with the board's rules already applied.
 *
 * Only slots that comply are offered, and a slot that is blocked says which
 * rule blocked it. "Already booked" and "you have one today" are different
 * problems with different answers, and greying both out identically teaches a
 * resident nothing except that the software dislikes them.
 */
export function SlotPicker({
  amenity,
  bookings,
  unit,
  value,
  onChange,
}: {
  amenity: CommunityAmenity;
  bookings: AmenityBooking[];
  unit: string;
  value: { date: string; startMinute: number } | null;
  onChange: (next: { date: string; startMinute: number; endMinute: number } | null) => void;
}) {
  const days = useMemo(() => bookableDays(amenity), [amenity]);
  const [date, setDate] = useState(days[0]);
  const slots = useMemo(
    () => slotsFor(amenity, date, bookings, unit),
    [amenity, date, bookings, unit],
  );

  const free = slots.filter((s) => s.allowed).length;

  return (
    <div className="rounded-card border border-border bg-surface-2 p-4">
      <p className="flex items-start gap-1.5 text-[13px] leading-snug text-fg-muted">
        <CalendarDays className="mt-0.5 size-3.5 shrink-0" />
        {describeRules(amenity)}
      </p>

      {/* A horizontal strip of days rather than a calendar. A month grid is a
          lot of interface for choosing between today and next Tuesday. */}
      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {days.slice(0, 14).map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => {
              setDate(day);
              onChange(null);
            }}
            aria-pressed={date === day}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-center transition-colors",
              date === day ? "bg-brand text-brand-fg" : "bg-surface text-fg-muted hover:text-fg",
            )}
          >
            <span className="block text-[11px] font-medium uppercase tracking-wide opacity-75">
              {formatDate(day, "short").split(" ")[0]}
            </span>
            <span className="block text-[15px] font-semibold">{Number(day.slice(8, 10))}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((slot) => {
          const picked = value?.date === date && value?.startMinute === slot.startMinute;
          return (
            <button
              key={slot.startMinute}
              type="button"
              disabled={!slot.allowed}
              title={slot.blockedBecause}
              onClick={() =>
                onChange({ date, startMinute: slot.startMinute, endMinute: slot.endMinute })
              }
              className={cn(
                "rounded-lg border px-2 py-2.5 text-[15px] font-medium transition-colors",
                picked
                  ? "border-brand bg-brand text-brand-fg"
                  : slot.allowed
                    ? "border-border-2 bg-surface text-fg hover:bg-surface-3"
                    : "cursor-not-allowed border-transparent bg-surface-3 text-fg-subtle line-through",
              )}
            >
              {slot.label}
            </button>
          );
        })}
      </div>

      {free === 0 ? (
        <p className="mt-3 text-[13px] text-warn">
          {slots[0]?.blockedBecause ?? "Nothing free"} on{" "}
          {formatDate(date, "medium")}. Try another day.
        </p>
      ) : null}

      {value ? (
        <p className="mt-3 text-[13px] text-fg-muted">
          <span className="font-semibold text-fg">
            {formatDate(value.date, "medium")}, {formatMinute(value.startMinute)}
          </span>{" "}
          held for you until the board confirms.
        </p>
      ) : null}
    </div>
  );
}
