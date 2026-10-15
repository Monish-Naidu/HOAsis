import { NextResponse, type NextRequest } from "next/server";
import { isEmail } from "@/lib/input-checks";
import { logger } from "@/lib/log";
import { sendJoinRequestNotice } from "@/lib/email/join-request";
import { clientIp, signupLimiter, tooManyRequests } from "@/lib/rate-limit";

/**
 * Tells the board that somebody asked to join.
 *
 * Called by the join page the moment request_to_join lands, on every submit:
 * from the browser a retry and a first ask are the same call, so the
 * once-per-request rule is kept by the request row itself in
 * sendJoinRequestNotice (src/lib/email/join-request.ts) and this route is
 * safe to call again.
 *
 * Anonymous on purpose: whoever asks to join is by definition not a member
 * yet. The limits are sign up's (ten an hour from one address), nothing is
 * sent unless a pending request from that address exists, and the answers
 * to a stranger never say who is on the board.
 */
export async function POST(request: NextRequest) {
  const log = logger("join/notify", request);
  const decision = signupLimiter.check(clientIp(request));
  if (!decision.ok) {
    log.warn("rate limited");
    return tooManyRequests(decision);
  }

  let body: { code?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!code || !isEmail(email)) {
    return NextResponse.json(
      { error: "A join code and a working email address are needed" },
      { status: 400 },
    );
  }

  try {
    const outcome = await sendJoinRequestNotice({ code, email, origin: siteOrigin(request) });
    if (outcome.status === "no-association") {
      // The code was checked against the database on the way in, so this is
      // a stale tab more than a guess, but it is not an address to send to.
      log.warn("no association has that code");
      return NextResponse.json({ error: "No association has that join code" }, { status: 404 });
    }
    if (outcome.status === "no-mail") {
      log.warn("no mail key is set");
      return NextResponse.json({ error: "Email is not configured" }, { status: 503 });
    }
    if (outcome.status === "no-request") {
      // Nothing waiting from this address. The same quiet answer whether
      // they never asked or the board already decided, so the route is not
      // a way to ask who is waiting.
      log.info("no request to tell the board about");
      return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: 0 });
    }
    if (outcome.status === "already") {
      log.info("the board was already told about this one");
      return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: 0, already: true });
    }
    if (outcome.status === "nobody") {
      log.warn("no officer who can manage homeowners has an address");
      return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: outcome.skipped });
    }
    log.info("the board was told", {
      sent: outcome.sent,
      failed: outcome.failed,
      skipped: outcome.skipped,
    });
    if (outcome.errors.length) log.warn("board notice errors", { errors: outcome.errors });
    return NextResponse.json({
      ok: true,
      sent: outcome.sent,
      failed: outcome.failed,
      skipped: outcome.skipped,
    });
  } catch (error) {
    log.error("could not tell the board", {
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not tell the board just now." }, { status: 500 });
  }
}

/** Where links in the email should point: this deployment, never the body. */
function siteOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}
