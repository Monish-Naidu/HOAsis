/**
 * The README.txt that travels inside a records zip.
 *
 * A zip of CSVs lands on an accountant's desk without anybody beside it, so
 * the archive explains itself: which file is which, the columns each one
 * carries, the money and date conventions, and the two things an honest
 * export has to say out loud: what this seat could not read, and what the
 * product deliberately does not hand over (a member's individual vote).
 */

import type { Community } from "@/lib/data/community";
import type { RecordsFile } from "./files";
import { columnLine } from "./files";

export interface ReadmeInput {
  files: RecordsFile[];
  /** The day the export was made, passed in so nothing reads the clock. */
  generatedOn: string;
  /** "Fiscal year 2026, Jan 1 to Dec 31 2026", for the one-year export. */
  period?: string;
  /** The areas this seat cannot read, by their screen names. */
  unreadable: string[];
  /** Who made the export, so the file says where it came from. */
  by?: string;
}

export function readmeText(c: Community, input: ReadmeInput): string {
  const lines: string[] = [`${c.settings.displayName}: records export`];
  if (input.period) lines.push(`For ${input.period}.`);
  lines.push(
    `Made on ${input.generatedOn}` + (input.by ? ` by ${input.by}` : "") + ".",
    "",
    "One CSV file per area. Each file starts with a header row naming its columns.",
    "Amounts are decimal dollars: 285.00 means $285.00. Dates are YYYY-MM-DD.",
    "",
    "Files in this zip:",
    "",
  );

  for (const file of input.files) {
    lines.push(`${file.name}: ${file.blurb}`);
    lines.push(`  Columns: ${columnLine(file)}`);
    lines.push(`  Rows: ${file.rows.length}`);
    lines.push("");
  }

  if (input.unreadable.length) {
    lines.push(
      `Your seat cannot read ${input.unreadable.join(", ")}.`,
      "Those files hold only what row level security let this seat read.",
      "",
    );
  }

  lines.push(
    "Not in this zip:",
    "The files themselves, such as documents and photos. Each is listed by name in its area's CSV.",
    "Saved payment methods. The product holds only their masked labels.",
    "How each person voted. A ballot's tally is the public fact; a member's own vote is theirs.",
    "",
    `Exported from Your HOAsis for ${c.settings.displayName}.`,
  );
  return lines.join("\r\n") + "\r\n";
}
