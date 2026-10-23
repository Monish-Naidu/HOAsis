import { supabaseAdmin } from "@/lib/supabase/server";
import { logger, scrubFields, type LogFields } from "@/lib/log";
import { scrubText } from "../../redact.mjs";

/**
 * One row per cron call, written when the call ends.
 *
 * "Did autopay run this morning?" used to mean opening the host's dashboard.
 * Now the ops page and the daily digest read the latest rows per job
 * (src/lib/job-health.ts). A call the host kills at the time limit writes
 * nothing, which reads as a missed run once the job's window has passed,
 * which is the right alarm.
 *
 * Never throws: a bookkeeping failure must not fail the run it describes.
 * It is not silent either: a row that could not be written is one error
 * line on the log, which reaches Application Insights and its error alert,
 * and that line never tries to write a row of its own.
 */
export type CronJob = "assessments" | "email-bills" | "billing-sweep" | "autopay" | "ops-digest";

export async function recordCronRun(input: {
  job: CronJob;
  requestId: string;
  startedAt: number;
  ok: boolean;
  summary?: LogFields;
  error?: string | null;
}): Promise<boolean> {
  let problem: unknown = null;
  try {
    const { error } = await supabaseAdmin()
      .from("cron_runs")
      .insert({
        job: input.job,
        started_at: new Date(input.startedAt).toISOString(),
        finished_at: new Date().toISOString(),
        ok: input.ok,
        summary: scrubFields(input.summary) as Record<string, unknown>,
        error: input.error ? scrubText(input.error).slice(0, 1000) : null,
        request_id: input.requestId,
      });
    problem = error;
  } catch (thrown) {
    problem = thrown;
  }
  if (!problem) return true;
  logger("cron-runs", null, { requestId: input.requestId }).error("cron run not recorded", {
    job: input.job,
    ok: input.ok,
    err:
      problem instanceof Error
        ? problem
        : String((problem as { message?: unknown }).message ?? problem),
  });
  return false;
}
