import { describe, expect, it } from "vitest";
import {
  buildCommunity,
  draftDuesTotal,
  draftOwnDuesCount,
  emptyDraft,
  finalizeDraft,
  type CommunityDraft,
} from "@/lib/data/new-community";
import {
  duesFor,
  duesSource,
  duesSourceLabel,
  duesVary,
  homesWithOwnDues,
  homeDues,
  totalDues,
} from "@/lib/home-types";
import { parseRosterCsv, rosterSummary, rosterTemplateCsv } from "@/lib/roster/csv";
import { mergeRoster } from "@/app/start/roster-import";
import { householdsNeedingBooks } from "@/app/start/books";

/**
 * Dues that differ home by home, in one rule: a home's own amount, else its
 * kind's, else the association's. supabase/migrations/0084_dues_by_home.sql
 * applies the same order when a bill is issued.
 */

const association = { duesCents: 21_000, duesByType: { condos: 30_000 } as const };

describe("what a home pays", () => {
  it("is its own amount when it has one, whatever its kind", () => {
    expect(homeDues(association, { homeType: "condos", duesCents: 34_000 })).toBe(34_000);
    expect(homeDues(association, { duesCents: 28_500 })).toBe(28_500);
  });

  it("is its kind's amount when the association bills by kind and the home has none", () => {
    expect(homeDues(association, { homeType: "condos" })).toBe(30_000);
  });

  it("is the association's amount otherwise", () => {
    expect(homeDues(association, { homeType: "townhomes" })).toBe(21_000);
    expect(homeDues(association, {})).toBe(21_000);
    expect(homeDues(association, undefined)).toBe(21_000);
  });

  it("goes back to the kind's or the association's when the home's own is cleared", () => {
    expect(homeDues(association, { homeType: "condos", duesCents: undefined })).toBe(30_000);
    expect(homeDues({ duesCents: 21_000 }, { homeType: "condos", duesCents: undefined })).toBe(21_000);
  });

  it("reads a zero as not set, as the database does", () => {
    expect(duesFor(association, "condos", 0)).toBe(30_000);
    expect(duesFor({ duesCents: 21_000 }, undefined, 0)).toBe(21_000);
  });

  it("says where the amount comes from", () => {
    expect(duesSource(association, { homeType: "condos", duesCents: 1 })).toBe("own");
    expect(duesSource(association, { homeType: "condos" })).toBe("kind");
    expect(duesSource(association, { homeType: "townhomes" })).toBe("association");
    // A kind set to the association's own amount is just the association's.
    expect(duesSource({ duesCents: 21_000, duesByType: { condos: 21_000 } }, { homeType: "condos" })).toBe("association");
    expect(duesSourceLabel(association, { duesCents: 5 })).toBe("its own amount");
    expect(duesSourceLabel(association, { homeType: "condos" })).toBe("condo rate");
    expect(duesSourceLabel(association, {})).toBe("the association's rate");
  });
});

describe("totals with a mix", () => {
  const homes = [
    { homeType: "condos" as const, duesCents: 34_000 },
    { homeType: "condos" as const },
    { homeType: "townhomes" as const },
    {},
  ];

  it("add each home at what it pays", () => {
    expect(totalDues(association, homes)).toBe(34_000 + 30_000 + 21_000 + 21_000);
  });

  it("count the homes that have their own amount", () => {
    expect(homesWithOwnDues(homes)).toBe(1);
    expect(homesWithOwnDues([{}, { duesCents: 0 }])).toBe(0);
  });

  it("make dues vary when one home has its own amount, even with one flat rate", () => {
    const flat = { duesCents: 21_000 };
    expect(duesVary(flat)).toBe(false);
    expect(duesVary(flat, [{}, {}])).toBe(false);
    expect(duesVary(flat, [{}, { duesCents: 28_500 }])).toBe(true);
    // An amount equal to the flat rate changes nothing a screen would print.
    expect(duesVary(flat, [{ duesCents: 21_000 }])).toBe(false);
  });
});

/** A condo building: one-bedrooms on the first floor, larger units above. */
function building(): CommunityDraft {
  return {
    ...emptyDraft(),
    name: "Harbor Court",
    city: "Bothell",
    state: "WA",
    stateName: "Washington",
    duesCents: 21_000,
    duesByHome: true,
    homeTypes: ["condos"],
    origin: "existing",
    homeNaming: "numbers",
    founder: { name: "Pat Founder", email: "pat@example.com", unit: "101" },
    phases: [
      { id: "phase-1", label: "First floor", from: 101, to: 104 },
      { id: "phase-2", label: "Second floor", from: 201, to: 204, duesCents: 28_500 },
    ],
    households: [101, 102, 103, 104, 201, 202, 203, 204].map((n) => ({
      name: "",
      email: "",
      unit: String(n),
      homeType: "condos" as const,
    })),
  };
}

