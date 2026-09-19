"use client";

import { Radio, Users } from "lucide-react";
import { MeetingRoom } from "@/components/app/meeting-room";
import { useToast } from "@/components/app/toast";
import { Button, Card, SectionTitle } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { cn, formatDate } from "@/lib/utils";

/**
 * The meetings ahead, and whether this home is coming.
 *
 * Lived on the Vote page until the launch scope, where it made a page that
 * should ask one question ask three. Meetings have their own tab.
 */
export function MeetingRsvps() {
  const { community, account, rsvpMeeting } = useAppState();
  const { notify } = useToast();
  const meetings = [...community.meetings]
    .filter((m) => m.status === "scheduled" && m.date >= community.asOf)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (meetings.length === 0) return null;

  return (
    <section>
      <SectionTitle>Are you coming?</SectionTitle>
      <Card>
        {meetings.map((m, i) => {
          // The person's own answer, and how many neighbours said yes. The
          // board sees the names; here a count is all a resident needs.
          const mine = (m.rsvps ?? []).find((r) => r.profileId === account?.id)?.response;
          const coming = (m.rsvps ?? []).filter((r) => r.response === "yes").length;
          return (
            <div key={m.id} className={cn("px-4 py-3", i > 0 && "border-t border-border")}>
              <p className="text-[15px] font-medium text-fg">{m.title}</p>
              <p className="mt-0.5 text-[13px] text-fg-muted">
                {formatDate(m.date, "long")} at {m.time} · {m.location}
              </p>
              {m.dialIn ? (
                <p className="mt-1 text-[13px] text-fg-subtle">
                  Dial in {m.dialIn}
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
                  <span className="inline-flex items-center gap-1 text-[13px] text-fg-subtle">
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
          <p className="truncate text-[15px] font-semibold text-ok">{live.title}</p>
          <p className="text-[13px] text-ok opacity-90">
            Live now · {live.attendees.length} joined
          </p>
        </div>
      </div>
      <MeetingRoom meeting={live} compact />
    </Card>
  );
}
