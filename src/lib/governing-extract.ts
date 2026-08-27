import { DISCLOSURE_TOPICS, mentionsAny } from "@/lib/governing";
import type {
  DisclosureTopic,
  GoverningArticle,
  GoverningDoc,
  GoverningTopic,
} from "@/lib/types";

/**
 * Turning an uploaded document into text a person can search.
 *
 * The rule this file exists under is written down in
 * `docs/decisions/parsing-governing-documents.md`: we index governing
 * documents, we never judge them. So everything here is structural. It finds
 * where the articles start, keeps the words exactly as they were written, and
 * proposes a topic tag. It does not summarise, it does not decide what a
 * provision means, and it never concludes that anybody is in violation of one.
 *
 * The other rule is that a gap is shown as a gap. A section number the
 * extractor could not read confidently comes back marked uncertain, and text
 * that never attached to any heading comes back as an explicit hole in the
 * document. A silently wrong section number is worse than a visible blank,
 * because a board will cite it.
 */

export interface ExtractedArticle {
  /** Stable within one extraction, so the review screen can key on it. */
  key: string;
  /** "Article VII", "Section 4.1". As printed. */
  number: string;
  title: string;
  text: string[];
  /**
   * Whether the heading was read cleanly.
   *
   * `uncertain` means the number was found but something about it is worth a
   * human look: a borrowed title, an empty body, or a number that appears
   * twice in the same document.
   */
  confidence: "clear" | "uncertain";
  /** Why it is uncertain. Empty when it is not. */
  concerns: string[];
  /** Proposed, never applied. A person confirms these on the review screen. */
  suggestedTopic: GoverningTopic;
  suggestedDisclosure: DisclosureTopic[];
  /** Line in the source where this article started, so a board can check it. */
  startLine: number;
}

export interface ExtractionGap {
  /** Where a person should look in their own file. */
  where: string;
  reason: string;
  /** The first of the text involved, so it can be recognised. */
  preview: string;
}

export interface Extraction {
  /** The document this looks like. A guess, shown as a guess. */
  suggestedDocument: GoverningDoc;
  articles: ExtractedArticle[];
  gaps: ExtractionGap[];
  /** Lines that landed inside an article, over lines that had any text. */
  linesPlaced: number;
  linesWithText: number;
}

const ARTICLE_HEADING = /^\s*articles?\s+([IVXLC]+|\d+)\b\.?\s*[-–—:.]?\s*(.*)$/i;
const SECTION_HEADING = /^\s*sections?\s+(\d+(?:\.\d+)*)\b\.?\s*[-–—:.]?\s*(.*)$/i;
const NUMBERED_HEADING = /^\s*(\d+\.\d+(?:\.\d+)*)\s+(.{0,80})$/;

const TOPIC_HINTS: { topic: GoverningTopic; terms: string[] }[] = [
  { topic: "money", terms: ["assessment", "dues", "lien", "budget", "reserve", "delinquent", "collection"] },
  { topic: "meetings", terms: ["meeting", "quorum", "vote", "voting", "proxy", "ballot", "election"] },
  { topic: "enforcement", terms: ["fine", "fined", "violation", "enforce", "enforcement", "hearing", "penalty", "cure"] },
  { topic: "records", terms: ["record", "inspect", "inspection", "minutes", "audit"] },
  { topic: "property", terms: ["lot", "dwelling", "exterior", "fence", "park", "parked", "parking", "lease", "leasing", "maintain", "maintenance", "sign", "solar"] },
  { topic: "governance", terms: ["board", "director", "officer", "member", "amend", "amended", "association"] },
];

const DOC_HINTS: { doc: GoverningDoc; terms: string[] }[] = [
  { doc: "declaration", terms: ["declaration of covenants", "covenants, conditions", "cc&r", "runs with the land", "recorded in volume"] },
  // "board of directors" was here and had to come out. It appears in all three
  // documents, so it pulled a rule set toward bylaws on a one-all tie. A hint
  // that is not distinctive is worse than no hint, because the guess it
  // produces still arrives looking confident.
  { doc: "bylaws", terms: ["bylaws", "by-laws", "these bylaws", "annual meeting of the members"] },
  { doc: "rules", terms: ["rules and regulations", "adopted by the board", "rules & regulations"] },
];

