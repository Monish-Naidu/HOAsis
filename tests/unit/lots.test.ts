import { describe, expect, it } from "vitest";
import {
  expandPhases,
  firstPhase,
  lotLabel,
  lotsInPhase,
  nextPhase,
  phaseProblems,
  totalLots,
  type LotPhase,
} from "@/lib/lots";
import {
  buildCommunity,
  emptyDraft,
  finalizeDraft,
  founderLabel,
  otherHomes,
  unitCount,
} from "@/lib/data/new-community";

/**
 * Homes that come from a plat rather than from a spreadsheet.
 *
 * A new build has no roster to import. It has numbered lots released in
 * phases, and buyers who arrive one closing at a time. These tests are mostly
 * about the ways a builder mistypes a range, because the failures are quiet:
 * two Lot 44s bills one home twice, and a backwards range creates nothing at
 * all while looking like it worked.
 */

function phase(patch: Partial<LotPhase>): LotPhase {
  return { id: "p1", label: "Phase 1", from: 1, to: 10, ...patch };
}

describe("lotsInPhase", () => {
  it("counts an inclusive range", () => {
    expect(lotsInPhase(phase({ from: 1, to: 44 }))).toBe(44);
    expect(lotsInPhase(phase({ from: 45, to: 88 }))).toBe(44);
  });

  it("counts a single lot", () => {
    expect(lotsInPhase(phase({ from: 7, to: 7 }))).toBe(1);
  });

  it("counts nothing for a range that runs backwards", () => {
    expect(lotsInPhase(phase({ from: 44, to: 1 }))).toBe(0);
  });

  it("counts nothing while a field is still empty", () => {
    // The `to` box is blank until the builder types, and NaN through
    // arithmetic produces a home count of NaN on screen.
    expect(lotsInPhase(phase({ to: Number.NaN }))).toBe(0);
  });
});

describe("lotLabel", () => {
  it("uses the plain number when there is no prefix", () => {
    expect(lotLabel("", 12)).toBe("12");
    expect(lotLabel("   ", 12)).toBe("12");
  });

  it("spaces a word prefix and joins a punctuated one", () => {
    // A builder types "Lot" or "A-", and each wants different spacing.
    expect(lotLabel("Lot", 12)).toBe("Lot 12");
    expect(lotLabel("Unit", 12)).toBe("Unit 12");
    expect(lotLabel("A-", 12)).toBe("A-12");
    expect(lotLabel("B/", 3)).toBe("B/3");
  });
});

