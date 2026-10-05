import { NextResponse, type NextRequest } from "next/server";
import { errorBody, logger } from "@/lib/log";
import { supabaseServer } from "@/lib/supabase/server";
import { sendNotification, type NotifyKind } from "@/lib/email/notify";
import { recordAppError } from "@/lib/app-errors";

/**
 * Emailing what the board just did: an announcement, a meeting notice, a
 * ballot opening, a dues letter, a message to a household, a request update.
 *
 * Same shape as the dues route. The browser names the association and the
 * record; the caller's own session answers has_capability, so a request
 * from somebody else's console is a 403 rather than a mail run. The words
 * of an announcement, meeting, ballot or request are read from the row on
 * the server, never from the body.
 *
 * The send is paced and stops before the time limit below
 * (src/lib/email/pace.ts). A send that stopped answers with `remaining`
 * above zero, and the same request made again carries on from there:
 * whoever already has the notice is passed over (src/lib/email/notify.ts).
 * That is how a roster longer than one call can reach gets its notice. A
 * longer `maxDuration` is not the answer, because what the plan allows is
 * not something this code can see.
 *
 * Every answer carries the same counts (sent, failed, skipped, already,
 * remaining), a refusal included, so the browser can read `remaining`
 * without first asking what kind of answer it got. A stop is also put on /admin with the number not reached: a tab
 * closed halfway ends the calling, and that row is then the only trace.
 *
 * A send whose record could not be written to email_log stops and answers
 * with nothing remaining, so the browser does not call again and write to
 * the same people. That goes on /admin as an error: the mail that went has
 * no record, which is the thing a board is later asked to show.
 */
export const maxDuration = 60;

/** The counts of an answer that sent nothing: a refusal, or a failure before the first send. */
const NOTHING_SENT = { sent: 0, failed: 0, skipped: 0, already: 0, remaining: 0 };

function refuse(error: string, status: number) {
  return NextResponse.json({ error, ...NOTHING_SENT }, { status });
}

const KINDS: NotifyKind[] = ["announcement", "meeting", "ballot", "letter", "message", "request"];

/**
 * Which capabilities may send which kind. Any one of them will do.
 *
 * A meeting is run by whoever holds voting: that is what opens the Meetings
 * page (src/lib/board-routes.ts) and what may write the row (meetings_write,
 * migration 0005). Without voting here, that seat pressed Send notice, the
 * meeting was marked as noticed, and this route refused the email.
 */
const ALLOWED: Record<NotifyKind, ("communications" | "finances" | "requests" | "voting")[]> = {
  announcement: ["communications"],
  meeting: ["communications", "voting"],
  ballot: ["communications", "voting"],
  letter: ["communications", "finances"],
  message: ["communications", "finances"],
  request: ["communications", "requests"],
};

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return refuse("Sign in first", 401);
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
    return refuse("Expected JSON", 400);
  }

  const { associationId, kind } = body;
  const log = logger("email/notify", request, { associationId });
  if (!associationId || !kind) {
    return refuse("associationId and kind are required", 400);
  }
  if (!KINDS.includes(kind)) {
    return refuse("Unknown kind", 400);
  }

  const checks = await Promise.all(
    ALLOWED[kind].map((needed) => supabase.rpc("has_capability", { target: associationId, needed })),
  );
  if (!checks.some((c) => c.data)) {
    return refuse("You cannot send that for this association", 403);
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
    if (result.remaining > 0) {
      log.warn("notification stopped at the time limit", { kind, sent: result.sent, remaining: result.remaining });
      await recordAppError({
        level: "warn",
        source: "server",
        route: "email/notify",
        reference: log.requestId,
        message: `The ${kind} email stopped at the time limit with ${result.remaining} not reached`,
        associationId,
        profileId: auth.user.id,
        extra: { kind, id: body.id ?? null, sent: result.sent, failed: result.failed - result.remaining, already: result.already, remaining: result.remaining },
      });
    }
    if (result.unrecorded) {
      log.error("notification record not saved", { kind, sent: result.sent, err: result.unrecorded });
      await recordAppError({
        level: "error",
        source: "server",
        route: "email/notify",
        reference: log.requestId,
        message: `The record of the ${kind} email could not be saved`,
        associationId,
        profileId: auth.user.id,
        extra: { kind, id: body.id ?? null, sent: result.sent, failed: result.failed, already: result.already, why: result.unrecorded },
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    log.error("notification failed", { kind, err: error });
    return NextResponse.json(
      errorBody(log, error instanceof Error ? error.message : "Could not send", NOTHING_SENT),
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
