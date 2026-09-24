import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { sendAutopayNotice } from "@/lib/email/autopay";
import { decideAutopay, isChargeable } from "@/lib/payments/autopay";
import { describeInstrument, type PaymentInstrument } from "@/lib/payments/instruments";
import { costFor, stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AutopayPlan } from "@/lib/types";
import { duesFor } from "@/lib/home-types";

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
 */
export const runtime = "nodejs";
export const maxDuration = 120;

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
};

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not for you" }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const origin = request.nextUrl.origin;
  const admin = supabaseAdmin();
  const report: Report = { checked: 0, charged: [], skipped: [], failed: [], waiting: [], errors: [] };

  const { data: members, error } = await admin
    .from("memberships")
    .select("id, unit_id, association_id, profile_id, full_name, invited_email, autopay")
    .not("autopay", "is", null)
    .is("ends_on", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const member of members ?? []) {
    report.checked++;
    const plan = member.autopay as AutopayPlan | null;
    if (!plan || typeof plan.day !== "number") continue;
    const tag = `${member.full_name} (${member.unit_id.slice(0, 8)})`;

    try {
      const [{ data: association }, { data: unit }, { data: balance }, { data: existing }] =
        await Promise.all([
          admin
            .from("associations")
            .select(
              "id, name, stripe_account_id, dues_cents, dues_by_type, payment_fee_cents, payment_fee_paid_by, payment_fee_waived_on_ach, deleted_at",
            )
            .eq("id", member.association_id)
            .single(),
          admin
            .from("units")
            .select("stripe_customer_id, label, home_type")
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
            .select("state")
            .eq("unit_id", member.unit_id)
            .eq("month", month)
            .maybeSingle(),
        ]);

      if (existing) continue; // This month is already decided.
      if (!association || association.deleted_at || !association.stripe_account_id) {
        report.waiting.push(`${tag}: no online payments`);
        continue;
      }

      const balanceCents = (balance ?? []).reduce((sum, c) => sum + c.amount_cents, 0);
      const decision = decideAutopay({
        plan,
        today,
        balanceCents,
        // The home's own kind's amount, as issue_assessment billed it.
        duesCents: duesFor(
          {
            duesCents: association.dues_cents,
            duesByType: (association.dues_by_type ?? {}) as Record<string, number>,
          },
          unit?.home_type ?? undefined,
        ),
      });

      if (decision.action === "wait") {
        report.waiting.push(`${tag}: ${decision.reason}`);
        continue;
      }

      if (decision.action === "skip") {
        report.skipped.push(`${tag}: ${decision.reason}`);
        if (!dryRun) {
          await admin.from("autopay_runs").insert({
            association_id: association.id,
            unit_id: member.unit_id,
            month,
            state: "skipped",
            reason: decision.reason,
          });
        }
        continue;
      }

      // The method: the one the plan named, else the home's default, and
      // only if Stripe can charge it without the owner present.
      const { data: instruments } = await admin
        .from("payment_instruments")
        .select("*")
        .eq("unit_id", member.unit_id)
        .order("is_default", { ascending: false });
      const candidates = (instruments ?? []).map(
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
        candidates.find((i) => i.id === plan.instrumentId && isChargeable(i)) ??
        candidates.find((i) => isChargeable(i));
      const email = member.invited_email ?? null;

      if (!instrument || !unit?.stripe_customer_id) {
        const reason = "No payment method that can be charged automatically";
        report.failed.push(`${tag}: ${reason}`);
        if (dryRun) continue;
        await admin.from("autopay_runs").insert({
          association_id: association.id,
          unit_id: member.unit_id,
          month,
          state: "failed",
          amount_cents: decision.amountCents,
          reason,
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
              payUrl: `${origin}/resident/pay`,
            },
          });
        }
        continue;
      }

      const rail = instrument.kind === "ach" ? "ach" : "card";
      const cost = costFor(association, rail, decision.amountCents);
      const method = describeInstrument(instrument);

      if (dryRun) {
        report.charged.push(`${tag}: would charge ${cost.residentPaysCents} from ${method}`);
        continue;
      }

      // Claim the month first. A conflict here means a parallel run got in,
      // and that run owns the charge.
      const claim = await admin
        .from("autopay_runs")
        .insert({
          association_id: association.id,
          unit_id: member.unit_id,
          month,
          state: "charged",
          amount_cents: decision.amountCents,
          rail,
          reason: decision.reason,
        })
        .select("id")
        .single();
      if (claim.error) continue;

      try {
        const intent = await stripe().paymentIntents.create(
          {
            amount: cost.residentPaysCents,
            currency: "usd",
            application_fee_amount: cost.platformCents || undefined,
            customer: unit.stripe_customer_id,
            payment_method: instrument.token,
            payment_method_types: rail === "ach" ? ["us_bank_account"] : ["card"],
            off_session: true,
            confirm: true,
            description: `${association.name} dues, autopay ${month}`,
            metadata: {
              association_id: association.id,
              unit_id: member.unit_id,
              paid_by: member.profile_id ?? "",
              assessment_cents: String(cost.amountCents),
              platform_fee_cents: String(cost.platformCents),
              platform_fee_paid_by: association.payment_fee_paid_by ?? "owner",
              rail,
              autopay_month: month,
            },
          },
          {
            stripeAccount: association.stripe_account_id,
            idempotencyKey: `autopay-${member.unit_id}-${month}`,
          },
        );

        if (intent.status === "requires_action" || intent.status === "requires_payment_method") {
          throw new Error("The bank asked for the owner to confirm this payment");
        }

        await admin
          .from("autopay_runs")
          .update({ stripe_payment_intent_id: intent.id })
          .eq("id", claim.data.id);
        report.charged.push(`${tag}: ${cost.residentPaysCents} from ${method}`);

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
              payUrl: `${origin}/resident/account`,
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
              payUrl: `${origin}/resident/pay`,
            },
          });
        }
      }
    } catch (problem) {
      report.errors.push(`${tag}: ${problem instanceof Error ? problem.message : String(problem)}`);
    }
  }

  return NextResponse.json({ today, dryRun, ...report });
}
