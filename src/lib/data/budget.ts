/**
 * The budget the board adopted, line by line.
 *
 * The annual figures are in cents. What was actually spent is never stored
 * here: it is derived from the books by a selector (categoryFlows in
 * src/lib/metrics.ts), the same rows the Finances screens read, so the two
 * screens cannot disagree. Every percentage on the budget screens is derived
 * too.
 */

import type { Cents, ISODate, LedgerCategory } from "@/lib/types";

export interface BudgetLine {
  category: LedgerCategory | "Administrative";
  annualCents: Cents;
  /** The day the board adopted the budget this line belongs to, where said. */
  approvedOn?: ISODate;
  kind: "income" | "expense";
}

/**
 * FY2026 adopted budget. Annual assessment income = 88 units × $285 × 12.
 */
export const budget: BudgetLine[] = [
  { category: "Assessments", annualCents: 30_096_000, approvedOn: "2025-11-18", kind: "income" },
  { category: "Late fees", annualCents: 300_000, approvedOn: "2025-11-18", kind: "income" },
  { category: "Interest income", annualCents: 1_200_000, approvedOn: "2025-11-18", kind: "income" },

  {
    category: "Landscaping",
    annualCents: 3_420_000,
    approvedOn: "2025-11-18",
    kind: "expense",
  },
  { category: "Utilities", annualCents: 2_580_000, approvedOn: "2025-11-18", kind: "expense" },
  { category: "Insurance", annualCents: 8_910_000, approvedOn: "2025-11-18", kind: "expense" },
  {
    category: "Repairs & maintenance",
    annualCents: 6_200_000,
    approvedOn: "2025-11-18",
    kind: "expense",
  },
  {
    category: "Legal & professional",
    annualCents: 1_400_000,
    approvedOn: "2025-11-18",
    kind: "expense",
  },
  { category: "Administrative", annualCents: 940_000, approvedOn: "2025-11-18", kind: "expense" },
  {
    category: "Reserve transfer",
    annualCents: 7_344_000,
    approvedOn: "2025-11-18",
    kind: "expense",
  },
];

/** Share of the fiscal year elapsed on Aug 20. The fair yardstick for "on pace". */
export const YEAR_ELAPSED = 0.638;
