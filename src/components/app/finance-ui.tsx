"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { Button, Segmented as SegmentedControl, Select } from "@/components/ui/primitives";
import {
  periodRange,
  periodWords,
  presetMenuLabel,
  rangeWords,
  stepPeriod,
  type Delta,
  type PeriodPreset,
} from "@/lib/metrics";
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
      {hint ? <p className="mt-1.5 text-footnote leading-snug text-fg-muted">{hint}</p> : null}
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
 * the year control look like every other one. Taller
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

/* ----------------------------------------------------------------- period */

const MENU_PRESETS: PeriodPreset[] = ["this-month", "last-month", "last-30-days", "this-year", "last-year", "last-12-months"];

/**
 * One button for the period, in words and dates: "Last 30 days · Sep 7 to
 * Oct 7, 2026". The dates are always there, so nobody has to know what a
 * preset means. It opens a short menu; arrows beside it step a month or a
 * year back and forward when the period is one.
 *
 * Replaces a row of seven chips whose "This year", "Last year" and "Last 12
 * months" overlapped. The parent owns the value (see `usePeriod`), so the
 * Overview and Transactions share one control and one set of URL params.
 */
export function PeriodControl({
  value,
  onChange,
  presets = [...MENU_PRESETS, "custom"],
  asOf,
  fyMonth = 1,
  className,
}: {
  value: { preset: PeriodPreset; from: string; to: string };
  onChange: (next: { preset: PeriodPreset; from: string; to: string }) => void;
  /** The presets to offer, for a screen with some the others do not need. */
  presets?: readonly PeriodPreset[];
  asOf: string;
  fyMonth?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [customPicked, setCustomPicked] = useState(false);
  const [draft, setDraft] = useState({ from: value.from, to: value.to });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const words = periodWords(value.preset, value, fyMonth);
  const back = stepPeriod(value.preset, value, -1, asOf, fyMonth);
  const forward = stepPeriod(value.preset, value, 1, asOf, fyMonth);
  const draftOk = draft.from !== "" && draft.to !== "" && draft.from <= draft.to;

  function show() {
    setDraft({ from: value.from, to: value.to });
    setCustomPicked(value.preset === "custom");
    setOpen(true);
  }

  // Custom dates are applied when the menu closes, so a half-typed range is
  // never searched while it is still wrong.
  const applyAndClose = useCallback(() => {
    if (customPicked && draftOk && (value.preset !== "custom" || draft.from !== value.from || draft.to !== value.to)) {
      onChange({ preset: "custom", from: draft.from, to: draft.to });
    }
    setOpen(false);
  }, [customPicked, draftOk, draft, value, onChange]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) applyAndClose();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, applyAndClose]);

  const arrow =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-2 bg-surface text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-11";
  const field =
    "tnum h-9 w-full min-w-0 rounded-lg border border-border-2 bg-surface px-2 text-footnote text-fg outline-none focus:border-brand";

  return (
    <div
      ref={root}
      className={cn("relative flex max-w-full items-center gap-1.5", className)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        type="button"
        aria-label="Previous period"
        disabled={!back}
        onClick={() => back && onChange(back)}
        className={arrow}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => (open ? applyAndClose() : show())}
        className="flex min-h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-border-2 bg-surface px-3 py-1 text-left text-footnote transition-colors hover:border-fg-subtle pointer-coarse:min-h-11"
      >
        {/* Stacked on a phone so the button and both arrows keep one line. */}
        <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
          <span className="font-semibold text-fg">{words.label}</span>
          <span aria-hidden className="hidden text-fg-subtle sm:inline">
            ·
          </span>
          <span className="tnum text-fg-muted">{words.dates}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle transition-transform", open && "rotate-180")} />
      </button>
      <button
        type="button"
        aria-label="Next period"
        disabled={!forward}
        onClick={() => forward && onChange(forward)}
        className={arrow}
      >
        <ChevronRight className="size-4" />
      </button>

      {open ? (
        <div
          role="group"
          aria-label="Choose a period"
          className="absolute left-0 top-full z-30 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-1.5 shadow-float"
        >
          <ul>
            {presets
              .filter((p) => p !== "custom")
              .map((p) => {
                const r = periodRange(p, asOf, fyMonth);
                const current = value.preset === p;
                return (
                  <li key={p}>
                    <button
                      type="button"
                      aria-pressed={current}
                      onClick={() => {
                        setOpen(false);
                        if (!current) onChange({ preset: p, ...r });
                        trigger.current?.focus();
                      }}
                      className={cn(
                        "flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-footnote transition-colors hover:bg-surface-2 pointer-coarse:py-3",
                        current ? "bg-surface-3 font-semibold text-fg" : "text-fg",
                      )}
                    >
                      {presetMenuLabel(p, fyMonth)}
                      <span className="tnum text-caption font-normal text-fg-muted">{rangeWords(r.from, r.to)}</span>
                    </button>
                  </li>
                );
              })}
            {presets.includes("custom") ? (
              <li>
                <button
                  type="button"
                  aria-pressed={customPicked}
                  onClick={() => setCustomPicked(true)}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-footnote transition-colors hover:bg-surface-2 pointer-coarse:py-3",
                    customPicked ? "bg-surface-3 font-semibold text-fg" : "text-fg",
                  )}
                >
                  Custom
                  <span className="text-caption font-normal text-fg-muted">Pick two dates</span>
                </button>
              </li>
            ) : null}
          </ul>
          {customPicked ? (
            <div className="mt-1 border-t border-border px-3 pb-2 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-caption text-fg-muted">
                  From
                  <input
                    type="date"
                    aria-label="From"
                    value={draft.from}
                    max={draft.to || undefined}
                    onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                    className={cn(field, "mt-1")}
                  />
                </label>
                <label className="block text-caption text-fg-muted">
                  To
                  <input
                    type="date"
                    aria-label="To"
                    value={draft.to}
                    min={draft.from || undefined}
                    onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                    className={cn(field, "mt-1")}
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="primary" disabled={!draftOk} onClick={applyAndClose}>
                  Apply
                </Button>
              </div>
            </div>
          ) : null}
        </div>
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
