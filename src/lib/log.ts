/**
 * One line per meaningful step, as JSON, with a request id on every line.
 *
 * Why JSON lines: Vercel keeps function logs as text and a log drain (Axiom,
 * Better Stack) indexes whatever is on the line. A line that is already an
 * object becomes a filter (`route = stripe/webhook and level = error`)
 * instead of a regex. See docs/observability.md.
 *
 * Why a request id: a resident reads "Reference K7QM2X4P" off the screen,
 * and that string finds the server line, the row in app_errors, and the
 * Sentry event. It is minted in `src/proxy.ts` for every request, carried in
 * the `x-request-id` header both ways, and printed on every line here.
 *
 * What never goes out: secrets, tokens, card data, full email addresses.
 * `scrubFields` masks an email to its first letter and domain and redacts
 * anything that looks like a key, wherever it sits in the object. The rule
 * is applied to every field, so a route cannot forget.
 *
 * No Next imports: the same helpers run in the browser (the error pages mint
 * a reference) and in the Edge runtime (the proxy).
 */

export const REQUEST_ID_HEADER = "x-request-id";

export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export interface LogLine {
  ts: string;
  level: LogLevel;
  msg: string;
  requestId: string;
  route: string;
  durationMs: number;
  associationId?: string;
  [field: string]: unknown;
}

/* --------------------------------------------------------------- request id */

// Crockford-style: no I, L, O, 0 or 1, so a person can read it out loud.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const REQUEST_ID_LENGTH = 8;

/** A fresh id: eight readable characters, e.g. K7QM2X4P. */
export function newRequestId(): string {
  const bytes = new Uint8Array(REQUEST_ID_LENGTH);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** True for an id we minted, or one a caller sent that is safe to print. */
export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{6,64}$/.test(value);
}

type HeaderReader = { get(name: string): string | null } | null | undefined;

/**
 * The request's id: the `x-request-id` header when it carries a sane value
 * (the proxy set it, or a load balancer did), else a new one.
 */
export function requestIdFrom(headers: HeaderReader): string {
  const sent = headers?.get(REQUEST_ID_HEADER)?.trim();
  return isRequestId(sent) ? sent : newRequestId();
}

/* ------------------------------------------------------------------ scrubbing */

const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const SECRET_KEY = /secret|token|password|passwd|authorization|cookie|api[_-]?key|card|cvc|cvv|\bpan\b|account_?number|routing|ssn|hashed|action_link|client_secret/i;
const SECRET_VALUE = /^(sk|rk|whsec|re|pk)_[A-Za-z0-9]|_secret_|^eyJ[A-Za-z0-9_-]{10,}/;
const MAX_STRING = 300;
const MAX_STACK = 1500;
const MAX_DEPTH = 4;

/** `monish@gmail.com` becomes `m***@gmail.com`. Anything else is returned as is. */
export function maskEmail(value: string): string {
  return value.replace(EMAIL, (_, first: string, domain: string) => `${first}***@${domain}`);
}

function scrubString(value: string): string {
  if (SECRET_VALUE.test(value)) return "[redacted]";
  const masked = maskEmail(value);
  return masked.length > MAX_STRING ? `${masked.slice(0, MAX_STRING)}…` : masked;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (value == null) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      stack: value.stack ? scrubString(value.stack.slice(0, MAX_STACK)) : undefined,
    };
  }
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrubValue(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) && v != null ? "[redacted]" : scrubValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * Fields as they may be printed: keys that name a secret are redacted, values
 * that look like keys are redacted, emails are masked, long strings are cut.
 */
export function scrubFields(fields: LogFields | undefined): LogFields {
  if (!fields) return {};
  return scrubValue(fields, 0) as LogFields;
}

/* ----------------------------------------------------------------------- sink */

type Sink = (line: LogLine) => void;

function defaultSink(line: LogLine) {
  const text = JSON.stringify(line);
  if (line.level === "error") console.error(text);
  else if (line.level === "warn") console.warn(text);
  else console.log(text);
}

let sink: Sink = defaultSink;

/** Replaces where lines go. Tests capture them; the default is the console. */
export function setLogSink(next: Sink | null): void {
  sink = next ?? defaultSink;
}

/* --------------------------------------------------------------------- logger */

export interface Logger {
  readonly requestId: string;
  readonly route: string;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** The same route and request, with an association attached from here on. */
  forAssociation(associationId: string | null | undefined): Logger;
}

export interface LoggerOptions {
  /** Set when the request's id is known but there is no header to read. */
  requestId?: string;
  associationId?: string | null;
  /** Injectable clock, for tests. */
  now?: () => number;
}

/**
 * A logger for one request on one route.
 *
 * `route` is a short stable name (`stripe/webhook`, `autopay/run`), never a
 * path with ids in it, so a filter on it matches every call. Pass the
 * request so the id set by the proxy is picked up; every line then carries
 * it, plus the milliseconds since this logger was made.
 */
export function logger(
  route: string,
  request?: { headers: HeaderReader } | null,
  options: LoggerOptions = {},
): Logger {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const requestId =
    options.requestId && isRequestId(options.requestId)
      ? options.requestId
      : requestIdFrom(request?.headers ?? null);

  function make(associationId: string | null | undefined): Logger {
    const emit = (level: LogLevel, msg: string, fields?: LogFields) => {
      const line: LogLine = {
        ts: new Date(now()).toISOString(),
        level,
        msg,
        requestId,
        route,
        durationMs: now() - startedAt,
        ...(associationId ? { associationId } : {}),
        ...scrubFields(fields),
      };
      try {
        sink(line);
      } catch {
        // A logger that throws takes the request down with it. Never.
      }
    };
    return {
      requestId,
      route,
      info: (msg, fields) => emit("info", msg, fields),
      warn: (msg, fields) => emit("warn", msg, fields),
      error: (msg, fields) => emit("error", msg, fields),
      forAssociation: (id) => make(id),
    };
  }

  return make(options.associationId);
}

/**
 * The JSON body of an error response, with the reference a person can read
 * out. Every route that answers with an error should answer with this shape.
 */
export function errorBody(log: Pick<Logger, "requestId">, message: string, extra: LogFields = {}) {
  return { error: message, reference: log.requestId, ...extra };
}

const references = new WeakMap<object, string>();

/**
 * The reference shown to a person for an error the UI caught: the server's
 * digest when there is one (it is already in the server log), else an id
 * minted once per error object, so a re-render shows the same code.
 */
export function referenceFor(error: object | null | undefined): string {
  if (!error) return newRequestId();
  const digest = (error as { digest?: unknown }).digest;
  if (isRequestId(digest)) return digest;
  let ref = references.get(error);
  if (!ref) {
    ref = newRequestId();
    references.set(error, ref);
  }
  return ref;
}
