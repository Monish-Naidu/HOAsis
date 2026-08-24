import { CircuitOpenError, toError } from "./errors";

/**
 * A circuit breaker.
 *
 * Wraps a dependency that can fail repeatedly, so the app stops hammering it
 * and degrades on purpose instead of by accident. Three states:
 *
 *   closed     normal. Failures are counted.
 *   open       the threshold was crossed. Calls fail fast for `cooldownMs`.
 *   half-open  cooldown elapsed. One probe is allowed through. Success closes
 *              the circuit; failure opens it again for another cooldown.
 *
 * Today this guards `localStorage`, which throws in private mode, when the
 * quota is full, and when a browser blocks site data. The same class is what
 * an HTTP client should use once there is a real API behind this app.
 */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  /** Consecutive failures that trip the circuit. */
  failureThreshold?: number;
  /** How long to stay open before allowing a probe. */
  cooldownMs?: number;
  /** Injected clock. Tests pass a fake so they never sleep. */
  now?: () => number;
  /** Called on every state change. Useful for logging. */
  onStateChange?: (next: CircuitState, previous: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private readonly onStateChange?: (next: CircuitState, previous: CircuitState) => void;

  constructor(
    readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.now = options.now ?? Date.now;
    this.onStateChange = options.onStateChange;
  }

  /** Current state, after accounting for an elapsed cooldown. */
  get status(): CircuitState {
    if (this.state === "open" && this.now() - this.openedAt >= this.cooldownMs) {
      this.transition("half-open");
    }
    return this.state;
  }

  get failures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Runs `operation`, or throws `CircuitOpenError` without running it when the
   * circuit is open. Prefer `run` unless the caller wants to handle the throw.
   */
  execute<T>(operation: () => T): T {
    if (this.status === "open") {
      throw new CircuitOpenError(`${this.name} is unavailable`, {
        circuit: this.name,
        failures: this.consecutiveFailures,
      });
    }
    try {
      const result = operation();
      this.recordSuccess();
      return result;
    } catch (thrown) {
      this.recordFailure(toError(thrown));
      throw thrown;
    }
  }

  /**
   * Runs `operation` and returns `fallback` on any failure, including a refusal
   * from the open circuit. Use this where degrading is the correct behavior.
   */
  run<T>(operation: () => T, fallback: T): T {
    try {
      return this.execute(operation);
    } catch {
      return fallback;
    }
  }

  /** Forces the circuit closed. Exposed for tests and manual recovery. */
  reset(): void {
    this.consecutiveFailures = 0;
    this.transition("closed");
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state !== "closed") this.transition("closed");
  }

  private lastError?: Error;

  /** The failure that most recently tripped or extended the circuit. */
  get lastFailure(): Error | undefined {
    return this.lastError;
  }

  private recordFailure(error: Error): void {
    this.lastError = error;
    this.consecutiveFailures += 1;
    // A probe that fails in half-open sends us straight back to open.
    if (this.state === "half-open" || this.consecutiveFailures >= this.failureThreshold) {
      this.openedAt = this.now();
      this.transition("open");
    }
  }

  private transition(next: CircuitState): void {
    if (this.state === next) return;
    const previous = this.state;
    this.state = next;
    if (next === "open") this.openedAt = this.now();
    this.onStateChange?.(next, previous);
  }
}
