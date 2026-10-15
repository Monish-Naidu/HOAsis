import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The join code box and the invitation that matches nothing. The box said
 * nothing about its six-character rule and dropped extra characters without
 * a word; a dead invitation link spoke to somebody who never typed a code.
 */

let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/lib/supabase/env", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/env")>()),
  hasSupabase: true,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null, loading: false }),
  signUp: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({}) }));

// Nothing answers to any code.
const nothing = Promise.resolve(null);
vi.mock("@/lib/app-state", async (original) => ({
  ...(await original<typeof import("@/lib/app-state")>()),
  useAppState: () => ({
    setCommunity: vi.fn(),
    signIn: vi.fn(),
    lookupJoinCode: () => nothing,
    requestToJoin: vi.fn(),
  }),
  useCommunityById: () => undefined,
  useStorageReady: () => true,
}));

const { JoinPanel } = await import("@/app/join/join-panel");

describe("the join code box", () => {
  it("states the rule under the box and keeps the button off until there are six", async () => {
    search = "";
    const user = userEvent.setup();
    await act(async () => {
      render(<JoinPanel />);
    });
    const button = screen.getByRole("button", { name: /Find my association/ });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Exactly six letters and numbers\. 0 of 6 entered\./)).toBeVisible();

    await user.type(screen.getByLabelText("Join code"), "ab12c");
    expect(button).toBeDisabled();
    expect(screen.getByText(/5 of 6 entered/)).toBeVisible();

    await user.type(screen.getByLabelText("Join code"), "3");
    expect(button).toBeEnabled();
  });

  it("does not throw away characters in silence", async () => {
    search = "";
    const user = userEvent.setup();
    await act(async () => {
      render(<JoinPanel />);
    });
    await user.type(screen.getByLabelText("Join code"), "ab12c3d4");
    expect(screen.getByLabelText("Join code")).toHaveValue("AB12C3D4");
    expect(screen.getByText(/That is 8 characters/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Find my association/ })).toBeDisabled();
  });

  it("does not grab the keyboard focus from the top of the page", async () => {
    search = "";
    await act(async () => {
      render(<JoinPanel />);
    });
    expect(screen.getByLabelText("Join code")).not.toHaveFocus();
  });
});

describe("an invitation link that matches nothing", () => {
  it("says the link is not valid, keeps the email, and offers to ask with a code", async () => {
    search = "invite=ZZZZZZ&email=dana%40home.com";
    const user = userEvent.setup();
    await act(async () => {
      render(<JoinPanel />);
    });
    expect(await screen.findByText("This invitation link is not valid")).toBeVisible();
    expect(screen.getByText("dana@home.com")).toBeVisible();
    expect(screen.queryByText(/did not match an association/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ask to join with a code" }));
    expect(screen.getByLabelText("Join code")).toHaveValue("");
  });
});
