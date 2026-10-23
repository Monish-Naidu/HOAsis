import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendRequestAlert } from "@/lib/email/request-alert";
import { routeMailOrigin } from "@/lib/email/mail-origin";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * The resident app's "tell the board about this request" call, made right
 * after a request is filed or the owner replies on it. The request is read
 * through the caller's own session, so RLS answers who may ask: only someone
 * on the request's home can alert the board about it, and a reply alert only
 * stands when the thread's last event is the owner's. The board's own
 * replies travel to the resident through /api/email/notify instead.
 */
export async function POST(request: NextRequest) {
  const log = logger("email:request-alert", request);
  const supabase = await supabaseServer();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Sign in to send this" }, { status: 401 });
  }

  let body: { requestId?: string; kind?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON" }, { status: 400 });
  }
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const kind = body.kind === "reply" ? "reply" : body.kind === "filed" ? "filed" : null;
  if (!requestId || !kind) {
    return NextResponse.json({ error: "requestId and kind are required" }, { status: 400 });
  }

  // The caller's own session reads the request, so a request outside their
  // tenancy simply does not exist for them.
  const { data: req } = await supabase
    .from("requests")
    .select("id, association_id, unit_id, thread")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) {
    return NextResponse.json({ error: "Nothing to send", sent: 0, failed: 0 }, { status: 404 });
  }

  // Only the home's own people alert the board about it. A board seat alone
  // never alerts anyone here: the board's side already mails the resident.
  const { data: myUnits } = await supabase.rpc("my_unit_ids");
  if (!(myUnits ?? []).includes(req.unit_id)) {
    return NextResponse.json({ error: "Nothing to send", sent: 0, failed: 0 }, { status: 403 });
  }

  if (kind === "reply") {
    const thread = Array.isArray(req.thread) ? req.thread : [];
    const last = thread.length > 0 ? thread[thread.length - 1] : null;
    if (!last || (last as { actorRole?: string }).actorRole !== "resident") {
      return NextResponse.json({ error: "Nothing to send", sent: 0, failed: 0 }, { status: 404 });
    }
  }

  // No origin this server can vouch for means no links, so nothing is sent
  // and the caller is told it did not go out.
  const origin = routeMailOrigin(request);
  if (!origin) {
    log.error(`no site origin for the request alert links on ${req.id}`);
    return NextResponse.json(
      { error: "Email is not configured", sent: 0, failed: 0 },
      { status: 503 },
    );
  }

  const result = await sendRequestAlert({
    associationId: req.association_id,
    requestId: req.id,
    kind,
    actorProfileId: auth.user.id,
    origin,
  });
  log.info("request alert sent", { kind, sent: result.sent, failed: result.failed });
  return NextResponse.json(result);
}