/** Which of the three this reads like. Weakest inference here, so it is a suggestion. */
function guessDocument(source: string): GoverningDoc {
  const text = source.slice(0, 4000).toLowerCase();
  let best: { doc: GoverningDoc; hits: number } = { doc: "declaration", hits: 0 };
  for (const { doc, terms } of DOC_HINTS) {
    const hits = terms.filter((term) => text.includes(term)).length;
    if (hits > best.hits) best = { doc, hits };
  }
  return best.hits > 0 ? best.doc : "declaration";
}

function guessTopic(text: string): GoverningTopic {
  let best: { topic: GoverningTopic; hits: number } = { topic: "governance", hits: 0 };
  for (const { topic, terms } of TOPIC_HINTS) {
    const hits = terms.filter((term) => mentionsAny(text, [term])).length;
    if (hits > best.hits) best = { topic, hits };
  }
  return best.topic;
}

/**
 * Which of the eight disclosure topics this article might settle.
 *
 * Proposed only. The review screen shows these as unticked boxes, because
 * "your documents restrict rentals" is a statement about somebody's home and a
 * word match is not standing enough to make it.
 */
function suggestDisclosure(text: string): DisclosureTopic[] {
  return DISCLOSURE_TOPICS.filter((meta) => mentionsAny(text, meta.hints)).map(
    (meta) => meta.topic,
  );
}

/** A line that is mostly punctuation and digits is a scan artefact, not a sentence. */
function looksUnreadable(line: string): boolean {
  const letters = line.replace(/[^a-z]/gi, "").length;
  return line.trim().length > 12 && letters / line.trim().length < 0.55;
}

interface Heading {
  index: number;
  number: string;
  title: string;
}

function readHeading(
  line: string,
): { number: string; title: string; level: "article" | "section" } | null {
  const article = line.match(ARTICLE_HEADING);
  if (article) {
    return {
      number: `Article ${article[1].toUpperCase()}`,
      title: article[2].trim(),
      level: "article",
    };
  }

  const section = line.match(SECTION_HEADING);
  if (section) {
    return { number: `Section ${section[1]}`, title: section[2].trim(), level: "section" };
  }

  const numbered = line.match(NUMBERED_HEADING);
  // A numbered heading is only a heading if the rest of the line is short and
  // reads like a title. "4.1 Refuse containers" is one. "4.1 Refuse shall be
  // stored out of view from the street except between..." is a paragraph.
  if (numbered && numbered[2].trim() && !/[.;]$/.test(numbered[2].trim())) {
    return { number: `Section ${numbered[1]}`, title: numbered[2].trim(), level: "section" };
  }
  return null;
}

/**
 * Reads a governing document into articles.
 *
 * Takes the text, not the file. Pulling text out of a PDF is a separate
 * problem with its own failure modes, and keeping it separate means this part
 * is deterministic and can be tested against real wording.
 */
