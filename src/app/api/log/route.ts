import { NextResponse, type NextRequest } from "next/server";
import { recordAppError } from "@/lib/app-errors";
import { errorBody, isRequestId, logger } from "@/lib/log";
import { clientIp, createLimiter, tooManyRequests } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * Where a browser reports an error it caught.
 *
 * The error pages (src/app/error.tsx, global-error.tsx) and the
 * unhandled-rejection listener (ErrorReporter) post here with the reference
 * they showed the person, so "Reference K7QM2X4P" on a screen is a row in
 * app_errors with the same code. Anyone can post; the limiter keeps a loop
 * from filling the table and nothing in the body is trusted beyond its
 * length.
 */
export const runtime = "nodejs";

/** Thirty a minute from one address: a page stuck in an error loop, not a script. */
const limiter = createLimiter({ limit: 30, windowMs: 60_000 });

type Body = {
  reference?: unknown;
  message?: unknown;
  stack?: unknown;
  route?: unknown;
  level?: unknown;
  associationId?: unknown;
  extra?: unknown;
};

function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  const log = logger("log", request);
  const decision = limiter.check(clientIp(request));
  if (!decision.ok) return tooManyRequests(decision);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(errorBody(log, "Expected JSON"), { status: 400 });
  }

  const message = str(body.message, 500);
  if (!message) {
    return NextResponse.json(errorBody(log, "message is required"), { status: 400 });
  }
  const level = body.level === "warn" || body.level === "info" ? body.level : "error";
  const extra =
    body.extra && typeof body.extra === "object" && !Array.isArray(body.extra)
      ? (body.extra as Record<string, unknown>)
      : {};

  // Who, if they are signed in. Best effort: a signed-out error still counts.
  let profileId: string | null = null;
  if (hasSupabase) {
    try {
      const { data } = await (await supabaseServer()).auth.getUser();
      profileId = data.user?.id ?? null;
    } catch {
      profileId = null;
    }
  }

  const reference = await recordAppError({
    reference: isRequestId(body.reference) ? body.reference : log.requestId,
    level,
    source: "client",
    route: str(body.route, 200),
    message,
    stack: str(body.stack, 4000),
    associationId: str(body.associationId, 36),
    profileId,
    userAgent: request.headers.get("user-agent"),
    extra,
  });

  log[level]("client error", { reference, message, route: str(body.route, 200) });
  return NextResponse.json({ reference });
}
