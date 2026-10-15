import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";

const pathname = "/resident/calendar";
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { default: ResidentCalendar } = await import("@/app/resident/calendar/page");
const { default: MeetingDetail } = await import("@/app/resident/calendar/[id]/page");
const { CalendarView } = await import("@/components/app/calendar-view");
const { HomeSchedule } = await import("@/components/app/home-schedule");
const { calendarEntries } = await import("@/lib/metrics");
const { default: userEvent } = await import("@testing-library/user-event");
const { videoJoinUrl, meetingJoin } = await import("@/lib/meetings/video");
const { meetingPage } = await import("@/lib/meeting-notices");

/**
 * The owner's side of meetings: the Meetings tab, the month grid, and the
 * page one tap in, which every list that names a meeting opens.
 *
 * A meeting to show is added per test rather than borrowed from the fixtures,
 * the way the board's suite does, so one test's move or cancel never reaches
 * the next one even though the stores are singletons.
 */

const seen = { state: null as unknown as ReturnType<typeof useAppState> };
function Probe() {
  const state = useAppState();
  useEffect(() => {
    seen.state = state;
  });
  return null;
}

function mount(ui: ReactNode) {
  return render(
    <AppStateProvider>
      <Probe />
      {ui}
    </AppStateProvider>,
  );
}

/** The detail page, with the id already in the URL and the promise resolved. */
async function openDetail(id: string) {
  // `use(params)` suspends on the URL's promise, so the page settles a beat
  // after the first render; the act scope is what lets it.
  await act(async () => {
    mount(<MeetingDetail params={Promise.resolve({ id })} />);
  });
}

/** A meeting the board just scheduled, signed in as the president. */
async function addMeeting(over: {
  id: string;
  dialIn?: string;
  passcode?: string;
  date?: string;
  minutes?: never;
}) {
  // A provider of its own for this test, signed in in its own step: the call
  // below reads the seat it was rendered with, and a seat that can only look
  // is refused.
  await act(async () => {
    mount(null);
  });
  await act(async () => {
    seen.state.signIn("acct-arya");
  });
  await act(async () => {
    seen.state.addMeeting({
      id: over.id,
      title: "Test meeting",
      date: over.date ?? "2026-09-30",
      time: "7:00 PM",
      status: "scheduled",
      kind: "board",
      location: "Clubhouse",
      dialIn: over.dialIn ?? "",
      passcode: over.passcode ?? "",
      attendees: [],
      agenda: ["Call to order"],
      ballotIds: [],
    });
  });
}

describe("the Meetings tab", () => {
  it("opens the month of the next meeting, not a month with nothing in it", () => {
    mount(
      <CalendarView
        showUpcoming={false}
        asOf="2026-08-20"
        entries={[
          { id: "cal-mtg", date: "2026-10-07", title: "Board meeting", kind: "meeting" },
          { id: "cal-mtg-2", date: "2026-11-04", title: "Budget workshop", kind: "meeting" },
        ]}
      />,
    );
    expect(screen.getByText("October 2026")).toBeInTheDocument();
  });

  it("links each coming meeting to its own page", () => {
    mount(<ResidentCalendar />);
    expect(screen.getByText("Budget workshop").closest("a")).toHaveAttribute(
      "href",
      meetingPage("mtg-workshop-sep3"),
    );
  });

  it("links a meeting on now from the live card, and offers the call", () => {
    mount(<ResidentCalendar />);
    // The meeting on now is named twice: the live card and the coming list.
    const named = screen.getAllByText("Special board meeting: pool resurfacing award");
    const fromCard = named.find((el) => el.closest("a"));
    expect(fromCard).toHaveAttribute("href", meetingPage("mtg-special-aug20"));
    const join = screen.getByRole("link", { name: "Join the call" });
    expect(join.getAttribute("href")).toBe(
      meetingJoin(
        { id: "mtg-special-aug20", dialIn: "(425) 555-0110", passcode: "884 209" },
        seen.state.community.association.id,
      ).videoUrl,
    );
  });
});

