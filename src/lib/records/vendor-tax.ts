/**
 * The 1099-NEC list: who the association paid $600 or more in a calendar year.
 *
 * The $600 line is the IRS's, and it is a calendar year, not the association's
 * fiscal one, so this file never asks the fiscal year start. A payment total
 * comes from the same selector the Vendors screen reads (`vendorPaidThisYear`,
 * from the ledger), so the list and the screen beside it cannot disagree.
 *
 * What the product does is name the vendors and say whether their W-9 is on
 * file. It does not file anything and does not say the form was filed: a
 * product that promises a tax filing it does not make is worse than one that
 * hands the treasurer a list.
 */

import type { Community } from "@/lib/data/community";
import { vendorPaidThisYear } from "@/lib/metrics";
import type { RecordsFile } from "./files";
import { columnsOf, dollars } from "./files";

/** $600.00: at or above it, the IRS expects a 1099-NEC. */
export const TAX_FORM_THRESHOLD_CENTS = 60_000;

/** One vendor on the list, with what the board has to have before filing. */
export interface VendorTaxRow {
  vendorId: string;
  name: string;
  service: string;
  paidCents: number;
  w9OnFile: boolean;
  achEnabled: boolean;
}

/**
 * Every calendar year with a payment to a vendor, newest first.
 *
 * Read from the money that went out and from the months the server summed,
 * so an association five years in is offered five Januaries and one that
 * started this spring is offered the one it is in. Nothing reads the clock:
 * a year appears because a payment carries its date.
 */
export function taxYears(c: Community): number[] {
  const years = new Set<number>();
  for (const entry of c.ledger) {
    // Money out only: money in is an owner paying dues, never a vendor.
    if (entry.amountCents < 0) years.add(Number(entry.date.slice(0, 4)));
  }
  for (const payout of c.payouts) years.add(Number(payout.issuedDate.slice(0, 4)));
  for (const month of c.history?.ledgerMonths ?? []) {
    if (month.outCents > 0) years.add(Number(month.month.slice(0, 4)));
  }
  return [...years].filter((y) => Number.isFinite(y)).sort((a, b) => b - a);
}

/**
 * The date before which the chosen year's lines are only monthly totals, or
 * null when the whole year is on hand.
 *
 * A real association loads two years of the books and the server sums the
 * months before those. A summed month carries a category and an amount, never
 * a counterparty, so no vendor can be named out of it: the list has to say so
 * rather than reading as a year in which nobody was paid.
 */
export function taxYearSummedFrom(c: Community, year: number): string | null {
  const history = c.history;
  if (!history || history.ledgerLoaded) return null;
  const firstDay = `${year}-01-01`;
  return history.from > firstDay ? history.from : null;
}

/**
 * Who was paid $600 or more in the calendar year, most paid first.
 *
 * A vendor paid twice in one year is one row with the two payments added,
 * which is what the threshold is measured on. Exactly $600.00 is on the
 * list: the rule is "$600 or more", not "more than $600".
 */
export function vendorTaxRows(c: Community, year: number): VendorTaxRow[] {
  // The year's own last day, or today when the year has not finished, so a
  // payment dated later in the year is not counted as already made.
  const through = `${year}-12-31` <= c.asOf ? `${year}-12-31` : c.asOf;
  return c.vendors
    .map((vendor) => ({
      vendorId: vendor.id,
      name: vendor.name,
      service: vendor.service,
      paidCents: vendorPaidThisYear(c, vendor, through),
      w9OnFile: vendor.w9OnFile,
      achEnabled: vendor.achEnabled,
    }))
    .filter((row) => row.paidCents >= TAX_FORM_THRESHOLD_CENTS)
    .sort((a, b) => b.paidCents - a.paidCents || a.name.localeCompare(b.name));
}

/** The list as one CSV of the records export. */
export function vendorTaxFile(c: Community, year: number): RecordsFile {
  const rows = vendorTaxRows(c, year);
  return {
    id: "tax-forms",
    title: `${year} tax forms`,
    blurb: `Who was paid $600 or more in ${year}, and whether their W-9 is on file.`,
    name: `tax-forms-${year}.csv`,
    capabilities: ["vendors"],
    columns: columnsOf("Vendor", "What they do", `Paid in ${year}`, "W-9 on file", "Pays by"),
    rows: rows.map((row) => ({
      Vendor: row.name,
      "What they do": row.service,
      [`Paid in ${year}`]: dollars(row.paidCents),
      "W-9 on file": row.w9OnFile ? "Yes" : "No",
      "Pays by": row.achEnabled ? "Bank transfer" : "Check",
    })),
    totals: [
      { label: "Paid in the year", moneyCents: rows.reduce((t, row) => t + row.paidCents, 0) },
      { label: "Vendors", count: rows.length },
      { label: "No W-9 yet", count: rows.filter((row) => !row.w9OnFile).length },
    ],
  };
}
