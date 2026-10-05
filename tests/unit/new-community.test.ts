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
  draftCollectionPolicy,
  draftDuesTotal,
} from "@/lib/data/new-community";
import { countByType, describeMix, duesFor, duesVary, totalDues } from "@/lib/home-types";
import { wordingFor } from "@/lib/wording";
import { policyProblems } from "@/lib/collections";
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

describe("a condo founder who leaves the unit number blank", () => {
  function condos(): CommunityDraft {
    return {
      ...emptyDraft(),
      name: "Harbor Court",
      city: "Bothell",
      state: "WA",
      stateName: "Washington",
      duesCents: 30_000,
      homeTypes: ["condos"],
      origin: "existing",
      previously: "fresh",
      founder: { name: "Pat Founder", email: "pat@example.com", unit: "", address: "1 Harbor Way" },
      phases: [{ id: "phase-1", label: "Building A", from: 1, to: 12 }],
      households: Array.from({ length: 12 }, (_, i) => ({ name: "", email: "", unit: String(i + 1) })),
    };
  }

  it("keeps twelve units twelve, and bills twelve", () => {
    const done = finalizeDraft(condos());
    expect(unitCount(done)).toBe(12);
    const community = buildCommunity(done, "2026-08-20");
    expect(community.owners).toHaveLength(12);
    expect(new Set(community.owners.map((o) => o.unit)).size).toBe(12);
    expect(draftDuesTotal(done)).toBe(12 * 30_000);
    // Still the President, in one of the twelve, with the address they gave.
    const mine = community.owners.find((o) => o.boardRole === "President")!;
    expect(mine.unit).toBe("1");
    expect(mine.address).toBe("1 Harbor Way");
  });

  it("promises on the homes step what it then creates", () => {
    // The walk's case: the founder types "1A", the range is 1 to 4. The
    // preview said 5 homes and $1,000 and the association was made with 4.
    const typed: CommunityDraft = {
      ...condos(),
      duesCents: 20_000,
      founder: { name: "Pat Founder", email: "pat@example.com", unit: "1A" },
      phases: [{ id: "phase-1", label: "Building B", from: 1, to: 4 }],
      households: Array.from({ length: 4 }, (_, i) => ({ name: "", email: "", unit: String(i + 1) })),
    };
    const done = finalizeDraft(typed);
    expect(unitCount(typed)).toBe(4);
    expect(unitCount(typed)).toBe(unitCount(done));
    expect(draftDuesTotal(typed)).toBe(4 * 20_000);
    expect(draftDuesTotal(typed)).toBe(draftDuesTotal(done));
    expect(buildCommunity(done, "2026-08-20").owners).toHaveLength(4);
  });

  it("does not move a founder whose number is in the ranges", () => {
    const done = finalizeDraft({ ...condos(), founder: { ...condos().founder, unit: "7" } });
    expect(done.founder.unit).toBe("7");
    expect(unitCount(done)).toBe(12);
  });

  it("leaves a founder alone when every home already has an owner", () => {
    const owned = condos();
    owned.households = owned.households.map((h) => ({ ...h, name: `Owner ${h.unit}` }));
    expect(unitCount(finalizeDraft(owned))).toBe(13);
  });
});

describe("a home with nobody named", () => {
  const draftFor = (origin: CommunityDraft["origin"]): CommunityDraft => ({
    ...emptyDraft(),
    name: "Alder Creek",
    homeTypes: ["single-family"],
    origin,
    founder: { name: "Pat", email: "pat@example.com", unit: "1" },
    households: [
      { name: "Marcus Bell", email: "marcus@example.com", unit: "2" },
      { name: "", email: "", unit: "3" },
    ],
  });
  const empty = (origin: CommunityDraft["origin"]) =>
    buildCommunity(finalizeDraft(draftFor(origin)), "2026-08-20").owners.find((o) => o.unit === "3")!;

  it("is not sold yet only when the builder is setting the community up", () => {
    expect(empty("builder").displayName).toBe("Not sold yet");
  });

  it("is simply without an owner for a turnover board and an established association", () => {
    expect(empty("handover").displayName).toBe("No owner listed");
    expect(empty("existing").displayName).toBe("No owner listed");
  });

  it("is marked a placeholder, so the roster does not call it paid up", () => {
    expect(empty("builder").placeholder).toBe(true);
    expect(empty("existing").placeholder).toBe(true);
    const named = buildCommunity(finalizeDraft(draftFor("existing")), "2026-08-20").owners.find(
      (o) => o.unit === "2",
    )!;
    expect(named.placeholder).toBe(false);
  });
});

describe("the late fee a founder chooses", () => {
  it("is none until one is chosen", () => {
    expect(draftCollectionPolicy(emptyDraft()).lateFeeCents).toBe(0);
    expect(draftCollectionPolicy({ ...emptyDraft(), lateFee: { charge: false, cents: 25_00, days: 30 } }).lateFeeCents).toBe(0);
    const community = buildCommunity(finalizeDraft({ ...emptyDraft(), homeTypes: ["single-family"], founder: { name: "P", email: "p@example.com", unit: "1" } }), "2026-08-20");
    expect(community.settings.collectionPolicy?.lateFeeCents).toBe(0);
  });

  it("becomes the policy, with the notice on the day chosen and a ladder that still climbs", () => {
    const policy = draftCollectionPolicy({ ...emptyDraft(), lateFee: { charge: true, cents: 10_00, days: 20 } });
    expect(policy.lateFeeCents).toBe(10_00);
    expect(policy.lateNoticeDay).toBe(20);
    expect(policyProblems(policy)).toEqual([]);
    const late = draftCollectionPolicy({ ...emptyDraft(), lateFee: { charge: true, cents: 25_00, days: 60 } });
    expect(late.lateNoticeDay).toBe(60);
    expect(policyProblems(late)).toEqual([]);
  });

  it("is no fee when the amount or the days are missing", () => {
    expect(draftCollectionPolicy({ ...emptyDraft(), lateFee: { charge: true, cents: 0, days: 30 } }).lateFeeCents).toBe(0);
    expect(draftCollectionPolicy({ ...emptyDraft(), lateFee: { charge: true, cents: 25_00, days: Number.NaN } }).lateFeeCents).toBe(0);
  });
});
