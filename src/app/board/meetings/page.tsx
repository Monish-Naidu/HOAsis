"use client";

import { CalendarDays, Radio } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { MeetingRoom } from "@/components/app/meeting-room";
import { useAppState } from "@/lib/app-state";
import { formatDate } from "@/lib/utils";

/**
 * Meetings, on their own page since the 2026-09-01 design. They lived inside
 * Voting; a director looking for tonight's call was scrolling past ballots
 * to find it.
 */
export default function BoardMeetings() {
  const { community } = useAppState();
  const live = community.meetings.find((m) => m.status === "live");
  const upcoming = [...community.meetings]
    .filter((m) => m.status !== "ended")
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const ended = community.meetings.filter((m) => m.status === "ended");
  const scheduledMeetings = upcoming.filter((m) => m.status !== "live");
  const nextMeeting = scheduledMeetings[0];

  return (
    <>
      <PageHeader eyebrow="Governance" title="Meetings" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Live now"
          value={live ? "1 meeting" : "None"}
          tone={live ? "ok" : "neutral"}
          hint={live ? `${live.attendees.length} joined` : undefined}
          icon={<Radio className="size-4" />}
        />
        <Stat
          label="Next meeting"
          value={nextMeeting ? formatDate(nextMeeting.date) : "None"}
          hint={nextMeeting?.title}
          icon={<CalendarDays className="size-4" />}
        />
        <Stat label="Scheduled" value={String(scheduledMeetings.length)} />
        <Stat
          label="Held this year"
          value={String(ended.length)}
          hint={
            ended.some((m) => m.recordingAvailable)
              ? "Recordings on the meeting record"
              : undefined
          }
        />
      </div>

      {live ? (
        <Card className="mt-5 overflow-hidden border-ok/30">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-ok-soft px-5 py-3">
            <Badge tone="ok" dot>
              Live
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ok">{live.title}</p>
              <p className="text-[13px] text-ok opacity-90">
                {live.time} · {live.attendees.length} joined · notice sent{" "}
                {formatDate(live.noticeSentDate!, "long")}
              </p>
            </div>
          </div>
          <div className="grid lg:grid-cols-5">
            <div className="lg:col-span-3">
              <MeetingRoom meeting={live} />
              <div className="border-t border-border px-4 py-3">
                <p className="text-[13px] font-semibold text-fg-muted">
                  In the room
                </p>
                <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {live.attendees.map((a) => (
                    <li key={a.name} className="flex items-center gap-2 text-[13px] text-fg-muted">
                      <span className="size-1.5 shrink-0 rounded-full bg-ok" />
                      <span className="truncate">{a.name}</span>
                      <span className="ml-auto shrink-0 text-fg-subtle">
                        {a.role ?? `Unit ${a.unit}`} · {a.channel}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-border px-5 py-4 lg:col-span-2 lg:border-l lg:border-t-0">
              <p className="text-[13px] font-semibold text-fg-muted">
                Agenda
              </p>
              <ol className="mt-2 space-y-1.5">
                {live.agenda.map((item, i) => (
                  <li key={item} className="flex gap-2 text-[15px] text-fg-muted">
                    <span className="tnum shrink-0 text-fg-subtle">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-snug text-fg-muted">
                Item 3 is the open board ballot on the Voting tab. Directors can vote without
                leaving the call.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mt-5">
        <CardHeader title="Upcoming" icon={<CalendarDays className="size-4" />} />
        {upcoming.map((m) => (
          <div
            key={m.id}
            className="flex items-start gap-3 border-b border-border px-5 py-3.5 last:border-b-0"
          >
            <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-3">
              <span className="text-[12px] font-semibold uppercase text-fg-subtle">
                {formatDate(m.date).split(" ")[0]}
              </span>
              <span className="tnum text-[15px] font-semibold leading-none text-fg">
                {formatDate(m.date).split(" ")[1]}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-medium text-fg">{m.title}</p>
                {m.status === "live" ? (
                  <Badge tone="ok" dot>
                    Live
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-[13px] text-fg-muted">
                {m.time} · {m.location}
              </p>
              <p className="mt-0.5 text-[13px] text-fg-subtle">
                {m.noticeSentDate
                  ? `Notice sent ${formatDate(m.noticeSentDate, "long")}`
                  : "Notice not sent"}
                {m.ballotIds.length ? ` · ${m.ballotIds.length} ballot on the agenda` : ""}
              </p>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
