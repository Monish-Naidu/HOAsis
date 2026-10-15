/**
 * Whether a meeting is one people join by video, so a row shows a call link.
 *
 * Every meeting has a video room we can derive, but a meeting held at the
 * clubhouse with no link typed is not a call, and a "Video call link" under
 * it sends people to an empty room. A link or a number typed in the dial-in
 * box counts, and so does a place that says it is a call.
 */
export function offersVideoCall(meeting: { location: string; dialIn?: string | null }): boolean {
  if ((meeting.dialIn ?? "").trim() !== "") return true;
  return /\b(video|online|virtual|zoom|teams|webex|google meet|phone|conference call|call)\b/i.test(
    meeting.location,
  );
}
