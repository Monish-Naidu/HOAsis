import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";

let path = "/resident/pay";
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => path,
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider } = await import("@/lib/app-state");
const { RequireSession } = await import("@/components/app/account-menu");
const { noteLeaving, clearExiting } = await import("@/lib/auth");

/**
 * A stranger on a guarded page is sent to sign in with the page kept, so
 * signing in comes back to it. Somebody who has just chosen to sign out is
 * on their way already and is not sent with a reason.
 */

function mount(ui: ReactNode) {
  return render(<AppStateProvider>{ui}</AppStateProvider>);
}

beforeEach(() => {
  replace.mockClear();
  clearExiting();
  // The demo starts signed out: the seat is chosen on the sign-in page.
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("RequireSession", () => {
  it("sends a stranger to sign in with the page they asked for", async () => {
    path = "/resident/pay";
    await act(async () => {
      mount(
        <RequireSession>
          <p>guarded</p>
        </RequireSession>,
      );
    });
    expect(replace).toHaveBeenCalledWith("/signin?next=%2Fresident%2Fpay");
  });

  it("does not give a reason to somebody who just signed out", async () => {
    path = "/resident/more";
    noteLeaving();
    await act(async () => {
      mount(
        <RequireSession>
          <p>guarded</p>
        </RequireSession>,
      );
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
