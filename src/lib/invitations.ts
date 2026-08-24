/**
 * Invitations.
 *
 * An association's membership register exists before anyone signs up, so
 * joining is never self-service. The board asserts who the members are and
 * sends each household a link bound to their own unit. Nobody claims a unit
 * they were not already on the register for.
 *
 * The link carries a check code derived from the association, the owner, and a
 * secret. In this prototype the secret is a constant and the check is a hash,
 * which stops a link being guessed by changing a unit number in the address bar
 * but is not real security. Real invitations need a server: a single use token,
 * an expiry, and a record of who redeemed it. The shape of the link does not
 * change when that lands, only where the code comes from and who verifies it.
 */

const INVITE_SECRET = "hoasis-invite-v1";

/** A short check code over the association and household. */
function checkCode(communityId: string, ownerId: string): string {
  let hash = 2_166_136_261;
  for (const ch of `${INVITE_SECRET}:${communityId}:${ownerId}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash.toString(36).padStart(7, "0").slice(0, 7);
}

export interface Invitation {
  communityId: string;
  ownerId: string;
  code: string;
}

/** The path a household follows to claim their account. */
export function invitePath(communityId: string, ownerId: string): string {
  const params = new URLSearchParams({
    c: communityId,
    o: ownerId,
    k: checkCode(communityId, ownerId),
  });
  return `/join?${params.toString()}`;
}

/** The full link, for pasting into an email the board sends themselves. */
export function inviteUrl(communityId: string, ownerId: string, origin: string): string {
  return `${origin}${invitePath(communityId, ownerId)}`;
}

/** Reads an invitation off a query string, rejecting anything that fails the check. */
export function parseInvitation(params: URLSearchParams): Invitation | null {
  const communityId = params.get("c");
  const ownerId = params.get("o");
  const code = params.get("k");
  if (!communityId || !ownerId || !code) return null;
  if (checkCode(communityId, ownerId) !== code) return null;
  return { communityId, ownerId, code };
}
