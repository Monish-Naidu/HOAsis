import type { Meeting } from "@/lib/types";

/**
 * Video meetings ride on Jitsi Meet's public server. No account, no key,
 * no cost: a room exists the moment someone opens its URL, so the whole
 * feature is a room name everyone derives the same way.
 *
 * The name is `hoasis-<association>-<meeting>-<hash>`. The first two parts
 * keep it readable in a notice; the hash keeps a stranger who knows a
 * meeting's id from walking into the room. A meeting may pin its own room
 * with `videoRoom`, which wins over the derivation.
 */

export const VIDEO_DOMAIN = "meet.jit.si";

/** Mixed into the hash so a room is not the visible ids alone. */
const ROOM_SALT = "yourhoasis-video-2026";

/** Lowercase, [a-z0-9-] only, single dashes, none at either end. */
export function roomSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** FNV-1a, 32 bit, as six base36 characters. Enough to stop guessing, small enough to type. */
export function roomHash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0").slice(-6);
}

/**
 * The room for a meeting. `scope` is the association's id, so two
 * associations that both number a meeting `mtg-1` never share a room.
 */
export function videoRoomName(meeting: Pick<Meeting, "id" | "videoRoom">, scope: string): string {
  if (meeting.videoRoom) {
    const pinned = roomSlug(meeting.videoRoom);
    if (pinned) return pinned;
  }
  const scopePart = roomSlug(scope).slice(0, 24) || "community";
  const idPart = roomSlug(meeting.id).slice(0, 24) || "meeting";
  const hash = roomHash(`${ROOM_SALT}/${scope}/${meeting.id}`);
  return `hoasis-${scopePart}-${idPart}-${hash}`;
}

/** The link anyone can open, in a browser or the Jitsi app, to join. */
export function videoJoinUrl(meeting: Pick<Meeting, "id" | "videoRoom">, scope: string): string {
  return `https://${VIDEO_DOMAIN}/${videoRoomName(meeting, scope)}`;
}

/**
 * How to join, in one place, so the row, the resident calendar, the notice
 * and the email cannot disagree. A link the board typed (anything starting
 * with http) IS the video link; the automatic room is only for a board that
 * typed nothing. What was typed and is not a URL is a phone number to dial.
 * The passcode goes with whichever of the two applies.
 */
export interface MeetingJoin {
  videoUrl: string;
  /** A phone number or other text to dial. Empty when the board typed a link or nothing. */
  dialIn: string;
  passcode: string;
}

export function meetingJoin(
  meeting: Pick<Meeting, "id" | "videoRoom"> & { dialIn?: string | null; passcode?: string | null },
  associationId: string,
): MeetingJoin {
  const typed = (meeting.dialIn ?? "").trim();
  const passcode = (meeting.passcode ?? "").trim();
  if (/^https?:\/\//i.test(typed)) return { videoUrl: typed, dialIn: "", passcode };
  return { videoUrl: videoJoinUrl(meeting, associationId), dialIn: typed, passcode };
}
