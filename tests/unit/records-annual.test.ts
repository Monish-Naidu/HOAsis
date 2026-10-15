import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import type { ChargeLine, CommunityHistory } from "@/lib/types";
import { statementPeriod, statementTotals } from "@/lib/statement";
import { annualRecordsFiles, annualYears } from "@/lib/records/annual";
import type { StatementLineRow } from "@/lib/records/rows";
import { yearRecordsFromCommunity } from "@/lib/records/rows";

const FY = mehrMeadows.association.fiscalYearStart;

function line(id: string, date: string, amountCents: number, kind: ChargeLine["kind"] = "charge") {
  return { id, date, label: "Monthly assessment", kind, amountCents, balanceAfterCents: 0 };
}

/** The demo with one home and one year of lines, so a year is easy to reason about. */
function oneYear(community: Community, homeId: string, lines: ChargeLine[]): Community {
  return {
    ...community,
    homeCharges: { [homeId]: lines },
    ledger: [],
    payouts: [],
    ballots: [],
    meetings: [],
    requests: [],
    emailLog: [],
    activity: [],
    history: undefined,
  };
}

const history: CommunityHistory = {
  from: "2024-01-01",
  ledgerCount: 12,
  ledgerFrom: "2021-03-04",
  ledgerMonths: [
    { month: "2021-03", category: "Landscaping", inCents: 0, outCents: 450_000, count: 2 },
  ],
  statementMonths: [{ month: "2022-07", kind: "charge", cents: 285_000, count: 10 }],
  statementCounts: {},
  lateFeesOwedCents: 0,
  statementsLoaded: [],
  ledgerLoaded: false,
};

describe("which years the records screen offers", () => {
  it("offers every year the demo's records touch, newest first", () => {
    const years = annualYears(mehrMeadows);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(years).toContain(2026);
  });

  it("offers five years of an association five years old", () => {
    const home = mehrMeadows.homes[0].id;
    const five = oneYear(mehrMeadows, home, [
      line("l-22", "2022-03-01", 25_000),
      line("l-23", "2023-03-01", 25_000),
      line("l-24", "2024-03-01", 25_000),
      line("l-25", "2025-03-01", 25_000),
      line("l-26", "2026-03-01", 25_000),
    ]);
    expect(annualYears(five)).toEqual([2026, 2025, 2024, 2023, 2022]);
  });

  it("counts a year the server summed and the app never loaded", () => {
    const summed = { ...oneYear(mehrMeadows, mehrMeadows.homes[0].id, []), history };
    expect(annualYears(summed)).toEqual([2022, 2021]);
  });

  it("still offers this year when the association has nothing on the books", () => {
    const empty = oneYear(mehrMeadows, mehrMeadows.homes[0].id, []);
    expect(annualYears(empty)).toEqual([2026]);
  });
});

describe("what a year's lines add up to", () => {
  it("is the arithmetic Statements does: billed, paid, credited", () => {
    // The export's own line rows, which is what the rule is handed here.
    const year: StatementLineRow[] = [
      { homeId: "h", date: "2026-01-01", label: "Assessment", kind: "charge", amountCents: 28_500 },
      { homeId: "h", date: "2026-01-05", label: "Payment", kind: "payment", amountCents: -28_500 },
      {
        homeId: "h",
        date: "2026-02-01",
        label: "Late fee waived",
        kind: "credit",
        amountCents: -2_500,
      },
    ];
    expect(statementTotals(year)).toEqual({
      billedCents: 28_500,
      paidCents: 28_500,
      creditedCents: 2_500,
    });
  });

  it("takes a reversed payment back off what was paid, never off what was billed", () => {
    const year: StatementLineRow[] = [
      { homeId: "h", date: "2026-01-05", label: "Payment", kind: "payment", amountCents: -28_500 },
      {
        homeId: "h",
        date: "2026-02-05",
        label: "Payment reversed: check returned",
        kind: "charge",
        amountCents: 28_500,
      },
    ];
    expect(statementTotals(year)).toEqual({ billedCents: 0, paidCents: 0, creditedCents: 0 });
  });

  it("is zero for a year with nothing in it", () => {
    expect(statementTotals([])).toEqual({ billedCents: 0, paidCents: 0, creditedCents: 0 });
  });
});

