"use client";

/**
 * The board's section navigation, as a sidebar rail or a horizontal bar under `lg`.
 *
 * One definition (`BOARD_ROUTES`) feeds both shapes, and the badge counts are
 * computed here from live state so they move as the board works.
 */

import { openRequestCount } from "@/lib/request-status";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState, useReconciliation, useUnreadThreadCount } from "@/lib/app-state";
import { BOARD_ROUTES, routeOffered, sectionFor, sectionPages } from "@/lib/board-routes";
import { complianceSummary, delinquency, vendorDecisions } from "@/lib/metrics";
import { buildPlan, profileFromCommunity, setupCounts } from "@/lib/setup-plan";
import { TabPill } from "@/components/app/tab-pill";
import { RailNav, RailRow, type RailBadge } from "@/components/app/rail";
import { cn } from "@/lib/utils";

export type NavBadge = RailBadge;

const rows = BOARD_ROUTES.filter((route) => !route.hidden);

/**
 * Counts live next to each section.
 *
 * Computed here rather than passed down from the layout, because the layout is
 * a server component and these numbers change as the board works. A badge that
 * only updates on a full reload is worse than no badge.
 */
export function BoardNav({ variant = "bar" }: { variant?: "rail" | "bar" }) {
  const pathname = usePathname();
  const { sees, community, requests, dismissedSetupTasks } = useAppState();
  const recon = useReconciliation();
  const unread = useUnreadThreadCount();
  const comp = complianceSummary(community);
  const delinq = delinquency(community);
  const plan = buildPlan(community, profileFromCommunity(community), dismissedSetupTasks);

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
    setup: { count: setupCounts(plan).left, tone: "neutral", hint: "setup steps left" },
    money: { count: recon.needsReview.length, tone: "warn", hint: "transactions to confirm" },
    // Open requests only, from the one selector the Requests page groups by.
    // Notices have their own tab and do not count here.
    requests: {
      count: openRequestCount(requests),
      tone: "neutral",
      hint: "requests waiting on the board",
    },
    compliance: { count: comp.overdue.length, tone: "danger", hint: "overdue filings" },
    communications: { count: unread, tone: "neutral", hint: "unread conversations" },
    homeowners: { count: delinq.past.length, tone: "warn", hint: "homes past due" },
    // The same number as the dashboard and the Vendors page, from one selector.
    vendors: { count: vendorDecisions(community).count, tone: "warn", hint: "payments waiting on a signature" },
  };

  // Three separate questions, asked of every page in a row: may they open
  // it, is it switched on, and is there anything on it. A row stands if any
  // of its pages does, and opens the first one that does, so a seat that may
  // vote but not see meetings still finds Voting under Meetings.
  const visible = rows
    .map((row) => {
      const offered = sectionPages(row).filter((page) => routeOffered(page, sees, community, dismissedSetupTasks));
      return offered.length ? { ...row, href: offered[0].href } : null;
    })
    .filter((row) => row !== null);

  // By section, so Voting lights Meetings and Reserves lights Finances.
  const activeKey = sectionFor(pathname)?.key ?? "";
  const activeRoute = visible.find((row) => row.key === activeKey);

  /**
   * Two dressings for one nav.
   *
   * The rail is the navy sidebar from the 2026-09-01 dashboard design, drawn
   * by `RailNav` and `RailRow` so it is the same rail the resident shell has.
   * The bar is the horizontal strip under the header on narrow screens, which
   * sits on a themed surface and keeps the themed styling.
   */
  const rail = variant === "rail";

  // On a phone the bar scrolls sideways. Keep the open section in view, so
  // Settings, ninth in the row, is not lit somewhere off the right edge.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (rail) return;
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [rail, pathname]);

  if (rail) {
    return (
      <RailNav label="Board sections" activeKey={activeRoute?.key ?? ""}>
        {visible.map(({ href, label, icon, key, tint }) => (
          <RailRow
            key={href}
            href={href}
            tabKey={key}
            label={label}
            icon={icon}
            tint={tint}
            active={key === activeRoute?.key}
            badge={badges[key]}
          />
        ))}
      </RailNav>
    );
  }

  return (
    <nav ref={navRef} aria-label="Board sections">
      <TabPill activeKey={activeRoute?.key ?? ""} className="flex gap-1" pillClassName="bg-primary-soft rounded-xl">
        {visible.map(({ href, label, icon: Icon, key }) => {
          const active = key === activeRoute?.key;
          const badge = badges[key];
          return (
            <Link
              key={href}
              href={href}
              data-tab-key={key}
              aria-current={active ? "page" : undefined}
              // On a phone the strip scrolls, and the lit row for Vendors or
              // Settings sat off its right edge. Bring it into view.
              ref={
                active
                  ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" })
                  : undefined
              }
              className={cn(
                // The selected background is the travelling pill behind the row,
                // not a class on the link, so it slides rather than cuts.
                "group relative z-10 flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-callout font-medium transition-colors duration-200",
                active ? "text-primary" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
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
                    "tnum ml-auto hidden rounded px-1.5 py-0.5 text-caption font-bold lg:inline-block",
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
