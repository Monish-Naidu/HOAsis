"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  FileText,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  PiggyBank,
  MessageSquareText,
  ScaleIcon,
  Settings,
  Truck,
  Users,
  Vote,
} from "lucide-react";
import {
  useAppState,
  usePendingApprovals,
  useReconciliation,
  useUnreadThreadCount,
  useVendorGaps,
} from "@/lib/app-state";
import { complianceSummary, delinquency } from "@/lib/metrics";
import type { Capability } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface NavBadge {
  count: number;
  tone: "danger" | "warn" | "neutral";
}

const items: {
  href: string;
  label: string;
  icon: typeof Banknote;
  key: string;
  need?: Capability;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/admin/money", label: "Money", icon: Banknote, key: "money", need: "finances" },
  {
    href: "/admin/reserves",
    label: "Reserves",
    icon: PiggyBank,
    key: "reserves",
    need: "finances",
  },
  { href: "/admin/homeowners", label: "Homeowners", icon: Users, key: "homeowners" },
  { href: "/admin/requests", label: "Requests", icon: Inbox, key: "requests", need: "requests" },
  { href: "/admin/voting", label: "Voting", icon: Vote, key: "voting", need: "voting" },
  {
    href: "/admin/compliance",
    label: "Compliance",
    icon: ScaleIcon,
    key: "compliance",
    need: "compliance",
  },
  {
    href: "/admin/communications",
    label: "Communications",
    icon: MessagesSquare,
    key: "communications",
    need: "communications",
  },
  { href: "/admin/forum", label: "Forum", icon: MessageSquareText, key: "forum", need: "forum" },
  { href: "/admin/vendors", label: "Vendors", icon: Truck, key: "vendors", need: "vendors" },
  {
    href: "/admin/documents",
    label: "Documents",
    icon: FileText,
    key: "documents",
    need: "documents",
  },
  { href: "/admin/settings", label: "Settings", icon: Settings, key: "settings", need: "settings" },
];

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

  const visible = items.filter((i) => !i.need || can(i.need));

  return (
    <nav aria-label="Admin sections" className="flex gap-1 lg:flex-col">
      {visible.map(({ href, label, icon: Icon, key }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        const badge = badges[key];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors",
              active
                ? "bg-brand-soft text-brand-soft-fg"
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
    </nav>
  );
}
