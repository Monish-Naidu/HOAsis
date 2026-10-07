import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const pathname = "/resident";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { default: ResidentHome } = await import("@/app/resident/page");
const { Announcements } = await import("@/app/resident/announcements");
const { default: ResidentDocuments } = await import("@/app/resident/documents/page");
const { default: ResidentFunds } = await import("@/app/resident/finances/page");
const { default: ResidentAccount } = await import("@/app/resident/account/page");
const { default: ResidentMore } = await import("@/app/resident/more/page");
const { ResidentBell } = await import("@/components/app/notifications");

function wrap(ui: ReactNode) {
  return render(<AppStateProvider>{ui}</AppStateProvider>);
}

/** Signs in and, on request, has the board put a notice on a home. */
function Controls() {
  const { signIn, addNotice, updateSettings } = useAppState();
  return (
    <div>
      <button onClick={() => signIn("acct-monish")}>sign in as owner</button>
      <button
        onClick={() => {
          signIn("acct-arya");
          addNotice({ homeId: "own-042", ownerName: "Monish Naidu", unit: "42", rule: "Fence needs paint" });
          signIn("acct-monish");
        }}
      >
        notice on 42
      </button>
      <button
        onClick={() => {
          signIn("acct-arya");
          addNotice({ homeId: "own-055", ownerName: "Rhea Calloway", unit: "55", rule: "Bins out" });
          signIn("acct-monish");
        }}
      >
        notice on 55
      </button>
      <button onClick={() => updateSettings({ showFundsToResidents: true })}>funds on</button>
    </div>
  );
}

describe("a notice against your home", () => {
  it("is not on the home card when there is none", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentHome />
      </>,
    );
    await user.click(screen.getByText("sign in as owner"));
    expect(screen.queryByText(/about your home/)).not.toBeInTheDocument();
  });

  it("appears on the home card, linking to the notice in full", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentHome />
      </>,
    );
    await user.click(screen.getByText("notice on 42"));
    const row = screen.getByText("A notice about your home").closest("a");
    expect(row).toHaveAttribute("href", "/resident/notices");
    expect(within(row as HTMLElement).getByText(/Fence needs paint · next step/)).toBeInTheDocument();
  });

  it("does not appear for a notice addressed to another home", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentHome />
      </>,
    );
    await user.click(screen.getByText("notice on 55"));
    expect(screen.queryByText(/about your home/)).not.toBeInTheDocument();
  });

  it("appears in the bell and counts as unread", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentBell />
      </>,
    );
    await user.click(screen.getByText("notice on 42"));
    await user.click(screen.getByRole("button", { name: /^Notifications/ }));
    const row = screen.getByText("A notice about your home").closest("a");
    expect(row).toHaveAttribute("href", "/resident/notices");
  });

  it("stays out of the bell when it belongs to someone else", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentBell />
      </>,
    );
    await user.click(screen.getByText("notice on 55"));
    await user.click(screen.getByRole("button", { name: /^Notifications/ }));
    expect(screen.queryByText("A notice about your home")).not.toBeInTheDocument();
  });
});

describe("announcements on the resident home", () => {
  it("shows the pinned one and the newest two, and folds the rest under Earlier announcements", async () => {
    const user = userEvent.setup();
    wrap(<Announcements />);
    // The demo has four: one pinned, three more.
    expect(screen.getByText("Pool resurfacing begins September 8")).toBeInTheDocument();
    expect(screen.getByText("Budget workshop, September 3 at 6:30pm")).toBeInTheDocument();
    const fold = screen.getByText(/Earlier announcements \(1\)/);
    expect(fold).toBeInTheDocument();
    expect(fold.closest("details")).not.toHaveAttribute("open");
    await user.click(fold);
    expect(fold.closest("details")).toHaveAttribute("open");
    // The oldest is inside the fold.
    const fine = screen.getByText("New: pay dues from your phone with Apple Pay");
    expect(fold.closest("details")?.contains(fine)).toBe(true);
  });

  it("opens each card to its whole text in place", async () => {
    const user = userEvent.setup();
    wrap(<Announcements />);
    const title = screen.getByText("Budget workshop, September 3 at 6:30pm");
    const card = title.closest("details") as HTMLDetailsElement;
    expect(card).not.toHaveAttribute("open");
    const body = within(card).getByText(/draft 2027 operating budget/);
    // Two lines while closed, all of it once opened.
    expect(body.className).toContain("line-clamp-2");
    expect(body.className).toContain("group-open/card:line-clamp-none");
    await user.click(within(card).getByText("Read more"));
    expect(card).toHaveAttribute("open");
  });
});

