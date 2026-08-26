"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useAppState,
  usePendingApprovals,
  useReconciliation,
  useUnreadThreadCount,
  useVendorGaps,
} from "@/lib/app-state";
import { ADMIN_ROUTES } from "@/lib/admin-routes";
import { complianceSummary, delinquency } from "@/lib/metrics";
import { TabPill } from "@/components/app/tab-pill";
import { cn } from "@/lib/utils";

export interface NavBadge {
  count: number;
  tone: "danger" | "warn" | "neutral";
}

const items = ADMIN_ROUTES;

/**
 * Counts live next to each section.
 *
 * Computed here rather than passed down from the layout, because the layout is
 * a server component and these numbers change as the board works. A badge that
 * only updates on a full reload is worse than no badge.
 */
export function AdminNav() {
  const pathname = usePathname();
  const { can, community, requests } = useAppState();
  const recon = useReconciliation();
  const gaps = useVendorGaps();
  const approvals = usePendingApprovals();
  const unread = useUnreadThreadCount();
  const comp = complianceSummary(community);
  const delinq = delinquency(community);

  /**
   * A badge means somebody owes a decision here, and nothing else.
   *
   * It used to mean "there are things on this tab", which put a number beside
   * seven of twelve and turned the whole row into wallpaper. An open ballot is
   * not board work, it is resident work; a missing reserve study is a standing
   * condition, not a queue. Both said so every day and neither was ever acted
   * on because of the badge.
   */
  const badges: Partial<Record<string, NavBadge>> = {
    money: { count: recon.needsReview.length, tone: "warn" },
    requests: {
      count: requests.filter(
        (r) => !["approved", "denied", "closed"].includes(r.status),
      ).length,
      tone: "neutral",
    },
    compliance: { count: comp.overdue.length, tone: "danger" },
    communications: { count: unread, tone: "neutral" },
    homeowners: { count: delinq.past.length, tone: "warn" },
    vendors: {
      count: gaps.missingW9.length + gaps.expiringCoi.length + approvals.length,
      tone: "warn",
    },
  };

  // Three separate questions: may they open it, is there anything on it, and
  // does it deserve its own line rather than living inside another tab.
  const visible = items.filter(
    (i) =>
      !i.hidden &&
      (!i.need || i.need.some((c) => can(c))) &&
      (!i.present || i.present(community)),
  );

  const activeRoute = visible.find(({ href }) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href),
  );

  return (
    <nav aria-label="Admin sections">
      <TabPill
        activeKey={activeRoute?.key ?? ""}
        className="flex gap-1 lg:flex-col"
        pillClassName="bg-brand-soft"
      >
      {visible.map(({ href, label, icon: Icon, key }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        const badge = badges[key];
        return (
          <Link
            key={href}
            href={href}
            data-tab-key={key}
            aria-current={active ? "page" : undefined}
            className={cn(
              // The selected background is the travelling pill behind the row,
              // not a class on the link, so it slides rather than cuts.
              "group relative z-10 flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors duration-200",
              active
                ? "text-brand-soft-fg"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="size-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
            <span className="truncate">{label}</span>
            {badge && badge.count > 0 ? (
              <span
                className={cn(
                  "tnum ml-auto hidden rounded px-1.5 py-0.5 text-[12px] font-bold lg:inline-block",
                  badge.tone === "danger" && "bg-danger-soft text-danger",
                  badge.tone === "warn" && "bg-warn-soft text-warn",
                  badge.tone === "neutral" && "bg-surface-3 text-fg-muted",
                )}
              >
                {badge.count}
              </span>
            ) : null}
          </Link>
        );
      })}
      </TabPill>
    </nav>
  );
}
