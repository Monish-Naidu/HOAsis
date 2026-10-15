/**
 * The shape of one file in a records export.
 *
 * Every area a board is asked for, a year at a time or the whole history,
 * becomes the same thing: a name inside the zip, a title and a line of copy
 * for the screen, the columns the CSV carries (the README repeats them), the
 * rows themselves, and the totals the screen shows beside the download.
 * The totals are computed by the same selectors the matching screens read,
 * so a records request and the product cannot disagree about a figure.
 */

import type { CsvColumn } from "@/lib/core/export";
import type { Community } from "@/lib/data/community";
import type { Capability } from "@/lib/types";
import { homeLabel } from "@/lib/wording";

/** A row with every value already a string, ready for the CSV writer. */
export type RecordsRow = Record<string, string>;

/** One figure beside a file's download: money in cents, or a count. */
interface RecordsTotal {
  label: string;
  moneyCents?: number;
  count?: number;
  /** A figure that is neither: a share, a rate, a date. */
  text?: string;
}

export interface RecordsFile {
  /** The word on the screen, and the key the components find a file by. */
  id: string;
  title: string;
  /** What the file holds, one line, shown on the screen and in the README. */
  blurb: string;
  /** The name inside the zip. */
  name: string;
  columns: CsvColumn<RecordsRow>[];
  rows: RecordsRow[];
  totals: RecordsTotal[];
  /**
   * What a seat needs to read this area. Any one of these opens it, the same
   * way a board route's `need` does. Absent: every member may.
   */
  capabilities?: Capability[];
}

/**
 * Columns for a records file, one per header.
 *
 * A records row is keyed by its column header, so the columns of a file are
 * its headers in order and nothing more: no value function to keep in step
 * with the row, and the README's column line and the CSV's header row are
 * the same list.
 */
export function columnsOf(...headers: string[]): CsvColumn<RecordsRow>[] {
  return headers.map((header) => ({ header, value: (row: RecordsRow) => row[header] ?? "" }));
}

/**
 * Money in a CSV: plain decimal dollars, never the on-screen formatting.
 * A spreadsheet reads "285.00" as a number and "$285.00" as text, and the
 * README says which convention the files use.
 */
export function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** The home's name in the community's own words, "Lot 7" or the address. */
export function homeName(c: Community, labels: Map<string, string>, homeId: string): string {
  const unit = labels.get(homeId);
  return unit ? homeLabel(c, unit) : "Not on the register";
}

/** An area's columns as a line for the README: "Date, Home, Label, Amount". */
export function columnLine(file: RecordsFile): string {
  return file.columns.map((column) => column.header).join(", ");
}
