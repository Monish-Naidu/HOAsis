"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  FileText,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  ScaleIcon,
  Vote,
  Truck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavBadge {
  count: number;
  tone: "danger" | "warn" | "neutral";
}

const items = [
  { href: "/board", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/board/money", label: "Money", icon: Banknote, key: "money" },
  { href: "/board/homeowners", label: "Homeowners", icon: Users, key: "homeowners" },
  { href: "/board/requests", label: "Requests", icon: Inbox, key: "requests" },
  { href: "/board/voting", label: "Voting", icon: Vote, key: "voting" },
  { href: "/board/compliance", label: "Compliance", icon: ScaleIcon, key: "compliance" },
  {
    href: "/board/communications",
    label: "Communications",
    icon: MessagesSquare,
    key: "communications",
  },
  { href: "/board/vendors", label: "Vendors", icon: Truck, key: "vendors" },
  { href: "/board/documents", label: "Documents", icon: FileText, key: "documents" },
] as const;

export function BoardNav({ badges }: { badges: Partial<Record<string, NavBadge>> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Board sections" className="flex gap-1 lg:flex-col">
      {items.map(({ href, label, icon: Icon, key }) => {
        const active = href === "/board" ? pathname === href : pathname.startsWith(href);
        const badge = badges[key];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
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
                  "tnum ml-auto hidden rounded px-1.5 py-0.5 text-[10px] font-bold lg:inline-block",
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
