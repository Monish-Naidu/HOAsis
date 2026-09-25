"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import { Segmented as SegmentedControl, Select } from "@/components/ui/primitives";
import { PERIOD_LABEL, type Delta, type PeriodPreset } from "@/lib/metrics";
import { cn, money } from "@/lib/utils";

/**
 * The small pieces the finance screens share: a figure with its change, a
 * segmented control, the period picker, a quiet select, an inline bar.
 *
 * Kept out of primitives on purpose. These carry finance opinions (what a
 * delta means, which presets a treasurer wants) that the general kit should
 * not have to know.
 */

/* ------------------------------------------------------------------ delta */

/**
 * The change between two figures, as a chip.
 *
 * `goodWhen` says which direction is welcome: income up is good, spending up
 * is not. The chip colours by that, never by the sign alone, because a red
 * arrow on rising income teaches a board to distrust the page.
 */
export function DeltaChip({
  delta,
  goodWhen = "up",
  className,
}: {
  delta: Delta;
  goodWhen?: "up" | "down" | "neither";
  className?: string;
}) {
  const up = delta.cents > 0;
  const flat = delta.cents === 0;
  const good = goodWhen === "neither" ? null : goodWhen === "up" ? up : !up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const label =
    delta.percent === undefined
      ? money(delta.cents, { sign: true, cents: false })
      : `${Math.abs(delta.percent * 100) < 0.05 ? "0" : (delta.percent * 100).toFixed(Math.abs(delta.percent) >= 0.1 ? 0 : 1)}%`;
  return (
    <span
      title={money(delta.cents, { sign: true })}
      className={cn(
        "tnum inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-caption font-semibold",
        flat || good === null
          ? "bg-surface-3 text-fg-muted"
          : good
            ? "bg-ok-soft text-ok"
            : "bg-danger-soft text-danger",
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {label}
    </span>
  );
}

/** A figure, its label, and optionally how it moved. */
export function StatTile({
  label,
  value,
  hint,
  delta,
  goodWhen,
  href,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  delta?: Delta;
  goodWhen?: "up" | "down" | "neither";
  href?: string;
  tone?: "ok" | "warn" | "danger";
  /**
   * Kept so callers still compile. The hairline it drew went on 2026-09-24
   * with the one on `Stat`: six coloured lines read as decoration.
   */
  accent?: "blue" | "teal" | "amber" | "coral" | "violet";
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-footnote font-semibold text-fg-muted">{label}</p>
        {delta ? <DeltaChip delta={delta} goodWhen={goodWhen} /> : null}
      </div>
      <p
        className={cn(
          "tnum mt-2 text-title2 font-semibold leading-none tracking-[-0.03em]",
          tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-fg",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 truncate text-footnote leading-snug text-fg-muted">{hint}</p> : null}
    </>
  );
  const styles = cn(
    "relative block overflow-hidden rounded-card border border-border bg-surface p-4 shadow-card",
    href && "press hover:border-border-2 hover:bg-surface-2",
    className,
  );
  return href ? (
    <Link href={href} className={styles}>
      {body}
    </Link>
  ) : (
    <div className={styles}>{body}</div>
  );
}

/* -------------------------------------------------------------- segmented */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * The primitive segmented control with the finance screens' prop names, so
 * the period picker and the year control look like every other one. Taller
 * under a finger: 28px was under any touch guideline for a thing tapped
 * every visit.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Unused since the primitive took over; one size now. */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <SegmentedControl
      label={ariaLabel}
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o.value, label: o.label }))}
      className={cn("pointer-coarse:[&>button]:h-9", className)}
    />
  );
}

/* ----------------------------------------------------------------- select */

/** A quiet select. Label goes to assistive tech; the value speaks for itself. */
export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}) {
  return (
    <Select
      size="sm"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn("max-w-full pointer-coarse:[&>select]:h-9", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Which year: a segmented control while there are few enough to sit in a
 * row, a select once there are not. The current year is named as such.
 */
export function YearControl({
  years,
  value,
  onChange,
  thisYear,
  ariaLabel = "Year",
}: {
  years: number[];
  value: number;
  onChange: (year: number) => void;
  thisYear: number;
  ariaLabel?: string;
}) {
  const ordered = [...years].sort((a, b) => a - b);
  const label = (y: number) => (y === thisYear ? "This year" : String(y));
  if (ordered.length <= 4) {
    return (
      <Segmented
        ariaLabel={ariaLabel}
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={ordered.map((y) => ({ value: String(y), label: label(y) }))}
      />
    );
  }
  return (
    <SelectField
      label={ariaLabel}
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      options={ordered.map((y) => ({ value: String(y), label: label(y) }))}
    />
  );
}

/* ----------------------------------------------------------------- period */

const PRESETS: PeriodPreset[] = ["this-month", "last-month", "this-year", "last-year", "custom"];

/**
 * The period a treasurer means: the presets they reach for, and a pair of
 * dates for the once a year they need something else.
 */
export function PeriodPicker({
  preset,
  onPreset,
  range,
  onRange,
}: {
  preset: PeriodPreset;
  onPreset: (preset: PeriodPreset) => void;
  range: { from: string; to: string };
  onRange: (range: { from: string; to: string }) => void;
}) {
  const field =
    "tnum h-8 rounded-lg border border-border-2 bg-surface px-2 text-footnote text-fg outline-none focus:border-brand";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        ariaLabel="Period"
        value={preset}
        onChange={onPreset}
        options={PRESETS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
      />
      {preset === "custom" ? (
        <span className="inline-flex items-center gap-1.5">
          <input
            type="date"
            aria-label="From"
            value={range.from}
            max={range.to}
            onChange={(e) => onRange({ ...range, from: e.target.value })}
            className={field}
          />
          <span className="text-footnote text-fg-subtle">to</span>
          <input
            type="date"
            aria-label="To"
            value={range.to}
            min={range.from}
            onChange={(e) => onRange({ ...range, to: e.target.value })}
            className={field}
          />
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- bars */

/** A bar the width of one value against the largest in its set. */
export function InlineBar({
  value,
  max,
  colorClass = "bg-chart-1",
  className,
}: {
  value: number;
  max: number;
  colorClass?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <span
      aria-hidden
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <span
        className={cn("block h-full rounded-full transition-[width] duration-[640ms] ease-[cubic-bezier(0.16,1,0.3,1)]", colorClass)}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------- link */

/** "See all" in the corner of a card, pointing at the page that has it. */
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 text-footnote font-semibold text-accent hover:underline"
    >
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  );
}
