import {
  Banknote,
  ChartPie,
  Droplets,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  MessagesSquare,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Truck,
  Users,
  Video,
  Vote,
} from "lucide-react";
import type { Capability } from "@/lib/types";
import type { TintName } from "@/components/ui/primitives";
import { moduleOn } from "@/lib/modules";
import type { ModuleKey } from "@/lib/modules";
import type { Community } from "@/lib/data/community";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";

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
 *
 * Order and naming follow the 2026-09-01 dashboard design
 * (docs/design/dash-2026-09-01): Finances, Violations, Reserve Study,
 * Community, Meetings each got their own line. Homeowners and Communications
 * are not in that design but are real work, so they keep their rows.
 */
export interface BoardRoute {
  href: string;
  label: string;
  icon: typeof Banknote;
  key: string;
  /**
   * The colour on the rail's icon tile. Recognition, not meaning: money is
   * teal wherever it appears, notices coral, records violet, time amber.
   */
  tint?: TintName;
  /** Any one of these opens it. Absent means every member may look. */
  need?: Capability[];
  /**
   * Whether this association has anything on the tab at all.
   *
   * Capability answers "may they", this answers "is there anything there". An
   * association that bills one flat due has no shared costs and no assessments,
   * and putting an empty tab in front of them every day is how a simple product
   * stops feeling simple. Absent means always show.
   *
   * It only hides the link. The page itself still renders, so a bookmark or a
   * link from Settings works, and turning the layer on is one click away.
   */
  present?: (c: Community) => boolean;
  /**
   * Reachable and gated, but not its own line in the sidebar.
   *
   * Shared costs are money, and a volunteer who opens this once a month does
   * not carry a mental model in which that is a separate place. It sits behind
   * the Finances tab. It keeps its route, because links and bookmarks point at
   * it, and it keeps its entry here, because this list is what gates it: a
   * route that is not listed is reachable by any member, which is how ten
   * screens once leaked an association's money.
   */
  hidden?: boolean;
  /**
   * Which launch module this belongs to. See `lib/modules.ts`. A route whose
   * module is off is neither offered nor served; a route without one is
   * always on.
   */
  module?: ModuleKey;
}

