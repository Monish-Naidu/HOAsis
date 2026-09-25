"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import { CalendarView } from "@/components/app/calendar-view";
import { LiveMeetingCard, MeetingRsvps } from "@/components/app/meeting-rsvps";
import { calendarEntries } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";

export default function ResidentCalendar() {
  const { community } = useAppState();
  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle title="Meetings" subtitle="Board meetings and what is on the calendar" />
      <LiveMeetingCard />
      {/* What is coming first, with the RSVPs; the month underneath for
          anybody looking for a date. */}
      <MeetingRsvps />
      <CalendarView entries={calendarEntries(community)} asOf={community.asOf} showUpcoming={false} />
    </div>
  );
}
