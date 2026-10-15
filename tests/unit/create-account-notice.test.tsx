import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The create-account notice on the sign-in page: what it says, and the way
 * it offers to send the confirmation email again, which the join page has
 * had all along (ResendLine).
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/env", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/env")>()),
  hasSupabase: true,
}));

const signUp = vi.fn(async () => ({ ok: true, message: undefined as string | undefined }));
const requestPasswordReset = vi.fn(async () => ({
  ok: true,
  message: "A reset link is on its way.",
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null, loading: false }),
  signOutSettled: async () => {},
  clearExiting: () => {},
  signUp,
  signInWithPassword: vi.fn(),
  requestPasswordReset,
}));

const resend = vi.fn(async () => ({ ok: true }));
vi.mock("@/components/app/resend-confirmation", () => ({ resendConfirmation: resend }));

vi.mock("@/lib/data/remote-store", () => ({
  retryRemote: vi.fn(),
  useRemote: () => ({ status: "signed-out", community: null, message: null }),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({ rpc: async () => ({ data: [] }) }),
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
    community: {
      id: "demo",
      settings: { displayName: "Willow Creek Estates" },
      association: { unitCount: 14 },
    },
    setCommunity: vi.fn(),
  }),
}));

const { SignInPanel } = await import("@/app/signin/sign-in-panel");

async function createAccount() {
  const user = userEvent.setup();
  render(<SignInPanel />);
  await user.click(screen.getByRole("button", { name: "Create account" }));
  await user.type(screen.getByLabelText(/Full name/i), "Nadia Bell");
  await user.type(screen.getByLabelText(/Email/i), "nadia@example.com");
  await user.type(screen.getByLabelText(/Password/i), "correct horse");
  const submit = screen
    .getAllByRole("button", { name: /^Create account$/ })
    .find((button) => button.getAttribute("type") === "submit")!;
  await user.click(submit);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  signUp.mockResolvedValue({ ok: true, message: undefined });
});

describe("the create-account notice", () => {
  it("says the email is waiting and offers to send it again", async () => {
    signUp.mockResolvedValue({
      ok: true,
      message: "Check your email to confirm the address, then sign in.",
    });
    const user = await createAccount();

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check your email to confirm the address, then sign in.",
    );
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Send it again" }));
    expect(resend).toHaveBeenCalledWith("nadia@example.com");
    expect(await screen.findByText("Sent again")).toBeInTheDocument();
  });

  it("offers no resend under a refusal", async () => {
    signUp.mockResolvedValue({ ok: false, message: "There is already an account for that email." });
    await createAccount();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "There is already an account for that email.",
    );
    expect(screen.queryByRole("button", { name: "Send it again" })).not.toBeInTheDocument();
  });

  it("does not offer a confirmation resend for a password reset", async () => {
    const user = userEvent.setup();
    render(<SignInPanel />);
    await user.type(screen.getByLabelText(/Email/i), "nadia@example.com");
    await user.click(screen.getByRole("button", { name: /Forgot your password/ }));

    expect(await screen.findByRole("status")).toHaveTextContent("A reset link is on its way.");
    expect(screen.queryByRole("button", { name: "Send it again" })).not.toBeInTheDocument();
    expect(resend).not.toHaveBeenCalled();
  });
});
