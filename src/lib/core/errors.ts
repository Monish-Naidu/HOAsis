/**
 * Error hierarchy.
 *
 * Every failure this app raises on purpose descends from `HoasisError`, so a
 * boundary can tell "something we anticipated" from "something we did not"
 * with one `instanceof` rather than string matching a message.
 *
 * Each error carries a stable `code` for logs and a `context` bag for the
 * details a human needs to reproduce it. Messages are for people; codes are
 * for machines. Never branch on a message.
 */
export abstract class HoasisError extends Error {
  /** Stable, greppable identifier. Safe to log, safe to switch on. */
  abstract readonly code: string;

  /** Whether retrying the same operation could plausibly succeed. */
  readonly retryable: boolean = false;

  constructor(
    message: string,
    readonly context: Readonly<Record<string, unknown>> = {},
    options?: { cause?: unknown },
  ) {
    super(message, options as ErrorOptions);
    this.name = new.target.name;
    // Restores the prototype chain when compiled down to ES5 targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** One line, safe for a log or a toast. */
  describe(): string {
    const ctx = Object.entries(this.context)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" ");
    return ctx ? `${this.code}: ${this.message} (${ctx})` : `${this.code}: ${this.message}`;
  }
}

/** Persistence failed. The app should keep working from memory. */
export class StorageError extends HoasisError {
  readonly code = "storage_unavailable";
  readonly retryable = true;
}

/** Stored bytes exist but are not the shape we expect. Treat as absent. */
export class SerializationError extends HoasisError {
  readonly code = "storage_corrupt";
}

/** A circuit breaker refused the call because the dependency is failing. */
export class CircuitOpenError extends HoasisError {
  readonly code = "circuit_open";
  readonly retryable = true;
}

/** Input did not satisfy a rule the domain guarantees. */
export class ValidationError extends HoasisError {
  readonly code = "validation_failed";
}

/** A lookup that the caller expected to succeed did not. */
export class NotFoundError extends HoasisError {
  readonly code = "not_found";
}

/** The signed in account lacks the capability this action requires. */
export class PermissionError extends HoasisError {
  readonly code = "permission_denied";
}

/** True for anything this codebase raised deliberately. */
export function isHoasisError(value: unknown): value is HoasisError {
  return value instanceof HoasisError;
}

/**
 * Narrows an unknown thrown value to an Error without losing the original.
 * `catch` gives you `unknown`; almost every logger wants a message.
 */
export function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  return new Error(typeof thrown === "string" ? thrown : JSON.stringify(thrown));
}
