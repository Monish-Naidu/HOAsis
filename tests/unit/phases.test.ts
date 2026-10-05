import { afterEach, describe, expect, it } from "vitest";
import { allCommunities, mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import { calendarEntries } from "@/lib/metrics";
import { ballotNeedsSealing, ballotPhase, meetingPhase } from "@/lib/phases";
import { setToday } from "@/lib/utils";

/**
 * A ballot's and a meeting's stored status only moves when somebody presses a
 * button, so every screen reads the phase instead. These pin the two rules:
 * the last day still counts, and the day after does not.
 */
describe("ballotPhase", () => {
  const open = { status: "open" as const, closesDate: "2026-10-01" };

  it("keeps a ballot open through its closing date", () => {
    expect(ballotPhase(open, "2026-09-30")).toBe("open");
    expect(ballotPhase(open, "2026-10-01")).toBe("open");
  });

  it("reads an open ballot as closed the day after it closes, with nobody pressing Close now", () => {
    expect(ballotPhase(open, "2026-10-02")).toBe("closed");
    expect(ballotPhase(open, "2026-10-05")).toBe("closed");
  });

  it("leaves every other status as it is stored", () => {
    // Scheduled stays scheduled even past its dates: the database takes
    // votes only on an open ballot, so calling it open would offer choices
    // that are then refused.
    expect(ballotPhase({ status: "scheduled", closesDate: "2026-10-01" }, "2026-10-05")).toBe("scheduled");
    expect(ballotPhase({ status: "closed", closesDate: "2026-12-01" }, "2026-10-05")).toBe("closed");
    expect(ballotPhase({ status: "certified", closesDate: "2026-01-21" }, "2026-10-05")).toBe("certified");
  });
});

describe("ballotNeedsSealing", () => {
  const open = { status: "open" as const, closesDate: "2026-10-01" };

  it("is true only for a ballot over by its date and still open in the record", () => {
    expect(ballotNeedsSealing(open, "2026-10-02")).toBe(true);
    // Still running, the last day included: Close now covers it.
    expect(ballotNeedsSealing(open, "2026-10-01")).toBe(false);
    expect(ballotNeedsSealing(open, "2026-09-20")).toBe(false);
  });

  it("is false once the close is written, and for a ballot that never opened", () => {
    expect(ballotNeedsSealing({ status: "closed", closesDate: "2026-10-01" }, "2026-10-05")).toBe(false);
    expect(ballotNeedsSealing({ status: "certified", closesDate: "2026-10-01" }, "2026-10-05")).toBe(false);
    expect(ballotNeedsSealing({ status: "scheduled", closesDate: "2026-10-01" }, "2026-10-05")).toBe(false);
  });
});

describe("meetingPhase", () => {
  const scheduled = { status: "scheduled" as const, date: "2026-09-16" };

  it("keeps a meeting held today upcoming until the day is over", () => {
    expect(meetingPhase(scheduled, "2026-09-15")).toBe("scheduled");
    expect(meetingPhase(scheduled, "2026-09-16")).toBe("scheduled");
  });

  it("reads a scheduled meeting as ended once its date has passed", () => {
    expect(meetingPhase(scheduled, "2026-09-17")).toBe("ended");
    expect(meetingPhase(scheduled, "2026-11-02")).toBe("ended");
  });

  it("leaves a live or ended meeting as it is stored", () => {
    expect(meetingPhase({ status: "live", date: "2026-08-20" }, "2026-08-20")).toBe("live");
    expect(meetingPhase({ status: "ended", date: "2026-01-21" }, "2026-08-20")).toBe("ended");
  });
});

describe("the demo against its own pinned date", () => {
  // The phase must not move anything in the demo: a fixture ballot stored
  // open but already past its date would jump to Closed on every screen.
  for (const community of allCommunities()) {
    it(`${community.label} stores no open ballot or scheduled meeting that is already over`, () => {
      for (const ballot of community.ballots) {
        expect(ballotPhase(ballot, community.asOf), `${ballot.title} is stored ${ballot.status}`).toBe(
          ballot.status,
        );
      }
      for (const meeting of community.meetings) {
        expect(meetingPhase(meeting, community.asOf), `${meeting.title} is stored ${meeting.status}`).toBe(
          meeting.status,
        );
      }
    });
  }
});

describe("calendarEntries", () => {
  afterEach(() => setToday(mehrMeadows.asOf));

  it("drops the last day to vote once a ballot's closing date has passed", () => {
    const ballot = mehrMeadows.ballots.find((b) => b.audience === "owners" && b.status === "open")!;
    const c: Community = {
      ...mehrMeadows,
      ballots: [{ ...ballot, id: "bal-late", status: "open", closesDate: "2026-10-01" }],
    };
    const lastDay = () => calendarEntries(c).filter((e) => e.kind === "ballot-closes");

    setToday("2026-10-01");
    expect(lastDay()).toHaveLength(1);

    // Still stored open, since nobody pressed Close now.
    setToday("2026-10-04");
    expect(lastDay()).toHaveLength(0);
  });
});
