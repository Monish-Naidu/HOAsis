import type { CronJob } from "@/lib/cron-runs";
import { DAY_MS } from "@/lib/utils";

/**
 * Did each daily job run when it should have, and did it work?
 *
 * The jobs are the scheduled Container App jobs in infra/apps.bicep, one
 * call a day each at a fixed UTC minute (tests/unit/job-health.test.ts reads
 * that file, so the two cannot drift apart). A job is healthy when its
 * newest recorded run succeeded and a successful run has started since its
 * latest scheduled time, once that time is more than a grace period old.
 * Anything else is one of three things an operator acts on differently:
 *
 * - failed: the newest run recorded an error;
 * - missing: no run of the job has ever been recorded;
 * - stale: the newest success is older than the latest slot it should have
 *   filled, so a run was skipped, killed at the time limit, or never wrote
 *   its row.
 *
 * Each job is judged on its own rows, so a healthy job never covers for an
 * unhealthy one. The digest is itself one of the jobs, and it reads this
 * while it is running, before its own row exists: passed as `running`, it is
 * judged on the run before this one, and no previous run at all is its first
 * day, not a failure. /admin passes nothing, so there a digest that never ran
 * shows as missing.
 *
 * Pure: the caller hands over the rows and the time.
 */

export interface ExpectedJob {
  job: CronJob;
  /** The route the scheduled job calls. */
  path: string;
  hourUtc: number;
  minuteUtc: number;
}

/** In the order the day runs them, as scheduled in infra/apps.bicep. */
export const EXPECTED_JOBS: readonly ExpectedJob[] = [
  { job: "assessments", path: "/api/assessments/run", hourUtc: 13, minuteUtc: 0 },
  { job: "email-bills", path: "/api/email/bills", hourUtc: 13, minuteUtc: 30 },
  { job: "billing-sweep", path: "/api/billing/sweep", hourUtc: 14, minuteUtc: 0 },
  { job: "autopay", path: "/api/autopay/run", hourUtc: 14, minuteUtc: 30 },
  { job: "ops-digest", path: "/api/ops/digest", hourUtc: 15, minuteUtc: 0 },
];

/** How long after its scheduled minute a job has to have recorded a run. */
const RUN_GRACE_MS = 30 * 60_000;
/** How early a run may start and still count for its slot (a clock running fast, a manual run). */
const EARLY_MS = 15 * 60_000;

export interface JobRun {
  job: string;
  started_at: string;
  finished_at: string;
  ok: boolean;
  error: string | null;
  request_id: string | null;
}

export type JobState = "ok" | "failed" | "missing" | "stale";

export interface JobHealth {
  job: CronJob;
  state: JobState;
  /** The newest recorded run, successful or not. */
  latest: JobRun | null;
  /** When the newest successful run started. */
  lastSuccessAt: string | null;
  /** The slot a successful run should have started by. */
  dueSince: string;
  /** One line a person can act on. */
  detail: string;
}

function slotOn(dayStart: number, job: ExpectedJob): number {
  return dayStart + (job.hourUtc * 60 + job.minuteUtc) * 60_000;
}

/**
 * The slot a success must cover. For a job judged from outside, its newest
 * slot whose grace has passed. For the running job, the slot before the one
 * it is filling now.
 */
export function dueSlot(job: ExpectedJob, nowMs: number, running = false): number {
  const today = slotOn(Math.floor(nowMs / DAY_MS) * DAY_MS, job);
  if (running) {
    const current = today - EARLY_MS <= nowMs ? today : today - DAY_MS;
    return current - DAY_MS;
  }
  return today + RUN_GRACE_MS <= nowMs ? today : today - DAY_MS;
}

function newest(rows: JobRun[], job: CronJob, ok?: boolean): JobRun | null {
  let best: JobRun | null = null;
  for (const row of rows) {
    if (row.job !== job || (ok !== undefined && row.ok !== ok)) continue;
    if (!best || row.started_at > best.started_at) best = row;
  }
  return best;
}

/** `2026-10-06T14:30:00Z` as `2026-10-06 14:30 UTC`. */
function utcMinute(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * One verdict per expected job. `runs` are recent rows (any outcome);
 * `successes` may add the newest successful row per job when it is older
 * than what `runs` reached.
 */
export function jobHealth(
  runs: JobRun[],
  successes: JobRun[],
  now: string,
  options: { running?: CronJob } = {},
): JobHealth[] {
  const nowMs = Date.parse(now);
  const all = [...runs, ...successes];
  return EXPECTED_JOBS.map((expected) => {
    const running = options.running === expected.job;
    const due = dueSlot(expected, nowMs, running);
    const dueSince = new Date(due).toISOString();
    const latest = newest(all, expected.job);
    const success = newest(all, expected.job, true);
    const base = {
      job: expected.job,
      latest,
      lastSuccessAt: success?.started_at ?? null,
      dueSince,
    };
    if (!latest) {
      return running
        ? { ...base, state: "ok" as const, detail: "first recorded run is this one" }
        : { ...base, state: "missing" as const, detail: "no run recorded yet" };
    }
    if (!latest.ok) {
      return {
        ...base,
        state: "failed" as const,
        detail: `failed at ${utcMinute(latest.started_at)}: ${latest.error ?? "no error recorded"}`,
      };
    }
    if (!success || Date.parse(success.started_at) < due - EARLY_MS) {
      return {
        ...base,
        state: "stale" as const,
        detail: `last succeeded ${success ? utcMinute(success.started_at) : "never"}; a run was due at ${utcMinute(dueSince)}`,
      };
    }
    return { ...base, state: "ok" as const, detail: `ran ${utcMinute(success.started_at)}` };
  });
}
