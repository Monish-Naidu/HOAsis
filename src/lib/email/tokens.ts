import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unsubscribe links that work without signing in.
 *
 * CAN-SPAM requires an opt out that does not put a login between somebody and
 * their own preferences, so the link has to carry proof of who it belongs to.
 * An HMAC over the person and the category does that: it cannot be guessed,
 * it cannot be edited into somebody else's, and it needs no table.
 *
 * Deliberately not an expiring token. People unsubscribe from mail they find
 * months later in a folder, and an expired opt out link is a complaint.
 */

function secret(): string {
  const value = process.env.EMAIL_TOKEN_SECRET;
  if (!value) {
    throw new Error(
      "EMAIL_TOKEN_SECRET is missing. Unsubscribe links cannot be signed without it.",
    );
  }
  return value;
}

export function signUnsubscribe(profileId: string, category: string): string {
  return createHmac("sha256", secret())
    .update(`${profileId}:${category}`)
    .digest("base64url")
    .slice(0, 32);
}

/** Constant time, so a wrong signature reveals nothing about the right one. */
export function verifyUnsubscribe(
  profileId: string,
  category: string,
  token: string,
): boolean {
  const expected = signUnsubscribe(profileId, category);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(
  origin: string,
  profileId: string,
  category: string,
): string {
  const params = new URLSearchParams({
    p: profileId,
    c: category,
    t: signUnsubscribe(profileId, category),
  });
  return `${origin}/unsubscribe?${params.toString()}`;
}