export function extractArticles(source: string): Extraction {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const found: (Heading & { level: "article" | "section" })[] = [];

  lines.forEach((line, index) => {
    const heading = readHeading(line);
    if (heading) found.push({ index, ...heading });
  });

  /**
   * Sections inside articles are body text, not articles of their own.
   *
   * A declaration is Articles containing Sections, and splitting on both
   * shreds Article I into its own definitions. A rule set is Sections all the
   * way down and has no Articles at all. So the unit is the outermost level
   * the document actually uses, and the section markers stay in the text where
   * a reader can still find the subsection a notice cites.
   */
  const hasArticles = found.some((h) => h.level === "article");
  const headings: Heading[] = hasArticles
    ? found.filter((h) => h.level === "article")
    : found;

  const gaps: ExtractionGap[] = [];
  const linesWithText = lines.filter((line) => line.trim()).length;

  if (headings.length === 0) {
    return {
      suggestedDocument: guessDocument(source),
      articles: [],
      gaps: [
        {
          where: "The whole file",
          reason:
            "No article or section headings were found, so there is nothing to split on. A scanned document usually needs its text layer restored first.",
          preview: lines.find((line) => line.trim())?.slice(0, 120) ?? "",
        },
      ],
      linesPlaced: 0,
      linesWithText,
    };
  }

  // Anything before the first heading is preamble: recitals, a title page, a
  // legal description. It is not noise, and it is not an article either, so it
  // is reported rather than dropped into whatever article came first.
  const preamble = lines.slice(0, headings[0].index).filter((line) => line.trim());
  if (preamble.length > 2) {
    gaps.push({
      where: `Before ${headings[0].number}`,
      reason: `${preamble.length} lines sit ahead of the first heading. Recitals and legal descriptions live here and are not indexed as articles.`,
      preview: preamble[0].trim().slice(0, 120),
    });
  }

  const seenNumbers = new Map<string, number>();
  let linesPlaced = 0;

  const articles: ExtractedArticle[] = headings.map((heading, position) => {
    const end = headings[position + 1]?.index ?? lines.length;
    const bodyLines = lines.slice(heading.index + 1, end);

    const paragraphs: string[] = [];
    let buffer: string[] = [];
    for (const line of bodyLines) {
      if (line.trim()) buffer.push(line.trim());
      else if (buffer.length) {
        paragraphs.push(buffer.join(" "));
        buffer = [];
      }
    }
    if (buffer.length) paragraphs.push(buffer.join(" "));

    linesPlaced += bodyLines.filter((line) => line.trim()).length + 1;

    const concerns: string[] = [];
    let title = heading.title;

    // A heading line with nothing after the number puts the title on the next
    // line about half the time. Borrowing it is right more often than not,
    // which is exactly why it gets flagged rather than trusted.
    if (!title && paragraphs.length > 0 && paragraphs[0].length < 80) {
      title = paragraphs.shift() ?? "";
      concerns.push("The title was taken from the line below the heading.");
    }
    if (!title) {
      title = heading.number;
      concerns.push("No title was found. The number is standing in for one.");
    }
    if (paragraphs.length === 0) {
      concerns.push("No text was found under this heading.");
      gaps.push({
        where: heading.number,
        reason: "The heading was found but nothing followed it before the next one.",
        preview: lines[heading.index].trim().slice(0, 120),
      });
    }

    const duplicate = seenNumbers.get(heading.number);
    seenNumbers.set(heading.number, (duplicate ?? 0) + 1);
    if (duplicate) {
      concerns.push(
        `${heading.number} appears more than once. An amendment is often restated in full at the end of a document, and the later one usually governs.`,
      );
    }

    const unreadable = paragraphs.filter(looksUnreadable);
    if (unreadable.length) {
      concerns.push(`${unreadable.length} paragraphs did not come through as readable text.`);
      gaps.push({
        where: heading.number,
        reason: "Some of the text under this heading did not survive extraction.",
        preview: unreadable[0].slice(0, 120),
      });
    }

    const whole = `${title} ${paragraphs.join(" ")}`;

    return {
      key: `x-${position}-${heading.number.replace(/\s+/g, "-").toLowerCase()}`,
      number: heading.number,
      title,
      text: paragraphs,
      confidence: concerns.length === 0 ? "clear" : "uncertain",
      concerns,
      suggestedTopic: guessTopic(whole),
      suggestedDisclosure: suggestDisclosure(whole),
      startLine: heading.index + 1,
    };
  });

  return {
    suggestedDocument: guessDocument(source),
    articles,
    gaps,
    linesPlaced,
    linesWithText,
  };
}

/**
 * An extracted article, once a person has accepted it.
 *
 * The plain reading is deliberately absent. Nothing here writes one, so the
 * article lands in the reader showing its governing text with the summary
 * marked as missing, and a board member fills it in. That is slower than
 * generating one and it is the only version of this we are willing to ship.
 */
export function toArticle(
  extracted: ExtractedArticle,
  input: {
    document: GoverningDoc;
    topic: GoverningTopic;
    affects: GoverningArticle["affects"];
    disclosureTopics: DisclosureTopic[];
    sourceDocumentId?: string;
    confirmedBy: string;
    confirmedOn: string;
  },
): GoverningArticle {
  return {
    id: `gov-${input.document}-${extracted.key}`,
    document: input.document,
    number: extracted.number,
    title: extracted.title,
    topic: input.topic,
    affects: input.affects,
    text: extracted.text,
    disclosureTopics: input.disclosureTopics.length ? input.disclosureTopics : undefined,
    extraction: {
      sourceDocumentId: input.sourceDocumentId,
      confirmedBy: input.confirmedBy,
      confirmedOn: input.confirmedOn,
    },
  };
}