describe("the wizard's amounts, through finalizeDraft and buildCommunity", () => {
  it("gives each home its range's amount and leaves the fallback homes alone", () => {
    const done = finalizeDraft(building());
    const byUnit = Object.fromEntries(done.households.map((h) => [h.unit, h.duesCents]));
    expect(byUnit["201"]).toBe(28_500);
    expect(byUnit["204"]).toBe(28_500);
    expect(byUnit["102"]).toBeUndefined();
    // The founder is on 101, in the first floor range.
    expect(done.founder.duesCents).toBeUndefined();
    expect(done.duesByHome).toBe(true);
  });

  it("lets a row's amount win over its range's", () => {
    const draft = building();
    draft.households = draft.households.map((h) =>
      h.unit === "202" ? { ...h, duesCents: 34_000 } : h,
    );
    const done = finalizeDraft(draft);
    expect(done.households.find((h) => h.unit === "202")?.duesCents).toBe(34_000);
    expect(done.households.find((h) => h.unit === "203")?.duesCents).toBe(28_500);
  });

  it("gives the founder their range's amount when they live there", () => {
    const draft = { ...building(), founder: { ...building().founder, unit: "203" } };
    expect(finalizeDraft(draft).founder.duesCents).toBe(28_500);
  });

  it("drops an amount equal to the fallback, so it does not shadow a later change", () => {
    const draft = building();
    draft.phases = [
      { id: "phase-1", label: "First floor", from: 101, to: 104, duesCents: 21_000 },
      { id: "phase-2", label: "Second floor", from: 201, to: 204, duesCents: 28_500 },
    ];
    const done = finalizeDraft(draft);
    expect(done.households.find((h) => h.unit === "102")?.duesCents).toBeUndefined();
  });

  it("totals by the same rule everywhere in the wizard", () => {
    // Four homes at 285 and the founder's four at the fallback.
    expect(draftDuesTotal(building())).toBe(4 * 21_000 + 4 * 28_500);
    expect(draftDuesTotal(finalizeDraft(building()))).toBe(4 * 21_000 + 4 * 28_500);
    expect(draftOwnDuesCount(building())).toBe(4);
  });

  it("carries the amounts onto the look-around copy's owners", () => {
    const community = buildCommunity(finalizeDraft(building()), "2026-08-20");
    const upstairs = community.homes.find((o) => o.unit === "202")!;
    const downstairs = community.homes.find((o) => o.unit === "102")!;
    expect(homeDues(community.association, upstairs)).toBe(28_500);
    expect(homeDues(community.association, downstairs)).toBe(21_000);
    expect(duesVary(community.association, community.homes)).toBe(true);
    expect(totalDues(community.association, community.homes)).toBe(4 * 21_000 + 4 * 28_500);
    // The budget starts from the same total.
    expect(community.budget[0].annualCents).toBe((4 * 21_000 + 4 * 28_500) * 12);
  });

  it("breaks nothing when the board picks by home and gives no home its own amount", () => {
    const draft = building();
    draft.phases = draft.phases!.map((p) => ({ ...p, duesCents: undefined }));
    const done = finalizeDraft(draft);
    expect(done.households.every((h) => h.duesCents === undefined)).toBe(true);
    expect(draftOwnDuesCount(done)).toBe(0);
    const community = buildCommunity(done, "2026-08-20");
    expect(community.homes.every((o) => homeDues(community.association, o) === 21_000)).toBe(true);
    expect(duesVary(community.association, community.homes)).toBe(false);
  });

  it("ignores every per-home amount when the board did not pick by home", () => {
    const draft = { ...building(), duesByHome: undefined };
    draft.households = draft.households.map((h) => ({ ...h, duesCents: 99_000 }));
    const done = finalizeDraft(draft);
    expect(done.duesByHome).toBeUndefined();
    expect(done.households.every((h) => h.duesCents === undefined)).toBe(true);
    expect(draftDuesTotal(draft)).toBe(8 * 21_000);
  });

  it("reads an address list's row amounts, since addresses have no ranges", () => {
    const draft: CommunityDraft = {
      ...emptyDraft(),
      name: "Birch Lane",
      duesCents: 10_000,
      duesByHome: true,
      homeTypes: ["single-family"],
      homeNaming: "addresses",
      founder: { name: "Sam", email: "sam@example.com", unit: "", address: "1 Birch Lane" },
      households: [
        { name: "", email: "", unit: "3 Birch Lane", address: "3 Birch Lane", duesCents: 12_500 },
        { name: "", email: "", unit: "5 Birch Lane", address: "5 Birch Lane" },
      ],
    };
    const done = finalizeDraft(draft);
    expect(done.households.map((h) => h.duesCents)).toEqual([12_500, undefined]);
    expect(draftDuesTotal(done)).toBe(10_000 + 12_500 + 10_000);
  });
});

