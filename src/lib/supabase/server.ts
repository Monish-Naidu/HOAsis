import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, serviceRoleKey } from "./env";

/**
 * A client bound to the signed in person, for server components and routes.
 *
 * `cookies()` is async in this version of Next, so this is too. Guides written
 * against Next 14 call it synchronously and will not compile here.
 */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) store.set(name, value, options);
        } catch {
          // Server components cannot set cookies. Proxy refreshes the session
          // instead, so there is nothing to do here and nothing to report.
        }
      },
    },
  });
}

/**
 * A client that bypasses row level security. Server only, never a request path
 * a browser can reach.
 *
 * Used by the Stripe webhook, which has no signed in person to act as and must
 * still write a payment against the right association.
 */
export function supabaseAdmin() {
  return createServerClient(SUPABASE_URL, serviceRoleKey(), {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
