import { describe, expect, it } from "vitest";
import { wordingFor } from "@/lib/wording";

/**
 * The setup flow asked what kind of homes these are and who is setting the
 * association up, and then spent the next screen ignoring both answers.
 * Everybody got the builder's vocabulary. These are the rules that stop it
 * happening again.
 */
describe("wordingFor", () => {
  it("gives a builder lots and a phase", () => {
    const w = wordingFor("single-family", "builder");
    expect(w.home).toBe("lot");
    expect(w.group).toBe("Phase");
    expect(w.fromBuilder).toBe(true);
  });

  it("gives an established association homes and a group", () => {
    const w = wordingFor("single-family", "existing");
    expect(w.home).toBe("home");
    expect(w.group).toBe("Group");
    // The one that matters: no builder means no builder field on the screen.
    expect(w.fromBuilder).toBe(false);
  });

  it("keeps the builder field for a board taking over, who still has one", () => {
    expect(wordingFor("townhomes", "handover").fromBuilder).toBe(true);
  });

  it("calls a condominium a unit whoever is asking", () => {
    expect(wordingFor("condos", "builder").home).toBe("unit");
    expect(wordingFor("condos", "existing").home).toBe("unit");
    expect(wordingFor("condos", "handover").home).toBe("unit");
  });

  it("only offers Lot as the number prefix where homes sit on their own lot", () => {
    expect(wordingFor("single-family", "existing").numberExample).toBe("Lot");
    expect(wordingFor("townhomes", "existing").numberExample).toBe("Unit");
    expect(wordingFor("condos", "existing").numberExample).toBe("Unit");
  });

  it("falls back to plain words before either question is answered", () => {
    const w = wordingFor(undefined, undefined);
    expect(w.home).toBe("home");
    expect(w.group).toBe("Group");
    expect(w.fromBuilder).toBe(false);
  });
});
