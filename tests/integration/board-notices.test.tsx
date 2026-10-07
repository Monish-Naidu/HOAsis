import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board/violations",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { NoticesBoard } = await import("@/components/app/notices-board");
const { NoticeLetter } = await import("@/components/app/notice-letter");

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

describe("an opened notice", () => {
  it("draws no grey photo frame for a photo that has no file", async () => {
    const user = userEvent.setup();
    wrap(<NoticesBoard />);
    act(() => seen.state.signIn("acct-arya"));
    // The demo's notices carry described photos with no file behind them.
    const withBriefOnly = seen.state.community.violations.filter(
      (v) => v.stage !== "cured" && v.photos.length > 0 && v.photos.every((p) => !p.src),
    );
    expect(withBriefOnly.length).toBeGreaterThan(0);
    for (const button of screen.getAllByRole("button", { expanded: false })) {
      if (!button.closest('[id^="vio-"]')) continue;
      await user.click(button);
    }
    expect(screen.queryByText(/Photograph \d+ of \d+/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Next photograph")).not.toBeInTheDocument();
  });
});

describe("what needs fixing", () => {
  it("shows on the opened notice, labelled, as the owner reads it", async () => {
    const user = userEvent.setup();
    wrap(<NoticesBoard />);
    act(() => seen.state.signIn("acct-arya"));
    act(() => {
      seen.state.addNotice({
        homeId: "own-042",
        ownerName: "Monish Naidu",
        unit: "42",
        rule: "Fence needs paint",
        fix: "Two coats of white by the 30th",
      });
    });
    const row = document.querySelector(`#vio-${seen.state.community.violations[0].id}`) as HTMLElement;
    await user.click(row.querySelector("button")!);
    expect(within(row).getByText("What needs fixing")).toBeInTheDocument();
    expect(within(row).getAllByText(/Two coats of white by the 30th/).length).toBeGreaterThan(0);
  });
});

describe("the printed letter", () => {
  it("carries what needs fixing", () => {
    wrap(<NoticesBoard />);
    act(() => seen.state.signIn("acct-arya"));
    const violation = { ...seen.state.community.violations[0], fix: "Two coats of white by the 30th" };
    render(
      <AppStateProvider>
        <NoticeLetter violation={violation} onClose={() => {}} />
      </AppStateProvider>,
    );
    expect(screen.getByText("What needs fixing: Two coats of white by the 30th")).toBeInTheDocument();
  });
});
