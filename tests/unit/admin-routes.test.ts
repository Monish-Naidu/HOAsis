import { describe, expect, it } from "vitest";
import { ADMIN_ROUTES, capabilitiesFor } from "@/lib/admin-routes";
import { GRANTABLE } from "@/lib/data";

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
    const ungated = ADMIN_ROUTES.filter((r) => !r.need).map((r) => r.href);
    // The dashboard shows nothing a member may not see. Anything else without
    // a capability is reachable by every resident who guesses the path.
    expect(ungated).toEqual(["/admin"]);
  });

  it("gates a nested path the same as its parent", () => {
    expect(capabilitiesFor("/admin/money")).toEqual(["finances"]);
    // A child route inherits, or an unlisted child is a hole.
    expect(capabilitiesFor("/admin/money/anything")).toEqual(["finances"]);
    expect(capabilitiesFor("/admin/documents/governing")).toEqual(
      capabilitiesFor("/admin/documents"),
    );
  });

  it("matches the longest route, not the shortest", () => {
    // "/admin" prefixes every other route, so a shortest match would gate
    // nothing at all.
    expect(capabilitiesFor("/admin/settings")).not.toEqual(capabilitiesFor("/admin"));
    expect(capabilitiesFor("/admin/settings")).toEqual(["settings"]);
  });

  it("leaves the dashboard open to any member", () => {
    expect(capabilitiesFor("/admin")).toBeUndefined();
  });

  it("names only capabilities that exist", () => {
    const known = new Set<string>(GRANTABLE);
    for (const route of ADMIN_ROUTES) {
      for (const capability of route.need ?? []) {
        // A typo here silently gates a page to nobody, or to everybody,
        // depending which side reads it.
        expect(known.has(capability), `${route.href} needs unknown "${capability}"`).toBe(true);
      }
    }
  });

  it("keeps hidden routes gated, because hiding a link protects nothing", () => {
    const hidden = ADMIN_ROUTES.filter((r) => r.hidden);
    expect(hidden.length, "nothing is hidden, so this proves nothing").toBeGreaterThan(0);
    for (const route of hidden) {
      expect(route.need, `${route.href} is hidden and ungated`).toBeTruthy();
    }
  });

  it("gives every route a unique href and key", () => {
    const hrefs = ADMIN_ROUTES.map((r) => r.href);
    const keys = ADMIN_ROUTES.map((r) => r.key);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("returns nothing for a path outside the admin tree", () => {
    expect(capabilitiesFor("/resident/pay")).toBeUndefined();
    expect(capabilitiesFor("/library")).toBeUndefined();
  });
});
