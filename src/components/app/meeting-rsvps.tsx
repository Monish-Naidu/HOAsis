"use client";

import { CalendarOff, Radio, Users } from "lucide-react";
import { MeetingRoom } from "@/components/app/meeting-room";
import { useToast } from "@/components/app/toast";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { EntryRow } from "@/components/app/calendar-view";
import { kindLabel, kindTone, upcomingFrom } from "@/lib/calendar";
import { calendarEntries } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import { cn, formatDate, relativeDays } from "@/lib/utils";

/**
 * Everything coming up, once, with the RSVP on the meeting's own row.
 *
 * The calendar page used to list the same two meetings twice: under "Next
 * up" as calendar entries, then again under "Are you coming?" with the
 * buttons. One list now, soonest first; ballots and deadlines sit in it as
 * plain rows that open where they are acted on.
 */
export function MeetingRsvps() {
  const { community, account, rsvpMeeting } = useAppState();
  const { notify } = useToast();
  const upcoming = upcomingFrom(calendarEntries(community), community.asOf, 8);

  return (
    <section>
      <SectionTitle>Coming up</SectionTitle>
      <Card>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarOff className="size-5" />}
            title="Nothing scheduled"
            description="Meetings and votes appear here once the board sets them."
          />
        ) : null}
        {upcoming.map((entry, i) => {
          const m =
            entry.kind === "meeting"
              ? community.meetings.find((x) => `cal-${x.id}` === entry.id && x.status === "scheduled")
              : undefined;
          if (!m) return <EntryRow key={entry.id} entry={entry} divided={i > 0} showDate />;
          // The person's own answer, and how many neighbours said yes. The
          // board sees the names; here a count is all a resident needs.
          const mine = (m.rsvps ?? []).find((r) => r.profileId === account?.id)?.response;
          const coming = (m.rsvps ?? []).filter((r) => r.response === "yes").length;
          return (
            <div
              key={m.id}
              id={`meeting-${m.id}`}
              className={cn("scroll-mt-24 px-4 py-3", i > 0 && "border-t border-border")}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-medium text-fg">{m.title}</p>
                <Badge tone={kindTone.meeting}>{kindLabel.meeting}</Badge>
              </div>
              <p className="mt-0.5 text-footnote text-fg-muted">
                {formatDate(m.date, "long")} · {relativeDays(m.date)} · {m.time} · {m.location}
              </p>
              {m.dialIn ? (
                <p className="mt-1 text-footnote text-fg-subtle">
                  Video call:{" "}
                  <a
                    href={m.dialIn}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    join link
                  </a>
                  {m.passcode ? ` · passcode ${m.passcode}` : ""}
                </p>
              ) : null}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Button
                  variant={mine === "yes" ? "primary" : "secondary"}
                  size="sm"
                  aria-pressed={mine === "yes"}
                  onClick={() =>
                    void rsvpMeeting(m.id, "yes").then((ok) => {
                      if (ok) notify(`See you at ${m.title}.`);
                    })
                  }
                >
                  I&apos;m coming
                </Button>
                <Button
                  variant={mine === "no" ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={mine === "no"}
                  className={cn(mine === "no" && "border-border-2")}
                  onClick={() =>
                    void rsvpMeeting(m.id, "no").then((ok) => {
                      if (ok) notify("Noted. The board knows you cannot make it.", "info");
                    })
                  }
                >
                  Can&apos;t make it
                </Button>
                {coming > 0 ? (
                  <span className="inline-flex items-center gap-1 text-footnote text-fg-subtle">
                    <Users className="size-3" />
                    {coming} coming
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}

/** The meeting happening right now, joinable. Nothing when there is none. */
export function LiveMeetingCard() {
  const { community } = useAppState();
  const live = community.meetings.find((m) => m.status === "live");
  if (!live) return null;
  return (
    <Card className="overflow-hidden border-ok/30">
      <div className="flex items-center gap-2 bg-ok-soft px-4 py-2.5">
        <Radio className="size-3.5 shrink-0 text-ok" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-ok">{live.title}</p>
          <p className="text-footnote text-ok opacity-90">
            Meeting on now · {live.attendees.length} joined
          </p>
        </div>
      </div>
      <MeetingRoom meeting={live} compact />
    </Card>
  );
}
