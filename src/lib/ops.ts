import { supabaseAdmin } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { runHealthChecks, type HealthReport } from "@/lib/health";
import type { CronJob } from "@/lib/cron-runs";

/**
 * What the owner's ops page shows: the last seven days of things that went
 * wrong, and whether the machinery ran. Server only, service role, read
 * once per page load. Nothing here is derived twice: the page prints these
 * rows and nothing else.
 */

export const OPS_WINDOW_DAYS = 7;
/** A payment pending longer than this is stuck, not settling. */
export const STUCK_PAYMENT_DAYS = 5;

export interface AppErrorRow {
  id: string;
  created_at: string;
  reference: string;
  level: string;
  source: string;
  route: string | null;
  message: string;
  association_id: string | null;
  profile_id: string | null;
  user_agent: string | null;
}

export interface ErrorGroup {
  message: string;
  count: number;
  latest: string;
  routes: string[];
  sources: string[];
}

export interface EmailFailureRow {
  id: string;
  sent_at: string;
  association_id: string;
  to_email: string;
  category: string;
  subject: string;
  status: string | null;
  error: string | null;
}

export interface AutopayFailureRow {
  id: string;
  created_at: string;
  association_id: string;
  unit_id: string;
  month: string;
  amount_cents: number;
  reason: string | null;
}

export interface StuckPaymentRow {
  id: string;
  created_at: string;
  association_id: string;
  unit_id: string;
  amount_cents: number;
  rail: string;
  stripe_payment_intent_id: string | null;
}

export interface CronRunRow {
  job: string;
  started_at: string;
  finished_at: string;
  ok: boolean;
  error: string | null;
  request_id: string | null;
  summary: Record<string, unknown>;
}

export interface OpsReport {
  /** When this report was read, so the page never asks the clock while rendering. */
  now: string;
  since: string;
  health: HealthReport;
  errors: AppErrorRow[];
  errorGroups: ErrorGroup[];
  emailFailures: EmailFailureRow[];
  autopayFailures: AutopayFailureRow[];
  stuckPayments: StuckPaymentRow[];
  /** The latest run per job, in the order the day runs them. */
  cronRuns: CronRunRow[];
  associationNames: Record<string, string>;
  /** Anything a query could not answer, so the page says so. */
  problems: string[];
}

export const CRON_JOBS: CronJob[] = ["assessments", "billing-sweep", "autopay"];

/** The rows with the same message, most frequent first. */
export function groupErrors(rows: AppErrorRow[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();
  for (const row of rows) {
    const key = row.message.slice(0, 160);
    const group = groups.get(key) ?? {
      message: key,
      count: 0,
      latest: row.created_at,
      routes: [],
      sources: [],
    };
    group.count += 1;
    if (row.created_at > group.latest) group.latest = row.created_at;
    if (row.route && !group.routes.includes(row.route)) group.routes.push(row.route);
    if (!group.sources.includes(row.source)) group.sources.push(row.source);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || (a.latest < b.latest ? 1 : -1));
}

/** One row per job: the newest. Missing jobs are left out, and the page says so. */
export function latestPerJob(rows: CronRunRow[]): CronRunRow[] {
  const seen = new Map<string, CronRunRow>();
  for (const row of rows) {
    const current = seen.get(row.job);
    if (!current || row.started_at > current.started_at) seen.set(row.job, row);
  }
  return CRON_JOBS.flatMap((job) => {
    const row = seen.get(job);
    return row ? [row] : [];
  });
}

export async function loadOpsReport(now = new Date()): Promise<OpsReport> {
  const since = new Date(now.getTime() - OPS_WINDOW_DAYS * 86_400_000).toISOString();
  const stuckBefore = new Date(now.getTime() - STUCK_PAYMENT_DAYS * 86_400_000).toISOString();
  const problems: string[] = [];
  const health = await runHealthChecks();

  const empty: OpsReport = {
    now: now.toISOString(),
    since,
    health,
    errors: [],
    errorGroups: [],
    emailFailures: [],
    autopayFailures: [],
    stuckPayments: [],
    cronRuns: [],
    associationNames: {},
    problems,
  };
  if (!hasSupabase) {
    problems.push("Supabase is not configured, so there is nothing to read.");
    return empty;
  }

  const admin = supabaseAdmin();
  const [errors, emails, autopay, payments, crons] = await Promise.all([
    admin
      .from("app_errors")
      .select("id, created_at, reference, level, source, route, message, association_id, profile_id, user_agent")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("email_log")
      .select("id, sent_at, association_id, to_email, category, subject, status, error")
      .gte("sent_at", since)
      .or("error.not.is.null,status.in.(bounced,failed,complained)")
      .order("sent_at", { ascending: false })
      .limit(100),
    admin
      .from("autopay_runs")
      .select("id, created_at, association_id, unit_id, month, amount_cents, reason")
      .eq("state", "failed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("payments")
      .select("id, created_at, association_id, unit_id, amount_cents, rail, stripe_payment_intent_id")
      .eq("state", "pending")
      .lt("created_at", stuckBefore)
      .order("created_at", { ascending: true })
      .limit(100),
    admin
      .from("cron_runs")
      .select("job, started_at, finished_at, ok, error, request_id, summary")
      .order("started_at", { ascending: false })
      .limit(60),
  ]);

  for (const [name, result] of [
    ["app_errors", errors],
    ["email_log", emails],
    ["autopay_runs", autopay],
    ["payments", payments],
    ["cron_runs", crons],
  ] as const) {
    if (result.error) problems.push(`${name}: ${result.error.message}`);
  }

  const errorRows = (errors.data ?? []) as AppErrorRow[];
  const emailRows = (emails.data ?? []) as EmailFailureRow[];
  const autopayRows = (autopay.data ?? []) as AutopayFailureRow[];
  const paymentRows = (payments.data ?? []) as StuckPaymentRow[];
  const cronRows = ((crons.data ?? []) as unknown as CronRunRow[]).map((r) => ({
    ...r,
    summary: (r.summary ?? {}) as Record<string, unknown>,
  }));

  // Names for the ids on screen, one query for the lot.
  const ids = new Set<string>();
  for (const r of errorRows) if (r.association_id) ids.add(r.association_id);
  for (const r of emailRows) ids.add(r.association_id);
  for (const r of autopayRows) ids.add(r.association_id);
  for (const r of paymentRows) ids.add(r.association_id);
  const associationNames: Record<string, string> = {};
  if (ids.size > 0) {
    const { data } = await admin.from("associations").select("id, name").in("id", [...ids]);
    for (const a of data ?? []) associationNames[a.id] = a.name;
  }

  return {
    now: now.toISOString(),
    since,
    health,
    errors: errorRows.slice(0, 50),
    errorGroups: groupErrors(errorRows),
    emailFailures: emailRows,
    autopayFailures: autopayRows,
    stuckPayments: paymentRows,
    cronRuns: latestPerJob(cronRows),
    associationNames,
    problems,
  };
}
