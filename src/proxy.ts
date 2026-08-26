import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/env";

/**
 * Session refresh on every request.
 *
 * Named `proxy` rather than `middleware`: Next 16 renamed the convention, and
 * every Supabase guide still says middleware. Same behaviour, different file.
 *
 * This only keeps the auth cookie fresh. It deliberately does not authorize
 * anything, because the docs are explicit that proxy is for optimistic checks
 * and not for authorization, and because row level security is where access is
 * actually decided.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // No project configured yet, so there is no session to refresh and the
  // prototype runs on local state exactly as before.
  if (!hasSupabase) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Everything except static assets and images, which never carry a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
