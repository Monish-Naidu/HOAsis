import { describe, expect, it } from "vitest";
import {
  DISCLOSURE_TOPICS,
  GOVERNING_DOCS,
  amendmentThreshold,
  articlesIn,
  disclosureCoverage,
  disclosureFindings,
  documentsPresent,
  parseCitation,
  resolveCitation,
} from "@/lib/governing";
import { extractArticles, toArticle } from "@/lib/governing-extract";
import { governingArticles } from "@/lib/data/governing";
import type { GoverningArticle } from "@/lib/types";

/**
 * The three documents, and the rules about not overreaching them.
 *
 * Two things are being protected here. One is the hierarchy: a declaration is
 * not a rule set, they are changed differently, and a product that treats them
 * as one thing will let a board adopt something void. The other is the line
 * written down in `docs/decisions/parsing-governing-documents.md`, that we
 * index governing documents and never judge them. Most of these tests exist to
 * catch a future change that quietly starts asserting what a provision means.
 */

function article(patch: Partial<GoverningArticle>): GoverningArticle {
  return {
    id: "test-1",
    document: "declaration",
    number: "Article I",
    title: "A title",
    topic: "property",
    affects: "owners",
    text: ["Some text."],
    ...patch,
  };
}

describe("the hierarchy", () => {
  it("orders the documents so the recorded one wins", () => {
    expect(GOVERNING_DOCS.declaration.precedence).toBeLessThan(
      GOVERNING_DOCS.bylaws.precedence,
    );
    expect(GOVERNING_DOCS.bylaws.precedence).toBeLessThan(GOVERNING_DOCS.rules.precedence);
  });

  it("only counts a document the association has actually put into words", () => {
    expect(documentsPresent([article({ document: "rules" })])).toEqual(["rules"]);
    expect(documentsPresent([])).toEqual([]);
  });

  it("lists the present documents in precedence order, not in fixture order", () => {
    const mixed = [
      article({ id: "a", document: "rules" }),
      article({ id: "b", document: "declaration" }),
      article({ id: "c", document: "bylaws" }),
    ];
    expect(documentsPresent(mixed)).toEqual(["declaration", "bylaws", "rules"]);
  });
});

describe("amendmentThreshold", () => {
  it("reads the bar out of the document rather than assuming a majority", () => {
    // The seeded bylaws say sixty-seven percent, the declaration says
    // seventy-five. Assuming a majority would quietly certify a failed vote.
    expect(amendmentThreshold(governingArticles, "bylaws")).toContain("sixty-seven");
    expect(amendmentThreshold(governingArticles, "declaration")).toContain("seventy-five");
  });

  it("says the declaration has to be recorded, because an unrecorded one is not amended", () => {
    expect(amendmentThreshold(governingArticles, "declaration")).toContain("recording");
    expect(amendmentThreshold(governingArticles, "bylaws")).not.toContain("recording");
  });

  it("says a rule takes a board vote and no owner vote at all", () => {
    expect(amendmentThreshold(governingArticles, "rules")).toBe(
      "a vote of the board at a meeting",
    );
  });

  it("falls back to naming the document rather than inventing a number", () => {
    const silent = [article({ document: "bylaws", title: "Membership" })];
    expect(amendmentThreshold(silent, "bylaws")).toBe("the share stated in your bylaws");
  });
});

describe("parseCitation", () => {
  it("reads the shapes boards actually type", () => {
    expect(parseCitation("CC&Rs Art. IX §2(b)")).toEqual({
      document: "declaration",
      article: "IX",
      section: "2(b)",
    });
    expect(parseCitation("Rules & Regs §4.1").document).toBe("rules");
    expect(parseCitation("Bylaws Article VII").document).toBe("bylaws");
    expect(parseCitation("Declaration, Article XII").article).toBe("XII");
  });

  it("comes back empty rather than wrong when it cannot tell", () => {
    // A citation we place on the wrong provision is worse than one we do not
    // place at all, because only the first one gets sent in a notice.
    expect(parseCitation("the usual rule about fences").document).toBeUndefined();
    expect(parseCitation("").article).toBeUndefined();
  });
});

