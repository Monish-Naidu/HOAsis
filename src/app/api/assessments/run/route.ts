import { NextResponse, type NextRequest } from "next/server";
import { duesToIssue, type DuesCadence } from "@/lib/payments/assessments";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * The daily dues run.
 *
 * Vercel calls this each morning before the autopay run, with CRON_SECRET.
 * For every live association it asks duesToIssue whether a period fell due
 * today (or in the last week, if a day was missed) and, if so, bills every
 * home through issue_assessment, which refuses to bill the same due date
 * twice. Nothing else here writes anything. Add ?dry=1 to see what would go.
 */
export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not for you" }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const today = new Date().toISOString().slice(0, 10);
  const admin = supabaseAdmin();

  const { data: rows, error } = await admin
    .from("associations")
    .select("id, name, dues_cents, dues_cadence, due_day, fiscal_year_start, created_at")
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report = { today, dryRun, checked: 0, billed: [] as string[], quiet: [] as string[], errors: [] as string[] };

  for (const a of rows ?? []) {
    report.checked++;
    const period = duesToIssue({
      cadence: a.dues_cadence as DuesCadence,
      dueDay: a.due_day,
      fiscalYearStart: a.fiscal_year_start,
      today,
      duesCents: a.dues_cents,
      since: a.created_at,
    });
    if (!period) {
      report.quiet.push(a.name);
      continue;
    }
    if (dryRun) {
      report.billed.push(`${a.name}: would bill ${period.label} due ${period.dueOn}`);
      continue;
    }
    const { data: count, error: issueError } = await admin.rpc("issue_assessment", {
      p_association_id: a.id,
      p_label: period.label,
      p_due_on: period.dueOn,
    });
    if (issueError) {
      report.errors.push(`${a.name}: ${issueError.message}`);
      continue;
    }
    report.billed.push(`${a.name}: ${period.label} due ${period.dueOn}, ${count} homes`);
  }

  return NextResponse.json(report);
}
