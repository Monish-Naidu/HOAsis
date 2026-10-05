import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { logger } from "@/lib/log";
import { emailSender } from "@/lib/email/sender";
import { supabaseAdmin } from "@/lib/supabase/server";
import { confirmSignupEmail } from "@/lib/email/templates";
import { clientIp, createLimiter, signupLimiter, tooManyRequests } from "@/lib/rate-limit";

/**
 * Sends the confirmation link again.
 *
 * A lost, filtered or expired confirmation email left no way forward:
 * signing in said the address was not confirmed and signing up again said
 * the account existed. This mints a fresh link for an address that has an
 * account and has not confirmed it, and sends the same email as sign up.
 *
 * Two limits, both before anything is sent. The address's own allowance is
 * the sign up limiter (ten an hour from one caller), so this cannot be used
 * to send more than sign up could. A second, per address, stops one inbox
 * being filled by pressing the button. An address with no account, or one
 * already confirmed, gets the same answer as one that was sent to and
 * nothing goes out: the form never says who has an account.
 */
const perAddress = createLimiter({ limit: 3, windowMs: 10 * 60 * 1000 });

export async function POST(request: NextRequest) {
  const log = logger("auth/resend", request);
  const decision = signupLimiter.check(clientIp(request));
  if (!decision.ok) {
    log.warn("rate limited");
    return tooManyRequests(decision);
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "That email address does not look right." }, { status: 400 });
  }

  const again = perAddress.check(email);
  if (!again.ok) return tooManyRequests(again);

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Nothing to send with. The browser falls back to Supabase's own mailer.
    return NextResponse.json({ message: "Email is not configured." }, { status: 503 });
  }

  const admin = supabaseAdmin();
  // Looked up before a link is minted: asking Auth for a link to an unknown
  // address would create the account.
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  const found = profile ? await admin.auth.admin.getUserById(profile.id) : null;
  const user = found?.data.user ?? null;
  if (!user || user.email_confirmed_at) {
    log.info("resend skipped", { to: email, known: Boolean(user) });
    return NextResponse.json({ ok: true });
  }

  const origin = siteOrigin(request);
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    log.warn("resend link failed", { to: email, err: error?.message ?? "no token" });
    return NextResponse.json({ message: "Could not send the link. Try again in a minute." }, { status: 400 });
  }

  // A magic link confirms an address that has not been confirmed, so the
  // callback treats it as it does the sign up link.
  const confirm = new URL("/auth/callback", origin);
  confirm.searchParams.set("token_hash", data.properties.hashed_token);
  confirm.searchParams.set("type", "magiclink");

  const name = (user.user_metadata as { full_name?: string } | null)?.full_name ?? "";
  const mail = confirmSignupEmail({ name, confirmUrl: confirm.toString() });
  const { error: sendError } = await new Resend(key).emails.send({
    from: emailSender(),
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  if (sendError) {
    log.error("resend email failed", { to: email, err: sendError.message });
    return NextResponse.json(
      { message: "We could not send the confirmation email. Try again later." },
      { status: 502 },
    );
  }

  log.info("confirmation sent again", { to: email, userId: user.id });
  return NextResponse.json({ ok: true });
}

/** Where links in the email should point: this deployment, never the body. */
function siteOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}
