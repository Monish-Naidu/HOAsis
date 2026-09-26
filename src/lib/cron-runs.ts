import { supabaseAdmin } from "@/lib/supabase/server";
import { scrubFields, type LogFields } from "@/lib/log";

/**
 * One row per cron call, written when the call ends.
 *
 * "Did autopay run this morning?" used to mean opening the Vercel dashboard.
 * Now the ops page reads the latest row per job. A call that Vercel kills
 * at the time limit writes nothing, which the page shows as a run older
 * than a day, which is the right alarm.
 *
 * Never throws: a bookkeeping failure must not fail the run it describes.
 */
export type CronJob = "assessments" | "billing-sweep" | "autopay";

export async function recordCronRun(input: {
  job: CronJob;
  requestId: string;
  startedAt: number;
  ok: boolean;
  summary?: LogFields;
  error?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin()
      .from("cron_runs")
      .insert({
        job: input.job,
        started_at: new Date(input.startedAt).toISOString(),
        finished_at: new Date().toISOString(),
        ok: input.ok,
        summary: scrubFields(input.summary) as Record<string, unknown>,
        error: input.error ?? null,
        request_id: input.requestId,
      });
  } catch {
    // The response and the log line still say what happened.
  }
}
