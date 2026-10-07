import { describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/resident",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState, useHomeCharges } = await import("@/lib/app-state");
const { default: ResidentHome } = await import("@/app/resident/page");
const { default: ResidentAccount } = await import("@/app/resident/account/page");
const { cashPosition, duesCollection, homeCount, monthlyFlowsBetween, spendingBetween, vendorPaidThisYear } = await import("@/lib/metrics");

const wrapper = ({ children }: { children: ReactNode }) => <AppStateProvider>{children}</AppStateProvider>;
const TODAY = "2026-08-20";

describe("a check recorded and reversed in the demo", () => {
  it("leaves collected, money in, spending and the bank exactly where they were", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    // A finance holder: reversing a payment is theirs to do.
    act(() => result.current.signIn("acct-arya"));
    const home = result.current.community.homes[0];
    const figures = () => {
      const x = result.current.community;
      return {
        dues: duesCollection(x, 2026),
        flows: monthlyFlowsBetween(x, "2026-01-01", TODAY),
        spending: spendingBetween(x, "2026-01-01", "2026-12-31"),
        cash: cashPosition(x).operating,
      };
    };
    const before = figures();
    act(() => {
      result.current.recordManualPayment({ homeId: home.id, amountCents: 100, method: "check", reference: "1", receivedOn: TODAY });
    });
    const during = figures();
    expect(during.dues.collectedYtd).toBe(before.dues.collectedYtd + 100);
    const line = result.current.community.homeCharges[home.id].find((l) => l.kind === "payment" && l.label.includes("Check"))!;
    act(() => {
      result.current.reverseManualPayment(line.id, "Entered twice");
    });
    const after = figures();
    expect(after.dues.collectedYtd).toBe(before.dues.collectedYtd);
    expect(after.dues.rate).toBe(before.dues.rate);
    expect(after.flows).toEqual(before.flows);
    expect(after.spending).toEqual(before.spending);
    expect(after.cash).toBe(before.cash);
    // The line the database writes: a charge, not dues.
    expect(result.current.community.homeCharges[home.id].find((l) => l.label.startsWith("Payment reversed"))).toMatchObject({ kind: "charge", category: "other", amountCents: 100 });
  });
});

describe("marking a scheduled vendor payment paid", () => {
  it("moves cash and the vendor's year only then, and only once", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    act(() => result.current.signIn("acct-arya"));
    const vendor = result.current.vendors[0];
    act(() => {
      result.current.addPayout({
        id: "po-sched", vendorId: vendor.id, vendor: vendor.name, invoiceNumber: "INV-9", amountCents: 20_000,
        method: "ach", status: "scheduled", issuedDate: TODAY, expectedDate: "2026-08-01", approvals: [], approvalsRequired: 0,
      });
    });
    const cash = cashPosition(result.current.community).operating;
    const year = vendorPaidThisYear(result.current.community, vendor);
    act(() => {
      expect(result.current.markPayoutPaid("po-sched")).toBe(true);
    });
    expect(result.current.payouts.find((p) => p.id === "po-sched")!.status).toBe("paid");
    expect(cashPosition(result.current.community).operating).toBe(cash - 20_000);
    expect(vendorPaidThisYear(result.current.community, vendor)).toBe(year + 20_000);
    act(() => {
      expect(result.current.markPayoutPaid("po-sched")).toBe(false);
    });
    expect(cashPosition(result.current.community).operating).toBe(cash - 20_000);
  });
});

describe("a vendor payment in the demo", () => {
  it("moves cash, the vendor's year and Transactions, as the signed in path writes them", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const vendor = result.current.vendors[0];
    const cashBefore = cashPosition(result.current.community).operating;
    const yearBefore = vendor.ytdPaidCents;
    const ledgerBefore = result.current.ledger.length;

    act(() => {
      result.current.addPayout({
        id: "po-test",
        vendorId: vendor.id,
        vendor: vendor.name,
        invoiceNumber: "INV-1",
        amountCents: 48_000,
        method: "ach",
        status: "paid",
        issuedDate: TODAY,
        expectedDate: TODAY,
        approvals: [],
        approvalsRequired: 0,
      });
    });

    expect(cashPosition(result.current.community).operating).toBe(cashBefore - 48_000);
    expect(result.current.vendors.find((v) => v.id === vendor.id)!.ytdPaidCents).toBe(yearBefore + 48_000);
    expect(result.current.ledger.length).toBe(ledgerBefore + 1);
    // On the operating account, for the amount, tied to the payment.
    expect(result.current.ledger[0]).toMatchObject({ amountCents: -48_000, date: TODAY, payoutId: "po-test", counterparty: vendor.name });
    // And in this month's money out.
    const flows = monthlyFlowsBetween(result.current.community, "2026-08-01", TODAY);
    expect(flows.at(-1)!.outCents).toBeGreaterThanOrEqual(48_000);
  });

  it("writes nothing to the books for a payment that has not gone out", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const vendor = result.current.vendors[0];
    const ledgerBefore = result.current.ledger.length;
    act(() => {
      result.current.addPayout({
        id: "po-later", vendorId: vendor.id, vendor: vendor.name, invoiceNumber: "INV-2", amountCents: 10_000,
        method: "check", status: "scheduled", issuedDate: TODAY, expectedDate: TODAY, approvals: [], approvalsRequired: 1,
      });
    });
    expect(result.current.ledger.length).toBe(ledgerBefore);
  });
});

