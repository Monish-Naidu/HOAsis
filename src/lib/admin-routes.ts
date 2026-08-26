import {
  Banknote,
  FileText,
  Inbox,
  LayoutDashboard,
  MessageSquareText,
  MessagesSquare,
  PiggyBank,
  Scale as ScaleIcon,
  Settings,
  Truck,
  Users,
  Vote,
} from "lucide-react";
import type { Capability } from "@/lib/types";

/**
 * Every board route, and what it takes to open one.
 *
 * One list, read by two things that must never disagree: the navigation, which
 * decides what to offer, and the layout, which decides what to serve. They used
 * to be separate, and the result was that hiding a link was mistaken for
 * protecting a page. Ten screens rendered an association's money to anybody who
 * typed the URL.
 *
 * Adding a route here is what gates it. A route that is not listed is
 * reachable by any member, which is correct only for the dashboard.
 */
export interface AdminRoute {
  href: string;
  label: string;
  icon: typeof Banknote;
  key: string;
  /** Any one of these opens it. Absent means every member may look. */
  need?: Capability[];
}

export const ADMIN_ROUTES: AdminRoute[] = [

  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/admin/money", label: "Money", icon: Banknote, key: "money", need: ["finances"] },
  {
    href: "/admin/reserves",
    label: "Reserves",
    icon: PiggyBank,
    key: "reserves",
    need: ["finances"],
  },
  {
    href: "/admin/homeowners",
    label: "Homeowners",
    icon: Users,
    key: "homeowners",
    // Was ungated, which showed every household's balance, email and days past
    // due to any resident who reached the URL.
    need: ["finances", "communications"],
  },
  { href: "/admin/requests", label: "Requests", icon: Inbox, key: "requests", need: ["requests"] },
  { href: "/admin/voting", label: "Voting", icon: Vote, key: "voting", need: ["voting"] },
  {
    href: "/admin/compliance",
    label: "Compliance",
    icon: ScaleIcon,
    key: "compliance",
    need: ["compliance"],
  },
  {
    href: "/admin/communications",
    label: "Communications",
    icon: MessagesSquare,
    key: "communications",
    need: ["communications"],
  },
  { href: "/admin/forum", label: "Forum", icon: MessageSquareText, key: "forum", need: ["forum"] },
  { href: "/admin/vendors", label: "Vendors", icon: Truck, key: "vendors", need: ["vendors"] },
  {
    href: "/admin/documents",
    label: "Documents",
    icon: FileText,
    key: "documents",
    need: ["documents"],
  },
  { href: "/admin/settings", label: "Settings", icon: Settings, key: "settings", need: ["settings"] },
];

/**
 * What the given path requires, matching the longest route first.
 *
 * Longest first because "/admin" is a prefix of every other route, so a
 * shortest match would gate nothing.
 */
export function capabilitiesFor(pathname: string): Capability[] | undefined {
  const match = [...ADMIN_ROUTES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((route) => pathname === route.href || pathname.startsWith(`${route.href}/`));
  return match?.need;
}
