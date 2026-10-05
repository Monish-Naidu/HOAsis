import { describe, expect, it } from "vitest";
import {
  expandPhases,
  firstPhase,
  hasDetails,
  lotLabel,
  lotNumberOf,
  lotsInPhase,
  nextPhase,
  phaseFor,
  phaseProblems,
  rebuildLotHomes,
  sortParked,
  totalLots,
  type LotPhase,
} from "@/lib/lots";
import {
  buildCommunity,
  defaultHomeNaming,
  draftDuesTotal,
  emptyDraft,
  finalizeDraft,
  founderHomeType,
  founderLabel,
  homesAnswered,
  otherHomes,
  unitCount,
  type CommunityDraft,
  type DraftHousehold,
} from "@/lib/data/new-community";
import { parseProgress } from "@/app/start/wizard-progress";
import { mergeRoster } from "@/app/start/roster-import";
import type { RosterRow } from "@/lib/roster/csv";

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

  it("is counted once under a prefix typed with a space in front", () => {
    // " A-" prints " A-2". The rows are trimmed before they are compared,
    // so the founder's label has to be too, or lot 2 is created twice.
    const phases = [{ id: "phase-1", label: "Building A", from: 1, to: 4 }];
    const draft: CommunityDraft = {
      ...emptyDraft(),
      founder: { name: "Pat", email: "pat@example.com", unit: "2" },
      lotPrefix: " A-",
      phases,
      households: rebuildLotHomes<DraftHousehold>({ phases, prefix: " A-", households: [] }).households,
    };

    expect(draft.households).toHaveLength(4);
    expect(founderLabel(draft)).toBe("A-2");
    expect(unitCount(draft)).toBe(4);

    const final = finalizeDraft(draft);
    expect(final.founder.unit).toBe("A-2");
    expect(final.households.map((h) => h.unit)).toEqual(["A-1", "A-3", "A-4"]);
    const community = buildCommunity(final, "2026-08-26");
    expect(community.owners).toHaveLength(4);
    expect(community.owners.filter((o) => o.unit === "A-2").map((o) => o.displayName)).toEqual(["Pat"]);
  });

  it("gives the founder their range's kind of home under that prefix, typed either way", () => {
    const phases: LotPhase[] = [
      { id: "phase-1", label: "Building A", from: 1, to: 4, homeType: "condos" },
    ];
    const base: CommunityDraft = {
      ...emptyDraft(),
      homeTypes: ["townhomes", "condos"],
      lotPrefix: " A-",
      phases,
    };
    const founder = (unit: string) => ({ name: "Pat", email: "pat@example.com", unit });
    expect(founderHomeType({ ...base, founder: founder("2") })).toBe("condos");
    expect(founderHomeType({ ...base, founder: founder("A-2") })).toBe("condos");
    expect(phaseFor(phases, " A-", "A-2")?.id).toBe("phase-1");
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

/**
 * The list is rebuilt on every keystroke in a range or the prefix, and it
 * used to keep only the rows whose printed label came out the same. These
 * walk the keystrokes a board actually types and check nobody goes missing.
 */
describe("rebuilding the homes while the ranges are typed", () => {
  const range = (to: number, from = 1): LotPhase[] => [{ id: "phase-1", label: "Phase 1", from, to }];
  // What the homes question holds between keystrokes.
  type State = { households: DraftHousehold[]; parked: DraftHousehold[]; prefix: string };
  const start: State = { households: [], parked: [], prefix: "" };
  const type = (state: State, phases: LotPhase[], prefix = state.prefix): State => ({
    ...rebuildLotHomes<DraftHousehold>({
      phases,
      prefix,
      previousPrefix: state.prefix,
      households: state.households,
      parked: state.parked,
      fallbackType: "townhomes",
    }),
    prefix,
  });
  const name = (state: State, unit: string, who: string): State => ({
    ...state,
    households: state.households.map((h) =>
      h.unit === unit ? { ...h, name: who, email: `${who.toLowerCase()}@example.com` } : h,
    ),
  });
  const named = (state: State) =>
    state.households.filter((h) => h.name).map((h) => `${h.unit}: ${h.name}`);

  it("reads a lot number from the whole label only", () => {
    expect(lotNumberOf("12")).toBe(12);
    expect(lotNumberOf(" Lot 12 ", ["Lot"])).toBe(12);
    expect(lotNumberOf("lot 12", ["Lot"])).toBe(12);
    expect(lotNumberOf("A-12", ["A-"])).toBe(12);
    // An address that starts or ends with a number is not a lot.
    expect(lotNumberOf("12 Oak St", ["Lot"])).toBeUndefined();
    expect(lotNumberOf("Oak St 12", ["Lot"])).toBeUndefined();
    expect(lotNumberOf("Lot 12")).toBeUndefined();
    expect(lotNumberOf("")).toBeUndefined();
  });

  it("reads a row's own label back when the prefix was typed with a space in front", () => {
    // " A-" prints " A-12", and the row is trimmed before it is compared.
    expect(lotNumberOf(lotLabel(" A-", 12), [" A-"])).toBe(12);
    expect(lotNumberOf("a-12", [" A-"])).toBe(12);
  });

  it("keeps every buyer under a prefix with a leading space", () => {
    let s = type(start, range(6), " A-");
    s = name(s, " A-3", "Ana");
    // The next keystroke in a range used to park every named row.
    s = type(s, range(7), " A-");
    expect(named(s)).toEqual([" A-3: Ana"]);
    expect(s.parked).toEqual([]);
  });

  it("knows a blank lot from one somebody filled in", () => {
    expect(hasDetails({ unit: "4", name: "", email: " ", homeType: "condos" })).toBe(false);
    expect(hasDetails({ unit: "4", name: "Ana", email: "" })).toBe(true);
    // A balance of zero from a spreadsheet is still something entered.
    expect(hasDetails({ unit: "4", name: "", email: "", openingBalanceCents: 0 } as DraftHousehold)).toBe(true);
  });

  it("keeps every buyer when a range is shrunk and grown again", () => {
    let s = type(start, range(44));
    s = name(name(s, "5", "Ana"), "44", "Bo");
    // Changing 44 to 48: backspace leaves 4, then the 8 is typed.
    s = type(s, range(4));
    expect(s.households).toHaveLength(4);
    expect(s.parked.map((h) => h.unit)).toEqual(["5", "44"]);
    s = type(s, range(48));
    expect(s.households).toHaveLength(48);
    expect(named(s)).toEqual(["5: Ana", "44: Bo"]);
    expect(s.parked).toEqual([]);
  });

  it("keeps every buyer when a field is cleared and retyped", () => {
    let s = name(type(start, range(12)), "7", "Ana");
    // An emptied number field parses to NaN, which is no lots at all.
    s = type(s, range(Number.NaN));
    expect(s.households).toEqual([]);
    expect(s.parked.map((h) => h.name)).toEqual(["Ana"]);
    s = type(s, range(1));
    s = type(s, range(12));
    expect(named(s)).toEqual(["7: Ana"]);
    expect(s.parked).toEqual([]);
  });

  it("keeps every buyer while a prefix is typed a letter at a time", () => {
    let s = name(type(start, range(6)), "3", "Ana");
    for (const prefix of ["L", "Lo", "Lot"]) s = type(s, range(6), prefix);
    expect(s.households.map((h) => h.unit)).toEqual(["Lot 1", "Lot 2", "Lot 3", "Lot 4", "Lot 5", "Lot 6"]);
    expect(named(s)).toEqual(["Lot 3: Ana"]);
    // And back off again.
    s = type(s, range(6), "");
    expect(named(s)).toEqual(["3: Ana"]);
  });

  it("finds a parked row again after the prefix changed while it waited", () => {
    let s = name(type(start, range(10), "Lot"), "Lot 9", "Ana");
    s = type(s, range(4), "Lot");
    s = type(s, range(4), "Unit");
    s = type(s, range(10), "Unit");
    expect(named(s)).toEqual(["Unit 9: Ana"]);
  });

  it("keeps a spreadsheet imported before any range was typed", () => {
    // Forty rows from a file, each with a phone and what it owes.
    const rows = Array.from({ length: 40 }, (_, i) => ({
      name: `Owner ${i + 1}`,
      email: `o${i + 1}@example.com`,
      unit: String(i + 1),
      phone: "555-0100",
      openingBalanceCents: 1_000 * (i + 1),
    })) as DraftHousehold[];
    let s: State = { households: rows, parked: [], prefix: "" };
    // Typing "40" passes through "4".
    s = type(s, range(4));
    expect(s.households).toHaveLength(4);
    expect(s.parked).toHaveLength(36);
    s = type(s, range(40));
    expect(s.parked).toEqual([]);
    expect(s.households.map((h) => h.name)).toEqual(rows.map((h) => h.name));
    // The fields the draft type does not know ride along untouched.
    expect(s.households[39]).toMatchObject({ unit: "40", phone: "555-0100", openingBalanceCents: 40_000 });
  });

  it("parks a row no range covers, and never takes an address for a lot", () => {
    const rows: DraftHousehold[] = [
      { name: "Ana", email: "", unit: "45" },
      { name: "Bo", email: "", unit: "12 Oak St" },
      { name: "", email: "", unit: "46" },
    ];
    const s = type({ households: rows, parked: [], prefix: "" }, range(40));
    expect(s.households).toHaveLength(40);
    expect(s.households.every((h) => !h.name)).toBe(true);
    // The blank row carried nothing, so there is nothing to keep.
    expect(s.parked.map((h) => h.unit)).toEqual(["45", "12 Oak St"]);
  });

  it("gives every home its range's kind, and the fallback where the range has none", () => {
    const s = type(start, [
      { id: "phase-1", label: "A", from: 1, to: 2, homeType: "condos" },
      { id: "phase-2", label: "B", from: 3, to: 3 },
    ]);
    expect(s.households.map((h) => h.homeType)).toEqual(["condos", "condos", "townhomes"]);
  });

  it("never counts, bills or creates a parked row", () => {
    const draft: CommunityDraft = {
      ...emptyDraft(),
      duesCents: 10_000,
      founder: { name: "Pat", email: "pat@example.com", unit: "1" },
      phases: range(4),
      households: ["1", "2", "3", "4"].map((unit) => ({ name: "", email: "", unit })),
      parkedHouseholds: [
        { name: "Ana", email: "ana@example.com", unit: "5" },
        { name: "Bo", email: "", unit: "12 Oak St" },
      ],
    };
    expect(unitCount(draft)).toBe(4);
    expect(otherHomes(draft).map((h) => h.unit)).toEqual(["2", "3", "4"]);
    expect(draftDuesTotal(draft)).toBe(4 * 10_000);
    const final = finalizeDraft(draft);
    expect(final.parkedHouseholds).toBeUndefined();
    expect(final.households.map((h) => h.unit)).toEqual(["2", "3", "4"]);
    // What is held while an email is confirmed is this JSON, and it has no
    // trace of them.
    expect(JSON.stringify(final)).not.toContain("Ana");
    expect(buildCommunity(final, "2026-08-26").association.unitCount).toBe(4);
  });

  it("holds the parked rows across a reload of the wizard", () => {
    const draft: CommunityDraft = {
      ...emptyDraft(),
      parkedHouseholds: [{ name: "Ana", email: "ana@example.com", unit: "5" }],
    };
    const saved = JSON.stringify({ draft, current: "homes", exploring: false, awaitingConfirmation: false });
    expect(parseProgress(saved)?.draft.parkedHouseholds).toEqual(draft.parkedHouseholds);
  });

  it("tells a row a range can bring back from one it never will", () => {
    const parked: DraftHousehold[] = [
      { name: "Ana", email: "", unit: "45" },
      { name: "Bo", email: "", unit: "Lot 3" },
      { name: "Cy", email: "", unit: "012" },
      { name: "Di", email: "", unit: "12A" },
      // Lot 5 is covered and still parked: another row has the number.
      { name: "Ed", email: "", unit: "5" },
    ];
    const sorted = sortParked({ parked, phases: range(40), prefix: "" });
    expect(sorted.waiting.map((h) => h.unit)).toEqual(["45"]);
    expect(sorted.unplaced.map((h) => h.unit)).toEqual(["Lot 3", "012", "12A", "5"]);
    // "Lot 3" is a lot number once the prefix says so, and the range covers
    // it, so the rebuild places it and nothing is left to wait.
    const withPrefix = type({ households: [], parked, prefix: "Lo" }, range(40), "Lot");
    expect(named(withPrefix)).toContain("Lot 3: Bo");
  });

  it("counts a range with a problem as covering nothing", () => {
    const parked: DraftHousehold[] = [{ name: "Ana", email: "", unit: "7" }];
    // Backwards, so it creates no homes; the row waits for it to be fixed.
    const sorted = sortParked({ parked, phases: range(1, 10), prefix: "" });
    expect(sorted.waiting.map((h) => h.unit)).toEqual(["7"]);
  });

  it("holds the homes question while a row is parked, until it is left out", () => {
    const draft: CommunityDraft = {
      ...emptyDraft(),
      homeNaming: "numbers",
      phases: range(4),
      households: ["1", "2", "3", "4"].map((unit) => ({ name: "", email: "", unit })),
    };
    expect(homesAnswered(draft)).toBe(true);
    const short = { ...draft, parkedHouseholds: [{ name: "Ana", email: "", unit: "5" }] };
    expect(homesAnswered(short)).toBe(false);
    // "Leave these out" clears the stash, and so does a range that covers it.
    expect(homesAnswered({ ...short, parkedHouseholds: undefined })).toBe(true);
    // No range at all is still not an answer.
    expect(homesAnswered({ ...draft, phases: [] })).toBe(false);
    // A list of addresses has no ranges, and may be empty.
    expect(homesAnswered({ ...draft, homeNaming: "addresses", phases: undefined })).toBe(true);
  });

  it("still holds it when the list turns into one by address with rows parked", () => {
    // The naming is stored only once the switch is pressed. Until then it
    // follows the kinds of home, so going Back and changing them turns a
    // numbered list into addresses, and the parked rows used to walk
    // straight past the gate and be dropped at Create.
    const numbered: CommunityDraft = {
      ...emptyDraft(),
      origin: "existing",
      homeTypes: ["condos"],
      phases: range(4),
      households: ["1", "2", "3", "4"].map((unit) => ({ name: "", email: "", unit })),
      parkedHouseholds: [{ name: "Ana", email: "ana@example.com", unit: "5" }],
    };
    expect(numbered.homeNaming).toBeUndefined();
    expect(homesAnswered(numbered)).toBe(false);

    const byAddress: CommunityDraft = { ...numbered, homeTypes: ["single-family"] };
    expect(defaultHomeNaming(byAddress)).toBe("addresses");
    expect(homesAnswered(byAddress)).toBe(false);
    // Left out on the address screen, and the question is answered.
    expect(homesAnswered({ ...byAddress, parkedHouseholds: undefined })).toBe(true);
  });
});

/**
 * The line under Import a spreadsheet. It used to count every row in the
 * file as added, parked or not, so a 60 row file over a range of 40 read as
 * 60 homes added while 20 owners sat outside the list.
 */
describe("what the importer says it did", () => {
  const row = (unit: string, name = `Owner ${unit}`): RosterRow => ({
    line: 1,
    name,
    email: "",
    unit,
    address: "",
    phone: "",
    problems: [],
  });
  const numbered = (to: number): CommunityDraft => {
    const phases: LotPhase[] = [{ id: "phase-1", label: "Phase 1", from: 1, to }];
    return {
      ...emptyDraft(),
      homeNaming: "numbers",
      phases,
      households: rebuildLotHomes<DraftHousehold>({ phases, prefix: "", households: [] }).households,
    };
  };

  it("counts rows on the list apart from rows waiting for a range", () => {
    const rows = Array.from({ length: 60 }, (_, i) => row(String(i + 1)));
    const merged = mergeRoster(numbered(40), rows);
    expect(merged.added).toBe(40);
    expect(merged.waiting).toBe(20);
    expect(merged.patch.households).toHaveLength(40);
    expect(merged.patch.parkedHouseholds).toHaveLength(20);
  });

  it("says nothing is waiting when every row found its lot", () => {
    const merged = mergeRoster(numbered(6), [row("2"), row("5")]);
    expect(merged).toMatchObject({ added: 2, waiting: 0 });
    expect(merged.patch.parkedHouseholds).toBeUndefined();
  });

  it("counts a label the ranges do not print as waiting, not added", () => {
    const merged = mergeRoster(numbered(6), [row("3"), row("Lot 4"), row("12A")]);
    expect(merged).toMatchObject({ added: 1, waiting: 2 });
  });

  it("does not count rows that were already parked before this file", () => {
    const draft = { ...numbered(6), parkedHouseholds: [{ name: "Ana", email: "", unit: "9" }] };
    const merged = mergeRoster(draft, [row("2")]);
    expect(merged).toMatchObject({ added: 1, waiting: 0 });
    expect(merged.patch.parkedHouseholds).toHaveLength(1);
  });

  it("does not let a parked row take the place of the one listed on its lot", () => {
    // Lot 3 has an owner on the list, and a second row for lot 3 is parked
    // because the number was taken. Any later import used to swap them.
    const base = numbered(6);
    const draft: CommunityDraft = {
      ...base,
      households: base.households.map((h) => (h.unit === "3" ? { ...h, name: "Listed" } : h)),
      parkedHouseholds: [{ name: "Parked duplicate", email: "", unit: "3" }],
    };
    const merged = mergeRoster(draft, [row("5")]);
    expect(merged.patch.households?.find((h) => h.unit === "3")?.name).toBe("Listed");
    expect(merged.patch.parkedHouseholds).toEqual([{ name: "Parked duplicate", email: "", unit: "3" }]);
    // Only the file's own row is counted.
    expect(merged).toMatchObject({ added: 1, waiting: 0 });

    // A row in the file for that lot fills in the listed owner, not the parked one.
    const again = mergeRoster(draft, [{ ...row("3", "From the file"), email: "three@example.com" }]);
    expect(again.patch.households?.find((h) => h.unit === "3")).toMatchObject({
      name: "Listed",
      email: "three@example.com",
    });
    expect(again.patch.parkedHouseholds).toHaveLength(1);
    expect(again).toMatchObject({ added: 1, waiting: 0 });
  });

  it("still brings a parked row back onto a lot nobody is listed on", () => {
    const draft = { ...numbered(6), parkedHouseholds: [{ name: "Ana", email: "", unit: "9" }] };
    const wider = {
      ...draft,
      phases: [{ id: "phase-1", label: "Phase 1", from: 1, to: 10 }],
    };
    const merged = mergeRoster(wider, [row("2")]);
    expect(merged.patch.households?.find((h) => h.unit === "9")?.name).toBe("Ana");
    expect(merged.patch.parkedHouseholds).toBeUndefined();
  });

  it("adds every row where homes go by address", () => {
    const draft = { ...emptyDraft(), homeNaming: "addresses" as const };
    const merged = mergeRoster(draft, [row("12 Oak St"), row("14 Oak St")]);
    expect(merged).toMatchObject({ added: 2, waiting: 0 });
    expect(merged.patch.households).toHaveLength(2);
  });
});
