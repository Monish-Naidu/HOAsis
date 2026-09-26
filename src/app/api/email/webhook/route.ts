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
 * Events arrive at least once and out of order, so a later "sent" must not
 * erase an earlier "delivered". The ladder below is the only ordering rule.
 * Runs under the service role because nobody is signed in on a webhook.
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

/** How far along a message is. A higher rung never gives way to a lower one. */
const RUNG: Record<EmailDeliveryStatus, number> = {
  sent: 1,
  delayed: 1,
  delivered: 2,
  opened: 3,
  clicked: 3,
  bounced: 4,
  failed: 4,
  complained: 4,
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

  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from("email_log")
    .select("id, status")
    .eq("provider_id", emailId)
    .maybeSingle();
  if (!row) return NextResponse.json({ received: true, ignored: "unknown email" });

  const current = row.status as EmailDeliveryStatus | null;
  if (current && RUNG[current] > RUNG[status]) {
    return NextResponse.json({ received: true, kept: current });
  }

  const { error } = await admin
    .from("email_log")
    .update({ status, status_at: event.created_at })
    .eq("id", row.id);
  if (error) {
    log.error("could not update email_log", { err: error.message, emailLogId: row.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ received: true, status });
}
