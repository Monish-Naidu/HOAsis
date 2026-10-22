import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanScreen } from "@/app/start/plan/plan-screen";
import { pendingBooksStore, savePendingBooks, type PendingBooks } from "@/lib/founding-books";

/**
 * The plan opened while a founder's books are still waiting. The browser
 * remembers another association of theirs; the plan has to open the one
 * the books belong to before it shows anything, so the notice and the plan
 * under it are about the same association.
 */

const h = vi.hoisted(() => ({
  remote: {
    status: "ready",
    activeId: "assoc-old",
    associations: [{ id: "assoc-old" }, { id: "assoc-new" }],
  } as { status: string; activeId: string; associations: { id: string }[] },
  open: vi.fn(),
  user: { id: "user-1" } as { id: string } | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/env", () => ({ hasSupabase: true }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: h.user, loading: false }) }));
vi.mock("@/lib/data/remote-store", () => ({
  useRemote: () => h.remote,
  openRemoteAssociation: h.open,
}));
vi.mock("@/lib/app-state", () => ({
  useAppState: () => ({
    communities: [{ id: h.remote.activeId }],
    community: { id: h.remote.activeId },
    isRemote: true,
    ready: true,
  }),
}));
vi.mock("@/lib/resident-plan", () => ({ useFoundedHere: () => false }));
vi.mock("@/components/app/setup-plan", () => ({
  SetupFlow: () => <p>Plan for {h.remote.activeId}</p>,
}));

const PENDING: PendingBooks = {
  associationId: "assoc-new",
  associationName: "Alder Court",
  userId: "user-1",
  books: {
    fiscalYearStart: "07-01",
    billingStartsOn: "2026-12-01",
    openingAsOf: "2026-10-15",
    rows: [],
  },
  datesSaved: false,
  rosterSaved: true,
};

beforeEach(() => {
  h.remote = {
    status: "ready",
    activeId: "assoc-old",
    associations: [{ id: "assoc-old" }, { id: "assoc-new" }],
  };
  h.open.mockResolvedValue({ ok: true });
  h.user = { id: "user-1" };
});

afterEach(() => {
  cleanup();
  pendingBooksStore.reset();
  window.localStorage.clear();
  vi.resetAllMocks();
});

describe("the plan while books are pending", () => {
  it("opens the pending association first instead of the remembered one", async () => {
    savePendingBooks(PENDING);
    const view = render(<PlanScreen />);
    await waitFor(() => expect(h.open).toHaveBeenCalledWith("assoc-new", "user-1"));
    expect(screen.queryByText("Plan for assoc-old")).toBeNull();

    // The load lands on the pending association.
    h.remote = { ...h.remote, activeId: "assoc-new" };
    h.open.mockClear();
    view.rerender(<PlanScreen />);
    expect(screen.getByText("Plan for assoc-new")).toBeInTheDocument();
    expect(screen.getByText("The books for Alder Court are not saved yet")).toBeInTheDocument();
    expect(h.open).not.toHaveBeenCalled();
  });

  it("leaves the open association alone when the pending books are somebody else's", () => {
    savePendingBooks({ ...PENDING, userId: "user-2" });
    render(<PlanScreen />);
    expect(screen.getByText("Plan for assoc-old")).toBeInTheDocument();
    expect(screen.queryByText(/books for Alder Court/)).toBeNull();
    expect(h.open).not.toHaveBeenCalled();
  });

  it("shows the plan it has when nothing is pending", () => {
    render(<PlanScreen />);
    expect(screen.getByText("Plan for assoc-old")).toBeInTheDocument();
    expect(h.open).not.toHaveBeenCalled();
  });

  it("shows no other association's plan when loading fails, and opens it again only when asked", async () => {
    const user = userEvent.setup();
    savePendingBooks(PENDING);
    // The load of the list failed; the remembered association is still behind it.
    h.remote = { ...h.remote, status: "error" };
    const view = render(<PlanScreen />);
    expect(await screen.findByText("Alder Court did not open")).toBeInTheDocument();
    expect(screen.queryByText("Plan for assoc-old")).toBeNull();
    expect(h.open).not.toHaveBeenCalled();

    h.open.mockImplementationOnce(async () => {
      h.remote = { ...h.remote, status: "ready", activeId: "assoc-new" };
      return { ok: true };
    });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.open).toHaveBeenCalledWith("assoc-new", "user-1");
    view.rerender(<PlanScreen />);
    expect(await screen.findByText("Plan for assoc-new")).toBeInTheDocument();
    expect(h.open).toHaveBeenCalledTimes(1);
  });

  it("does not keep trying, or show the old plan, when the open lands somewhere else", async () => {
    savePendingBooks(PENDING);
    h.open.mockResolvedValue({ ok: false, message: "another association opened" });
    const view = render(<PlanScreen />);
    expect(await screen.findByText("Alder Court did not open")).toBeInTheDocument();
    expect(screen.getByText(/another association opened/)).toBeInTheDocument();
    view.rerender(<PlanScreen />);
    expect(screen.queryByText("Plan for assoc-old")).toBeNull();
    expect(h.open).toHaveBeenCalledTimes(1);
  });

  it("shows no other plan when the pending association is not on the list", async () => {
    savePendingBooks(PENDING);
    h.remote = { ...h.remote, associations: [{ id: "assoc-old" }] };
    render(<PlanScreen />);
    expect(await screen.findByText("Alder Court did not open")).toBeInTheDocument();
    expect(screen.queryByText("Plan for assoc-old")).toBeNull();
    expect(h.open).not.toHaveBeenCalled();
  });
});
