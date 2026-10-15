"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarOff } from "lucide-react";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { MeetingJoinDetails } from "@/components/app/meeting-rsvps";
import { useAppState } from "@/lib/app-state";
import { meetingPhase } from "@/lib/phases";
import { attendedLine, cancelledLine, wasLine } from "@/lib/meeting-notices";
import { formatDate, relativeDays } from "@/lib/utils";
import type { Meeting } from "@/lib/types";

/**
 * One meeting, in full: when and where, what is on the agenda, how to join,
 * and the minutes once they are recorded. Every list that names a meeting on
 * the resident side opens here.
 *
 * The record is read in the browser from the same state the lists read, the
 * way the request detail does, so the page prerenders like every other one
 * and nothing is fetched for a second time.
 */
export default function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { community } = useAppState();
  const meeting = community.meetings.find((m) => m.id === decodeURIComponent(id));

  if (!meeting) {
    return (
      <div className="animate-rise space-y-5">
        <Link
          href="/resident/calendar"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-body font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          All meetings
        </Link>
        <EmptyState
          icon={<CalendarOff className="size-5" />}
          title="Meeting not found"
          description="It may have been removed. Go back to Meetings and pick it from the list."
        />
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-5">
      <Link
        href="/resident/calendar"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-body font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        All meetings
      </Link>

      <MeetingHeader meeting={meeting} />

      {/* A meeting that is over has no call to join; a cancelled one never
          did. Everything else shows the one link and how to dial. */}
      {meetingPhase(meeting) === "ended" || meeting.status === "cancelled" ? null : (
        <Card className="p-4">
          <MeetingJoinDetails meeting={meeting} />
        </Card>
      )}

      {meeting.agenda.length ? (
        <section>
          <SectionTitle>Agenda</SectionTitle>
          <Card className="p-4">
            <ol className="space-y-1">
              {meeting.agenda.map((item, i) => (
                <li key={`${i}-${item}`} className="flex gap-2 text-body text-fg-muted">
                  <span className="tnum shrink-0 text-fg-subtle">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      ) : null}

      {meeting.minutes?.trim() ? (
        <section>
          <SectionTitle>Minutes</SectionTitle>
          <Card className="p-4">
            <p className="whitespace-pre-line text-body leading-relaxed text-fg-muted">
              {meeting.minutes}
            </p>
            {meeting.attended?.length ? (
              <p className="mt-3 border-t border-border pt-3 text-footnote text-fg-subtle">
                Attended: {meeting.attended.map((a) => a.name).join(", ")}
              </p>
            ) : null}
          </Card>
        </section>
      ) : null}
    </div>
  );
}

/** The meeting's name, when and where it sits, and the marks beside it. */
function MeetingHeader({ meeting: m }: { meeting: Meeting }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {m.status === "live" ? <Badge tone="ok">Meeting on now</Badge> : null}
        {m.status === "cancelled" ? <Badge tone="danger">Cancelled</Badge> : null}
      </div>
      <h1 className="text-title3 font-semibold leading-snug tracking-[-0.02em] text-fg">
        {m.title}
      </h1>
      <p className="mt-2 text-body leading-relaxed text-fg-muted">
        {formatDate(m.date, "long")} · {relativeDays(m.date)} · {m.time} · {m.location}
      </p>
      {/* The date it was first noticed for, when the board moved it. The
          date above is the one that counts; this is the memory. */}
      {wasLine(m) ? <p className="mt-1 text-footnote text-fg-subtle">{wasLine(m)}</p> : null}
      {m.status === "cancelled" ? (
        <p className="mt-1 text-footnote font-medium text-danger">{cancelledLine(m)}</p>
      ) : null}
      {attendedLine(m) ? (
        <p className="mt-1 text-footnote text-fg-subtle">{attendedLine(m)}</p>
      ) : null}
    </div>
  );
}
