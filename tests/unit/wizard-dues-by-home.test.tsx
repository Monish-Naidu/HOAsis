import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyDraft, type CommunityDraft } from "@/lib/data/new-community";
import { AppStateProvider } from "@/lib/app-state";
import { ToastProvider } from "@/components/app/toast";
import { SetupWizard } from "@/app/start/setup-wizard";
import { forgetRead } from "@/app/start/wizard-progress";

/**
 * The wizard's questions for dues that differ home by home: the choice on the
 * dues step, the amount on each range, the amount on each address.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/start",
  useSearchParams: () => new URLSearchParams(),
}));

function openOn(saved: CommunityDraft, current: string) {
  window.sessionStorage.setItem(
    "hoasis-setup-progress",
    JSON.stringify({ draft: saved, current, exploring: true, awaitingConfirmation: false }),
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

afterEach(() => window.sessionStorage.clear());

const base: CommunityDraft = {
  ...emptyDraft(),
  name: "Harbor Court",
  city: "Bothell",
  state: "WA",
  stateName: "Washington",
  origin: "existing",
  homeTypes: ["condos"],
  duesCents: 21_000,
  founder: { name: "Pat", email: "pat@example.com", unit: "101" },
  homeNaming: "numbers",
  phases: [
    { id: "phase-1", label: "First floor", from: 101, to: 104 },
    { id: "phase-2", label: "Second floor", from: 201, to: 204 },
  ],
  households: [101, 102, 103, 104, 201, 202, 203, 204].map((n) => ({
    name: "",
    email: "",
    unit: String(n),
    homeType: "condos" as const,
  })),
};

describe("the dues step", () => {
  it("keeps Each home pays for the default choice, and offers by home without by kind for one kind", async () => {
    openOn(base, "dues");
    expect(await screen.findByLabelText(/Each home pays/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Same for every home" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Different by home" })).toBeInTheDocument();
    // One kind of home, so there is no "by kind" to offer.
    expect(screen.queryByRole("radio", { name: "Different by kind" })).not.toBeInTheDocument();
  });

  it("offers all three when more than one kind was picked", async () => {
    openOn({ ...base, homeTypes: ["townhomes", "condos"] }, "dues");
    expect(await screen.findByRole("radio", { name: "Different by kind" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Different by home" })).toBeInTheDocument();
  });

  it("says what by home is for, and relabels the amount as the fallback", async () => {
    const user = userEvent.setup();
    openOn(base, "dues");
    await user.click(await screen.findByRole("radio", { name: "Different by home" }));
    expect(screen.getByText("For buildings where a larger unit pays more.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Most homes pay/)).toHaveValue(210);
    expect(screen.queryByLabelText(/Each home pays/i)).not.toBeInTheDocument();
    // And back again.
    await user.click(screen.getByRole("radio", { name: "Same for every home" }));
    expect(screen.getByLabelText(/Each home pays/i)).toBeInTheDocument();
  });
});

describe("the homes step, by home", () => {
  it("gives each range an optional amount and totals by the rule", async () => {
    const user = userEvent.setup();
    openOn({ ...base, duesByHome: true }, "homes");
    const upstairs = await screen.findByLabelText("Each home in this range pays, Second floor");
    // Blank shows the usual amount, and the total is every home at it.
    expect(upstairs).toHaveValue(null);
    expect(screen.getByText(/\$1,680 per month/)).toBeInTheDocument();

    await user.type(upstairs, "285");
    // Four at $210 and four at $285.
    expect(screen.getByText(/\$1,980 per month/)).toBeInTheDocument();
    expect(screen.getByText(/4 at their own amount/)).toBeInTheDocument();
  });

  it("shows no range amounts unless the board bills by home", async () => {
    openOn(base, "homes");
    await screen.findByLabelText("First floor first lot");
    expect(screen.queryByLabelText(/Each home in this range pays/)).not.toBeInTheDocument();
  });

  it("gives each address row an optional amount", async () => {
    const user = userEvent.setup();
    openOn(
      {
        ...emptyDraft(),
        name: "Birch Lane",
        origin: "existing",
        homeTypes: ["single-family"],
        homeNaming: "addresses",
        duesByHome: true,
        duesCents: 10_000,
        founder: { name: "Sam", email: "sam@example.com", unit: "", address: "1 Birch Lane" },
        households: [{ name: "", email: "", unit: "3 Birch Lane", address: "3 Birch Lane" }],
      },
      "homes",
    );
    const row = await screen.findByLabelText("Dues for home 1");
    await user.type(row, "125");
    expect(screen.getByText(/\$225 per month/)).toBeInTheDocument();
  });
});
