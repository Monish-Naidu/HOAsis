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
    if (!m || m.date >= today) {
      out.push(a);
    } else if (hasMinutes(m, documents)) {
      out.push({ ...a, title: `Minutes from ${m.title}`, body: "The minutes are in Documents.", pinned: false });
    }
  }
  return out;
}
