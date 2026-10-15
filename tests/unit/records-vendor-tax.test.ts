import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import type { LedgerEntry, Vendor } from "@/lib/types";
import {
  TAX_FORM_THRESHOLD_CENTS,
  taxYearSummedFrom,
  taxYears,
  vendorTaxFile,
  vendorTaxRows,
} from "@/lib/records/vendor-tax";

/** One vendor, and one ledger line paid to them on a day. */
function paid(vendor: Vendor, date: string, amountCents: number, id: string): LedgerEntry {
  return {
    id,
    date,
    description: `Paid ${vendor.name}`,
    counterparty: vendor.name,
    category: vendor.defaultCategory,
    accountId: "acct-operating",
    amountCents: -amountCents,
    status: "cleared",
  };
}

/** An association with exactly the vendors and payments a case needs. */
function withVendors(vendors: Vendor[], ledger: LedgerEntry[]): Community {
  return { ...mehrMeadows, vendors, ledger, payouts: [], history: undefined };
}

function vendor(id: string, name: string, w9OnFile: boolean): Vendor {
  return {
    id,
    name,
    service: "Grounds",
    achEnabled: true,
    w9OnFile,
    ytdPaidCents: 0,
    defaultCategory: "Landscaping",
  };
}

const grounds = vendor("v-grounds", "Cascade Grounds Co.", true);
const plumber = vendor("v-plumber", "Cedar River Plumbing", false);

describe("the $600 line", () => {
  it("is $600.00 and it is the IRS's, not the association's", () => {
    expect(TAX_FORM_THRESHOLD_CENTS).toBe(60_000);
  });

  it("puts a vendor paid exactly $600.00 on the list", () => {
    const c = withVendors([plumber], [paid(plumber, "2026-03-04", 60_000, "e1")]);
    expect(vendorTaxRows(c, 2026)).toHaveLength(1);
    expect(vendorTaxRows(c, 2026)[0].paidCents).toBe(60_000);
  });

  it("leaves a vendor paid $599.99 off it", () => {
    const c = withVendors([plumber], [paid(plumber, "2026-03-04", 59_999, "e1")]);
    expect(vendorTaxRows(c, 2026)).toEqual([]);
  });

  it("adds two payments in one year into one row", () => {
    const c = withVendors(
      [grounds],
      [paid(grounds, "2026-02-01", 40_000, "e1"), paid(grounds, "2026-07-01", 40_000, "e2")],
    );
    const rows = vendorTaxRows(c, 2026);
    expect(rows).toHaveLength(1);
    expect(rows[0].paidCents).toBe(80_000);
  });

  it("measures one year at a time: $500 in each of two years is not $1,000", () => {
    const c = withVendors(
      [grounds],
      [paid(grounds, "2025-06-01", 50_000, "e1"), paid(grounds, "2026-06-01", 50_000, "e2")],
    );
    expect(vendorTaxRows(c, 2025)).toEqual([]);
    expect(vendorTaxRows(c, 2026)).toEqual([]);
    expect(vendorTaxRows(c, 2025).concat(vendorTaxRows(c, 2026))).toEqual([]);
  });

  it("counts money in as an owner paying, never as a vendor payment", () => {
    const c = withVendors(
      [grounds],
      [{ ...paid(grounds, "2026-02-01", 80_000, "e1"), amountCents: 80_000 }],
    );
    expect(vendorTaxRows(c, 2026)).toEqual([]);
  });

  it("holds a payment the board has not reviewed out of the figure, as everywhere", () => {
    const c = withVendors(
      [grounds],
      [{ ...paid(grounds, "2026-02-01", 80_000, "e1"), status: "needs-review" }],
    );
    expect(vendorTaxRows(c, 2026)).toEqual([]);
  });

  it("does not count a payment dated after today as already made", () => {
    // The demo's today is 2026-08-20, so a December payment is not in yet.
    const c = withVendors([grounds], [paid(grounds, "2026-12-01", 80_000, "e1")]);
    expect(vendorTaxRows(c, 2026)).toEqual([]);
    expect(vendorTaxRows(c, 2025)).toEqual([]);
  });
});

