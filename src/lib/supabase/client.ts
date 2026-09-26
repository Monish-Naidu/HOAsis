"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * The browser client. Every query it makes is subject to row level security.
 *
 * The cookie domain, when set, is what lets a session on yourhoasis.com carry
 * to oakview-commons.yourhoasis.com. It has to match the one the proxy uses
 * or the two would write different cookies for the same person.
 */
export function supabaseBrowser() {
  const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: domain ? { domain } : undefined,
  });
}
