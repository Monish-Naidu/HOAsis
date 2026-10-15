import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Ballot, Payout } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn() }),
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { subscribeRemoteErrors } = await import("@/lib/data/remote-store");
const { READ_ONLY_MESSAGE } = await import("@/lib/app-state/core");

/**
 * The demo side of the 2026-10-15 review fixes. Each is a mutation that used
 * to accept what the database refuses, or to leave the demo saying something
 * different from a signed in association. The signed in side is in
 * app-state-remote.test.tsx.
 */

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

const ARYA = "acct-arya";
const DANA = "acct-dana";
const ELLIS = "acct-ellis";
const MONISH = "acct-monish";

let said: string[];
beforeEach(() => {
  said = [];
  const stop = subscribeRemoteErrors((message) => said.push(message));
  return stop;
});
afterEach(() => {
  said = [];
});

function app(as: string) {
  const hook = renderHook(() => useAppState(), { wrapper });
  act(() => hook.result.current.signIn(as));
  return hook;
}

describe("the join code in a build with no database", () => {
  it("finds the demo association by its code", async () => {
    const { result } = app(ARYA);
    const found = await result.current.lookupJoinCode(" meadow ");
    expect(found?.name).toBe("Willow Creek Estates");
    expect(await result.current.lookupJoinCode("NOPE")).toBeNull();
  });
});

describe("a home changes hands (demo)", () => {
  const sale = { name: "Bea Buyer", email: "bea@example.com", closingDate: "2026-08-10" };

  it("refuses a buyer's email that is not one, and changes nothing", () => {
    const { result } = app(ARYA);
    const home = result.current.community.homes.find((o) => o.id === "own-031")!;
    let ok: unknown;
    act(() => {
      ok = result.current.transferHome(home.id, {
        ...sale,
        email: "not-an-email",
        settleBalance: false,
      });
    });
    expect(ok).toBe(false);
    expect(said.join(" ")).toMatch(/email address/);
    expect(result.current.community.homes.find((o) => o.id === home.id)!.displayName).toBe(
      home.displayName,
    );
  });

  it("names the buyer and clears the unsold mark", () => {
    const { result } = app(ARYA);
    const home = result.current.community.homes.find((o) => o.id === "own-031")!;
    act(() => {
      void result.current.setHouseholdOwner(home.id, { name: "Temp", email: "t@example.com" });
    });
    act(() => {
      expect(result.current.transferHome(home.id, { ...sale, settleBalance: false })).toBe(true);
    });
    const after = result.current.community.homes.find((o) => o.id === home.id)!;
    expect(after).toMatchObject({ displayName: "Bea Buyer", email: "bea@example.com" });
    expect(after.placeholder).toBe(false);
  });
});

describe("roles (demo)", () => {
  it("resets access to the office's defaults and returns true so the screen can say so", async () => {
    const { result } = app(ARYA);
    let ok: unknown;
    act(() => {
      ok = result.current.setAccountRole(ELLIS, "treasurer");
    });
    expect(ok).toBe(true);
    const ellis = result.current.accounts.find((a) => a.id === ELLIS)!;
    expect(ellis.role).toBe("treasurer");
    expect(ellis.capabilities.finances).toBe(true);
  });

  it("appoints an owner who has not signed in, as a seat that waits for them", () => {
    const { result } = app(ARYA);
    const seatless = result.current.community.homes.find(
      (o) => !result.current.accounts.some((a) => a.homeId === o.id),
    )!;
    let ok: unknown;
    act(() => {
      ok = result.current.setHomeRole(seatless.id, "treasurer");
    });
    expect(ok).toBe(true);
    expect(said).toEqual([]);
    const seat = result.current.accounts.find((a) => a.homeId === seatless.id)!;
    expect(seat).toMatchObject({
      name: seatless.displayName,
      email: seatless.email,
      role: "treasurer",
    });
    expect(seat.capabilities.finances).toBe(true);
    // Nobody is signed in as it.
    expect(result.current.account?.id).toBe(ARYA);
  });

  it("lets an owner with no seat be returned to resident without complaint", () => {
    const { result } = app(ARYA);
    const seatless = result.current.community.homes.find(
      (o) => !result.current.accounts.some((a) => a.homeId === o.id),
    )!;
    act(() => {
      result.current.setHomeRole(seatless.id, "resident");
    });
    expect(said).toEqual([]);
  });
});

