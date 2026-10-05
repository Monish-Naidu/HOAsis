import type { Community } from "@/lib/data/community";
import type { Capability } from "@/lib/types";
import { BOARD_ROUTES, routeOffered, type BoardRoute } from "@/lib/board-routes";
import { residentTabs, visibleResidentTabs } from "@/components/app/resident-nav";
import { moduleOn } from "@/lib/modules";
import { KIND_LABEL, TINT, type SearchHit } from "./records";

/**
 * Pages as search results: "settings" opens Settings, "dues" offers Pay.
 *
 * The names people type are not always the names on the rail. Money is
 * "Finances", the bill is "Payments", the roster is "Homeowners", and the
 * synonyms here are the words a volunteer or an owner actually uses. Each
 * row links to a route that exists, and only when the seat is offered it:
 * the same gate as the rail, so a resident is never offered a board page.
 */

/** A little above any record, so an exact page name wins the top row. */
const PAGE_BOOST = 12;

const BOARD_WORDS: Record<string, string> = {
  dashboard: "home overview start today",
  setup: "setting up getting started onboarding checklist plan",
  money: "money finances bank accounts balance funds ledger books income expenses",
  "money-transactions": "money transactions ledger payments expenses spending history",
  "money-collections": "money collections past due late delinquent letters reminders owed",
  reserves: "money reserve study savings fund",
  "money-budget": "money budget",
  "money-trends": "money trends compare years",
  "shared-costs": "money shared costs utilities water trash split",
  homeowners: "owners households residents roster members units homes directory people contacts",
  vendors: "vendors contractors payees invoices bills pay record a payment",
  requests: "requests architectural applications approvals from owners",
  violations: "notices violations enforcement fines rules to owners",
  communications: "messages inbox email mail threads conversations",
  announcements: "announcements news broadcast newsletter",
  forum: "community forum posts neighbors",
  meetings: "meetings calendar agenda minutes action items video",
  voting: "voting ballots elections votes polls",
  compliance: "compliance filings deadlines legal",
  documents: "documents files ccrs bylaws rules forms records governing",
  settings: "settings preferences configuration theme dark light text size dues schedule fees",
};

const RESIDENT_WORDS: Record<string, string> = {
  "/resident": "dashboard home overview start",
  "/resident/pay": "pay payments dues assessment balance owed autopay card ach money bill",
  "/resident/account": "account balance history statement charges ledger receipts",
  "/resident/requests": "requests architectural application approval",
  "/resident/messages": "messages ask the board question mail email contact",
  "/resident/documents": "documents files ccrs bylaws rules forms governing",
  "/resident/calendar": "meetings calendar events schedule",
  "/resident/vote": "voting ballots elections vote",
  "/resident/forum": "community forum neighbors posts",
  "/resident/finances": "funds finances money association reserves where the money is",
  "/resident/settings": "settings text size theme dark light contact details profile phone email",
};

/** Resident pages that are not tabs but still worth a row. */
const RESIDENT_EXTRA: { href: string; label: string; words: string; module?: "resident-report" }[] = [
  { href: "/resident/requests/new", label: "New request", words: "submit ask approval architectural start a request" },
  { href: "/resident/notices", label: "Notices", words: "violations warnings fines rules" },
  { href: "/resident/report", label: "Report a problem", words: "issue broken maintenance complaint", module: "resident-report" },
  {
    href: "/resident/documents/governing",
    label: "Governing documents",
    words: "ccrs bylaws covenants rules declaration",
  },
];

function pageHit(id: string, title: string, subtitle: string, href: string, keywords: string, extra?: Partial<SearchHit>): SearchHit {
  return {
    id,
    kind: "page",
    section: KIND_LABEL.page,
    title,
    subtitle,
    href,
    date: "",
    keywords,
    tint: TINT.page,
    boost: PAGE_BOOST,
    keywordWeight: 1,
    ...extra,
  };
}

function boardParent(route: BoardRoute): BoardRoute | undefined {
  return route.parent ? BOARD_ROUTES.find((r) => r.key === route.parent) : undefined;
}

/** Every board page this seat is offered, hidden tabs included. */
export function boardPages(community: Community, can: (c: Capability) => boolean): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const route of BOARD_ROUTES) {
    if (!routeOffered(route, can, community)) continue;
    // Reached from its section's own screen, by whoever may change it.
    if (route.changes) continue;
    const parent = boardParent(route);
    // A child tab is offered only when its section is, too.
    if (parent && !routeOffered(parent, can, community)) continue;
    hits.push(
      pageHit(
        `page-${route.key}`,
        route.label,
        parent ? `${parent.label} · ${route.tab ?? route.label}` : "Board",
        route.href,
        `${BOARD_WORDS[route.key] ?? ""} ${route.tab ?? ""} page tab open`,
        { tint: route.tint ?? TINT.page, icon: route.icon },
      ),
    );
  }
  return hits;
}

/** Every resident page this association shows. */
export function residentPages(community: Community): SearchHit[] {
  const hits: SearchHit[] = [];
  const shown = visibleResidentTabs(community.settings);
  for (const tab of shown) {
    if (tab.phoneOnly) continue;
    const parent = tab.parent ? residentTabs.find((t) => t.href === tab.parent) : undefined;
    const name = tab.webLabel ?? tab.label;
    hits.push(
      pageHit(
        `page-${tab.href}`,
        name,
        parent ? `${parent.webLabel ?? parent.label} · ${tab.tab ?? name}` : (tab.blurb ?? "Your account"),
        tab.href,
        `${RESIDENT_WORDS[tab.href] ?? ""} ${tab.label} ${tab.tab ?? ""} page tab open`,
        { tint: tab.tint ?? TINT.page, icon: tab.icon },
      ),
    );
  }
  for (const p of RESIDENT_EXTRA) {
    if (p.module && !moduleOn(p.module)) continue;
    // A page under a tab is offered only when the tab is.
    const tab = [...shown].sort((a, b) => b.href.length - a.href.length).find((t) => p.href.startsWith(t.href));
    if (!tab) continue;
    hits.push(
      pageHit(`page-${p.href}`, p.label, `${tab.webLabel ?? tab.label}`, p.href, `${p.words} page open`, {
        tint: tab.tint ?? TINT.page,
        icon: tab.icon,
      }),
    );
  }
  return hits;
}
