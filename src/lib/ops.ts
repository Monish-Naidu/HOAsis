import { supabaseAdmin } from "@/lib/supabase/server";
import { DAY_MS } from "@/lib/utils";
import { hasSupabase } from "@/lib/supabase/env";
import { runHealthChecks, type HealthReport } from "@/lib/health";
import { EXPECTED_JOBS } from "@/lib/job-health";

/**
 * What the owner's ops page shows: the last seven days of things that went
 * wrong, and whether the machinery ran. Server only, service role, read
 * once per page load. Nothing here is derived twice: the page prints these
 * rows and nothing else.
 */

export const OPS_WINDOW_DAYS = 7;
/** A payment pending longer than this is stuck, not settling. */
export const STUCK_PAYMENT_DAYS = 5;

interface AppErrorRow {
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

interface ErrorGroup {
  message: string;
  count: number;
  latest: string;
  routes: string[];
  sources: string[];
}

interface EmailFailureRow {
  id: string;
  sent_at: string;
  association_id: string;
  to_email: string;
  category: string;
  subject: string;
  status: string | null;
  error: string | null;
}

interface AutopayFailureRow {
  id: string;
  created_at: string;
  association_id: string;
  unit_id: string;
  month: string;
  amount_cents: number;
  reason: string | null;
}

interface StuckPaymentRow {
  id: string;
  created_at: string;
  association_id: string;
  unit_id: string;
  amount_cents: number;
  rail: string;
  stripe_payment_intent_id: string | null;
}

interface CronRunRow {
  job: string;
  started_at: string;
  finished_at: string;
  ok: boolean;
  error: string | null;
  request_id: string | null;
  summary: Record<string, unknown>;
}

interface ActivityRow {
  id: string;
  at: string;
  association_id: string;
  actor_name: string;
  subject_kind: string;
  summary: string;
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
  /** The latest run per expected job, in the order the day runs them. */
  cronRuns: CronRunRow[];
  /** The latest successful run per expected job, for the freshness check (src/lib/job-health.ts). */
  cronSuccesses: CronRunRow[];
  /** The newest board actions across every association. */
  activity: ActivityRow[];
  associationNames: Record<string, string>;
  /** Anything a query could not answer, so the page says so. */
  problems: string[];
}

/** The rows with the same message, most frequent first. */
function groupErrors(rows: AppErrorRow[]): ErrorGroup[] {
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

export async function loadOpsReport(now = new Date()): Promise<OpsReport> {
  const since = new Date(now.getTime() - OPS_WINDOW_DAYS * DAY_MS).toISOString();
  const stuckBefore = new Date(now.getTime() - STUCK_PAYMENT_DAYS * DAY_MS).toISOString();
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
    cronSuccesses: [],
    activity: [],
    associationNames: {},
    problems,
  };
  if (!hasSupabase) {
    problems.push("Supabase is not configured, so there is nothing to read.");
    return empty;
  }

  const admin = supabaseAdmin();
  const cronColumns = "job, started_at, finished_at, ok, error, request_id, summary";
  // One newest row per job, and one newest success, so a busy job's
  // continuation rows can never push a quiet job out of the window.
  const latestRun = (job: string, okOnly: boolean) => {
    const query = admin.from("cron_runs").select(cronColumns).eq("job", job);
    return (okOnly ? query.eq("ok", true) : query)
      .order("started_at", { ascending: false })
      .limit(1);
  };
  const cronQueries = Promise.all(
    EXPECTED_JOBS.flatMap(({ job }) => [latestRun(job, false), latestRun(job, true)]),
  );
  const [errors, emails, autopay, payments, cronResults, activity] = await Promise.all([
    admin
      .from("app_errors")
      .select(
        "id, created_at, reference, level, source, route, message, association_id, profile_id, user_agent",
      )
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
      .select(
        "id, created_at, association_id, unit_id, amount_cents, rail, stripe_payment_intent_id",
      )
      .eq("state", "pending")
      .lt("created_at", stuckBefore)
      .order("created_at", { ascending: true })
      .limit(100),
    cronQueries,
    admin
      .from("activity")
      .select("id, at, association_id, actor_name, subject_kind, summary")
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(40),
  ]);

  for (const [name, result] of [
    ["app_errors", errors],
    ["email_log", emails],
    ["autopay_runs", autopay],
    ["payments", payments],
  ] as const) {
    if (result.error) problems.push(`${name}: ${result.error.message}`);
  }
  const cronError = cronResults.find((result) => result.error)?.error;
  if (cronError) problems.push(`cron_runs: ${cronError.message}`);

  const errorRows = (errors.data ?? []) as AppErrorRow[];
  const emailRows = (emails.data ?? []) as EmailFailureRow[];
  const autopayRows = (autopay.data ?? []) as AutopayFailureRow[];
  const paymentRows = (payments.data ?? []) as StuckPaymentRow[];
  const cronRow = (result: (typeof cronResults)[number]): CronRunRow[] =>
    ((result.data ?? []) as unknown as CronRunRow[]).map((r) => ({
      ...r,
      summary: (r.summary ?? {}) as Record<string, unknown>,
    }));
  const cronRuns = cronResults.filter((_, i) => i % 2 === 0).flatMap(cronRow);
  const cronSuccesses = cronResults.filter((_, i) => i % 2 === 1).flatMap(cronRow);

  // Names for the ids on screen, one query for the lot.
  const ids = new Set<string>();
  for (const r of errorRows) if (r.association_id) ids.add(r.association_id);
  for (const r of emailRows) ids.add(r.association_id);
  for (const r of autopayRows) ids.add(r.association_id);
  for (const r of paymentRows) ids.add(r.association_id);
  const activityRows = (activity.data ?? []) as ActivityRow[];
  for (const r of activityRows) ids.add(r.association_id);
  const associationNames: Record<string, string> = {};
  if (ids.size > 0) {
    const { data } = await admin
      .from("associations")
      .select("id, name")
      .in("id", [...ids]);
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
    cronRuns,
    cronSuccesses,
    activity: activityRows,
    associationNames,
    problems,
  };
}
