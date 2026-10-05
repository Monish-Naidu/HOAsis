import { describe, expect, it } from "vitest";
import { bestMatch, homeOption, seatPlan } from "@/app/board/homeowners/join-match";
import type { Community } from "@/lib/data/community";
import type { Owner } from "@/lib/types";

/**
 * Which home a join request means, and what "Let them in" does on it.
 * The failure these guard: typed text that is not an exact label used to
 * create a fifth home beside four real ones.
 */

const community = { profile: undefined } as unknown as Community;
const home = (unit: string, extra: Partial<Owner> = {}): Owner =>
  ({
    id: `home-${unit}`,
    displayName: "Pat Lee",
    members: ["Pat Lee"],
    email: "pat@example.com",
    phone: "",
    unit,
    address: `${unit} Founder Way`,
    moveInDate: "2026-01-01",
    balanceCents: 0,
    autopay: false,
    standing: "current",
    daysPastDue: 0,
    ...extra,
  }) as Owner;

describe("bestMatch", () => {
  const homes = [home("3"), home("4"), home("12")];

  it("matches a label or an address, ignoring case and spacing", () => {
    expect(bestMatch(community, homes, "3")?.id).toBe("home-3");
    expect(bestMatch(community, homes, "  UNIT 4 ")?.id).toBe("home-4");
    expect(bestMatch(community, homes, "12 founder   way")?.id).toBe("home-12");
  });

  it("selects nothing when no home fits, so nothing is ever made from typed text", () => {
    expect(bestMatch(community, homes, "Plot 9")).toBeNull();
    expect(bestMatch(community, homes, "")).toBeNull();
    expect(bestMatch(community, homes, "   ")).toBeNull();
  });

  it("selects nothing when two homes fit equally", () => {
    const twins = [home("3", { address: "9 Elm St" }), home("5", { address: "9 elm st" })];
    expect(bestMatch(community, twins, "9 Elm St")).toBeNull();
  });
});

describe("seatPlan", () => {
  const asked = { email: "Nadia@Example.com" };

  it("seats them on a home with no owner listed", () => {
    expect(seatPlan(home("3", { placeholder: true, email: "" }), asked, false)).toBe("seat");
  });

  it("seats them where the listed owner has not signed in and has no email, or the same one", () => {
    expect(seatPlan(home("3", { email: "" }), asked, false)).toBe("seat");
    expect(seatPlan(home("3", { email: "nadia@example.com" }), asked, false)).toBe("seat");
    expect(seatPlan(home("3", { email: "nadia@example.com" }), asked, true)).toBe("seat");
  });

  it("offers a second owner or a sale where somebody else owns it", () => {
    expect(seatPlan(home("3", { email: "pat@example.com" }), asked, false)).toBe("different");
    expect(seatPlan(home("3", { email: "pat@example.com" }), asked, true)).toBe("different");
    expect(seatPlan(home("3", { email: "" }), asked, true)).toBe("different");
  });
});

describe("homeOption", () => {
  it("says the home, its address and who owns it", () => {
    expect(homeOption(community, home("3"))).toBe("Unit 3 · 3 Founder Way · Pat Lee");
    expect(homeOption(community, home("3", { placeholder: true, displayName: "No owner yet" }))).toBe(
      "Unit 3 · 3 Founder Way · No owner yet",
    );
  });
});
