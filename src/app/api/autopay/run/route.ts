import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { sendAutopayNotice } from "@/lib/email/autopay";
import {
  decideAutopay,
  isChargeable,
  mayRetryAutopay,
  NO_CHARGEABLE_METHOD,
  pendingSince,
} from "@/lib/payments/autopay";
import {
  describeInstrument,
  type PaymentInstrument,
} from "@/lib/payments/instruments";
import { costFor, stripe } from "@/lib/stripe/server";
import { currentMemberIds, savedByCurrentMember } from "@/lib/stripe/saved-method-owner";
import { LOCKED_REASON, rowLocked } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AutopayPlan } from "@/lib/types";
import { duesFor } from "@/lib/home-types";
import {
  CRON_BUDGET_MS,
  cronPlan,
  scheduleContinuation,
  walkPages,
} from "@/lib/cron";
import { communityPath } from "@/lib/community-links";
import { logger } from "@/lib/log";
import { recordCronRun } from "@/lib/cron-runs";

/**
 * The daily autopay pass.
 *
 * Vercel calls this once a day with CRON_SECRET, after the billing sweep. For
 * every current membership with a plan it asks decideAutopay what today means
 * for that home, and acts on a "charge" or a "skip" by writing one
 * autopay_runs row for the month and, for a charge, confirming an off-session
 * PaymentIntent on the association's connected account with the saved method.
 *
 * The row goes in before Stripe is called and the unique key on (unit, month)
 * is what makes a second run of the same day a no-op: if the insert conflicts,
 * this month is already decided. Settlement is the webhook's business, exactly
 * as it is for a payment the owner made by hand; the intent carries the same
 * metadata, so record_payment cannot tell the two apart and does not need to.
 *
 * Add ?dry=1 to see what would happen without a row or a charge.
 *
 * Memberships are walked in id order a page at a time with a time budget
 * (src/lib/cron.ts); a run that cannot finish answers with `next` and
 * continues itself with ?after=<id>. Each home's month is claimed by the
 * unique (unit, month) row, so a page seen twice charges nobody twice.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

type Report = {
  checked: number;
  charged: string[];
  skipped: string[];
  failed: string[];
  waiting: string[];
  errors: string[];
  complete: boolean;
  next: string | null;
};

export async function GET(request: NextRequest) {
  const log = logger("autopay/run", request);
  const startedAt = Date.now();
  if (!authorized(request)) {
    log.warn("unauthorized");
    return NextResponse.json({ error: "Not for you", reference: log.requestId }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const origin = request.nextUrl.origin;
  const admin = supabaseAdmin();
  const report: Report = {
    checked: 0,
    charged: [],
    skipped: [],
    failed: [],
    waiting: [],
    errors: [],
    complete: true,
    next: null,
  };
  const run = cronPlan(request, { budgetMs: CRON_BUDGET_MS });

  const walk = await walkPages(
    run,
    (after, limit) => {
      let query = admin
        .from("memberships")
        .select(
          "id, unit_id, association_id, profile_id, full_name, invited_email, autopay",
        )
        .not("autopay", "is", null)
        .is("ends_on", null)
        .order("id")
        .limit(limit);
      if (after) query = query.gt("id", after);
      return query;
    },
    async (member) => {
      report.checked++;
      const plan = member.autopay as AutopayPlan | null;
      if (!plan || typeof plan.day !== "number") return;
      const tag = `${member.full_name} (${member.unit_id.slice(0, 8)})`;

      try {
        const [
          { data: association },
          { data: unit },
          { data: balance },
          { data: existing },
          { data: pending, error: pendingError },
        ] = await Promise.all([
          admin
            .from("associations")
            .select(
              "id, name, slug, stripe_account_id, stripe_charges_enabled, dues_cents, dues_by_type, deleted_at, subscription_status, past_due_since, trial_ends_at, billing_subscription_id",
            )
            .eq("id", member.association_id)
            .single(),
          admin
            .from("units")
            .select("stripe_customer_id, label, home_type, dues_cents")
            .eq("id", member.unit_id)
            .single(),
          // The service role is not "somebody", so unit_balances' security
          // invoker would answer nothing. Sum the charges directly, the same
          // way the view does.
          admin
            .from("charges")
            .select("amount_cents")
            .eq("unit_id", member.unit_id)
            .lte("due_on", today),
          admin
            .from("autopay_runs")
            .select("id, state, attempts, last_attempt_on, reason, created_at")
            .eq("unit_id", member.unit_id)
            .eq("month", month)
            .maybeSingle(),
          // Money on its way. A bank payment is only a pending row until it
          // settles, days later, so the charges above still show it as owed.
          // Recent rows only: one left behind by a missed failure event must
          // not keep this home out of autopay for good.
          admin
            .from("payments")
            .select("amount_cents")
            .eq("unit_id", member.unit_id)
            .eq("state", "pending")
            .gte("created_at", pendingSince(today)),
        ]);

        // This month is already decided, unless it failed: a failed month
        // may be tried again once the owner has fixed something, which is
        // judged below when the methods on file are known.
        if (existing && existing.state !== "failed") return;
        // Not knowing what is in flight is not the same as nothing being in
        // flight. Leave the home for tomorrow rather than risk a second pull.
        if (pendingError) throw new Error(`Could not read pending payments: ${pendingError.message}`);
        if (
          !association ||
          association.deleted_at ||
          !association.stripe_account_id
        ) {
          report.waiting.push(`${tag}: no online payments`);
          return;
        }
        // The board stopped paying us: nothing is charged, and no row is
        // written, so the home is asked again once the subscription is paid.
        if (rowLocked(association, today)) {
          report.waiting.push(`${tag}: ${LOCKED_REASON}`);
          return;
        }
        // Stripe has the association's account paused or not yet approved.
        // A charge now would fail for a reason the owner cannot fix, and the
        // email would blame their card. No row is written, so the home is
        // asked again every day until the board has sorted it out.
        if (!association.stripe_charges_enabled) {
          report.waiting.push(`${tag}: online payments are paused`);
          return;
        }

        const balanceCents = (balance ?? []).reduce(
          (sum, c) => sum + c.amount_cents,
          0,
        );
        const pendingCents = (pending ?? []).reduce(
          (sum, p) => sum + p.amount_cents,
          0,
        );
        const decision = decideAutopay({
          plan,
          today,
          balanceCents,
          pendingCents,
          // What this home pays, as issue_assessment billed it: its own
          // amount, else its kind's, else the association's.
          duesCents: duesFor(
            {
              duesCents: association.dues_cents,
              duesByType: (association.dues_by_type ?? {}) as Record<
                string,
                number
              >,
            },
            unit?.home_type ?? undefined,
            unit?.dues_cents ?? undefined,
          ),
        });

        if (decision.action === "wait") {
          report.waiting.push(`${tag}: ${decision.reason}`);
          return;
        }

        if (decision.action === "skip") {
          report.skipped.push(`${tag}: ${decision.reason}`);
          if (!dryRun && !existing) {
            await admin.from("autopay_runs").insert({
              association_id: association.id,
              unit_id: member.unit_id,
              month,
              state: "skipped",
              reason: decision.reason,
            });
          }
          return;
        }

        // The method: the one the plan named, else the home's default, and
        // only if Stripe can charge it without the owner present. Only a
        // method saved by somebody who still holds the home counts: after a
        // sale the seller's bank is still on the home's list, and falling
        // back to it would debit a person who moved away. A read that fails
        // throws, and the home is left for tomorrow.
        const { data: instruments } = await admin
          .from("payment_instruments")
          .select("*")
          .eq("unit_id", member.unit_id)
          .order("is_default", { ascending: false });
        const holders = await currentMemberIds(admin, member.unit_id);
        const candidates = (instruments ?? [])
          .filter((i) => savedByCurrentMember(i.profile_id, holders))
          .map(
            (i) =>
              ({
                ...((i.detail as object) ?? {}),
                id: i.id,
                ownerId: i.unit_id,
                kind: i.kind,
                label: i.label,
                mask: i.mask,
                isDefault: i.is_default,
                addedDate: i.added_on,
              }) as PaymentInstrument,
          );
        const instrument =
          candidates.find(
            (i) => i.id === plan.instrumentId && isChargeable(i),
          ) ?? candidates.find((i) => isChargeable(i));
        const email = member.invited_email ?? null;

        // A second try at a month that failed, and only with a reason to
        // expect a different answer. Otherwise the failed row stands and
        // nobody is emailed again.
        if (
          existing &&
          !mayRetryAutopay({
            run: {
              state: existing.state,
              attempts: existing.attempts,
              lastAttemptOn: existing.last_attempt_on ?? existing.created_at.slice(0, 10),
              reason: existing.reason,
            },
            today,
            chargeableAddedOn: candidates.filter((i) => isChargeable(i)).map((i) => i.addedDate),
          })
        ) {
          return;
        }

        if (!instrument || !unit?.stripe_customer_id) {
          // Already recorded and already said, the first time.
          if (existing) return;
          const reason = NO_CHARGEABLE_METHOD;
          report.failed.push(`${tag}: ${reason}`);
          log.warn("autopay skipped, nothing chargeable", { associationId: association.id, unitId: member.unit_id, month });
          if (dryRun) return;
          await admin.from("autopay_runs").insert({
            association_id: association.id,
            unit_id: member.unit_id,
            month,
            state: "failed",
            amount_cents: decision.amountCents,
            reason,
            last_attempt_on: today,
          });
          if (email) {
            await sendAutopayNotice({
              associationId: association.id,
              unitId: member.unit_id,
              profileId: member.profile_id,
              to: email,
              kind: "failed",
              message: {
                associationName: association.name,
                ownerName: member.full_name,
                amountCents: decision.amountCents,
                method: "The saved payment method",
                problem: "it is missing or still verifying",
                payUrl: `${origin}${communityPath(association.slug, "/resident/pay")}`,
              },
            });
          }
          return;
        }

        const rail = instrument.kind === "ach" ? "ach" : "card";
        const cost = costFor(rail, decision.amountCents);
        const method = describeInstrument(instrument);

        if (dryRun) {
          report.charged.push(
            `${tag}: would charge ${cost.residentPaysCents} from ${method}`,
          );
          return;
        }

        // Claim the month first. A conflict here means a parallel run got in,
        // and that run owns the charge. A retry claims the failed row itself,
        // and only if it is still failed and still on the attempt this run
        // read, so two runs cannot both take the second try.
        const attempt = existing ? existing.attempts + 1 : 1;
        const claim = existing
          ? await admin
              .from("autopay_runs")
              .update({
                state: "charged",
                amount_cents: decision.amountCents,
                rail,
                reason: decision.reason,
                attempts: attempt,
                last_attempt_on: today,
              })
              .eq("id", existing.id)
              .eq("state", "failed")
              .eq("attempts", existing.attempts)
              .select("id")
              .single()
          : await admin
              .from("autopay_runs")
              .insert({
                association_id: association.id,
                unit_id: member.unit_id,
                month,
                state: "charged",
                amount_cents: decision.amountCents,
                rail,
                reason: decision.reason,
                last_attempt_on: today,
              })
              .select("id")
              .single();
        if (claim.error) return;

        try {
          const intent = await stripe().paymentIntents.create(
            {
              amount: cost.residentPaysCents,
              currency: "usd",
              customer: unit.stripe_customer_id,
              payment_method: instrument.token,
              payment_method_types:
                rail === "ach" ? ["us_bank_account"] : ["card"],
              off_session: true,
              confirm: true,
              description: `${association.name} dues, autopay ${month}`,
              metadata: {
                association_id: association.id,
                unit_id: member.unit_id,
                paid_by: member.profile_id ?? "",
                assessment_cents: String(cost.amountCents),
                platform_fee_cents: String(cost.platformCents),
                platform_fee_paid_by: "owner",
                rail,
                autopay_month: month,
              },
            },
            {
              stripeAccount: association.stripe_account_id,
              // Stripe replays the first answer for a repeated key, so a
              // second try needs a key of its own or it would be handed the
              // original decline. The first try keeps the key it always had.
              idempotencyKey:
                attempt === 1
                  ? `autopay-${member.unit_id}-${month}`
                  : `autopay-${member.unit_id}-${month}-try${attempt}`,
            },
          );

          if (
            intent.status === "requires_action" ||
            intent.status === "requires_payment_method"
          ) {
            throw new Error(
              "The bank asked for the owner to confirm this payment",
            );
          }

          await admin
            .from("autopay_runs")
            .update({ stripe_payment_intent_id: intent.id })
            .eq("id", claim.data.id);
          log.info("autopay charged", { associationId: association.id, unitId: member.unit_id, month, intentId: intent.id, rail, amountCents: cost.residentPaysCents });
          report.charged.push(
            `${tag}: ${cost.residentPaysCents} from ${method}`,
          );

          if (email) {
            await sendAutopayNotice({
              associationId: association.id,
              unitId: member.unit_id,
              profileId: member.profile_id,
              to: email,
              kind: "charged",
              message: {
                associationName: association.name,
                ownerName: member.full_name,
                amountCents: cost.residentPaysCents,
                method,
                payUrl: `${origin}${communityPath(association.slug, "/resident/account")}`,
              },
            });
          }
        } catch (problem) {
          const message =
            problem instanceof Stripe.errors.StripeError
              ? (problem.message ?? "Declined")
              : problem instanceof Error
                ? problem.message
                : "Declined";
          await admin
            .from("autopay_runs")
            .update({ state: "failed", reason: message })
            .eq("id", claim.data.id);
          log.warn("autopay charge failed", { associationId: association.id, unitId: member.unit_id, month, rail, reason: message });
          report.failed.push(`${tag}: ${message}`);
          if (email) {
            await sendAutopayNotice({
              associationId: association.id,
              unitId: member.unit_id,
              profileId: member.profile_id,
              to: email,
              kind: "failed",
              message: {
                associationName: association.name,
                ownerName: member.full_name,
                amountCents: cost.residentPaysCents,
                method,
                problem: message,
                payUrl: `${origin}${communityPath(association.slug, "/resident/pay")}`,
              },
            });
          }
        }
      } catch (problem) {
        log.error("autopay member failed", { associationId: member.association_id, unitId: member.unit_id, month, err: problem });
        report.errors.push(
          `${tag}: ${problem instanceof Error ? problem.message : String(problem)}`,
        );
      }
    },
  );

  const summary = {
    checked: report.checked, charged: report.charged.length, skipped: report.skipped.length,
    failed: report.failed.length, waiting: report.waiting.length, errors: report.errors.length,
    complete: walk.complete, after: run.after, dryRun,
  };
  if (walk.error) {
    log.error("autopay run failed", { err: walk.error, ...summary });
    if (!dryRun) await recordCronRun({ job: "autopay", requestId: log.requestId, startedAt, ok: false, summary, error: walk.error });
    return NextResponse.json(
      { error: walk.error, reference: log.requestId, today, dryRun, ...report },
      { status: 500 },
    );
  }
  if (!walk.complete && walk.last) {
    report.complete = false;
    report.next = walk.last;
    if (!dryRun) scheduleContinuation(request, run.continuation(walk.last));
  }
  log.info("autopay run finished", summary);
  if (!dryRun) await recordCronRun({ job: "autopay", requestId: log.requestId, startedAt, ok: report.errors.length === 0, summary });

  return NextResponse.json({ today, dryRun, ...report });
}
