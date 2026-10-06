import { NextResponse, type NextRequest } from "next/server";
import { isEmail } from "@/lib/input-checks";
import { logger } from "@/lib/log";
import { Resend } from "resend";
import { emailSender } from "@/lib/email/sender";
import { supabaseAdmin } from "@/lib/supabase/server";
import { confirmSignupEmail } from "@/lib/email/templates";
import { clientIp, signupLimiter, tooManyRequests } from "@/lib/rate-limit";

/**
 * Creates an account and sends the confirmation link ourselves.
 *
 * The browser used to call Supabase's own sign up, which sends the email
 * through Supabase's built in mailer. That mailer is rate limited and meant
 * for testing, and the failure it returns, "Error sending confirmation
 * email", landed on the first screen of setup for a real founder. Nothing
 * they typed was kept, because no account was made.
 *
 * So the user is created with the admin API, which mints the confirmation
 * token without sending anything, and the email goes out through Resend like
 * every other message. If the email cannot be sent the account is removed
 * again, so a retry is a clean retry rather than "already registered".
 *
 * Confirmation stays mandatory: a household's seat is claimed by matching the
 * invited address at sign up, so an unconfirmed address must never sign in.
 */
export async function POST(request: NextRequest) {
  // Ten an hour from one address (src/lib/rate-limit.ts). A script creating
  // accounts is refused; a household creating one is not slowed.
  const log = logger("auth/signup", request);
  const decision = signupLimiter.check(clientIp(request));
  if (!decision.ok) {
    log.warn("rate limited");
    return tooManyRequests(decision);
  }

  let body: { email?: unknown; password?: unknown; fullName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";

  if (!isEmail(email)) {
    return NextResponse.json({ message: "That email address does not look right." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ message: "Passwords need at least 8 characters." }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ message: "Your name is needed." }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Nothing to send with. The browser falls back to Supabase's own mailer.
    return NextResponse.json({ message: "Email is not configured." }, { status: 503 });
  }

  const origin = siteOrigin(request);
  const admin = supabaseAdmin();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      data: { full_name: fullName },
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.user || !data.properties?.hashed_token) {
    const message = error?.message ?? "";
    const already = /already|exists/i.test(message);
    log.warn("signup refused", { to: email, err: message || "no token", already });
    return NextResponse.json(
      {
        message: already
          ? "There is already an account for that email."
          : message || "Could not create the account.",
      },
      { status: already ? 409 : 400 },
    );
  }

  // Our own callback verifies the token and works out where to send them.
  const confirm = new URL("/auth/callback", origin);
  confirm.searchParams.set("token_hash", data.properties.hashed_token);
  confirm.searchParams.set("type", "signup");

  const mail = confirmSignupEmail({ name: fullName, confirmUrl: confirm.toString() });
  const { error: sendError } = await new Resend(key).emails.send({
    from: emailSender(),
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  if (sendError) {
    // Undo, so the next attempt is not told the address is taken.
    await admin.auth.admin.deleteUser(data.user.id).catch((err: unknown) => {
      log.warn("could not remove the unconfirmed auth user", {
        userId: data.user.id,
        err: err instanceof Error ? err.message : String(err),
      });
    });
    log.error("signup email failed", { to: email, err: sendError.message });
    // Resend refuses anything but the account owner's address until the
    // sending domain is verified. That is our setup, not their typo, and
    // telling them to check the address sent people hunting for a mistake
    // they had not made.
    const ours = /testing emails|verify a domain|domain is not verified/i.test(sendError.message ?? "");
    return NextResponse.json(
      {
        message: ours
          ? "We could not send the confirmation email on our side. Try again later."
          : "We could not send the confirmation email. Check the address and try again.",
      },
      { status: 502 },
    );
  }

  log.info("signup created", { to: email, userId: data.user.id });
  return NextResponse.json({ ok: true });
}

/** Where links in the email should point: this deployment, never the body. */
function siteOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}
