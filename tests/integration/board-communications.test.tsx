import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board/communications",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { default: BoardCommunications } = await import("@/app/board/communications/page");

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

// The inbox card, not the reading pane: a subject shows in both.
const list = () => {
  let el: HTMLElement | null = screen.getByRole("heading", { name: "Inbox" });
  while (el && !el.className.includes("lg:col-span-2")) el = el.parentElement;
  return el!;
};

describe("the board inbox", () => {
  it("labels who each thread is addressed to", () => {
    wrap(<BoardCommunications />);
    act(() => seen.state.signIn("acct-arya"));
    expect(screen.getAllByText("To the board").length).toBeGreaterThan(0);
    expect(screen.getAllByText("To the Treasurer").length).toBeGreaterThan(0);
  });

  it("shows the treasurer her own threads and the board's under Mine, and the president only the board's", async () => {
    const user = userEvent.setup();
    wrap(<BoardCommunications />);
    act(() => seen.state.signIn("acct-dana"));
    const toTreasurer = seen.state.threads.filter((t) => t.toRole === "treasurer").map((t) => t.subject);
    expect(toTreasurer.length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Mine" }));
    for (const subject of toTreasurer) expect(within(list()).getByText(subject)).toBeInTheDocument();
    const toBoard = seen.state.threads.find((t) => t.toRole === "board")!;
    expect(within(list()).getByText(toBoard.subject)).toBeInTheDocument();

    act(() => seen.state.signIn("acct-arya"));
    for (const subject of toTreasurer) expect(within(list()).queryByText(subject)).not.toBeInTheDocument();
    expect(within(list()).getByText(toBoard.subject)).toBeInTheDocument();
  });

  it("keeps every thread readable under All", async () => {
    const user = userEvent.setup();
    wrap(<BoardCommunications />);
    act(() => seen.state.signIn("acct-arya"));
    await user.click(screen.getByRole("button", { name: "Mine" }));
    await user.click(screen.getByRole("button", { name: "All" }));
    for (const t of seen.state.threads) expect(within(list()).getByText(t.subject)).toBeInTheDocument();
  });

  it("stores the office on a thread an owner starts in the demo", async () => {
    wrap(<BoardCommunications />);
    act(() => seen.state.signIn("acct-monish"));
    const owner = seen.state.community.owners.find((o) => o.id === "own-042")!;
    await act(async () => {
      await seen.state.messageBoard(owner.id, "Budget question", "Where did the surplus go?", "Billing", "treasurer");
    });
    const made = seen.state.threads.find((t) => t.subject === "Budget question");
    expect(made?.toRole).toBe("treasurer");
    await act(async () => {
      await seen.state.messageBoard(owner.id, "Hello", "Anyone there?");
    });
    expect(seen.state.threads.find((t) => t.subject === "Hello")?.toRole).toBe("board");
  });
});
