"use client";

import { CalendarView } from "@/components/app/calendar-view";
import { calendarEntries } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";

export default function ResidentCalendar() {
  const { community } = useAppState();
  return (
    <div className="animate-rise">
      <h1 className="mb-4 text-[22px] font-semibold tracking-[-0.025em] text-fg">Calendar</h1>
      <CalendarView entries={calendarEntries(community)} asOf={community.asOf} />
    </div>
  );
}
