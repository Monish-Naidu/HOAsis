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
  draftDuesTotal,
} from "@/lib/data/new-community";
import { countByType, describeMix, duesFor, duesVary, totalDues } from "@/lib/home-types";
import { wordingFor } from "@/lib/wording";
import { buildPlan, profileFromDraft } from "@/lib/setup-plan";
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
      { name: "A", email: "a@x.io", unit: "7 Alder Way", address: "7 Alder Way", homeType: "single-family" },
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

/**
 * A community with more than one kind of home.
 *
 * Townhomes by the entry, condos over the clubhouse. Each home carries its
 * kind from the range it was generated from, each kind can pay its own
 * dues, and the plan asks for whatever any of the kinds needs.
 */
function mixed(): CommunityDraft {
  return {
    ...emptyDraft(),
    name: "Juniper Row",
    city: "Bothell",
    state: "WA",
    stateName: "Washington",
    duesCents: 30_000,
    duesByType: { townhomes: 30_000, condos: 42_000 },
    homeTypes: ["townhomes", "condos"],
    origin: "builder",
    founder: { name: "Pat Founder", email: "pat@example.com", unit: "22" },
    phases: [
      { id: "phase-1", label: "Townhomes", from: 1, to: 20, homeType: "townhomes" },
      { id: "phase-2", label: "Building A", from: 21, to: 40, homeType: "condos" },
    ],
    households: Array.from({ length: 40 }, (_, i) => ({
      name: "",
      email: "",
      unit: String(i + 1),
      homeType: i < 20 ? ("townhomes" as const) : ("condos" as const),
    })),
  };
}

describe("a mix of homes", () => {
  it("gives the founder the kind of the range their number is in", () => {
    const done = finalizeDraft({ ...mixed(), founder: { ...mixed().founder, homeType: "townhomes" } });
    expect(done.founder.homeType).toBe("condos");
    expect(done.propertyType).toBeUndefined();
    expect(done.homeTypes).toEqual(["townhomes", "condos"]);
  });

  it("keeps a per-kind amount only where it differs", () => {
    const done = finalizeDraft(mixed());
    expect(done.duesByType).toEqual({ condos: 42_000 });
    expect(draftDuesTotal(done)).toBe(20 * 30_000 + 20 * 42_000);
  });

  it("drops per-kind amounts for a community of one kind", () => {
    const done = finalizeDraft({ ...mixed(), homeTypes: ["townhomes"] });
    expect(done.propertyType).toBe("townhomes");
    expect(done.duesByType).toBeUndefined();
    expect(done.households.every((h) => h.homeType === "townhomes")).toBe(true);
  });

  it("bills each home its own kind's dues", () => {
    const community = buildCommunity(finalizeDraft(mixed()), "2026-08-20");
    const condo = community.owners.find((o) => o.unit === "30")!;
    const town = community.owners.find((o) => o.unit === "3")!;
    expect(duesFor(community.association, condo.homeType)).toBe(42_000);
    expect(duesFor(community.association, town.homeType)).toBe(30_000);
    expect(duesVary(community.association)).toBe(true);
    expect(totalDues(community.association, community.owners)).toBe(20 * 30_000 + 20 * 42_000);
    expect(community.budget[0].annualCents).toBe((20 * 30_000 + 20 * 42_000) * 12);
  });

  it("describes the mix in plain words", () => {
    const community = buildCommunity(finalizeDraft(mixed()), "2026-08-20");
    expect(countByType(community.owners)).toEqual([
      { type: "townhomes", count: 20 },
      { type: "condos", count: 20 },
    ]);
    expect(describeMix(community.owners)).toBe("20 townhomes and 20 condos");
  });

  it("uses words that fit every kind", () => {
    expect(wordingFor(["condos"]).home).toBe("unit");
    expect(wordingFor(["condos", "single-family"]).home).toBe("home");
    expect(wordingFor(["single-family"]).numberExample).toBe("Lot");
    expect(wordingFor(["single-family", "townhomes"]).numberExample).toBe("Unit");
  });

  it("asks for what any of the kinds needs", () => {
    const keys = (d: CommunityDraft) =>
      buildPlan(buildCommunity(finalizeDraft(d), "2026-08-20"), profileFromDraft(finalizeDraft(d)))
        .phases.flatMap((p) => p.tasks.map((t) => t.key));
    const withCondos = keys({ ...mixed(), homeTypes: ["single-family", "condos"] });
    expect(withCondos).toContain("structural");
    expect(withCondos).toContain("maintenance-matrix");
    const detached = keys({ ...mixed(), homeTypes: ["single-family"], stateName: "Idaho" });
    expect(detached).not.toContain("structural");
    expect(detached).not.toContain("maintenance-matrix");
  });
});
