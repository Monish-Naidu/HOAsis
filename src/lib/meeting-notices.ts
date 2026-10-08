import type { Announcement, DocumentRecord, Meeting } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * Announcements about a meeting that has already happened.
 *
 * A meeting notice is posted as an ordinary announcement with the meeting's
 * title and day written into its title, and nothing else ties the two
 * together, so the link is read back from that text. A notice for a meeting
 * before today is stale news: it is dropped, unless the meeting has minutes
 * on file, when it becomes a pointer to them.
 */

/** "October 3", the way a notice writes the day. */
function dayText(date: string): string {
  return formatDate(date, "long").replace(/,\s*\d{4}$/, "");
}

function meetingOf(a: Announcement, meetings: readonly Meeting[]): Meeting | undefined {
  const title = a.title.toLowerCase();
  return meetings.find((m) => title.includes(m.title.toLowerCase()) && a.title.includes(dayText(m.date)));
}

function hasMinutes(m: Meeting, documents: readonly DocumentRecord[]): boolean {
  return documents.some((d) => {
    const name = d.name.toLowerCase();
    return (
      d.category === "Meetings" &&
      name.includes("minutes") &&
      (name.includes(m.title.toLowerCase()) || name.replace(/,/g, "").includes(formatDate(m.date, "long").replace(/,/g, "").toLowerCase()))
    );
  });
}

export function currentAnnouncements(
  announcements: readonly Announcement[],
  meetings: readonly Meeting[],
  documents: readonly DocumentRecord[],
  today: string,
): Announcement[] {
  const out: Announcement[] = [];
  for (const a of announcements) {
    const m = meetingOf(a, meetings);
    if (m?.status === "cancelled") {
      out.push({ ...a, title: `Cancelled: ${m.title}`, body: m.cancelReason?.trim() || "The board cancelled this meeting.", pinned: false });
    } else if (!m || m.date >= today) {
      out.push(a);
    } else if (m.minutes?.trim()) {
      // The board's own minutes win over a file of the same name: they are
      // on the meeting itself, under Meetings.
      out.push({ ...a, title: `Minutes from ${m.title}`, body: "The minutes are under Meetings.", pinned: false });
    } else if (hasMinutes(m, documents)) {
      out.push({ ...a, title: `Minutes from ${m.title}`, body: "The minutes are in Documents.", pinned: false });
    }
  }
  return out;
}

/** How a residents' list says a meeting was called off: "Cancelled: Storm warning". */
export function cancelledLine(m: Pick<Meeting, "cancelReason">): string {
  return m.cancelReason?.trim() ? `Cancelled: ${m.cancelReason.trim()}` : "Cancelled";
}

/** "Was Oct 3", beside the date of a meeting that was moved. */
export function wasLine(m: Pick<Meeting, "rescheduledFrom" | "date">): string | null {
  return m.rescheduledFrom && m.rescheduledFrom !== m.date ? `Was ${formatDate(m.rescheduledFrom)}` : null;
}

/** "3 attended", or nothing when nobody was marked. */
export function attendedLine(m: Pick<Meeting, "attended">): string | null {
  const n = m.attended?.length ?? 0;
  return n ? `${n} attended` : null;
}
