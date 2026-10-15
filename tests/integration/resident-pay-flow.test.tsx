import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/resident/pay",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { PayFlow } = await import("@/app/resident/pay/pay-flow");

/** The pay screen's wording and what it hides while a method is being added. */

const seen = { state: null as unknown as ReturnType<typeof useAppState> };
function Probe() {
  const state = useAppState();
  useEffect(() => {
    seen.state = state;
  });
  return null;
}
function mount(ui: ReactNode) {
  return render(
    <AppStateProvider>
      <ToastProvider>
        <Probe />
        {ui}
      </ToastProvider>
    </AppStateProvider>,
  );
}

async function openAs(accountId: string) {
  await act(async () => {
    mount(null);
  });
  await act(async () => {
    seen.state.signIn(accountId);
  });
  await act(async () => {
    mount(<PayFlow />);
  });
}

describe("adding a payment method", () => {
  it("is called the same thing everywhere, and puts the amount away while it is open", async () => {
    const user = userEvent.setup();
    await openAs("acct-monish");
    expect(screen.queryByText(/Save a card|Save payment method/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Amount" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Add a payment method" }));
    expect(screen.queryByRole("heading", { name: "Amount" })).not.toBeInTheDocument();
    expect(screen.queryByText("Other amount")).not.toBeInTheDocument();
  });
});

describe("an amount that cannot be paid", () => {
  it("says why next to the button that is off, not only above it", async () => {
    const user = userEvent.setup();
    await openAs("acct-monish");
    await user.click(screen.getByText("Other amount"));
    await user.type(screen.getByPlaceholderText("0.00"), "285.001");
    // Once under the amount, once next to the button.
    expect(screen.getAllByText(/Use whole cents/).length).toBe(2);
  });
});
