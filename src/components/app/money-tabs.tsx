"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/app-state";
import { TabPill } from "@/components/app/tab-pill";
import { cn } from "@/lib/utils";

/**
 * The three money questions, as one place.
 *
 * Money and Reserves were separate tabs, and the distinction was ours rather
 * than theirs: everything on both is money. What actually separates them is
 * the horizon, so the labels say the horizon. "Next 30 years" also teaches the
 * thing nobody else in this category does, which is worth more sitting in the
 * open than buried behind a word like "Reserves".
 *
 * Shared costs only appears for an association that has any, so a board
 * billing one flat due still sees two tabs and no explaining.
 */
const VIEWS = [
  {
    href: "/admin/money",
    label: "This month",
    detail: "Cash, and anything waiting on you",
  },
  {
    href: "/admin/reserves",
    label: "Next 30 years",
    detail: "What has to be replaced, and whether you can afford it",
  },
] as const;

export function MoneyTabs() {
  const pathname = usePathname();
  const { community } = useAppState();

  const views = [
    ...VIEWS,
    ...(community.sharedCosts.length > 0 || community.specialAssessments.length > 0
      ? [
          {
            href: "/admin/shared-costs",
            label: "Shared costs",
            detail: "Bills the association passes on",
          } as const,
        ]
      : []),
  ];

  const active = views.find((v) => pathname === v.href) ?? views[0];

  return (
    <div className="mb-6">
      <TabPill
        activeKey={active.href}
        className="inline-flex gap-1 rounded-xl bg-surface-2 p-1"
        pillClassName="bg-surface shadow-card rounded-lg"
      >
        {views.map((view) => (
          <Link
            key={view.href}
            href={view.href}
            data-tab-key={view.href}
            aria-current={pathname === view.href ? "page" : undefined}
            className={cn(
              "relative z-10 rounded-lg px-4 py-2 text-[15px] font-medium transition-colors duration-200",
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
