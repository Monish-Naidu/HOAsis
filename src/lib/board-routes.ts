import {
  Banknote,
  ChartPie,
  Droplets,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Megaphone,
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
 * Order and naming: the 2026-09-01 dashboard design gave thirteen things
 * their own line, and the 2026-09-24 board pass folded them to nine a
 * volunteer can hold in their head: Dashboard, Finances, Homeowners, Vendors,
 * Requests, Messages, Meetings, Documents, Settings, plus Setting up while
 * it lasts. The pages that lost a line keep their route and their entry
 * here, marked `hidden` with a `parent`. A child is listed right after its
 * section, in the order its tab appears.
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
   * A page that exists only to change something (opening balances, the
   * roster import). Looking is not enough to open it: the gate asks whether
   * the seat may change the area.
   */
  changes?: boolean;
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
  present?: (c: Community, dismissed?: ReadonlySet<string>) => boolean;
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
  /**
   * The sidebar row this page lives under, by key.
   *
   * Thirteen rows was a list nobody read, so related pages share one: Voting
   * sits under Meetings, Notices under Requests, Community under Messages,
   * Reserves under Finances. Each keeps its own flat URL, its own gate and
   * its own module; the parent row lights up while it is open, and the
   * section's tabs (`SectionTabs`) are how a board moves between them.
   */
  parent?: string;
  /**
   * The name on the section's tab, where it differs from the page title.
   * Finances is "Overview" beside Transactions; Messages is "Inbox" beside
   * Announcements.
   */
  tab?: string;
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
    // The steps a board answers by saying so ("We already have an EIN") are
    // done because they were dismissed, so the row has to be told which were.
    present: (c, dismissed) => !buildPlan(c, profileFromCommunity(c), dismissed).allDone,
  },
  {
    href: "/board/money",
    label: "Finances",
    tab: "Overview",
    icon: Banknote,
    key: "money",
    tint: "teal",
    need: ["finances"],
    module: "money",
  },
  /**
   * The Finances tabs. Each is its own route so a link or a bookmark lands on
   * the right view, hidden because the section's tabs are their navigation,
   * and listed because listing is what gates them. Teal like the row, so the
   * title tile on Transactions is the same colour as the row that opened it.
   */
  {
    href: "/board/money/transactions",
    hidden: true,
    parent: "money",
    label: "Transactions",
    icon: Banknote,
    key: "money-transactions",
    tint: "teal",
    module: "money",
    need: ["finances"],
  },
  {
    href: "/board/money/collections",
    hidden: true,
    parent: "money",
    // Called Past due since 2026-10-05: that is what a board is looking for.
    // The URL keeps its old name for links that point at it.
    label: "Past due",
    icon: Banknote,
    key: "money-collections",
    tint: "teal",
    module: "money",
    need: ["finances"],
  },
  {
    href: "/board/reserves",
    hidden: true,
    parent: "money",
    // One name everywhere. It was Reserve Study on the rail, Reserves on the
    // tab and Reserve fund on the overview, for the same page.
    label: "Reserves",
    icon: ChartPie,
    key: "reserves",
    tint: "teal",
    module: "reserves",
    need: ["finances"],
  },
  {
    href: "/board/money/budget",
    hidden: true,
    parent: "money",
    label: "Budget",
    icon: Banknote,
    key: "money-budget",
    tint: "teal",
    module: "money-budget",
    need: ["finances"],
  },
  {
    href: "/board/money/trends",
    hidden: true,
    parent: "money",
    label: "Trends",
    icon: Banknote,
    key: "money-trends",
    tint: "teal",
    module: "money-trends",
    need: ["finances"],
  },
  {
    href: "/board/shared-costs",
    hidden: true,
    parent: "money",
    label: "Shared costs",
    icon: Droplets,
    key: "shared-costs",
    tint: "teal",
    module: "shared-costs",
    need: ["finances"],
    present: (c) => c.sharedCosts.length > 0 || c.specialAssessments.length > 0,
  },
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
  // Two pages under Homeowners that only write. They had no entry, so the
  // register's own gate served them to a seat that may look at the roster
  // and nothing more.
  {
    href: "/board/homeowners/opening-balances",
    label: "Starting balances",
    icon: Users,
    key: "opening-balances",
    module: "homeowners",
    need: ["finances"],
    changes: true,
    hidden: true,
    parent: "homeowners",
  },
  {
    href: "/board/homeowners/import",
    label: "Import a roster",
    icon: Users,
    key: "roster-import",
    module: "homeowners",
    need: ["settings"],
    changes: true,
    hidden: true,
    parent: "homeowners",
  },
  { href: "/board/vendors", label: "Vendors", icon: Truck, key: "vendors", tint: "amber", need: ["vendors"], module: "vendors" },
  {
    href: "/board/requests",
    label: "Requests",
    tab: "Requests",
    icon: Inbox,
    key: "requests",
    tint: "blue",
    need: ["requests"],
    module: "requests",
  },
  {
    href: "/board/violations",
    hidden: true,
    parent: "requests",
    // Called Notices since the 2026-09-19 launch scope: two states, three
    // actions. The route keeps its name because links point at it. It sits
    // under Requests because both are the board answering one household.
    label: "Notices",
    tab: "Notices",
    icon: TriangleAlert,
    key: "violations", tint: "coral",
    module: "notices",
    // Enforcement rides the same capability as requests: both are the board
    // answering a household, and splitting the grant would strand one queue.
    need: ["requests"],
  },
  {
    href: "/board/communications",
    // Messages, because that is what a board member is looking for when they
    // open it. The route keeps its old name for the links that point at it.
    label: "Messages",
    tab: "Inbox",
    icon: MessagesSquare,
    key: "communications", tint: "coral",
    module: "communications",
    // Finances opens it too. The database shows a treasurer the Billing
    // conversations only (0044): the past due letters are theirs to answer.
    need: ["communications", "finances"],
  },
  {
    href: "/board/communications/announcements",
    hidden: true,
    parent: "communications",
    label: "Announcements",
    icon: Megaphone,
    key: "announcements", tint: "coral",
    module: "communications",
    need: ["communications"],
  },
  {
    href: "/board/forum",
    hidden: true,
    parent: "communications",
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
  {
    href: "/board/voting",
    hidden: true,
    parent: "meetings",
    label: "Voting",
    icon: Vote,
    key: "voting",
    tint: "violet",
    need: ["voting"],
    module: "voting",
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
    href: "/board/documents",
    label: "Documents",
    icon: FileText,
    key: "documents", tint: "violet",
    module: "documents",
    need: ["documents"],
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

/**
 * Whether this seat is offered the route: switched on, theirs to open, and
 * with something on it. The same three questions for a rail row and a tab.
 */
export function routeOffered(
  route: BoardRoute,
  can: (capability: Capability) => boolean,
  community: Community,
  dismissed?: ReadonlySet<string>,
): boolean {
  return (
    routeOn(route) &&
    (!route.need || route.need.some((c) => can(c))) &&
    (!route.present || route.present(community, dismissed))
  );
}

/** The section a path belongs to: its route's parent row, or the route itself. */
export function sectionFor(pathname: string): BoardRoute | undefined {
  const route = routeFor(pathname);
  if (!route) return undefined;
  return route.parent ? BOARD_ROUTES.find((r) => r.key === route.parent) : route;
}

/** A section's pages in tab order: the row itself, then its children. */
export function sectionPages(section: BoardRoute): BoardRoute[] {
  // A page that only writes is reached from a link on its section's screen,
  // not from a tab of its own.
  return [section, ...BOARD_ROUTES.filter((r) => r.parent === section.key && !r.changes)];
}

/**
 * Whether this seat may open the page a link points at. A dashboard row or a
 * tile that leads to "This is not yours to open" is worse than no row, and a
 * money tile shown to somebody who cannot read the books shows zeroes that
 * are not true.
 */
export function mayOpen(href: string, can: (capability: Capability) => boolean): boolean {
  const need = capabilitiesFor(href.split(/[?#]/)[0]);
  return !need || need.some((c) => can(c));
}
