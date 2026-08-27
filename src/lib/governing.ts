import type {
  DisclosureTopic,
  GoverningArticle,
  GoverningDoc,
  GoverningDocMeta,
} from "@/lib/types";

/**
 * The three documents, what each one is, and what beats what.
 *
 * Owners and boards say "the bylaws" for all of it. Getting this wrong is not
 * a vocabulary problem: a board that thinks it can change a covenant by a
 * board vote has just adopted something void, and an owner who thinks the
 * declaration can be voted away by the neighbours is wrong in the other
 * direction. Precedence is the whole content of this table.
 */
export const GOVERNING_DOCS: Record<GoverningDoc, GoverningDocMeta> = {
  declaration: {
    kind: "declaration",
    label: "Declaration, the CC&Rs",
    short: "the CC&Rs",
    plain:
      "Recorded against the land before the first home sold. It binds you because you bought here, whether or not you ever read it, and it is the hardest of the three to change.",
    changedBy: "A supermajority of all owners, then recorded with the county",
    precedence: 1,
    recorded: true,
  },
  bylaws: {
    kind: "bylaws",
    label: "Bylaws",
    short: "the bylaws",
    plain:
      "How the association runs itself. Elections, meetings, quorum, who may sign what. Mostly about the board rather than about your home.",
    changedBy: "A vote of the owners at the share the bylaws themselves state",
    precedence: 2,
    recorded: false,
  },
  rules: {
    kind: "rules",
    label: "Rules and regulations",
    short: "the rules",
    plain:
      "Adopted by the board under authority the declaration already gave it. These are the ones that change, and they cannot go further than the document above them.",
    changedBy: "The board, at a meeting, with no owner vote",
    precedence: 3,
    recorded: false,
  },
};

/** Declaration first, because that is the order a conflict resolves in. */
export const DOC_ORDER: GoverningDoc[] = ["declaration", "bylaws", "rules"];

/** The documents this association has actually put into words, in precedence order. */
export function documentsPresent(articles: GoverningArticle[]): GoverningDoc[] {
  return DOC_ORDER.filter((doc) => articles.some((a) => a.document === doc));
}

export function articlesIn(
  articles: GoverningArticle[],
  doc: GoverningDoc,
): GoverningArticle[] {
  return articles.filter((a) => a.document === doc);
}

/**
 * What it takes to change one of these documents, read out of the document.
 *
 * Every association states its own bar, and it is usually a share of all
 * homes rather than of the ones that vote, which is the distinction that sinks
 * amendments. So this is read from the association's own words rather than
 * assumed. The rules layer has no such provision because a board adopts a rule
 * by resolution, and saying so plainly is the point.
 */
export function amendmentThreshold(
  articles: GoverningArticle[],
  doc: GoverningDoc,
): string {
  if (doc === "rules") return "a vote of the board at a meeting";

  const provision = articlesIn(articles, doc).find(
    (a) => /amend/i.test(a.title) || /may be amended/i.test(a.text.join(" ")),
  );
  const match = provision?.text
    .join(" ")
    .match(/([a-z-]+(?:\s+[a-z-]+)?)\s+percent of the total voting interests/i);

  if (!match) return `the share stated in your ${GOVERNING_DOCS[doc].label.toLowerCase()}`;
  const share = `${match[1]} percent of all homes`;
  return doc === "declaration" ? `${share}, then recording with the county` : share;
}

/* -------------------------------------------------------------------------- */
/* Citations                                                                   */
/* -------------------------------------------------------------------------- */

export interface ParsedCitation {
  /** Which document the citation names, where it names one recognisably. */
  document?: GoverningDoc;
  /** "IX", "4.1". As written. */
  article?: string;
  /** "2(b)". The part of the article, when the citation goes that deep. */
  section?: string;
}

const DOC_PATTERNS: { pattern: RegExp; doc: GoverningDoc }[] = [
  { pattern: /cc\s*&?\s*r|covenant|declaration/i, doc: "declaration" },
  { pattern: /by-?law/i, doc: "bylaws" },
  { pattern: /rules?\b|regs?\b|regulations?\b/i, doc: "rules" },
];

