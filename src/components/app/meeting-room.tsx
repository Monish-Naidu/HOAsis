"use client";

import { useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import type { Meeting } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The meeting surface. Joining is local state in this prototype: no call
 * provider is wired up, so the tiles show initials rather than camera feeds.
 */
export function MeetingRoom({
  meeting,
  compact,
  joinVariant = "primary",
}: {
  meeting: Meeting;
  compact?: boolean;
  /** Secondary where the page already has its one filled button. */
  joinVariant?: "primary" | "secondary";
}) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  if (!joined) {
    return (
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={joinVariant} size={compact ? "md" : "lg"} onClick={() => setJoined(true)}>
            <Video className="size-4" />
            Join the call
          </Button>
          <div className="text-footnote leading-snug text-fg-muted">
            <p>
              Dial in: <span className="tnum font-medium text-fg">{meeting.dialIn}</span>
            </p>
            <p>
              Passcode: <span className="tnum font-medium text-fg">{meeting.passcode}</span>
            </p>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-footnote text-fg-subtle">
          <Users className="size-3" />
          {meeting.attendees.length} already here
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {meeting.attendees.map((a) => (
          <div
            key={a.name}
            className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-navy-900 dark:bg-navy-800"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-navy-700 text-body font-semibold text-navy-50">
              {a.name
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </span>
            <span className="absolute bottom-1.5 left-2 truncate text-caption font-medium text-navy-100">
              {a.name}
              {a.isHost ? " · host" : ""}
            </span>
            {a.channel === "phone" ? (
              <Phone className="absolute right-2 top-2 size-3 text-navy-300" />
            ) : null}
          </div>
        ))}
        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border-2 px-3 text-center text-caption leading-snug text-fg-subtle">
          Camera preview is not wired up in this prototype
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant={muted ? "quiet" : "secondary"} size="sm" onClick={() => setMuted((v) => !v)}>
          {muted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          {muted ? "Unmute" : "Mute"}
        </Button>
        <Button
          variant={camOff ? "quiet" : "secondary"}
          size="sm"
          onClick={() => setCamOff((v) => !v)}
        >
          {camOff ? <VideoOff className="size-3.5" /> : <Video className="size-3.5" />}
          {camOff ? "Start video" : "Stop video"}
        </Button>
        <Badge tone="ok" dot>
          Recording
        </Badge>
        <Button variant="danger" size="sm" className="ml-auto" onClick={() => setJoined(false)}>
          <PhoneOff className="size-3.5" />
          Leave
        </Button>
      </div>
    </div>
  );
}