describe("resolveCitation", () => {
  it("lands a citation on the article it names", () => {
    const match = resolveCitation("CC&Rs Art. IX §2(b)", governingArticles);
    expect(match.article?.number).toBe("Article IX");
    expect(match.article?.document).toBe("declaration");
  });

  it("keeps the two Article VIIs apart", () => {
    // The declaration and the bylaws both have an Article VII and they are
    // different provisions. Resolving to the wrong one is a notice about
    // paint that cites the assessment article.
    const declaration = resolveCitation("CC&Rs Art. VII §1", governingArticles);
    const bylaws = resolveCitation("Bylaws Article VII", governingArticles);
    expect(declaration.article?.document).toBe("declaration");
    expect(bylaws.article?.document).toBe("bylaws");
    expect(declaration.article?.id).not.toBe(bylaws.article?.id);
  });

  it("resolves a rule cited by its section number", () => {
    expect(resolveCitation("Rules & Regs §4.1", governingArticles).article?.number).toBe(
      "Section 4.1",
    );
  });

  it("says why nothing matched instead of guessing at the nearest article", () => {
    expect(resolveCitation("CC&Rs Art. XCIX", governingArticles).problem).toBe(
      "not-in-this-document",
    );
    expect(resolveCitation("some rule somewhere", governingArticles).problem).toBe(
      "no-document",
    );
    expect(resolveCitation("Bylaws Article I", []).problem).toBe("document-not-loaded");
  });
});

describe("disclosureFindings", () => {
  it("answers a topic only from a provision somebody confirmed", () => {
    const tagged = article({ disclosureTopics: ["solar"], title: "Solar" });
    const finding = disclosureFindings([tagged]).find((f) => f.meta.topic === "solar");
    expect(finding?.status).toBe("answered");
    expect(finding?.confirmed).toHaveLength(1);
  });

  it("never turns a word match into an answer", () => {
    // This is the whole decision. "Your documents restrict rentals" is a claim
    // about somebody's home, and the word "lease" appearing is not standing
    // enough to make it.
    const untagged = article({ title: "Leasing", text: ["An Owner may lease their Lot."] });
    const finding = disclosureFindings([untagged]).find((f) => f.meta.topic === "rentals");
    expect(finding?.status).toBe("unconfirmed");
    expect(finding?.confirmed).toEqual([]);
    expect(finding?.candidates).toHaveLength(1);
  });

  it("says a topic is not addressed rather than filling it in", () => {
    const unrelated = article({ title: "Officers", text: ["The Secretary keeps minutes."] });
    const finding = disclosureFindings([unrelated]).find((f) => f.meta.topic === "flags");
    expect(finding?.status).toBe("silent");
  });

  it("stops proposing candidates once a topic has a confirmed answer", () => {
    const confirmed = article({ id: "a", disclosureTopics: ["solar"] });
    const mentions = article({ id: "b", text: ["A solar panel is a panel."] });
    const finding = disclosureFindings([confirmed, mentions]).find(
      (f) => f.meta.topic === "solar",
    );
    expect(finding?.candidates).toEqual([]);
  });

  it("covers all eight, always, so a gap is visible rather than absent", () => {
    expect(disclosureFindings([])).toHaveLength(DISCLOSURE_TOPICS.length);
    expect(disclosureCoverage([]).gaps).toHaveLength(DISCLOSURE_TOPICS.length);
  });
});

/* -------------------------------------------------------------------------- */

const SAMPLE = `DECLARATION OF COVENANTS, CONDITIONS AND RESTRICTIONS

This Declaration is made this day by the undersigned, and recorded in Volume 168
of Plats, records of the County Auditor.

ARTICLE I. Definitions

Section 1. "Lot" means a parcel of land shown on the Plat.

Section 2. "Owner" means the record holder of fee simple title to a Lot.

ARTICLE II
Use of lots

Each Lot shall be used for single family residential purposes only. No trade or
business shall be conducted upon any Lot.

ARTICLE III. Parking

No commercial vehicle, boat, or trailer shall be parked on a Lot overnight
except within a closed garage.
`;

