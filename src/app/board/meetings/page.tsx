"use client";

import { useState } from "react";
import { CalendarDays, CalendarPlus, ChevronDown, Megaphone, Video } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, PageHeader, buttonClass } from "@/components/ui/primitives";
import { meetingJoin } from "@/lib/meetings/video";
import { ScheduleMeeting } from "@/components/app/schedule-meeting";
import { ActionItems } from "@/components/app/action-items";
import { useAppState } from "@/lib/app-state";
import { meetingPhase } from "@/lib/phases";
import { cn, formatDate, pluralize, todayIsoDate } from "@/lib/utils";
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
  // Meetings whose notice is on its way. A real roster is emailed before the
  // notice goes on record, which can take most of a minute.
  const [sending, setSending] = useState<string[]>([]);
  // The meeting whose notice is waiting on a yes. It cannot be taken back.
  const [confirming, setConfirming] = useState<string | null>(null);
  const join = (m: Meeting) => meetingJoin(m, community.association.id);
  // On the day, the call is one press away. Nothing sets a real
  // association's meeting to "live", so the date is what says it is today.
  // A meeting still marked live (the demo's) counts as today too.
  const today = todayIsoDate();
  const todays = community.meetings.filter(
    (m) => m.status !== "ended" && (m.date === today || m.status === "live"),
  );
  // Split by phase, not stored status: nothing marks a real association's
  // meeting ended, so its date does. One held today is still upcoming.
  const upcoming = [...community.meetings]
    .filter((m) => meetingPhase(m) !== "ended")
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  // Newest first. What was on the agenda, and who came, is the record the
  // next board inherits; it used to vanish the day the meeting ended.
  const past = [...community.meetings]
    .filter((m) => meetingPhase(m) === "ended")
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  async function sendNotice(m: Meeting) {
    if (sending.includes(m.id)) return;
    // Held until the send is back. This used to say "posted" at once, over a
    // send that was still running and, for some, then failed.
    setSending((ids) => [...ids, m.id]);
    setConfirming(null);
    const said = await sendMeetingNotice(m.id);
    setSending((ids) => ids.filter((id) => id !== m.id));
    // The send says what happened: how many were emailed, or why none were.
    if (said) notify(said, said.startsWith("Notice posted in the app") ? "warn" : "ok");
  }

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Upcoming meetings, who is coming, and action items."
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

      {todays.map((m) => (
        <Card key={m.id} className="mb-6 overflow-hidden border-ok/30">
          <div className="flex flex-wrap items-center gap-3 bg-ok-soft px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-semibold text-ok">{m.title}</p>
              <p className="text-footnote text-ok opacity-90">Today, {m.time}</p>
            </div>
            <a
              href={meetingJoin(m, community.association.id).videoUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("secondary", "md")}
            >
              <Video className="size-3.5" />
              Join the call
            </a>
          </div>
        </Card>
      ))}

      <Card>
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
                {Number(m.date.slice(8, 10))}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-medium text-fg">{m.title}</p>
              </div>
              <p className="mt-0.5 text-footnote text-fg-muted">
                {m.time} · {m.location}
              </p>
              <p className="mt-0.5 text-footnote text-fg-subtle">
                <a
                  href={join(m).videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Video call link
                </a>
                {join(m).dialIn ? ` · dial in ${join(m).dialIn}` : ""}
                {join(m).passcode ? ` · passcode ${join(m).passcode}` : ""}
              </p>
              <p className={cn("mt-0.5 text-footnote", m.noticeSentDate ? "text-fg-subtle" : "text-warn")}>
                {m.noticeSentDate
                  ? `Notice sent ${formatDate(m.noticeSentDate, "long")}`
                  : "Notice not sent yet"}
                {m.ballotIds.length
                  ? ` · ${pluralize(m.ballotIds.length, "ballot")} on the agenda`
                  : ""}
              </p>
              <Rsvps meeting={m} />
            </div>
            {m.noticeSentDate ? null : confirming === m.id ? (
              <div className="max-w-xs shrink-0 text-right">
                <p className="text-footnote text-fg">
                  Send the notice to every owner now?
                  <span className="block text-fg-muted">
                    {m.title}, {formatDate(m.date, "long")}
                  </span>
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => void sendNotice(m)}>
                    Send now
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={sending.includes(m.id)}
                onClick={() => setConfirming(m.id)}
              >
                <Megaphone className="size-3.5" />
                {sending.includes(m.id) ? "Sending" : "Send notice"}
              </Button>
            )}
          </div>
        ))}
      </Card>

      {past.length > 0 ? (
        <Card className="mt-6">
          <CardHeader title="Past meetings" subtitle="What was on the agenda" />
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
                    {Number(m.date.slice(8, 10))}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-fg">{m.title}</p>
                  <p className="mt-0.5 text-footnote text-fg-muted">
                    {formatDate(m.date, "long")} · {m.time} · {m.location}
                    {m.attendees.length ? ` · ${m.attendees.length} attended` : ""}
                    {m.ballotIds.length ? ` · ${pluralize(m.ballotIds.length, "ballot")}` : ""}
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
