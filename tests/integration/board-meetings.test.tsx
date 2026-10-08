import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Meeting } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board/meetings",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { default: BoardMeetings } = await import("@/app/board/meetings/page");
const { videoJoinUrl } = await import("@/lib/meetings/video");

/** The Meetings page says only what the product does: no room, no recording, no empty roll. */

const seen = { state: null as unknown as ReturnType<typeof useAppState> };
function Probe() {
  const state = useAppState();
  useEffect(() => {
    seen.state = state;
  });
  return null;
}

function wrap(ui: ReactNode) {
  return render(
    <AppStateProvider>
      <ToastProvider>
        <Probe />
        {ui}
      </ToastProvider>
    </AppStateProvider>,
  );
}

function meeting(over: Partial<Meeting>): Meeting {
  return {
    id: "mtg-test",
    title: "Budget meeting",
    date: "2026-08-20",
    time: "6:30 PM",
    status: "scheduled",
    kind: "board",
    location: "Clubhouse",
    dialIn: "",
    passcode: "",
    attendees: [],
    agenda: ["Call to order"],
    ballotIds: [],
    ...over,
  };
}

describe("the board's Meetings page", () => {
  it("describes what it does and promises no recording", () => {
    wrap(<BoardMeetings />);
    act(() => seen.state.signIn("acct-arya"));
    expect(screen.getByText("Upcoming meetings, who is coming, and action items.")).toBeInTheDocument();
    expect(screen.getByText("What was on the agenda")).toBeInTheDocument();
    // The annual meeting in the demo is marked as recorded; nothing records.
    expect(document.body.textContent).not.toMatch(/·\s*recording/i);
    expect(document.body.textContent).not.toMatch(/\d+ joined/);
  });

  it("draws no live room for anyone, and offers the call as a plain link on the day", () => {
    wrap(<BoardMeetings />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addMeeting(meeting({ id: "mtg-today", title: "Budget meeting" }));
    });
    // Nothing of the room: no tiles, no camera, no roll of who joined.
    expect(screen.queryByRole("button", { name: /camera|mute|leave|join$/i })).not.toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Join the call" });
    // The demo's own meeting is today and still marked live, and the one added is today.
    expect(links.map((l) => l.getAttribute("href"))).toContain(
      videoJoinUrl({ id: "mtg-today" }, seen.state.community.association.id),
    );
    expect(links.length).toBe(
      seen.state.community.meetings.filter((m) => m.status !== "ended" && (m.date === "2026-08-20" || m.status === "live")).length,
    );
  });

  it("gives a meeting on another day no Join card", () => {
    wrap(<BoardMeetings />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addMeeting(meeting({ id: "mtg-later", title: "Later meeting", date: "2026-12-01" }));
    });
    const row = document.getElementById("mtg-mtg-later")!;
    expect(within(row).queryByText("Today, 6:30 PM")).not.toBeInTheDocument();
    expect(screen.queryByText("Today, 6:30 PM")).not.toBeInTheDocument();
  });

  it("shows In the room only for a past meeting that has attendees", () => {
    wrap(<BoardMeetings />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addMeeting(
        meeting({ id: "mtg-empty", title: "Quiet meeting", date: "2026-01-05", status: "ended" }),
      );
    });
    act(() =>
      seen.state.addMeeting(
        meeting({
          id: "mtg-full",
          title: "Full meeting",
          date: "2026-02-05",
          status: "ended",
          attendees: [{ name: "Arya Mehr", unit: "7", role: "President", channel: "in-person" }],
        }),
      ),
    );
    const quiet = document.getElementById("mtg-mtg-empty")!;
    expect(quiet).toBeTruthy();
    expect(within(quiet).queryByText("In the room")).not.toBeInTheDocument();
    expect(within(quiet).queryByText(/attended/)).not.toBeInTheDocument();
    const full = document.getElementById("mtg-mtg-full")!;
    expect(within(full).getByText("In the room")).toBeInTheDocument();
    expect(within(full).getByText("1 attended", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("In the room")).toHaveLength(1);
  });
});

