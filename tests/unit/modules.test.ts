import { describe, expect, it } from "vitest";
import { BOARD_ROUTES, boardModuleFor, routeOn } from "@/lib/board-routes";
import { residentModuleFor, residentTabs } from "@/components/app/resident-nav";
import { MODULES, moduleOffCopy, moduleOn } from "@/lib/modules";

/**
 * The launch switch.
 *
 * Nothing is deleted for the first customers; it is listed in one place with
 * an on or off. These tests keep the two things that make that honest: the
 * navigation and the page read the same switch, and every switch has a name
 * a person can read when they go to flip it.
 */
describe("modules", () => {
  it("names every board route it hides", () => {
    for (const route of BOARD_ROUTES) {
      if (route.module) expect(MODULES[route.module], `${route.href} names an unknown module`).toBeTruthy();
    }
  });

  it("switches a page off the same way it switches the link off", () => {
    const off = BOARD_ROUTES.filter((r) => r.module && !moduleOn(r.module));
    expect(off.length, "nothing is off, so this proves nothing").toBeGreaterThan(0);
    for (const route of off) {
      expect(routeOn(route)).toBe(false);
      // The layout asks the same question by path and must get the same answer.
      expect(moduleOn(boardModuleFor(route.href))).toBe(false);
      expect(moduleOn(boardModuleFor(`${route.href}/anything`))).toBe(false);
    }
  });

  it("leaves the dashboard and everything without a module on", () => {
    expect(moduleOn(undefined)).toBe(true);
    expect(moduleOn(boardModuleFor("/board"))).toBe(true);
  });

  it("keeps what the launch scope keeps", () => {
    // Monish, 2026-09-19: Vendors, Reserves, Documents, Settings and Forum
    // stay. Compliance and shared costs wait. Flipping one of these is a
    // product decision, so the test names them.
    for (const key of ["vendors", "reserves", "documents", "settings", "forum", "voting", "notices"] as const) {
      expect(MODULES[key].on, `${key} should be on`).toBe(true);
    }
    for (const key of ["compliance", "shared-costs", "enforcement-full", "resident-report"] as const) {
      expect(MODULES[key].on, `${key} should be off`).toBe(false);
    }
  });

  it("gates resident pages by path, tabs and the report page alike", () => {
    expect(residentModuleFor("/resident/report")).toBe("resident-report");
    expect(residentModuleFor("/resident/report/anything")).toBe("resident-report");
    expect(residentModuleFor("/resident/pay")).toBeUndefined();
    for (const tab of residentTabs) {
      if (tab.module) expect(residentModuleFor(tab.href)).toBe(tab.module);
    }
  });

  it("says why, in words, for everything that is off", () => {
    for (const [key, flag] of Object.entries(MODULES)) {
      if (flag.on) continue;
      const copy = moduleOffCopy(key as keyof typeof MODULES);
      expect(copy.title).toContain("not switched on");
      expect(flag.note, `${key} is off with no note`).toBeTruthy();
    }
  });
});
