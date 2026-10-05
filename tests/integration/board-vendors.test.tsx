import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board/vendors",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { VendorsScreen } = await import("@/app/board/vendors/vendors-screen");

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

describe("Add vendor", () => {
  it("asks what they do for you and saves it as the vendor's usual category", async () => {
    const user = userEvent.setup();
    wrap(<VendorsScreen />);
    act(() => seen.state.signIn("acct-arya"));
    await user.click(screen.getByRole("button", { name: "Add vendor" }));
    await user.type(screen.getByPlaceholderText("Cascade Grounds Co."), "Evergreen Lawn");

    // Nothing is assumed: without a choice the form does not save.
    const choice = screen.getByLabelText("What they do for you") as HTMLSelectElement;
    expect(choice.value).toBe("");
    expect(screen.getByRole("button", { name: "Save vendor" })).toBeDisabled();

    await user.selectOptions(choice, "Landscaping");
    await user.click(screen.getByRole("button", { name: "Save vendor" }));
    const saved = seen.state.vendors.find((v) => v.name === "Evergreen Lawn");
    expect(saved?.defaultCategory).toBe("Landscaping");
  });
});
