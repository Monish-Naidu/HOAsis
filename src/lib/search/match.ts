/**
 * The matcher behind the search palette: pure functions over strings, no
 * DOM, no records, so it can be tested on its own and swapped without
 * touching the index.
 *
 * What a person types is split into tokens; every token has to land
 * somewhere on the item (its title, its subtitle, or the hidden keywords),
 * and the best landing decides the score. The tiers, best first:
 *
 *   exact      the whole field, or one whole word, is the token
 *   prefix     the field starts with the token ("delg" → "Delgado, Rosa")
 *   word       a word inside the field starts with it ("delg" → "Rosa Delgado")
 *   inside     the token appears mid-word ("gado" → "Delgado")
 *   fuzzy      one typo away from a word ("delgao"), or the token's letters
 *              appear in order from the start of a word ("dlgdo")
 *
 * Folding is case and accent insensitive, so "Muñoz" is found by "munoz" and
 * "MUNOZ". Numeric tokens drop their "$" and thousands commas, so "$1,250.00"
 * is the same search as "1250.00".
 *
 * Cost is linear in the size of the index for every keystroke: a few
 * thousand items with a handful of tokens each is well under a millisecond
 * of work per token, which is why nothing here builds a trie.
 */

export type Tier = "exact" | "prefix" | "word" | "inside" | "fuzzy";

export interface Range {
  start: number;
  end: number;
}

export interface TokenMatch {
  tier: Tier;
  /** Where the token landed, in the folded text (which the raw text maps to 1:1). */
  ranges: Range[];
}

export const TIER_SCORE: Record<Tier, number> = {
  exact: 100,
  prefix: 80,
  word: 60,
  inside: 40,
  fuzzy: 20,
};

const COMBINING = /[̀-ͯ]/g;

/**
 * Lowercase, accents stripped, one space between words.
 *
 * NFKD splits "é" into "e" plus a combining accent, and dropping the accent
 * leaves the base letter, so the folded string is the same length as the
 * raw one character for character except where a ligature expands. Ranges
 * are computed on the folded string and applied to the raw one, which is
 * right for every name in a roster and one character off for "ﬁ".
 */
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(COMBINING, "");
}

/** The words a person typed, folded, with money punctuation dropped. */
export function tokenize(query: string): string[] {
  return fold(query)
    .split(/\s+/)
    .map(cleanToken)
    .filter(Boolean);
}

/** "$1,250.00" → "1250.00"; "#42" → "42"; other tokens untouched. */
function cleanToken(token: string): string {
  if (/^[$#]?[\d,]+(\.\d+)?$/.test(token)) return token.replace(/[$#,]/g, "");
  return token;
}

// A word keeps its decimals, so "285.00" is one word and "$285.00" finds it.
const WORD = /[a-z0-9]+(?:\.[0-9]+)?/g;
const NUMERIC = /^\d+(\.\d+)?$/;

/** Every word in a folded string, with where it starts. */
export function words(folded: string): { word: string; start: number }[] {
  const out: { word: string; start: number }[] = [];
  WORD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD.exec(folded)) !== null) out.push({ word: m[0], start: m.index });
  return out;
}

/** Levenshtein with adjacent transposition, capped at `max` for an early exit. */
export function editDistance(a: string, b: string, max = 1): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur: number[] = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2.length = 0;
    prev2.push(...prev);
    const t = prev;
    prev = cur;
    cur = t;
  }
  return prev[b.length];
}

/** Whether `token`'s letters appear in `word` in order, starting at its first letter. */
function anchoredSubsequence(word: string, token: string): boolean {
  if (word[0] !== token[0]) return false;
  let j = 0;
  for (let i = 0; i < word.length && j < token.length; i++) if (word[i] === token[j]) j++;
  return j === token.length;
}

/**
 * How one token lands on one folded field, or null when it does not.
 *
 * Fuzzy matching only kicks in for tokens of four letters or more: at three
 * letters one typo is a third of the word, and "oct" would find "act", "out"
 * and "cot" before it found October. A whole word that is the token counts
 * as exact wherever it sits, so "Pool heater" and "Northsound Pool Service"
 * tie on "pool" and the newer one leads.
 */