describe("the Dues column", () => {
  const file = [
    "Unit,Name,Email,Dues",
    "101,Pat,pat@example.com,$210.00",
    "201,Sam,sam@example.com,285",
    "202,Kim,kim@example.com,",
    "203,Lee,lee@example.com,abc",
    "204,Max,max@example.com,-5",
    "205,Zed,zed@example.com,0",
  ].join("\n");

  it("is read from Dues, and the amount lands on its row", () => {
    const rows = parseRosterCsv(file).rows;
    expect(rows[0].duesCents).toBe(21_000);
    expect(rows[1].duesCents).toBe(28_500);
  });

  it("leaves a blank, a zero and a bad cell without an amount, and names the bad ones", () => {
    const rows = parseRosterCsv(file).rows;
    expect(rows[2].duesCents).toBeUndefined();
    expect(rows[2].problems).toEqual([]);
    expect(rows[3].duesCents).toBeUndefined();
    expect(rows[3].problems.join(" ")).toMatch(/not a dues amount/);
    expect(rows[4].problems.join(" ")).toMatch(/not a dues amount/);
    expect(rows[5].duesCents).toBeUndefined();
    expect(rows[5].problems).toEqual([]);
  });

  it.each(["Assessment", "Monthly dues", "Monthly Assessment", "dues"])("is also called %s", (header) => {
    const parsed = parseRosterCsv(`Unit,${header}\n1,250`);
    expect(parsed.columns.dues).toBe(header);
    expect(parsed.rows[0].duesCents).toBe(25_000);
  });

  it("is not mistaken for a balance, and a balance is not mistaken for dues", () => {
    const parsed = parseRosterCsv("Unit,Balance due,Dues\n1,40,250");
    expect(parsed.rows[0].openingBalanceCents).toBe(4_000);
    expect(parsed.rows[0].duesCents).toBe(25_000);
  });

  it("is counted in the preview summary", () => {
    const { withDues } = rosterSummary(parseRosterCsv(file).rows);
    expect(withDues.map((r) => r.unit)).toEqual(["101", "201"]);
  });

  it("is in the template a board downloads", () => {
    expect(rosterTemplateCsv()).toContain("Opening balance,Dues");
  });

  it("goes onto the wizard's homes, switches dues to by home, and a row wins over its range", () => {
    const draft = building();
    const rows = parseRosterCsv("Unit,Name,Dues\n202,Kim,340\n102,Lee,\n").rows;
    const merged = mergeRoster({ ...draft, duesByHome: undefined }, rows);
    expect(merged.withDues).toBe(1);
    expect(merged.patch.duesByHome).toBe(true);
    const next = { ...draft, ...merged.patch };
    expect(next.households.find((h) => h.unit === "202")?.duesCents).toBe(34_000);
    expect(finalizeDraft(next).households.find((h) => h.unit === "202")?.duesCents).toBe(34_000);
    // A blank cell adds nothing and does not switch the answer by itself.
    expect(mergeRoster(draft, parseRosterCsv("Unit,Dues\n102,\n").rows).patch.duesByHome).toBeUndefined();
  });
});

describe("what is written after Create", () => {
  it("the books follow-up does not carry dues, which have their own call", () => {
    const draft = finalizeDraft(building());
    expect(householdsNeedingBooks(draft)).toEqual([]);
  });

  it("the finalized draft names exactly the homes that get a set_home_dues call", () => {
    const done = finalizeDraft(building());
    const own = done.households.filter((h) => h.duesCents && h.duesCents > 0).map((h) => h.unit);
    expect(own).toEqual(["201", "202", "203", "204"]);
  });
});
