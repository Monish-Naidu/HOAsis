import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The fork for somebody with an account and no association. In every state
 * it says who is signed in and has a way out; only the third offers setup.
 */

const signOut = vi.fn();
let user: { id: string; email: string } | null;
let requests: { status: string; name: string; unitLabel: string; createdAt: string }[] | null;

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock("@/lib/app-state", () => ({ useAppState: () => ({ signOut }) }));
vi.mock("@/lib/join-status", () => ({ useJoinStatus: () => requests, loadJoinStatus: vi.fn() }));
vi.mock("@/lib/data/remote-store", () => ({ loadRemote: vi.fn() }));

const { NoAssociationYet } = await import("@/components/app/no-association");

beforeEach(() => {
  signOut.mockClear();
  user = { id: "u1", email: "pat@example.com" };
  requests = [];
});

const SIGNED_IN = (_: string, el: Element | null) =>
  el?.tagName === "P" && el.textContent === "Signed in as pat@example.com";

describe("with no request", () => {
  it("offers a join code first, then setup, and says who is signed in", () => {
    render(<NoAssociationYet />);

    const links = screen.getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Join with a code", "/join"],
      ["Set up a new association", "/start"],
    ]);
    expect(screen.getByText(SIGNED_IN)).toBeInTheDocument();
    expect(screen.getByText(/They may have used a different email. Ask them to change it to pat@example.com/)).toBeInTheDocument();
  });

  it("signs out", async () => {
    render(<NoAssociationYet />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe("waiting on a board", () => {
  beforeEach(() => {
    requests = [{ status: "pending", name: "Maple Ridge", unitLabel: "Lot 7", createdAt: "2026-08-18T10:00:00Z" }];
  });

  it("names the board, the home and the email, and has a way out", async () => {
    render(<NoAssociationYet />);

    expect(screen.getByRole("heading", { name: "Waiting on the board of Maple Ridge" })).toBeInTheDocument();
    expect(
      screen.getByText(/The board checks that Lot 7 is yours and\s+lets you in\. We will email pat@example\.com when they do\./),
    ).toBeInTheDocument();
    expect(screen.getByText(SIGNED_IN)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Set up a new association" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
  });
});

describe("declined", () => {
  beforeEach(() => {
    requests = [{ status: "declined", name: "Maple Ridge", unitLabel: "Lot 7", createdAt: "2026-08-18T10:00:00Z" }];
  });

  it("says so plainly, offers the code again, and does not push setup", () => {
    render(<NoAssociationYet />);

    expect(screen.getByRole("heading", { name: "The board of Maple Ridge did not add your home" })).toBeInTheDocument();
    expect(screen.getByText("If that is a mistake, talk to a board member, then ask again.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask again with the join code" })).toHaveAttribute("href", "/join");
    expect(screen.queryByRole("link", { name: /Set up/ })).not.toBeInTheDocument();
    expect(screen.getByText(SIGNED_IN)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
