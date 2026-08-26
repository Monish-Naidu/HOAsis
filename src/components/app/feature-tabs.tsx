"use client";

import { useState } from "react";
import {
  Banknote,
  Check,
  MessagesSquare,
  ScaleIcon,
  Smartphone,
  Truck,
  Vote,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabStat {
  label: string;
  value: string;
}

const icons = {
  money: Banknote,
  residents: Smartphone,
  voting: Vote,
  vendors: Truck,
  comms: MessagesSquare,
  compliance: ScaleIcon,
} as const;

type TabKey = keyof typeof icons;

const tabs: { key: TabKey; label: string; points: string[] }[] = [
  {
    key: "money",
    label: "Money",
    points: [
      "Live bank feeds, not a daily batch",
      "Duplicate detection before it hits a report",
      "Reserve balance, yield, and interest earned",
      "Budget against actual, paced to the year",
      "Saved views that survive a reload",
    ],
  },
  {
    key: "residents",
    label: "Residents",
    points: [
      "A real website and a phone app, same screens",
      "Dues priced at processor cost, quoted up front",
      "Every payment shows which charges it cleared",
      "Association funds and transactions, open to owners",
    ],
  },
  {
    key: "voting",
    label: "Voting",
    points: [
      "Ballots that hold paragraphs, not one block",
      "Live tallies and quorum without opening each one",
      "Video and dial-in, so votes happen on the call",
      "Receipts for owners, a tally that reconciles to them",
    ],
  },
  {
    key: "vendors",
    label: "Vendors",
    points: [
      "ACH by default, checks as the exception",
      "Two signatures over a threshold",
      "W-9 and insurance tracked with the vendor",
    ],
  },
  {
    key: "comms",
    label: "Communications",
    points: [
      "Threads, with replies filed to the owner record",
      "CC, formatting, and drafts that save",
      "Delivery logs that prove notice went out",
    ],
  },
  {
    key: "compliance",
    label: "Compliance",
    points: [
      "Obligations with a date, an owner, and evidence",
      "Records and response clocks that escalate early",
      "A reserve study on a schedule, tied to the budget",
    ],
  },
];

export function FeatureTabs({ stats }: { stats: Record<string, TabStat[]> }) {
  const [active, setActive] = useState<TabKey>("money");
  const current = tabs.find((t) => t.key === active)!;
  const Icon = icons[active];

  return (
    <div>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            aria-pressed={active === t.key}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[15px] font-medium transition-colors",
              active === t.key
                ? "bg-navy-900 text-navy-50 dark:bg-navy-100 dark:text-navy-950"
                : "border border-border bg-surface text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 rounded-card border border-border bg-surface p-6 shadow-card md:grid-cols-5">
        <div className="md:col-span-3">
          <span className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-fg">
            <Icon className="size-5" strokeWidth={1.9} />
          </span>
          <ul className="space-y-2.5">
            {current.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                <span className="text-[15px] leading-snug text-fg">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-5 md:col-span-2 md:grid-cols-1 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          {(stats[active] ?? []).map((s) => (
            <div key={s.label}>
              <dt className="text-[13px] font-semibold text-fg-muted">
                {s.label}
              </dt>
              <dd className="tnum mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em] text-fg">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
