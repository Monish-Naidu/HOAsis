"use client";

import { Radio, Vote } from "lucide-react";
import { MeetingRoom } from "@/components/app/meeting-room";
import { Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { formatDate } from "@/lib/utils";
import { BallotVote } from "./ballot-vote";

export default function ResidentVote() {
  const { community } = useAppState();
  const live = community.meetings.find((m) => m.status === "live");
  const mine = community.ballots.filter((b) => b.audience === "owners");
  const open = mine.filter((b) => b.status === "open");
  const past = mine.filter((b) => b.status === "certified" || b.status === "closed");
  const meetings = [...community.meetings]
    .filter((m) => m.status !== "ended" && m.status !== "live")
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">Vote</h1>
        
      </div>

      {live ? (
        <Card className="overflow-hidden border-ok/30">
          <div className="flex items-center gap-2 bg-ok-soft px-4 py-2.5">
            <Radio className="size-3.5 shrink-0 text-ok" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ok">{live.title}</p>
              <p className="text-[13px] text-ok opacity-90">
                Live now · {live.attendees.length} joined
              </p>
            </div>
          </div>
          <MeetingRoom meeting={live} compact />
        </Card>
      ) : null}

      {open.length ? (
        <section>
          <SectionTitle>Open to you</SectionTitle>
          <div className="space-y-3">
            {open.map((b) => (
              <BallotVote key={b.id} ballot={b} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={<Vote className="size-5" />}
          title="No open ballots"
          
        />
      )}

      <section>
        <SectionTitle>Meetings</SectionTitle>
        <Card>
          {meetings.map((m, i) => (
            <div
              key={m.id}
              className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <p className="text-[15px] font-medium text-fg">{m.title}</p>
              <p className="mt-0.5 text-[13px] text-fg-muted">
                {formatDate(m.date, "long")} at {m.time} · {m.location}
              </p>
              <p className="mt-1 text-[13px] text-fg-subtle">
                Dial in {m.dialIn} · passcode {m.passcode}
              </p>
            </div>
          ))}
        </Card>
      </section>

      {past.length ? (
        <section>
          <SectionTitle>Your voting record</SectionTitle>
          <div className="space-y-3">
            {past.map((b) => (
              <BallotVote key={b.id} ballot={b} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
