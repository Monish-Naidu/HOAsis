import { describe, expect, it } from "vitest";
import { buildPlan, profileFromCommunity, profileFromDraft } from "@/lib/setup-plan";
import { portingPlan, recordsDemandLetter } from "@/lib/porting";
import { mehrMeadows } from "@/lib/data/communities";
import { emptyDraft } from "@/lib/data/new-community";
import type { AssociationProfile } from "@/lib/setup-plan";

const base: AssociationProfile = {
  propertyType: "single-family",
  origin: "new",
  collects: [],
  sharedSpaces: [],
  homes: 40,
  stateName: "Washington",
};

const keys = (profile: Partial<AssociationProfile>) =>
  buildPlan(mehrMeadows, { ...base, ...profile }).phases.flatMap((p) =>
    p.tasks.map((t) => t.key),
  );

describe("the plan is built from the answers", () => {
  it("asks a condominium about the building it owns", () => {
    const condo = keys({ propertyType: "condos" });
    expect(condo).toContain("structural");
    expect(condo).toContain("maintenance-matrix");
  });

  it("asks townhomes who fixes a shared roof, but not about milestone inspections", () => {
    const town = keys({ propertyType: "townhomes" });
    expect(town).toContain("maintenance-matrix");
    // A townhome association does not own a building the way a condo does.
    expect(town).not.toContain("structural");
  });

  it("asks detached homes about neither", () => {
    const detached = keys({ propertyType: "single-family" });
    expect(detached).not.toContain("maintenance-matrix");
    expect(detached).not.toContain("structural");
  });

  it("never asks a brand new association about vendors it has not hired", () => {
    expect(keys({ origin: "new" })).not.toContain("vendors");
    expect(keys({ origin: "leaving-manager" })).toContain("vendors");
  });

  it("only offers amenities when the board said they have some", () => {
    expect(keys({ sharedSpaces: [] })).not.toContain("amenities");
    expect(keys({ sharedSpaces: ["pool"] })).toContain("amenities");
  });

  it("does not ask a four home association to appoint a board", () => {
    expect(keys({ homes: 3 })).not.toContain("board");
    expect(keys({ homes: 40 })).toContain("board");
  });

  it("orders phases so getting paid comes first", () => {
    const plan = buildPlan(mehrMeadows, base);
    expect(plan.phases[0].id).toBe("collect");
    // The milestone is announced rather than inferred from a fraction.
    expect(plan.phases[0].outcome).toMatch(/take a payment/);
  });

  it("counts what it left out, which is the argument for asking", () => {
    const plan = buildPlan(mehrMeadows, base);
    expect(plan.skipped).toBeGreaterThan(0);
    expect(plan.total + plan.skipped).toBeGreaterThanOrEqual(plan.total);
  });

  it("falls back to showing everything for an association with no answers", () => {
    // The shipped demos predate the questions. An association we know nothing
    // about should be shown everything, which is the old behaviour.
    const profile = profileFromCommunity(mehrMeadows);
    expect(profile.collects).toEqual([]);
    expect(buildPlan(mehrMeadows, profile).total).toBeGreaterThan(0);
  });

  it("reads a draft's answers straight through", () => {
    const draft = {
      ...emptyDraft(),
      propertyType: "condos" as const,
      origin: "leaving-manager" as const,
      collects: ["utilities" as const],
      sharedSpaces: ["pool" as const],
      stateName: "Florida",
      households: [{ name: "A", email: "a@example.com", unit: "2" }],
    };
    const profile = profileFromDraft(draft);
    expect(profile.propertyType).toBe("condos");
    expect(profile.stateName).toBe("Florida");
    // The founder counts as a home too.
    expect(profile.homes).toBe(2);
  });
});

describe("porting an existing association", () => {
  it("gives each situation a different job, not a reworded list", () => {
    const titles = (["new", "self-managed", "leaving-manager"] as const).map(
      (o) => portingPlan(o)!.title,
    );
    expect(new Set(titles).size, "two situations got the same plan").toBe(3);
  });

  it("tells a board leaving a manager to demand records before giving notice", () => {
    const plan = portingPlan("leaving-manager")!;
    // Order is the entire argument here, so the demand must come first and
    // giving notice must come last.
    expect(plan.steps[0].key).toBe("demand");
    expect(plan.steps.at(-1)!.key).toBe("then-cancel");
  });

  it("does not tell a brand new association to import anything", () => {
    const keys = portingPlan("new")!.steps.map((s) => s.key);
    expect(keys).toContain("ein");
    expect(keys).not.toContain("roster");
  });

  it("writes the demand letter rather than leaving blanks", () => {
    const letter = recordsDemandLetter({
      associationName: "Harbor Point Condominiums",
      stateName: "Washington",
      managerName: "Cascade Community Management",
      boardMemberName: "Pat Founder",
      boardRole: "President",
      today: "August 26, 2026",
    });

    expect(letter).toContain("Harbor Point Condominiums");
    expect(letter).toContain("Cascade Community Management");
    expect(letter).toContain("Pat Founder");
    // The ten categories a board would otherwise forget.
    expect(letter).toContain("general ledger");
    expect(letter).toContain("reserve study");
    // And the sentence that stops it reading as a termination notice, which
    // is what destroys the leverage it exists to use.
    expect(letter).toContain("not notice of termination");
    expect(letter).not.toMatch(/\[(?!management company)/);
  });

  it("names the manager as a placeholder only when it does not know one", () => {
    const letter = recordsDemandLetter({
      associationName: "A HOA",
      stateName: "Texas",
      boardMemberName: "Pat",
      boardRole: "President",
      today: "August 26, 2026",
    });
    expect(letter).toContain("[management company]");
  });
});