export const BOARD_ROUTES: BoardRoute[] = [

  { href: "/board", label: "Dashboard", icon: LayoutDashboard, key: "dashboard", tint: "blue" },
  {
    href: "/board/setup",
    label: "Setting up",
    icon: ListChecks,
    key: "setup", tint: "amber",
    module: "setup",
    // Second in the list while it exists, and gone the day it is finished.
    //
    // The plan used to live only on the dashboard, where it dropped to a
    // single line the moment anything at all happened in the association. A
    // board that had connected one bank account and taken one payment was two
    // of twelve done and had lost the list. Ramping up takes weeks, and for
    // those weeks this is the page they are actually working from, so it gets
    // a line of its own like anything else they work from.
    //
    // Listing it here is also what closes a hole. The page existed before
    // this entry did, and a route absent from this table is served to any
    // member who guesses the path, so the setup plan and the association
    // profile behind it were readable by every resident. `capabilitiesFor`
    // now answers for it like anything else.
    //
    // Either capability opens it, because setting an association up is not one
    // person's job: the president configures it and the treasurer connects the
    // bank, and locking either of them out of the list they are working from
    // is worse than showing it to both.
    need: ["settings", "finances"],
    present: (c) => !buildPlan(c, profileFromCommunity(c)).allDone,
  },
  { href: "/board/money", label: "Finances", icon: Banknote, key: "money", tint: "teal", need: ["finances"], module: "money" },
  {
    href: "/board/homeowners",
    label: "Homeowners",
    icon: Users,
    key: "homeowners", tint: "violet",
    module: "homeowners",
    // Was ungated, which showed every household's balance, email and days past
    // due to any resident who reached the URL.
    need: ["finances", "communications"],
  },
  {
    href: "/board/violations",
    // Called Notices since the 2026-09-19 launch scope: two states, three
    // actions. The route keeps its name because links point at it.
    label: "Notices",
    icon: TriangleAlert,
    key: "violations", tint: "coral",
    module: "notices",
    // Enforcement rides the same capability as requests: both are the board
    // answering a household, and splitting the grant would strand one queue.
    need: ["requests"],
  },
  { href: "/board/vendors", label: "Vendors", icon: Truck, key: "vendors", tint: "amber", need: ["vendors"], module: "vendors" },
  { href: "/board/requests", label: "Requests", icon: Inbox, key: "requests", tint: "blue", need: ["requests"], module: "requests" },
  {
    href: "/board/reserves",
    label: "Reserve Study",
    icon: ChartPie,
    key: "reserves", tint: "teal",
    module: "reserves",
    need: ["finances"],
  },
  {
    href: "/board/compliance",
    label: "Compliance",
    icon: ShieldCheck,
    key: "compliance", tint: "violet",
    module: "compliance",
    need: ["compliance"],
  },
  {
    href: "/board/communications",
    label: "Communications",
    icon: MessagesSquare,
    key: "communications", tint: "coral",
    module: "communications",
    need: ["communications"],
  },
  {
    href: "/board/forum",
    label: "Community",
    icon: MessageSquareText,
    key: "forum", tint: "blue",
    module: "forum",
    need: ["forum"],
  },
  {
    href: "/board/meetings",
    label: "Meetings",
    icon: Video,
    key: "meetings", tint: "amber",
    module: "meetings",
    need: ["voting"],
  },
  { href: "/board/voting", label: "Voting", icon: Vote, key: "voting", tint: "violet", need: ["voting"], module: "voting" },
  {
    href: "/board/documents",
    label: "Documents",
    icon: FileText,
    key: "documents", tint: "violet",
    module: "documents",
    need: ["documents"],
  },
  /**
   * The Finances tabs. Each is its own route so a link or a bookmark lands on
   * the right view, hidden because the segmented control on the money pages is
   * their navigation, and listed because listing is what gates them.
   */
  {
    href: "/board/money/transactions",
    hidden: true,
    label: "Transactions",
    icon: Banknote,
    key: "money-transactions",
    module: "money",
    need: ["finances"],
  },
  {
    href: "/board/money/budget",
    hidden: true,
    label: "Budget",
    icon: Banknote,
    key: "money-budget",
    module: "money-budget",
    need: ["finances"],
  },
  {
    href: "/board/money/trends",
    hidden: true,
    label: "Trends",
    icon: Banknote,
    key: "money-trends",
    module: "money-trends",
    need: ["finances"],
  },
  {
    href: "/board/money/collections",
    hidden: true,
    label: "Collections",
    icon: Banknote,
    key: "money-collections",
    module: "money",
    need: ["finances"],
  },
  {
    href: "/board/shared-costs",
    hidden: true,
    label: "Shared costs",
    icon: Droplets,
    key: "shared-costs",
    module: "shared-costs",
    need: ["finances"],
    present: (c) => c.sharedCosts.length > 0 || c.specialAssessments.length > 0,
  },
  { href: "/board/settings", label: "Settings", icon: Settings, key: "settings", tint: "neutral", need: ["settings"], module: "settings" },
];

/**
 * What the given path requires, matching the longest route first.
 *
 * Longest first because "/board" is a prefix of every other route, so a
 * shortest match would gate nothing.
 */
export function capabilitiesFor(pathname: string): Capability[] | undefined {
  return routeFor(pathname)?.need;
}

/** The route serving this path, longest match first. */
export function routeFor(pathname: string): BoardRoute | undefined {
  return [...BOARD_ROUTES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((route) => pathname === route.href || pathname.startsWith(`${route.href}/`));
}

/** The launch module this path belongs to, if it belongs to one. */
export function boardModuleFor(pathname: string): ModuleKey | undefined {
  return routeFor(pathname)?.module;
}

/** Whether the route is switched on at all. Capability is a separate question. */
export function routeOn(route: BoardRoute): boolean {
  return moduleOn(route.module);
}
