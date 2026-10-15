import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/board/money/annual-records",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { AnnualRecordsScreen } =
  await import("@/app/board/money/annual-records/annual-records-screen");
const { VendorsScreen } = await import("@/app/board/vendors/vendors-screen");
const { statementFor } = await import("@/lib/statement");
const { ledgerTotals } = await import("@/lib/metrics");
const { annualYears } = await import("@/lib/records/annual");
const { vendorTaxRows } = await import("@/lib/records/vendor-tax");
const { money } = await import("@/lib/utils");

const seen = { state: null as unknown as ReturnType<typeof useAppState> };
function Probe() {
  const state = useAppState();
  useEffect(() => {
    seen.state = state;
  });
  return null;
}

function wrap(ui: ReactNode) {
  return render(
    <AppStateProvider>
      <ToastProvider>
        <Probe />
        {ui}
      </ToastProvider>
    </AppStateProvider>,
  );
}

/** What the board is signed in as in these tests: the demo's President. */
const PRESIDENT = "acct-arya";

describe("the Annual records screen and the screens it copies", () => {
  it("shows the statements' own billed and paid figures for the year", () => {
    wrap(<AnnualRecordsScreen />);
    act(() => seen.state.signIn(PRESIDENT));
    const c = seen.state.community;
    const year = annualYears(c)[0];

    const statements = c.homes.map((home) => statementFor(c, home.id, year));
    const billed = statements.reduce((total, s) => total + s.billedCents, 0);
    const paid = statements.reduce((total, s) => total + s.paidCents, 0);

    expect(screen.getByTestId("records-charges").textContent).toContain(money(billed));
    expect(screen.getByTestId("records-payments").textContent).toContain(money(paid));
  });

  it("shows Transactions' own money in and money out for the year", () => {
    wrap(<AnnualRecordsScreen />);
    act(() => seen.state.signIn(PRESIDENT));
    const c = seen.state.community;
    const year = annualYears(c)[0];
    const inYear = c.ledger.filter((entry) => entry.date.startsWith(String(year)));
    const flows = ledgerTotals(inYear);

    expect(screen.getByTestId("records-ledger").textContent).toContain(money(flows.inCents));
    expect(screen.getByTestId("records-ledger").textContent).toContain(money(flows.outCents));
  });

  it("counts the same vendor payments the Vendors screen lists", () => {
    wrap(<AnnualRecordsScreen />);
    act(() => seen.state.signIn(PRESIDENT));
    const c = seen.state.community;
    const year = annualYears(c)[0];
    const payouts = c.payouts.filter((p) => p.issuedDate.startsWith(String(year)));

    const card = screen.getByTestId("records-vendor-payments");
    expect(card.textContent).toContain(money(payouts.reduce((t, p) => t + p.amountCents, 0)));
    expect(card.textContent).toContain(`${payouts.length} rows in vendor-payments.csv`);
  });

  it("offers a file per area, and says what the seat cannot read", () => {
    wrap(<AnnualRecordsScreen />);
    act(() => seen.state.signIn(PRESIDENT));
    expect(screen.getAllByRole("button", { name: "CSV" }).length).toBe(9);
    expect(screen.getByText(/^9 files for /)).toBeTruthy();
  });
});

describe("the 1099 list on the Vendors screen", () => {
  it("names the vendors paid $600 or more, and warns about the missing W-9", () => {
    wrap(<VendorsScreen />);
    act(() => seen.state.signIn(PRESIDENT));
    const c = seen.state.community;
    const year = c.asOf.slice(0, 4);
    const rows = vendorTaxRows(c, Number(year));

    expect(rows.length).toBeGreaterThan(0);
    const card = screen.getByTestId("tax-forms");
    expect(card.textContent).toContain(rows[0].name);
    expect(card.textContent).toContain(`${rows.length} vendors on the ${year} list`);
    const missing = rows.filter((row) => !row.w9OnFile);
    if (missing.length) expect(card.textContent).toContain(missing[0].name);
  });

  it("does not claim the product files anything", () => {
    wrap(<VendorsScreen />);
    act(() => seen.state.signIn(PRESIDENT));
    expect(screen.getByText(/does not file anything/)).toBeTruthy();
  });
});
