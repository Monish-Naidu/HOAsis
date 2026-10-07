import { describe, expect, it } from "vitest";
import { currentAnnouncements } from "@/lib/meeting-notices";
import type { Announcement, DocumentRecord, Meeting } from "@/lib/types";

const ann = (id: string, title: string): Announcement => ({
  id, title, body: "Body.", postedDate: "2026-09-20", author: "Arya", category: "Governance",
});
const meeting = (title: string, date: string) => ({ id: title, title, date }) as Meeting;
const minutes = (name: string) => ({ id: name, name, category: "Meetings" }) as DocumentRecord;

const meetings = [meeting("Budget workshop", "2026-10-03"), meeting("Board meeting", "2026-10-20")];
const list = [
  ann("a", "Budget workshop, October 3 at 6:30pm"),
  ann("b", "Notice of meeting: Board meeting, October 20, 2026 at 7:00 PM"),
  ann("c", "Pool closed"),
];

describe("announcements about a meeting", () => {
  it("drops the notice for a meeting four days past", () => {
    const ids = currentAnnouncements(list, meetings, [], "2026-10-07").map((a) => a.id);
    expect(ids).toEqual(["b", "c"]);
  });
  it("keeps the notice on the day of the meeting", () => {
    expect(currentAnnouncements(list, meetings, [], "2026-10-03").map((a) => a.id)).toEqual(["a", "b", "c"]);
  });
  it("turns a past notice into minutes when the minutes are on file", () => {
    const out = currentAnnouncements(list, meetings, [minutes("Budget workshop Minutes, October 3, 2026")], "2026-10-07");
    expect(out.map((a) => a.title)).toEqual(["Minutes from Budget workshop", list[1].title, "Pool closed"]);
  });
  it("leaves announcements that name no meeting alone", () => {
    expect(currentAnnouncements([list[2]], meetings, [], "2030-01-01")).toEqual([list[2]]);
  });
});
