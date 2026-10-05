import { createLimiter, type Limiter } from "@/lib/rate-limit";

/**
 * How many invitations one association may send in an hour.
 *
 * Founding an association is free and its board chooses every address on its
 * register, so without a ceiling this route is a way to send mail to
 * strangers from our domain, two hundred at a time, in a loop. Six hundred
 * is three full sends of the largest batch the route accepts: more than a
 * real board presses in an hour, and not a mail run.
 *
 * Counted per message, not per call, with the same in-memory limiter the
 * sign-up form uses (src/lib/rate-limit.ts), and with the same caveat: each
 * serverless instance keeps its own count, so this is a speed bump and not
 * a wall. A count of `email_log` rows would be the wall.
 */
export const INVITES_PER_HOUR = 600;

export function createInviteLimiter(now?: () => number): Limiter {
  return createLimiter({ limit: INVITES_PER_HOUR, windowMs: 60 * 60 * 1000, now });
}

/**
 * Spends one count per message for the association, before anything is
 * sent. All or nothing: a batch that would pass the ceiling is refused
 * whole, so the board is told plainly instead of finding half a street
 * invited.
 */
export function spendInvites(
  limiter: Limiter,
  associationId: string,
  messages: number,
): { ok: boolean; retryAfterSeconds: number } {
  if (messages <= 0) return { ok: true, retryAfterSeconds: 0 };
  const decision = limiter.check(associationId, messages);
  return { ok: decision.ok, retryAfterSeconds: decision.ok ? 0 : decision.retryAfterSeconds };
}
