import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import { completeRecordsFiles } from "@/lib/records/complete";
import { recordsCsv } from "@/lib/records/pack";
import { completeRecordsFromCommunity } from "@/lib/records/rows";

const community = mehrMeadows;
const rows = completeRecordsFromCommunity(community);
const files = completeRecordsFiles(community, rows);
const byId = (id: string) => files.find((f) => f.id === id)!;

describe("the complete export", () => {
  it("holds an area for every record the association keeps", () => {
    expect(files.map((f) => f.id)).toEqual(
      expect.arrayContaining([
        "homes",
        "seats",
        "board-terms",
        "charges",
        "payments",
        "ledger",
        "vendor-payments",
        "online-payments",
        "vendors",
        "vendor-invoices",
        "bank-accounts",
        "budget",
        "reserves",
        "shared-costs",
        "shared-cost-bills",
        "special-assessments",
        "governing",
        "amendments",
        "documents",
        "forms",
        "announcements",
        "threads",
        "messages",
        "posts",
        "amenities",
        "bookings",
        "attendance",
        "action-items",
        "request-updates",
        "violations",
        "join-requests",
        "settings",
        "ballots",
        "meetings",
        "requests",
        "email-log",
        "activity",
      ]),
    );
  });

  it("gives every file a unique name inside the zip", () => {
    const names = files.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((name) => name.endsWith(".csv"))).toBe(true);
  });

  it("gives every row a value for every column and nothing else", () => {
    // The row's keys are the columns' headers. A column added without its row
    // field writes an empty cell, which is how a records export lies quietly.
    for (const file of files) {
      const headers = file.columns.map((column) => column.header);
      for (const row of file.rows) {
        expect(Object.keys(row).sort()).toEqual([...headers].sort());
      }
    }
  });

  it("writes one line per row plus the header, for every area", () => {
    for (const file of files) {
      const lines = recordsCsv(file).replace("\uFEFF", "").split("\r\n");
      expect(lines.length).toBe(file.rows.length + 1);
      expect(lines[0].split(",").length).toBe(file.columns.length);
    }
  });

  it("gates the roster and the books, and leaves a vote open to every member", () => {
    expect(byId("homes").capabilities).toEqual(["finances", "communications"]);
    expect(byId("seats").capabilities).toEqual(["finances", "communications"]);
    expect(byId("ledger").capabilities).toEqual(["finances"]);
    expect(byId("vendors").capabilities).toEqual(["vendors"]);
    expect(byId("governing").capabilities).toEqual(["documents"]);
    expect(byId("threads").capabilities).toEqual(["communications"]);
    expect(byId("ballots").capabilities).toBeUndefined();
    expect(byId("amenities").capabilities).toBeUndefined();
  });
});

describe("the register and the people", () => {
  it("lists every home with what it pays and what it owes", () => {
    const homes = byId("homes");
    expect(homes.rows.length).toBeGreaterThanOrEqual(community.homes.length);
    const first = homes.rows.find((row) => row.Unit === community.homes[0].unit)!;
    expect(first.Balance).toMatch(/^-?\d+\.\d{2}$/);
    expect(first.Assessment).toMatch(/^\d+\.\d{2}$/);
    expect(first.Status).toBe("On the register");
  });

  it("keeps a retired home on the file, with the day it was retired", () => {
    const withRetired = completeRecordsFiles(community, {
      ...rows,
      homes: [
        ...rows.homes,
        {
          id: "unit-gone",
          unit: "912",
          address: "912 Old Mill Road",
          duesCents: 25_000,
          retiredOn: "2025-11-30",
        },
      ],
    });
    const homes = withRetired.find((f) => f.id === "homes")!;
    const retired = homes.rows.find((row) => row.Unit === "912")!;
    expect(retired.Status).toBe("Retired 2025-11-30");
    expect(retired.Assessment).toBe("250.00");
  });

  it("keeps a seat that ended, because a records request asks who held the home when", () => {
    const seats = byId("seats");
    expect(seats.rows.length).toBe(rows.seats.length);
    expect(seats.totals).toEqual([
      { label: "Seats", count: rows.seats.length },
      { label: "Closed", count: rows.seats.filter((seat) => seat.endsOn).length },
    ]);
    expect(seats.rows[0].Name.length).toBeGreaterThan(0);
    expect(seats.rows[0].Access.length).toBeGreaterThan(0);
  });
});

describe("what the complete export deliberately holds", () => {
  it("names the files rather than shipping them, and says where each lives", () => {
    const documents = byId("documents");
    expect(documents.blurb).toContain("The files stay here");
    expect(documents.columns.map((c) => c.header)).toContain("Where it lives");
    expect(documents.rows.length).toBe(community.documents.length);
  });

  it("carries the association's own details, the dues it bills and its policy", () => {
    const settings = byId("settings");
    const values = new Map(settings.rows.map((row) => [row.Setting, row.Value]));
    expect(values.get("Name")).toBe(community.association.name);
    expect(values.get("Dues")).toContain("$285.00");
    expect(values.get("Reminder day")).toBeTruthy();
    expect(settings.totals).toEqual([]);
  });

  it("leaves out an area the association does not use rather than shipping an empty file", () => {
    const without = completeRecordsFiles({ ...community, sharedCosts: [] }, rows);
    expect(without.some((f) => f.id === "shared-costs")).toBe(false);
    const noStudy = completeRecordsFiles({ ...community, reserveComponents: [] }, rows);
    expect(noStudy.some((f) => f.id === "reserves")).toBe(true);
    expect(noStudy.find((f) => f.id === "reserves")!.rows).toEqual([]);
  });

  it("puts a neighbour's report in its own file, never on a notice", () => {
    const reports = byId("reports");
    expect(reports).toBeDefined();
    expect(reports.rows.length).toBe(community.violationReports.length);
    expect(byId("violations").columns.map((c) => c.header)).not.toContain("Reported by");
  });
});
