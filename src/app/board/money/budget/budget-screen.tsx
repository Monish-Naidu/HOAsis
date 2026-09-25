"use client";

import { Badge, Card, CardHeader, Meter, PageHeader } from "@/components/ui/primitives";
import { AddBudgetLine } from "@/components/app/add-budget-line";
import { StatTile } from "@/components/app/finance-ui";
import { useAppState } from "@/lib/app-state";
import { budgetVariance } from "@/lib/metrics";
import { cn, money, pluralize, todayIsoDate } from "@/lib/utils";

type Row = ReturnType<typeof budgetVariance>["expense"][number];
type Total = ReturnType<typeof budgetVariance>["expenseTotal"];

/**
 * Budget against actual, one line at a time.
 *
 * The yardstick is the share of the year gone. A line that has used more of
 * its budget than that is flagged; the rest is a bar and a signed variance,
 * positive when the news is good on either kind of line.
 */
export function BudgetScreen() {
  const { community } = useAppState();
  const v = budgetVariance(community);
  const year = todayIsoDate().slice(0, 4);
  const elapsedPct = Math.round(v.yearElapsed * 100);

  return (
    <>
      <PageHeader
        title="Budget"
        description={`The ${year} budget compared with actual spending, with ${elapsedPct}% of the year gone.`}
        action={<AddBudgetLine />}
      />

      {!v.hasBudget ? (
        <Card className="p-6">
          <p className="text-headline font-semibold tracking-[-0.015em] text-fg">No budget yet</p>
          <p className="mt-1.5 max-w-[60ch] text-body leading-relaxed text-fg-muted">
            Add the lines the association spends on and each one is measured against the share of
            the year gone, so an overrun shows in March rather than December.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Income to date"
              value={money(v.incomeTotal.ytdActualCents, { cents: false })}
              hint={`${Math.round(v.incomeTotal.pace * 100)}% of ${money(v.incomeTotal.annualCents, { cents: false })}`}
            />
            <StatTile
              label="Spending to date"
              value={money(v.expenseTotal.ytdActualCents, { cents: false })}
              hint={`${Math.round(v.expenseTotal.pace * 100)}% of ${money(v.expenseTotal.annualCents, { cents: false })}`}
            />
            <StatTile
              label="Net to date"
              value={money(v.incomeTotal.ytdActualCents - v.expenseTotal.ytdActualCents, {
                sign: true,
                cents: false,
              })}
              hint={`Budgeted ${money(v.incomeTotal.annualCents - v.expenseTotal.annualCents, { sign: true, cents: false })} for the year`}
            />
            <StatTile
              label="Off pace"
              value={String(v.flagged.length)}
              tone={v.flagged.length ? "warn" : undefined}
              hint={v.flagged.length ? v.flagged.map((r) => r.category).join(", ") : "Every line is where it should be"}
            />
          </div>

          <BudgetTable
            title="Money in"
            rows={v.income}
            total={v.incomeTotal}
            elapsed={v.yearElapsed}
            kind="income"
          />
          <BudgetTable
            title="Money out"
            rows={v.expense}
            total={v.expenseTotal}
            elapsed={v.yearElapsed}
            kind="expense"
          />

          <p className="mt-4 text-footnote text-fg-muted">
            Pace is the share of a line&apos;s annual budget used so far, against {elapsedPct}% of the
            year gone. Difference is against the budget so far, positive when the association
            is ahead.
          </p>
        </>
      )}
    </>
  );
}

function BudgetTable({
  title,
  rows,
  total,
  elapsed,
  kind,
}: {
  title: string;
  rows: Row[];
  total: Total;
  elapsed: number;
  kind: "income" | "expense";
}) {
  if (rows.length === 0) return null;
  const flagged = rows.filter((r) => r.overPace || r.behind).length;
  return (
    <Card className="mt-5">
      <CardHeader
        title={title}
        subtitle={flagged ? `${pluralize(flagged, "line")} off pace` : "On pace"}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-border text-footnote font-semibold text-fg-muted">
              <th className="px-5 py-2.5 font-semibold">Line</th>
              <th className="px-3 py-2.5 text-right font-semibold">Budget</th>
              <th className="px-3 py-2.5 text-right font-semibold">Actual</th>
              <th className="w-56 px-3 py-2.5 font-semibold">Pace</th>
              <th className="px-3 py-2.5 text-right font-semibold">Difference</th>
              <th className="px-5 py-2.5 text-right font-semibold">Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const flag = r.overPace || r.behind;
              return (
                <tr key={r.category} className="border-b border-border text-body transition-colors hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 font-medium text-fg">
                      {r.category}
                      {r.overPace ? <Badge tone="warn">Over pace</Badge> : null}
                      {r.behind ? <Badge tone="warn">Behind</Badge> : null}
                    </span>
                  </td>
                  <td className="tnum px-3 py-3 text-right text-fg-muted">{money(r.annualCents, { cents: false })}</td>
                  <td className="tnum px-3 py-3 text-right font-semibold text-fg">{money(r.ytdActualCents, { cents: false })}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Meter
                          value={r.pace}
                          tone={flag ? "warn" : kind === "income" ? "ok" : "brand"}
                          aria-label={`${r.category}, ${Math.round(r.pace * 100)}% of budget`}
                        />
                        {/* Where the year is. */}
                        <span
                          aria-hidden
                          className="absolute -top-1 h-3.5 w-px bg-fg-subtle"
                          style={{ left: `${Math.min(100, elapsed * 100)}%` }}
                        />
                      </div>
                      <span className="tnum w-10 text-right text-footnote text-fg-muted">{Math.round(r.pace * 100)}%</span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      "tnum px-3 py-3 text-right font-medium",
                      r.varianceCents > 0 ? "text-ok" : r.varianceCents < 0 ? "text-danger" : "text-fg-muted",
                    )}
                  >
                    {money(r.varianceCents, { sign: true, cents: false })}
                  </td>
                  <td className="tnum px-5 py-3 text-right text-fg-muted">{money(r.remainingCents, { cents: false })}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-body font-semibold text-fg">
              <td className="px-5 py-3">Total</td>
              <td className="tnum px-3 py-3 text-right">{money(total.annualCents, { cents: false })}</td>
              <td className="tnum px-3 py-3 text-right">{money(total.ytdActualCents, { cents: false })}</td>
              <td className="tnum px-3 py-3 text-right text-footnote text-fg-muted">{Math.round(total.pace * 100)}%</td>
              <td
                className={cn(
                  "tnum px-3 py-3 text-right",
                  total.varianceCents > 0 ? "text-ok" : total.varianceCents < 0 ? "text-danger" : "text-fg-muted",
                )}
              >
                {money(total.varianceCents, { sign: true, cents: false })}
              </td>
              <td className="tnum px-5 py-3 text-right text-fg-muted">
                {money(total.annualCents - total.ytdActualCents, { cents: false })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
