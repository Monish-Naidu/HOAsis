import { NextResponse, type NextRequest } from "next/server";
import { duesToIssue, type DuesCadence } from "@/lib/payments/assessments";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CRON_BUDGET_MS, cronPlan, scheduleContinuation, walkPages } from "@/lib/cron";
import { logger } from "@/lib/log";
import { recordCronRun } from "@/lib/cron-runs";

/**
 * The daily dues run.
 *
 * Vercel calls this each morning before the autopay run, with CRON_SECRET.
 * For every live association it asks duesToIssue whether a period fell due
 * today (or in the last week, if a day was missed) and, if so, bills every
 * home through issue_assessment, which refuses to bill the same due date
 * twice. Nothing else here writes anything. Add ?dry=1 to see what would go.
 *
 * Associations are walked in id order a page at a time with a time budget
 * (src/lib/cron.ts); a run that cannot finish answers with `next` and
 * continues itself with ?after=<id>.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const log = logger("assessments/run", request);
  const startedAt = Date.now();
  if (!authorized(request)) {
    log.warn("unauthorized");
    return NextResponse.json({ error: "Not for you", reference: log.requestId }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const today = new Date().toISOString().slice(0, 10);
  const admin = supabaseAdmin();

  const plan = cronPlan(request, { budgetMs: CRON_BUDGET_MS });
  const report = {
    today, dryRun, checked: 0, billed: [] as string[], quiet: [] as string[], lateFees: [] as string[], errors: [] as string[],
    complete: true, next: null as string | null,
  };

  const walk = await walkPages(
    plan,
    (after, limit) => {
      let query = admin
        .from("associations")
        .select("id, name, dues_cents, dues_cadence, due_day, fiscal_year_start, created_at, billing_starts_on")
        .is("deleted_at", null)
        .order("id")
        .limit(limit);
      if (after) query = query.gt("id", after);
      return query;
    },
    async (a) => {
      report.checked++;
      // Late fees first, on yesterday's books: a dues line past the
      // policy's notice day and still unpaid gets its one fee, whether or
      // not anything new is billed today. Skipped on a dry run.
      if (!dryRun) {
        const { data: fees, error: feeError } = await admin.rpc("assess_late_fees", {
          p_association_id: a.id,
          p_today: today,
        });
        if (feeError) {
          log.error("assess_late_fees failed", { associationId: a.id, err: feeError.message });
          report.errors.push(`${a.name}: late fees: ${feeError.message}`);
        } else if (fees) {
          report.lateFees.push(`${a.name}: ${fees} late ${fees === 1 ? "fee" : "fees"}`);
        }
      }
      const period = duesToIssue({
        cadence: a.dues_cadence as DuesCadence,
        dueDay: a.due_day,
        fiscalYearStart: a.fiscal_year_start,
        today,
        duesCents: a.dues_cents,
        // Books start when the board said they do, which for an imported
        // association is later than the row was created.
        since: a.billing_starts_on ?? a.created_at,
      });
      if (!period) {
        report.quiet.push(a.name);
        return;
      }
      if (dryRun) {
        report.billed.push(`${a.name}: would bill ${period.label} due ${period.dueOn}`);
        return;
      }
      const { data: count, error: issueError } = await admin.rpc("issue_assessment", {
        p_association_id: a.id,
        p_label: period.label,
        p_due_on: period.dueOn,
      });
      if (issueError) {
        log.error("issue_assessment failed", { associationId: a.id, err: issueError.message });
        report.errors.push(`${a.name}: ${issueError.message}`);
        return;
      }
      report.billed.push(`${a.name}: ${period.label} due ${period.dueOn}, ${count} homes`);
    },
  );

  const summary = {
    checked: report.checked, billed: report.billed.length, quiet: report.quiet.length, lateFees: report.lateFees.length,
    errors: report.errors.length, complete: walk.complete, after: plan.after, dryRun,
  };
  if (walk.error) {
    log.error("assessments run failed", { err: walk.error, ...summary });
    if (!dryRun) await recordCronRun({ job: "assessments", requestId: log.requestId, startedAt, ok: false, summary, error: walk.error });
    return NextResponse.json({ error: walk.error, reference: log.requestId, ...report }, { status: 500 });
  }
  if (!walk.complete && walk.last) {
    report.complete = false;
    report.next = walk.last;
    if (!dryRun) scheduleContinuation(request, plan.continuation(walk.last));
  }
  log.info("assessments run finished", summary);
  if (!dryRun) await recordCronRun({ job: "assessments", requestId: log.requestId, startedAt, ok: report.errors.length === 0, summary });

  return NextResponse.json(report);
}
