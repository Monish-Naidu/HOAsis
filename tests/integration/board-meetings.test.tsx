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
