import { supabaseAdmin } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * Is the service in a state where a resident could pay their dues?
 *
 * Read by /api/health (for an uptime check) and by /admin (for the owner).
 * One cheap select proves the database answers; the rest is whether the
 * keys the money and mail paths need are present at all. Values are never
 * returned, only presence.
 */

export interface HealthCheck {
  ok: boolean;
  /** One short line a person can act on. Never a secret. */
  detail: string;
  ms?: number;
}

export interface HealthReport {
  ok: boolean;
  at: string;
  checks: {
    supabase: HealthCheck;
    stripe: HealthCheck;
    resend: HealthCheck;
    cron: HealthCheck;
    sentry: HealthCheck;
  };
}

function present(name: string, meaning: string): HealthCheck {
  const set = Boolean(process.env[name]);
  return { ok: set, detail: set ? meaning : `${name} is not set` };
}

async function supabaseCheck(): Promise<HealthCheck> {
  if (!hasSupabase) return { ok: false, detail: "NEXT_PUBLIC_SUPABASE_URL is not set" };
  const started = Date.now();
  try {
    const { error } = await supabaseAdmin().from("cron_runs").select("id").limit(1);
    const ms = Date.now() - started;
    if (error) return { ok: false, detail: error.message, ms };
    return { ok: true, detail: "answers", ms };
  } catch (problem) {
    return {
      ok: false,
      detail: problem instanceof Error ? problem.message : "unreachable",
      ms: Date.now() - started,
    };
  }
}

export async function runHealthChecks(): Promise<HealthReport> {
  const supabase = await supabaseCheck();
  const stripe = present("STRIPE_SECRET_KEY", "key present");
  const resend = present("RESEND_API_KEY", "key present");
  const cron = present("CRON_SECRET", "secret present");
  const sentry: HealthCheck = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
    ? { ok: true, detail: "DSN present" }
    : { ok: true, detail: "not configured (optional)" };
  return {
    ok: supabase.ok && stripe.ok && resend.ok && cron.ok,
    at: new Date().toISOString(),
    checks: { supabase, stripe, resend, cron, sentry },
  };
}
