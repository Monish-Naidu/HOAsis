"use client";

import { useSyncExternalStore } from "react";
import type { SearchHit, SearchKind } from "./records";

/**
 * The last few things chosen from search, shown when the box is empty.
 *
 * A board member who opened the same household three times this week wants
 * it one keystroke away, not four. Five entries, newest first, in this
 * browser only; a row is remembered by what it showed and where it went, so
 * the list still reads right after a reload without the index.
 *
 * Persisted under a `hoasis-` key on purpose: renaming the prefix signs
 * every browser out (see CLAUDE.md).
 */

export const RECENT_STORAGE_KEY = "hoasis-search-recent";
export const RECENT_LIMIT = 5;

export interface RecentEntry {
  id: string;
  kind: SearchKind;
  section: string;
  title: string;
  subtitle: string;
  href: string;
  tint: SearchHit["tint"];
}

/** Minimal storage surface so tests can hand in a Map-backed double. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RecentStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): readonly RecentEntry[];
  getServerSnapshot(): readonly RecentEntry[];
  remember(hit: SearchHit): void;
  clear(): void;
}

const EMPTY: readonly RecentEntry[] = [];

function isEntry(v: unknown): v is RecentEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return ["id", "kind", "section", "title", "subtitle", "href", "tint"].every((k) => typeof e[k] === "string");
}

function load(storage: KeyValueStorage | null): readonly RecentEntry[] {
  if (!storage) return EMPTY;
  try {
    const raw = storage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(isEntry).slice(0, RECENT_LIMIT);
  } catch {
    return EMPTY;
  }
}

function save(storage: KeyValueStorage | null, entries: readonly RecentEntry[]) {
  if (!storage) return;
  try {
    storage.setItem(RECENT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota or private mode. The in-memory copy still serves this page.
  }
}

/** What a hit is remembered as: what it showed and where it went, nothing live. */
export function toEntry(hit: SearchHit): RecentEntry {
  return {
    id: hit.id,
    kind: hit.kind,
    section: hit.section,
    title: hit.title,
    subtitle: hit.subtitle,
    href: hit.href,
    tint: hit.tint,
  };
}

/**
 * Builds a store over the given storage. Product code uses the singleton
 * below; tests build their own with a fake so they do not share state.
 */
export function createRecentStore(storage: KeyValueStorage | null): RecentStore {
  let snapshot: readonly RecentEntry[] | null = null;
  const listeners = new Set<() => void>();

  const getSnapshot = () => {
    if (snapshot === null) snapshot = load(storage);
    return snapshot;
  };

  const publish = (next: readonly RecentEntry[]) => {
    snapshot = next;
    save(storage, next);
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot,
    getServerSnapshot: () => EMPTY,
    remember(hit) {
      // Shortcuts are built from the query; remembering "Pay $285.00" would
      // offer a stale amount forever.
      if (hit.kind === "shortcut") return;
      const entry = toEntry(hit);
      const rest = getSnapshot().filter((e) => e.id !== entry.id);
      publish([entry, ...rest].slice(0, RECENT_LIMIT));
    },
    clear() {
      if (getSnapshot().length === 0) return;
      publish(EMPTY);
    },
  };
}

function browserStorage(): KeyValueStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let singleton: RecentStore | null = null;

/** The app's store. Built lazily so importing this module on the server is free. */
export function recentStore(): RecentStore {
  if (!singleton) singleton = createRecentStore(browserStorage());
  return singleton;
}

const serverSnapshot = () => EMPTY;

/** Recent choices, SSR safe: empty on the server and the first client paint. */
export function useRecentSearches(): readonly RecentEntry[] {
  const store = recentStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}
