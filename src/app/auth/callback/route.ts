import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Where a confirmation link lands.
 *
 * Supabase sends people back to one fixed address after they confirm an email
 * or follow a magic link. That address has to do something, or a person who
 * just proved who they are is dropped on the marketing page with no sign that
 * anything happened, which is exactly what it did.
 *
 * So this exchanges the code for a session and then answers the only question
 * that matters next: what does this person already belong to?
 *
 *   nothing            they are founding an association, so send them to setup
 *   one, as an officer they have a board to run
 *   one, as a resident they have a balance to look at
 *
 * A board that pre-added a household is the common case, and it should feel
 * like the software already knew about them, because it did.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  // Set when the board sent somebody straight to a bill.
  const next = url.searchParams.get("next");

  const supabase = await supabaseServer();

  let failed: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) failed = error.message;
  } else if (tokenHash && type) {
    // The older link shape, still used by some email templates.
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "magiclink" | "recovery" | "invite" | "email_change",
    });
    if (error) failed = error.message;
  } else {
    failed = "That link is missing its confirmation code.";
  }

  if (failed) {
    const back = new URL("/signin", url.origin);
    back.searchParams.set("error", failed);
    return NextResponse.redirect(back);
  }

  // Honour an explicit destination, but only a path on this site, so a crafted
  // link cannot use us to bounce somebody somewhere else.
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const { data: memberships } = await supabase.rpc("my_associations");
  const rows = (memberships ?? []) as { role: string }[];

  if (!rows.length) {
    return NextResponse.redirect(new URL("/start", url.origin));
  }

  const runsSomething = rows.some((m) => m.role !== "resident");
  return NextResponse.redirect(
    new URL(runsSomething ? "/admin" : "/resident", url.origin),
  );
}
