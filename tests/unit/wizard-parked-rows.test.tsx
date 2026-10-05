import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyDraft, defaultHomeNaming, type CommunityDraft } from "@/lib/data/new-community";
import { AppStateProvider } from "@/lib/app-state";
import { ToastProvider } from "@/components/app/toast";
import { SetupWizard } from "@/app/start/setup-wizard";
import { forgetRead } from "@/app/start/wizard-progress";

/**
 * Rows a spreadsheet left outside the ranges, on a list that has since
 * turned into one by address.
 *
 * The way homes are named is stored only when the board presses the switch.
 * Until then it follows the kinds of home, so going Back and changing them
 * lands on the address list with rows still parked. That screen showed none
 * of them and Continue was live, and creating the association dropped them.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/start",
  useSearchParams: () => new URLSearchParams(),
}));

const draft: CommunityDraft = {
  ...emptyDraft(),
  name: "Alder Court",
  origin: "existing",
  homeTypes: ["single-family"],
  founder: { name: "Pat", email: "pat@example.com", unit: "1" },
  phases: [{ id: "phase-1", label: "Phase 1", from: 1, to: 4 }],
  households: ["2", "3", "4"].map((unit) => ({ name: "", email: "", unit })),
  parkedHouseholds: [
    { name: "Ana", email: "ana@example.com", unit: "5" },
    { name: "Bo", email: "", unit: "6" },
  ],
};

function openOn(saved: CommunityDraft) {
  window.sessionStorage.setItem(
    "hoasis-setup-progress",
    JSON.stringify({ draft: saved, current: "homes", exploring: true, awaitingConfirmation: false }),
  );
  forgetRead();
  render(
    <AppStateProvider>
      <ToastProvider>
        <SetupWizard />
      </ToastProvider>
    </AppStateProvider>,
  );
}

describe("the homes question, by number, under a prefix typed with a space in front", () => {
  it("still knows the founder's own lot", async () => {
    // " A-" prints " A-2" on the list. The founder's label is trimmed now,
    // and the row is compared the same way, so it is not offered for sale.
    const phases = [{ id: "phase-1", label: "Building A", from: 1, to: 3 }];
    openOn({
      ...emptyDraft(),
      name: "Alder Court",
      origin: "builder",
      homeNaming: "numbers",
      lotPrefix: " A-",
      phases,
      founder: { name: "Pat", email: "pat@example.com", unit: "2" },
      households: [" A-1", " A-2", " A-3"].map((unit) => ({ name: "", email: "", unit })),
    });

    expect(await screen.findByText("yours")).toBeInTheDocument();
    window.sessionStorage.clear();
  });
});

describe("the homes question, by address, with rows still parked", () => {
  it("shows them, holds Continue, and lets the board leave them out", async () => {
    expect(draft.homeNaming).toBeUndefined();
    expect(defaultHomeNaming(draft)).toBe("addresses");
    openOn(draft);

    expect(await screen.findByText(/2 rows from your file are not on this list \(5, 6\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue/ })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Leave these out" }));
    expect(screen.queryByText(/rows from your file are not on this list/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue/ })).toBeEnabled();
    window.sessionStorage.clear();
  });
});
