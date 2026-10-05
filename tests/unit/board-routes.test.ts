import { describe, expect, it } from "vitest";
import { BOARD_ROUTES, capabilitiesFor, sectionFor, sectionPages } from "@/lib/board-routes";
import { CAPABILITY_LABEL, GRANTABLE } from "@/lib/data";

/**
 * The route table is the gate.
 *
 * Both the navigation and the layout read it: one decides what to offer, the
 * other what to serve. They used to be separate, and the result was that
 * hiding a link was mistaken for protecting a page, so ten screens rendered an
 * association's money to anybody who typed the URL. These are the tests that
 * would have caught it.
 */
describe("capabilitiesFor", () => {
  it("gates every admin route except the dashboard", () => {
    const ungated = BOARD_ROUTES.filter((r) => !r.need).map((r) => r.href);
    // The dashboard shows nothing a member may not see. Anything else without
    // a capability is reachable by every resident who guesses the path.
    expect(ungated).toEqual(["/board"]);
  });

  it("gates a nested path the same as its parent", () => {
    expect(capabilitiesFor("/board/money")).toEqual(["finances"]);
    // A child route inherits, or an unlisted child is a hole.
    expect(capabilitiesFor("/board/money/anything")).toEqual(["finances"]);
    expect(capabilitiesFor("/board/documents/governing")).toEqual(
      capabilitiesFor("/board/documents"),
    );
  });

  it("matches the longest route, not the shortest", () => {
    // "/board" prefixes every other route, so a shortest match would gate
    // nothing at all.
    expect(capabilitiesFor("/board/settings")).not.toEqual(capabilitiesFor("/board"));
    expect(capabilitiesFor("/board/settings")).toEqual(["settings"]);
  });

  it("leaves the dashboard open to any member", () => {
    expect(capabilitiesFor("/board")).toBeUndefined();
  });

  it("names only capabilities that exist", () => {
    const known = new Set<string>(GRANTABLE);
    for (const route of BOARD_ROUTES) {
      for (const capability of route.need ?? []) {
        // A typo here silently gates a page to nobody, or to everybody,
        // depending which side reads it.
        expect(known.has(capability), `${route.href} needs unknown "${capability}"`).toBe(true);
      }
    }
  });

  it("keeps hidden routes gated, because hiding a link protects nothing", () => {
    const hidden = BOARD_ROUTES.filter((r) => r.hidden);
    expect(hidden.length, "nothing is hidden, so this proves nothing").toBeGreaterThan(0);
    for (const route of hidden) {
      expect(route.need, `${route.href} is hidden and ungated`).toBeTruthy();
    }
  });

  it("gives every route a unique href and key", () => {
    const hrefs = BOARD_ROUTES.map((r) => r.href);
    const keys = BOARD_ROUTES.map((r) => r.key);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("returns nothing for a path outside the admin tree", () => {
    expect(capabilitiesFor("/resident/pay")).toBeUndefined();
    expect(capabilitiesFor("/library")).toBeUndefined();
  });
});

describe("sections", () => {
  it("puts every child under a row that exists and is a row", () => {
    for (const route of BOARD_ROUTES.filter((r) => r.parent)) {
      const parent = BOARD_ROUTES.find((r) => r.key === route.parent);
      expect(parent, `${route.href} names a parent that does not exist`).toBeTruthy();
      expect(parent!.hidden, `${route.href} hangs under a hidden page`).toBeFalsy();
      // A child with its own line would be two ways in and one lit row.
      expect(route.hidden, `${route.href} has a parent and its own line`).toBe(true);
    }
  });

  it("keeps the sidebar to ten rows at most", () => {
    // Nine, plus Setting up while it lasts. Compliance waits behind its
    // module, so it is listed but not offered.
    expect(BOARD_ROUTES.filter((r) => !r.hidden).length).toBeLessThanOrEqual(11);
  });

  it("lights the row a folded page lives under", () => {
    expect(sectionFor("/board/voting")?.key).toBe("meetings");
    expect(sectionFor("/board/violations")?.key).toBe("requests");
    expect(sectionFor("/board/forum")?.key).toBe("communications");
    expect(sectionFor("/board/communications/announcements")?.key).toBe("communications");
    expect(sectionFor("/board/reserves")?.key).toBe("money");
    expect(sectionFor("/board/money/transactions")?.key).toBe("money");
    expect(sectionFor("/board/documents/governing")?.key).toBe("documents");
    expect(sectionFor("/board")?.key).toBe("dashboard");
  });

  it("orders a section's tabs as the audit named them", () => {
    const money = BOARD_ROUTES.find((r) => r.key === "money")!;
    expect(sectionPages(money).map((r) => r.tab ?? r.label).slice(0, 4)).toEqual([
      "Overview",
      "Transactions",
      "Past due",
      "Reserves",
    ]);
  });

  it("names every section's tabs the way the rail and the page titles do", () => {
    const tabs = (key: string) =>
      sectionPages(BOARD_ROUTES.find((r) => r.key === key)!).map((r) => r.tab ?? r.label);
    expect(tabs("money")).toEqual(["Overview", "Transactions", "Past due", "Reserves", "Budget", "Trends", "Shared costs"]);
    expect(tabs("requests")).toEqual(["Requests", "Notices"]);
    expect(tabs("communications")).toEqual(["Inbox", "Announcements", "Community"]);
    expect(tabs("meetings")).toEqual(["Meetings", "Voting"]);
  });

  it("calls each access area what the rail calls it, in Settings and in the refusal", () => {
    const railName: Record<string, string> = {
      finances: "money",
      requests: "requests",
      communications: "communications",
      voting: "meetings",
      vendors: "vendors",
      documents: "documents",
      forum: "forum",
      settings: "settings",
    };
    for (const [capability, key] of Object.entries(railName)) {
      const route = BOARD_ROUTES.find((r) => r.key === key)!;
      expect(CAPABILITY_LABEL[capability as keyof typeof CAPABILITY_LABEL], capability).toBe(route.label);
    }
  });

  it("keeps the Past due URL, so a bookmark to Collections still opens", () => {
    expect(BOARD_ROUTES.find((r) => r.key === "money-collections")?.href).toBe("/board/money/collections");
  });

  it("gives a folded money page the section's teal", () => {
    for (const route of BOARD_ROUTES.filter((r) => r.parent === "money")) {
      expect(route.tint, route.href).toBe("teal");
    }
  });
});
