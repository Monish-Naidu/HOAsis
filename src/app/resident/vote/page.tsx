import { Radio, Vote } from "lucide-react";
import { MeetingRoom } from "@/components/app/meeting-room";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { ballotsForOwners, liveMeeting, upcomingMeetings } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { BallotVote } from "./ballot-vote";

export const metadata = { title: "Vote" };

export default function ResidentVote() {
  const live = liveMeeting();
  const mine = ballotsForOwners();
  const open = mine.filter((b) => b.status === "open");
  const upcoming = mine.filter((b) => b.status === "scheduled");
  const past = mine.filter((b) => b.status === "certified" || b.status === "closed");
  const meetings = upcomingMeetings().filter((m) => m.status !== "live");

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">Vote</h1>
        
      </div>

      {live ? (
        <Card className="overflow-hidden border-ok/30">
          <div className="flex items-center gap-2 bg-ok-soft px-4 py-2.5">
            <Radio className="size-3.5 shrink-0 text-ok" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ok">{live.title}</p>
              <p className="text-[11px] text-ok opacity-90">
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

      {upcoming.length ? (
        <section>
          <SectionTitle>Opening soon</SectionTitle>
          <div className="space-y-3">
            {upcoming.map((b) => (
              <Card key={b.id} className="p-4">
                <Badge tone="neutral">Opens {formatDate(b.opensDate, "long")}</Badge>
                <h3 className="mt-1.5 text-[14px] font-semibold leading-snug text-fg">{b.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{b.body[0]}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle>Meetings</SectionTitle>
        <Card>
          {meetings.map((m, i) => (
            <div
              key={m.id}
              className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <p className="text-[13px] font-medium text-fg">{m.title}</p>
              <p className="mt-0.5 text-[11px] text-fg-muted">
                {formatDate(m.date, "long")} at {m.time} · {m.location}
              </p>
              <p className="mt-1 text-[11px] text-fg-subtle">
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
