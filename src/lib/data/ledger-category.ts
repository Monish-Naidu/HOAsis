import type { LedgerCategory } from "@/lib/types";

/**
 * Every category the books use, spelled the way the ledger spells it. A
 * category written in other letters ("landscaping") would be a second slice
 * beside "Landscaping" on Finances, so a line is always filed under the
 * spelling in this list.
 */
const CATEGORIES: readonly LedgerCategory[] = [
  "Assessments",
  "Late fees",
  "Landscaping",
  "Utilities",
  "Insurance",
  "Repairs & maintenance",
  "Management",
  "Reserve transfer",
  "Legal & professional",
  "Interest income",
  "Processing fees",
  "Opening balance",
];

/**
 * The ledger's own spelling of a category, whatever case or spacing it came
 * in. Text that matches no category is returned as it was; the caller decides
 * what to do with a category the books do not know.
 */
export function ledgerCategory(raw: string): LedgerCategory {
  const key = raw.trim().replace(/\s+/g, " ").toLowerCase();
  return CATEGORIES.find((c) => c.toLowerCase() === key) ?? (raw as LedgerCategory);
}