describe("extractArticles", () => {
  it("splits on headings and keeps the wording exactly as written", () => {
    const result = extractArticles(SAMPLE);
    expect(result.articles.map((a) => a.number)).toEqual([
      "Article I",
      "Article II",
      "Article III",
    ]);
    expect(result.articles[2].text[0]).toContain("No commercial vehicle, boat, or trailer");
  });

  it("reads the title off the heading line where there is one", () => {
    const result = extractArticles(SAMPLE);
    expect(result.articles[0].title).toBe("Definitions");
    expect(result.articles[0].confidence).toBe("clear");
  });

  it("flags a title it had to borrow from the line below", () => {
    // Right more often than not, which is exactly why it is flagged rather
    // than trusted. A silently wrong title is one a board cites.
    const borrowed = extractArticles(SAMPLE).articles[1];
    expect(borrowed.title).toBe("Use of lots");
    expect(borrowed.confidence).toBe("uncertain");
    expect(borrowed.concerns.join(" ")).toContain("taken from the line below");
  });

  it("reports the preamble as a gap instead of folding it into Article I", () => {
    const gap = extractArticles(SAMPLE).gaps.find((g) => g.where.includes("Article I"));
    expect(gap?.reason).toContain("ahead of the first heading");
  });

  it("guesses which of the three it is, and offers it as a guess", () => {
    expect(extractArticles(SAMPLE).suggestedDocument).toBe("declaration");
    expect(
      extractArticles("RULES AND REGULATIONS\n\nSection 1.1 Quiet hours\n\nNo noise.")
        .suggestedDocument,
    ).toBe("rules");
  });

  it("is not pulled off a rule set by a phrase every document contains", () => {
    // "Board of Directors" appears in all three, and as a bylaws hint it used
    // to win a one-all tie and file a rule set under the wrong document. A
    // hint that is not distinctive is worse than no hint, because the guess it
    // produces still arrives looking confident.
    const rules = extractArticles(
      "RULES AND REGULATIONS\n\nAdopted by resolution of the Board of Directors.\n\nSection 7.1 Quiet hours\n\nNo amplified sound.\n",
    );
    expect(rules.suggestedDocument).toBe("rules");
  });

  it("says it found nothing rather than inventing a single article", () => {
    const result = extractArticles("Just some prose with no headings at all in it.");
    expect(result.articles).toEqual([]);
    expect(result.gaps[0].reason).toContain("No article or section headings");
  });

  it("flags a repeated article number rather than silently keeping both", () => {
    const restated = `ARTICLE V. Assessments

The original text.

ARTICLE V. Assessments

The text as amended in 2019.
`;
    const result = extractArticles(restated);
    expect(result.articles).toHaveLength(2);
    expect(result.articles[1].concerns.join(" ")).toContain("appears more than once");
    expect(result.articles[1].confidence).toBe("uncertain");
  });

  it("does not mistake a numbered paragraph for a heading", () => {
    // "4.1 Refuse containers" is a heading. "4.1 Refuse shall be stored out of
    // view." is a paragraph, and splitting on it fabricates an article.
    const result = extractArticles(
      "Section 4. Refuse\n\n4.1 Refuse shall be stored out of view from the street.\n",
    );
    expect(result.articles.map((a) => a.number)).toEqual(["Section 4"]);
  });

  it("flags a heading with nothing under it", () => {
    const result = extractArticles("ARTICLE I. Definitions\nARTICLE II. Use\n\nText.\n");
    expect(result.articles[0].concerns.join(" ")).toContain("No text was found");
    expect(result.gaps.some((g) => g.where === "Article I")).toBe(true);
  });

  it("proposes a topic and a disclosure tag without applying either", () => {
    const parking = extractArticles(SAMPLE).articles[2];
    expect(parking.suggestedTopic).toBe("property");
    expect(parking.suggestedDisclosure).toContain("parking");
  });
});

describe("toArticle", () => {
  const confirmed = toArticle(extractArticles(SAMPLE).articles[2], {
    document: "declaration",
    topic: "property",
    affects: "owners",
    disclosureTopics: ["parking"],
    confirmedBy: "Arya Mehr, President",
    confirmedOn: "2026-08-20",
  });

  it("writes no plain reading, because a machine has no standing to write one", () => {
    expect(confirmed.plain).toBeUndefined();
  });

  it("records who confirmed it, so extracted text can be told from typed text", () => {
    expect(confirmed.extraction?.confirmedBy).toBe("Arya Mehr, President");
    expect(confirmed.extraction?.confirmedOn).toBe("2026-08-20");
  });

  it("takes the tags it was given rather than the ones that were suggested", () => {
    const untagged = toArticle(extractArticles(SAMPLE).articles[2], {
      document: "declaration",
      topic: "property",
      affects: "owners",
      disclosureTopics: [],
      confirmedBy: "Arya Mehr, President",
      confirmedOn: "2026-08-20",
    });
    expect(untagged.disclosureTopics).toBeUndefined();
  });

  it("lands in the document the board picked, not the one that was guessed", () => {
    const asRules = toArticle(extractArticles(SAMPLE).articles[0], {
      document: "rules",
      topic: "governance",
      affects: "owners",
      disclosureTopics: [],
      confirmedBy: "Arya Mehr, President",
      confirmedOn: "2026-08-20",
    });
    expect(asRules.document).toBe("rules");
    expect(articlesIn([asRules], "declaration")).toEqual([]);
  });
});