describe("a dues change and a new home in the demo", () => {
  it("leave what was billed alone, and the home count follows the register", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const billed = () => duesCollection(result.current.community, 2026).expectedYtd;
    const before = billed();
    const homesBefore = homeCount(result.current.community);
    const unit42 = result.current.community.homes.find((o) => o.unit === "42")!;

    act(() => {
      result.current.setHomeDues([{ homeId: unit42.id, cents: 31_000 }]);
    });
    expect(billed()).toBe(before);

    act(() => {
      result.current.addOwner({ name: "Rosa Delgado", email: "rosa@example.com", unit: "99" });
    });
    expect(billed()).toBe(before);
    expect(homeCount(result.current.community)).toBe(homesBefore + 1);
  });
});

describe("a bank payment in the demo", () => {
  it("is the full amount on the statement and in the books, with the fee as its own line, worded as the database words it", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const home = result.current.community.homes.find((o) => o.daysPastDue > 0)!;
    act(() => {
      result.current.recordPayment({
        homeId: home.id, amountCents: 28_500, processorCents: 228, platformCents: 0,
        platformPaidBy: "association", method: "Bank ••2288", kind: "ach",
      });
    });
    const line = result.current.community.homeCharges[home.id].find((l) => l.kind === "payment" && l.id.startsWith("pay-"))!;
    expect(line).toMatchObject({ label: "Bank payment", amountCents: -28_500, feeCents: 228 });
    // The whole payment in and the fee out as its own line, as record_payment
    // books it since 0101; the two net to what the bank received.
    const [fee, deposit] = result.current.ledger;
    expect(fee).toMatchObject({ description: `Processing fee, unit ${home.unit}`, category: "Processing fees", amountCents: -228 });
    expect(deposit).toMatchObject({
      description: `Assessment payment, unit ${home.unit}`,
      category: "Assessments",
      amountCents: 28_500,
    });
  });
});

describe("the resident home card", () => {
  function Controls() {
    const { signIn, recordPayment } = useAppState();
    return (
      <div>
        <button onClick={() => signIn("acct-monish")}>sign in as owner</button>
        <button
          onClick={() =>
            recordPayment({
              homeId: "own-042", amountCents: 28_500, processorCents: 35, platformCents: 0,
              platformPaidBy: "association", method: "Bank ••2288", kind: "ach",
            })
          }
        >
          pay early
        </button>
      </div>
    );
  }

  it("says Next bill, with its date, when the only bill owed is not due yet", async () => {
    const user = userEvent.setup();
    render(
      <AppStateProvider>
        <Controls />
        <ResidentHome />
      </AppStateProvider>,
    );
    await user.click(screen.getByText("sign in as owner"));
    expect(screen.getByText("Next bill")).toBeInTheDocument();
    expect(screen.queryByText("Current balance")).not.toBeInTheDocument();
    expect(screen.getByText("Due September 1, 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay early: $285" })).toBeInTheDocument();
  });

  it("keeps the statement's amount on the button after a dues change, and says so on the statement", async () => {
    const user = userEvent.setup();
    function Change() {
      const { setHomeDues } = useAppState();
      return <button onClick={() => setHomeDues([{ homeId: "own-042", cents: 31_000 }])}>change dues</button>;
    }
    render(
      <AppStateProvider>
        <Controls />
        <Change />
        <ResidentHome />
        <ResidentAccount />
      </AppStateProvider>,
    );
    await user.click(screen.getByText("sign in as owner"));
    await user.click(screen.getByText("change dues"));
    // The card and the button follow the bill on the statement: $285.
    expect(screen.getByRole("link", { name: "Pay early: $285" })).toBeInTheDocument();
    // The rate is the rate, and the bill already issued is named as it is.
    expect(screen.getByText(/\$310 a month in dues/)).toBeInTheDocument();
    expect(screen.getByText(/September 1, 2026 bill is already issued at \$285/)).toBeInTheDocument();
    // Paid ahead: the button is still the statement's amount, not the new rate.
    await user.click(screen.getByText("pay early"));
    expect(screen.getByRole("link", { name: "Pay early: $285" })).toBeInTheDocument();
  });

  it("puts a payment made today below the bill dated later, with balances that follow", () => {
    const { result } = renderHook(() => ({ state: useAppState(), lines: useHomeCharges() }), { wrapper });
    act(() => result.current.state.signIn("acct-monish"));
    act(() => {
      result.current.state.recordPayment({
        homeId: "own-042", amountCents: 28_500, processorCents: 35, platformCents: 0,
        platformPaidBy: "association", method: "Bank ••2288", kind: "ach",
      });
    });
    const lines = result.current.lines;
    expect(lines.slice(0, 3).map((l) => [l.date, l.kind])).toEqual([
      ["2026-09-01", "charge"],
      [TODAY, "payment"],
      ["2026-08-03", "payment"],
    ]);
    // Paid ahead of its bill: a credit until the bill is dated, then nothing owed.
    expect(lines[0].balanceAfterCents).toBe(0);
    expect(lines[1].balanceAfterCents).toBe(-28_500);
  });
});
