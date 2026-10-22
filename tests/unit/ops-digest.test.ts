import { describe, expect, it } from "vitest";
import { buildDigest } from "@/lib/ops-digest";
import type { OpsReport } from "@/lib/ops";
import { EXPECTED_JOBS } from "@/lib/job-health";

const ok = { ok: true, detail: "ok" };

type CronRow = OpsReport["cronRuns"][number];
function cronRun(job: string, startedAt: string, ok = true, error: string | null = null): CronRow {
  return {
    job,
    started_at: startedAt,
    finished_at: startedAt,
    ok,
    error,
    request_id: null,
    summary: {},
  };
}
/** Every expected job at its scheduled minute on a day; the digest's own from the day before. */
function onTime(date: string, previous: string): CronRow[] {
  return EXPECTED_JOBS.map((j) =>
    cronRun(
      j.job,
      `${j.job === "ops-digest" ? previous : date}T${String(j.hourUtc).padStart(2, "0")}:${String(j.minuteUtc).padStart(2, "0")}:00Z`,
    ),
  );
}
const quiet: OpsReport = {
  now: "2026-10-06T15:00:00.000Z",
  since: "2026-09-29T15:00:00.000Z",
  health: {
    ok: true,
    at: "2026-10-06T15:00:00.000Z",
    checks: { supabase: ok, stripe: ok, resend: ok, cron: ok, telemetry: ok },
  } as unknown as OpsReport["health"],
  errors: [],
  errorGroups: [],
  emailFailures: [],
  autopayFailures: [],
  stuckPayments: [],
  cronRuns: onTime("2026-10-06", "2026-10-05"),
  cronSuccesses: [],
  activity: [],
  associationNames: { a1: "Maple Court HOA" },
  problems: [],
};

describe("the daily digest", () => {
  it("sends nothing on a quiet weekday", () => {
    const d = buildDigest(quiet, "2026-10-06T15:00:00.000Z", "https://yourhoasis.com/admin");
    expect(d.send).toBe(false);
  });

  it("says all quiet on a quiet Monday", () => {
    const monday = { ...quiet, cronRuns: onTime("2026-10-05", "2026-10-04") };
    const d = buildDigest(monday, "2026-10-05T15:00:00.000Z", "https://yourhoasis.com/admin");
    expect(d.send).toBe(true);
    expect(d.subject).toBe("Your HOAsis: all quiet this week");
  });

  it("lists a failed job, today's errors and a stuck payment, and leaves old errors out", () => {
    const report: OpsReport = {
      ...quiet,
      cronRuns: [
        ...quiet.cronRuns.filter((c) => c.job !== "autopay"),
        cronRun("autopay", "2026-10-06T14:30:00Z", false, "Stripe timed out"),
      ],
      errors: [
        {
          id: "1",
          created_at: "2026-10-06T09:00:00Z",
          reference: "A",
          level: "error",
          source: "server",
          route: "stripe/webhook",
          message: "record_refund failed",
          association_id: "a1",
        },
        {
          id: "2",
          created_at: "2026-10-06T10:00:00Z",
          reference: "B",
          level: "error",
          source: "server",
          route: "stripe/webhook",
          message: "record_refund failed",
          association_id: "a1",
        },
        {
          id: "3",
          created_at: "2026-10-01T10:00:00Z",
          reference: "C",
          level: "error",
          source: "browser",
          route: null,
          message: "old one",
          association_id: null,
        },
      ] as OpsReport["errors"],
      stuckPayments: [
        {
          id: "p",
          created_at: "2026-09-29T00:00:00Z",
          association_id: "a1",
          unit_id: "u",
          amount_cents: 28500,
          rail: "ach",
          stripe_payment_intent_id: "pi_1",
        },
      ],
    };
    const d = buildDigest(report, "2026-10-06T15:00:00.000Z", "https://yourhoasis.com/admin");
    expect(d.send).toBe(true);
    expect(d.subject).toBe("Your HOAsis: 3 things to look at");
    expect(d.text).toContain("autopay failed: failed at 2026-10-06 14:30 UTC: Stripe timed out");
    expect(d.text).toContain("2 × record_refund failed");
    expect(d.text).not.toContain("old one");
    expect(d.text).toContain("Maple Court HOA: $285.00 by ach");
    expect(d.text).toContain("https://yourhoasis.com/admin");
  });

  it("never says all quiet while an expected job is missing, stale or failed", () => {
    const monday = "2026-10-05T15:00:00.000Z";
    const healthy = onTime("2026-10-05", "2026-10-04");
    const cases: [string, CronRow[], string][] = [
      [
        "missing",
        healthy.filter((c) => c.job !== "email-bills"),
        "email-bills missing: no run recorded yet",
      ],
      [
        "stale",
        [
          ...healthy.filter((c) => c.job !== "billing-sweep"),
          cronRun("billing-sweep", "2026-10-04T14:00:00Z"),
        ],
        "billing-sweep stale: last succeeded 2026-10-04 14:00 UTC; a run was due at 2026-10-05 14:00 UTC",
      ],
      [
        "failed",
        [
          ...healthy.filter((c) => c.job !== "assessments"),
          cronRun("assessments", "2026-10-05T13:00:00Z", false, "late fees failed"),
        ],
        "assessments failed: failed at 2026-10-05 13:00 UTC: late fees failed",
      ],
    ];
    for (const [, cronRuns, line] of cases) {
      const d = buildDigest({ ...quiet, cronRuns }, monday, "https://yourhoasis.com/admin");
      expect(d.send).toBe(true);
      expect(d.subject).toBe("Your HOAsis: 1 thing to look at");
      expect(d.text).toContain("Daily jobs that did not run cleanly");
      expect(d.text).toContain(`- ${line}`);
      expect(d.text).not.toContain("all quiet");
    }
  });

  it("does not report itself on its first run, and does report a lost heartbeat", () => {
    const first = quiet.cronRuns.filter((c) => c.job !== "ops-digest");
    expect(buildDigest({ ...quiet, cronRuns: first }, quiet.now, "u").send).toBe(false);
    const lost = [...first, cronRun("ops-digest", "2026-10-02T15:00:00Z")];
    const d = buildDigest({ ...quiet, cronRuns: lost }, quiet.now, "u");
    expect(d.send).toBe(true);
    expect(d.text).toContain(
      "- ops-digest stale: last succeeded 2026-10-02 15:00 UTC; a run was due at 2026-10-05 15:00 UTC",
    );
  });

  it("says all quiet only when every expected job ran, not when nothing was read", () => {
    const d = buildDigest(
      { ...quiet, cronRuns: [], problems: ["cron_runs: permission denied"] },
      "2026-10-05T15:00:00.000Z",
      "u",
    );
    expect(d.subject).not.toContain("all quiet");
    expect(d.text).toContain("assessments missing");
    expect(d.text).toContain("cron_runs: permission denied");
  });
});
