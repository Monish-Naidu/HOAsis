"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn, money, shortMoney } from "@/lib/utils";

/**
 * The two figures on the board dashboard, drawn from `monthlyFlows` and
 * `spendingByCategory` in metrics. The selectors own the numbers; this file
 * owns nothing but pixels, so the chart cannot disagree with an export of the
 * same rows.
 *
 * Series colors are the `chart-*` tokens, validated as a set for color-vision
 * separation on both surfaces. A few hues sit under the contrast or CVD
 * thresholds, which is allowed only because of the secondary encoding both
 * charts carry: every value is also text (legend amounts, tooltips, a screen
 * reader table) and slices are separated by 2px surface gaps.
 */

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(key: string) {
  return MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? key;
}

/**
 * Round up to 1.5, 3, 6 or 12 times a power of ten. Deliberately multiples of
 * three, so the two inner gridlines always land on round thirds.
 */
function niceCeil(v: number) {
  if (v <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const f of [1.5, 3, 6, 12]) {
    if (v <= f * pow) return f * pow;
  }
  return 12 * pow;
}

export interface MonthFlow {
  month: string;
  inCents: number;
  outCents: number;
}

export function MoneyFlowChart({ months }: { months: MonthFlow[] }) {
  const peak = niceCeil(Math.max(...months.map((m) => Math.max(m.inCents, m.outCents))));
  const h = (cents: number) => (peak ? Math.max(cents > 0 ? 1.5 : 0, (cents / peak) * 100) : 0);

  // Grows to the card's height, so beside a taller neighbour the bars fill
  // the card instead of leaving its lower half empty.
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-4 px-5 pt-4" aria-hidden>
        <span className="inline-flex items-center gap-1.5 text-footnote font-medium text-fg-muted">
          <span className="size-2.5 rounded-sm bg-chart-3" />
          Money in
        </span>
        <span className="inline-flex items-center gap-1.5 text-footnote font-medium text-fg-muted">
          <span className="size-2.5 rounded-sm bg-chart-1" />
          Money out
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-4 pt-3" aria-hidden>
        <div className="relative min-h-44 flex-1">
          {/* Gridlines at thirds, quiet, with the scale written at the left. */}
          {[0, 1 / 3, 2 / 3, 1].map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 flex items-end"
              style={{ bottom: `${t * 100}%` }}
            >
              <span className="tnum w-10 shrink-0 translate-y-[0.4em] pr-2 text-right text-caption text-fg-subtle">
                {t === 0 ? "$0" : shortMoney(peak * t)}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ))}

          <div className="absolute inset-y-0 left-10 right-0 flex items-end justify-around">
            {months.map((m) => (
              <div
                key={m.month}
                className="group relative flex h-full flex-1 items-end justify-center gap-[2px]"
              >
                <div
                  className="w-2 rounded-t-[3px] bg-chart-3 sm:w-2.5"
                  style={{ height: `${h(m.inCents)}%` }}
                />
                <div
                  className="w-2 rounded-t-[3px] bg-chart-1 sm:w-2.5"
                  style={{ height: `${h(m.outCents)}%` }}
                />
                {/* The hover layer. The hit target is the whole month column. */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-left shadow-float group-hover:block">
                  <p className="text-caption font-semibold text-fg">
                    {monthLabel(m.month)} {m.month.slice(0, 4)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-caption text-fg-muted">
                    <span className="size-2 rounded-full bg-chart-3" />
                    Money in
                    <span className="tnum ml-auto pl-3 font-semibold text-fg">
                      {money(m.inCents, { cents: false })}
                    </span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-caption text-fg-muted">
                    <span className="size-2 rounded-full bg-chart-1" />
                    Money out
                    <span className="tnum ml-auto pl-3 font-semibold text-fg">
                      {money(m.outCents, { cents: false })}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Every other month on a phone once there are more than six:
            twelve three-letter labels in 280px ran into each other. */}
        <div className="ml-10 flex justify-around pt-1.5">
          {months.map((m, i) => (
            <span
              key={m.month}
              className={cn(
                "flex-1 text-center text-caption text-fg-subtle",
                months.length > 6 && i % 2 === 1 && "max-sm:invisible",
              )}
            >
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
              <th scope="row">
                {monthLabel(m.month)} {m.month.slice(0, 4)}
              </th>
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
  "stroke-chart-5",
] as const;
const SLICE_CHIP = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const;

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
  reportHref,
}: {
  rows: SpendingRow[];
  totalCents: number;
  /** A link into the transactions the figures came from. */
  reportHref?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const slices = layoutSlices(rows, rows.length > 1 ? 1.4 : 0);
  const shown = active === null ? null : rows[active];

  return (
    <div className="flex flex-col px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <div className="relative size-40 shrink-0" aria-hidden>
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
            {/* Narrower than the hole, so a long category wraps instead of
                running over the ring. */}
            <p className="max-w-[5.5rem] text-caption font-medium leading-tight text-fg-muted">
              {shown ? shown.category : "Total spent"}
            </p>
            <p className="tnum mt-0.5 text-headline font-semibold tracking-[-0.02em] text-fg">
              {money(shown ? shown.cents : totalCents, { cents: false })}
            </p>
          </div>
        </div>

        {/* The legend carries the numbers, so color is never the only way in. */}
        <ul className="min-w-0 flex-1 basis-52 space-y-0.5">
          {rows.map((row, i) => (
            <li
              key={row.category}
              title={row.category}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={cn(
                "flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors",
                active === i && "bg-surface-2",
              )}
            >
              <span className={cn("size-2.5 shrink-0 rounded-sm", sliceClass(row, i, "chip"))} />
              <span className="min-w-0 flex-1 text-footnote font-medium leading-tight text-fg">
                {row.category}
              </span>
              <span className="tnum text-footnote font-semibold text-fg">
                {money(row.cents, { cents: false })}
              </span>
              <span className="tnum w-8 text-right text-caption text-fg-subtle">
                {Math.round(row.share * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {reportHref ? (
        <div className="mt-3 border-t border-border pt-3 text-right">
          <Link
            href={reportHref}
            className="inline-flex items-center gap-1 text-footnote font-semibold text-accent hover:underline"
          >
            See the transactions
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Two years, month by month.                                                  */
/* -------------------------------------------------------------------------- */

export interface CompareMonth {
  label: string;
  a: number;
  b: number;
}

/**
 * Grouped bars: the earlier year in the neutral tone, the later in the
 * primary, so the eye reads "this against the baseline" rather than two
 * equal series. Same scale rules as the flow chart.
 */
export function YearCompareChart({
  months,
  aLabel,
  bLabel,
  caption,
}: {
  months: CompareMonth[];
  aLabel: string;
  bLabel: string;
  /** What the bars measure, for the screen reader table. */
  caption: string;
}) {
  const peak = niceCeil(Math.max(0, ...months.map((m) => Math.max(m.a, m.b))));
  const h = (cents: number) => (peak ? Math.max(cents > 0 ? 1.5 : 0, (cents / peak) * 100) : 0);

  return (
    <div>
      <div className="flex items-center gap-4 px-5 pt-4" aria-hidden>
        <span className="inline-flex items-center gap-1.5 text-footnote font-medium text-fg-muted">
          <span className="size-2.5 rounded-sm bg-chart-other" />
          {aLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-footnote font-medium text-fg-muted">
          <span className="size-2.5 rounded-sm bg-chart-1" />
          {bLabel}
        </span>
      </div>

      <div className="px-5 pb-4 pt-3" aria-hidden>
        <div className="relative h-48">
          {[0, 1 / 3, 2 / 3, 1].map((t) => (
            <div key={t} className="absolute inset-x-0 flex items-end" style={{ bottom: `${t * 100}%` }}>
              <span className="tnum w-10 shrink-0 translate-y-[0.4em] pr-2 text-right text-caption text-fg-subtle">
                {t === 0 ? "$0" : shortMoney(peak * t)}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ))}
          <div className="absolute inset-y-0 left-10 right-0 flex items-end justify-around">
            {months.map((m) => (
              <div
                key={m.label}
                className="group relative flex h-full flex-1 items-end justify-center gap-[2px]"
              >
                <div className="w-2 rounded-t-[3px] bg-chart-other sm:w-2.5" style={{ height: `${h(m.a)}%` }} />
                <div className="w-2 rounded-t-[3px] bg-chart-1 sm:w-2.5" style={{ height: `${h(m.b)}%` }} />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-left shadow-float group-hover:block">
                  <p className="text-caption font-semibold text-fg">{m.label}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-caption text-fg-muted">
                    <span className="size-2 rounded-full bg-chart-other" />
                    {aLabel}
                    <span className="tnum ml-auto pl-3 font-semibold text-fg">{money(m.a, { cents: false })}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-caption text-fg-muted">
                    <span className="size-2 rounded-full bg-chart-1" />
                    {bLabel}
                    <span className="tnum ml-auto pl-3 font-semibold text-fg">{money(m.b, { cents: false })}</span>
                  </p>
                  <p className="tnum mt-1 border-t border-border pt-1 text-right text-caption font-medium text-fg-muted">
                    {money(m.b - m.a, { sign: true, cents: false })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ml-10 flex justify-around pt-1.5">
          {months.map((m, i) => (
            <span
              key={m.label}
              className={cn(
                "flex-1 text-center text-caption text-fg-subtle",
                months.length > 6 && i % 2 === 1 && "max-sm:invisible",
              )}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">{aLabel}</th>
            <th scope="col">{bLabel}</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.label}>
              <th scope="row">{m.label}</th>
              <td>{money(m.a)}</td>
              <td>{money(m.b)}</td>
              <td>{money(m.b - m.a, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Net by year.                                                                */
/* -------------------------------------------------------------------------- */

export interface YearNet {
  year: number;
  netCents: number;
  partial: boolean;
  throughMonth: number;
}

/**
 * One bar per year around a zero line. A few years are a handful of bars,
 * not a line: a line through three points invents a trend. The year still
 * in progress is drawn lighter and labelled with the month it runs to.
 */
export function NetTrendChart({ years }: { years: YearNet[] }) {
  const peak = niceCeil(Math.max(0, ...years.map((y) => Math.abs(y.netCents))));
  const hasNegative = years.some((y) => y.netCents < 0);
  const h = (cents: number) => (peak ? (Math.abs(cents) / peak) * (hasNegative ? 50 : 100) : 0);
  const zero = hasNegative ? 50 : 0;

  return (
    <div className="px-5 pb-4 pt-4">
      <div className="relative h-40" aria-hidden>
        {[1, zero / 100, ...(hasNegative ? [0] : [])].map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-end" style={{ bottom: `${t * 100}%` }}>
            <span className="tnum w-12 shrink-0 translate-y-[0.4em] pr-2 text-right text-caption text-fg-subtle">
              {t === zero / 100 ? "$0" : t === 1 ? shortMoney(peak) : `-${shortMoney(peak)}`}
            </span>
            <span className={cn("h-px flex-1", t === zero / 100 ? "bg-border-2" : "bg-border")} />
          </div>
        ))}
        <div className="absolute inset-y-0 left-12 right-0 flex justify-around">
          {years.map((y) => (
            <div key={y.year} className="group relative h-full flex-1">
              <div
                className={cn(
                  "absolute left-1/2 w-8 max-w-[40%] -translate-x-1/2 rounded-[3px]",
                  y.netCents >= 0 ? "bg-chart-1" : "bg-chart-2",
                  y.partial && "opacity-60",
                )}
                style={
                  y.netCents >= 0
                    ? { bottom: `${zero}%`, height: `${h(y.netCents)}%` }
                    : { top: `${100 - zero}%`, height: `${h(y.netCents)}%` }
                }
              />
              <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 shadow-float group-hover:block">
                <p className="text-caption font-semibold text-fg">
                  {y.year}
                  {y.partial ? ` through ${MONTH_NAMES[y.throughMonth - 1]}` : ""}
                </p>
                <p className="tnum mt-0.5 text-caption font-semibold text-fg">
                  {money(y.netCents, { sign: true, cents: false })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-12 flex justify-around pt-1.5" aria-hidden>
        {years.map((y) => (
          <span key={y.year} className="flex-1 text-center text-caption text-fg-subtle">
            {y.year}
            {y.partial ? <span className="block text-caption">to {MONTH_NAMES[y.throughMonth - 1]}</span> : null}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Net income by year, before reserve funding</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Net</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.year}>
              <th scope="row">
                {y.year}
                {y.partial ? ` (through ${MONTH_NAMES[y.throughMonth - 1]})` : ""}
              </th>
              <td>{money(y.netCents, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Aging.                                                                      */
/* -------------------------------------------------------------------------- */

export interface AgingSegment {
  key: string;
  label: string;
  cents: number;
  count: number;
  share: number;
}

const AGING_CHIP: Record<string, string> = {
  current: "bg-chart-3",
  "1-30": "bg-chart-4",
  "31-60": "bg-chart-2",
  "61+": "bg-chart-5",
};

/** One bar, four segments: how much of what is owed is how old. */
export function AgingBar({ buckets }: { buckets: AgingSegment[] }) {
  const shown = buckets.filter((b) => b.cents > 0);
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {shown.map((b) => (
          <span
            key={b.key}
            title={`${b.label}: ${money(b.cents)}`}
            className={cn("block h-full", AGING_CHIP[b.key] ?? "bg-chart-other")}
            style={{ width: `${b.share * 100}%` }}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {buckets.map((b) => (
          <div key={b.key}>
            <dt className="flex items-center gap-1.5 text-footnote font-medium text-fg-muted">
              <span className={cn("size-2.5 rounded-sm", AGING_CHIP[b.key] ?? "bg-chart-other")} aria-hidden />
              {b.label}
            </dt>
            <dd className="tnum mt-1 text-headline font-semibold tracking-[-0.02em] text-fg">
              {money(b.cents, { cents: false })}
            </dd>
            <dd className="text-caption text-fg-subtle">
              {b.count} {b.count === 1 ? "household" : "households"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
