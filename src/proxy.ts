import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/env";
import { communityPath, slugFromHost } from "@/lib/community-links";
import { REQUEST_ID_HEADER, requestIdFrom } from "@/lib/log";

/**
 * Session refresh on every request, and the vanity host alias.
 *
 * Named `proxy` rather than `middleware`: Next 16 renamed the convention, and
 * every Supabase guide still says middleware. Same behaviour, different file.
 *
 * This only keeps the auth cookie fresh. It deliberately does not authorize
 * anything, because the docs are explicit that proxy is for optimistic checks
 * and not for authorization, and because row level security is where access is
 * actually decided.
 *
 * Hosts: `oakview-commons.yourhoasis.com` (and `oakview-commons.localhost:3000`
 * in development) is the same site with that association chosen. The root of
 * such a host is rewritten to `/c/oakview-commons`, which is the canonical
 * form and the one the app routes on; every other path on the host is served
 * as itself, and the client reads the host to pick the association. See
 * docs/scale.md for the DNS and the cookie domain this needs.
 *
 * Request ids: every request gets an `x-request-id` (kept if a sane one
 * arrived, minted otherwise). It travels to the route in the request headers
 * and back to the browser on the response, so a log line, an app_errors row
 * and the "Reference" on an error screen all name the same call. See
 * docs/observability.md.
 */
export async function proxy(request: NextRequest) {
  const slug = slugFromHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  const url = request.nextUrl;
  const aliasRoot = slug && url.pathname === "/";

  const requestId = requestIdFrom(request.headers);
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  const response = aliasRoot
    ? NextResponse.rewrite(new URL(communityPath(slug), url), { request: { headers } })
    : NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  if (slug) response.headers.set("x-hoasis-community", slug);

  // No project configured yet, so there is no session to refresh and the
  // prototype runs on local state exactly as before.
  if (!hasSupabase) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: cookieOptions(),
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

/**
 * The cookie domain, when one is set. `.yourhoasis.com` makes one sign-in
 * good for every vanity host; unset, each host is its own session, which is
 * what a preview deployment or localhost wants.
 */
export function cookieOptions(): { domain?: string } {
  const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
  return domain ? { domain } : {};
}

export const config = {
  // Everything except static assets and images, which never carry a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
