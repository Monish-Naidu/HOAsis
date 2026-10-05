import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The join form, opened from an invitation by somebody already signed in
 * who has a home in that association under the address they signed in with.
 * The invitation went to a different address, for a home this account does
 * not hold. The form used to open the home they have and say nothing.
 */

let search = "invite=A1B2C3&email=dana%40home.com";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/lib/supabase/env", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/env")>()),
  hasSupabase: true,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { email: "dana@work.com", user_metadata: { full_name: "Dana Whitfield" } } }),
  signUp: vi.fn(async () => ({ ok: true })),
}));

/** How many seats the press claims, as claim_my_seats answers. */
let claimed = 0;
const claim = vi.fn(async () => ({ data: claimed, error: null }));
vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    rpc: claim,
    // The association row comes back: this account is a member of it.
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: "maple-court" }, error: null }) }) }) }),
  }),
}));

const requestToJoin = vi.fn(async () => ({ ok: true }));
// One promise for the code, as the real lookup gives, so `use` settles.
const found = Promise.resolve({ name: "Maple Court HOA", place: "Bothell, WA" });
vi.mock("@/lib/app-state", async (original) => ({
  ...(await original<typeof import("@/lib/app-state")>()),
  useAppState: () => ({ setCommunity: vi.fn(), signIn: vi.fn(), lookupJoinCode: () => found, requestToJoin }),
  useCommunityById: () => undefined,
  useStorageReady: () => true,
}));

const { JoinPanel } = await import("@/app/join/join-panel");

// jsdom does not navigate. The form calls assign for a full load.
const assign = vi.fn<(path: string) => void>();
const realLocation = window.location;

beforeEach(() => {
  search = "invite=A1B2C3&email=dana%40home.com";
  claimed = 0;
  claim.mockClear();
  assign.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, origin: realLocation.origin, href: realLocation.href, assign },
  });
});

describe("an invitation sent to another address, opened by somebody who already has a home there", () => {
  it("says which address it was sent to, and only then goes to the home they have", async () => {
    const user = userEvent.setup();
    // The form waits on the join code lookup before it shows.
    await act(async () => {
      render(<JoinPanel />);
    });
    await user.click(await screen.findByRole("button", { name: /Open my home/ }));

    const told = await screen.findByRole("status");
    expect(told.textContent).toContain("This invitation was sent to dana@home.com.");
    expect(told.textContent).toContain("You are signed in as dana@work.com, which already has a home here.");
    expect(told.textContent).toContain("ask the board to change its email to dana@work.com");
    // Told first. Nothing has opened, and no request went to the board.
    expect(assign).not.toHaveBeenCalled();
    expect(requestToJoin).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Go to my home/ }));
    expect(assign).toHaveBeenCalledWith("/c/maple-court/resident");
    // The second press reads nothing again: the answer is already known.
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("opens the home at once when the press claimed the seat, after the board changed its email", async () => {
    // Same link, still naming dana@home.com. The board has since put
    // dana@work.com on the home, so this press claims it.
    claimed = 1;
    const user = userEvent.setup();
    await act(async () => {
      render(<JoinPanel />);
    });
    await user.click(await screen.findByRole("button", { name: /Open my home/ }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/c/maple-court/resident"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("opens the home at once when the invitation was for the signed-in address", async () => {
    search = "invite=A1B2C3&email=dana%40work.com";
    const user = userEvent.setup();
    // The form waits on the join code lookup before it shows.
    await act(async () => {
      render(<JoinPanel />);
    });
    await user.click(await screen.findByRole("button", { name: /Open my home/ }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/c/maple-court/resident"));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
