import { describe, expect, it } from "vitest";
import {
  residentBarTabs,
  residentMoreRows,
  residentRailRows,
  residentSectionFor,
  residentSectionPages,
  residentTabs,
  visibleResidentTabs,
} from "@/components/app/resident-nav";
import { residentBadges } from "@/components/app/resident-badges";
import type { CommunitySettings } from "@/lib/types";

const settings = { forumEnabled: true, showFundsToResidents: true } as CommunitySettings;
const tabs = visibleResidentTabs(settings);
const name = (t: { label: string; tab?: string }) => t.tab ?? t.label;

describe("one resident navigation", () => {
  it("names and orders the website rail", () => {
    expect(residentRailRows(tabs).map((t) => t.label)).toEqual([
      "Home",
      "Pay",
      "Requests",
      "Documents",
      "Meetings",
      "Community",
      "Association funds",
      "Settings",
    ]);
  });

  it("gives the section tabs under Payments, Requests and Meetings", () => {
    const tabsOf = (href: string) =>
      residentSectionPages(residentTabs.find((t) => t.href === href)!, tabs).map(name);
    expect(tabsOf("/resident/pay")).toEqual(["Pay", "Statement"]);
    expect(tabsOf("/resident/requests")).toEqual(["Requests", "Messages"]);
    expect(tabsOf("/resident/calendar")).toEqual(["Meetings", "Voting"]);
  });

  it("draws the phone bar as Home, Pay, Requests, Docs, Meetings, More", () => {
    expect(residentBarTabs(tabs).map((t) => t.tabLabel ?? t.label)).toEqual([
      "Home",
      "Pay",
      "Requests",
      "Docs",
      "Meetings",
      "More",
    ]);
  });

  it("lists on More what the bar has no room for, under the rail's names and order", () => {
    expect(residentMoreRows(tabs).map((t) => t.label)).toEqual([
      "Community",
      "Association funds",
      "Settings",
    ]);
  });

  it("leaves a row out of every list when its switch is off", () => {
    const off = visibleResidentTabs({ forumEnabled: false, showFundsToResidents: false } as CommunitySettings);
    expect(residentRailRows(off).map((t) => t.label)).not.toContain("Community");
    expect(residentRailRows(off).map((t) => t.label)).not.toContain("Association funds");
    expect(residentMoreRows(off).map((t) => t.label)).toEqual(["Settings"]);
  });

  it("puts every place in exactly one of the bar, More or a section's tabs", () => {
    const places = tabs.filter((t) => !t.phoneOnly);
    const onBar = new Set(residentBarTabs(tabs).map((t) => t.href));
    const onMore = new Set(residentMoreRows(tabs).map((t) => t.href));
    for (const t of places) {
      const homes = [onBar.has(t.href), onMore.has(t.href), Boolean(t.parent)].filter(Boolean);
      expect(homes, `${t.label} has ${homes.length} homes`).toHaveLength(1);
    }
  });

  it("keeps each route's URL and lights the row a page lives under", () => {
    expect(residentSectionFor("/resident/account")?.href).toBe("/resident/pay");
    expect(residentSectionFor("/resident/messages")?.href).toBe("/resident/requests");
    expect(residentSectionFor("/resident/vote")?.href).toBe("/resident/calendar");
    expect(residentTabs.find((t) => t.label === "Statement")?.href).toBe("/resident/account");
  });
});

const home = { id: "own-1", unit: "1" };
const openBallot = { audience: "owners", status: "open", closesDate: "2099-01-01" };
const notice = (over: object) => ({ homeId: "own-1", unit: "1", stage: "first-notice", ...over });

describe("counts on the rail and the bar", () => {
  it("has none for a balance, since an amount is not a count", () => {
    const badges = residentBadges({ ballots: [], violations: [] } as never, home);
    expect(badges).toEqual({});
  });

  it("counts ballots not yet voted on, on the Meetings row", () => {
    const badges = residentBadges(
      {
        ballots: [
          openBallot,
          { ...openBallot, myVoteOptionId: "opt" },
          { ...openBallot, audience: "board" },
          { ...openBallot, status: "closed" },
        ],
        violations: [],
      } as never,
      home,
    );
    expect(badges["/resident/calendar"]?.count).toBe(1);
    expect(badges["/resident/requests"]).toBeUndefined();
  });

  it("counts open notices addressed to this home, on the Requests row", () => {
    const badges = residentBadges(
      {
        ballots: [],
        violations: [
          notice({}),
          notice({ stage: "fined" }),
          notice({ stage: "cured" }),
          notice({ homeId: "own-9", unit: "9" }),
        ],
      } as never,
      home,
    );
    expect(badges["/resident/requests"]).toMatchObject({ count: 2, hint: "open notices about your home" });
  });

  it("never counts replies from the board, which the page cannot mark as seen", () => {
    const badges = residentBadges(
      {
        ballots: [],
        violations: [],
        requests: [{ homeId: "own-1", thread: [{ at: "2026-08-19", actorRole: "board" }] }],
        threads: [{ homeId: "own-1", messages: [{ at: "2026-08-19", fromRole: "board" }] }],
      } as never,
      home,
    );
    expect(badges).toEqual({});
  });
});
