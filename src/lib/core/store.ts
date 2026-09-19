import { CircuitBreaker } from "./circuit-breaker";
import { SerializationError, StorageError, toError } from "./errors";

/**
 * Observable stores.
 *
 * React reads these through `useSyncExternalStore`, which demands two things:
 * a `subscribe` and a `getSnapshot` whose identities never change between
 * renders, and a `getSnapshot` that returns the same reference until the value
 * actually changes. Both are satisfied here by binding them as instance
 * properties and caching the parsed value.
 *
 * The hierarchy exists because the two kinds of store differ in exactly one
 * respect, how a value is loaded and saved, and agree on everything else:
 *
 *   Store<T>            subscription, snapshot caching, notification
 *     MemoryStore<T>    forgets on reload. The safe fallback.
 *     PersistedStore<T> localStorage, guarded by a circuit breaker.
 */

export type Listener = () => void;

export abstract class Store<T> {
  /**
   * A Set, not an array: unsubscribing is O(1) and cannot accidentally remove
   * a duplicate registration of the same callback.
   */
  protected readonly listeners = new Set<Listener>();

  /** Null means "not loaded yet". Undefined is a legitimate value for T. */
  protected cached: T | null = null;

  protected constructor(
    readonly name: string,
    protected readonly seed: T,
  ) {}

  /* --------------------------------------------------------------- reading */

  /** Stable identity, required by useSyncExternalStore. */
  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Stable identity and stable reference between changes. */
  readonly getSnapshot = (): T => {
    if (this.cached === null) this.cached = this.load();
    return this.cached;
  };

  /**
   * What the server renders. Always the seed, so server and client markup
   * agree and hydration does not warn. The stored value arrives on the first
   * client render, which React handles for us.
   */
  readonly getServerSnapshot = (): T => this.seed;

  /* --------------------------------------------------------------- writing */

  /** Replaces the value and notifies subscribers. */
  set(next: T): void {
    this.cached = next;
    this.save(next);
    this.emit();
  }

  /** Derives the next value from the current one. Prefer this over read then set. */
  update(mutate: (current: T) => T): void {
    this.set(mutate(this.getSnapshot()));
  }

  /** Returns to the seeded value and clears anything persisted. */
  reset(): void {
    this.cached = this.seed;
    this.clear();
    this.emit();
  }

  protected emit(): void {
    for (const listener of this.listeners) listener();
  }

  /* ------------------------------------------------------- subclass duties */

  protected abstract load(): T;
  protected abstract save(value: T): void;
  protected abstract clear(): void;
}

/** Holds a value for the life of the tab. Nothing to fail, nothing to guard. */
export class MemoryStore<T> extends Store<T> {
  constructor(name: string, seed: T) {
    super(name, seed);
  }

  protected load(): T {
    return this.seed;
  }

  protected save(): void {
    /* nothing to do */
  }

  protected clear(): void {
    /* nothing to do */
  }
}

export interface PersistedStoreOptions<T> {
  /**
   * Rejects stored values that no longer match the current shape, which is
   * what happens when the app ships a new field and a returning browser still
   * holds yesterday's JSON. Returning false falls back to the seed.
   */
  validate?: (value: unknown) => value is T;
  /** Shared so one flaky storage engine trips the circuit for every store. */
  breaker?: CircuitBreaker;
  /** Injected for tests, and absent during server rendering. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  onError?: (error: Error) => void;
}

/**
 * Backed by localStorage, which is allowed to fail.
 *
 * Private browsing throws on write, a full quota throws on write, and a user
 * can disable site data entirely. None of that should break the app, so every
 * access goes through a circuit breaker: after repeated failures the store
 * stops trying for a cooldown and behaves like a MemoryStore. Reads of corrupt
 * JSON fall back to the seed rather than crashing a render.
 */
export class PersistedStore<T> extends Store<T> {
  private readonly validate?: (value: unknown) => value is T;
  private readonly breaker: CircuitBreaker;
  private readonly onError?: (error: Error) => void;
  private readonly injectedStorage?: PersistedStoreOptions<T>["storage"];

  constructor(
    readonly key: string,
    seed: T,
    options: PersistedStoreOptions<T> = {},
  ) {
    super(key, seed);
    this.validate = options.validate;
    this.breaker = options.breaker ?? new CircuitBreaker(`storage:${key}`);
    this.onError = options.onError;
    this.injectedStorage = options.storage;
  }

  /** Undefined during server rendering, which is a normal condition. */
  private get storage(): PersistedStoreOptions<T>["storage"] | undefined {
    if (this.injectedStorage) return this.injectedStorage;
    return typeof window === "undefined" ? undefined : window.localStorage;
  }

  get circuitState() {
    return this.breaker.status;
  }

  protected load(): T {
    const storage = this.storage;
    if (!storage) return this.seed;

    return this.breaker.run(() => {
      const raw = storage.getItem(this.key);
      if (raw === null) return this.seed;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (thrown) {
        // Corrupt entries are dropped rather than retried forever. This is a
        // data problem, not a storage problem, so it must not trip the circuit.
        this.report(
          new SerializationError("stored value is not valid JSON", { key: this.key }, {
            cause: thrown,
          }),
        );
        this.clear();
        return this.seed;
      }

      if (this.validate && !this.validate(parsed)) {
        this.report(
          new SerializationError("stored value no longer matches its schema", {
            key: this.key,
          }),
        );
        this.clear();
        return this.seed;
      }
      return parsed as T;
    }, this.seed);
  }

  protected save(value: T): void {
    const storage = this.storage;
    if (!storage) return;
    this.breaker.run(() => {
      try {
        storage.setItem(this.key, JSON.stringify(value));
      } catch (thrown) {
        const error = new StorageError("could not write to storage", { key: this.key }, {
          cause: thrown,
        });
        this.report(error);
        throw error;
      }
      return true;
    }, false);
  }

  protected clear(): void {
    const storage = this.storage;
    if (!storage) return;
    this.breaker.run(() => {
      storage.removeItem(this.key);
      return true;
    }, false);
  }

  private report(error: Error): void {
    this.onError?.(error);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[hoasis] ${toError(error).message}`);
    }
  }
}
