import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/** What the banner and the owner's Home line say in each billing state. */

let association: Record<string, unknown> = {};
vi.mock("next/navigation", () => ({ usePathname: () => "/board" }));
vi.mock("@/lib/metrics", () => ({ homeCount: () => 12 }));
vi.mock("@/lib/app-state", () => ({
  useAppState: () => ({ isRemote: true, community: { asOf: "2026-10-20", association } }),
}));

const { TrialBanner } = await import("@/components/app/trial-banner");
const { BoardPausedNote } = await import("@/components/app/board-paused-note");

const BODY = "The board's screens are read-only until a card is added; residents can still pay.";

const set = (over: Record<string, unknown>) => {
  association = {
    subscriptionStatus: "active", trialEndsOn: "2026-01-01", billing: { subscriptionId: "sub_1" }, ...over,
  };
};

describe("the board banner", () => {
  it("counts the days left while the card is failing", () => {
    set({ subscriptionStatus: "past_due", pastDueSince: "2026-10-15" });
    render(<TrialBanner />);
    expect(
      screen.getByText("Your card failed on October 15, 2026. Update it within 9 days or the board side becomes read-only."),
    ).toBeInTheDocument();
  });

  it("says read-only once the two weeks are up", () => {
    set({ subscriptionStatus: "past_due", pastDueSince: "2026-10-06" });
    render(<TrialBanner />);
    expect(screen.getByText("The last payment failed")).toBeInTheDocument();
    expect(screen.getByText(BODY)).toBeInTheDocument();
  });

  it("says what a cancelled subscription means", () => {
    set({ subscriptionStatus: "canceled" });
    render(<TrialBanner />);
    expect(screen.getByText("The subscription ended")).toBeInTheDocument();
    expect(screen.getByText(BODY)).toBeInTheDocument();
  });

  it("is silent for a paid association", () => {
    set({});
    const { container } = render(<TrialBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the owner's Home line", () => {
  const line = "The board's subscription ended, so the board's side is paused. You can still pay and read everything here.";

  it("shows when the board is locked, cancelled or past the two weeks", () => {
    set({ subscriptionStatus: "canceled" });
    const first = render(<BoardPausedNote />);
    expect(screen.getByText(line)).toBeInTheDocument();
    first.unmount();
    set({ subscriptionStatus: "past_due", pastDueSince: "2026-10-01" });
    render(<BoardPausedNote />);
    expect(screen.getByText(line)).toBeInTheDocument();
  });

  it("stays away while the board still has days left", () => {
    set({ subscriptionStatus: "past_due", pastDueSince: "2026-10-15" });
    const { container } = render(<BoardPausedNote />);
    expect(container).toBeEmptyDOMElement();
  });
});
