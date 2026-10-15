"use client";

import Link from "next/link";
import { CalendarOff, Check, Copy, Radio, Users, Video, X } from "lucide-react";
import { useToast } from "@/components/app/toast";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionTitle,
  buttonClass,
} from "@/components/ui/primitives";
import { EntryRow } from "@/components/app/calendar-view";
import { kindLabel, kindTone, upcomingFrom } from "@/lib/calendar";
import { calendarEntries } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import { meetingJoin } from "@/lib/meetings/video";
import type { Meeting } from "@/lib/types";
import { attendedLine, cancelledLine, meetingPage, wasLine } from "@/lib/meeting-notices";
import { liveMeetingLine } from "@/lib/resident-wording";
import { cn, formatDate, relativeDays } from "@/lib/utils";
import { offersVideoCall } from "@/lib/meeting-call";

/**
 * Everything coming up, once, with the RSVP on the meeting's own row.
 *
 * The calendar page used to list the same two meetings twice: under "Next
 * up" as calendar entries, then again under "Are you coming?" with the
 * buttons. One list now, soonest first; ballots and deadlines sit in it as
 * plain rows that open where they are acted on.
 */
export function MeetingRsvps() {
  const { community } = useAppState();
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
              ? community.meetings.find(
                  (x) => `cal-${x.id}` === entry.id && x.status === "scheduled",
                )
              : undefined;
          const called =
            entry.kind === "meeting"
              ? community.meetings.find((x) => `cal-${x.id}` === entry.id)
              : undefined;
          if (called?.status === "cancelled") {
            return (
              <div key={called.id} className={cn("px-4 py-3", i > 0 && "border-t border-border")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={meetingPage(called.id)}
                    className="text-body font-medium text-fg-muted line-through underline-offset-2 hover:text-fg hover:underline"
                  >
                    {called.title}
                  </Link>
                  <Badge tone="danger">Cancelled</Badge>
                </div>
                <p className="mt-0.5 text-footnote text-fg-muted">
                  {formatDate(called.date, "long")}
                </p>
                <p className="mt-0.5 text-footnote font-medium text-danger">
                  {cancelledLine(called)}
                </p>
              </div>
            );
          }
          if (!m) return <EntryRow key={entry.id} entry={entry} divided={i > 0} showDate />;
          return (
            <div key={m.id} className={cn("px-4 py-3", i > 0 && "border-t border-border")}>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={meetingPage(m.id)}
                  className="text-body font-medium text-fg underline decoration-border-2 underline-offset-2 hover:decoration-fg"
                >
                  {m.title}
                </Link>
                <Badge tone={kindTone.meeting}>{kindLabel.meeting}</Badge>
              </div>
              <p className="mt-0.5 text-footnote text-fg-muted">
                {formatDate(m.date, "long")} · {relativeDays(m.date)} · {m.time} · {m.location}
                {wasLine(m) ? ` · ${wasLine(m)}` : ""}
              </p>
              <MeetingJoinDetails meeting={m} />
              <RsvpButtons meeting={m} />
            </div>
          );
        })}
      </Card>
    </section>
  );
}

/**
 * Minutes of meetings that were held, newest first, each folded so a phone
 * screen is not a wall of text. Nothing at all until the board records some.
 * The title opens the meeting's own page, which carries the minutes too.
 */
export function MeetingMinutes() {
  const { community } = useAppState();
  const held = community.meetings
    .filter((m) => m.status !== "cancelled" && m.minutes?.trim())
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (held.length === 0) return null;
  return (
    <section>
      <SectionTitle>Minutes</SectionTitle>
      <Card>
        {held.map((m, i) => (
          <details key={m.id} className={cn("group px-4 py-3", i > 0 && "border-t border-border")}>
            <summary className="cursor-pointer select-none">
              <Link
                href={meetingPage(m.id)}
                className="text-body font-medium text-fg underline decoration-border-2 underline-offset-2 hover:decoration-fg"
              >
                {m.title}
              </Link>
              <span className="mt-0.5 block text-footnote text-fg-muted">
                {formatDate(m.date, "long")}
                {attendedLine(m) ? ` · ${attendedLine(m)}` : ""}
              </span>
            </summary>
            <p className="mt-2 whitespace-pre-line text-body text-fg-muted">{m.minutes}</p>
            {m.attended?.length ? (
              <p className="mt-3 text-footnote text-fg-subtle">
                Attended: {m.attended.map((a) => a.name).join(", ")}
              </p>
            ) : null}
          </details>
        ))}
      </Card>
    </section>
  );
}

