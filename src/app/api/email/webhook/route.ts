import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/log";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { EmailDeliveryStatus } from "@/lib/types";

/**
 * What became of each email, from the provider's own mouth.
 *
 * Sending is only half of a notice. A board that has to show a fine was
 * properly noticed needs the other half: that the message arrived, or
 * bounced, and when. Resend posts every one of those events here, signed,
 * and each one lands on the row `email_log` already holds for the send.
 *
 * Events arrive at least once and out of order, so the status ladder is
 * applied by the database under the message's row lock (0129): a later
 * "sent" cannot erase an earlier "delivered", however the events interleave.
 * A database fault answers 500, so the provider retries instead of the event
 * being acknowledged and lost. Runs under the service role because nobody is
 * signed in on a webhook.
 */
export const runtime = "nodejs";

const STATUS: Record<string, EmailDeliveryStatus> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};

export async function POST(request: NextRequest) {
  const log = logger("email/webhook", request);
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    log.error("resend webhook secret is not configured");
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }

  const payload = await request.text();
  // Svix-style signing: three headers the SDK checks against the raw body.
  const headers = {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  };
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  let event: ReturnType<Resend["webhooks"]["verify"]>;
  try {
    event = new Resend(process.env.RESEND_API_KEY ?? "").webhooks.verify({
      payload,
      headers,
      webhookSecret: secret,
    });
  } catch (error) {
    log.warn("bad signature", { err: error });
    return NextResponse.json(
      { error: `Bad signature: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 400 },
    );
  }

  const status = STATUS[event.type];
  log.info("delivery event", { type: event.type, status: status ?? null });
  if (!status) return NextResponse.json({ received: true, ignored: event.type });

  const data = event.data as { email_id?: string };
  const emailId = data.email_id;
  if (!emailId) return NextResponse.json({ received: true, ignored: "no email id" });

  // One atomic call: the ladder is decided and written under the row lock,
  // so this route never reads a status apart from the write that follows it.
  const { data: outcome, error } = await supabaseAdmin().rpc("apply_email_delivery", {
    p_provider_id: emailId,
    p_status: status,
    p_status_at: event.created_at,
  });
  if (error) {
    log.error("could not apply delivery event", { err: error.message, type: event.type });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (outcome === "unknown-email") {
    return NextResponse.json({ received: true, ignored: "unknown email" });
  }
  if (outcome === "kept") {
    return NextResponse.json({ received: true, kept: true });
  }
  return NextResponse.json({ received: true, status });
}
