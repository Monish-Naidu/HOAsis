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
  /** The one name, on the website rail, the section tabs and the More page. */
  label: string;
  icon: LucideIcon;
  /** The colour on the icon's tile, in the rail and the tab bar. */
  tint?: TintName;
  /**
   * Not set any more: a row has one name everywhere. Search still reads it,
   * so the field stays until it stops.
   */
  webLabel?: string;
  /**
   * A shorter name for the phone tab bar, where six tabs share 320px:
   * "Pay" for Payments, "Docs" for Documents.
   */
  tabLabel?: string;
  /** On the phone tab bar. Every other row is under More, or is a section tab. */
  bar?: boolean;
  /** Phone tab bar only: More, which the sidebar has no need for. */
  phoneOnly?: boolean;
  /** One line under the name on the phone's More page. */
  blurb?: string;
  /** Some sections are switched off by the admin. */
  visible?: (s: CommunitySettings) => boolean;
  /** Some are switched off for everyone until launch. See `lib/modules.ts`. */
  module?: ModuleKey;
  /**
   * The sidebar row this page lives under, by href.
   *
   * Eleven rows was a list nobody read, so related pages share one the way
   * the board's do: the statement sits under Payments, Messages under
   * Requests, Voting under Meetings. Each keeps its own URL; the parent row
   * lights while it is open, and the section's tabs are how an owner moves
   * between them, on a phone as on the website.
   */
  parent?: string;
  /** The name on the section's tab, where it differs from the label. */
  tab?: string;
}

/**
 * One nav definition, read by the website rail, the section tabs, the phone
 * tab bar and the More page, so a place never has two names or two orders.
 *
 * Rail, in order: Home; Payments (tabs Pay, Statement); Requests (tabs
 * Requests, Messages); Documents; Meetings (tabs Meetings, Voting);
 * Community; Association funds; Settings. The phone bar holds the rows
 * marked `bar`: Home, Pay, Requests, Docs, Meetings, More (Monish, 2026-10-04,
 * Meetings in place of Account). More lists the rail rows the bar has no room
 * for, in the rail's order. Pages under another row are reached by that row's
 * tabs, which draw at every width.
 */
export const residentTabs: ResidentTab[] = [
  { href: "/resident", label: "Home", icon: Home, tint: "blue", bar: true },
  { href: "/resident/pay", label: "Payments", tab: "Pay", tabLabel: "Pay", icon: CreditCard, tint: "teal", bar: true },
  // Under Payments: the balance and the history are two views of the same
  // money. Violet, the records tint: neutral grey made its title tile look
  // switched off.
  {
    href: "/resident/account",
    label: "Statement",
    icon: Receipt,
    tint: "violet",
    parent: "/resident/pay",
  },
  { href: "/resident/requests", label: "Requests", icon: MessageSquarePlus, tint: "blue", bar: true },
  // Under Requests: a question is a request that needs no decision. Asking
  // the board used to mean email, with no trace here.
  {
    href: "/resident/messages",
    label: "Messages",
    icon: Mail,
    tint: "coral",
    blurb: "Ask the board a question",
    parent: "/resident/requests",
  },
  {
    href: "/resident/documents",
    label: "Documents",
    tabLabel: "Docs",
    icon: FileText,
    tint: "violet",
    bar: true,
  },
  {
    href: "/resident/calendar",
    label: "Meetings",
    icon: CalendarDays,
    tint: "amber",
    bar: true,
    blurb: "Board meetings and what is on the calendar",
    module: "resident-meetings",
  },
  // Under Meetings, as on the board side. Voting is occasional, and the
  // dashboard banner already points at an open ballot.
  {
    href: "/resident/vote",
    label: "Voting",
    icon: Vote,
    tint: "violet",
    blurb: "Open ballots and past results",
    parent: "/resident/calendar",
  },
  {
    href: "/resident/forum",
    label: "Community",
    icon: MessageSquareText,
    tint: "coral",
    blurb: "Posts from your neighbors",
    visible: (s) => s.forumEnabled,
    module: "resident-forum",
  },
  {
    href: "/resident/finances",
    label: "Association funds",
    icon: Landmark,
    tint: "teal",
    blurb: "Where the association's money is",
    visible: (s) => s.showFundsToResidents,
    module: "resident-funds",
  },
  // Where people look for text size. Its own page rather than a corner of
  // the statement, which is about money.
  {
    href: "/resident/settings",
    label: "Settings",
    icon: Settings,
    tint: "blue",
    blurb: "Text size, light or dark, and your contact details",
  },
  { href: "/resident/more", label: "More", icon: LayoutGrid, tint: "blue", bar: true, phoneOnly: true },
];

/** The tabs this association shows: its modules on, its switches on. */
export function visibleResidentTabs(settings: CommunitySettings): ResidentTab[] {
  return residentTabs.filter((t) => moduleOn(t.module) && (!t.visible || t.visible(settings)));
}

/** The website rail: every row that is not phone-only and not under another row. */
export function residentRailRows(tabs: ResidentTab[]): ResidentTab[] {
  return tabs.filter((t) => !t.phoneOnly && !t.parent);
}

/** The phone tab bar, left to right. */
export function residentBarTabs(tabs: ResidentTab[]): ResidentTab[] {
  return tabs.filter((t) => t.bar);
}

/** The More page: the rail's rows that the bar has no room for, in the rail's order. */
export function residentMoreRows(tabs: ResidentTab[]): ResidentTab[] {
  return residentRailRows(tabs).filter((t) => !t.bar);
}

/** The tab a path belongs to: the longest href that prefixes it. */
export function residentTabFor(pathname: string): ResidentTab | undefined {
  return [...residentTabs]
    .sort((a, b) => b.href.length - a.href.length)
    .find((t) => (t.href === "/resident" ? pathname === t.href : pathname.startsWith(t.href)));
}

/** The sidebar row a path lights: its tab's parent row, or the tab itself. */
export function residentSectionFor(pathname: string): ResidentTab | undefined {
  const tab = residentTabFor(pathname);
  if (!tab) return undefined;
  return tab.parent ? residentTabs.find((t) => t.href === tab.parent) : tab;
}

/** A section's pages in tab order: the row itself, then its children. */
export function residentSectionPages(section: ResidentTab, tabs: ResidentTab[]): ResidentTab[] {
  return [section, ...tabs.filter((t) => t.parent === section.href)];
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
