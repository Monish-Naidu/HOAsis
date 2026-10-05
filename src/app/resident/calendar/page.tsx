"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import Link from "next/link";
import { ChevronRight, Vote } from "lucide-react";
import { Card, IconTile } from "@/components/ui/primitives";
import { CalendarView } from "@/components/app/calendar-view";
import { LiveMeetingCard, MeetingRsvps } from "@/components/app/meeting-rsvps";
import { calendarEntries } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import { ballotPhase } from "@/lib/phases";

export default function ResidentCalendar() {
  const { community } = useAppState();
  // The count on the Meetings row is these, so the page says them in words.
  const toVote = community.ballots.filter(
    (b) => b.audience === "owners" && ballotPhase(b) === "open" && !b.myVoteOptionId,
  ).length;
  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle title="Meetings" subtitle="Board meetings and what is on the calendar" />
      {toVote > 0 ? (
        <Card>
          <Link
            href="/resident/vote"
            className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <IconTile icon={Vote} tint="violet" size="sm" />
            <span className="min-w-0 flex-1 text-body font-semibold text-fg">
              {toVote === 1 ? "A ballot needs your vote" : `${toVote} ballots need your vote`}
            </span>
            <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
          </Link>
        </Card>
      ) : null}
      <LiveMeetingCard />
      {/* What is coming first, with the RSVPs; the month underneath for
          anybody looking for a date. */}
      <MeetingRsvps />
      <CalendarView entries={calendarEntries(community)} asOf={community.asOf} showUpcoming={false} />
    </div>
  );
}
