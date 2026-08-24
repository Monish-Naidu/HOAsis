import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const push = vi.fn();
const replace = vi.fn();

// The components under test are client components that route. Stub the router
// so a test can assert where a click would send someone.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/resident",
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { SignInPanel } = await import("@/app/signin/sign-in-panel");
const { FundsGate } = await import("@/app/resident/finances/guard");
const { ErrorBoundary } = await import("@/components/app/error-boundary");
const { CommunityHero } = await import("@/components/app/community-hero");

function wrap(ui: ReactNode) {
  return render(<AppStateProvider>{ui}</AppStateProvider>);
}


/** Drives settings from inside the provider, the way the settings screen does. */
function AdminControls() {
  const { updateSettings, signIn } = useAppState();
  return (
    <div>
      <button onClick={() => signIn("acct-arya")}>sign in arya</button>
      <button onClick={() => updateSettings({ showFundsToResidents: false })}>hide funds</button>
      <button onClick={() => updateSettings({ displayName: "Cedar Court" })}>rename</button>
    </div>
  );
}

describe("sign in", () => {
  it("sends an admin to the admin view and a resident to the resident view", async () => {
    const user = userEvent.setup();
    wrap(<SignInPanel />);

    await user.click(screen.getByRole("button", { name: /Arya Mehr/ }));
    expect(push).toHaveBeenCalledWith("/admin");

    push.mockClear();
    await user.click(screen.getByRole("button", { name: /Monish Naidu/ }));
    expect(push).toHaveBeenCalledWith("/resident");
  });

  it("offers create account without pretending to verify anything", async () => {
    const user = userEvent.setup();
    wrap(<SignInPanel />);

    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Unit number/i)).toBeInTheDocument();
  });

  it("matches a typed email to a seeded account", async () => {
    const user = userEvent.setup();
    wrap(<SignInPanel />);

    await user.type(screen.getByLabelText(/Email/i), "arya.mehr@example.com");
    // "Sign in" names both the tab and the submit button; take the submit.
    const submit = screen
      .getAllByRole("button", { name: /^Sign in$/ })
      .find((button) => button.getAttribute("type") === "submit");
    await user.click(submit!);
    expect(push).toHaveBeenCalledWith("/admin");
  });
});

describe("admin settings reach the resident UI", () => {
  it("hiding funds replaces the page with an explanation", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <AdminControls />
        <FundsGate>
          <p>Reserve balance</p>
        </FundsGate>
      </>,
    );

    expect(screen.getByText("Reserve balance")).toBeInTheDocument();

    await user.click(screen.getByText("hide funds"));
    expect(screen.queryByText("Reserve balance")).not.toBeInTheDocument();
    expect(screen.getByText(/not published/i)).toBeInTheDocument();
  });

  it("renaming the community updates the hero", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <AdminControls />
        <CommunityHero />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Mehr Meadows" })).toBeInTheDocument();
    await user.click(screen.getByText("rename"));
    expect(screen.getByRole("heading", { name: "Cedar Court" })).toBeInTheDocument();
  });
});

describe("error boundary", () => {
  function Boom(): never {
    throw new Error("panel exploded");
  }

  it("contains a failure to its own region and offers a way back", async () => {
    // React logs the caught error; silence it so the run stays readable.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <div>
        <p>Rest of the page</p>
        <ErrorBoundary label="Reserves" onError={onError}>
          <Boom />
        </ErrorBoundary>
      </div>,
    );

    expect(screen.getByText("Rest of the page")).toBeInTheDocument();
    expect(screen.getByText(/Reserves could not load/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();

    spy.mockRestore();
  });

  it("renders children untouched when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>All fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All fine")).toBeInTheDocument();
  });
});