describe("a seat that can only look (demo)", () => {
  it("cannot remove an announcement, add a vendor or cancel a meeting, and is told why", async () => {
    // Dana holds neither Messages nor Voting in the demo.
    const { result } = app(DANA);
    const announcements = result.current.community.announcements.length;
    act(() => result.current.removeAnnouncement(result.current.community.announcements[0].id));
    expect(result.current.community.announcements.length).toBe(announcements);
    expect(said.at(-1)).toBe(READ_ONLY_MESSAGE);

    const meeting = result.current.community.meetings.find((m) => m.status === "scheduled")!;
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.cancelMeeting(meeting.id, "Rain");
    });
    expect(outcome).toBe(false);
    expect(result.current.community.meetings.find((m) => m.id === meeting.id)!.status).toBe(
      "scheduled",
    );
  });

  it("cannot add a vendor or remove a document without Vendors and Documents", async () => {
    // Ellis holds neither.
    const { result } = app(ELLIS);
    const vendors = result.current.vendors.length;
    act(() =>
      result.current.addVendor({
        id: "v-probe",
        name: "Probe Services",
        service: "Testing",
        achEnabled: true,
        w9OnFile: true,
        ytdPaidCents: 0,
        defaultCategory: "Repairs & maintenance",
      }),
    );
    expect(result.current.vendors.length).toBe(vendors);

    const documents = result.current.documents.length;
    await act(async () => {
      await expect(result.current.removeDocument(result.current.documents[0].id)).rejects.toThrow(
        READ_ONLY_MESSAGE,
      );
    });
    expect(result.current.documents.length).toBe(documents);
  });

  it("is refused a vote it cannot open, and an upload it cannot make", async () => {
    // Dana has no Voting; Ellis has no Documents.
    const dana = app(DANA).result;
    const ballots = dana.current.ballots.length;
    let ok: unknown;
    act(() => {
      ok = dana.current.addBallot({ ...dana.current.ballots[0], id: "b-probe" });
    });
    expect(ok).toBe(false);
    expect(dana.current.ballots.length).toBe(ballots);
    const { result } = app(ELLIS);
    const file = new File(["x"], "probe.pdf", { type: "application/pdf" });
    let outcome: Awaited<ReturnType<typeof result.current.uploadDocuments>> | undefined;
    await act(async () => {
      outcome = await result.current.uploadDocuments([file]);
    });
    expect(outcome?.rejected).toEqual([{ name: "probe.pdf", reason: READ_ONLY_MESSAGE }]);
  });

  it("still lets a seat that holds the area change it", () => {
    const { result } = app(ARYA);
    const before = result.current.community.announcements.length;
    act(() => result.current.removeAnnouncement(result.current.community.announcements[0].id));
    expect(result.current.community.announcements.length).toBe(before - 1);
  });
});

describe("marking a payment paid (demo)", () => {
  const payout = (over: Partial<Payout> = {}): Payout => ({
    id: "po-test",
    vendorId: "",
    vendor: "Probe Landscaping",
    invoiceNumber: "INV-1",
    amountCents: 20_000,
    method: "ach",
    status: "scheduled",
    issuedDate: "2026-08-10",
    expectedDate: "2026-08-25",
    approvals: [],
    approvalsRequired: 0,
    ...over,
  });

  it("writes one date to the payout and the ledger, and files it under the vendor's category as spelled", () => {
    const { result } = app(ARYA);
    act(() =>
      result.current.addVendor({
        id: "v-lawn",
        name: "Probe Landscaping",
        service: "Lawns",
        achEnabled: true,
        w9OnFile: true,
        ytdPaidCents: 0,
        // How a database row can spell it.
        defaultCategory: "landscaping" as never,
      }),
    );
    act(() => result.current.addPayout(payout({ vendorId: "v-lawn" })));
    let ok: unknown;
    act(() => {
      ok = result.current.markPayoutPaid("po-test", "2026-08-18");
    });
    expect(ok).toBe(true);
    expect(result.current.payouts.find((p) => p.id === "po-test")).toMatchObject({
      status: "paid",
      expectedDate: "2026-08-18",
    });
    expect(result.current.ledger.find((e) => e.payoutId === "po-test")).toMatchObject({
      date: "2026-08-18",
      category: "Landscaping",
    });
  });

  it("defaults to today, and refuses a day that has not come", () => {
    const { result } = app(ARYA);
    act(() => result.current.addPayout(payout()));
    let ok: unknown;
    act(() => {
      ok = result.current.markPayoutPaid("po-test", "2026-09-30");
    });
    expect(ok).toBe(false);
    expect(result.current.payouts.find((p) => p.id === "po-test")!.status).toBe("scheduled");
    act(() => {
      ok = result.current.markPayoutPaid("po-test");
    });
    expect(ok).toBe(true);
    expect(result.current.payouts.find((p) => p.id === "po-test")!.expectedDate).toBe("2026-08-20");
  });
});

