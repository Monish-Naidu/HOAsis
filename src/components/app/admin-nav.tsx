"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BookOpen,
  FileText,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  MessageSquareText,
  ScaleIcon,
  Settings,
  Truck,
  Users,
  Vote,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
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
  { href: "/admin/legend", label: "Legend", icon: BookOpen, key: "legend" },
];

export function AdminNav({ badges }: { badges: Partial<Record<string, NavBadge>> }) {
  const pathname = usePathname();
  const { can } = useAppState();
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
