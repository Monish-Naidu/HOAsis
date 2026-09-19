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
import { BOARD_ROUTES, routeOn } from "@/lib/board-routes";
import { complianceSummary, delinquency } from "@/lib/metrics";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";
import { TabPill } from "@/components/app/tab-pill";
import { cn } from "@/lib/utils";

export interface NavBadge {
  count: number;
  tone: "danger" | "warn" | "neutral";
}

const items = BOARD_ROUTES;

/**
 * Counts live next to each section.
 *
 * Computed here rather than passed down from the layout, because the layout is
 * a server component and these numbers change as the board works. A badge that
 * only updates on a full reload is worse than no badge.
 */
export function BoardNav({ variant = "bar" }: { variant?: "rail" | "bar" }) {
  const pathname = usePathname();
  const { can, community, requests } = useAppState();
  const recon = useReconciliation();
  const gaps = useVendorGaps();
  const approvals = usePendingApprovals();
  const unread = useUnreadThreadCount();
  const comp = complianceSummary(community);
  const delinq = delinquency(community);
  const plan = buildPlan(community, profileFromCommunity(community));

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
    // What is left, not what is done. A board setting up wants to know how
    // much further, and the row disappears entirely at zero.
    setup: { count: plan.total - plan.done, tone: "neutral" },
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
      routeOn(i) &&
      (!i.need || i.need.some((c) => can(c))) &&
      (!i.present || i.present(community)),
  );

  const activeRoute = visible.find(({ href }) =>
    href === "/board" ? pathname === href : pathname.startsWith(href),
  );

  /**
   * Two dressings for one nav.
   *
   * The rail is the navy sidebar from the 2026-09-01 dashboard design: a
   * deliberately fixed surface, like the device bezels, so its colors are the
   * navy ramp and a couple of literals rather than theme tokens. The bar is
   * the horizontal strip under the header on narrow screens, which sits on a
   * themed surface and keeps the themed styling.
   */
  const rail = variant === "rail";

  return (
    <nav aria-label="Board sections" className={cn(rail && "flex min-h-full w-full")}>
      <TabPill
        activeKey={activeRoute?.key ?? ""}
        className={cn(
          "flex gap-1 lg:flex-col",
          // A fixed rhythm in the sidebar. The rows used to share the leftover
          // height, which read fine with thirteen tabs and fell apart with a
          // treasurer's six spread over the whole column.
          rail && "w-full flex-col gap-1",
        )}
        pillClassName={
          rail
            ? "bg-brand-gradient rounded-2xl shadow-[0_8px_20px_-8px_rgb(77_139_245/0.7)]"
            : "bg-primary-soft rounded-xl"
        }
      >
      {visible.map(({ href, label, icon: Icon, key }) => {
        const active = href === "/board" ? pathname === href : pathname.startsWith(href);
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
              "group relative z-10 flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors duration-200",
              rail && "rounded-2xl px-3.5 py-2.5",
              rail
                ? active
                  ? "text-white"
                  : "text-navy-200 hover:bg-navy-800/70 hover:text-white"
                : active
                  ? "text-primary"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon
              className={cn(
                "size-[17px] shrink-0 transition-transform duration-200",
                active && "scale-110",
                !active && "group-hover:-translate-y-px",
              )}
              strokeWidth={active ? 2.2 : 1.8}
            />
            <span className="truncate">{label}</span>
            {badge && badge.count > 0 ? (
              <span
                className={cn(
                  "tnum ml-auto hidden rounded px-1.5 py-0.5 text-[12px] font-bold lg:inline-block",
                  rail
                    ? cn(
                        "bg-navy-800",
                        // Fixed accents for the fixed surface. The dark theme's
                        // warn and danger read on navy; the light theme's sink.
                        badge.tone === "danger" && "text-[#e2837a]",
                        badge.tone === "warn" && "text-[#dfa845]",
                        badge.tone === "neutral" && "text-navy-200",
                      )
                    : cn(
                        badge.tone === "danger" && "bg-danger-soft text-danger",
                        badge.tone === "warn" && "bg-warn-soft text-warn",
                        badge.tone === "neutral" && "bg-surface-3 text-fg-muted",
                      ),
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
