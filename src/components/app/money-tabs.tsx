"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/app-state";
import { TabPill } from "@/components/app/tab-pill";
import { cn } from "@/lib/utils";
import { moduleOn } from "@/lib/modules";
import type { ModuleKey } from "@/lib/modules";

/**
 * The money questions, as one place.
 *
 * One segmented control across every finance view. Overview is the page a
 * treasurer opens on a Tuesday; Transactions, Budget, Trends and Collections
 * are the questions they came to answer; Reserves is the same money over a
 * longer horizon. Each view keeps its own route so a link lands on it.
 *
 * Shared costs only appears for an association that has any, so a board
 * billing one flat due never sees an empty tab.
 */
const VIEWS: { href: string; label: string; detail: string; module?: ModuleKey }[] = [
  { href: "/board/money", label: "Overview", detail: "Where the money stands today" },
  { href: "/board/money/transactions", label: "Transactions", detail: "Every line, filtered and exportable" },
  { href: "/board/money/budget", label: "Budget", detail: "Each line against the share of the year gone", module: "money-budget" },
  { href: "/board/money/trends", label: "Trends", detail: "One year beside another", module: "money-trends" },
  { href: "/board/money/collections", label: "Collections", detail: "Who is behind, and by how much" },
  { href: "/board/reserves", label: "Reserves", detail: "What wears out, when, and what is set aside", module: "reserves" },
];

export function MoneyTabs() {
  const pathname = usePathname();
  const { community } = useAppState();

  const views = [
    ...VIEWS,
    ...(moduleOn("shared-costs") &&
    (community.sharedCosts.length > 0 || community.specialAssessments.length > 0)
      ? [
          {
            href: "/board/shared-costs",
            label: "Shared costs",
            detail: "Bills the association passes on",
          },
        ]
      : []),
  ].filter((view) => moduleOn(view.module));

  const active = views.find((v) => pathname === v.href) ?? views[0];

  return (
    <div className="mb-6">
      <TabPill
        activeKey={active.href}
        className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1"
        pillClassName="bg-surface shadow-card rounded-lg"
      >
        {views.map((view) => (
          <Link
            key={view.href}
            href={view.href}
            data-tab-key={view.href}
            aria-current={pathname === view.href ? "page" : undefined}
            className={cn(
              "relative z-10 shrink-0 rounded-lg px-3.5 py-2 text-[15px] font-medium transition-colors duration-200",
              pathname === view.href ? "text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {view.label}
          </Link>
        ))}
      </TabPill>
      <p className="mt-2 text-[13px] text-fg-muted">{active.detail}</p>
    </div>
  );
}
