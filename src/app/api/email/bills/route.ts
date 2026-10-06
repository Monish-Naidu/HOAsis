import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CRON_BUDGET_MS, cronPlan, scheduleContinuation, walkPages } from "@/lib/cron";
import { logger } from "@/lib/log";
import { recordCronRun } from "@/lib/cron-runs";
import { sendDuesEmails } from "@/lib/email/send";
import { createPacer } from "@/lib/email/pace";
import { BROUGHT_FORWARD_LABEL, dueABillEmail } from "@/lib/email/bill-run";
import { DAY_MS } from "@/lib/utils";

/**
 * The daily bill email.
 *
 * Vercel calls this at 13:30 UTC with CRON_SECRET, half an hour after the
 * billing run (/api/assessments/run) has posted the day's dues and before
 * the sweep. For each association that had a dues bill posted today and has
 * not turned the email off, it sends the assessment email through
 * sendDuesEmails, the same path the board's dues mailer uses. That path is
 * paced, writes email_log, and passes over anybody who got the same subject
 * in the last hour, so a call repeated inside the hour mails nobody twice.
 *
 * Associations are walked in id order with a time budget (src/lib/cron.ts).
 * One big association gets only what is left of the budget, and if its send
 * stops there the continuation starts again at that association rather than
 * after it, so the people not reached are reached.
 *
 * ?dry=1 sends and records nothing and answers with `wouldMail`, the
 * associations and addresses a real run would write to.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const log = logger("email/bills", request);
  const startedAt = Date.now();
  if (!authorized(request)) {
    log.warn("unauthorized");
    return NextResponse.json({ error: "Not for you", reference: log.requestId }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  const admin = supabaseAdmin();

  const plan = cronPlan(request, { budgetMs: CRON_BUDGET_MS });
  const report = {
    today, dryRun, checked: 0,
    mailed: [] as string[], quiet: [] as string[], optedOut: [] as string[], errors: [] as string[],
    /** Dry run only: the association and the addresses a real run would write to. */
    wouldMail: [] as { association: string; dueOn: string; recipients: { email: string; unit: string }[] }[],
    complete: true, next: null as string | null,
  };

  // The association before the one being visited. A send that stops at the
  // time limit resumes from here, so it is visited again and not skipped.
  let previousId: string | null = plan.after;
  let unfinished = false;

  const walk = await walkPages(
    plan,
    (after, limit) => {
      let query = admin
        .from("associations")
        .select("id, name, bills_by_email")
        .is("deleted_at", null)
        .order("id")
        .limit(limit);
      if (after) query = query.gt("id", after);
      return query;
    },
    async (a) => {
      // The walk can take one more row after a send stopped at the limit
      // when its own clock reads a few milliseconds behind the pacer's.
      if (unfinished) return;
      report.checked++;
      const visitedAfter = previousId;
      previousId = a.id;
      // Only dues bills posted today. The brought forward line is a carried
      // balance and not a bill, so it is left out in the query as well as
      // by the rule, which keeps the page small.
      const { data: rows, error: readError } = await admin
        .from("charges")
        .select("category, kind, label, due_on, created_at")
        .eq("association_id", a.id)
        .eq("category", "dues")
        .eq("kind", "charge")
        .neq("label", BROUGHT_FORWARD_LABEL)
        .gte("created_at", `${today}T00:00:00Z`)
        .lt("created_at", `${tomorrow}T00:00:00Z`)
        .limit(1000);
      if (readError) {
        log.error("reading today's bills failed", { associationId: a.id, err: readError.message });
        report.errors.push(`${a.name}: ${readError.message}`);
        return;
      }
      if ((rows ?? []).length > 0 && a.bills_by_email === false) {
        report.optedOut.push(a.name);
        return;
      }
      const due = dueABillEmail(a, rows ?? [], today);
      if (!due) {
        report.quiet.push(a.name);
        return;
      }

      // What is left of this call's budget, so one big association cannot
      // use the time that the rest of the list is waiting on.
      const budgetMs = Math.max(1_000, CRON_BUDGET_MS - (Date.now() - startedAt));
      try {
        const result = await sendDuesEmails({
          associationId: a.id,
          associationName: a.name,
          category: "assessment",
          dueDate: due.dueOn,
          origin: request.nextUrl.origin,
          dryRun,
          pacer: createPacer({ budgetMs }),
        });
        if (dryRun) {
          report.wouldMail.push({ association: a.name, dueOn: due.dueOn, recipients: result.would ?? [] });
        }
        report.mailed.push(
          `${a.name}: ${dryRun ? "would send" : "sent"} ${result.sent}, already ${result.already}, skipped ${result.skipped}, failed ${result.failed}`,
        );
        for (const message of result.errors.slice(0, 5)) report.errors.push(`${a.name}: ${message}`);
        if (result.unrecorded) log.error("bill email record not saved", { associationId: a.id, err: result.unrecorded });
        // Stopped at the budget with people left: finish them in the next call.
        if (result.remaining > 0) {
          unfinished = true;
          previousId = visitedAfter;
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "unknown error";
        log.error("bill email failed", { associationId: a.id, err: message });
        report.errors.push(`${a.name}: ${message}`);
      }
    },
  );

  const summary = {
    checked: report.checked, mailed: report.mailed.length, optedOut: report.optedOut.length,
    quiet: report.quiet.length, errors: report.errors.length, complete: walk.complete && !unfinished,
    after: plan.after, dryRun,
  };
  if (walk.error) {
    log.error("bill emails run failed", { err: walk.error, ...summary });
    if (!dryRun) await recordCronRun({ job: "email-bills", requestId: log.requestId, startedAt, ok: false, summary, error: walk.error });
    return NextResponse.json({ error: walk.error, reference: log.requestId, ...report }, { status: 500 });
  }
  if (unfinished || (!walk.complete && walk.last)) {
    report.complete = false;
    // An unfinished association resumes from the one before it. With none
    // before it that is the top of the list, which only revisits what has
    // been sent and passes over it.
    const resumeFrom = unfinished ? previousId : walk.last;
    report.next = resumeFrom;
    if (!dryRun) {
      let url: string;
      if (resumeFrom) {
        url = plan.continuation(resumeFrom);
      } else {
        const top = new URL(request.nextUrl.toString());
        top.searchParams.delete("after");
        url = top.toString();
      }
      scheduleContinuation(request, url);
    }
  }
  log.info("bill emails run finished", summary);
  if (!dryRun) await recordCronRun({ job: "email-bills", requestId: log.requestId, startedAt, ok: report.errors.length === 0, summary });

  return NextResponse.json(report);
}
