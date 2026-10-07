import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { loadOpsReport } from "@/lib/ops";
import { buildDigest } from "@/lib/ops-digest";
import { platformOwnerEmails } from "@/lib/platform-owner";
import { emailSender, resendKey } from "@/lib/email/sender";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/log";

/**
 * The daily digest, after the three money jobs have run (vercel.json).
 *
 * Reads the same report /admin shows and emails the platform owners when
 * there is something in it. Authorised the way the other crons are, with
 * CRON_SECRET. `?dry=1` builds the email and sends nothing.
 *
 * Also the morning the books close: every fiscal year that ended and has
 * no row yet gets one (close_ended_fiscal_years, 0109), before the report
 * is read so a close that failed is in the digest.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const log = logger("ops/digest", request);
  if (!authorized(request)) {
    log.warn("unauthorized");
    return NextResponse.json({ error: "Not for you", reference: log.requestId }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const now = new Date().toISOString();
  if (!dryRun) {
    const { data: closed, error: closeError } = await supabaseAdmin().rpc("close_ended_fiscal_years");
    if (closeError) log.error("fiscal years did not close", { err: closeError.message });
    else if (closed) log.info("fiscal years closed", { count: closed });
  }
  const report = await loadOpsReport(new Date(now));
  const digest = buildDigest(report, now, `${request.nextUrl.origin}/admin`);
  const to = platformOwnerEmails();

  if (!digest.send || dryRun || to.length === 0) {
    log.info("digest not sent", { send: digest.send, dryRun, recipients: to.length, subject: digest.subject });
    return NextResponse.json({ sent: 0, wouldSend: digest.send, recipients: to.length, subject: digest.subject, text: digest.text });
  }

  const key = resendKey();
  if (!key) {
    log.error("digest could not be sent: no email key");
    return NextResponse.json({ error: "Email is not set up", subject: digest.subject }, { status: 500 });
  }
  const sent = await new Resend(key).emails.send({
    from: emailSender(),
    to,
    subject: digest.subject,
    text: digest.text,
    html: digest.html,
  });
  if (sent.error) {
    log.error("digest failed to send", { err: sent.error.message });
    return NextResponse.json({ error: sent.error.message }, { status: 500 });
  }
  log.info("digest sent", { recipients: to.length, subject: digest.subject });
  return NextResponse.json({ sent: to.length, subject: digest.subject });
}
