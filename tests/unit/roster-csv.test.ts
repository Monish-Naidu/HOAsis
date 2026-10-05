import { describe, expect, it } from "vitest";
import {
  columnFor,
  moneyToCents,
  parseRosterCsv,
  rosterSummary,
  rosterTemplateCsv,
  splitCsv,
} from "@/lib/roster/csv";
import { rowsForImport } from "@/lib/roster/apply";

describe("splitCsv", () => {
  it("reads quoted commas, doubled quotes and CRLF", () => {
    const rows = splitCsv('a,"b, c","say ""hi"""\r\n1,2,3\r\n');
    expect(rows).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("drops blank lines and the BOM Excel writes", () => {
    expect(splitCsv("﻿x,y\n\n1,2\n   ,  \n")).toEqual([
      ["x", "y"],
      ["1", "2"],
    ]);
  });

  it("reads a tab separated export the same way", () => {
    expect(splitCsv("Name\tUnit\nPat\t12")).toEqual([
      ["Name", "Unit"],
      ["Pat", "12"],
    ]);
  });
});

describe("columnFor", () => {
  it("knows the names a treasurer's spreadsheet uses", () => {
    expect(columnFor("Owner")).toBe("name");
    expect(columnFor("Homeowner Name")).toBe("name");
    expect(columnFor("E-mail")).toBe("email");
    expect(columnFor("Lot #")).toBe("unit");
    expect(columnFor("Unit No.")).toBe("unit");
    expect(columnFor("Property Address")).toBe("address");
    expect(columnFor("Cell")).toBe("phone");
    expect(columnFor("Balance Due")).toBe("balance");
    expect(columnFor("Opening balance ($)")).toBe("balance");
    expect(columnFor("Notes")).toBeNull();
  });
});

describe("moneyToCents", () => {
  it("reads the ways money is typed", () => {
    expect(moneyToCents("185")).toBe(18500);
    expect(moneyToCents("$1,240.50")).toBe(124050);
    expect(moneyToCents("(20.00)")).toBe(-2000);
    expect(moneyToCents("-20")).toBe(-2000);
    expect(moneyToCents("0")).toBe(0);
  });

  it("tells nothing from nonsense", () => {
    expect(moneyToCents("")).toBeUndefined();
    expect(moneyToCents("   ")).toBeUndefined();
    expect(moneyToCents("abc")).toBeNull();
    expect(moneyToCents("1.234")).toBeNull();
  });
});

describe("parseRosterCsv", () => {
  const file = [
    "Owner,Email,Lot,Address,Phone,Balance due",
    "Pat Alvarez,pat@example.com,12,1428 Willow Creek Lane,425-555-0114,0",
    "Marcus Bell,MARCUS@example.com,14,1432 Willow Creek Lane,,$185.00",
    ",,16,1436 Willow Creek Lane,,",
    "Ana Ferreira,not-an-email,18,1440 Willow Creek Lane,,(20.00)",
    "Dup Row,dup@example.com,14,1432 Willow Creek Lane,,",
    "No Home,nohome@example.com,,,,",
    "Bad Money,bad@example.com,20,1444 Willow Creek Lane,,lots",
  ].join("\n");

  it("maps the columns and reads every row", () => {
    const parsed = parseRosterCsv(file);
    expect(parsed.problems).toEqual([]);
    expect(parsed.columns).toEqual({
      name: "Owner",
      email: "Email",
      unit: "Lot",
      address: "Address",
      phone: "Phone",
      balance: "Balance due",
    });
    expect(parsed.rows).toHaveLength(7);
    const [pat, marcus, empty] = parsed.rows;
    expect(pat).toMatchObject({ line: 2, name: "Pat Alvarez", unit: "12", phone: "425-555-0114", openingBalanceCents: 0, problems: [] });
    expect(marcus).toMatchObject({ email: "marcus@example.com", openingBalanceCents: 18500, problems: [] });
    expect(empty).toMatchObject({ name: "", email: "", unit: "16", problems: [] });
    expect(empty.openingBalanceCents).toBeUndefined();
  });

  it("names each problem on its row and leaves the good rows alone", () => {
    const rows = parseRosterCsv(file).rows;
    expect(rows[3].problems[0]).toMatch(/does not look like an email/);
    expect(rows[3].openingBalanceCents).toBe(-2000);
    expect(rows[4].problems[0]).toMatch(/Same home as line 3/);
    expect(rows[5].problems[0]).toMatch(/nothing to put on the register/);
    expect(rows[6].problems[0]).toMatch(/not an amount/);
  });

  it("uses the address as the key when there is no number", () => {
    const parsed = parseRosterCsv("Name,Address\nPat,1 Alder Way\nSam,3 Alder Way\nTwo,1 alder way");
    expect(parsed.rows.map((r) => r.unit)).toEqual(["1 Alder Way", "3 Alder Way", "1 alder way"]);
    expect(parsed.rows[2].problems[0]).toMatch(/Same home as line 2/);
  });

  it("refuses a file that names no home", () => {
    const parsed = parseRosterCsv("Name,Email\nPat,pat@example.com");
    expect(parsed.rows).toEqual([]);
    expect(parsed.problems[0]).toMatch(/No column names a home/);
  });

  it("says when the file cannot invite anybody", () => {
    const parsed = parseRosterCsv("Unit,Name\n1,Pat");
    expect(parsed.problems.some((p) => /No "Email" column/.test(p))).toBe(true);
    expect(parsed.rows[0].problems).toEqual([]);
  });

  it("reads its own template", () => {
    const parsed = parseRosterCsv(rosterTemplateCsv());
    expect(parsed.problems).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.every((r) => r.problems.length === 0)).toBe(true);
    expect(parsed.rows[1].openingBalanceCents).toBe(18500);
  });
});

describe("rosterSummary", () => {
  it("separates homes to create from homes to update, and sums what is owed", () => {
    const parsed = parseRosterCsv(
      "Unit,Name,Email,Balance\n1,Pat,pat@example.com,100\n2,Sam,,50\n3,,,\n4,Bad,bad-email,",
    );
    const summary = rosterSummary(parsed.rows, ["2", " 3 "]);
    expect(summary.ok.map((r) => r.unit)).toEqual(["1", "2", "3"]);
    expect(summary.creating.map((r) => r.unit)).toEqual(["1"]);
    expect(summary.updating.map((r) => r.unit)).toEqual(["2", "3"]);
    expect(summary.withEmail.map((r) => r.unit)).toEqual(["1"]);
    expect(summary.owedCents).toBe(15000);
    expect(summary.problems.map((r) => r.unit)).toEqual(["4"]);
  });
});

describe("rowsForImport", () => {
  type Sent = { unit: string; name: string; opening_balance_cents?: number }[];

  it("sends a home the register already has under the register's own spelling", () => {
    // A county export in capitals against a register in title case. The
    // preview counts the row as an update; the database matches the label
    // letter for letter, so sent as typed it became a second home.
    const parsed = parseRosterCsv(
      "Address,Name,Balance\n1428 WILLOW CREEK LANE,Pat,185.00\n9 Birch Court,Sam,\nlot 7,Ana,",
    );
    const existing = ["1428 Willow Creek Lane", "Lot 7"];
    const summary = rosterSummary(parsed.rows, existing);
    expect(summary.updating.map((r) => r.unit)).toEqual(["1428 WILLOW CREEK LANE", "lot 7"]);
    expect(summary.creating.map((r) => r.unit)).toEqual(["9 Birch Court"]);

    const sent = rowsForImport(summary.ok, existing) as Sent;
    expect(sent.map((r) => r.unit)).toEqual(["1428 Willow Creek Lane", "9 Birch Court", "Lot 7"]);
    // Every row the preview called an update now matches a label exactly.
    for (const row of summary.updating) {
      const unit = (rowsForImport([row], existing) as Sent)[0].unit;
      expect(existing).toContain(unit);
    }
    expect(sent[0].opening_balance_cents).toBe(18500);
  });

  it("leaves a new home, and a home spelled the register's way, as typed", () => {
    const parsed = parseRosterCsv("Unit,Name\nLot 7,Ana\nLot 8,Ben");
    const sent = rowsForImport(parsed.rows, ["Lot 7", "LOT 7"]) as Sent;
    expect(sent.map((r) => r.unit)).toEqual(["Lot 7", "Lot 8"]);
    expect((rowsForImport(parsed.rows) as Sent).map((r) => r.unit)).toEqual(["Lot 7", "Lot 8"]);
  });
});
