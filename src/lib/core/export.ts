/**
 * CSV export and the downloads that carry one.
 *
 * A board's most common request of any HOA tool is "give me the numbers in a
 * spreadsheet", so Export needs to be a real download rather than a gesture.
 * Escaping matters here: a vendor called `Smith, Jones & Co` or a memo with a
 * newline will quietly corrupt a file that naively joins on commas.
 */

/**
 * Wraps a field in quotes when it contains a delimiter, a quote, or a newline.
 *
 * A field that starts with =, +, - or @ is a formula the moment a spreadsheet
 * opens the file, which turns a record the board exported into something that
 * recomputes on an auditor's machine. Those get a single quote in front, the
 * mitigation every spreadsheet understands. An amount does not: `-285.00` is
 * a number, and quoting it would turn a column of money into text.
 */
function escapeCsvField(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const guarded = /^[=+\-@]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvField(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvField(column.value(row))).join(","),
  );
  // A leading BOM so Excel opens UTF-8 without mangling accents.
  return `﻿${[header, ...body].join("\r\n")}`;
}

/** Triggers a browser download. No-ops during server rendering. */
export function downloadCsv(filename: string, contents: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** The same download for an archive of CSVs, built by `buildZip`. */
export function downloadZip(filename: string, contents: Uint8Array<ArrayBuffer>): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([contents], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
