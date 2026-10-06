import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

/**
 * The board contact email in Settings. A typo is refused with a reason and
 * never written, and "saved" is said only once the write resolved true.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board/settings",
  useSearchParams: () => new URLSearchParams(),
}));

const { ToastProvider } = await import("@/components/app/toast");
const { ContactEmailRow } = await import("@/app/board/settings/settings-screen");

const inToasts = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

describe("ContactEmailRow", () => {
  it("refuses an address that does not look right and writes nothing", async () => {
    const save = vi.fn(() => true);
    render(<ContactEmailRow value="" save={save} />, { wrapper: inToasts });
    await userEvent.type(screen.getByLabelText("Board contact email"), "board-at-example");
    await userEvent.tab();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Saved/)).toBeNull();
  });

  it("says saved once the write resolved true", async () => {
    let answer!: (ok: boolean) => void;
    const save = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)));
    render(<ContactEmailRow value="" save={save} />, { wrapper: inToasts });
    await userEvent.type(screen.getByLabelText("Board contact email"), "board@example.com");
    await userEvent.tab();
    expect(save).toHaveBeenCalledWith("board@example.com");
    expect(screen.queryByText(/^Saved/)).toBeNull();
    answer(true);
    await waitFor(() => expect(screen.getByText(/^Saved/)).toBeTruthy());
  });

  it("stays quiet when the write is refused", async () => {
    const save = vi.fn(() => Promise.resolve(false));
    render(<ContactEmailRow value="" save={save} />, { wrapper: inToasts });
    await userEvent.type(screen.getByLabelText("Board contact email"), "board@example.com");
    await userEvent.tab();
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(screen.queryByText(/^Saved/)).toBeNull();
  });
});
