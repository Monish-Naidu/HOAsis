import type { supabaseAdmin } from "@/lib/supabase/server";

/**
 * The one link in an email that signs the person in.
 *
 * Supabase's own `action_link` goes through its verify endpoint and comes
 * back with the session in the URL fragment. The browser client here only
 * speaks PKCE and refuses that shape, so the person landed signed out on a
 * screen that promised otherwise. The token hash from the same call does
 * work: our own /auth/callback verifies it on the server, sets the session
 * cookie and then follows `next`. That is the shape the confirmation email
 * has used all along (src/app/api/auth/signup/route.ts).
 *
 * `path` is a path on this site, never a full address: the callback only
 * follows a `next` that stays on its own origin.
 */

type Admin = ReturnType<typeof supabaseAdmin>;

/** How the token was minted, which is also how the callback must verify it. */
export type SignInLinkType = "magiclink" | "invite";

/** The callback address for a minted token. Pure, so the shape can be tested. */
export function callbackLink(
  origin: string,
  input: { tokenHash: string; type: SignInLinkType; path: string },
): string {
  const link = new URL("/auth/callback", origin);
  link.searchParams.set("token_hash", input.tokenHash);
  link.searchParams.set("type", input.type);
  link.searchParams.set("next", input.path);
  return link.toString();
}

/** Where a link falls back to when no token could be minted: the front door, bound for the same screen. */
export function signInFallback(origin: string, path: string): string {
  const link = new URL("/signin", origin);
  link.searchParams.set("next", path);
  return link.toString();
}

/**
 * Mints a sign-in link for one person, landing on `path`.
 *
 * "magiclink" for somebody with an account. "invite" for an address with no
 * account yet, which creates it; the callback then claims the seat the board
 * reserved. A link that cannot be minted is not a reason to send nothing:
 * the notice still has to arrive, so it carries the sign-in page instead,
 * with the destination kept.
 */
export async function signInUrl(
  admin: Admin,
  input: { email: string; type: SignInLinkType; origin: string; path: string },
): Promise<string> {
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: input.type,
      email: input.email,
    });
    const tokenHash = error ? null : data?.properties?.hashed_token;
    if (tokenHash) {
      return callbackLink(input.origin, { tokenHash, type: input.type, path: input.path });
    }
  } catch {
    // Fall through to the front door.
  }
  return signInFallback(input.origin, input.path);
}
