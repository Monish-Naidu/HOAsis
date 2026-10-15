import { describe, expect, it } from "vitest";
import {
  balanceStanding,
  capitalize,
  countWord,
  governingOffer,
  governingSubtitle,
  governingTeaser,
  liveMeetingLine,
  nameList,
  noticeSummary,
  openNoticesForHome,
  pastDateProblem,
  requestWords,
  transferLegLabel,
} from "@/lib/resident-wording";
import type { GoverningArticle, Violation } from "@/lib/types";

describe("balanceStanding", () => {
  const home = (
    balanceCents: number,
    standing: "current" | "grace" | "late" | "collections" = "current",
    daysPastDue = 0,
  ) => ({
    balanceCents,
    standing,
    daysPastDue,
  });

  it("says Paid up only for a balance of zero or less", () => {
    expect(balanceStanding(home(0)).label).toBe("Paid up");
    expect(balanceStanding(home(-5000)).label).toBe("Paid up");
    expect(balanceStanding(home(28500)).label).toBe("Not late");
    expect(balanceStanding(home(1)).label).not.toBe("Paid up");
  });

  it("says how late, or collections, when the home is not current", () => {
    expect(balanceStanding(home(28500, "late", 12))).toMatchObject({ tone: "warn" });
    expect(balanceStanding(home(28500, "late", 12)).label).toMatch(/12 days/);
    expect(balanceStanding(home(28500, "collections", 90))).toEqual({
      label: "In collections",
      tone: "danger",
    });
  });
});

const v = (over: Partial<Violation>) =>
  ({
    homeId: "own-1",
    unit: "1",
    stage: "first-notice",
    rule: "Trash bins visible",
    nextActionDate: "2026-09-02",
    ...over,
  }) as Violation;

describe("notices about a home", () => {
  const me = { id: "own-1", unit: "1" };

  it("keeps only open notices addressed to this home", () => {
    const list = [
      v({}),
      v({ stage: "cured" }),
      v({ homeId: "own-2", unit: "2" }),
      v({ homeId: "own-0" }),
    ];
    // The last one is addressed by unit, as after a sale.
    expect(openNoticesForHome(list, me)).toHaveLength(2);
    expect(openNoticesForHome(list, null)).toEqual([]);
  });

  it("names the rule and the next step", () => {
    expect(noticeSummary([v({})])).toEqual({
      title: "A notice about your home",
      detail: "Trash bins visible · next step Sep 2",
    });
    expect(noticeSummary([v({}), v({ rule: "Fence", nextActionDate: "2026-08-30" })])).toEqual({
      title: "2 notices about your home",
      detail: "Fence · next step Aug 30",
    });
  });
});

describe("liveMeetingLine", () => {
  it("prints the joined count only when somebody joined", () => {
    expect(liveMeetingLine(0)).toBe("Meeting on now");
    expect(liveMeetingLine(5)).toBe("Meeting on now · 5 joined");
  });
});

const article = (
  document: GoverningArticle["document"],
  extra: Partial<GoverningArticle> = {},
): GoverningArticle =>
  ({
    id: `${document}-1`,
    document,
    number: "Article I",
    title: "Something",
    topic: "general",
    text: ["The words."],
    affects: "both",
    ...extra,
  }) as GoverningArticle;

describe("countWord and capitalize", () => {
  it("writes small counts in words and larger ones in digits", () => {
    expect(countWord(0)).toBe("no");
    expect(countWord(3)).toBe("three");
    expect(countWord(4)).toBe("four");
    expect(countWord(12)).toBe("twelve");
    expect(countWord(13)).toBe("13");
    expect(capitalize("four")).toBe("Four");
    expect(capitalize("")).toBe("");
  });
});

describe("what the governing documents offer", () => {
  it("counts the documents that are really there", () => {
    const articles = [
      article("declaration", { plain: "In plain words." }),
      article("bylaws", { plain: "More plain words." }),
      article("rules", { plain: "Even more." }),
    ];
    expect(governingOffer(articles)).toMatchObject({ documents: 3, searchable: true });
    expect(governingSubtitle(articles)).toBe(
      "Three documents, searchable together, in plain words, with the exact wording one tap away.",
    );
    expect(governingTeaser(articles)).toBe(
      "The CC&Rs, the bylaws and the rules, in plain words, searchable, with the exact wording one tap away",
    );
  });

  it("does not promise plain words nobody wrote, or a count it does not have", () => {
    const articles = [article("declaration"), article("bylaws")];
    expect(governingSubtitle(articles)).toBe(
      "Two documents, searchable together, with the exact wording one tap away.",
    );
    expect(governingTeaser(articles)).toBe(
      "The CC&Rs and the bylaws, searchable, with the exact wording one tap away",
    );
  });

  it("says less again for one document with no text", () => {
    const articles = [article("rules", { text: [] })];
    expect(governingOffer(articles)).toMatchObject({ documents: 1, searchable: false });
    expect(governingSubtitle(articles)).toBe("One document.");
    expect(nameList(["the rules"])).toBe("the rules");
    expect(nameList([])).toBe("");
  });
});

describe("requestWords", () => {
  it("writes ISO dates the way every other screen does", () => {
    expect(requestWords("Planned start date 2027-03-01")).toBe("Planned start date March 1, 2027");
    expect(requestWords("Routed. The clock expires 2026-10-10.")).toBe(
      "Routed. The clock expires October 10, 2026.",
    );
  });

  it("puts the form's own response time on the clock", () => {
    expect(requestWords("Routed. 30-day response clock expires 2026-10-10.", 45)).toBe(
      "Routed. 45-day response clock expires October 10, 2026.",
    );
    expect(requestWords("CC&Rs Art. VII: ARC must respond within 30 days", 45)).toBe(
      "CC&Rs Art. VII: ARC must respond within 45 days",
    );
  });

  it("leaves the number alone when the form promised none, and plain text alone", () => {
    expect(requestWords("30-day response clock")).toBe("30-day response clock");
    expect(requestWords("Nothing dated here", 45)).toBe("Nothing dated here");
  });
});

describe("pastDateProblem", () => {
  it("refuses a planned start before today, with a reason", () => {
    expect(pastDateProblem("Planned start date", "2020-01-01", "2026-08-20")).toMatch(/has passed/);
  });

  it("accepts today and later, an empty field, and dates that look back", () => {
    expect(pastDateProblem("Planned start date", "2026-08-20", "2026-08-20")).toBeNull();
    expect(pastDateProblem("Planned start date", "2027-03-01", "2026-08-20")).toBeNull();
    expect(pastDateProblem("Planned start date", "", "2026-08-20")).toBeNull();
    expect(pastDateProblem("Date of purchase", "2020-01-01", "2026-08-20")).toBeNull();
  });
});

describe("transferLegLabel", () => {
  it("reads the two legs of a reserve transfer as one move", () => {
    expect(transferLegLabel({ category: "Reserve transfer", amountCents: -612000 })).toBe(
      "To reserves",
    );
    expect(transferLegLabel({ category: "Reserve transfer", amountCents: 612000 })).toBe(
      "From operating",
    );
  });

  it("says nothing for any other line", () => {
    expect(transferLegLabel({ category: "Landscaping", amountCents: -612000 })).toBeNull();
  });
});