describe("phaseProblems", () => {
  it("says nothing about phases that sit end to end", () => {
    expect(
      phaseProblems([
        phase({ id: "p1", from: 1, to: 44 }),
        phase({ id: "p2", label: "Phase 2", from: 45, to: 88 }),
      ]),
    ).toEqual([]);
  });

  it("catches the off by one that puts two owners in one home", () => {
    // Phase 2 starting where Phase 1 ended rather than after it. Silently
    // dropping the duplicate bills one home twice or loses one entirely.
    const problems = phaseProblems([
      phase({ id: "p1", from: 1, to: 44 }),
      phase({ id: "p2", label: "Phase 2", from: 44, to: 88 }),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe("overlap");
    expect(problems[0].message).toContain("44");
  });

  it("names a backwards range rather than creating nothing quietly", () => {
    const problems = phaseProblems([phase({ from: 88, to: 1 })]);
    expect(problems[0].kind).toBe("reversed");
    expect(problems[0].message).toContain("Swap them round");
  });

  it("says nothing about a range nobody has finished typing", () => {
    // `firstPhase` starts at 1 with no last number, so the untouched first row
    // was reporting itself as backwards before the reader had typed anything.
    expect(phaseProblems([phase({ from: 1, to: 0 })])).toEqual([]);
  });

  it("catches a missed decimal point", () => {
    const problems = phaseProblems([phase({ from: 1, to: 10_000 })]);
    expect(problems[0].kind).toBe("too-many");
    expect(problems[0].message).toContain("Check the numbers");
  });

  it("lists several overlapping lots without printing all of them", () => {
    const problems = phaseProblems([
      phase({ id: "p1", from: 1, to: 20 }),
      phase({ id: "p2", label: "Phase 2", from: 1, to: 20 }),
    ]);
    expect(problems[0].message).toContain("and others");
  });

  it("still warns when two ranges were given the same name", () => {
    // The overlap was told apart by label, so two rows both called "Phase 1"
    // read as one range and the doubled lots went through unremarked.
    const problems = phaseProblems([
      phase({ id: "p1", label: "Phase 1", from: 1, to: 10 }),
      phase({ id: "p2", label: "Phase 1", from: 10, to: 20 }),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ phaseId: "p2", kind: "overlap" });
    expect(problems[0].message).toBe("Lot 10 is listed twice.");
  });
});

describe("expandPhases", () => {
  it("creates every lot in order", () => {
    const lots = expandPhases([
      phase({ id: "p1", from: 1, to: 3 }),
      phase({ id: "p2", label: "Phase 2", from: 4, to: 5 }),
    ]);
    expect(lots).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("applies the prefix to every lot", () => {
    expect(expandPhases([phase({ from: 1, to: 2 })], "Lot")).toEqual(["Lot 1", "Lot 2"]);
  });

  it("contributes nothing from a phase that has a problem", () => {
    // Half of a bad range is worse than none of it: the builder sees a home
    // count that looks plausible and never checks.
    const lots = expandPhases([
      phase({ id: "p1", from: 1, to: 3 }),
      phase({ id: "p2", label: "Phase 2", from: 3, to: 5 }),
    ]);
    expect(lots).toEqual(["1", "2", "3"]);
  });

  it("never produces the same lot twice", () => {
    const lots = expandPhases([phase({ from: 1, to: 50 })], "Lot");
    expect(new Set(lots).size).toBe(lots.length);
  });

  it("counts what it produced, not what was asked for", () => {
    expect(totalLots([phase({ from: 1, to: 88 })])).toBe(88);
    expect(totalLots([phase({ from: 88, to: 1 })])).toBe(0);
  });
});

describe("adding phases", () => {
  it("starts with one phase waiting for a number", () => {
    const first = firstPhase();
    expect(first.label).toBe("Phase 1");
    expect(lotsInPhase(first)).toBe(0);
  });

  it("starts the next phase after the last lot of the previous one", () => {
    const second = nextPhase([phase({ from: 1, to: 44 })]);
    expect(second.label).toBe("Phase 2");
    expect(second.from).toBe(45);
  });

  it("starts at one when nothing usable has been entered yet", () => {
    expect(nextPhase([phase({ from: 1, to: 0 })]).from).toBe(1);
  });

  it("never hands a new row the id of one still on screen", () => {
    // Three phases, the middle one removed, one added. Counting the rows
    // made the new one "phase-3" beside the Phase 3 already there, and the
    // two then took every edit and every removal together.
    const one = { ...firstPhase(), to: 44 };
    const two = { ...nextPhase([one]), to: 60 };
    const three = { ...nextPhase([one, two]), to: 88 };
    expect([one.id, two.id, three.id]).toEqual(["phase-1", "phase-2", "phase-3"]);

    const kept = [one, three];
    const added = nextPhase(kept);
    expect(added.id).toBe("phase-4");
    expect(added.label).toBe("Phase 4");
    expect(added.from).toBe(89);
    expect(new Set([...kept, added].map((p) => p.id)).size).toBe(3);
  });

  it("counts the rows when the ids carry no number", () => {
    const added = nextPhase([phase({ id: "meadows" }), phase({ id: "orchard", from: 11, to: 20 })]);
    expect(added.id).toBe("phase-3");
  });
});

/* -------------------------------------------------------------------------- */

describe("the founder's own lot", () => {
  it("is counted once, however the builder fills the screen in", () => {
    // The founder types their lot separately and the plat also generates it,
    // so it arrives in the list twice. Two owners for one home, two ledgers,
    // and a unit count one too high, all of them quiet.
    const draft = {
      ...emptyDraft(),
      founder: { name: "Pat", email: "pat@example.com", unit: "Lot 1" },
      households: expandPhases([{ id: "p1", label: "Phase 1", from: 1, to: 5 }], "Lot").map(
        (unit) => ({ name: "", email: "", unit }),
      ),
    };

    expect(draft.households).toHaveLength(5);
    expect(otherHomes(draft).map((h) => h.unit)).toEqual(["Lot 2", "Lot 3", "Lot 4", "Lot 5"]);
    expect(unitCount(draft), "the founder was counted twice").toBe(5);
  });

  it("builds one owner per lot, with the founder holding their own", () => {
    const draft = {
      ...emptyDraft(),
      name: "Ridgeline",
      builderName: "Ridgeline Homes",
      founder: { name: "Pat", email: "pat@example.com", unit: "Lot 1" },
      households: expandPhases([{ id: "p1", label: "Phase 1", from: 1, to: 4 }], "Lot").map(
        (unit) => ({ name: "", email: "", unit }),
      ),
    };

    const community = buildCommunity(draft, "2026-08-26");
    expect(community.owners).toHaveLength(4);
    expect(new Set(community.owners.map((o) => o.id)).size).toBe(4);
    expect(community.owners.find((o) => o.unit === "Lot 1")?.displayName).toBe("Pat");
    // An unsold lot is not vacant. Somebody owns it and owes the assessment.
    expect(community.owners.find((o) => o.unit === "Lot 2")?.displayName).toBe(
      "Ridgeline Homes",
    );
  });

  it("is counted once when the number was typed bare and the plat adds a prefix", () => {
    // What the form leads to: "12" on the screen that asks for a number,
    // then ranges 1 to 40 with the prefix "Lot". Matched letter for letter,
    // "12" and "Lot 12" were two homes, 41 on a 40 lot plat.
    const draft = {
      ...emptyDraft(),
      founder: { name: "Pat", email: "pat@example.com", unit: "12" },
      lotPrefix: "Lot",
      phases: [{ id: "phase-1", label: "Phase 1", from: 1, to: 40 }],
      households: expandPhases([{ id: "phase-1", label: "Phase 1", from: 1, to: 40 }], "Lot").map(
        (unit) => ({ name: "", email: "", unit }),
      ),
    };

    expect(founderLabel(draft)).toBe("Lot 12");
    expect(unitCount(draft)).toBe(40);
    expect(otherHomes(draft).some((h) => h.unit === "Lot 12")).toBe(false);

    const final = finalizeDraft(draft);
    expect(final.founder.unit).toBe("Lot 12");
    expect(final.households).toHaveLength(39);

    const community = buildCommunity(final, "2026-08-26");
    expect(community.owners).toHaveLength(40);
    expect(community.owners.filter((o) => o.unit === "Lot 12").map((o) => o.displayName)).toEqual(["Pat"]);
    expect(community.owners.some((o) => o.unit === "12")).toBe(false);
  });

  it("finds the founder under a joined prefix and in any case", () => {
    const phases = [{ id: "phase-1", label: "Building A", from: 1, to: 20 }];
    const base = { ...emptyDraft(), lotPrefix: "A-", phases };
    const founder = (unit: string) => ({ name: "Pat", email: "pat@example.com", unit });
    expect(founderLabel({ ...base, founder: founder("12") })).toBe("A-12");
    expect(founderLabel({ ...base, founder: founder("a-12") })).toBe("A-12");
    expect(founderLabel({ ...base, lotPrefix: "Lot", founder: founder("LOT 12") })).toBe("Lot 12");
    // A number outside every range is left as it was typed.
    expect(founderLabel({ ...base, founder: founder("99") })).toBe("99");
  });

  it("leaves a community that goes by address alone", () => {
    const draft = {
      ...emptyDraft(),
      founder: { name: "Pat", email: "pat@example.com", unit: "", address: "12 Alder Way" },
      households: [{ name: "", email: "", unit: "14 Alder Way" }],
    };
    expect(founderLabel(draft)).toBe("12 Alder Way");
    expect(finalizeDraft(draft).founder.unit).toBe("12 Alder Way");
    expect(unitCount(draft)).toBe(2);
  });

  it("gives a login to the sold lots only", () => {
    const draft = {
      ...emptyDraft(),
      founder: { name: "Pat", email: "pat@example.com", unit: "1" },
      households: [
        { name: "Marcus Bell", email: "marcus@example.com", unit: "2" },
        { name: "", email: "", unit: "3" },
      ],
    };

    const community = buildCommunity(draft, "2026-08-26");
    // A resident seat for a home nobody lives in can never be signed into.
    expect(community.accounts.map((a) => a.unit).sort()).toEqual(["1", "2"]);
  });
});