describe("the list itself", () => {
  const c = withVendors(
    [grounds, plumber],
    [paid(grounds, "2026-02-01", 400_000, "e1"), paid(plumber, "2026-03-01", 90_000, "e2")],
  );

  it("is most paid first, with the W-9 state of each", () => {
    const rows = vendorTaxRows(c, 2026);
    expect(rows.map((r) => r.name)).toEqual(["Cascade Grounds Co.", "Cedar River Plumbing"]);
    expect(rows[0].w9OnFile).toBe(true);
    expect(rows[1].w9OnFile).toBe(false);
  });

  it("downloads as a CSV named for the year, with the money in plain dollars", () => {
    const file = vendorTaxFile(c, 2026);
    expect(file.name).toBe("tax-forms-2026.csv");
    expect(file.columns.map((column) => column.header)).toEqual([
      "Vendor",
      "What they do",
      "Paid in 2026",
      "W-9 on file",
      "Pays by",
    ]);
    expect(file.rows[0]["Paid in 2026"]).toBe("4000.00");
    expect(file.rows[1]["W-9 on file"]).toBe("No");
    expect(file.totals).toEqual([
      { label: "Paid in the year", moneyCents: 490_000 },
      { label: "Vendors", count: 2 },
      { label: "No W-9 yet", count: 1 },
    ]);
    expect(file.capabilities).toEqual(["vendors"]);
  });

  it("never promises a filing it does not make", () => {
    const text = `${vendorTaxFile(c, 2026).blurb}`.toLowerCase();
    expect(text).not.toContain("filed");
    expect(text).not.toContain("1099");
    expect(vendorTaxFile(c, 2026).title).toBe("2026 tax forms");
  });
});

describe("which years the tax list offers", () => {
  it("offers every calendar year with a payment out, newest first", () => {
    const c = withVendors(
      [grounds],
      [paid(grounds, "2024-05-01", 70_000, "e1"), paid(grounds, "2026-05-01", 70_000, "e2")],
    );
    expect(taxYears(c)).toEqual([2026, 2024]);
  });

  it("counts a year the server summed and the app never loaded", () => {
    const c: Community = {
      ...mehrMeadows,
      ledger: [],
      payouts: [],
      vendors: [grounds],
      history: {
        from: "2024-01-01",
        ledgerCount: 3,
        ledgerMonths: [
          { month: "2023-04", category: "Landscaping", inCents: 0, outCents: 700_000, count: 1 },
        ],
        statementMonths: [],
        statementCounts: {},
        lateFeesOwedCents: 0,
        statementsLoaded: [],
        ledgerLoaded: false,
      },
    };
    expect(taxYears(c)).toEqual([2023]);
  });

  it("offers nothing for an association that has paid nobody", () => {
    const c = withVendors([grounds], []);
    expect(taxYears(c)).toEqual([]);
  });
});

describe("a year the app only holds as monthly totals", () => {
  const held = withVendors([grounds], [paid(grounds, "2026-05-01", 70_000, "e1")]);
  const summed: Community = {
    ...held,
    history: {
      from: "2025-03-04",
      ledgerCount: 40,
      ledgerFrom: "2022-01-01",
      ledgerMonths: [],
      statementMonths: [],
      statementCounts: {},
      lateFeesOwedCents: 0,
      statementsLoaded: [],
      ledgerLoaded: false,
    },
  };

  it("names no vendor from the months the server summed", () => {
    expect(taxYearSummedFrom(held, 2026)).toBeNull();
    // 2026 is inside the window the app holds, so the list is whole.
    expect(taxYearSummedFrom(summed, 2026)).toBeNull();
    // 2025 and older reach back past it, where a month carries no counterparty.
    expect(taxYearSummedFrom(summed, 2025)).toBe("2025-03-04");
    expect(taxYearSummedFrom(summed, 2024)).toBe("2025-03-04");
  });

  it("stops saying so once somebody loads the earlier transactions", () => {
    const loaded: Community = {
      ...summed,
      history: { ...summed.history!, ledgerLoaded: true },
    };
    expect(taxYearSummedFrom(loaded, 2024)).toBeNull();
  });
});