/**
 * Matches a whole word or its plural, never a fragment.
 *
 * Substring matching on legal text is quietly wrong in a way that matters
 * here: "sign" is inside "design" and "assignment", "fee" is inside "fee
 * simple title". Both would put an article on a disclosure list it has nothing
 * to do with, and this product's whole position is that it does not make
 * claims about somebody's documents that it cannot stand behind.
 */
export function mentionsAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) =>
    new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "i").test(haystack),
  );
}

/**
 * Reads a citation a board typed into its parts.
 *
 * Boards write these by hand and inconsistently: "CC&Rs Art. IX §2(b)",
 * "Bylaws Article VII", "Rules & Regs §4.1". Parsing is deliberately forgiving
 * on the shape and strict on the outcome, because a citation we cannot place
 * should come back empty rather than come back wrong. A notice resting on the
 * wrong provision is worse than one resting on a provision we did not resolve.
 */
export function parseCitation(citation: string): ParsedCitation {
  // "Art. IX", "Article VII". Roman numerals only, which is how articles are
  // numbered in every set of these documents we have seen.
  const article = citation.match(/art(?:icle)?\.?\s*([IVXLC]+)\b/i)?.[1];
  // "§2(b)", "Section 4.1", "§ 4.1".
  const section = citation.match(/(?:§|sec(?:tion)?\.?)\s*([\d.]+(?:\([a-z]\))?)/i)?.[1];

  // A citation with no provision number is not a citation, it is a sentence
  // about the rules. "The usual rule about fences" names the rules document by
  // accident, and treating it as a citation would send a notice pointing at
  // whichever article happened to sort first.
  if (!article && !section) return {};

  const document = DOC_PATTERNS.find(({ pattern }) => pattern.test(citation))?.doc;
  return { document, article, section };
}

export interface CitationMatch {
  citation: string;
  parsed: ParsedCitation;
  /** The article the citation lands on, when one does. */
  article?: GoverningArticle;
  /**
   * Why nothing matched, in words a board can act on.
   *
   * An unresolved citation is a real finding: either the provision was
   * mistyped or the document it names has never been put into words here.
   * Both are worth telling a board before they send a notice on it.
   */
  problem?: "no-document" | "not-in-this-document" | "document-not-loaded";
}

/**
 * Points a citation at the provision it names.
 *
 * Resolution stops at the article. A citation to "§2(b)" is shown by opening
 * Article IX and letting the reader find subsection 2(b) in the text, which is
 * honest, rather than by extracting a subsection we never stored.
 */
export function resolveCitation(
  citation: string,
  articles: GoverningArticle[],
): CitationMatch {
  const parsed = parseCitation(citation);
  if (!parsed.document) return { citation, parsed, problem: "no-document" };

  const withinDoc = articlesIn(articles, parsed.document);
  if (withinDoc.length === 0) {
    return { citation, parsed, problem: "document-not-loaded" };
  }

  const article = withinDoc.find((a) => {
    if (parsed.article) {
      // "Article IX" in the document, "Art. IX" in the citation.
      return new RegExp(`\\b${parsed.article}\\b`, "i").test(a.number);
    }
    if (parsed.section) return a.number.replace(/[^\d.]/g, "") === parsed.section;
    return false;
  });

  return article
    ? { citation, parsed, article }
    : { citation, parsed, problem: "not-in-this-document" };
}

/* -------------------------------------------------------------------------- */
/* What a buyer has to be told                                                 */
/* -------------------------------------------------------------------------- */

export interface DisclosureTopicMeta {
  topic: DisclosureTopic;
  /** The question an owner is actually asking. */
  question: string;
  /** Why a legislature decided a buyer has to be told this one. */
  why: string;
  /** Terms an extractor may propose a tag from. Never enough on their own. */
  hints: string[];
}

/**
 * The eight, with the statute that put each one on the list.
 *
 * We did not choose these. Virginia's resale disclosure items, Colorado's
 * disclosure statute and Washington's public offering statement were written
 * separately and land on the same set, which is what makes it defensible: this
 * is what a buyer is legally entitled to be warned about, not a list of what
 * we find interesting.
 */
