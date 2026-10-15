import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
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
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(),
}));

// The display settings card reads the system colour scheme.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
  onchange: null,
})) as typeof window.matchMedia;

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { CollectionsLadder } = await import("@/components/app/collections-ladder");
const { SettingsScreen } = await import("@/app/board/settings/settings-screen");
const { choiceCounts, endedOn } = await import("@/components/app/ballot-card");
const { collectionsLadder, policyFor } = await import("@/lib/collections");

const seen = { state: null as unknown as ReturnType<typeof useAppState> };
function Probe() {
  const state = useAppState();
  useEffect(() => {
    seen.state = state;
  });
  return null;
}

function wrap(ui: ReactNode) {
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

describe("the past due list", () => {
  it("offers a reminder for one home, opening that home's letter on Homeowners", () => {
    wrap(<CollectionsLadder />);
    const community = seen.state.community;
    const row = collectionsLadder(community, policyFor(community.settings)).rows.find(
      (r) => r.stage !== "current",
    )!;
    const links = screen.getAllByRole("link", { name: "Send a reminder" });
    expect(links.map((a) => a.getAttribute("href"))).toContain(
      `/board/homeowners?open=${row.home.id}&letter=1`,
    );
  });

  it("names the last rung one way, on the row and in the letter", () => {
    wrap(<CollectionsLadder />);
    expect(screen.queryByText("Notice of intent to refer")).not.toBeInTheDocument();
  });
});

describe("a closed ballot", () => {
  const ballot = {
    options: [
      { id: "a", label: "Yes", votes: 30 },
      { id: "b", label: "No", votes: 20 },
    ],
  } as never;

  it("shows the count for each choice, from the ballot's own tally", () => {
    expect(choiceCounts({ ...(ballot as object), status: "closed" } as never)).toEqual([
      { optionId: "a", label: "Yes", votes: 30 },
      { optionId: "b", label: "No", votes: 20 },
    ]);
  });

  it("gives the day it ended only when one was recorded, never the scheduled date", () => {
    expect(
      endedOn({ ...(ballot as object), status: "closed", closesDate: "2026-10-04" } as never),
    ).toBeNull();
    expect(
      endedOn({
        ...(ballot as object),
        status: "closed",
        closesDate: "2026-10-04",
        closedDate: "2026-10-01",
      } as never),
    ).toBe("2026-10-01");
    // An open ballot has no ended day, whatever the row carries.
    expect(
      endedOn({ ...(ballot as object), status: "open", closedDate: "2026-10-01" } as never),
    ).toBeNull();
  });
});

describe("settings", () => {
  it("refuses a second amenity with the same name, ignoring case", async () => {
    const user = userEvent.setup();
    wrap(<SettingsScreen />);
    const first = seen.state.amenities[0].name;
    await user.type(screen.getByLabelText("New amenity name"), first.toUpperCase());
    expect(screen.getByText(`${first.toUpperCase()} is already on the list.`)).toBeInTheDocument();
    const form = screen.getByLabelText("New amenity name").closest("form")!;
    expect(within(form).getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("keeps Upload off until a form has a label and a file, and says which is missing", async () => {
    const user = userEvent.setup();
    wrap(<SettingsScreen />);
    const form = screen.getByLabelText("New form label").closest("form")!;
    const upload = within(form).getByRole("button", { name: "Upload" });
    expect(upload).toBeDisabled();
    expect(within(form).getByText("Give the form a label.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("New form label"), "Fence request");
    expect(within(form).getByText("Choose the file.")).toBeInTheDocument();
    expect(upload).toBeDisabled();

    const file = new File(["pdf"], "fence.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("New form file"), file);
    expect(upload).toBeEnabled();
    await user.click(upload);
    const saved = seen.state.forms.find((f) => f.label === "Fence request")!;
    expect(saved.fileName).toBe("fence.pdf");
    expect(saved.size).toBe("3 B");
  });

  it("warns, and does not block, when a second person is made Treasurer", async () => {
    wrap(<SettingsScreen />);
    const first = seen.state.community.homes.find((h) => h.boardRole === "Treasurer");
    expect(first).toBeDefined();
    // The warning is worded once, in the unit test; here only that it appears
    // beside a seat with two holders.
    const candidate = seen.state.accounts.find(
      (a) => a.role === "resident" && a.homeId !== first!.id,
    )!;
    await act(async () => {
      await seen.state.setHomeRole(candidate.homeId!, "treasurer");
    });
    expect(seen.state.accounts.filter((a) => a.role === "treasurer").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(
      (await screen.findAllByText(/already holds Treasurer|already hold Treasurer/)).length,
    ).toBeGreaterThan(0);
  });
});
