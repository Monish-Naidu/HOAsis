import { describe, expect, it } from "vitest";
import { buildDigest } from "@/lib/ops-digest";
import type { OpsReport } from "@/lib/ops";

const ok = { ok: true, detail: "ok" };
const quiet: OpsReport = {
  now: "2026-10-06T15:00:00.000Z",
  since: "2026-09-29T15:00:00.000Z",
  health: { ok: true, at: "2026-10-06T15:00:00.000Z", checks: { supabase: ok, stripe: ok, resend: ok, cron: ok, sentry: ok } } as unknown as OpsReport["health"],
  errors: [],
  errorGroups: [],
  emailFailures: [],
  autopayFailures: [],
  stuckPayments: [],
  cronRuns: [
    { job: "assessments", started_at: "2026-10-06T13:00:00Z", finished_at: "2026-10-06T13:00:04Z", ok: true, error: null, request_id: null, summary: {} },
  ],
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
    const d = buildDigest(quiet, "2026-10-05T15:00:00.000Z", "https://yourhoasis.com/admin");
    expect(d.send).toBe(true);
    expect(d.subject).toBe("Your HOAsis: all quiet this week");
  });

  it("lists a failed job, today's errors and a stuck payment, and leaves old errors out", () => {
    const report: OpsReport = {
      ...quiet,
      cronRuns: [{ job: "autopay", started_at: "2026-10-06T14:30:00Z", finished_at: "2026-10-06T14:30:09Z", ok: false, error: "Stripe timed out", request_id: null, summary: {} }],
      errors: [
        { id: "1", created_at: "2026-10-06T09:00:00Z", reference: "A", level: "error", source: "server", route: "stripe/webhook", message: "record_refund failed", association_id: "a1" },
        { id: "2", created_at: "2026-10-06T10:00:00Z", reference: "B", level: "error", source: "server", route: "stripe/webhook", message: "record_refund failed", association_id: "a1" },
        { id: "3", created_at: "2026-10-01T10:00:00Z", reference: "C", level: "error", source: "browser", route: null, message: "old one", association_id: null },
      ] as OpsReport["errors"],
      stuckPayments: [{ id: "p", created_at: "2026-09-29T00:00:00Z", association_id: "a1", unit_id: "u", amount_cents: 28500, rail: "ach", stripe_payment_intent_id: "pi_1" }],
    };
    const d = buildDigest(report, "2026-10-06T15:00:00.000Z", "https://yourhoasis.com/admin");
    expect(d.send).toBe(true);
    expect(d.subject).toBe("Your HOAsis: 3 things to look at");
    expect(d.text).toContain("autopay: Stripe timed out");
    expect(d.text).toContain("2 × record_refund failed");
    expect(d.text).not.toContain("old one");
    expect(d.text).toContain("Maple Court HOA: $285.00 by ach");
    expect(d.text).toContain("https://yourhoasis.com/admin");
  });
});
