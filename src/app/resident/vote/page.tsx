"use client";

import { Radio, Users, Vote } from "lucide-react";
import { MeetingRoom } from "@/components/app/meeting-room";
import { useToast } from "@/components/app/toast";
import { Button, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { cn, formatDate } from "@/lib/utils";
import { BallotVote } from "./ballot-vote";

export default function ResidentVote() {
  const { community, account, rsvpMeeting } = useAppState();
  const { notify } = useToast();
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
          {meetings.map((m, i) => {
            // The person's own answer, and how many neighbours said yes. The
            // board sees the names; here a count is all a resident needs.
            const mine = (m.rsvps ?? []).find((r) => r.profileId === account?.id)?.response;
            const coming = (m.rsvps ?? []).filter((r) => r.response === "yes").length;
            const askable = m.status === "scheduled" && m.date >= community.asOf;
            return (
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
                {askable ? (
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
                      <span className="inline-flex items-center gap-1 text-[13px] text-fg-subtle">
                        <Users className="size-3" />
                        {coming} coming
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
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
