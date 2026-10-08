"use client";

import { useState } from "react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import {
  annualFor,
  MANAGEMENT_RANGE_PER_HOME,
  monthlyFor,
  PRICE_EXAMPLES,
  PRICE_PER_HOME_CENTS,
  TRIAL_DAYS,
} from "@/lib/pricing";
import { Badge, ButtonLink } from "@/components/ui/primitives";
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

/**
 * Short, bold keyword first. The list has to be scannable, not read. Only
 * what a new association gets today: no native app, and no compliance
 * register while that module is switched off.
 */
const INCLUDED: { lead: string; rest: string }[] = [
  { lead: "Every feature", rest: "at every size" },
  { lead: "Unlimited", rest: "board members and residents" },
  { lead: "Accounting", rest: "for dues, expenses and reserves" },
  { lead: "Resident site", rest: "that works on any phone" },
  { lead: "Voting and meetings", rest: "with agendas and a call-in link" },
  { lead: "Documents", rest: "every owner can open" },
  { lead: "Board guides", rest: "for your state's rules" },
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
    <div className="relative isolate">
      {/* The stage: a soft aurora under the two cards, dissolved at its
          edges, rather than a bordered panel around them. */}
      <div
        className="pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10 bg-aurora [mask-image:radial-gradient(closest-side,black_55%,transparent)]"
        aria-hidden
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-5">
        {/* The plan card: the rate, the dial, the button. No coloured band
            across the top: a card never has a coloured header, and the
            price is the colour this card needs. */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-float">
          <div className="flex h-full flex-col p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="blue">One plan</Badge>
              <Badge tone="ok">{TRIAL_DAYS} days free, no card</Badge>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="tnum text-[56px] font-semibold leading-none tracking-[-0.04em] text-fg">
                {money(PRICE_PER_HOME_CENTS, { cents: false })}
              </p>
              <p className="text-[17px] font-medium text-fg-muted">per home, per month</p>
            </div>
            <p className="mt-2 text-[15px] text-fg-muted">
              No setup fee, no add-ons. Cancel whenever.
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
                    className="press flex size-10 items-center justify-center text-fg-muted hover:bg-surface-2 hover:text-fg"
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
                    className="press flex size-10 items-center justify-center text-fg-muted hover:bg-surface-2 hover:text-fg"
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
                      "press rounded-full border px-3 py-1 text-[13px] font-semibold",
                      homes === example.homes
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border-2 bg-surface text-fg-muted hover:border-fg-subtle hover:text-fg",
                    )}
                  >
                    {example.homes} homes
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[14px] font-medium text-fg-muted">
                    A month
                  </p>
                  <p key={monthly} className="tnum pop-in mt-0.5 text-[26px] font-semibold leading-none tracking-[-0.03em] text-fg">
                    {money(monthly, { cents: false })}
                  </p>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-fg-muted">
                    A year
                  </p>
                  <p key={annual} className="tnum pop-in mt-0.5 text-[26px] font-semibold leading-none tracking-[-0.03em] text-fg">
                    {money(annual, { cents: false })}
                  </p>
                </div>
              </div>
            </div>

            {/* The columns finish level, so any height the right column has
                over this one lands as air above the button, not in a box. */}
            <div className="mt-auto pt-5">
              <ButtonLink href="/start" variant="hero" size="xl" className="group w-full">
                Start free for {TRIAL_DAYS} days
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </ButtonLink>
            </div>
          </div>
        </div>

        {/* What comes with it, and what it saves. */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <p className="text-[15px] font-semibold text-fg">Included, always</p>
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
          <div className="rounded-2xl border border-tint-teal/25 bg-tint-teal-soft p-6 text-tint-teal-fg">
            <p className="text-[15px] font-semibold">Next to a management company</p>
            <p key={homes} className="tnum pop-in mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em]">
              {money(managedLow - annual, { cents: false })} to{" "}
              {money(managedHigh - annual, { cents: false })}
            </p>
            <p className="mt-1.5 text-[14px] leading-snug opacity-90">
              kept in your accounts each year, at {homes} homes. Full service management is
              published at {money(MANAGEMENT_RANGE_PER_HOME.low, { cents: false })} to{" "}
              {money(MANAGEMENT_RANGE_PER_HOME.high, { cents: false })} a home.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
