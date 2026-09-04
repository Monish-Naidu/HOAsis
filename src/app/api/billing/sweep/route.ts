import { NextResponse, type NextRequest } from "next/server";
import { trialNoticeDue } from "@/lib/billing";
import { sendTrialNotice } from "@/lib/email/trial";
import { PRICE_PER_HOME_CENTS } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabase/server";

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
  const origin = request.nextUrl.origin;
  const admin = supabaseAdmin();

  const { data: rows, error } = await admin
    .from("associations")
    .select("id, name, trial_ends_at, subscription_status, billing_notices, billing_email")
    .is("deleted_at", null)
    .is("billing_subscription_id", null)
    .in("subscription_status", ["trialing", "ended"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report = { checked: 0, sent: [] as string[], ended: [] as string[], errors: [] as string[] };

  for (const row of rows ?? []) {
    report.checked++;
    const endsOn = row.trial_ends_at.slice(0, 10);

    // Past the date, not yet marked. The banner already says so; this makes
    // the row agree with it.
    if (endsOn <= today && row.subscription_status === "trialing" && !dryRun) {
      await admin.from("associations").update({ subscription_status: "ended" }).eq("id", row.id);
      report.ended.push(row.name);
    }

    const due = trialNoticeDue(endsOn, today, row.billing_notices ?? []);
    if (!due) continue;

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
      continue;
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
        billingUrl: `${origin}/board/settings`,
      },
    });

    if (!result.ok) {
      report.errors.push(`${row.name}: ${result.error}`);
      continue;
    }
    report.sent.push(`${row.name}: ${due.send}`);
    if (!dryRun) {
      await admin
        .from("associations")
        .update({ billing_notices: Array.from(new Set([...(row.billing_notices ?? []), ...due.markSent])) })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ today, dryRun, ...report });
}
