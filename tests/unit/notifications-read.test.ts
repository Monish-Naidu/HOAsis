import { describe, expect, it, vi } from "vitest";
import {
  createReadStore,
  noticeKey,
  READ_STORAGE_KEY,
  type KeyValueStorage,
} from "@/lib/notifications-read";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: KeyValueStorage & { failWrites: boolean; raw: Map<string, string> } = {
    failWrites: false,
    raw: map,
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      if (storage.failWrites) throw new Error("quota exceeded");
      map.set(key, value);
    },
  };
  return storage;
}

const invoices2 = { id: "approvals", title: "2 invoices awaiting approval", detail: "$1,200.00" };
const invoices3 = { id: "approvals", title: "3 invoices awaiting approval", detail: "$1,850.00" };
const live = { id: "live", title: "Annual meeting", detail: "Meeting on now · 4 joined" };

describe("noticeKey", () => {
  it("is stable for the same id and content", () => {
    expect(noticeKey(invoices2)).toBe(noticeKey({ ...invoices2 }));
    expect(noticeKey(invoices2).startsWith("approvals:")).toBe(true);
  });

  it("changes when the title or detail changes", () => {
    expect(noticeKey(invoices2)).not.toBe(noticeKey(invoices3));
    expect(noticeKey(invoices2)).not.toBe(noticeKey({ ...invoices2, detail: "$1,300.00" }));
  });
});

describe("read store", () => {
  it("starts empty and is empty on the server", () => {
    const store = createReadStore(fakeStorage());
    expect(store.getSnapshot().size).toBe(0);
    expect(store.getServerSnapshot().size).toBe(0);
    expect(store.isRead(noticeKey(live))).toBe(false);
  });

  it("marks a notice read, persists it, and notifies subscribers", () => {
    const storage = fakeStorage();
    const store = createReadStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    const key = noticeKey(invoices2);
    store.markRead([key], [key, noticeKey(live)]);

    expect(store.isRead(key)).toBe(true);
    expect(store.isRead(noticeKey(live))).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.raw.get(READ_STORAGE_KEY)!)).toEqual([key]);
  });

  it("comes back read from storage when the content is unchanged, unread when it moved on", () => {
    const storage = fakeStorage({ [READ_STORAGE_KEY]: JSON.stringify([noticeKey(invoices2)]) });
    const store = createReadStore(storage);
    expect(store.isRead(noticeKey(invoices2))).toBe(true);
    expect(store.isRead(noticeKey(invoices3))).toBe(false);
  });

  it("drops remembered keys that are no longer shown", () => {
    const storage = fakeStorage();
    const store = createReadStore(storage);
    const gone = noticeKey(invoices2);
    const stays = noticeKey(live);
    store.markRead([gone, stays], [gone, stays]);

    // The invoices notice changed, so its old key is not present any more.
    store.markRead([], [noticeKey(invoices3), stays]);
    expect(store.getSnapshot().has(gone)).toBe(false);
    expect(store.isRead(stays)).toBe(true);
  });

  it("does not notify when nothing changed", () => {
    const store = createReadStore(fakeStorage());
    const listener = vi.fn();
    store.subscribe(listener);
    const key = noticeKey(live);
    store.markRead([key], [key]);
    store.markRead([key], [key]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the snapshot identity between reads so useSyncExternalStore does not loop", () => {
    const store = createReadStore(fakeStorage());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("survives bad or blocked storage", () => {
    const store = createReadStore(fakeStorage({ [READ_STORAGE_KEY]: "{not json" }));
    expect(store.getSnapshot().size).toBe(0);

    const storage = fakeStorage();
    storage.failWrites = true;
    const blocked = createReadStore(storage);
    const key = noticeKey(live);
    blocked.markRead([key], [key]);
    expect(blocked.isRead(key)).toBe(true);

    expect(createReadStore(null).isRead(key)).toBe(false);
  });
});