describe("the statement", () => {
  it("is called Statement and downloads as a spreadsheet", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentAccount />
      </>,
    );
    await user.click(screen.getByText("sign in as owner"));
    expect(screen.getByRole("heading", { name: "Statement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download as a spreadsheet/ })).toBeInTheDocument();
  });

  it("does not say Paid up beside a balance that is owed", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentAccount />
      </>,
    );
    await user.click(screen.getByText("sign in as owner"));
    // The demo home owes its next bill and is not late.
    expect(screen.queryByText("Paid up")).not.toBeInTheDocument();
    expect(screen.getByText("Not late")).toBeInTheDocument();
  });
});

describe("the home card's balance", () => {
  it("is headed Your balance and links to the Statement", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentHome />
      </>,
    );
    await user.click(screen.getByText("sign in as owner"));
    expect(screen.getByText("Your balance")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Statement" })).toHaveAttribute("href", "/resident/account");
  });
});

describe("More", () => {
  it("lists what the bar has no room for, under the rail's names", () => {
    wrap(<ResidentMore />);
    const rows = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"))
      .filter(Boolean);
    expect(rows).toEqual(["/resident/forum", "/resident/finances", "/resident/settings", "/resident/messages#your-board"]);
    expect(screen.getByText("Association funds")).toBeInTheDocument();
    expect(screen.queryByText("Funds")).not.toBeInTheDocument();
  });
});

describe("documents in the signed-out demo", () => {
  it("tags a row with no file behind it as a sample", () => {
    wrap(<ResidentDocuments />);
    expect(screen.getAllByText("Sample").length).toBeGreaterThan(0);
  });
});

describe("association funds", () => {
  it("leaves out the utility shares while shared costs are off, and the Accounts section always", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentFunds />
      </>,
    );
    await user.click(screen.getByText("funds on"));
    expect(screen.queryByText("Paid on your behalf")).not.toBeInTheDocument();
    expect(screen.queryByText("Accounts")).not.toBeInTheDocument();
    expect(screen.queryByText("What the reserves earn")).not.toBeInTheDocument();
    expect(screen.getByText("Budget and other financial documents")).toBeInTheDocument();
  });

  it("puts the bank under each total and keeps the order of the sections", async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Controls />
        <ResidentFunds />
      </>,
    );
    await user.click(screen.getByText("funds on"));
    expect(screen.getByText(/· everyday bills$/)).toBeInTheDocument();
    const headings = screen
      .getAllByRole("heading")
      .map((h) => h.textContent)
      .filter((t) => ["Where your dues go", "What reserves are saved for", "Transactions"].includes(t ?? ""));
    expect(headings).toEqual(["Where your dues go", "What reserves are saved for", "Transactions"]);
  });
});

describe("writing to an office", () => {
  it("offers the board and each office with its holder, and disables one nobody holds", async () => {
    const user = userEvent.setup();
    const { MessagesScreen } = await import("@/app/resident/messages/messages-screen");
    const { ToastProvider } = await import("@/components/app/toast");
    wrap(
      <ToastProvider>
        <Controls />
        <MessagesScreen />
      </ToastProvider>,
    );
    await user.click(screen.getByText("sign in as owner"));
    // The card names each office, who holds it and what it handles.
    const card = screen.getByRole("region", { name: "Your board" });
    expect(within(card).getByText("Arya Mehr")).toBeInTheDocument();
    expect(within(card).getByText("Dues, payments and the budget.")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Write to the Treasurer" }));
    const to = screen.getByLabelText("Who it is for") as HTMLSelectElement;
    expect(to.value).toBe("treasurer");
    const options = within(to).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "The board",
      "President, Arya Mehr",
      "Vice President, Ellis Wright",
      "Treasurer, Dana Whitcomb",
      "Secretary, Sofia Bergman",
    ]);
  });
});
