"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import type { LedgerCategory } from "@/lib/types";

/**
 * Adding a line to the budget.
 *
 * The setup plan asked a board to budget what they spend and pointed them at
 * a screen that could only display a budget, never build one. So the task sat
 * there permanently unfinished, which teaches a board to ignore the list.
 */
const CATEGORIES: (LedgerCategory | "Administrative")[] = [
  "Landscaping",
  "Utilities",
  "Insurance",
  "Repairs & maintenance",
  "Legal & professional",
  "Reserve transfer",
  "Administrative",
];

export function AddBudgetLine() {
  const { addBudgetLine } = useAppState();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Landscaping");
  const [annual, setAnnual] = useState("");

  const field =
    "h-10 rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand";
  const cents = Math.round((Number(annual) || 0) * 100);

  function submit() {
    addBudgetLine({
      category,
      annualCents: cents,
      // Nothing spent against it yet. A board entering next year's budget
      // has no actuals, and inventing one would be a lie in every report
      // that reads this.
      ytdActualCents: 0,
      kind: "expense",
    });
    setAnnual("");
    setOpen(false);
    notify(`${category} added to the budget`);
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add a budget line
      </Button>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader
        icon={<Plus className="size-4" />}
        title="Add a budget line"
        subtitle="What you expect to spend on it over the year"
        action={
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      />
      <form
        className="flex flex-wrap items-end gap-3 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (cents > 0) submit();
        }}
      >
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            aria-label="Budget category"
            className={`mt-1.5 w-48 ${field}`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">A year</span>
          <input
            type="number"
            min="0"
            step="1"
            value={annual}
            onChange={(e) => setAnnual(e.target.value)}
            placeholder="18000"
            aria-label="Annual amount"
            className={`mt-1.5 w-40 ${field}`}
          />
        </label>
        <Button type="submit" disabled={cents <= 0}>
          Add it
        </Button>
      </form>
    </Card>
  );
}
