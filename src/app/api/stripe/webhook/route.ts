import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * The only writer of Stripe-settled money.
 *
 * Stripe delivers events at least once, out of order, for every connected
 * account this endpoint is registered for (it must be registered as a Connect
 * endpoint: a plain platform endpoint hears nothing about direct charges).
 * Everything here is written to survive that: `processing` inserts a pending
 * row if none exists, `succeeded` calls record_payment, which settles the
 * pending row in place or no-ops if a retry got there first, and a failure
 * never touches a settled payment.
 *
 * Runs under the service role because there is no signed-in person here;
 * record_payment treats a null auth.uid() as this trusted path.
 *
 * SetupIntents matter here too: a bank saved by micro-deposit sits in
 * payment_instruments marked `verifying` until Stripe says the amounts
 * matched, and disappears if they never do. The endpoint must subscribe to
 * setup_intent.* as well as payment_intent.*.
 */
export const runtime = "nodejs";

function intentMetadata(intent: Stripe.PaymentIntent) {
  const m = intent.metadata ?? {};
  const assessment = Number.parseInt(m.assessment_cents ?? "", 10);
  if (!m.association_id || !m.unit_id || !Number.isInteger(assessment) || assessment <= 0) {
    return null;
  }
  return {
    associationId: m.association_id,
    unitId: m.unit_id,
    paidBy: m.paid_by || null,
    assessmentCents: assessment,
    platformFeeCents: Number.parseInt(m.platform_fee_cents ?? "0", 10) || 0,
    platformFeePaidBy: m.platform_fee_paid_by === "association" ? "association" : "owner",
    rail: (m.rail === "ach" ? "ach" : "card") as "ach" | "card",
  };
}

/** Stripe's processing fee alone, from an expanded balance transaction. */
function stripeFeeCents(tx: Stripe.Charge["balance_transaction"]): number {
  if (!tx || typeof tx === "string") return 0;
  const details = tx.fee_details ?? [];
  if (details.length === 0) return tx.fee;
  return details
    .filter((d) => d.type === "stripe_fee" || d.type === "tax")
    .reduce((sum, d) => sum + d.amount, 0);
}

/** What actually paid, from the charge, since a "card" can be a wallet. */
function railFromCharge(charge: Stripe.Charge | null, fallback: "ach" | "card") {
  const details = charge?.payment_method_details;
  if (!details) return fallback;
  if (details.type === "us_bank_account") return "ach";
  const wallet = details.card?.wallet?.type;
  if (wallet === "apple_pay") return "apple-pay" as const;
  if (wallet === "google_pay") return "google-pay" as const;
  return "card" as const;
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.requires_action":
    case "payment_intent.processing": {
      // ACH confirmed, or waiting on micro-deposits; either way the money
      // is not here yet. The pending row is what lets the resident see that
      // something honest is happening.
      const intent = event.data.object;
      const meta = intentMetadata(intent);
      if (!meta) break;
      await supabaseAdmin()
        .from("payments")
        .upsert(
          {
            association_id: meta.associationId,
            unit_id: meta.unitId,
            paid_by: meta.paidBy,
            amount_cents: meta.assessmentCents,
            platform_fee_cents: meta.platformFeeCents,
            rail: meta.rail,
            state: "pending",
            stripe_payment_intent_id: intent.id,
          },
          // A retry, or a `succeeded` that arrived first: leave the row alone.
          { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
        );
      break;
    }

    case "payment_intent.succeeded": {
      const intent = event.data.object;
      const meta = intentMetadata(intent);
      if (!meta) break;

      // The actual processor fee from the balance transaction, so the books
      // carry what Stripe took rather than what our schedule estimated. Only
      // Stripe's own fee: the balance transaction's total also includes our
      // application fee, which the books already carry as platform_fee_cents,
      // and counting it twice would understate what the association keeps.
      // The transaction can lag the event by a moment, so a missing or empty
      // fee is asked for again before being recorded as nothing.
      let processorFeeCents = 0;
      let charge: Stripe.Charge | null = null;
      const chargeId =
        typeof intent.latest_charge === "string"
          ? intent.latest_charge
          : (intent.latest_charge?.id ?? null);
      if (chargeId) {
        for (let attempt = 0; attempt < 3; attempt++) {
          charge = await stripe().charges.retrieve(
            chargeId,
            { expand: ["balance_transaction"] },
            event.account ? { stripeAccount: event.account } : undefined,
          );
          processorFeeCents = stripeFeeCents(charge.balance_transaction);
          if (processorFeeCents > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      const { error } = await supabaseAdmin().rpc("record_payment", {
        p_unit_id: meta.unitId,
        p_amount_cents: meta.assessmentCents,
        p_rail: railFromCharge(charge, meta.rail),
        p_processor_fee_cents: processorFeeCents,
        p_platform_fee_cents: meta.platformFeeCents,
        p_platform_fee_paid_by: meta.platformFeePaidBy,
        p_stripe_payment_intent_id: intent.id,
        p_paid_by: meta.paidBy ?? undefined,
      });
      if (error) {
        // A 500 makes Stripe retry, which record_payment is built to tolerate.
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      break;
    }

    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const intent = event.data.object;
      await supabaseAdmin()
        .from("payments")
        .update({ state: "failed" })
        .eq("stripe_payment_intent_id", intent.id)
        .eq("state", "pending");
      break;
    }

    case "setup_intent.succeeded": {
      // The micro-deposits matched. The row loses its verifying mark and
      // becomes chargeable, by hand and by autopay.
      const intent = event.data.object;
      const admin = supabaseAdmin();
      const { data: rows } = await admin
        .from("payment_instruments")
        .select("id, detail")
        .eq("detail->>setupIntentId", intent.id);
      for (const row of rows ?? []) {
        const detail = { ...((row.detail as Record<string, unknown>) ?? {}) };
        delete detail.status;
        delete detail.verifyUrl;
        delete detail.setupIntentId;
        await admin.from("payment_instruments").update({ detail }).eq("id", row.id);
      }
      break;
    }

    case "setup_intent.setup_failed":
    case "setup_intent.canceled": {
      // Wrong amounts too many times, or the owner gave up. A bank that can
      // never be charged is not a payment method.
      const intent = event.data.object;
      await supabaseAdmin()
        .from("payment_instruments")
        .delete()
        .eq("detail->>setupIntentId", intent.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
