"use client";

import { CalendarView } from "@/components/app/calendar-view";
import { LiveMeetingCard, MeetingRsvps } from "@/components/app/meeting-rsvps";
import { calendarEntries } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";

export default function ResidentCalendar() {
  const { community } = useAppState();
  return (
    <div className="animate-rise space-y-6">
      <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
        Meetings and events
      </h1>
      <LiveMeetingCard />
      <CalendarView entries={calendarEntries(community)} asOf={community.asOf} />
      <MeetingRsvps />
    </div>
  );
}
