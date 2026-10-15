/**
 * Packing a records export into the zip a person downloads.
 *
 * The README goes in first, so the archive explains itself before anybody
 * opens a CSV, and every file keeps the name the screen and the README call
 * it. The timestamp is passed in rather than read from the clock: the demo
 * is pinned to a day and an archive dated today would drift out of it.
 */

import { toCsv } from "@/lib/core/export";
import { buildZip } from "@/lib/core/zip";
import type { Community } from "@/lib/data/community";
import type { RecordsFile } from "./files";
import { readmeText } from "./readme";

/** One area's CSV, with its columns as the header row. */
export function recordsCsv(file: RecordsFile): string {
  return toCsv(file.rows, file.columns);
}

/** The zip: the README, then one CSV per area. */
export function recordsZip(
  files: RecordsFile[],
  readme: string,
  generatedOn: string,
): Uint8Array<ArrayBuffer> {
  return buildZip(
    [
      { name: "README.txt", contents: readme },
      ...files.map((file) => ({ name: file.name, contents: recordsCsv(file) })),
    ],
    generatedOn,
  );
}

/** The README for a set of files, in the association's own words. */
export function recordsReadme(
  c: Community,
  files: RecordsFile[],
  input: { generatedOn: string; period?: string; unreadable: string[]; by?: string },
): string {
  return readmeText(c, {
    files,
    generatedOn: input.generatedOn,
    ...(input.period ? { period: input.period } : {}),
    unreadable: input.unreadable,
    ...(input.by ? { by: input.by } : {}),
  });
}

/**
 * The zip's own name: "juniper-hollow-records-2026-08-20.zip", or with the
 * fiscal year in it when the export is one year rather than everything.
 */
export function recordsZipName(c: Community, generatedOn: string, year?: number): string {
  const slug =
    c.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "association";
  const what = year === undefined ? "records" : `records-${year}`;
  return `${slug}-${what}-${generatedOn}.zip`;
}
