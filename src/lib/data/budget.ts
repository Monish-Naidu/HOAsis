import type { Cents, LedgerCategory } from "@/lib/types";

export interface BudgetLine {
  category: LedgerCategory | "Administrative";
  annualCents: Cents;
  ytdActualCents: Cents;
  kind: "income" | "expense";
}

/**
 * FY2026 adopted budget vs. actual through Aug 20 (63.8% of the year elapsed).
 * Annual assessment income = 88 units × $285 × 12.
 */
export const budget: BudgetLine[] = [
  { category: "Assessments", annualCents: 30_096_000, ytdActualCents: 19_260_000, kind: "income" },
  { category: "Late fees", annualCents: 300_000, ytdActualCents: 246_500, kind: "income" },
  { category: "Interest income", annualCents: 1_200_000, ytdActualCents: 771_290, kind: "income" },

  { category: "Landscaping", annualCents: 3_420_000, ytdActualCents: 2_280_000, kind: "expense" },
  { category: "Utilities", annualCents: 2_580_000, ytdActualCents: 1_712_400, kind: "expense" },
  { category: "Insurance", annualCents: 8_910_000, ytdActualCents: 5_938_400, kind: "expense" },
  {
    category: "Repairs & maintenance",
    annualCents: 6_200_000,
    ytdActualCents: 4_486_000,
    kind: "expense",
  },
  {
    category: "Legal & professional",
    annualCents: 1_400_000,
    ytdActualCents: 780_000,
    kind: "expense",
  },
  { category: "Administrative", annualCents: 940_000, ytdActualCents: 574_300, kind: "expense" },
  {
    category: "Reserve transfer",
    annualCents: 7_344_000,
    ytdActualCents: 4_896_000,
    kind: "expense",
  },
];

/** Share of the fiscal year elapsed on Aug 20. The fair yardstick for "on pace". */
export const YEAR_ELAPSED = 0.638;
