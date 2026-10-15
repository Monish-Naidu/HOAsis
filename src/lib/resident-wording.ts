import type { GoverningArticle, Home, Violation } from "@/lib/types";
import { GOVERNING_DOCS, documentsPresent } from "@/lib/governing";
import { formatDate, pastDueLabel, pluralize } from "@/lib/utils";

/**
 * Words the resident screens share, so the home card, the bell, the rail and
 * the pages say one thing about one fact.
 */

/**
 * The badge under a balance.
 *
 * "Paid up" is for a home that owes nothing, a credit included. A home with a
 * bill that is not late yet is "Not late", which is true and does not
 * contradict the amount printed above it.
 */
export function balanceStanding(home: Pick<Home, "balanceCents" | "standing" | "daysPastDue">): {
  label: string;
  tone: "ok" | "neutral" | "warn" | "danger";
} {
  if (home.standing === "current") {
    return home.balanceCents > 0
      ? { label: "Not late", tone: "neutral" }
      : { label: "Paid up", tone: "ok" };
  }
  if (home.standing === "collections") return { label: "In collections", tone: "danger" };
  return { label: pastDueLabel(home.daysPastDue), tone: "warn" };
}

/**
 * Notices that are open and addressed to this home. The same test the
 * Requests page and the notices screen use: by owner, or by unit when the
 * home changed hands.
 */
export function openNoticesForHome(
  violations: Violation[],
  home: Pick<Home, "id" | "unit"> | null | undefined,
): Violation[] {
  if (!home) return [];
  return violations.filter(
    (v) => v.stage !== "cured" && (v.homeId === home.id || v.unit === home.unit),
  );
}

/** One row for the home card and the bell: what it is, and what happens next. */
export function noticeSummary(notices: Violation[]): { title: string; detail: string } {
  const first = [...notices].sort((a, b) => (a.nextActionDate < b.nextActionDate ? -1 : 1))[0];
  return {
    title:
      notices.length === 1
        ? "A notice about your home"
        : `${pluralize(notices.length, "notice")} about your home`,
    detail: `${first.rule} · next step ${formatDate(first.nextActionDate)}`,
  };
}

/**
 * The line under a live meeting. The count is how many joined, and for a real
 * association nothing records that, so "0 joined" is shown to nobody.
 */
export function liveMeetingLine(joined: number): string {
  return joined > 0 ? `Meeting on now · ${joined} joined` : "Meeting on now";
}

const COUNT_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** The first letter up, for a sentence that starts with a computed word. */
export function capitalize(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** A small count in words for running text; past twelve, the digits. */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

/**
 * What the governing documents can be said to offer, from what is actually on
 * file. The screens used to promise "three documents, searchable, in plain
 * words" whatever was there; each claim now needs something behind it.
 */
export function governingOffer(articles: GoverningArticle[]): {
  documents: number;
  /** Short names in precedence order, for example "the CC&Rs". */
  names: string[];
  searchable: boolean;
  plainWords: boolean;
} {
  const present = documentsPresent(articles);
  return {
    documents: present.length,
    names: present.map((kind) => GOVERNING_DOCS[kind].short),
    searchable: articles.some((a) => a.text.length > 0),
    plainWords: articles.some((a) => (a.plain ?? "").trim() !== ""),
  };
}

/** "the CC&Rs, the bylaws and the rules". */
export function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The line under the rules page's heading: only what the page really does. */
export function governingSubtitle(articles: GoverningArticle[]): string {
  const offer = governingOffer(articles);
  const lead = `${countWord(offer.documents)} ${offer.documents === 1 ? "document" : "documents"}`;
  const parts = [
    offer.searchable ? (offer.documents > 1 ? "searchable together" : "searchable") : null,
    offer.plainWords ? "in plain words" : null,
    offer.searchable ? "with the exact wording one tap away" : null,
  ].filter(Boolean);
  return `${capitalize([lead, ...parts].join(", "))}.`;
}

/** The line on the Documents page's link to the rules, from the same facts. */
export function governingTeaser(articles: GoverningArticle[]): string {
  const offer = governingOffer(articles);
  const parts = [
    nameList(offer.names),
    offer.plainWords ? "in plain words" : null,
    offer.searchable ? "searchable" : null,
    offer.searchable ? "with the exact wording one tap away" : null,
  ].filter(Boolean);
  return capitalize(parts.join(", "));
}

/** What a request form promises before it is sent. It is not an event on the request. */
export const REQUEST_SEEN_PROMISE = "The board sees this as soon as you send it.";

/**
 * A request's own words made readable. The thread and the answers carry
 * dates as the database wrote them ("clock expires 2026-10-10") and a clock
 * length written when the request was routed; the screen shows dates the way
 * every other screen does, and the response time the form itself promised.
 *
 * `decisionDays` is that promise. Without it the text is only re-dated.
 */
export function requestWords(text: string, decisionDays?: number): string {
  const dated = text.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (iso) => formatDate(iso, "long"));
  if (!decisionDays) return dated;
  return dated
    .replace(/\b\d+-day\b/g, `${decisionDays}-day`)
    .replace(/\bwithin \d+ days\b/g, `within ${decisionDays} days`);
}

/**
 * Dates that only make sense ahead of today: a planned start, a begin date.
 * A form field is told apart by its label, since fields carry no such flag.
 */
export function looksAhead(label: string): boolean {
  return /\b(start|begin|planned|proposed|install)/i.test(label);
}

export function pastDateProblem(label: string, value: string, today: string): string | null {
  if (!looksAhead(label)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value < today
    ? `${formatDate(value, "long")} has passed. Pick today or a later day.`
    : null;
}

/**
 * Which way a reserve transfer's leg went, so the two lines of one move read
 * as one move: the operating account's minus is "To reserves", the reserve
 * account's plus is "From operating". Null for any other line.
 */
export function transferLegLabel(entry: { category: string; amountCents: number }): string | null {
  if (entry.category !== "Reserve transfer") return null;
  return entry.amountCents < 0 ? "To reserves" : "From operating";
}
