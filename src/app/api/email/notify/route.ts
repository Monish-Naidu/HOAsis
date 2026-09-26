import { NextResponse, type NextRequest } from "next/server";
import { errorBody, logger } from "@/lib/log";
import { supabaseServer } from "@/lib/supabase/server";
import { sendNotification, type NotifyKind } from "@/lib/email/notify";

/**
 * Emailing what the board just did: an announcement, a meeting notice, a
 * ballot opening, a dues letter, a message to a household, a request update.
 *
 * Same shape as the dues route. The browser names the association and the
 * record; the caller's own session answers has_capability, so a request
 * from somebody else's console is a 403 rather than a mail run. The words
 * of an announcement, meeting, ballot or request are read from the row on
 * the server, never from the body.
 */

const KINDS: NotifyKind[] = ["announcement", "meeting", "ballot", "letter", "message", "request"];

/** Which capabilities may send which kind. Any one of them will do. */
const ALLOWED: Record<NotifyKind, ("communications" | "finances" | "requests" | "voting")[]> = {
  announcement: ["communications"],
  meeting: ["communications"],
  ballot: ["communications", "voting"],
  letter: ["communications", "finances"],
  message: ["communications", "finances"],
  request: ["communications", "requests"],
};

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let body: {
    associationId?: string;
    kind?: NotifyKind;
    id?: string;
    unitIds?: unknown;
    subject?: string;
    body?: string;
    dryRun?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const { associationId, kind } = body;
  const log = logger("email/notify", request, { associationId });
  if (!associationId || !kind) {
    return NextResponse.json({ error: "associationId and kind are required" }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  }

  const checks = await Promise.all(
    ALLOWED[kind].map((needed) => supabase.rpc("has_capability", { target: associationId, needed })),
  );
  if (!checks.some((c) => c.data)) {
    return NextResponse.json({ error: "You cannot send that for this association" }, { status: 403 });
  }

  const unitIds = Array.isArray(body.unitIds)
    ? body.unitIds.filter((u): u is string => typeof u === "string").slice(0, 500)
    : undefined;

  // The sign-off on a message is the caller's own name, not one they typed.
  const { data: me } = await supabase
    .from("memberships")
    .select("full_name")
    .eq("association_id", associationId)
    .eq("profile_id", auth.user.id)
    .is("ends_on", null)
    .limit(1)
    .maybeSingle();

  try {
    const result = await sendNotification({
      associationId,
      kind,
      id: body.id,
      unitIds,
      subject: body.subject,
      body: body.body,
      senderName: me?.full_name ?? undefined,
      origin: siteOrigin(request),
      dryRun: body.dryRun,
    });
    log.info("notification sent", { kind, dryRun: Boolean(body.dryRun), result });
    return NextResponse.json(result);
  } catch (error) {
    log.error("notification failed", { kind, err: error });
    return NextResponse.json(
      errorBody(log, error instanceof Error ? error.message : "Could not send"),
      { status: 500 },
    );
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
