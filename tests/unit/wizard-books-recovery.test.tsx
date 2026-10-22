import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyDraft, type CommunityDraft } from "@/lib/data/new-community";
import { SetupWizard } from "@/app/start/setup-wizard";
import { forgetRead } from "@/app/start/wizard-progress";
import { withBooks, withExtras } from "@/app/start/books";
import { clearPendingBooks, pendingBooksStore } from "@/lib/founding-books";

/**
 * Founding succeeds and a books follow-up does not. The founder is shown what
 * is still unsaved, the figures and the association survive a reload, and
 * trying again saves into the same association without founding another or
 * sending a second set of balances on top of the first.
 */

const app = vi.hoisted(() => ({
  createRemoteAssociation: vi.fn(),
  createCommunity: vi.fn(),
  push: vi.fn(),
}));
const writes = vi.hoisted(() => ({ setBooksStart: vi.fn(), importRoster: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: app.push,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/start",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "pat@example.com", user_metadata: { full_name: "Pat" } },
    loading: false,
  }),
}));
vi.mock("@/lib/app-state", () => ({
  useAppState: () => ({
    createRemoteAssociation: app.createRemoteAssociation,
    createCommunity: app.createCommunity,
  }),
}));
vi.mock("@/lib/roster/apply", () => ({
  setBooksStart: writes.setBooksStart,
  importRoster: writes.importRoster,
}));

const draft: CommunityDraft = withBooks(
  {
    ...emptyDraft(),
    name: "Alder Court",
    city: "Bothell",
    state: "WA",
    stateName: "Washington",
    origin: "existing",
    homeTypes: ["single-family"],
    homeNaming: "numbers",
    duesCents: 12_000,
    founder: { name: "Pat", email: "pat@example.com", unit: "1" },
    phases: [{ id: "phase-1", label: "Phase 1", from: 1, to: 3 }],
    households: [
      withExtras(
        { name: "Marcus Bell", email: "", unit: "2" },
        { phone: "425-555-0114", openingBalanceCents: 18_550 },
      ),
      withExtras({ name: "Rosa Lind", email: "", unit: "3" }, { openingBalanceCents: -2_001 }),
    ],
  },
  { fiscalYearStart: "07-01", billingStartsOn: "2026-12-01", openingAsOf: "2026-10-15" },
);

function open() {
  forgetRead();
  return render(<SetupWizard />);
}

beforeEach(() => {
  window.sessionStorage.setItem(
    "hoasis-setup-progress",
    JSON.stringify({ draft, current: "books", exploring: false, awaitingConfirmation: false }),
  );
  app.createRemoteAssociation.mockImplementation(
    async (_draft: CommunityDraft, onFounded?: (id: string) => void) => {
      onFounded?.("assoc-new");
      return "assoc-new";
    },
  );
});

afterEach(() => {
  cleanup();
  clearPendingBooks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "");
  vi.resetAllMocks();
});

const EXPECTED_ROWS = [
  expect.objectContaining({ unit: "2", phone: "425-555-0114", openingBalanceCents: 18_550 }),
  expect.objectContaining({ unit: "3", phone: "", openingBalanceCents: -2_001 }),
];