describe("a hand payment entered twice (demo)", () => {
  const entry = (homeId: string) => ({
    homeId,
    amountCents: 4_200,
    method: "check" as const,
    reference: "77",
    receivedOn: "2026-08-19",
  });

  it("holds the second identical payment back, and saves it when told to record it again", () => {
    const { result } = app(ARYA);
    const home = result.current.community.homes.find((o) => o.balanceCents > 10_000)!;
    act(() => {
      expect(result.current.recordManualPayment(entry(home.id))).toBe(true);
    });
    act(() => {
      expect(result.current.recordManualPayment(entry(home.id))).toBe(false);
    });
    expect(said.at(-1)).toMatch(/already has a \$42\.00 check recorded for Aug 19\./);
    const paid = () =>
      result.current.community.homeCharges[home.id].filter((l) => l.label.startsWith("Check"));
    expect(paid().length).toBe(1);
    act(() => {
      expect(result.current.recordManualPayment({ ...entry(home.id), allowRepeat: true })).toBe(
        true,
      );
    });
    expect(paid().length).toBe(2);
  });

  it("does not count a reversed payment as a repeat", () => {
    const { result } = app(ARYA);
    const home = result.current.community.homes.find((o) => o.balanceCents > 10_000)!;
    act(() => {
      result.current.recordManualPayment(entry(home.id));
    });
    const line = result.current.community.homeCharges[home.id].find((l) =>
      l.label.startsWith("Check"),
    )!;
    act(() => {
      expect(result.current.reverseManualPayment(line.id, "Bounced")).toBe(true);
    });
    act(() => {
      expect(result.current.recordManualPayment(entry(home.id))).toBe(true);
    });
  });
});

describe("a payment against a late home (demo)", () => {
  it("leaves a part-paid home late and lets an overpayment go below zero", () => {
    const { result } = app(ARYA);
    const home = result.current.community.homes.find(
      (o) => o.daysPastDue > 0 && o.balanceCents > 20_000,
    )!;
    const pay = (cents: number, receivedOn: string) =>
      act(() => {
        result.current.recordManualPayment({
          homeId: home.id,
          amountCents: cents,
          method: "cash",
          reference: "",
          receivedOn,
        });
      });
    const homeNow = () => result.current.community.homes.find((o) => o.id === home.id)!;
    pay(1_000, "2026-08-18");
    expect(homeNow().balanceCents).toBe(home.balanceCents - 1_000);
    expect(homeNow().daysPastDue).toBe(home.daysPastDue);
    expect(homeNow().standing).toBe(home.standing);
    // Everything owed, and then some: the extra stays as credit.
    pay(home.balanceCents - 1_000 + 500, "2026-08-19");
    expect(homeNow().balanceCents).toBe(-500);
    expect(homeNow().standing).toBe("current");
    expect(homeNow().daysPastDue).toBe(0);
  });
});

