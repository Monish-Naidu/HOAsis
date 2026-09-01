import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  Landmark,
  MessageSquarePlus,
  MessageSquareText,
  Receipt,
  Vote,
} from "lucide-react";
import type { CommunitySettings } from "@/lib/types";

interface ResidentTab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The sidebar has room for a longer name than a 63px tab does. */
  webLabel?: string;
  /** Sidebar only. The phone tab bar holds six. */
  webOnly?: boolean;
  /** Some sections are switched off by the admin. */
  visible?: (s: CommunitySettings) => boolean;
}

/**
 * One nav definition, used by the phone tab bar and the website sidebar.
 * Names and order follow the 2026-09-01 dashboard design: Dashboard,
 * Payments, Requests, Documents, Community, Meetings, Voting, Account.
 */
export const residentTabs: ResidentTab[] = [
  { href: "/resident", label: "Dashboard", icon: Home },
  { href: "/resident/pay", label: "Payments", icon: CreditCard },
  { href: "/resident/requests", label: "Requests", icon: MessageSquarePlus },
  {
    href: "/resident/documents",
    label: "Docs",
    icon: FileText,
    webLabel: "Documents",
    webOnly: true,
  },
  {
    href: "/resident/forum",
    label: "Community",
    icon: MessageSquareText,
    visible: (s) => s.forumEnabled,
  },
  {
    href: "/resident/calendar",
    label: "Meetings",
    icon: CalendarDays,
    webOnly: true,
  },
  { href: "/resident/vote", label: "Vote", icon: Vote, webLabel: "Voting" },
  { href: "/resident/account", label: "Account", icon: Receipt },
  {
    href: "/resident/finances",
    label: "Funds",
    icon: Landmark,
    webLabel: "Association funds",
    webOnly: true,
    visible: (s) => s.showFundsToResidents,
  },
];
