import { describe, expect, it } from "vitest";
import {
  amenitiesFromSpaces,
  buildCommunity,
  defaultHomeNaming,
  emptyDraft,
  finalizeDraft,
  founderUnit,
  otherHomes,
  unitCount,
} from "@/lib/data/new-community";
import type { CommunityDraft } from "@/lib/data/new-community";

/**
 * Homes by address, and amenities the board names itself.
 *
 * Not every community numbers its homes. The setup flow used to demand a
 * number for the founder and number ranges for everyone else, which a
 * subdivision of detached houses simply does not have. These pin the rule
 * that the address can be the key, and that a blank row in the list is
 * nothing rather than a home with no name.
 */
function byAddress(): CommunityDraft {
  return {
    ...emptyDraft(),
    name: "Alder Creek",
    city: "Bothell",
    state: "WA",
    stateName: "Washington",
    duesCents: 5000,
    propertyType: "single-family",
    origin: "existing",
    previously: "platform",
    founder: { name: "Pat Founder", email: "pat@example.com", unit: "", address: "1 Alder Way" },
    households: [
      { name: "Marcus Bell", email: "marcus@example.com", unit: "3 Alder Way", address: "3 Alder Way" },
      { name: "", email: "", unit: "5 Alder Way", address: "5 Alder Way" },
      { name: "", email: "", unit: "", address: "" },
      { name: "Pat Founder", email: "", unit: "1 Alder Way", address: "1 Alder Way" },
    ],
  };
}

describe("homes by address", () => {
  it("keys the founder's home on the address when there is no number", () => {
    expect(founderUnit(byAddress())).toBe("1 Alder Way");
    expect(founderUnit({ ...byAddress(), founder: { name: "", email: "", unit: "12", address: "x" } })).toBe("12");
  });

  it("drops blank rows and the founder's own row from the other homes", () => {
    const homes = otherHomes(byAddress());
    expect(homes.map((h) => h.unit)).toEqual(["3 Alder Way", "5 Alder Way"]);
    expect(unitCount(byAddress())).toBe(3);
  });

  it("settles the key and trims everything before creation", () => {
    const done = finalizeDraft({
      ...byAddress(),
      households: [{ name: "  A ", email: " a@x.io ", unit: " 7 Alder Way ", address: " 7 Alder Way " }],
      customSpaces: [" Dog park ", ""],
    });
    expect(done.founder.unit).toBe("1 Alder Way");
    expect(done.households).toEqual([
      { name: "A", email: "a@x.io", unit: "7 Alder Way", address: "7 Alder Way" },
    ]);
    expect(done.customSpaces).toEqual(["Dog park"]);
  });

  it("puts the address on the roster rather than an invented number", () => {
    const community = buildCommunity(finalizeDraft(byAddress()), "2026-08-20");
    const addresses = community.owners.map((o) => o.address).sort();
    expect(addresses).toEqual(["1 Alder Way", "3 Alder Way", "5 Alder Way"]);
    expect(community.owners.find((o) => o.boardRole === "President")?.unit).toBe("1 Alder Way");
  });

  it("suggests addresses for owners who already run detached homes, numbers otherwise", () => {
    expect(defaultHomeNaming(byAddress())).toBe("addresses");
    expect(defaultHomeNaming({ ...byAddress(), propertyType: "condos" })).toBe("numbers");
    expect(defaultHomeNaming({ ...byAddress(), origin: "builder" })).toBe("numbers");
  });
});

describe("amenities the board names", () => {
  it("become reservable amenities beside the listed ones", () => {
    const amenities = amenitiesFromSpaces(["pool", "gate"], ["Dog park", " "]);
    expect(amenities.map((a) => a.name)).toEqual(["Pool", "Dog park"]);
    expect(amenities.every((a) => a.reservable)).toBe(true);
    expect(new Set(amenities.map((a) => a.id)).size).toBe(2);
  });
});
