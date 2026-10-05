import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Signing in again after the association failed to load. Auth sees the same
 * person and announces nothing, so the sign-in form itself has to ask for
 * the load again, or the failure stands until a hard reload.
 */

const order: string[] = [];
const push = vi.fn((path: string) => {
  order.push(`push:${path}`);
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/env", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/env")>()),
  hasSupabase: true,
}));

let signInAnswer: { ok: boolean; message?: string } = { ok: true };
vi.mock("@/lib/auth", () => ({
  signInWithPassword: vi.fn(async () => signInAnswer),
  signUp: vi.fn(async () => ({ ok: true })),
  requestPasswordReset: vi.fn(async () => ({ ok: true })),
}));

const retryRemote = vi.fn(async () => {
  order.push("retry");
});
vi.mock("@/lib/data/remote-store", () => ({
  retryRemote,
  // The last load failed: signed in, nothing on screen.
  useRemote: () => ({ status: "error", community: null, message: "Could not load the homes" }),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({ rpc: async () => ({ data: [{ role: "resident" }] }) }),
}));
vi.mock("@/lib/join-status", () => ({ fetchJoinStatus: async () => [] }));

vi.mock("@/lib/app-state", async (original) => ({
  ...(await original<typeof import("@/lib/app-state")>()),
  useAppState: () => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
    account: null,
    accounts: [],
    communities: [],
    community: { id: "demo", settings: { displayName: "Willow Creek Estates" }, association: { unitCount: 14 } },
    setCommunity: vi.fn(),
  }),
}));

const { SignInPanel } = await import("@/app/signin/sign-in-panel");

async function signIn() {
  const user = userEvent.setup();
  render(<SignInPanel />);
  await user.type(screen.getByLabelText(/Email/i), "gwen@example.com");
  await user.type(screen.getByLabelText(/Password/i), "correct horse");
  const submit = screen
    .getAllByRole("button", { name: /^Sign in$/ })
    .find((button) => button.getAttribute("type") === "submit");
  await user.click(submit!);
}

beforeEach(() => {
  order.length = 0;
  signInAnswer = { ok: true };
});

describe("signing in after a failed load", () => {
  it("asks for the association again before going anywhere", async () => {
    await signIn();
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/resident"));
    expect(retryRemote).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["retry", "push:/resident"]);
  });

  it("does not ask when the sign in itself was refused", async () => {
    signInAnswer = { ok: false, message: "That email and password do not match." };
    await signIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password do not match.");
    expect(retryRemote).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
