import { supabaseAdmin } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { isRequestId, maskEmail, newRequestId, scrubFields, type LogFields } from "@/lib/log";

/**
 * Writing an error down where the owner can see it.
 *
 * Server only. Called from `/api/log` (what a browser caught) and from
 * `src/instrumentation.ts` (what the server caught). The row is deliberately
 * small: the message and a cut stack, the reference, who and where. Sentry
 * gets the full event when it is configured; this table is what works with
 * no account at all, and what /admin reads.
 *
 * Never throws. An error recorder that fails must not turn one error into
 * two.
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

function cut(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const masked = maskEmail(String(value));
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
    route: cut(input.route, MAX_ROUTE),
    message: cut(input.message, MAX_MESSAGE) ?? "Unknown error",
    stack: cut(input.stack, MAX_STACK),
    association_id: uuidOrNull(input.associationId),
    profile_id: uuidOrNull(input.profileId),
    user_agent: cut(input.userAgent, MAX_UA),
    extra: scrubFields(input.extra),
  };
}

/** Inserts the row. Returns the reference either way. */
export async function recordAppError(input: AppErrorInput): Promise<string> {
  const row = shapeAppError(input);
  if (!hasSupabase) return row.reference;
  try {
    await supabaseAdmin().from("app_errors").insert(row);
  } catch {
    // The log line already carries the reference; the row was a bonus.
  }
  return row.reference;
}
