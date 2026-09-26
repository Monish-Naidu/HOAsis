import { describe, expect, it } from "vitest";
import {
  editDistance,
  fold,
  matchToken,
  mergeRanges,
  prepare,
  search,
  segments,
  tokenize,
  type Searchable,
} from "@/lib/search/match";

/**
 * The matcher on its own: strings in, tiers and ranges out. Everything the
 * palette promises about typing ("delg" finds Delgado, "$285.00" and "285"
 * are the same search, a typo still lands) is pinned here without a record
 * in sight.
 */

const item = (title: string, subtitle = "", keywords = "", date = ""): Searchable => ({
  title,
  subtitle,
  keywords,
  date,
});

describe("folding and tokenising", () => {
  it("is case and accent insensitive", () => {
    expect(fold("Muñoz ÉLISE")).toBe("munoz elise");
    expect(tokenize("  Rosa   DELGADO ")).toEqual(["rosa", "delgado"]);
  });

  it("drops money punctuation from numbers and nothing else", () => {
    expect(tokenize("$1,250.00")).toEqual(["1250.00"]);
    expect(tokenize("#42")).toEqual(["42"]);
    expect(tokenize("a&b")).toEqual(["a&b"]);
  });
});

describe("one token on one field", () => {
  it("ranks exact above prefix above word start above inside above fuzzy", () => {
    expect(matchToken("delgado", "delgado")?.tier).toBe("exact");
    expect(matchToken("delgado, rosa", "delg")?.tier).toBe("prefix");
    expect(matchToken("rosa delgado", "delg")?.tier).toBe("word");
    expect(matchToken("rosa delgado", "delgado")?.tier).toBe("exact");
    expect(matchToken("rosa delgado", "gado")?.tier).toBe("inside");
    expect(matchToken("rosa delgado", "delgaod")?.tier).toBe("fuzzy");
    expect(matchToken("rosa delgado", "dlgdo")?.tier).toBe("fuzzy");
    expect(matchToken("rosa delgado", "smith")).toBeNull();
  });

  it("reports where the token landed", () => {
    expect(matchToken("rosa delgado", "delg")?.ranges).toEqual([{ start: 5, end: 9 }]);
    expect(matchToken("rosa delgado", "delgaod")?.ranges).toEqual([{ start: 5, end: 12 }]);
  });

  it("does not fuzz short tokens, so 'oct' never finds 'act'", () => {
    expect(matchToken("act now", "oct")).toBeNull();
    expect(matchToken("october dues", "oct")?.tier).toBe("prefix");
  });
});

describe("edit distance", () => {
  it("counts a swap as one", () => {
    expect(editDistance("delgado", "delgaod")).toBe(1);
    expect(editDistance("delgado", "delgado")).toBe(0);
    expect(editDistance("delgado", "delgadoxx", 1)).toBeGreaterThan(1);
    expect(editDistance("marchetti", "machetti")).toBe(1);
  });
});

describe("ranges and segments", () => {
  it("merges overlapping ranges and cuts the text into pieces", () => {
    expect(mergeRanges([{ start: 5, end: 9 }, { start: 7, end: 12 }, { start: 0, end: 2 }])).toEqual([
      { start: 0, end: 2 },
      { start: 5, end: 12 },
    ]);
    expect(segments("Rosa Delgado", [{ start: 5, end: 9 }])).toEqual([
      { text: "Rosa ", hit: false },
      { text: "Delg", hit: true },
      { text: "ado", hit: false },
    ]);
  });
});

describe("searching a list", () => {
  const index = prepare([
    item("Rosa Delgado", "Unit 12 · 1400 Elm Street", "r.delgado@example.com (425) 555-0100"),
    item("Delgado Roofing", "Roofing · $4,200.00 paid this year", "repairs"),
    item("Assessment payments, batch (14 owners)", "Batch · $28,500.00 · 2026-10-03", "dues assessment october oct 2026 28500 28500.00"),
    item("October dues", "Charged · $285.00 · 2026-10-01", "charge dues assessment october oct 2026 285 285.00"),
    item("Northsound Pool Service", "Pool maintenance", "", "2024-01-01"),
    item("Pool heater replacement", "Meeting agenda", "", "2026-03-01"),
    item("Finances", "Board", "money bank accounts", ""),
  ]);

  it("finds a person by a few letters of the surname", () => {
    const hits = search(index, "delg").map((s) => s.item.title);
    expect(hits).toContain("Rosa Delgado");
    expect(hits).toContain("Delgado Roofing");
    // The field that starts with the token wins over the one where it is the second word.
    expect(hits[0]).toBe("Delgado Roofing");
  });

  it("requires every token and reads a month with a synonym", () => {
    const hits = search(index, "oct dues").map((s) => s.item.title);
    expect(hits[0]).toBe("October dues");
    expect(hits).toContain("Assessment payments, batch (14 owners)");
    expect(search(index, "oct zebra")).toHaveLength(0);
  });

  it("finds an amount typed either way", () => {
    expect(search(index, "285").map((s) => s.item.title)).toEqual(["October dues"]);
    expect(search(index, "$285.00").map((s) => s.item.title)).toEqual(["October dues"]);
    expect(search(index, "$28,500").map((s) => s.item.title)).toEqual(["Assessment payments, batch (14 owners)"]);
  });

  it("survives a typo and an email address", () => {
    expect(search(index, "delgaod")[0].item.title).toBe("Rosa Delgado");
    expect(search(index, "r.delgado@example.com")[0].item.title).toBe("Rosa Delgado");
  });

  it("puts the exact title first and breaks ties by date", () => {
    const hits = search(index, "pool").map((s) => s.item.title);
    expect(hits[0]).toBe("Pool heater replacement");
    expect(search(index, "money")[0].item.title).toBe("Finances");
  });

  it("carries highlight ranges for the title and subtitle", () => {
    const [first] = search(index, "rosa unit");
    expect(first.item.title).toBe("Rosa Delgado");
    expect(first.titleRanges).toEqual([{ start: 0, end: 4 }]);
    expect(first.subtitleRanges).toEqual([{ start: 0, end: 4 }]);
  });

  it("stays fast on a few thousand items", () => {
    const big = prepare(
      Array.from({ length: 4000 }, (_, i) =>
        item(`Household ${i} Callaway`, `Unit ${i} · ${1000 + i} Meadow Lane · $${(i * 7) % 900}.00 owed`, `owner${i}@example.com 425555${String(i).padStart(4, "0")} august aug 2026`),
      ),
    );
    const started = performance.now();
    for (const q of ["callaway", "unit 2999", "meadow lane 1500", "calaway aug", "$63.00"]) search(big, q);
    const elapsed = performance.now() - started;
    expect(elapsed, `five searches took ${elapsed.toFixed(0)}ms`).toBeLessThan(500);
    expect(search(big, "unit 2999")[0].item.title).toBe("Household 2999 Callaway");
  });
});