describe("the files a year holds", () => {
  const window = statementPeriod(FY, 2026);
  const rows = yearRecordsFromCommunity(mehrMeadows, window);
  const files = annualRecordsFiles(mehrMeadows, 2026, rows);
  const byId = (id: string) => files.find((f) => f.id === id)!;

  it("is one file per area, each with its own name", () => {
    expect(files.map((f) => f.id)).toEqual([
      "charges",
      "payments",
      "ledger",
      "vendor-payments",
      "ballots",
      "meetings",
      "requests",
      "email-log",
      "activity",
    ]);
    expect(new Set(files.map((f) => f.name)).size).toBe(files.length);
  });

  it("splits the statement by what it did: charges one file, payments and credits another", () => {
    const charges = byId("charges").rows;
    const payments = byId("payments").rows;
    expect(charges.length + payments.length).toBe(rows.statement.length);
    expect(charges.every((row) => row.Type === "Charge" || row.Type === "Reversed payment")).toBe(
      true,
    );
    expect(payments.every((row) => row.Type === "Payment" || row.Type === "Credit")).toBe(true);
    expect(charges[0].Amount).toMatch(/^\d+\.\d{2}$/);
  });

  it("counts every line of the year and nothing from another year", () => {
    expect(byId("charges").totals.find((t) => t.label === "Lines")!.count).toBe(
      byId("charges").rows.length,
    );
    for (const row of byId("charges").rows) expect(row.Date.startsWith("2026")).toBe(true);
  });

  it("says nothing rather than something wrong for a year with no records", () => {
    const empty = oneYear(mehrMeadows, mehrMeadows.homes[0].id, []);
    const emptyRows = yearRecordsFromCommunity(empty, statementPeriod(FY, 2019));
    const filesFor2019 = annualRecordsFiles(empty, 2019, emptyRows);
    expect(filesFor2019).toHaveLength(9);
    for (const file of filesFor2019) expect(file.rows).toEqual([]);
    expect(filesFor2019[0].totals).toEqual([
      { label: "Billed", moneyCents: 0 },
      { label: "Lines", count: 0 },
    ]);
  });

  it("holds one record of a year with exactly one", () => {
    const home = mehrMeadows.homes[0].id;
    const single = oneYear(mehrMeadows, home, [line("only", "2026-04-01", 31_000)]);
    const singleRows = yearRecordsFromCommunity(single, statementPeriod(FY, 2026));
    const singleFiles = annualRecordsFiles(single, 2026, singleRows);
    const charges = singleFiles.find((f) => f.id === "charges")!;
    expect(charges.rows).toHaveLength(1);
    expect(charges.rows[0]).toMatchObject({ Date: "2026-04-01", Amount: "310.00" });
    expect(charges.totals[0]).toEqual({ label: "Billed", moneyCents: 31_000 });
  });

  it("gates each area by what a seat needs to read it", () => {
    expect(byId("charges").capabilities).toEqual(["finances"]);
    expect(byId("ledger").capabilities).toEqual(["finances"]);
    expect(byId("requests").capabilities).toEqual(["requests"]);
    expect(byId("email-log").capabilities).toEqual(["communications"]);
    expect(byId("activity").capabilities).toEqual(["settings"]);
    // A vote and a meeting are every member's to read.
    expect(byId("ballots").capabilities).toBeUndefined();
    expect(byId("meetings").capabilities).toBeUndefined();
  });

  it("names the home a line belongs to, in the community's own words", () => {
    const home = mehrMeadows.homes[0];
    expect(byId("charges").rows.some((row) => row.Home.includes(home.unit))).toBe(true);
  });
});
