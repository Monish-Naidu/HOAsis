import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  h.remote = { ...h.remote, status: "ready", activeId: "assoc-old" };
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
    view.rerender(<PlanScreen />);
    expect(screen.getByText("Plan for assoc-new")).toBeInTheDocument();
    expect(screen.getByText("The books for Alder Court are not saved yet")).toBeInTheDocument();
    expect(h.open).toHaveBeenCalledTimes(1);
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
});
