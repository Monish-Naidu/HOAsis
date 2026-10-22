import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyDraft, type CommunityDraft } from "@/lib/data/new-community";
import { SetupWizard } from "@/app/start/setup-wizard";
import { forgetRead } from "@/app/start/wizard-progress";
import { withBooks, withExtras } from "@/app/start/books";
import { pendingBooksFor, pendingBooksStore, savePendingBooks } from "@/lib/founding-books";

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
const remote = vi.hoisted(() => ({ openRemoteAssociation: vi.fn() }));
const PAT = { id: "user-1", email: "pat@example.com", user_metadata: { full_name: "Pat" } };
const LEE = { id: "user-2", email: "lee@example.com", user_metadata: { full_name: "Lee" } };
const who = vi.hoisted(() => ({ user: null as unknown }));

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
  useAuth: () => ({ user: who.user, loading: false }),
}));
vi.mock("@/lib/app-state", () => ({
  useAppState: () => ({
    createRemoteAssociation: app.createRemoteAssociation,
    createCommunity: app.createCommunity,
  }),
}));
vi.mock("@/lib/data/remote-store", () => ({
  openRemoteAssociation: remote.openRemoteAssociation,
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

function atBooks(d: CommunityDraft) {
  window.sessionStorage.setItem(
    "hoasis-setup-progress",
    JSON.stringify({ draft: d, current: "books", exploring: false, awaitingConfirmation: false }),
  );
}

const pendingOf = (userId: string) => pendingBooksFor(pendingBooksStore.getSnapshot(), userId);

beforeEach(() => {
  who.user = PAT;
  remote.openRemoteAssociation.mockResolvedValue(undefined);
  atBooks(draft);
  app.createRemoteAssociation.mockImplementation(
    async (_draft: CommunityDraft, onFounded?: (id: string) => void) => {
      onFounded?.("assoc-new");
      return "assoc-new";
    },
  );
});

afterEach(() => {
  cleanup();
  pendingBooksStore.reset();
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
    expect(pendingOf("user-1")).toMatchObject({
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
    expect(pendingOf("user-1")).toBeNull();
    expect(window.sessionStorage.getItem("hoasis-setup-progress")).toBeNull();
    // The association these books went into is the one the plan opens.
    expect(remote.openRemoteAssociation).toHaveBeenLastCalledWith("assoc-new", "user-1");
    expect(remote.openRemoteAssociation.mock.invocationCallOrder.at(-1)).toBeLessThan(
      app.push.mock.invocationCallOrder.at(-1)!,
    );
  });

  it("goes straight to the plan when every follow-up lands the first time", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Create the association" }));
    await waitFor(() => expect(app.push).toHaveBeenCalledWith("/start/plan"));
    expect(app.createRemoteAssociation).toHaveBeenCalledTimes(1);
    expect(writes.setBooksStart).toHaveBeenCalledTimes(1);
    expect(writes.importRoster).toHaveBeenCalledWith("assoc-new", EXPECTED_ROWS, "2026-10-15");
    expect(pendingOf("user-1")).toBeNull();
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
    await waitFor(() => expect(pendingOf("user-1")?.associationId).toBe("assoc-new"));
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
    savePendingBooks({
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

  it("keeps one founder's books while another founds and finishes in the same browser", async () => {
    const user = userEvent.setup();
    writes.setBooksStart.mockRejectedValueOnce(new Error("network down"));

    // Pat founds Alder Court and its dates fail.
    const pat = open();
    await user.click(await screen.findByRole("button", { name: "Create the association" }));
    expect(
      await screen.findByText("Alder Court is set up. Its books are not saved yet."),
    ).toBeInTheDocument();
    // The draft is no longer in this tab for the next person to open.
    expect(window.sessionStorage.getItem("hoasis-setup-progress")).toBeNull();
    pat.unmount();

    // Lee signs in here, sees nothing of Pat's, founds Elm Row and finishes.
    who.user = LEE;
    app.createRemoteAssociation.mockImplementationOnce(
      async (_draft: CommunityDraft, onFounded?: (id: string) => void) => {
        onFounded?.("assoc-elm");
        return "assoc-elm";
      },
    );
    const lee = open();
    expect(
      await screen.findByRole("heading", { name: "What is your association called?" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Alder Court/)).toBeNull();
    expect(screen.queryByDisplayValue("Alder Court")).toBeNull();
    lee.unmount();
    atBooks(
      withBooks(
        {
          ...draft,
          name: "Elm Row",
          founder: { name: "Lee", email: "lee@example.com", unit: "1" },
          households: [withExtras({ name: "", email: "", unit: "2" }, { openingBalanceCents: 7 })],
        },
        { fiscalYearStart: "01-01", billingStartsOn: "2026-11-01", openingAsOf: "2026-10-01" },
      ),
    );
    const leeAgain = open();
    await user.click(await screen.findByRole("button", { name: "Create the association" }));
    await waitFor(() => expect(app.push).toHaveBeenCalledWith("/start/plan"));
    expect(remote.openRemoteAssociation).toHaveBeenLastCalledWith("assoc-elm", "user-2");
    expect(pendingOf("user-2")).toBeNull();
    leeAgain.unmount();

    // Pat comes back: the same association and figures, never founded again.
    who.user = PAT;
    app.push.mockClear();
    open();
    expect(
      await screen.findByText("Alder Court is set up. Its books are not saved yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("July 1")).toBeInTheDocument();
    expect(screen.getByText("2 homes, $165.49 in total")).toBeInTheDocument();
    expect(screen.queryByText(/Elm Row/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save the books" }));
    await waitFor(() => expect(app.push).toHaveBeenCalledWith("/start/plan"));

    expect(app.createRemoteAssociation).toHaveBeenCalledTimes(2);
    expect(writes.setBooksStart.mock.calls).toEqual([
      ["assoc-new", { fiscalYearStart: "07-01", billingStartsOn: "2026-12-01" }],
      ["assoc-elm", { fiscalYearStart: "01-01", billingStartsOn: "2026-11-01" }],
      ["assoc-new", { fiscalYearStart: "07-01", billingStartsOn: "2026-12-01" }],
    ]);
    expect(writes.importRoster.mock.calls).toEqual([
      ["assoc-elm", [expect.objectContaining({ unit: "2", openingBalanceCents: 7 })], "2026-10-01"],
      ["assoc-new", EXPECTED_ROWS, "2026-10-15"],
    ]);
    expect(remote.openRemoteAssociation).toHaveBeenLastCalledWith("assoc-new", "user-1");
    expect(pendingBooksStore.getSnapshot()).toEqual({});
  });

  it("opens the pending association before going to the plan to come back later", async () => {
    const user = userEvent.setup();
    writes.setBooksStart.mockRejectedValueOnce(new Error("network down"));
    let opened: () => void = () => {};
    open();
    await user.click(await screen.findByRole("button", { name: "Create the association" }));
    await screen.findByText("Alder Court is set up. Its books are not saved yet.");

    remote.openRemoteAssociation.mockImplementationOnce(
      () => new Promise<void>((resolve) => (opened = resolve)),
    );
    await user.click(screen.getByRole("button", { name: "Go to the plan and come back" }));
    expect(remote.openRemoteAssociation).toHaveBeenLastCalledWith("assoc-new", "user-1");
    expect(app.push).not.toHaveBeenCalled();
    opened();
    await waitFor(() => expect(app.push).toHaveBeenCalledWith("/start/plan"));
    // Still pending: nothing was saved and nothing was thrown away.
    expect(pendingOf("user-1")).toMatchObject({ associationId: "assoc-new", datesSaved: false });
  });
});
