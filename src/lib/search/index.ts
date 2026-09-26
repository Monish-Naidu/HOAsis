import { prepare, search, type Prepared, type Scored } from "./match";
import type { SearchHit } from "./records";

/**
 * The search module, in one import.
 *
 *   match.ts    the pure matcher: fold, tokenise, tiers, highlight ranges
 *   records.ts  the index over an association's records, board and resident
 *   pages.ts    pages by name and by the words people use for them
 *   actions.ts  shortcuts a dollar amount or a unit number suggests
 *   recent.ts   the last five things chosen, for an empty box
 */

export * from "./match";
export * from "./records";
export * from "./pages";
export * from "./actions";
export * from "./recent";

export type ScoredHit = Scored<SearchHit>;
export type PreparedIndex = Prepared<SearchHit>[];

/** Fold an index once; `search` then costs one pass per keystroke. */
export function prepareIndex(hits: SearchHit[]): PreparedIndex {
  return prepare(hits);
}

/** The best hits for a query, with where the words landed. */
export function searchIndex(index: PreparedIndex, query: string, limit = 40): ScoredHit[] {
  return search(index, query, limit);
}

/**
 * The hits alone, best first. The old shape of the palette's call, kept for
 * tests and anything that wants a list without highlight ranges.
 */
export function searchHits(hits: SearchHit[], query: string, limit = 30): SearchHit[] {
  return search(prepare(hits), query, limit).map((s) => s.item);
}

export interface HitGroup<T = SearchHit> {
  section: string;
  hits: T[];
}

/**
 * Hits in the order found, grouped under their tab, each group capped.
 *
 * Groups come in the order their best hit ranked, so the tab with the closest
 * match sits on top, except Shortcuts, which the query itself asked for and
 * always lead.
 */
export function groupHits<T extends { section: string }>(hits: T[], perGroup = 5): HitGroup<T>[] {
  const groups: HitGroup<T>[] = [];
  for (const hit of hits) {
    let group = groups.find((g) => g.section === hit.section);
    if (!group) {
      group = { section: hit.section, hits: [] };
      groups.push(group);
    }
    if (group.hits.length < perGroup) group.hits.push(hit);
  }
  return groups.sort((a, b) => Number(b.section === "Shortcuts") - Number(a.section === "Shortcuts"));
}
