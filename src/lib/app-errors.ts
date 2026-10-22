import { supabaseAdmin } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { isRequestId, logger, newRequestId, scrubFields, type LogFields } from "@/lib/log";
import { scrubText, stripUrl } from "../../redact.mjs";

/**
 * Writing an error down where the owner can see it.
 *
 * Server only. Called from `/api/log` (what a browser caught) and from
 * `src/instrumentation.ts` (what the server caught). The row is deliberately
 * small: the message and a cut stack, the reference, who and where. Application
 * Insights gets the same error with its trace when it is configured; this
 * table is what works with no account at all, and what /admin reads.
 *
 * Every text field is scrubbed the way a log line is (redact.mjs): emails
 * masked, query values, credentials and key-shaped strings redacted. The
 * route loses its query altogether.
 *
 * Never throws. An error recorder that fails must not turn one error into
 * two. When the insert fails it says so once on the log, with the reference,
 * and stops there: the log line goes to the console and Application
 * Insights, never back into this table.
 */

export interface AppErrorInput {
  reference?: string | null;
  level?: "info" | "warn" | "error";
  source: "server" | "client";
  route?: string | null;
  message: string;
  stack?: string | null;
  associationId?: string | null;
  profileId?: string | null;
  userAgent?: string | null;
  extra?: LogFields;
}

const MAX_MESSAGE = 500;
const MAX_STACK = 4000;
const MAX_ROUTE = 200;
const MAX_UA = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cut(value: string | null | undefined, max: number, clean = scrubText): string | null {
  if (!value) return null;
  const masked = clean(String(value));
  return masked.length > max ? `${masked.slice(0, max)}…` : masked;
}

function uuidOrNull(value: string | null | undefined): string | null {
  return value && UUID.test(value) ? value : null;
}

/** The row as it will be stored, with the reference it will carry. */
export function shapeAppError(input: AppErrorInput) {
  return {
    reference: isRequestId(input.reference) ? input.reference : newRequestId(),
    level: input.level ?? "error",
    source: input.source,
    route: cut(input.route, MAX_ROUTE, stripUrl),
    message: cut(input.message, MAX_MESSAGE) ?? "Unknown error",
    stack: cut(input.stack, MAX_STACK),
    association_id: uuidOrNull(input.associationId),
    profile_id: uuidOrNull(input.profileId),
    user_agent: cut(input.userAgent, MAX_UA),
    extra: scrubFields(input.extra),
  };
}

export interface RecordedAppError {
  reference: string;
  /** False when the row could not be written; the log line says why. */
  stored: boolean;
}

/** Inserts the row. Returns the reference either way, and whether it was stored. */
export async function recordAppError(input: AppErrorInput): Promise<RecordedAppError> {
  const row = shapeAppError(input);
  if (!hasSupabase) return { reference: row.reference, stored: false };
  let problem: unknown = null;
  try {
    const { error } = await supabaseAdmin().from("app_errors").insert(row);
    problem = error;
  } catch (thrown) {
    problem = thrown;
  }
  if (!problem) return { reference: row.reference, stored: true };
  logger("app-errors", null, { requestId: row.reference }).error("app error not stored", {
    reference: row.reference,
    source: row.source,
    route: row.route,
    err:
      problem instanceof Error
        ? problem
        : String((problem as { message?: unknown }).message ?? problem),
  });
  return { reference: row.reference, stored: false };
}
