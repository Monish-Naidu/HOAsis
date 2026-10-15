import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/core/export";
import { buildZip, crc32 } from "@/lib/core/zip";
import { mehrMeadows } from "@/lib/data/communities";
import { completeRecordsFiles } from "@/lib/records/complete";
import { recordsCsv, recordsReadme, recordsZip, recordsZipName } from "@/lib/records/pack";
import { completeRecordsFromCommunity } from "@/lib/records/rows";

/** The zip read back the way an unzipper reads it: local headers, in order. */
function readZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const decoder = new TextDecoder();
  const entries: { name: string; contents: string; crc: number; utf8: boolean }[] = [];
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const flags = view.getUint16(at + 6, true);
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const name = decoder.decode(zip.subarray(at + 30, at + 30 + nameLength));
    const bodyAt = at + 30 + nameLength + extraLength;
    entries.push({
      name,
      contents: decoder.decode(zip.subarray(bodyAt, bodyAt + size)),
      crc,
      utf8: (flags & 0x800) !== 0,
    });
    at = bodyAt + size;
  }
  return { entries, endAt: at };
}

describe("CRC-32, the check every unzipper runs", () => {
  it("matches the published vector for 123456789", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("is zero for nothing at all", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("differs when a byte differs", () => {
    const a = new TextEncoder().encode("dues,285.00");
    const b = new TextEncoder().encode("dues,285.01");
    expect(crc32(a)).not.toBe(crc32(b));
  });
});

describe("the zip writer", () => {
  it("writes a readable archive with a stored file, and the CRC of its bytes", () => {
    const zip = buildZip(
      [{ name: "charges.csv", contents: "Date,Amount\n2026-01-01,285.00" }],
      "2026-08-20",
    );
    const { entries, endAt } = readZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("charges.csv");
    expect(entries[0].contents).toBe("Date,Amount\n2026-01-01,285.00");
    expect(entries[0].crc).toBe(crc32(new TextEncoder().encode(entries[0].contents)));
    // The central directory and its end record follow the entry, and the end
    // record's own sizes have to describe that directory exactly: a reader
    // that finds twelve bytes too many calls the archive truncated.
    const view = new DataView(zip.buffer);
    expect(view.getUint32(endAt, true)).toBe(0x02014b50);
    const eocd = zip.byteLength - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(1);
    expect(view.getUint32(eocd + 12, true)).toBe(eocd - endAt);
    expect(view.getUint32(eocd + 16, true)).toBe(endAt);
  });

  it("describes its own directory, so a reader does not call it truncated", () => {
    const files = [
      { name: "README.txt", contents: "hello" },
      { name: "charges.csv", contents: "a,b\n1,2" },
      { name: "eigentümer.csv", contents: "ü" },
    ];
    const zip = buildZip(files, "2026-08-20");
    const { endAt } = readZip(zip);
    const view = new DataView(zip.buffer);
    const eocd = zip.byteLength - 22;
    expect(view.getUint32(eocd + 12, true)).toBe(eocd - endAt);
    expect(view.getUint32(eocd + 16, true)).toBe(endAt);
    // Every entry's offset in the directory points at its own local header,
    // and the directory ends where the end record begins.
    let at = endAt;
    for (let i = 0; i < files.length; i++) {
      const offset = view.getUint32(at + 42, true);
      expect(view.getUint32(offset, true)).toBe(0x04034b50);
      at += 46 + view.getUint16(at + 28, true);
    }
    expect(at).toBe(eocd);
  });

  it("writes an archive of nothing, which is still a valid zip", () => {
    const zip = buildZip([], "2026-08-20");
    expect(zip.byteLength).toBe(22);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(view.getUint16(10, true)).toBe(0);
  });

  it("encodes the day it was given, so the demo does not drift", () => {
    const zip = buildZip([{ name: "a.csv", contents: "a" }], "2026-08-20");
    const view = new DataView(zip.buffer);
    const dosDate = view.getUint16(12, true);
    expect(dosDate >> 9).toBe(2026 - 1980);
    expect((dosDate >> 5) & 0xf).toBe(8);
    expect(dosDate & 0x1f).toBe(20);
  });

  it("flags a name outside ASCII as UTF-8 rather than letting a reader guess", () => {
    const zip = buildZip([{ name: "eigentümer.csv", contents: "x" }], "2026-08-20");
    const { entries } = readZip(zip);
    expect(entries[0].name).toBe("eigentümer.csv");
    expect(entries[0].utf8).toBe(true);
    expect(buildZip([{ name: "plain.csv", contents: "x" }], "2026-08-20")[6] & 0x8).toBe(0);
  });
});

describe("a CSV a spreadsheet can open", () => {
  const columns = [
    { header: "Vendor", value: (row: { vendor: string }) => row.vendor },
    { header: "Amount", value: (row: { amount: string }) => row.amount },
  ];

  it("quotes a comma, a quote and a newline rather than breaking the row", () => {
    const csv = toCsv([{ vendor: 'Smith, Jones & "Co"', amount: "285.00" }], columns);
    expect(csv).toContain('"Smith, Jones & ""Co"""');
    expect(toCsv([{ vendor: "line\nbreak", amount: "1.00" }], columns)).toContain('"line\nbreak"');
  });

  it("stops a field that would run as a formula", () => {
    const csv = toCsv([{ vendor: "=cmd|'/c calc'!A1", amount: "@SUM(A1)" }], columns);
    expect(csv).toContain("'=cmd|'/c calc'!A1");
    expect(csv).toContain("'@SUM(A1)");
  });

  it("leaves money alone, so a column of amounts stays numbers", () => {
    // A negative amount is a number, not a formula: quoting it makes the
    // whole column text and the accountant's sum reads zero.
    const csv = toCsv([{ vendor: "Dues", amount: "-285.00" }], columns);
    expect(csv).toContain(",-285.00");
    expect(csv).not.toContain("'-285.00");
  });

  it("keeps a name outside ASCII as it was written", () => {
    expect(toCsv([{ vendor: "Café Grounds", amount: "1.00" }], columns)).toContain("Café Grounds");
  });
});

describe("the records zip", () => {
  const community = mehrMeadows;
  const rows = completeRecordsFromCommunity(community);
  const files = completeRecordsFiles(community, rows);
  const readme = recordsReadme(community, files, {
    generatedOn: "2026-08-20",
    unreadable: [],
    by: "Dana Reyes",
  });

  it("carries the README first, then one CSV per area", () => {
    const zip = recordsZip(files, readme, "2026-08-20");
    const { entries } = readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["README.txt", ...files.map((f) => f.name)]);
    expect(entries[0].contents).toContain("records export");
    // Every CSV opens in Excel as UTF-8: the bytes start with the mark, which
    // the decoder above strips on the way back out.
    expect(recordsCsv(files[0]).startsWith("\uFEFF")).toBe(true);
  });

  it("names every file in the README, with its columns", () => {
    for (const file of files) {
      expect(readme).toContain(`${file.name}: ${file.blurb}`);
      expect(readme).toContain(file.columns.map((c) => c.header).join(", "));
    }
    expect(readme).toContain("Amounts are decimal dollars");
    expect(readme).toContain("Made on 2026-08-20 by Dana Reyes.");
  });

  it("says what a seat could not read rather than shipping an empty file quietly", () => {
    const note = recordsReadme(community, files, {
      generatedOn: "2026-08-20",
      unreadable: ["Activity"],
    });
    expect(note).toContain("Your seat cannot read Activity.");
  });

  it("says what is deliberately not in the zip", () => {
    expect(readme).toContain("How each person voted.");
    expect(readme).toContain("Saved payment methods.");
  });

  it("writes one CSV per area, with the header row the README lists", () => {
    const charges = files.find((f) => f.id === "charges");
    expect(charges).toBeDefined();
    const csv = recordsCsv(charges!);
    const header = csv.replace("\uFEFF", "").split("\r\n")[0];
    expect(header).toBe("Date,Home,Label,Type,Category,Amount");
    expect(csv.split("\r\n").length).toBe(charges!.rows.length + 1);
  });

  it("names the archive after the association and the day", () => {
    expect(recordsZipName(community, "2026-08-20")).toBe(
      "willow-creek-estates-records-2026-08-20.zip",
    );
    expect(recordsZipName(community, "2026-08-20", 2025)).toBe(
      "willow-creek-estates-records-2025-2026-08-20.zip",
    );
  });
});
