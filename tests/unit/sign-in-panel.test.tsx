import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The sign-in page's three honest states: a stranger sent here from a page,
 * a person who is already signed in, and a failed sign in that must not
 * follow them to the other tab.
 */

let query = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(query),
}));

vi.mock("@/lib/supabase/env", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/env")>()),
  hasSupabase: true,
}));

let auth: { user: { email: string } | null; loading: boolean } = { user: null, loading: false };
const signInWithPassword = vi.fn(async () => ({
  ok: false,
  message: "That email and password do not match.",
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => auth,
  signOutSettled: async () => {},
  clearExiting: () => {},
  signInWithPassword,
  signUp: vi.fn(async () => ({ ok: true })),
  requestPasswordReset: vi.fn(async () => ({ ok: true })),
}));

let remoteState: { status: string; community: unknown } = { status: "signed-out", community: null };
vi.mock("@/lib/data/remote-store", () => ({
  retryRemote: vi.fn(),
  useRemote: () => remoteState,
}));

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({ rpc: async () => ({ data: [] }) }),
}));

vi.mock("@/lib/app-state", async (original) => ({
  ...(await original<typeof import("@/lib/app-state")>()),
  useAppState: () => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
    account: null,
    accounts: [],
    communities: [],
    community: {
      id: "demo",
      settings: { displayName: "Willow Creek Estates" },
      association: { unitCount: 14 },
    },
    setCommunity: vi.fn(),
  }),
}));

const { SignInPanel } = await import("@/app/signin/sign-in-panel");

beforeEach(() => {
  query = "";
  auth = { user: null, loading: false };
  remoteState = { status: "signed-out", community: null };
});

describe("a stranger sent to sign in", () => {
  it("is told which page they were on their way to", () => {
    query = "next=%2Fresident%2Fpay";
    render(<SignInPanel />);
    expect(screen.getByText("Sign in to open Pay.")).toBeVisible();
  });

  it("is told when the association link led nowhere", () => {
    query = "missing=no-such-place";
    render(<SignInPanel />);
    expect(screen.getByText(/No association at that address\./)).toBeVisible();
  });

  it("says nothing extra for a plain visit", () => {
    render(<SignInPanel />);
    expect(screen.queryByText(/Sign in to open/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No association at that address/)).not.toBeInTheDocument();
  });
});

describe("a failed sign in", () => {
  it("does not follow the person to the Create account tab", async () => {
    const user = userEvent.setup();
    render(<SignInPanel />);
    await user.type(screen.getByLabelText(/Email/i), "gwen@example.com");
    await user.type(screen.getByLabelText(/Password/i), "wrong horse");
    const submit = screen
      .getAllByRole("button", { name: /^Sign in$/ })
      .find((b) => b.getAttribute("type") === "submit");
    await user.click(submit!);
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");

    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("somebody who is already signed in", () => {
  it("sees who they are and a door, not the stranger form", () => {
    auth = { user: { email: "gwen@example.com" }, loading: false };
    remoteState = {
      status: "ready",
      community: { settings: { displayName: "Willow Creek Estates" } },
    };
    query = "next=%2Fresident%2Fpay";
    render(<SignInPanel />);
    expect(screen.getByText("You are signed in")).toBeVisible();
    expect(screen.getByRole("button", { name: /Open my account/ })).toBeVisible();
    expect(screen.queryByLabelText(/Password/i)).not.toBeInTheDocument();
    // The reason line is for strangers.
    expect(screen.queryByText(/Sign in to open/)).not.toBeInTheDocument();
  });

  it("keeps the form when the association failed to load, so signing in again can retry it", () => {
    auth = { user: { email: "gwen@example.com" }, loading: false };
    remoteState = { status: "error", community: null };
    render(<SignInPanel />);
    expect(screen.queryByText("You are signed in")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeVisible();
  });

  it("shows neither while the session is still being read", () => {
    auth = { user: null, loading: true };
    render(<SignInPanel />);
    expect(screen.queryByLabelText(/Password/i)).not.toBeInTheDocument();
    expect(screen.queryByText("You are signed in")).not.toBeInTheDocument();
  });
});
