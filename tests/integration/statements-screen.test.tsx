import { describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/board/money/statements",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { StatementsScreen } = await import("@/app/board/money/statements/statements-screen");

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

describe("the statements screen in the demo", () => {
  it("counts one statement per home, filters to homes with a balance, and prints them all", async () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const homes = result.current.community.homes.length;
    render(<StatementsScreen />, { wrapper });
    expect(screen.getByText(new RegExp(`^${homes} statements for `))).toBeTruthy();

    const print = vi.spyOn(window, "print").mockImplementation(() => {
      // While the dialog is open every home's statement is on the page.
      expect(document.body.dataset.printing).toBe("statement");
      expect(document.querySelectorAll(".statement-sheet")).toHaveLength(homes);
      window.dispatchEvent(new Event("afterprint"));
    });
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Print all" }));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.body.dataset.printing).toBeUndefined();
    expect(document.querySelectorAll(".statement-sheet")).toHaveLength(0);

    await userEvent.selectOptions(screen.getByLabelText("Which homes"), "balance");
    const withBalance = screen.getByText(/^\d+ statements? for /).textContent;
    expect(Number(withBalance?.split(" ")[0])).toBeLessThanOrEqual(homes);
    // Printing every home's statement into the page is the slow part, and it
    // slows more when other suites share the machine.
  }, 20_000);

  it("adds up on every row: brought forward + billed - paid - credits = balance", async () => {
    render(<StatementsScreen />, { wrapper });
    await screen.findAllByRole("button", { name: /^Print the statement for / });
    const cents = (text: string) => {
      const negative = /^-|\(/.test(text.trim());
      const n = Math.round(Number(text.replace(/[^0-9.]/g, "")) * 100);
      return negative ? -n : n;
    };
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"))
        .slice(1, 6)
        .map((td) => cents(td.textContent ?? ""));
      const [forward, billed, paid, credits, balance] = cells;
      expect(forward + billed - paid - credits, row.textContent ?? "").toBe(balance);
    }
  });

  it("lists homes by lot, not in the order they were added", async () => {
    render(<StatementsScreen />, { wrapper });
    await screen.findAllByRole("button", { name: /^Print the statement for / });
    const units = Array.from(
      document.querySelectorAll("tbody tr td:first-child p:first-child"),
    ).map((p) => p.textContent ?? "");
    const sorted = [...units].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    expect(units).toEqual(sorted);
  });
});
