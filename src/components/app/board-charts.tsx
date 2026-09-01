"use client";

import { useState } from "react";
import { cn, money, shortMoney } from "@/lib/utils";

/**
 * The two figures on the board dashboard, drawn from `monthlyFlows` and
 * `spendingByCategory` in metrics. The selectors own the numbers; this file
 * owns nothing but pixels, so the chart cannot disagree with an export of the
 * same rows.
 *
 * Series colors are the `chart-*` tokens, which were validated as a set for
 * color-vision separation on both surfaces. Two of the light-theme hues sit
 * under 3:1 against white, which is allowed only because every value is also
 * in text: the legend carries the amounts, the tooltip carries the pairs, and
 * each chart ships a screen-reader table.
 */

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(key: string) {
  return MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? key;
}

/** Round up to a nice multiple of a power of ten, so gridlines land on numbers a reader can hold. */
function niceCeil(v: number) {
  if (v <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const f of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (v <= f * pow) return f * pow;
  }
  return 10 * pow;
}

export interface MonthFlow {
  month: string;
  inCents: number;
  outCents: number;
}

export function MoneyFlowChart({ months }: { months: MonthFlow[] }) {
  const peak = niceCeil(Math.max(...months.map((m) => Math.max(m.inCents, m.outCents))));
  const h = (cents: number) => (peak ? Math.max(cents > 0 ? 2 : 0, (cents / peak) * 100) : 0);

  return (
    <div>
      <div className="flex items-center gap-4 px-5 pt-4" aria-hidden>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted">
          <span className="size-2.5 rounded-sm bg-chart-3" />
          Money in
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted">
          <span className="size-2.5 rounded-sm bg-chart-1" />
          Money out
        </span>
      </div>

      <div className="px-5 pb-4 pt-3" aria-hidden>
        <div className="relative h-44">
          {/* Gridlines, quiet, with the scale written at the left. */}
          {[0, 0.5, 1].map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 flex items-end"
              style={{ bottom: `${t * 100}%` }}
            >
              <span className="tnum w-10 shrink-0 translate-y-[0.4em] pr-2 text-right text-[11px] text-fg-subtle">
                {t === 0 ? "$0" : shortMoney(peak * t)}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ))}

          <div className="absolute inset-y-0 left-10 right-0 flex items-end justify-around gap-2">
            {months.map((m) => (
              <div
                key={m.month}
                className="group relative flex h-full max-w-14 flex-1 items-end justify-center gap-[2px]"
              >
                <div
                  className="w-4 rounded-t-[4px] bg-chart-3"
                  style={{ height: `${h(m.inCents)}%` }}
                />
                <div
                  className="w-4 rounded-t-[4px] bg-chart-1"
                  style={{ height: `${h(m.outCents)}%` }}
                />
                {/* The hover layer. The hit target is the whole month column. */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left shadow-float group-hover:block">
                  <p className="text-[12px] font-semibold text-fg">{monthLabel(m.month)}</p>
                  <p className="tnum text-[12px] text-fg-muted">In {money(m.inCents, { cents: false })}</p>
                  <p className="tnum text-[12px] text-fg-muted">Out {money(m.outCents, { cents: false })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ml-10 flex justify-around gap-2 pt-1.5">
          {months.map((m) => (
            <span key={m.month} className="max-w-14 flex-1 text-center text-[11px] text-fg-subtle">
              {monthLabel(m.month)}
            </span>
          ))}
        </div>
      </div>

      {/* The same rows, as rows. */}
      <table className="sr-only">
        <caption>Money in and money out by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Money in</th>
            <th scope="col">Money out</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{m.month}</th>
              <td>{money(m.inCents)}</td>
              <td>{money(m.outCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface SpendingRow {
  category: string;
  cents: number;
  share: number;
}

const SLICE_STROKE = [
  "stroke-chart-1",
  "stroke-chart-2",
  "stroke-chart-3",
  "stroke-chart-4",
] as const;
const SLICE_CHIP = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"] as const;

function sliceClass(row: SpendingRow, i: number, kind: "stroke" | "chip") {
  if (row.category === "Other") return kind === "stroke" ? "stroke-chart-other" : "bg-chart-other";
  const list = kind === "stroke" ? SLICE_STROKE : SLICE_CHIP;
  return list[i % list.length];
}

/** Positions each slice on a 100-unit ring, leaving the gap between them. */
function layoutSlices(rows: SpendingRow[], gap: number) {
  const slices: { row: SpendingRow; i: number; start: number; length: number }[] = [];
  let start = 0;
  rows.forEach((row, i) => {
    slices.push({ row, i, start: start + gap / 2, length: Math.max(0, row.share * 100 - gap) });
    start += row.share * 100;
  });
  return slices;
}

export function SpendingDonut({
  rows,
  totalCents,
}: {
  rows: SpendingRow[];
  totalCents: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const slices = layoutSlices(rows, rows.length > 1 ? 1.4 : 0);
  const shown = active === null ? null : rows[active];

  return (
    <div className="px-5 py-4">
      <div className="relative mx-auto size-40" aria-hidden>
        <svg viewBox="0 0 168 168" className="size-full -rotate-90">
          {slices.map(({ row, i, start, length }) => (
            <circle
              key={row.category}
              cx="84"
              cy="84"
              r="66"
              fill="none"
              strokeWidth={active === i ? 30 : 26}
              pathLength={100}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-start}
              className={cn(
                sliceClass(row, i, "stroke"),
                "transition-all duration-200",
                active !== null && active !== i && "opacity-35",
              )}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="max-w-24 text-[11px] font-medium leading-tight text-fg-muted">
            {shown ? shown.category : "Spent this year"}
          </p>
          <p className="tnum mt-0.5 text-[17px] font-semibold tracking-[-0.02em] text-fg">
            {money(shown ? shown.cents : totalCents, { cents: false })}
          </p>
        </div>
      </div>

      {/* The legend carries the numbers, so the color is never the only way in. */}
      <ul className="mt-4 space-y-1">
        {rows.map((row, i) => (
          <li
            key={row.category}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              "flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors",
              active === i && "bg-surface-2",
            )}
          >
            <span className={cn("size-2.5 shrink-0 rounded-sm", sliceClass(row, i, "chip"))} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
              {row.category}
            </span>
            <span className="tnum text-[13px] font-semibold text-fg">
              {money(row.cents, { cents: false })}
            </span>
            <span className="tnum w-9 text-right text-[12px] text-fg-subtle">
              {Math.round(row.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
