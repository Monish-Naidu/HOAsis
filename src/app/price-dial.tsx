"use client";

import { useId, useState } from "react";
import { MANAGEMENT_RANGE_PER_HOME, monthlyFor, PRICE_EXAMPLES, TRIAL_DAYS } from "@/lib/pricing";
import { money } from "@/lib/utils";

/**
 * The front page's price, for the visitor's own size.
 *
 * A flat "$4.00 per home" leaves the board to do the sum, and the sum is the
 * thing they came for. One slider, one total, and the management range at the
 * same size beside it. The arithmetic is `monthlyFor`, the same function the
 * pricing page and the bill use, so the three cannot disagree.
 */

const MIN_HOMES = 4;
const MAX_HOMES = 400;
const DEFAULT_HOMES = PRICE_EXAMPLES.find((e) => e.highlight)?.homes ?? 88;

const whole = (cents: number) => money(cents, { cents: false });

export function PriceDial() {
  const [homes, setHomes] = useState(DEFAULT_HOMES);
  const id = useId();
  const filled = ((homes - MIN_HOMES) / (MAX_HOMES - MIN_HOMES)) * 100;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-7">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[17px] font-semibold text-fg">
          How many homes?
        </label>
        <output htmlFor={id} className="tnum text-[17px] font-semibold text-fg">
          {homes === MAX_HOMES ? `${MAX_HOMES}+` : homes}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_HOMES}
        max={MAX_HOMES}
        step={1}
        value={homes}
        onChange={(event) => setHomes(Number(event.target.value))}
        className="price-dial mt-4 w-full"
        style={{ "--filled": `${filled}%` } as React.CSSProperties}
      />
      <p className="mt-6 flex flex-wrap items-baseline gap-x-2.5">
        <span className="tnum text-[48px] font-semibold leading-none tracking-[-0.04em] text-fg">
          {whole(monthlyFor(homes))}
        </span>
        <span className="text-[17px] font-medium text-fg-muted">a month, everything included</span>
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
        Free for the first {TRIAL_DAYS} days. Full-service management is published at{" "}
        {whole(MANAGEMENT_RANGE_PER_HOME.low)} to {whole(MANAGEMENT_RANGE_PER_HOME.high)} a home:{" "}
        <span className="tnum font-semibold text-fg">
          {whole(MANAGEMENT_RANGE_PER_HOME.low * homes)} to{" "}
          {whole(MANAGEMENT_RANGE_PER_HOME.high * homes)}
        </span>{" "}
        a month at this size.
      </p>
    </div>
  );
}