describe("after the notice: move, cancel, minutes (demo)", () => {
  const find = (id: string) => seen.state.community.meetings.find((m) => m.id === id)!;
  const person = { name: "Arya Mehr", unit: "7", role: "President", channel: "in-person" as const };

  it("moves a meeting and remembers the first date", async () => {
    wrap(<BoardMeetings />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addMeeting(meeting({ id: "mtg-move", date: "2026-09-10" }));
    });
    await act(async () => {
      await seen.state.rescheduleMeeting("mtg-move", { date: "2026-09-17", time: "7:00 PM" });
    });
    expect(find("mtg-move")).toMatchObject({ date: "2026-09-17", time: "7:00 PM", rescheduledFrom: "2026-09-10", location: "Clubhouse" });
    await act(async () => {
      await seen.state.rescheduleMeeting("mtg-move", { date: "2026-09-24", location: "Pool house" });
    });
    // Moved twice, it still says when it was first noticed for.
    expect(find("mtg-move")).toMatchObject({ date: "2026-09-24", rescheduledFrom: "2026-09-10", location: "Pool house", time: "7:00 PM" });
    expect(screen.getByText("Was Sep 10", { exact: false })).toBeInTheDocument();
  });

  it("refuses a past day, the same day twice, and a meeting that is over", async () => {
    wrap(<BoardMeetings />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addMeeting(meeting({ id: "mtg-a", date: "2026-09-10" }));
      seen.state.addMeeting(meeting({ id: "mtg-old", date: "2026-01-05" }));
    });
    expect(() => seen.state.rescheduleMeeting("mtg-a", { date: "2026-08-19" })).toThrow("Pick a date that has not passed.");
    expect(() => seen.state.rescheduleMeeting("mtg-old", { date: "2026-09-01" })).toThrow("That meeting is over.");
    await act(async () => {
      await seen.state.rescheduleMeeting("mtg-a", { date: "2026-09-10" });
    });
    expect(find("mtg-a").rescheduledFrom).toBeUndefined();
  });

  it("cancels with a reason, keeps the row, and moves it to Past meetings", async () => {
    wrap(<BoardMeetings />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addMeeting(meeting({ id: "mtg-c", title: "Storm meeting", date: "2026-09-10" }));
    });
    expect(() => seen.state.cancelMeeting("mtg-c", " ")).toThrow("Say why the meeting is cancelled.");
    await act(async () => {
      await seen.state.cancelMeeting("mtg-c", "Storm warning");
    });
    expect(find("mtg-c")).toMatchObject({ status: "cancelled", cancelReason: "Storm warning", cancelledDate: "2026-08-20" });
    const row = document.getElementById("mtg-mtg-c")!;
    expect(within(row).getByText("Cancelled")).toBeInTheDocument();
    expect(within(row).getByText("Cancelled: Storm warning")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Cancel the meeting" })).not.toBeInTheDocument();
    expect(() => seen.state.cancelMeeting("mtg-c", "Again")).toThrow("That meeting is over.");
    expect(() => seen.state.rescheduleMeeting("mtg-c", { date: "2026-09-12" })).toThrow("That meeting is over.");
    expect(() => seen.state.recordMinutes("mtg-c", "Nothing happened here.", [])).toThrow("A cancelled meeting has no minutes.");
  });

  it("records minutes for a meeting that was held, and again to change them", async () => {
    wrap(<BoardMeetings />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addMeeting(meeting({ id: "mtg-m", title: "Held meeting", date: "2026-08-10" }));
      seen.state.addMeeting(meeting({ id: "mtg-next", date: "2026-09-10" }));
    });
    expect(() => seen.state.recordMinutes("mtg-next", "Not held yet, so no.", [])).toThrow("The meeting has not happened yet.");
    expect(() => seen.state.recordMinutes("mtg-m", "short", [])).toThrow("Write the minutes first.");
    await act(async () => {
      await seen.state.recordMinutes("mtg-m", "  Approved the budget.  ", [person]);
    });
    expect(find("mtg-m")).toMatchObject({ minutes: "Approved the budget.", minutesDate: "2026-08-20", status: "ended", attended: [person] });
    const row = document.getElementById("mtg-mtg-m")!;
    expect(within(row).getByText("Approved the budget.")).toBeInTheDocument();
    expect(within(row).getByText("1 attended")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Edit minutes" })).toBeInTheDocument();
    await act(async () => {
      await seen.state.recordMinutes("mtg-m", "Approved the budget and the paving.", []);
    });
    expect(find("mtg-m")).toMatchObject({ minutes: "Approved the budget and the paving.", attended: [] });
  });
});

