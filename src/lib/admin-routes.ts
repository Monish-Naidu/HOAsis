import {
  Banknote,
  Droplets,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
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
 */
export interface AdminRoute {
  href: string;
  label: string;
  icon: typeof Banknote;
  key: string;
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
   * Reserves and shared costs are both money, and a volunteer who opens this
   * once a month does not carry a mental model in which those are separate
   * places. They sit behind one Money tab now. They keep their routes, because
   * links and bookmarks point at them, and they keep their entry here, because
   * this list is what gates them: a route that is not listed is reachable by
   * any member, which is how ten screens once leaked an association's money.
   */
  hidden?: boolean;
}

export const ADMIN_ROUTES: AdminRoute[] = [

  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  {
    href: "/admin/setup",
    label: "Setting up",
    icon: ListChecks,
    key: "setup",
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
  { href: "/admin/money", label: "Money", icon: Banknote, key: "money", need: ["finances"] },
  {
    href: "/admin/reserves",
    hidden: true,
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
  {
    href: "/admin/shared-costs",
    hidden: true,
    label: "Shared costs",
    icon: Droplets,
    key: "shared-costs",
    need: ["finances"],
    present: (c) => c.sharedCosts.length > 0 || c.specialAssessments.length > 0,
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
