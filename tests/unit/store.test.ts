import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "@/lib/core/circuit-breaker";
import { MemoryStore, PersistedStore } from "@/lib/core/store";
import { isRecordArray } from "@/lib/core/guards";

interface Widget {
  id: string;
  label: string;
}

const seed: Widget[] = [{ id: "w1", label: "seeded" }];

/** A storage double we can make fail on demand. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    failWrites: false,
    failReads: false,
    getItem(key: string) {
      if (this.failReads) throw new Error("reads blocked");
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (this.failWrites) throw new Error("quota exceeded");
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    raw: map,
  };
}

describe("MemoryStore", () => {
  it("starts at the seed and notifies subscribers on change", () => {
    const store = new MemoryStore("widgets", seed);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    expect(store.getSnapshot()).toEqual(seed);
    store.set([{ id: "w2", label: "next" }]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()[0].label).toBe("next");

    unsubscribe();
    store.set(seed);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns a stable reference between writes, which useSyncExternalStore requires", () => {
    const store = new MemoryStore("widgets", seed);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("derives the next value with update", () => {
    const store = new MemoryStore("widgets", seed);
    store.update((current) => [...current, { id: "w2", label: "added" }]);
    expect(store.getSnapshot()).toHaveLength(2);
  });
});

describe("PersistedStore", () => {
  it("round trips through storage", () => {
    const storage = fakeStorage();
    const store = new PersistedStore<Widget[]>("widgets", seed, { storage });
    store.set([{ id: "w9", label: "saved" }]);
    expect(JSON.parse(storage.raw.get("widgets")!)).toEqual([{ id: "w9", label: "saved" }]);
  });

  it("reads a value written by an earlier session", () => {
    const storage = fakeStorage({ widgets: JSON.stringify([{ id: "w5", label: "restored" }]) });
    const store = new PersistedStore<Widget[]>("widgets", seed, { storage });
    expect(store.getSnapshot()[0].label).toBe("restored");
  });

  it("falls back to the seed and clears the key when stored JSON is corrupt", () => {
    const storage = fakeStorage({ widgets: "{not json" });
    const onError = vi.fn();
    const store = new PersistedStore<Widget[]>("widgets", seed, { storage, onError });

    expect(store.getSnapshot()).toEqual(seed);
    expect(onError).toHaveBeenCalledOnce();
    expect(storage.raw.has("widgets")).toBe(false);
  });

  it("rejects a stored value that no longer matches the schema", () => {
    const storage = fakeStorage({ widgets: JSON.stringify([{ nope: true }]) });
    const store = new PersistedStore<Widget[]>("widgets", seed, {
      storage,
      validate: isRecordArray<Widget>(),
    });
    expect(store.getSnapshot()).toEqual(seed);
  });

  it("corrupt data does not trip the circuit, because it is not a storage fault", () => {
    const storage = fakeStorage({ widgets: "{not json" });
    const breaker = new CircuitBreaker("storage", { failureThreshold: 1 });
    const store = new PersistedStore<Widget[]>("widgets", seed, { storage, breaker });
    store.getSnapshot();
    expect(breaker.status).toBe("closed");
  });

  it("keeps serving from memory when writes start failing", () => {
    const storage = fakeStorage();
    const breaker = new CircuitBreaker("storage", { failureThreshold: 2 });
    const store = new PersistedStore<Widget[]>("widgets", seed, { storage, breaker });

    storage.failWrites = true;
    store.set([{ id: "w2", label: "memory only" }]);
    store.set([{ id: "w3", label: "still memory" }]);

    // The value the UI reads is correct even though nothing was persisted.
    expect(store.getSnapshot()[0].label).toBe("still memory");
    expect(breaker.status).toBe("open");
    expect(storage.raw.has("widgets")).toBe(false);
  });

  it("stops calling storage once the circuit is open", () => {
    const storage = fakeStorage();
    const spy = vi.spyOn(storage, "setItem");
    const breaker = new CircuitBreaker("storage", { failureThreshold: 1 });
    const store = new PersistedStore<Widget[]>("widgets", seed, { storage, breaker });

    storage.failWrites = true;
    store.set([{ id: "a", label: "one" }]);
    const callsAfterTrip = spy.mock.calls.length;

    store.set([{ id: "b", label: "two" }]);
    store.set([{ id: "c", label: "three" }]);
    expect(spy.mock.calls.length).toBe(callsAfterTrip);
  });

  it("serves the seed on the server, where there is no storage at all", () => {
    const store = new PersistedStore<Widget[]>("widgets", seed, { storage: undefined });
    expect(store.getServerSnapshot()).toEqual(seed);
  });

  it("reset clears storage and returns to the seed", () => {
    const storage = fakeStorage();
    const store = new PersistedStore<Widget[]>("widgets", seed, { storage });
    store.set([{ id: "x", label: "changed" }]);
    store.reset();
    expect(store.getSnapshot()).toEqual(seed);
    expect(storage.raw.has("widgets")).toBe(false);
  });
});
