import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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
    const counts = homeFilterCounts(seen.state.community.owners);
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
  it("opens on the last 30 days, not an empty this month", () => {
    url.path = "/board/money/transactions";
    open(<TransactionsScreen />);
    expect(screen.getByRole("button", { name: "Last 30 days" })).toHaveAttribute("aria-pressed", "true");
  });

  it("counts statuses and categories in the selects", () => {
    url.path = "/board/money/transactions";
    url.search = "period=this-year";
    open(<TransactionsScreen />);
    expect(screen.getByRole("option", { name: /^To confirm \(\d+\)$/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^All categories \(\d+\)$/ })).toBeInTheDocument();
  });

  it("says what is empty and links to the next wider period", () => {
    url.path = "/board/money/transactions";
    url.search = "period=this-month&q=zzzz-nothing";
    open(<TransactionsScreen />);
    // A search narrows it, so the empty state offers clearing it first.
    expect(screen.getByText("Nothing in this month with these filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("opens an older link's own dates as a custom window, and says so when it is empty", () => {
    url.path = "/board/money/transactions";
    url.search = "from=1999-01-01&to=1999-01-31";
    open(<TransactionsScreen />);
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Nothing in these dates.")).toBeInTheDocument();
  });
});