describe("caps on what a screen can type (demo)", () => {
  it("refuses a credit that is too large, or not whole cents", () => {
    const { result } = app(ARYA);
    const home = result.current.community.homes[0];
    const statementLines = result.current.community.homeCharges[home.id].length;
    for (const amountCents of [99_999_999_999, 250.5]) {
      let ok: unknown;
      act(() => {
        ok = result.current.addCredit({ homeId: home.id, amountCents, reason: "Waived" });
      });
      expect(ok).toBe(false);
    }
    expect(said.length).toBe(2);
    expect(result.current.community.homeCharges[home.id].length).toBe(statementLines);
  });

  it("refuses a starting balance of $99,999,999,999 and saves a sensible one", () => {
    const { result } = app(ARYA);
    const home = result.current.community.homes[0];
    let ok: unknown;
    act(() => {
      ok = result.current.setOpeningBalances("2026-07-01", [
        { homeId: home.id, amountCents: 99_999_999_999 },
      ]);
    });
    expect(ok).toBe(false);
    expect(said.at(-1)).toMatch(/most a home can start with/);
    act(() => {
      ok = result.current.setOpeningBalances("2026-07-01", [
        { homeId: home.id, amountCents: 50_000 },
      ]);
    });
    expect(ok).toBe(true);
  });

  it("says why a charge is refused", () => {
    const { result } = app(ARYA);
    let ok: unknown;
    act(() => {
      ok = result.current.addChargeToAll({
        amountCents: 99_999_999_999,
        label: "Roof",
        dueOn: "2026-09-01",
      });
    });
    expect(ok).toBe(false);
    expect(said.at(-1)).toMatch(/at most/);
  });

  it("holds a late fee to dues' ceiling and to whole cents", () => {
    const { result } = app(ARYA);
    const policy = { ...result.current.settings.collectionPolicy!, lateFeeCents: 100_000_000 };
    let ok: unknown;
    act(() => {
      ok = result.current.updateSettings({ collectionPolicy: policy });
    });
    expect(ok).toBe(false);
    expect(said.at(-1)).toMatch(/too high/);
    act(() => {
      ok = result.current.updateSettings({ collectionPolicy: { ...policy, lateFeeCents: 250.5 } });
    });
    expect(ok).toBe(false);
    expect(said.at(-1)).toMatch(/whole cents/);
    act(() => {
      ok = result.current.updateSettings({ collectionPolicy: { ...policy, lateFeeCents: 2_500 } });
    });
    expect(ok).toBe(true);
  });
});

describe("ballots (demo)", () => {
  const draft = (base: Ballot, labels: string[]): Ballot => {
    return {
      ...base,
      id: "b-new",
      status: "open",
      options: labels.map((label, i) => ({ id: `o-${i}`, label, votes: 0 })),
    };
  };

  it("refuses two choices of one name, however they are spelled", () => {
    const { result } = app(ARYA);
    const before = result.current.ballots.length;
    let ok: unknown;
    act(() => {
      ok = result.current.addBallot(draft(result.current.ballots[0], ["Same", " same "]));
    });
    expect(ok).toBe(false);
    expect(said.at(-1)).toMatch(/listed twice/);
    expect(result.current.ballots.length).toBe(before);
    act(() => {
      ok = result.current.addBallot(draft(result.current.ballots[0], ["For", "Against"]));
    });
    expect(ok).toBe(true);
    expect(result.current.ballots.length).toBe(before + 1);
  });

  it("keeps the day it closed", () => {
    const { result } = app(ARYA);
    act(() => {
      result.current.addBallot(draft(result.current.ballots[0], ["For", "Against"]));
    });
    act(() => result.current.closeBallot("b-new"));
    expect(result.current.ballots.find((b) => b.id === "b-new")).toMatchObject({
      status: "closed",
      closedDate: "2026-08-20",
    });
  });
});

describe("an owner adding to their own request (demo)", () => {
  it("adds a line from the owner, and refuses an empty message or somebody else's request", async () => {
    const { result } = app(MONISH);
    const mine = result.current.requests.find((r) => r.homeId === "own-042")!;
    const theirs = result.current.requests.find((r) => r.homeId !== "own-042")!;
    let ok: unknown;
    await act(async () => {
      ok = await result.current.replyOnRequest(mine.reference, "   ");
    });
    expect(ok).toBe(false);
    await act(async () => {
      ok = await result.current.replyOnRequest(theirs.reference, "Hello");
    });
    expect(ok).toBe(false);
    expect(said.at(-1)).toMatch(/not on your account/);
    await act(async () => {
      ok = await result.current.replyOnRequest(mine.reference, " Thank you ");
    });
    expect(ok).toBe(true);
    const after = result.current.requests.find((r) => r.id === mine.id)!;
    expect(after.thread.at(-1)).toMatchObject({
      actor: "Monish Naidu",
      actorRole: "resident",
      body: "Thank you",
      kind: "note",
    });
  });

  it("is refused for nobody signed in", async () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    let ok: unknown;
    await act(async () => {
      ok = await result.current.replyOnRequest(result.current.requests[0].reference, "Hi");
    });
    expect(ok).toBe(false);
  });
});
