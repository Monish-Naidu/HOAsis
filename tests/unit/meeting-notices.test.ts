import { describe, expect, it } from "vitest";
import { attendedLine, cancelledLine, currentAnnouncements, wasLine } from "@/lib/meeting-notices";
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

describe("minutes on the meeting itself", () => {
  const held = [{ ...meeting("Budget workshop", "2026-10-03"), minutes: "Approved the budget." } as Meeting];
  it("prefers the recorded minutes to a file", () => {
    const out = currentAnnouncements(list, held, [minutes("Budget workshop Minutes, October 3, 2026")], "2026-10-07");
    expect(out[0].title).toBe("Minutes from Budget workshop");
    expect(out[0].body).toBe("The minutes are under Meetings.");
  });
  it("points at Documents when only a file is on record", () => {
    const out = currentAnnouncements(list, meetings, [minutes("Budget workshop Minutes, October 3, 2026")], "2026-10-07");
    expect(out[0].body).toBe("The minutes are in Documents.");
  });
  it("ignores minutes that are only spaces", () => {
    const blank = [{ ...meeting("Budget workshop", "2026-10-03"), minutes: "  " } as Meeting];
    expect(currentAnnouncements(list, blank, [], "2026-10-07").map((a) => a.id)).toEqual(["b", "c"]);
  });
});

describe("a cancelled meeting", () => {
  const called = [{ ...meeting("Board meeting", "2026-10-20"), status: "cancelled", cancelReason: "Storm warning" } as Meeting];
  it("turns its notice into a cancellation, even before the day", () => {
    const out = currentAnnouncements(list, called, [], "2026-10-07");
    expect(out.find((a) => a.id === "b")).toMatchObject({ title: "Cancelled: Board meeting", body: "Storm warning" });
  });
  it("reads Cancelled with its reason, or alone", () => {
    expect(cancelledLine({ cancelReason: " Storm warning " })).toBe("Cancelled: Storm warning");
    expect(cancelledLine({})).toBe("Cancelled");
    expect(cancelledLine({ cancelReason: "  " })).toBe("Cancelled");
  });
});

describe("the lines beside a meeting", () => {
  it("says what date a moved meeting was first noticed for", () => {
    expect(wasLine({ date: "2026-10-20", rescheduledFrom: "2026-10-13" })).toBe("Was Oct 13");
    expect(wasLine({ date: "2026-10-20" })).toBeNull();
    expect(wasLine({ date: "2026-10-20", rescheduledFrom: "2026-10-20" })).toBeNull();
  });
  it("counts who came", () => {
    expect(attendedLine({})).toBeNull();
    expect(attendedLine({ attended: [] })).toBeNull();
    expect(attendedLine({ attended: [{ name: "A", channel: "in-person" }] })).toBe("1 attended");
  });
});
