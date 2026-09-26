"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Mic, MicOff, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import { useToast } from "@/components/app/toast";
import { Button, Callout } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { loadJitsi, type JitsiMeetApi } from "@/lib/meetings/jitsi";
import { VIDEO_DOMAIN, videoJoinUrl, videoRoomName } from "@/lib/meetings/video";
import type { Meeting } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The meeting surface, on Jitsi Meet's free public server. Join loads the
 * IFrame API once and mounts the call into the frame below; the buttons
 * under it drive the call through the API so the app's own controls stay
 * the ones a person reaches for.
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
  const { community, account } = useAppState();
  const { notify } = useToast();
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const api = useRef<JitsiMeetApi | null>(null);

  const scope = community.association.id;
  const room = videoRoomName(meeting, scope);
  const link = videoJoinUrl(meeting, scope);
  const displayName = account?.name;

  // Mount the call once the frame exists, and take it down when the person
  // leaves or the surface unmounts. State changes here only come back from
  // the API's own events, never from the effect body.
  useEffect(() => {
    if (!joined) return;
    let cancelled = false;
    loadJitsi().then(
      (JitsiMeet) => {
        if (cancelled || !frame.current) return;
        const instance = new JitsiMeet(VIDEO_DOMAIN, {
          roomName: room,
          parentNode: frame.current,
          width: "100%",
          height: "100%",
          userInfo: displayName ? { displayName } : undefined,
          configOverwrite: {
            subject: meeting.title,
            prejoinConfig: { enabled: false },
            disableDeepLinking: true,
            disableThirdPartyRequests: true,
            hideConferenceSubject: false,
            toolbarButtons: [
              "microphone",
              "camera",
              "desktop",
              "chat",
              "raisehand",
              "participants-pane",
              "tileview",
              "settings",
            ],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_POWERED_BY: false,
            SHOW_PROMOTIONAL_CLOSE_PAGE: false,
            DISPLAY_WELCOME_PAGE_CONTENT: false,
            MOBILE_APP_PROMO: false,
            DEFAULT_BACKGROUND: "#0b1f3a",
          },
        });
        api.current = instance;
        instance.addEventListener("audioMuteStatusChanged", (e) => setMuted(Boolean(e.muted)));
        instance.addEventListener("videoMuteStatusChanged", (e) => setCamOff(Boolean(e.muted)));
        instance.addEventListener("videoConferenceJoined", () => setConnecting(false));
        // Hanging up inside the frame ends the call the same way Leave does.
        instance.addEventListener("readyToClose", () => setJoined(false));
        void instance.isAudioMuted().then(setMuted, () => {});
        void instance.isVideoMuted().then(setCamOff, () => {});
      },
      () => {
        if (cancelled) return;
        setJoined(false);
        setFailed(true);
      },
    );
    return () => {
      cancelled = true;
      api.current?.dispose();
      api.current = null;
    };
  }, [joined, room, displayName, meeting.title]);

  function join() {
    setFailed(false);
    setConnecting(true);
    setJoined(true);
  }

  function copyLink() {
    void navigator.clipboard?.writeText(link).then(
      () => notify("Copied", "ok"),
      () => notify(link, "info"),
    );
  }

  const details = (
    <div className="min-w-0 text-footnote leading-snug text-fg-muted">
      <p className="flex flex-wrap items-center gap-x-2">
        <span>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            Open the video call in a new tab
          </a>
        </span>
        <button
          type="button"
          onClick={copyLink}
          className="press inline-flex min-h-9 items-center gap-1 rounded-md px-1.5 text-footnote font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <Copy className="size-3.5" />
          Copy
        </button>
      </p>
      {meeting.dialIn ? (
        <p>
          Dial in: <span className="tnum font-medium text-fg">{meeting.dialIn}</span>
          {meeting.passcode ? (
            <>
              {" · "}passcode <span className="tnum font-medium text-fg">{meeting.passcode}</span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );

  if (!joined) {
    return (
      <div className="p-4">
        {failed ? (
          <Callout
            tone="warn"
            title="The video player did not load"
            className="mb-3"
            action={
              <Button variant="secondary" size="sm" onClick={join}>
                Try again
              </Button>
            }
          >
            Open the call in a new tab instead:{" "}
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 break-all font-medium underline underline-offset-2"
            >
              {link.replace("https://", "")}
              <ExternalLink className="size-3" />
            </a>
          </Callout>
        ) : null}
        <div className={cn("flex gap-3", compact ? "flex-col" : "flex-wrap items-center")}>
          <Button
            variant={joinVariant}
            size={compact ? "md" : "lg"}
            className="shrink-0"
            onClick={join}
          >
            <Video className="size-4" />
            Join the call
          </Button>
          {details}
        </div>
        <p className="mt-2 text-caption text-fg-subtle">
          Free video by Jitsi. The host may be asked to sign in once to start the room.
        </p>
        {meeting.attendees.length ? (
          <p className="mt-2 flex items-center gap-1.5 text-footnote text-fg-subtle">
            <Users className="size-3" />
            {meeting.attendees.length} already here
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-navy-900 [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:size-full [&>iframe]:border-0">
        <div ref={frame} className="absolute inset-0" />
        {connecting ? (
          <p
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-footnote text-navy-200"
          >
            Connecting…
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant={muted ? "quiet" : "secondary"}
          size="sm"
          aria-pressed={muted}
          onClick={() => api.current?.executeCommand("toggleAudio")}
        >
          {muted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          {muted ? "Unmute" : "Mute"}
        </Button>
        <Button
          variant={camOff ? "quiet" : "secondary"}
          size="sm"
          aria-pressed={camOff}
          onClick={() => api.current?.executeCommand("toggleVideo")}
        >
          {camOff ? <VideoOff className="size-3.5" /> : <Video className="size-3.5" />}
          {camOff ? "Start video" : "Stop video"}
        </Button>
        <Button variant="ghost" size="sm" onClick={copyLink} aria-label="Copy join link">
          <Copy className="size-3.5" />
          {compact ? null : "Copy link"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => {
            api.current?.executeCommand("hangup");
            setJoined(false);
          }}
        >
          <PhoneOff className="size-3.5" />
          Leave
        </Button>
      </div>
    </div>
  );
}
