/**
 * CSV export.
 *
 * A board's most common request of any HOA tool is "give me the numbers in a
 * spreadsheet", so Export needs to be a real download rather than a gesture.
 * Escaping matters here: a vendor called `Smith, Jones & Co` or a memo with a
 * newline will quietly corrupt a file that naively joins on commas.
 */

/** Wraps a field in quotes when it contains a delimiter, a quote, or a newline. */
export function escapeCsvField(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
