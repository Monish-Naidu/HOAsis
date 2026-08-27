import { describe, expect, it } from "vitest";
import { buildPlan, profileFromCommunity, profileFromDraft } from "@/lib/setup-plan";
import { portingPlan } from "@/lib/porting";
import { mehrMeadows } from "@/lib/data/communities";
import { emptyDraft } from "@/lib/data/new-community";
import type { AssociationProfile } from "@/lib/setup-plan";

const base: AssociationProfile = {
  propertyType: "single-family",
  origin: "builder",
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

  it("never asks a builder about vendors it has not hired yet", () => {
    // Whoever cuts the grass on a site still being built is on the
    // construction contract, not on the association's.
    expect(keys({ origin: "builder" })).not.toContain("vendors");
    // A board taking over inherits vendors it did not choose, some of them
    // under contracts held in the builder's own name.
    expect(keys({ origin: "handover" })).toContain("vendors");
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
      origin: "handover" as const,
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

describe("the first weeks of a community still being built", () => {
  it("gives each situation a different job, not a reworded list", () => {
    const titles = (["builder", "handover", "existing"] as const).map(
      (o) => portingPlan(o)!.title,
    );
    expect(new Set(titles).size, "two situations got the same plan").toBe(3);
  });

  it("tells an established association to set one opening balance and stop there", () => {
    const plan = portingPlan("existing")!;
    const keys = plan.steps.map((s) => s.key);
    // Homes before balances, because a balance needs somewhere to sit.
    expect(keys.indexOf("homes")).toBeLessThan(keys.indexOf("balances"));
    const balances = plan.steps.find((s) => s.key === "balances")!;
    expect(balances.detail).toContain("day you switched");
    // The claim that makes this tractable: nothing before the switch moves.
    expect(balances.because).toContain("Importing years of history is where migrations stall");
  });

  it("tells a builder to constitute the association and charge its own unsold lots", () => {
    const keys = portingPlan("builder")!.steps.map((s) => s.key);
    expect(keys[0], "the EIN gates the bank account, so it comes first").toBe("ein");
    // The largest source of turnover litigation, and the one a builder
    // setting its own budget has every incentive to leave out.
    expect(keys).toContain("unsold");
  });

  it("tells a board taking over to study the place before it signs a release", () => {
    const plan = portingPlan("handover")!;
    // Order is the entire argument here. A release signed before the study is
    // a release signed without knowing what it gives up.
    expect(plan.steps[0].key).toBe("turnover-study");
    expect(plan.steps[0].because).toContain("release");
  });

  it("never tells anyone to import or migrate records", () => {
    // There is no prior association to move. A step about a roster export
    // would mean the flow had drifted back to the market we left.
    for (const origin of ["builder", "handover", "existing"] as const) {
      const plan = portingPlan(origin)!;
      const words = plan.steps.map((s) => `${s.title} ${s.detail}`).join(" ").toLowerCase();
      // "Import" is allowed to appear nowhere in a step title or detail. The
      // one place history is discussed is the reason line on the balances
      // step, which exists to say that history does not move.
      expect(words, `${origin} mentions a migration`).not.toMatch(
        /spreadsheet|csv|export|import|management company/,
      );
    }
  });
});
