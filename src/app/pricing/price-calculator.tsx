"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import {
  annualFor,
  MANAGEMENT_RANGE_PER_HOME,
  monthlyFor,
  PRICE_EXAMPLES,
  PRICE_PER_HOME_CENTS,
  PRICE_PER_TRANSACTION_CENTS,
  TRIAL_DAYS,
} from "@/lib/pricing";
import { cn, money } from "@/lib/utils";

/**
 * One rate, one dial.
 *
 * There are no tiers to lay out side by side, so the thing a board wants is
 * the arithmetic done for their own size. The stepper drives the software
 * bill and the management comparison from one number, so the two can never
 * disagree, and the worked examples underneath are shortcuts into the same
 * dial rather than a second table.
 */

const DEFAULT_HOMES = PRICE_EXAMPLES.find((e) => e.highlight)?.homes ?? 88;
const MIN_HOMES = 4;
const MAX_HOMES = 2_000;

/** Short, bold keyword first. The list has to be scannable, not read. */
const INCLUDED: { lead: string; rest: string }[] = [
  { lead: "Every feature", rest: "at every size" },
  { lead: "Unlimited", rest: "board members and residents" },
  { lead: "Accounting", rest: "with bank matching and reserves" },
  { lead: "Resident site", rest: "and mobile app" },
  { lead: "Voting, meetings", rest: "and video with dial-in" },
  { lead: "Documents", rest: "and the public records page" },
  { lead: "Compliance register", rest: "for your state" },
  { lead: "Live support", rest: "from the people who built it" },
];

function clamp(n: number) {
  if (!Number.isFinite(n)) return MIN_HOMES;
  return Math.min(MAX_HOMES, Math.max(MIN_HOMES, Math.round(n)));
}

export function PriceCalculator() {
  const [homes, setHomes] = useState(DEFAULT_HOMES);
  const [draft, setDraft] = useState(String(DEFAULT_HOMES));

  function commit(next: number) {
    const n = clamp(next);
    setHomes(n);
    setDraft(String(n));
  }

  const monthly = monthlyFor(homes);
  const annual = annualFor(homes);
  const managedLow = MANAGEMENT_RANGE_PER_HOME.low * homes * 12;
  const managedHigh = MANAGEMENT_RANGE_PER_HOME.high * homes * 12;

  return (
    <div className="rounded-[1.5rem] border border-border bg-hero-field p-3 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-5">
        {/* The plan card: a navy band, the rate, the button. */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-float">
          <div className="flex items-center justify-between gap-3 bg-navy-900 px-6 py-3 text-navy-50 dark:bg-navy-800">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em]">One plan</p>
            <p className="text-[13px] font-medium text-navy-200">
              {TRIAL_DAYS} days free, no card
            </p>
          </div>
          <div className="px-6 pb-6 pt-5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="tnum text-[56px] font-semibold leading-none tracking-[-0.04em] text-fg">
                {money(PRICE_PER_HOME_CENTS, { cents: false })}
              </p>
              <p className="text-[17px] font-medium text-fg-muted">per home, per month</p>
            </div>
            <p className="mt-2 text-[15px] text-fg-muted">
              Plus {money(PRICE_PER_TRANSACTION_CENTS, { cents: false })} per payment, any rail.
              No setup fee. Cancel whenever.
            </p>

            {/* The dial. */}
            <div className="mt-6 rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label htmlFor="homes" className="text-[15px] font-semibold text-fg">
                  Homes in your association
                </label>
                <div className="inline-flex items-center rounded-lg border border-border-2 bg-surface">
                  <button
                    type="button"
                    aria-label="Fewer homes"
                    onClick={() => commit(homes - (homes > 50 ? 10 : 1))}
                    className="flex size-10 items-center justify-center text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <Minus className="size-4" strokeWidth={2.4} />
                  </button>
                  <input
                    id="homes"
                    inputMode="numeric"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
                    onBlur={() => commit(Number(draft))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit(Number(draft));
                    }}
                    className="tnum h-10 w-16 border-x border-border-2 bg-transparent text-center text-[17px] font-semibold text-fg outline-none"
                  />
                  <button
                    type="button"
                    aria-label="More homes"
                    onClick={() => commit(homes + (homes >= 50 ? 10 : 1))}
                    className="flex size-10 items-center justify-center text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <Plus className="size-4" strokeWidth={2.4} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRICE_EXAMPLES.map((example) => (
                  <button
                    key={example.homes}
                    type="button"
                    onClick={() => commit(example.homes)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors",
                      homes === example.homes
                        ? "border-royal bg-royal text-royal-fg"
                        : "border-border-2 bg-surface text-fg-muted hover:text-fg",
                    )}
                  >
                    {example.homes} homes
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                    A month
                  </p>
                  <p className="tnum mt-0.5 text-[26px] font-semibold leading-none tracking-[-0.03em] text-fg">
                    {money(monthly, { cents: false })}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                    A year
                  </p>
                  <p className="tnum mt-0.5 text-[26px] font-semibold leading-none tracking-[-0.03em] text-fg">
                    {money(annual, { cents: false })}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/start"
              className="group mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-royal text-[16px] font-semibold text-royal-fg shadow-raised transition-all hover:-translate-y-0.5 hover:bg-royal-hover hover:shadow-float"
            >
              Start free for {TRIAL_DAYS} days
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* What comes with it, and what it saves. */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Included, always
            </p>
            <ul className="mt-3 space-y-2.5">
              {INCLUDED.map((item) => (
                <li key={item.lead} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.6} />
                  <span className="text-[15px] leading-snug text-fg-muted">
                    <span className="font-semibold text-fg">{item.lead}</span> {item.rest}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Computed from the same dial, so it cannot disagree with the price. */}
          <div className="rounded-2xl border border-ok/25 bg-ok-soft p-6 text-ok">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] opacity-80">
              Next to a management company
            </p>
            <p className="tnum mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em]">
              {money(managedLow - annual, { cents: false })} to{" "}
              {money(managedHigh - annual, { cents: false })}
            </p>
            <p className="mt-1.5 text-[14px] leading-snug opacity-90">
              kept in your accounts each year, at {homes} homes. Full service management is
              published at {money(MANAGEMENT_RANGE_PER_HOME.low, { cents: false })} to{" "}
              {money(MANAGEMENT_RANGE_PER_HOME.high, { cents: false })} a door.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
