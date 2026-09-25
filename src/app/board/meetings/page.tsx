"use client";

import { useState } from "react";
import { CalendarDays, CalendarPlus, ChevronDown, Megaphone } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { MeetingRoom } from "@/components/app/meeting-room";
import { ScheduleMeeting } from "@/components/app/schedule-meeting";
import { ActionItems } from "@/components/app/action-items";
import { useAppState } from "@/lib/app-state";
import { cn, formatDate, pluralize } from "@/lib/utils";
import { useToast } from "@/components/app/toast";
import type { Meeting } from "@/lib/types";
import { useHomeLabel } from "@/components/app/use-home-label";

/**
 * Who said they are coming. A headcount before the day is how a board knows
 * whether to book the clubhouse or the President's kitchen, and whether an
 * annual meeting will make quorum at all.
 */
function Rsvps({ meeting }: { meeting: Meeting }) {
  const placeLabel = useHomeLabel();
  const rsvps = meeting.rsvps ?? [];
  if (rsvps.length === 0) return null;
  const coming = rsvps.filter((r) => r.response === "yes");
  const not = rsvps.filter((r) => r.response === "no");
  return (
    <details className="mt-1.5 text-footnote">
      <summary className="cursor-pointer select-none font-medium text-fg-muted hover:text-fg">
        {coming.length} coming{not.length ? ` · ${not.length} can't` : ""}
      </summary>
      <ul className="mt-1.5 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
        {[...coming, ...not].map((r) => (
          <li key={r.profileId ?? `${r.unit}-${r.name}`} className="flex items-center gap-2 text-fg-muted">
            <span
              className={`size-1.5 shrink-0 rounded-full ${r.response === "yes" ? "bg-ok" : "bg-fg-subtle"}`}
            />
            <span className="truncate">{r.name}</span>
            <span className="ml-auto shrink-0 text-fg-subtle">
              {r.unit ? placeLabel(r.unit) : ""}
              {r.response === "no" ? " · can't make it" : ""}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Meetings, on their own page since the 2026-09-01 design. They lived inside
 * Voting; a director looking for tonight's call was scrolling past ballots
 * to find it.
 */
export default function BoardMeetings() {
  const placeLabel = useHomeLabel();
  const { community, sendMeetingNotice } = useAppState();
  const { notify } = useToast();
  const [scheduling, setScheduling] = useState(false);
  const live = community.meetings.find((m) => m.status === "live");
  // The live meeting has its own card above, so it is not also a row here.
  const upcoming = [...community.meetings]
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  // Newest first. What was on the agenda, and who came, is the record the
  // next board inherits; it used to vanish the day the meeting ended.
  const past = [...community.meetings]
    .filter((m) => m.status === "ended")
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Upcoming meetings, attendance, and action items."
        action={
          scheduling ? null : (
            <Button variant="primary" size="md" onClick={() => setScheduling(true)}>
              <CalendarPlus className="size-3.5" />
              Schedule a meeting
            </Button>
          )
        }
      />

      {scheduling ? <ScheduleMeeting onClose={() => setScheduling(false)} /> : null}

      {live ? (
        <Card className="overflow-hidden border-ok/30">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-ok-soft px-5 py-3">
            <Badge tone="ok" dot>
              Live
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-semibold text-ok">{live.title}</p>
              <p className="text-footnote text-ok opacity-90">
                {live.time} · {live.attendees.length} joined · notice sent{" "}
                {formatDate(live.noticeSentDate!, "long")}
              </p>
            </div>
          </div>
          <div className="grid lg:grid-cols-5">
            <div className="lg:col-span-3">
              {/* Secondary: Schedule a meeting is the page's filled button. */}
              <MeetingRoom meeting={live} joinVariant="secondary" />
              <div className="border-t border-border px-4 py-3">
                <p className="text-footnote font-semibold text-fg-muted">
                  In the room
                </p>
                <ul className="mt-2 space-y-1">
                  {live.attendees.map((a) => (
                    <li key={a.name} className="flex items-center gap-2 text-footnote text-fg-muted">
                      <span className="size-1.5 shrink-0 rounded-full bg-ok" />
                      <span className="truncate">{a.name}</span>
                      <span className="ml-auto shrink-0 text-fg-subtle">
                        {a.role ?? placeLabel(a.unit ?? "")} · {a.channel}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-border px-5 py-4 lg:col-span-2 lg:border-l lg:border-t-0">
              <p className="text-footnote font-semibold text-fg-muted">
                Agenda
              </p>
              <ol className="mt-2 space-y-1.5">
                {live.agenda.map((item, i) => (
                  <li key={item} className="flex gap-2 text-body text-fg-muted">
                    <span className="tnum shrink-0 text-fg-subtle">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className={live ? "mt-6" : undefined}>
        <CardHeader title="Upcoming" subtitle="On every resident's calendar" />
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="Nothing scheduled"
            description="Scheduled meetings appear on every resident's calendar."
          />
        ) : null}
        {upcoming.map((m) => (
          <div
            key={m.id}
            id={`mtg-${m.id}`}
            className="flex scroll-mt-32 lg:scroll-mt-24 items-start gap-3 border-b border-border px-5 py-3.5 last:border-b-0"
          >
            <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-3">
              <span className="text-caption font-semibold uppercase text-fg-subtle">
                {formatDate(m.date).split(" ")[0]}
              </span>
              <span className="tnum text-body font-semibold leading-none text-fg">
                {formatDate(m.date).split(" ")[1]}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-medium text-fg">{m.title}</p>
              </div>
              <p className="mt-0.5 text-footnote text-fg-muted">
                {m.time} · {m.location}
              </p>
              <p className={cn("mt-0.5 text-footnote", m.noticeSentDate ? "text-fg-subtle" : "text-warn")}>
                {m.noticeSentDate
                  ? `Notice sent ${formatDate(m.noticeSentDate, "long")}`
                  : "Owners have not been sent notice"}
                {m.ballotIds.length
                  ? ` · ${pluralize(m.ballotIds.length, "ballot")} on the agenda`
                  : ""}
              </p>
              <Rsvps meeting={m} />
            </div>
            {m.noticeSentDate ? null : (
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  sendMeetingNotice(m.id);
                  notify(`Notice of ${m.title} posted to every home`);
                }}
              >
                <Megaphone className="size-3.5" />
                Send notice
              </Button>
            )}
          </div>
        ))}
      </Card>

      {past.length > 0 ? (
        <Card className="mt-6">
          <CardHeader title="Past meetings" subtitle="What was on the agenda, and who came" />
          {past.map((m) => (
            <details
              key={m.id}
              id={`mtg-${m.id}`}
              className="group scroll-mt-32 lg:scroll-mt-24 border-b border-border last:border-b-0"
            >
              <summary className="flex cursor-pointer select-none items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-3">
                  <span className="text-caption font-semibold uppercase text-fg-subtle">
                    {formatDate(m.date).split(" ")[0]}
                  </span>
                  <span className="tnum text-body font-semibold leading-none text-fg">
                    {formatDate(m.date).split(" ")[1]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-fg">{m.title}</p>
                  <p className="mt-0.5 text-footnote text-fg-muted">
                    {formatDate(m.date, "long")} · {m.time} · {m.location}
                    {m.attendees.length ? ` · ${m.attendees.length} attended` : ""}
                    {m.ballotIds.length ? ` · ${pluralize(m.ballotIds.length, "ballot")}` : ""}
                    {m.recordingAvailable ? " · recording" : ""}
                  </p>
                </div>
                <ChevronDown className="mt-1 size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-4 border-t border-border bg-surface-2 px-5 py-4 sm:grid-cols-2">
                <div>
                  <p className="text-footnote font-semibold text-fg-muted">Agenda</p>
                  <ol className="mt-1.5 space-y-1">
                    {m.agenda.map((item, i) => (
                      <li key={item} className="flex gap-2 text-body text-fg-muted">
                        <span className="tnum shrink-0 text-fg-subtle">{i + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                {m.attendees.length ? (
                  <div>
                    <p className="text-footnote font-semibold text-fg-muted">In the room</p>
                    <ul className="mt-1.5 space-y-1">
                      {m.attendees.map((a) => (
                        <li key={a.name} className="flex items-center gap-2 text-footnote text-fg-muted">
                          <span className="truncate">{a.name}</span>
                          <span className="ml-auto shrink-0 text-fg-subtle">
                            {a.role ?? placeLabel(a.unit ?? "")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </Card>
      ) : null}

      {/* The one home for action items since the 2026-09-24 board pass. An
          overdue one still surfaces on the dashboard, as a row in Needs you
          that links here. */}
      <div id="action-items" className="mt-6 scroll-mt-32 lg:scroll-mt-24">
        <ActionItems />
      </div>
    </>
  );
}
