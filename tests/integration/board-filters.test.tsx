import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The URL a screen opens on, set per test. replace is spied on so a click can
// be asserted to write the filter back to it.
const url = { search: "", path: "/board/homeowners" };
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => url.path,
  useSearchParams: () => new URLSearchParams(url.search),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { HomeownersScreen } = await import("@/app/board/homeowners/homeowners-screen");
const { CollectionsLadder } = await import("@/components/app/collections-ladder");
const { TransactionsScreen } = await import("@/app/board/money/transactions/transactions-screen");
const { homeFilterCounts } = await import("@/lib/roster-filters");

const seen = { state: null as unknown as ReturnType<typeof useAppState> };
function Probe() {
  const state = useAppState();
  useEffect(() => {
    seen.state = state;
  });
  return null;
}

function open(ui: React.ReactNode) {
  render(
    <AppStateProvider>
      <ToastProvider>
        <Probe />
        {ui}
      </ToastProvider>
    </AppStateProvider>,
  );
  act(() => seen.state.signIn("acct-arya"));
}

beforeEach(() => {
  replace.mockClear();
  url.search = "";
});

describe("Homeowners filters", () => {
  it("puts a count on every chip, from the same rule as the list", () => {
    open(<HomeownersScreen />);
    const counts = homeFilterCounts(seen.state.community.homes);
    for (const [name, count] of [
      ["Paid up", counts["paid-up"]],
      ["Past due", counts["past-due"]],
      ["Autopay on", counts.autopay],
      ["No email on file", counts["no-email"]],
    ] as const) {
      expect(screen.getByRole("button", { name: new RegExp(`^${name}\\s*${count}$`) })).toBeInTheDocument();
    }
  });

  it("opens on the filter in the URL", () => {
    url.search = "filter=past-due";
    open(<HomeownersScreen />);
    expect(screen.getByRole("button", { name: /^Past due/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("writes a chosen chip back to the URL", async () => {
    open(<HomeownersScreen />);
    await userEvent.setup().click(screen.getByRole("button", { name: /^Autopay on/ }));
    expect(replace).toHaveBeenCalledWith("/board/homeowners?filter=autopay", { scroll: false });
  });

  it("reads and writes the search text", async () => {
    url.search = "q=zzzz-nobody";
    open(<HomeownersScreen />);
    expect(screen.getByLabelText("Search owners")).toHaveValue("zzzz-nobody");
    expect(screen.getByText("Nobody matches")).toBeInTheDocument();
  });
});

describe("Past due filters", () => {
  it("shows a chip for each rung that has homes, with its count", () => {
    url.path = "/board/money/collections";
    open(<CollectionsLadder autopayFailedUnits={new Set()} />);
    expect(screen.getByRole("group", { name: "Show homes at" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All\s*\d+$/ })).toBeInTheDocument();
  });

  it("writes the stage to the URL", async () => {
    url.path = "/board/money/collections";
    open(<CollectionsLadder />);
    const group = screen.getByRole("group", { name: "Show homes at" });
    const second = group.querySelectorAll("button")[1] as HTMLButtonElement;
    await userEvent.setup().click(second);
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/board\/money\/collections\?stage=/), { scroll: false });
  });
});

describe("Transactions filters", () => {
  beforeEach(() => {
    url.path = "/board/money/transactions";
  });

  it("opens on the last 30 days, and says the dates in words", () => {
    open(<TransactionsScreen />);
    // One button, not seven chips: the name and the dates, so nobody has to
    // know what a preset means. The demo's clock is pinned to 2026-08-20.
    const button = screen.getByRole("button", { name: /^Last 30 days/ });
    expect(button).toHaveTextContent("Last 30 days");
    expect(button).toHaveTextContent("Jul 22 to Aug 20, 2026");
    expect(screen.queryByRole("button", { name: "Last year" })).toBeNull();
  });

  it("lists the periods in a menu, each with its dates, and writes the choice to the URL", async () => {
    const user = userEvent.setup();
    open(<TransactionsScreen />);
    await user.click(screen.getByRole("button", { name: /^Last 30 days/ }));
    expect(screen.getByRole("button", { name: /^This month.*Aug 1 to Aug 31, 2026/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Last month/ }));
    expect(replace).toHaveBeenCalledWith("/board/money/transactions?period=last-month", { scroll: false });
  });

  it("applies custom dates when the menu closes, and keeps them in the URL", async () => {
    const user = userEvent.setup();
    open(<TransactionsScreen />);
    await user.click(screen.getByRole("button", { name: /^Last 30 days/ }));
    await user.click(screen.getByRole("button", { name: /^Custom/ }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-05" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-04-09" } });
    expect(replace).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(replace).toHaveBeenCalledWith(
      "/board/money/transactions?period=custom&from=2026-03-05&to=2026-04-09",
      { scroll: false },
    );
  });

  it("steps a month back and forward with the arrows, and not past today", async () => {
    const user = userEvent.setup();
    url.search = "period=this-month";
    open(<TransactionsScreen />);
    expect(screen.getByRole("button", { name: "Next period" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous period" }));
    // This month back one is Last month, which is a preset, so the link stays short.
    expect(replace).toHaveBeenLastCalledWith("/board/money/transactions?period=last-month", { scroll: false });
  });

  it("steps past the presets as a custom month, named in words", async () => {
    const user = userEvent.setup();
    url.search = "period=custom&from=2026-06-01&to=2026-06-30";
    open(<TransactionsScreen />);
    const button = screen.getByRole("button", { name: /^June 2026/ });
    expect(button).toHaveTextContent("Jun 1 to Jun 30, 2026");
    await user.click(screen.getByRole("button", { name: "Previous period" }));
    expect(replace).toHaveBeenLastCalledWith(
      "/board/money/transactions?period=custom&from=2026-05-01&to=2026-05-31",
      { scroll: false },
    );
    // The screen shows May on the click, before the router catches up, so
    // forward from there is June again.
    await user.click(screen.getByRole("button", { name: "Next period" }));
    expect(replace).toHaveBeenLastCalledWith(
      "/board/money/transactions?period=custom&from=2026-06-01&to=2026-06-30",
      { scroll: false },
    );
  });

  it("does not step a 30-day or an odd custom range", () => {
    open(<TransactionsScreen />);
    expect(screen.getByRole("button", { name: "Previous period" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next period" })).toBeDisabled();
  });

  it("has no category dropdown; the By category panel is the category filter", async () => {
    const user = userEvent.setup();
    url.search = "period=this-year";
    open(<TransactionsScreen />);
    expect(screen.queryByLabelText("Category")).toBeNull();
    expect(screen.queryByRole("option", { name: /^All categories/ })).toBeNull();
    const panel = screen.getByText(/^By category/).closest("details")!;
    expect(panel).toHaveAttribute("open");
    const first = within(panel).getAllByRole("button")[0];
    expect(first).toHaveAttribute("aria-pressed", "false");
    await user.click(first);
    expect(replace).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\/board\/money\/transactions\?period=this-year&category=/),
      { scroll: false },
    );
  });

  it("shows a category as pressed when the URL names it, and clears on a second press", async () => {
    const user = userEvent.setup();
    url.search = "period=this-year";
    open(<TransactionsScreen />);
    const panel = screen.getByText(/^By category/).closest("details")!;
    const name = within(panel).getAllByRole("button")[0].textContent!.split(" · ")[0];
    cleanup();
    url.search = `period=this-year&category=${encodeURIComponent(name)}`;
    open(<TransactionsScreen />);
    const pressed = screen
      .getByText(/^By category/)
      .closest("details")!
      .querySelector('button[aria-pressed="true"]') as HTMLElement;
    expect(pressed).toHaveTextContent(name);
    await user.click(pressed);
    expect(replace).toHaveBeenLastCalledWith("/board/money/transactions?period=this-year", { scroll: false });
  });

  it("makes Money in and Money out the direction filter, with no separate switch", async () => {
    const user = userEvent.setup();
    url.search = "period=this-year";
    open(<TransactionsScreen />);
    expect(screen.queryByRole("group", { name: "Direction" })).toBeNull();
    const moneyIn = screen.getByRole("button", { name: /^Money in/ });
    const linesBefore = screen.getByText("Lines").nextSibling!.textContent;
    expect(moneyIn).toHaveAttribute("aria-pressed", "false");
    await user.click(moneyIn);
    expect(moneyIn).toHaveAttribute("aria-pressed", "true");
    // Money out keeps reading the whole period while Money in is the filter.
    expect(screen.getByRole("button", { name: /^Money out/ })).toHaveAttribute("aria-pressed", "false");
    expect(Number(screen.getByText("Lines").nextSibling!.textContent)).toBeLessThan(Number(linesBefore));
    await user.click(moneyIn);
    expect(moneyIn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Lines").nextSibling!.textContent).toBe(linesBefore);
  });

  it("offers the Status dropdown only when there are lines to confirm, counted", () => {
    url.search = "period=this-year";
    open(<TransactionsScreen />);
    const toConfirm = seen.state.ledger.some((e) => e.status === "needs-review");
    if (toConfirm) {
      expect(screen.getByRole("option", { name: /^To confirm \(\d+\)$/ })).toBeInTheDocument();
    } else {
      expect(screen.queryByLabelText("Status")).toBeNull();
    }
  });

  it("keeps the Status dropdown while a status is chosen, so it can be undone", () => {
    url.search = "period=this-month&status=cleared";
    open(<TransactionsScreen />);
    expect(screen.getByLabelText("Status")).toHaveValue("cleared");
  });

  it("says what is empty and links to the next wider period", () => {
    url.search = "period=this-month&q=zzzz-nothing";
    open(<TransactionsScreen />);
    // A search narrows it, so the empty state offers clearing it first.
    expect(screen.getByText("Nothing in this month with these filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("opens an older link's own dates as a custom window, and says so when it is empty", () => {
    url.search = "from=1999-01-01&to=1999-01-31";
    open(<TransactionsScreen />);
    const button = screen.getByRole("button", { name: /^January 1999/ });
    expect(button).toHaveTextContent("Jan 1 to Jan 31, 1999");
    expect(screen.getByText("Nothing in these dates.")).toBeInTheDocument();
  });
});
