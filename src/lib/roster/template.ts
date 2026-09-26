import { downloadCsv } from "@/lib/core/export";
import { rosterTemplateCsv } from "@/lib/roster/csv";

/** The template a board fills in, as a download. Browser only. */
export function downloadRosterTemplate(): void {
  downloadCsv("roster-template.csv", rosterTemplateCsv());
}

/** Reads a file the person picked as text. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsText(file);
  });
}

export const ROSTER_ACCEPT = ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain";