describe("a books follow-up that fails after founding", () => {
  it("shows what is unsaved, survives a reload, and saves into the same association", async () => {
    const user = userEvent.setup();
    writes.setBooksStart.mockRejectedValueOnce(new Error("network down"));
    writes.importRoster.mockRejectedValueOnce(new Error("import_households is down"));

    // 1. Create: the association is founded, the dates fail.
    const first = open();
    await user.click(await screen.findByRole("button", { name: "Create the association" }));
    expect(
      await screen.findByText("Alder Court is set up. Its books are not saved yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The budget year and first bill date were not saved (network down)."),
    ).toBeInTheDocument();
    expect(screen.getByText("July 1")).toBeInTheDocument();
    expect(screen.getByText("December 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("2 homes, $165.49 in total")).toBeInTheDocument();
    expect(screen.getByText("Opening balances as of October 15, 2026")).toBeInTheDocument();
    expect(writes.importRoster).not.toHaveBeenCalled();
    expect(app.push).not.toHaveBeenCalled();

    // 2. Reload: the same association and the same figures, no Create button.
    first.unmount();
    open();
    expect(
      await screen.findByText("Alder Court is set up. Its books are not saved yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create the association" })).toBeNull();
    expect(pendingBooksStore.getSnapshot()).toMatchObject({
      associationId: "assoc-new",
      datesSaved: false,
      rosterSaved: false,
    });

    // 3. Try again: the dates land, the roster fails, and is said.
    await user.click(screen.getByRole("button", { name: "Save the books" }));
    expect(
      await screen.findByText(/opening balances and phone numbers were not saved/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Saved")).toHaveLength(2);

    // 4. Try again: only the roster is sent, and setup moves on.
    await user.click(screen.getByRole("button", { name: "Save the books" }));
    await waitFor(() => expect(app.push).toHaveBeenCalledWith("/start/plan"));

    expect(app.createRemoteAssociation).toHaveBeenCalledTimes(1);
    expect(writes.setBooksStart.mock.calls).toEqual([
      ["assoc-new", { fiscalYearStart: "07-01", billingStartsOn: "2026-12-01" }],
      ["assoc-new", { fiscalYearStart: "07-01", billingStartsOn: "2026-12-01" }],
    ]);
    expect(writes.importRoster.mock.calls).toEqual([
      ["assoc-new", EXPECTED_ROWS, "2026-10-15"],
      ["assoc-new", EXPECTED_ROWS, "2026-10-15"],
    ]);
    expect(pendingBooksStore.getSnapshot()).toBeNull();
    expect(window.sessionStorage.getItem("hoasis-setup-progress")).toBeNull();
  });

  it("goes straight to the plan when every follow-up lands the first time", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Create the association" }));
    await waitFor(() => expect(app.push).toHaveBeenCalledWith("/start/plan"));
    expect(app.createRemoteAssociation).toHaveBeenCalledTimes(1);
    expect(writes.setBooksStart).toHaveBeenCalledTimes(1);
    expect(writes.importRoster).toHaveBeenCalledWith("assoc-new", EXPECTED_ROWS, "2026-10-15");
    expect(pendingBooksStore.getSnapshot()).toBeNull();
  });

  it("keeps the association when founding's own follow-ups fail before the books", async () => {
    // The tab closes, or the page reloads, after create_association answered
    // but before the books call. The id was kept the moment it existed.
    const user = userEvent.setup();
    app.createRemoteAssociation.mockImplementationOnce(
      async (_draft: CommunityDraft, onFounded?: (id: string) => void) => {
        onFounded?.("assoc-new");
        return new Promise(() => {});
      },
    );
    const first = open();
    await user.click(await screen.findByRole("button", { name: "Create the association" }));
    await waitFor(() => expect(pendingBooksStore.getSnapshot()?.associationId).toBe("assoc-new"));
    first.unmount();

    open();
    await user.click(await screen.findByRole("button", { name: "Save the books" }));
    await waitFor(() => expect(app.push).toHaveBeenCalledWith("/start/plan"));
    expect(app.createRemoteAssociation).toHaveBeenCalledTimes(1);
    expect(writes.setBooksStart).toHaveBeenCalledWith("assoc-new", {
      fiscalYearStart: "07-01",
      billingStartsOn: "2026-12-01",
    });
  });

  it("does not offer another person's pending books", async () => {
    pendingBooksStore.set({
      associationId: "assoc-other",
      associationName: "Elm Row",
      userId: "user-2",
      books: {
        fiscalYearStart: "01-01",
        billingStartsOn: "2026-11-01",
        openingAsOf: "2026-10-01",
        rows: [],
      },
      datesSaved: false,
      rosterSaved: true,
    });
    open();
    expect(
      await screen.findByRole("button", { name: "Create the association" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Elm Row is set up/)).toBeNull();
  });
});
