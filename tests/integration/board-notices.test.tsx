import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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
