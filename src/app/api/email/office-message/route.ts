import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { routeMailOrigin } from "@/lib/email/mail-origin";
import { sendOfficeMessageNotice } from "@/lib/email/office-message";
import type { ThreadAddress } from "@/lib/types";

/**
 * Emailing the officer an owner just wrote to.
 *
 * The owner's browser names the thread it just started. The thread is read
 * with the caller's own session, so row level security answers whether it is
 * theirs, and the words are read from the row, never from the body. Only a
 * thread that still holds nothing but the owner's first message qualifies,
 * so this cannot be used to re-send mail about an old conversation, and the
 * email carries a key made from the thread and the address, so asking twice
 * sends once.
 */
export const maxDuration = 30;

const ADDRESSES: ThreadAddress[] = [
  "board",
  "president",
  "vice-president",
  "treasurer",
  "secretary",
];

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Sign in first", sent: 0, failed: 0 }, { status: 401 });

  let threadId: unknown;
  try {
    threadId = ((await request.json()) as { threadId?: unknown }).threadId;
  } catch {
    return NextResponse.json({ error: "Expected JSON", sent: 0, failed: 0 }, { status: 400 });
  }
  if (typeof threadId !== "string" || !threadId) {
    return NextResponse.json(
      { error: "threadId is required", sent: 0, failed: 0 },
      { status: 400 },
    );
  }

  // No origin this server can vouch for means no links, so nothing is sent.
  const origin = routeMailOrigin(request);
  if (!origin) {
    return NextResponse.json(
      { error: "Email is not configured", sent: 0, failed: 0 },
      { status: 503 },
    );
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("id, association_id, unit_id, subject, to_role, messages")
    .eq("id", threadId)
    .maybeSingle();
  const messages = Array.isArray(thread?.messages)
    ? (thread.messages as { id?: string; fromRole?: string; from?: string; body?: string }[])
    : [];
  const last = messages[messages.length - 1];
  // The mail goes out when the board has not heard the latest word: a first
  // message from the owner, or their follow-up after the board's reply. A
  // thread whose last word is the board's has nothing new to tell, and that
  // is also what stops this route re-sending mail about an old conversation.
  if (!thread || !last || last.fromRole !== "resident") {
    return NextResponse.json({ error: "Nothing to send", sent: 0, failed: 0 }, { status: 404 });
  }

  const to = ADDRESSES.includes(thread.to_role as ThreadAddress)
    ? (thread.to_role as ThreadAddress)
    : "board";
  const result = await sendOfficeMessageNotice({
    associationId: thread.association_id,
    threadId: thread.id,
    unitId: thread.unit_id,
    to,
    subject: thread.subject,
    body: last.body ?? "",
    fromName: last.from ?? "An owner",
    followUp: messages.length > 1,
    // One send per follow-up and address: a repeat of this call finds the
    // same last message and the provider folds it into the first attempt.
    // The first message keeps its long-standing key, so a notice already
    // sent under it is not sent again.
    messageKey: messages.length > 1 ? (last.id ?? `${thread.id}-${messages.length}`) : undefined,
    origin,
  });
  return NextResponse.json(result);
}