export function matchToken(folded: string, token: string): TokenMatch | null {
  if (!token || !folded) return null;
  if (folded === token) return { tier: "exact", ranges: [{ start: 0, end: token.length }] };

  const ws = words(folded);
  for (const w of ws) {
    if (w.word === token) return { tier: "exact", ranges: [{ start: w.start, end: w.start + token.length }] };
  }
  // A number is the whole number or nothing: "285" is not a way to type
  // "$28,500.00", and "14" is not the start of 1428 Meadow Lane.
  if (NUMERIC.test(token)) return null;
  if (folded.startsWith(token)) return { tier: "prefix", ranges: [{ start: 0, end: token.length }] };
  for (const w of ws) {
    if (w.word.startsWith(token)) return { tier: "word", ranges: [{ start: w.start, end: w.start + token.length }] };
  }
  const at = folded.indexOf(token);
  if (at >= 0) return { tier: "inside", ranges: [{ start: at, end: at + token.length }] };

  if (token.length >= 4) {
    for (const w of ws) {
      if (w.word.length < 3) continue;
      if (editDistance(w.word, token, 1) <= 1 || anchoredSubsequence(w.word, token)) {
        return { tier: "fuzzy", ranges: [{ start: w.start, end: w.start + w.word.length }] };
      }
    }
  }
  return null;
}

/** Overlapping or touching ranges merged, in order. */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** A string cut into plain and matched pieces, for rendering with highlights. */
export function segments(text: string, ranges: Range[]): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const r of mergeRanges(ranges)) {
    const start = Math.max(r.start, at);
    const end = Math.min(r.end, text.length);
    if (start >= end) continue;
    if (start > at) out.push({ text: text.slice(at, start), hit: false });
    out.push({ text: text.slice(start, end), hit: true });
    at = end;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}

/* -------------------------------------------------------------------------- */

/** Anything searchable: a title people read, a subtitle, and hidden words. */
export interface Searchable {
  title: string;
  subtitle: string;
  keywords: string;
  /** `YYYY-MM-DD` or "", for ordering ties by recency. */
  date: string;
  /** Added to the score when the item matches at all. Pages use it to sit above records. */
  boost?: number;
  /**
   * How much a keyword match counts, 0 to 1. Records leave it at the default
   * (a body word is a weak signal); pages set it to 1, because "dues" is not
   * hidden text on Payments, it is what people call the page.
   */
  keywordWeight?: number;
}

export interface Prepared<T extends Searchable> {
  item: T;
  title: string;
  subtitle: string;
  keywords: string;
}

/** Fold every field once, so a keystroke does no string normalisation. */
export function prepare<T extends Searchable>(items: T[]): Prepared<T>[] {
  return items.map((item) => ({
    item,
    title: fold(item.title),
    subtitle: fold(item.subtitle),
    keywords: fold(item.keywords),
  }));
}

export interface Scored<T extends Searchable> {
  item: T;
  score: number;
  /** Where the tokens landed on the title and subtitle, for highlighting. */
  titleRanges: Range[];
  subtitleRanges: Range[];
}

const FIELD_WEIGHT = { title: 1, subtitle: 0.6, keywords: 0.4 } as const;

/** One item against every token; null when any token misses. */
export function scoreItem<T extends Searchable>(p: Prepared<T>, tokens: string[], query: string): Scored<T> | null {
  let score = 0;
  const titleRanges: Range[] = [];
  const subtitleRanges: Range[] = [];
  for (const token of tokens) {
    const t = matchToken(p.title, token);
    const s = matchToken(p.subtitle, token);
    const k = t || s ? null : matchToken(p.keywords, token);
    const best = Math.max(
      t ? TIER_SCORE[t.tier] * FIELD_WEIGHT.title : 0,
      s ? TIER_SCORE[s.tier] * FIELD_WEIGHT.subtitle : 0,
      k ? TIER_SCORE[k.tier] * (p.item.keywordWeight ?? FIELD_WEIGHT.keywords) : 0,
    );
    if (best === 0) return null;
    score += best;
    if (t) titleRanges.push(...t.ranges);
    if (s) subtitleRanges.push(...s.ranges);
  }
  // The words in the order typed, on the title, is what a person meant.
  if (tokens.length > 1) {
    if (p.title === query) score += 60;
    else if (p.title.startsWith(query)) score += 40;
    else if (p.title.includes(query)) score += 25;
  }
  score += p.item.boost ?? 0;
  return { item: p.item, score, titleRanges: mergeRanges(titleRanges), subtitleRanges: mergeRanges(subtitleRanges) };
}

/** The best `limit` items for a query, best first, newest first on a tie. */
export function search<T extends Searchable>(index: Prepared<T>[], query: string, limit = 40): Scored<T>[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const folded = tokens.join(" ");
  const out: Scored<T>[] = [];
  for (const p of index) {
    const s = scoreItem(p, tokens, folded);
    if (s) out.push(s);
  }
  return out
    .sort((a, b) => b.score - a.score || b.item.date.localeCompare(a.item.date))
    .slice(0, limit);
}
