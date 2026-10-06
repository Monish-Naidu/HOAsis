import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
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

const ADDRESSES: ThreadAddress[] = ["board", "president", "vice-president", "treasurer", "secretary"];

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first", sent: 0, failed: 0 }, { status: 401 });

  let threadId: unknown;
  try {
    threadId = ((await request.json()) as { threadId?: unknown }).threadId;
  } catch {
    return NextResponse.json({ error: "Expected JSON", sent: 0, failed: 0 }, { status: 400 });
  }
  if (typeof threadId !== "string" || !threadId) {
    return NextResponse.json({ error: "threadId is required", sent: 0, failed: 0 }, { status: 400 });
  }

  const { data: thread } = await supabase
    .from("threads")
    .select("id, association_id, unit_id, subject, to_role, messages")
    .eq("id", threadId)
    .maybeSingle();
  const messages = Array.isArray(thread?.messages)
    ? (thread.messages as { fromRole?: string; from?: string; body?: string }[])
    : [];
  const first = messages[0];
  if (!thread || messages.length !== 1 || first?.fromRole !== "resident") {
    return NextResponse.json({ error: "Nothing to send", sent: 0, failed: 0 }, { status: 404 });
  }

  const to = ADDRESSES.includes(thread.to_role as ThreadAddress) ? (thread.to_role as ThreadAddress) : "board";
  const result = await sendOfficeMessageNotice({
    associationId: thread.association_id,
    threadId: thread.id,
    unitId: thread.unit_id,
    to,
    subject: thread.subject,
    body: first.body ?? "",
    fromName: first.from ?? "An owner",
    origin: siteOrigin(request),
  });
  return NextResponse.json(result);
}

function siteOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}
