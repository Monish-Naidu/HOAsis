import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyDraft, type CommunityDraft } from "@/lib/data/new-community";
import { AppStateProvider } from "@/lib/app-state";
import { ToastProvider } from "@/components/app/toast";
import { SetupWizard } from "@/app/start/setup-wizard";
import { forgetRead } from "@/app/start/wizard-progress";
import { wallToday } from "@/app/start/books";

/**
 * The setup wizard's checks: the founder's lot against the ranges, a range
 * that starts below 1, an amount with a third decimal, the first-bill date,
 * and the browser's Back button stepping back through the questions.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/start",
  useSearchParams: () => new URLSearchParams(),
}));

const base: CommunityDraft = {
  ...emptyDraft(),
  name: "Alder Court",
  city: "Bothell",
  state: "WA",
  stateName: "Washington",
  origin: "builder",
  homeTypes: ["single-family"],
  homeNaming: "numbers",
  duesCents: 12_000,
  founder: { name: "Pat", email: "pat@example.com", unit: "1" },
  phases: [{ id: "phase-1", label: "Phase 1", from: 1, to: 32 }],
  households: [],
};

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

afterEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "");
});

describe("the homes question", () => {
  it("holds Continue and says so when the founder's lot is not in the ranges", async () => {
    openOn({ ...base, founder: { ...base.founder, unit: "99" } }, "homes");
    expect(await screen.findByText(/99 is not in these ranges/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue/ })).toBeDisabled();
  });

  it("lets a founder whose lot is in a range through", async () => {
    openOn(base, "homes");
    await screen.findByLabelText(/Phase 1 first/);
    expect(screen.queryByText(/is not in these ranges/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue/ })).toBeEnabled();
  });

  it("refuses a range that starts below 1 and lists no Lot 0 or negative lot", async () => {
    openOn({ ...base, phases: [{ id: "phase-1", label: "Phase 1", from: -3, to: 0 }] }, "homes");
    expect(await screen.findByText("Start at 1 or higher.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue/ })).toBeDisabled();
    expect(screen.queryByText(/-2|-1/)).not.toBeInTheDocument();
  });
});

describe("the dues question", () => {
  it("says whole cents only for $1.999 and holds Continue", async () => {
    openOn({ ...base, duesCents: 0 }, "dues");
    const field = await screen.findByLabelText(/Each lot pays/i);
    fireEvent.change(field, { target: { value: "1.999" } });
    expect(screen.getByText(/Whole cents only/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue/ })).toBeDisabled();
    fireEvent.change(field, { target: { value: "2" } });
    expect(screen.queryByText(/Whole cents only/)).not.toBeInTheDocument();
  });
});

describe("the first bill", () => {
  it("refuses a date in 2020 or 2099 and says why, and takes the one offered", async () => {
    openOn(base, "books");
    const field = await screen.findByLabelText(/First bill goes out on/);
    const create = screen.getByRole("button", { name: "Create the association" });
    expect(create).toBeEnabled();

    fireEvent.change(field, { target: { value: "2020-01-01" } });
    expect(screen.getByText("Pick a date from this month on.")).toBeInTheDocument();
    expect(create).toBeDisabled();

    fireEvent.change(field, { target: { value: "2099-12-31" } });
    expect(screen.getByText("Pick a date within the next 24 months.")).toBeInTheDocument();
    expect(create).toBeDisabled();

    fireEvent.change(field, { target: { value: `${wallToday().slice(0, 7)}-28` } });
    expect(create).toBeEnabled();
  });
});

describe("the browser's Back button", () => {
  it("steps back to the question before instead of leaving the wizard", async () => {
    const user = userEvent.setup();
    openOn({ ...base, name: "" }, "name");
    await user.type(await screen.findByLabelText(/Association name/), "Alder Court");
    await user.click(screen.getByRole("button", { name: /^Continue/ }));
    expect(await screen.findByLabelText(/City/)).toBeInTheDocument();
    expect(window.history.state?.hoasisStep).toBe("place");

    act(() => window.history.back());
    await waitFor(() => expect(screen.getByLabelText(/Association name/)).toBeInTheDocument());
  });
});
