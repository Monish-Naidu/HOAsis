import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sameOriginPath } from "./next-path";

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
  // Set when the board sent somebody straight to a bill. Only ever a path on
  // this site, so a crafted link cannot use us to bounce somebody somewhere
  // else; anything that resolves off this origin is dropped here.
  const next = sameOriginPath(url.searchParams.get("next"), url.origin);

  const supabase = await supabaseServer();

  let failed: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) failed = error.message;
  } else if (tokenHash && type) {
    // The link shape every email we send uses (src/lib/email/sign-in-link.ts
    // and the confirmation email): verified here, on the server, so it works
    // in whichever browser the email happens to open in.
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
    // A link in a notice lasts an hour and is spent by the first thing that
    // opens it, which is sometimes a mail scanner. Keep where it was going,
    // so signing in by hand still lands on the bill and not on a home page.
    if (next) back.searchParams.set("next", next);
    return NextResponse.redirect(back);
  }

  // Any seat a board set out under this email is theirs now. Before the
  // redirect, so the first screen already knows which associations they hold.
  await supabase.rpc("claim_my_seats");

  // Honour an explicit destination. Already reduced to a path on this site.
  if (next) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const { data: memberships } = await supabase.rpc("my_associations");
  const rows = (memberships ?? []) as { role: string }[];

  if (!rows.length) {
    // Somebody who created their account through a join code is waiting on
    // a board, and the resident side says so. Sending them to found an
    // association would be answering a question they did not ask.
    const { data: asked } = await supabase.rpc("my_join_requests");
    const waiting = (asked ?? []).some((j: { status: string }) => j.status === "pending");
    return NextResponse.redirect(new URL(waiting ? "/resident" : "/start", url.origin));
  }

  const runsSomething = rows.some((m) => m.role !== "resident");
  return NextResponse.redirect(
    new URL(runsSomething ? "/board" : "/resident", url.origin),
  );
}
