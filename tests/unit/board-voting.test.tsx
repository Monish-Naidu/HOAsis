import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Ballot } from "@/lib/types";
import { setToday } from "@/lib/utils";

/**
 * A ballot that ran to its closing date leaves the Open list, and Close now
 * with it, while its row is still open in the database. The Closed list has
 * to offer the one write that seals it.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board/voting",
  useSearchParams: () => new URLSearchParams(),
}));

const ballot = (patch: Partial<Ballot>): Ballot => ({
  id: "b1",
  reference: "BAL-1",
  title: "Repaint the clubhouse",
  body: ["Should the clubhouse be repainted this year?"],
  kind: "poll",
  audience: "owners",
  status: "open",
  opensDate: "2026-09-20",
  closesDate: "2026-10-01",
  eligible: 20,
  quorumRequired: 10,
  thresholdLabel: "Majority",
  options: [
    { id: "yes", label: "Yes", votes: 9 },
    { id: "no", label: "No", votes: 3 },
  ],
  homesVoted: 12,
  liveResultsVisible: false,
  ...patch,
});

let ballots: Ballot[] = [];
const closeBallot = vi.fn();
vi.mock("@/lib/app-state", async (original) => ({
  ...(await original<typeof import("@/lib/app-state")>()),
  useAppState: () => ({ ballots, closeBallot, settings: { showLiveVoteResults: false } }),
}));

const { ToastProvider } = await import("@/components/app/toast");
const { default: BoardVoting } = await import("@/app/board/voting/page");

const show = () =>
  render(
    <ToastProvider>
      <BoardVoting />
    </ToastProvider>,
  );
const row = (id: string) => within(document.getElementById(`ballot-${id}`)!);

beforeEach(() => {
  setToday("2026-10-04");
  closeBallot.mockClear();
});
afterEach(() => setToday("2026-08-20"));

describe("the board's Voting page", () => {
  it("offers Record the result on a ballot closed by date and still open in the record", async () => {
    ballots = [
      ballot({ id: "ran-out" }),
      ballot({ id: "sealed", title: "Pool hours", status: "closed" }),
    ];
    show();

    // Out of the Open list, so there is no Close now to press.
    expect(screen.queryByRole("button", { name: "End voting now" })).not.toBeInTheDocument();
    expect(screen.getByText("Nothing is open for a vote")).toBeInTheDocument();
    // A ballot already closed in the record has nothing left to write.
    expect(row("sealed").queryByRole("button")).not.toBeInTheDocument();

    await userEvent.setup().click(row("ran-out").getByRole("button", { name: "Record the result" }));
    expect(closeBallot).toHaveBeenCalledTimes(1);
    expect(closeBallot).toHaveBeenCalledWith("ran-out");
    expect(await screen.findByText(/Recorded\. Yes won · 12 of 20 homes voted\./)).toBeInTheDocument();
  });

  it("keeps End voting now, and nothing else, on a ballot still running", () => {
    ballots = [ballot({ id: "running", closesDate: "2026-10-10" })];
    show();

    expect(row("running").getByRole("button", { name: "End voting now" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record the result" })).not.toBeInTheDocument();
  });
});
