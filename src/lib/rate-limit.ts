import { NextResponse, type NextRequest } from "next/server";

/**
 * A small per-address limiter for the routes a stranger can call.
 *
 * Fixed windows, counted in memory. Each serverless instance keeps its own
 * counts, so the effective limit is the stated one times however many
 * instances Vercel happens to be running, and a cold start forgets
 * everything. That is fine for what this guards: a script hammering the
 * sign-up form or guessing join codes gets a 429 from the instance it is
 * talking to, and the real defences (Supabase's own auth limits, the
 * five-a-day rule in `request_to_join`, six-character codes) sit behind it.
 * Move the counts to Postgres or Upstash when one instance is not enough.
 *
 * Limits are generous on purpose. A board sending a link to forty homes at
 * a meeting is forty people from a few addresses in a minute.
 */

export interface LimiterOptions {
  /** Requests allowed per window from one key. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock, for tests. */
  now?: () => number;
}

export interface LimitDecision {
  ok: boolean;
  /** How long to wait before the window opens again, whole seconds. */
  retryAfterSeconds: number;
  remaining: number;
}

export interface Limiter {
  check(key: string): LimitDecision;
  /** Drops counters whose window has passed. Called on every check. */
  size(): number;
}

export function createLimiter({ limit, windowMs, now = Date.now }: LimiterOptions): Limiter {
  const windows = new Map<string, { started: number; count: number }>();

  function sweep(at: number) {
    // Bounded memory: a window that has expired is gone on the next call.
    if (windows.size < 1000) return;
    for (const [key, w] of windows) {
      if (at - w.started >= windowMs) windows.delete(key);
    }
  }

  return {
    check(key) {
      const at = now();
      sweep(at);
      const current = windows.get(key);
      if (!current || at - current.started >= windowMs) {
        windows.set(key, { started: at, count: 1 });
        return { ok: true, retryAfterSeconds: 0, remaining: limit - 1 };
      }
      current.count += 1;
      if (current.count <= limit) {
        return { ok: true, retryAfterSeconds: 0, remaining: limit - current.count };
      }
      const retryAfterSeconds = Math.max(1, Math.ceil((current.started + windowMs - at) / 1000));
      return { ok: false, retryAfterSeconds, remaining: 0 };
    },
    size: () => windows.size,
  };
}

/** The caller's address as Vercel reports it. */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** The answer when a caller is over the limit. */
export function tooManyRequests(decision: LimitDecision): NextResponse {
  return NextResponse.json(
    { error: "Too many attempts. Wait a minute and try again." },
    { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
  );
}

/* ------------------------------------------------------------- the limits */

/**
 * Account creation: 10 an hour from one address. A household creates one
 * account; a board at a meeting creating a few for neighbours is still well
 * inside this.
 */
export const signupLimiter = createLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

/**
 * Join code lookups: 30 a minute from one address. Enough to mistype a code
 * a few times, not enough to walk the space of six-character codes.
 */
export const joinLookupLimiter = createLimiter({ limit: 30, windowMs: 60 * 1000 });