describe("answering from a meeting's own page", () => {
  it("offers the same two answers the list does, and says what was answered", async () => {
    await addMeeting({ id: "mtg-rsvp" });
    await openDetail("mtg-rsvp");
    const user = userEvent.setup();
    expect(screen.queryByText(/You said/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Can't make it" }));
    expect(await screen.findByText("You said you cannot make it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Can't make it" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "I'm coming" }));
    expect(await screen.findByText("You said you are coming.")).toBeInTheDocument();
  });

  it("offers no answer for a meeting that was called off", async () => {
    await addMeeting({ id: "mtg-off-rsvp" });
    await openDetail("mtg-off-rsvp");
    await act(async () => {
      await seen.state.cancelMeeting("mtg-off-rsvp", "Storm warning");
    });
    expect(screen.queryByRole("button", { name: "I'm coming" })).not.toBeInTheDocument();
  });
});

describe("Next up on the home screen", () => {
  it("leaves out a cancelled meeting, which the calendar still shows marked", async () => {
    await addMeeting({ id: "mtg-next-off", date: "2026-08-25" });
    await act(async () => {
      await seen.state.cancelMeeting("mtg-next-off", "Storm warning");
    });
    const { community } = seen.state;
    expect(calendarEntries(community).some((e) => e.id === "cal-mtg-next-off")).toBe(true);
    mount(<HomeSchedule entries={calendarEntries(community)} />);
    expect(screen.queryByText(/Test meeting/)).not.toBeInTheDocument();
  });
});

describe("a meeting's own page", () => {
  it("shows when and where, the agenda, and the one call link with a number to dial", async () => {
    await openDetail("mtg-workshop-sep3");
    expect(screen.getByRole("heading", { name: "Budget workshop" })).toBeInTheDocument();
    expect(
      screen.getByText("September 3, 2026 · in 14 days · 6:30 PM · Clubhouse and video call"),
    ).toBeInTheDocument();
    // The agenda, as the board wrote it.
    expect(screen.getByText("Reserve funding plan")).toBeInTheDocument();
    // One video link, the automatic room, and a dial-in because the board
    // typed a phone number.
    expect(screen.getByRole("link", { name: "Video call link" })).toHaveAttribute(
      "href",
      videoJoinUrl({ id: "mtg-workshop-sep3" }, seen.state.community.association.id),
    );
    expect(screen.getByText(/Dial in/)).toBeInTheDocument();
    expect(screen.getByText("(425) 555-0110")).toBeInTheDocument();
    expect(screen.getByText(/passcode 551 730/)).toBeInTheDocument();
    expect(screen.queryByText("Minutes")).not.toBeInTheDocument();
  });

  it("shows a typed link as the one video link, with no dial-in", async () => {
    await addMeeting({ id: "mtg-zoom", dialIn: "https://zoom.us/j/123456", passcode: "99" });
    await openDetail("mtg-zoom");
    expect(screen.getByRole("link", { name: "Video call link" })).toHaveAttribute(
      "href",
      "https://zoom.us/j/123456",
    );
    // A URL is not a number to dial, so there is no dial-in line and no
    // second way in.
    expect(screen.queryByText(/Dial in/)).not.toBeInTheDocument();
    expect(screen.getByText("Passcode 99")).toBeInTheDocument();
  });

  it("shows no dial-in for a room address typed without its scheme", async () => {
    await addMeeting({ id: "mtg-bare", dialIn: "meet.jit.si/someone-elses-room" });
    await openDetail("mtg-bare");
    const join = meetingJoin(
      { id: "mtg-bare", dialIn: "meet.jit.si/someone-elses-room" },
      seen.state.community.association.id,
    );
    expect(screen.getByRole("link", { name: "Video call link" })).toHaveAttribute(
      "href",
      join.videoUrl,
    );
    expect(screen.queryByText(/Dial in/)).not.toBeInTheDocument();
  });

  it("says when a meeting was first noticed for, once the board has moved it", async () => {
    await addMeeting({ id: "mtg-moved", date: "2026-09-30" });
    await openDetail("mtg-moved");
    expect(screen.queryByText(/^Was /)).not.toBeInTheDocument();
    await act(async () => {
      await seen.state.rescheduleMeeting("mtg-moved", { date: "2026-10-08" });
    });
    expect(
      screen.getByText("October 8, 2026 · in 49 days · 7:00 PM · Clubhouse"),
    ).toBeInTheDocument();
    expect(screen.getByText("Was Sep 30")).toBeInTheDocument();
  });

  it("carries the reason on a cancelled meeting, and no call to join", async () => {
    await addMeeting({ id: "mtg-called-off" });
    await openDetail("mtg-called-off");
    await act(async () => {
      await seen.state.cancelMeeting("mtg-called-off", "Storm warning");
    });
    expect(screen.getByText("Cancelled: Storm warning")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Video call link" })).not.toBeInTheDocument();
  });

  it("shows the minutes of a meeting that was held, and no call to join", async () => {
    await act(async () => {
      mount(null);
    });
    await act(async () => {
      seen.state.signIn("acct-arya");
    });
    await act(async () => {
      seen.state.addMeeting({
        id: "mtg-held",
        title: "Held meeting",
        date: "2026-08-10",
        time: "7:00 PM",
        status: "scheduled",
        kind: "board",
        location: "Clubhouse",
        dialIn: "",
        passcode: "",
        attendees: [],
        agenda: [],
        ballotIds: [],
      });
    });
    await openDetail("mtg-held");
    await act(async () => {
      await seen.state.recordMinutes("mtg-held", "Approved the budget. Adjourned 8:40pm.", [
        { name: "Arya Mehr", unit: "7", role: "President", channel: "in-person" },
      ]);
    });
    expect(screen.getByText("Approved the budget. Adjourned 8:40pm.")).toBeInTheDocument();
    expect(screen.getByText("Attended: Arya Mehr")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Video call link" })).not.toBeInTheDocument();
  });

  it("says when the meeting named by a link is not on the calendar", async () => {
    await openDetail("mtg-not-there");
    expect(screen.getByText("Meeting not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All meetings/ })).toHaveAttribute(
      "href",
      "/resident/calendar",
    );
  });
});
