import { NextResponse, type NextRequest } from "next/server";
import { trialNoticeDue } from "@/lib/billing";
import { sendTrialNotice } from "@/lib/email/trial";
import { PRICE_PER_HOME_CENTS } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { quantityWalkUrl, syncSubscriptionQuantity } from "@/lib/stripe/subscription-quantity";
import { CRON_BUDGET_MS, cronPlan, scheduleContinuation, walkPages } from "@/lib/cron";
import { communityPath } from "@/lib/community-links";
import { logger } from "@/lib/log";
import { recordCronRun } from "@/lib/cron-runs";

/**
 * The daily pass over every association's trial.
 *
 * Vercel calls this once a day (vercel.json) with the CRON_SECRET it was
 * given, and nothing else may. For each live association without a
 * subscription it does two things and no more: sends the one trial notice
 * that is due today (fourteen days out, three days out, or the day itself),
 * and moves a trial that has run out to 'ended'. Locking the board after the
 * grace period is not a state; the banner and the gate read the date.
 *
 * Idempotent by construction: every notice sent is recorded on the row, and
 * 'ended' set twice is 'ended'. Add ?dry=1 to see what would go out.
 *
 * Associations are walked in id order a page at a time with a time budget
 * (src/lib/cron.ts); a run that cannot finish answers with `next` and
 * continues itself with ?after=<id>.
 *
 * Once the trials are done, a second pass visits every association that has
 * a subscription and sets its quantity to the number of homes on the roster
 * (src/lib/stripe/subscription-quantity.ts). It shares the same time budget
 * and continues itself with ?walk=quantity&after=<id>, so its cursor is never
 * mistaken for the trial pass's.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const log = logger("billing/sweep", request);
  const startedAt = Date.now();
  if (!authorized(request)) {
    log.warn("unauthorized");
    return NextResponse.json({ error: "Not for you", reference: log.requestId }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const today = new Date().toISOString().slice(0, 10);
  const origin = request.nextUrl.origin;
  const admin = supabaseAdmin();

  const plan = cronPlan(request, { budgetMs: CRON_BUDGET_MS });
  // A continuation of the quantity pass. The trials were finished by the
  // call that started it.
  const quantityOnly = request.nextUrl.searchParams.get("walk") === "quantity";
  const report = {
    checked: 0, sent: [] as string[], ended: [] as string[], errors: [] as string[],
    subscriptions: 0, quantities: [] as string[],
    complete: true, next: null as string | null, walk: quantityOnly ? "quantity" : "trials",
  };

  const walk = quantityOnly ? { complete: true, last: null as string | null, error: undefined } : await walkPages(
    plan,
    (after, limit) => {
      let query = admin
        .from("associations")
        .select("id, name, slug, trial_ends_at, subscription_status, billing_notices, billing_email")
        .is("deleted_at", null)
        .is("billing_subscription_id", null)
        .in("subscription_status", ["trialing", "ended"])
        .order("id")
        .limit(limit);
      if (after) query = query.gt("id", after);
      return query;
    },
    async (row) => {
      report.checked++;
      const endsOn = row.trial_ends_at.slice(0, 10);

      // Past the date, not yet marked. The banner already says so; this makes
      // the row agree with it.
      if (endsOn <= today && row.subscription_status === "trialing" && !dryRun) {
        await admin.from("associations").update({ subscription_status: "ended" }).eq("id", row.id);
        report.ended.push(row.name);
      }

      const due = trialNoticeDue(endsOn, today, row.billing_notices ?? []);
      if (!due) return;

      // The sitting President, who is the person the subscription belongs to.
      const { data: president } = await admin
        .from("memberships")
        .select("full_name, profile_id")
        .eq("association_id", row.id)
        .eq("role", "president")
        .is("ends_on", null)
        .maybeSingle();
      const { data: profile } = president?.profile_id
        ? await admin.from("profiles").select("email").eq("id", president.profile_id).maybeSingle()
        : { data: null };
      const to = profile?.email ?? row.billing_email;
      if (!to) {
        report.errors.push(`${row.name}: no President email`);
        return;
      }

      const { count } = await admin
        .from("units")
        .select("*", { count: "exact", head: true })
        .eq("association_id", row.id);
      const homes = count ?? 0;

      const result = await sendTrialNotice({
        associationId: row.id,
        kind: due.send,
        to,
        profileId: president?.profile_id ?? null,
        dryRun,
        message: {
          associationName: row.name,
          presidentName: president?.full_name || "President",
          trialEndsOn: endsOn,
          homes,
          monthlyCents: homes * PRICE_PER_HOME_CENTS,
          billingUrl: `${origin}${communityPath(row.slug, "/board/settings")}`,
        },
      });

      if (!result.ok) {
        log.error("trial notice failed", { associationId: row.id, kind: due.send, err: result.error });
        report.errors.push(`${row.name}: ${result.error}`);
        return;
      }
      report.sent.push(`${row.name}: ${due.send}`);
      if (!dryRun) {
        await admin
          .from("associations")
          .update({ billing_notices: Array.from(new Set([...(row.billing_notices ?? []), ...due.markSent])) })
          .eq("id", row.id);
      }
    },
  );

  // The second pass: what Stripe bills for follows the roster. Only once the
  // trials are finished, and inside whatever is left of the same budget.
  const quantityWalk =
    walk.error || !walk.complete
      ? null
      : await walkPages(
          quantityOnly ? plan : { ...plan, after: null },
          (after, limit) => {
            let query = admin
              .from("associations")
              .select("id, name, billing_subscription_id")
              .is("deleted_at", null)
              .not("billing_subscription_id", "is", null)
              .order("id")
              .limit(limit);
            if (after) query = query.gt("id", after);
            return query;
          },
          async (row) => {
            if (!row.billing_subscription_id) return;
            report.subscriptions++;
            const { count, error: countError } = await admin
              .from("units")
              .select("*", { count: "exact", head: true })
              .eq("association_id", row.id);
            // A count that did not come back is not zero homes. Billing one
            // home because the database blinked would be its own bug.
            if (countError || count === null) {
              report.errors.push(`${row.name}: could not count the homes`);
              return;
            }
            try {
              const synced = await syncSubscriptionQuantity(stripe().subscriptions, {
                subscriptionId: row.billing_subscription_id,
                homes: count,
                dryRun,
              });
              if (synced.outcome === "changed") {
                log.info("subscription quantity changed", { associationId: row.id, from: synced.from, to: synced.to, dryRun });
                report.quantities.push(`${row.name}: ${synced.from ?? "none"} to ${synced.to}`);
              }
            } catch (caught) {
              const message = caught instanceof Error ? caught.message : "unknown error";
              log.error("subscription quantity failed", { associationId: row.id, err: message });
              report.errors.push(`${row.name}: ${message}`);
            }
          },
        );

  const failure = walk.error ?? quantityWalk?.error;
  const summary = {
    checked: report.checked, sent: report.sent.length, ended: report.ended.length,
    subscriptions: report.subscriptions, quantities: report.quantities.length,
    errors: report.errors.length, complete: walk.complete && Boolean(quantityWalk?.complete),
    walk: report.walk, after: plan.after, dryRun,
  };
  if (failure) {
    log.error("billing sweep failed", { err: failure, ...summary });
    if (!dryRun) await recordCronRun({ job: "billing-sweep", requestId: log.requestId, startedAt, ok: false, summary, error: failure });
    return NextResponse.json({ error: failure, reference: log.requestId, today, dryRun, ...report }, { status: 500 });
  }
  if (!walk.complete && walk.last) {
    report.complete = false;
    report.next = walk.last;
    if (!dryRun) scheduleContinuation(request, plan.continuation(walk.last));
  } else if (quantityWalk && !quantityWalk.complete) {
    report.complete = false;
    report.walk = "quantity";
    report.next = quantityWalk.last;
    if (!dryRun) scheduleContinuation(request, quantityWalkUrl(request.nextUrl.toString(), quantityWalk.last));
  }
  log.info("billing sweep finished", summary);
  if (!dryRun) await recordCronRun({ job: "billing-sweep", requestId: log.requestId, startedAt, ok: report.errors.length === 0, summary });

  return NextResponse.json({ today, dryRun, ...report });
}
