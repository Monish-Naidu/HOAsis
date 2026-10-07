import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board/money/transactions",
  // The review queue link opens on the whole year, where the demo's waiting lines are.
  useSearchParams: () => new URLSearchParams("status=needs-review&period=this-year"),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { TransactionsScreen } = await import("@/app/board/money/transactions/transactions-screen");

const seen = { state: null as unknown as ReturnType<typeof useAppState> };
function Probe() {
  const state = useAppState();
  useEffect(() => {
    seen.state = state;
  });
  return null;
}

function open() {
  render(
    <AppStateProvider>
      <ToastProvider>
        <Probe />
        <TransactionsScreen />
      </ToastProvider>
    </AppStateProvider>,
  );
  act(() => seen.state.signIn("acct-arya"));
}

describe("Transactions: Reverse", () => {
  it("offers Reverse where it used to say Remove, and never deletes", async () => {
    open();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Reverse" }).length).toBeGreaterThan(0);
  });

  it("asks why, writes the opposite line and keeps the original, marked", async () => {
    const user = userEvent.setup();
    open();
    const target = seen.state.ledger.find((e) => e.status === "needs-review")!;
    const before = seen.state.ledger.length;

    await user.click(screen.getAllByRole("button", { name: "Reverse" })[0]);
    // Nothing is sent without a reason.
    const submit = screen.getAllByRole("button", { name: "Reverse" }).find((b) => b.getAttribute("type") === "submit")!;
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/^Why reverse /), "Entered twice");
    await user.click(submit);

    const ledger = seen.state.ledger;
    expect(ledger).toHaveLength(before + 1);
    expect(ledger.some((e) => e.id === target.id)).toBe(true);
    expect(ledger.find((e) => e.reversedEntryId)).toMatchObject({
      reversedEntryId: target.id,
      amountCents: -target.amountCents,
    });
    expect(await screen.findByText(/Transaction reversed/)).toBeInTheDocument();
    // Both lines are settled, so they leave the review filter. Under any
    // status the pair reads as what it is.
    await user.selectOptions(screen.getByLabelText("Status"), "any");
    expect(within(document.body).getAllByText("Reversed").length).toBeGreaterThan(0);
    expect(within(document.body).getAllByText("Reversal").length).toBeGreaterThan(0);
  });
});
