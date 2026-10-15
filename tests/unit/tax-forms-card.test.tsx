import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import type { LedgerEntry, Vendor } from "@/lib/types";

/**
 * The 1099 card, for the two ends of the year picker.
 *
 * The years on this card come from the money that went out, so an association
 * that has paid nobody has no year to name and one payment is a list of one.
 * Rendering the card rather than the selector is the point: the selector was
 * already honest and the screen still read "0 vendors on the undefined list".
 */

const state = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/lib/app-state", async (original) => ({
  ...(await original<typeof import("@/lib/app-state")>()),
  useAppState: () => state.current,
}));

const { ToastProvider } = await import("@/components/app/toast");
const { TaxFormsCard } = await import("@/components/app/tax-forms-card");

function wrap(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const grounds = mehrMeadows.vendors.find((v) => v.w9OnFile) ?? mehrMeadows.vendors[0];

/** One ledger line paid to a vendor on a day. */
function paid(vendor: Vendor, date: string, amountCents: number): LedgerEntry {
  return {
    id: "e-only",
    date,
    description: `Paid ${vendor.name}`,
    counterparty: vendor.name,
    category: vendor.defaultCategory,
    accountId: "acct-operating",
    amountCents: -amountCents,
    status: "cleared",
  };
}

/** The demo with exactly one vendor and exactly what it was paid. */
function oneVendor(ledger: LedgerEntry[]): Community {
  return { ...mehrMeadows, vendors: [grounds], ledger, payouts: [], history: undefined };
}

describe("the tax forms card with nothing on the books", () => {
  it("says nothing has been paid rather than naming a year that does not exist", () => {
    state.current = { community: oneVendor([]) };
    wrap(<TaxFormsCard />);
    const card = screen.getByTestId("tax-forms");

    expect(card.textContent).toContain("Nothing has been paid from the books yet");
    expect(card.textContent).not.toContain("undefined");
    expect(card.textContent).not.toContain("NaN");
    // No year to pick, and nothing to download.
    expect(screen.queryByLabelText("Tax year")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("still says what the product does not do", () => {
    state.current = { community: oneVendor([]) };
    wrap(<TaxFormsCard />);
    expect(screen.getByText(/does not file anything/)).toBeTruthy();
  });
});

describe("the tax forms card with one vendor", () => {
  it("is one row, under the calendar year the payment carries", () => {
    state.current = { community: oneVendor([paid(grounds, "2026-05-01", 70_000)]) };
    wrap(<TaxFormsCard />);
    const card = screen.getByTestId("tax-forms");

    expect(card.textContent).toContain(grounds.name);
    expect(card.textContent).toContain("$700.00");
    expect(card.textContent).toContain("1 vendor on the 2026 list");
    // One year is not a choice, so there is no picker to offer.
    expect(screen.queryByLabelText("Tax year")).toBeNull();
    expect(screen.getByRole("button", { name: "CSV" })).toBeTruthy();
  });

  it("leaves a vendor under the line off the list, and says so", () => {
    state.current = { community: oneVendor([paid(grounds, "2026-05-01", 59_900)]) };
    wrap(<TaxFormsCard />);
    const card = screen.getByTestId("tax-forms");

    expect(card.textContent).not.toContain(grounds.name);
    expect(card.textContent).toContain("Nobody was paid $600.00 or more in 2026");
  });
});
