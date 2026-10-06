import { describe, expect, it } from "vitest";
import { activityText, activityWords } from "@/lib/activity";
import { localStamp } from "@/lib/utils";
import type { Activity } from "@/lib/types";

const row = (over: Partial<Activity>): Activity => ({
  id: "a1",
  at: "2026-10-05T14:32:00",
  actorName: "Pat",
  subjectKind: "charge",
  summary: "",
  details: {},
  ...over,
});
const lot = (u: string) => `Lot ${u}`;
const noUnits = () => undefined;

describe("activityText", () => {
  it("puts the community's word in front of the home", () => {
    expect(
      activityText(
        row({ summary: "Credit of $25.00 added for 1: Late fee waived", details: { home: "1" } }),
        lot,
        noUnits,
      ),
    ).toBe("Credit of $25.00 added for Lot 1: Late fee waived");
  });

  it("finds the home from its id when the row only carries that", () => {
    expect(
      activityText(
        row({ summary: "Payment of $10.00 recorded for 4B by check", details: { unit_id: "u-4b" } }),
        lot,
        (id) => (id === "u-4b" ? "4B" : undefined),
      ),
    ).toBe("Payment of $10.00 recorded for Lot 4B by check");
  });

  it("names areas as the access grid does", () => {
    expect(
      activityText(
        row({
          subjectKind: "seat",
          summary: "Jo can change Communications, Voting and see Forum",
          details: { can_change: { to: ["communications", "voting"] }, can_see: { to: ["forum"] } },
        }),
        lot,
        noUnits,
      ),
    ).toBe("Jo can change Meetings, Messages and see Community");
  });

  it("writes a stored date the way the screens do", () => {
    expect(activityText(row({ summary: 'Meeting "Annual" scheduled for 2026-10-14' }), lot, noUnits)).toBe(
      'Meeting "Annual" scheduled for Oct 14',
    );
  });

  it("leaves a row with no home alone", () => {
    expect(activityText(row({ summary: "Vendor Acme added" }), lot, noUnits)).toBe("Vendor Acme added");
  });
});

describe("activityWords", () => {
  it("words each write the way the database does", () => {
    expect(activityWords.credit(2500, "1", "Late fee waived")).toBe("Credit of $25.00 added for 1: Late fee waived");
    expect(activityWords.dues("1", 15000)).toBe("Dues for 1 set to $150.00");
    expect(activityWords.dues("1", null)).toBe("Dues for 1 set back to the standard amount");
    expect(activityWords.meeting("Annual", "2026-10-14")).toBe('Meeting "Annual" scheduled for 2026-10-14');
    expect(activityWords.notice("1", "Trash cans")).toBe("Notice sent for 1: Trash cans");
  });
});

describe("localStamp", () => {
  it("shows a zoneless timestamp as written, with the date", () => {
    expect(localStamp("2026-10-05T14:32:00")).toBe("Oct 5 · 14:32");
  });
});
