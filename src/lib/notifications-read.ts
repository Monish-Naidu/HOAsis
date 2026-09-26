"use client";

import { useSyncExternalStore } from "react";

/**
 * Which notices the person has already seen.
 *
 * The bell derives its lines from records, so there is nothing on the server
 * to flip. What a browser can remember is "I clicked this one": the notice's
 * id plus a fingerprint of its words. An unchanged notice stays read across
 * reloads; one whose title or detail moved on (two invoices became three)
 * comes back as unread, which is the honest answer.
 *
 * Persisted under a `hoasis-` key on purpose: renaming the prefix signs
 * every browser out (see CLAUDE.md).
 */

export const READ_STORAGE_KEY = "hoasis-notifications-read";

/** Minimal storage surface so tests can hand in a Map-backed double. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** djb2 over the words, as a short base-36 string. Not cryptographic, just stable. */
function fingerprint(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The key a notice is remembered under: its id and a fingerprint of its content. */
export function noticeKey(notice: { id: string; title: string; detail: string }): string {
  return `${notice.id}:${fingerprint(`${notice.title}\u0000${notice.detail}`)}`;
}

export interface ReadStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ReadonlySet<string>;
  getServerSnapshot(): ReadonlySet<string>;
  isRead(key: string): boolean;
  /**
   * Remember `keys` as read. `present` is every key the panel is showing
   * right now: anything remembered that is no longer on screen is dropped,
   * so the list never grows past the handful of notices that exist.
   */
  markRead(keys: string[], present: string[]): void;
}

const EMPTY: ReadonlySet<string> = new Set();

function load(storage: KeyValueStorage | null): ReadonlySet<string> {
  if (!storage) return EMPTY;
  try {
    const raw = storage.getItem(READ_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return new Set(parsed.filter((k): k is string => typeof k === "string"));
  } catch {
    return EMPTY;
  }
}

function save(storage: KeyValueStorage | null, keys: ReadonlySet<string>) {
  if (!storage) return;
  try {
    storage.setItem(READ_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Quota or private mode. The in-memory copy still serves this page.
  }
}

/**
 * Builds a store over the given storage. Product code uses the singleton
 * below; tests build their own with a fake so they do not share state.
 */
export function createReadStore(storage: KeyValueStorage | null): ReadStore {
  let snapshot: ReadonlySet<string> | null = null;
  const listeners = new Set<() => void>();

  const getSnapshot = () => {
    if (snapshot === null) snapshot = load(storage);
    return snapshot;
  };

  const publish = (next: ReadonlySet<string>) => {
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
    isRead: (key) => getSnapshot().has(key),
    markRead(keys, present) {
      const current = getSnapshot();
      const shown = new Set(present);
      const next = new Set<string>();
      for (const k of current) if (shown.has(k)) next.add(k);
      for (const k of keys) next.add(k);
      // Same membership means nothing to tell anyone.
      if (next.size === current.size && [...next].every((k) => current.has(k))) return;
      publish(next);
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

let singleton: ReadStore | null = null;

/** The app's store. Built lazily so importing this module on the server is free. */
export function readStore(): ReadStore {
  if (!singleton) singleton = createReadStore(browserStorage());
  return singleton;
}

const serverSnapshot = () => EMPTY;

/** The set of read keys, SSR safe: empty on the server and the first client paint. */
export function useReadNotices(): ReadonlySet<string> {
  const store = readStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}
