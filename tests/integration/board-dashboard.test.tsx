import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(),
}));

// The count-up numbers ask whether to animate; jsdom has no matchMedia, so
// say "reduced motion" and they print their final value at once.
window.matchMedia = ((query: string) => ({
  matches: true,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  onchange: null,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { default: BoardDashboard } = await import("@/app/board/page");

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
        <BoardDashboard />
      </ToastProvider>
    </AppStateProvider>,
  );
  act(() => seen.state.signIn("acct-arya"));
}

/** The board dashboard in the demo: four questions, each with its context and a way in. */
describe("the board dashboard", () => {
  it("answers is the money OK with months of cover and the reserves line", () => {
    open();
    expect(screen.getByText("Cash on hand")).toBeInTheDocument();
    expect(screen.getByText(/^\d+(\.\d)? months of running costs$/)).toBeInTheDocument();
    expect(screen.getByText(/^Reserves \$[\d,]+ · \d+% funded$/)).toBeInTheDocument();
  });

  it("answers who owes with homes, dollars and the oldest balance, and offers reminders", () => {
    open();
    expect(screen.getByText(/^\d+ homes? · \$[\d,]+ · oldest \d+ days?$/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Send reminders" });
    expect(link).toHaveAttribute("href", "/board/homeowners?remind=1");
  });

  it("answers are dues coming in with a pace and a way into Finances", () => {
    open();
    expect(screen.getByText(/^(On|Behind) pace$/)).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Open Finances" });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l).toHaveAttribute("href", "/board/money");
  });

  it("answers what is coming with the meeting's RSVPs and whether notice went out", () => {
    open();
    expect(screen.getByText("Next meeting")).toBeInTheDocument();
    expect(screen.getByText(/(coming|No RSVPs yet) · (notice sent|Notice not sent)/)).toBeInTheDocument();
  });

  it("says the month in one sentence from the books", () => {
    open();
    expect(
      screen.getByText(/^August: billed \$[\d,]+ on the 1st, \$[\d,]+ collected so far \(\d+%\), autopay covers \d+ homes, reminders go out on the 16th\.$/),
    ).toBeInTheDocument();
  });

  it("names Needs you today rows as things to do, and keeps the old wording off", () => {
    open();
    expect(screen.getByText("Needs you today")).toBeInTheDocument();
    const rows = screen
      .getAllByRole("link")
      .map((a) => a.textContent ?? "")
      .filter((t) => /to confirm|to approve|asking to join|to answer|to recheck|to send notice for|overdue/.test(t));
    expect(rows.length).toBeGreaterThan(0);
    for (const gone of ["waiting on a signature", "action item", "waiting on an answer", "without notice to owners"]) {
      expect(document.body.textContent).not.toContain(gone);
    }
  });

  it("links the transactions to confirm to the whole year, where the demo's waiting lines are", () => {
    open();
    const row = screen.getAllByRole("link").find((a) => /transactions? to confirm/.test(a.textContent ?? ""));
    if (row) expect(row).toHaveAttribute("href", "/board/money/transactions?status=needs-review&period=this-year");
  });
});
