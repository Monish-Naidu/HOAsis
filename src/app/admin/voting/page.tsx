"use client";

import {
  CalendarDays,
  Radio,
  Vote,
} from "lucide-react";
import { useState } from "react";
import { BallotCard } from "@/components/app/ballot-card";
import { NewBallot } from "@/components/app/new-ballot";
import { MeetingRoom } from "@/components/app/meeting-room";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";

import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { BoardVote } from "@/components/app/board-vote";
import { formatDate } from "@/lib/utils";

export default function BoardVoting() {
  const [creating, setCreating] = useState(false);
  const { community, ballots, castVote } = useAppState();
  const live = community.meetings.find((m) => m.status === "live");
  const upcoming = [...community.meetings]
    .filter((m) => m.status !== "ended")
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const { notify } = useToast();
  const open = ballots.filter((b) => b.status === "open");
  const scheduled = ballots.filter((b) => b.status === "scheduled");
  const decided = ballots.filter((b) => b.status === "certified" || b.status === "closed");
  const scheduledMeetings = upcoming.filter((m) => m.status !== "live");
  const totalCast = open.reduce(
    (total, ballot) => total + ballot.options.reduce((sum, o) => sum + o.votes, 0),
    0,
  );
  const nextMeeting = scheduledMeetings[0];

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Voting and meetings"
        
        action={
          <Button variant="primary" size="md" onClick={() => setCreating((v) => !v)}>
            {creating ? "Cancel" : "New ballot"}
          </Button>
        }
      />

      {creating ? <NewBallot onClose={() => setCreating(false)} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open ballots" value={String(open.length)} icon={<Vote className="size-4" />} />
        <Stat label="Votes cast" value={String(totalCast)} tone="ok" hint="Across open ballots" />
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
                Item 3 is the open board ballot below. Directors can vote without leaving the call.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="mt-5">
        <h2 className="mb-3 text-[13px] font-semibold text-fg-muted">
          Open ballots
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {open.map((b) => (
            <div key={b.id} className="space-y-2">
              <BallotCard ballot={b} />
              {b.audience === "board" ? (
                <BoardVote
                  ballot={b}
                  onCast={(optionId) => {
                    castVote(b.id, optionId);
                    const option = b.options.find((o) => o.id === optionId);
                    notify(`Your vote was recorded: ${option?.label}`);
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Meetings"
            
            icon={<CalendarDays className="size-4" />}
          />
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

        <div className="space-y-5">
          {scheduled.map((b) => (
            <BallotCard key={b.id} ballot={b} />
          ))}
          {decided.map((b) => (
            <BallotCard key={b.id} ballot={b} />
          ))}
        </div>
      </div>

    </>
  );
}