/**
 * Where to join a meeting that has not started: the one video link to open,
 * the phone number when the board typed one, and a note that the room opens
 * when the host does. Shared by the meeting's row and its own page, so the
 * two cannot describe joining differently.
 */
export function MeetingJoinDetails({ meeting: m }: { meeting: Meeting }) {
  const { community } = useAppState();
  const { notify } = useToast();
  const { videoUrl: link, dialIn, passcode } = meetingJoin(m, community.association.id);
  return (
    <div className="mt-1 text-footnote leading-snug text-fg-subtle">
      {offersVideoCall(m) ? (
        <p className="flex flex-wrap items-center gap-x-2">
          <span>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              Video call link
            </a>
          </span>
          <button
            type="button"
            aria-label="Copy join link"
            onClick={() =>
              void navigator.clipboard?.writeText(link).then(
                () => notify("Copied", "ok"),
                () => notify(link, "info"),
              )
            }
            className="press inline-flex min-h-9 items-center gap-1 rounded-md px-1.5 font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <Copy className="size-3.5" />
            Copy
          </button>
        </p>
      ) : null}
      {dialIn ? (
        <p>
          Dial in: <span className="tnum">{dialIn}</span>
          {passcode ? ` · passcode ${passcode}` : ""}
        </p>
      ) : passcode ? (
        <p>Passcode {passcode}</p>
      ) : null}
      {offersVideoCall(m) ? <p className="opacity-70">Opens when the host starts it.</p> : null}
    </div>
  );
}

/** The meeting happening right now, joinable. Nothing when there is none. */
export function LiveMeetingCard() {
  const { community } = useAppState();
  const live = community.meetings.find((m) => m.status === "live");
  if (!live) return null;
  return (
    <Card className="overflow-hidden border-ok/30">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 bg-ok-soft px-4 py-3">
        <Radio className="size-3.5 shrink-0 text-ok" />
        <div className="min-w-0 flex-1 basis-40">
          <Link
            href={meetingPage(live.id)}
            className="text-body font-semibold text-ok underline-offset-2 hover:underline"
          >
            {live.title}
          </Link>
          <p className="text-footnote text-ok opacity-90">
            {liveMeetingLine(live.attendees.length)}
          </p>
        </div>
        {/* A link to the call, and nothing drawn to look like one. The room
            of initials and camera tiles had no call behind it. */}
        <a
          href={meetingJoin(live, community.association.id).videoUrl}
          target="_blank"
          rel="noreferrer"
          className={`${buttonClass("secondary", "md")} w-full justify-center sm:w-auto`}
        >
          <Video className="size-3.5" />
          Join the call
        </a>
      </div>
    </Card>
  );
}

/**
 * "I'm coming" and "Can't make it" for one meeting, with the person's own
 * answer said in words. Shared by the list row and the meeting's own page, so
 * both write the same answer the same way. A "no" is its own state, not the
 * look of never having answered.
 */
export function RsvpButtons({ meeting: m }: { meeting: Meeting }) {
  const { account, rsvpMeeting } = useAppState();
  const { notify } = useToast();
  // The person's own answer, and how many neighbors said yes. The board sees
  // the names; here a count is all a resident needs.
  const mine = (m.rsvps ?? []).find((r) => r.profileId === account?.id)?.response;
  const coming = (m.rsvps ?? []).filter((r) => r.response === "yes").length;
  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={mine === "yes" ? "primary" : "secondary"}
          size="md"
          aria-pressed={mine === "yes"}
          onClick={() =>
            void rsvpMeeting(m.id, "yes").then((ok) => {
              if (ok) notify(`See you at ${m.title}.`);
            })
          }
        >
          {mine === "yes" ? <Check className="size-3.5" /> : null}
          I&apos;m coming
        </Button>
        <Button
          variant="secondary"
          size="md"
          aria-pressed={mine === "no"}
          className={cn(mine === "no" && "border-danger/50 bg-danger-soft text-danger")}
          onClick={() =>
            void rsvpMeeting(m.id, "no").then((ok) => {
              if (ok) notify("Noted. The board knows you cannot make it.", "info");
            })
          }
        >
          {mine === "no" ? <X className="size-3.5" /> : null}
          Can&apos;t make it
        </Button>
        {coming > 0 ? (
          <span className="inline-flex items-center gap-1 text-footnote text-fg-subtle">
            <Users className="size-3" />
            {coming} coming
          </span>
        ) : null}
      </div>
      {mine ? (
        <p className="mt-1.5 text-footnote text-fg-muted">
          {mine === "yes" ? "You said you are coming." : "You said you cannot make it."}
        </p>
      ) : null}
    </div>
  );
}
