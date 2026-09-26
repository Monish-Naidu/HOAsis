import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/log";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/env";
import { clientIp, joinLookupLimiter, tooManyRequests } from "@/lib/rate-limit";
import { normalizeAssociationName, placeLabel } from "@/lib/community-links";

/**
 * What a join code or a community slug points at: the name and the town.
 *
 * The browser used to call `association_by_join_code` straight from the
 * form, which is fine for one household and an open invitation to walk the
 * code space. Through here the same anonymous call is counted per address
 * (src/lib/rate-limit.ts). The database still answers as `anon`, so this
 * route can see nothing the form could not.
 */
export async function GET(request: NextRequest) {
  const log = logger("join/lookup", request);
  const decision = joinLookupLimiter.check(clientIp(request));
  if (!decision.ok) {
    log.warn("rate limited");
    return tooManyRequests(decision);
  }
  if (!hasSupabase) return NextResponse.json({ found: null });

  const code = (request.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  const slug = (request.nextUrl.searchParams.get("community") ?? "").trim().toLowerCase();
  const name = normalizeAssociationName(request.nextUrl.searchParams.get("name") ?? "");
  if (!code && !slug && !name) {
    return NextResponse.json({ error: "A code, a community or a name is needed" }, { status: 400 });
  }

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  // Associations already called this, for the wizard's "is that yours?"
  // note. Names may repeat, so this informs and never refuses.
  if (name) {
    const { data, error } = await anon.rpc("associations_named", { p_name: name });
    if (error) {
      log.error("name lookup failed", { err: error.message });
      return NextResponse.json({ error: error.message, reference: log.requestId }, { status: 500 });
    }
    const matches = ((data ?? []) as { name: string; city: string | null; state: string | null; slug: string }[])
      .map((row) => ({ name: row.name, place: placeLabel(row.city, row.state), slug: row.slug }));
    return NextResponse.json({ matches });
  }
  const { data, error } = code
    ? await anon.rpc("association_by_join_code", { p_code: code })
    : await anon.rpc("association_by_slug", { p_slug: slug });
  if (error) {
    log.error("lookup failed", { err: error.message, by: code ? "code" : "slug" });
    return NextResponse.json({ error: error.message, reference: log.requestId }, { status: 500 });
  }

  const row = ((data ?? []) as { name: string; city: string | null; state: string | null }[])[0];
  if (!row) return NextResponse.json({ found: null });
  return NextResponse.json({
    found: { name: row.name, place: placeLabel(row.city, row.state) },
  });
}
