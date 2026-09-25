import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  Landmark,
  LayoutGrid,
  Mail,
  MessageSquarePlus,
  MessageSquareText,
  Receipt,
  Settings,
  Vote,
} from "lucide-react";
import type { CommunitySettings } from "@/lib/types";
import { moduleOn, type ModuleKey } from "@/lib/modules";
import type { TintName } from "@/components/ui/primitives";

interface ResidentTab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The colour on the icon's tile, in the rail and the tab bar. */
  tint?: TintName;
  /** The sidebar has room for a longer name than a 63px tab does. */
  webLabel?: string;
  /**
   * A shorter name for the phone tab bar, where six tabs share 320px and
   * "Dashboard" alone wanted a sixth of the screen.
   */
  tabLabel?: string;
  /** Sidebar only. The phone tab bar holds six; the rest are under More. */
  webOnly?: boolean;
  /** Phone tab bar only: More, which the sidebar has no need for. */
  phoneOnly?: boolean;
  /** One line under the name on the phone's More page. */
  blurb?: string;
  /** Some sections are switched off by the admin. */
  visible?: (s: CommunitySettings) => boolean;
  /** Some are switched off for everyone until launch. See `lib/modules.ts`. */
  module?: ModuleKey;
}

/**
 * One nav definition, used by the phone tab bar and the website sidebar.
 * Names and order follow the 2026-09-01 dashboard design: Dashboard,
 * Payments, Requests, Documents, Community, Meetings, Voting, Account, then
 * Settings. The phone tab bar shows six: Home, Payments, Requests, Docs,
 * Account and More, and More lists every section the bar has no room for,
 * so nothing is reachable only from the website (2026-09-24).
 */
export const residentTabs: ResidentTab[] = [
  { href: "/resident", label: "Dashboard", tabLabel: "Home", icon: Home, tint: "blue" },
  { href: "/resident/pay", label: "Payments", icon: CreditCard, tint: "teal" },
  { href: "/resident/requests", label: "Requests", icon: MessageSquarePlus, tint: "blue" },
  {
    href: "/resident/documents",
    label: "Docs",
    icon: FileText,
    tint: "violet",
    webLabel: "Documents",
  },
  {
    href: "/resident/forum",
    label: "Community",
    icon: MessageSquareText,
    tint: "coral",
    webOnly: true,
    blurb: "Posts from your neighbors",
    visible: (s) => s.forumEnabled,
    module: "resident-forum",
  },
  {
    href: "/resident/calendar",
    label: "Meetings",
    icon: CalendarDays,
    tint: "amber",
    webOnly: true,
    blurb: "Board meetings and what is on the calendar",
    module: "resident-meetings",
  },
  // Sidebar only. Voting is occasional, and the dashboard banner already
  // points at an open ballot; the six phone tabs go to what people open weekly.
  {
    href: "/resident/vote",
    label: "Vote",
    icon: Vote,
    tint: "violet",
    webLabel: "Voting",
    webOnly: true,
    blurb: "Open ballots and past results",
  },
  {
    href: "/resident/finances",
    label: "Funds",
    icon: Landmark,
    tint: "teal",
    webLabel: "Association funds",
    webOnly: true,
    blurb: "Where the association's money is",
    visible: (s) => s.showFundsToResidents,
    module: "resident-funds",
  },
  // Sidebar only; on a phone it is one tap from Requests. Asking the board a
  // question used to mean email, with no trace here.
  {
    href: "/resident/messages",
    label: "Messages",
    icon: Mail,
    tint: "coral",
    webOnly: true,
    blurb: "Ask the board a question",
  },
  // Account closes the list, per the huddle's nav order. Violet, the
  // records tint: neutral grey made its title tile look switched off.
  { href: "/resident/account", label: "Account", icon: Receipt, tint: "violet" },
  // Where people look for text size. Its own page rather than a corner of
  // Account, which is about money.
  {
    href: "/resident/settings",
    label: "Settings",
    icon: Settings,
    tint: "blue",
    webOnly: true,
    blurb: "Text size, light or dark, and your contact details",
  },
  { href: "/resident/more", label: "More", icon: LayoutGrid, tint: "blue", phoneOnly: true },
];

/** The tabs this association shows: its modules on, its switches on. */
export function visibleResidentTabs(settings: CommunitySettings): ResidentTab[] {
  return residentTabs.filter((t) => moduleOn(t.module) && (!t.visible || t.visible(settings)));
}

/**
 * Resident pages that are not tabs but still belong to a module. The shell
 * refuses these the same way the board layout refuses a board route whose
 * module is off.
 */
const RESIDENT_ROUTE_MODULES: { prefix: string; module: ModuleKey }[] = [
  { prefix: "/resident/report", module: "resident-report" },
  ...residentTabs.flatMap((t) => (t.module ? [{ prefix: t.href, module: t.module }] : [])),
];

export function residentModuleFor(pathname: string): ModuleKey | undefined {
  return [...RESIDENT_ROUTE_MODULES]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))?.module;
}