export const DISCLOSURE_TOPICS: DisclosureTopicMeta[] = [
  {
    topic: "architectural",
    question: "What do I have to ask permission for?",
    why: "The single largest source of citations. An owner who does not know approval exists cannot apply for it, and the project is a violation the day it starts.",
    hints: ["architectural", "approval", "committee", "alteration", "exterior", "plan"],
  },
  {
    topic: "lien",
    question: "What happens if I fall behind on dues?",
    why: "The consequence is a lien on the home and, eventually, a forced sale. Every state researched requires a buyer be told this before closing.",
    hints: ["lien", "foreclose", "foreclosure", "foreclosing", "delinquent", "delinquency", "collection"],
  },
  {
    topic: "parking",
    question: "Where can I park, and what can I park there?",
    why: "Work trucks, boats, campers and trailers are routinely banned overnight, and a buyer with one finds out after they move in.",
    hints: ["park", "parked", "parking", "vehicle", "garage", "driveway", "trailer", "boat"],
  },
  {
    topic: "rentals",
    question: "Can I rent my home out?",
    why: "Rental caps and minimum lease terms change what the home is worth to a buyer, and lenders ask for the figure during underwriting.",
    hints: ["lease", "leased", "leasing", "rent", "rented", "rental", "tenant"],
  },
  {
    topic: "home-business",
    question: "Can I run a business from home?",
    why: "Almost every declaration restricts a lot to residential use, with a carve-out narrower than most buyers assume.",
    hints: ["business", "businesses", "trade", "commercial", "occupation"],
  },
  {
    topic: "signs",
    question: "What can I put on my lawn or in my window?",
    why: "Sign restrictions reach political and for-sale signs, and several states limit how far an association may go.",
    hints: ["sign", "signage", "banner", "political", "placard"],
  },
  {
    topic: "flags",
    question: "Can I fly a flag?",
    why: "Federal and state law protect some flags and not others, and associations get this wrong in both directions.",
    hints: ["flag", "flagpole", "pennant"],
  },
  {
    topic: "solar",
    question: "Can I install solar panels?",
    why: "A buyer planning solar needs to know before they buy, and many declarations still carry a ban that state law has since made unenforceable.",
    hints: ["solar", "photovoltaic", "renewable"],
  },
];

export interface DisclosureFinding {
  meta: DisclosureTopicMeta;
  /** Articles a person confirmed as governing this topic. */
  confirmed: GoverningArticle[];
  /**
   * Articles whose words suggest they govern it, which nobody has confirmed.
   *
   * Kept separate from `confirmed` on purpose. A word match is a place to
   * look, not a statement about somebody's home, and the two are never merged
   * into one list on screen.
   */
  candidates: GoverningArticle[];
  status: "answered" | "unconfirmed" | "silent";
}

/**
 * What this association's documents say about each of the eight.
 *
 * A topic with no confirmed article comes back `silent` rather than being
 * filled in from a keyword match. "Your documents do not address flags" is a
 * useful and honest answer. "Your documents ban flags" on the strength of the
 * word appearing somewhere is an accusation we have no standing to make.
 */
export function disclosureFindings(articles: GoverningArticle[]): DisclosureFinding[] {
  return DISCLOSURE_TOPICS.map((meta) => {
    const confirmed = articles.filter((a) => a.disclosureTopics?.includes(meta.topic));
    const candidates = confirmed.length
      ? []
      : articles.filter((a) => {
          if (a.disclosureTopics?.length) return false;
          return mentionsAny(`${a.title} ${a.plain ?? ""} ${a.text.join(" ")}`, meta.hints);
        });

    return {
      meta,
      confirmed,
      candidates,
      status: confirmed.length ? "answered" : candidates.length ? "unconfirmed" : "silent",
    };
  });
}

/** How much of the statutory disclosure list this association can actually answer. */
export function disclosureCoverage(articles: GoverningArticle[]): {
  answered: number;
  total: number;
  gaps: DisclosureTopic[];
} {
  const findings = disclosureFindings(articles);
  return {
    answered: findings.filter((f) => f.status === "answered").length,
    total: findings.length,
    gaps: findings.filter((f) => f.status !== "answered").map((f) => f.meta.topic),
  };
}
