import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { syncAccountStatus } from "@/lib/stripe/account-status";
import { recordAppError } from "@/lib/app-errors";
import { sendDisputeNotice } from "@/lib/email/dispute";
import { logger } from "@/lib/log";

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

/**
 * The event's account must be the association's own connected account. The
 * metadata names a unit; without this check, an intent created on any
 * account this platform can see could settle somebody else's dues.
 *
 * Three answers, because "the database did not answer" is not "no". A failed
 * lookup read as a mismatch used to be acknowledged with a 200, and Stripe
 * never sends a settled payment twice once it has been told it arrived.
 */
async function belongsToAccount(
  unitId: string,
  account: string | undefined,
): Promise<"yes" | "no" | "error"> {
  if (!account) return "no";
  const { data, error } = await supabaseAdmin()
    .from("units")
    .select("associations(stripe_account_id)")
    .eq("id", unitId)
    .maybeSingle();
  if (error) {
    // A unit id that is not an id at all can never start matching. That is a
    // permanent "no", and answering 500 would have Stripe retry it for days.
    return error.code === "22P02" ? "no" : "error";
  }
  const row = data as { associations: { stripe_account_id: string | null } | null } | null;
  return row?.associations?.stripe_account_id === account ? "yes" : "no";
}

/** The answer that makes Stripe deliver the event again. */
function retryLater(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

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
  const log = logger("stripe/webhook", request);
  // The registered endpoint's secret, plus the one `stripe listen` prints
  // for a local run, so a developer can watch a real event land without
  // swapping the production value in and out of .env.local.
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_LOCAL,
  ].filter((s): s is string => Boolean(s));
  if (secrets.length === 0) {
    log.error("webhook secret is not configured");
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe().webhooks.constructEvent(payload, signature, secret);
      break;
    } catch {
      // Try the next secret.
    }
  }
  if (!event) {
    log.warn("bad signature");
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  log.info("event", { type: event.type, eventId: event.id, account: event.account ?? null });

  switch (event.type) {
    case "payment_intent.requires_action":
    case "payment_intent.processing": {
      // ACH confirmed, or waiting on micro-deposits; either way the money
      // is not here yet. The pending row is what lets the resident see that
      // something honest is happening.
      const intent = event.data.object;
      const meta = intentMetadata(intent);
      if (!meta) break;
      const ours = await belongsToAccount(meta.unitId, event.account);
      if (ours === "error") {
        log.error("account lookup failed", { intentId: intent.id, unitId: meta.unitId });
        return retryLater("Could not look up the unit");
      }
      if (ours === "no") break;
      const { error: pendingError } = await supabaseAdmin()
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
      if (pendingError) {
        // This row is what stops autopay and the late fee run from acting on
        // money already in flight, so losing it quietly means the same dues
        // can be pulled twice. Ask Stripe to send the event again. A foreign
        // key that no longer resolves (the payer's profile was deleted) will
        // never succeed, so that one is put on /admin and acknowledged.
        if (pendingError.code === "23503") {
          log.error("pending payment row refused", { intentId: intent.id, error: pendingError.message });
          await recordAppError({
            level: "error",
            source: "server",
            route: "stripe/webhook",
            message: "Pending payment not recorded",
            associationId: meta.associationId,
            extra: { intentId: intent.id, unitId: meta.unitId, error: pendingError.message },
          });
          break;
        }
        log.error("pending payment row failed", { intentId: intent.id, error: pendingError.message });
        return retryLater(pendingError.message);
      }
      break;
    }

    case "payment_intent.succeeded": {
      const intent = event.data.object;
      const meta = intentMetadata(intent);
      const ours = meta ? await belongsToAccount(meta.unitId, event.account) : "no";
      if (ours === "error") {
        // The database did not answer. A 500 makes Stripe send this again,
        // which record_payment is built to tolerate.
        log.error("account lookup failed", { intentId: intent.id, unitId: meta?.unitId });
        return retryLater("Could not look up the unit");
      }
      if (!meta || ours === "no") {
        // Money settled on a connected account and the books will not show
        // it: no usable metadata, or a unit that is not this account's.
        // Retrying cannot fix either, so it is acknowledged, but never
        // silently. It lands on /admin with the intent to look up.
        log.error("settled payment not recorded", { intentId: intent.id, account: event.account ?? null });
        await recordAppError({
          level: "error",
          source: "server",
          route: "stripe/webhook",
          message: "Settled payment not recorded",
          associationId: meta?.associationId ?? null,
          extra: {
            intentId: intent.id,
            account: event.account ?? null,
            unitId: meta?.unitId ?? null,
            amountCents: intent.amount ?? null,
            why: meta ? "The unit does not belong to the account the event came from" : "The intent carries no usable metadata",
          },
        });
        break;
      }

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
        log.error("record_payment failed", { err: error.message, intentId: intent.id, associationId: meta.associationId });
        // A 500 makes Stripe retry, which record_payment is built to tolerate.
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      break;
    }

    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const intent = event.data.object;
      const { error } = await supabaseAdmin()
        .from("payments")
        .update({ state: "failed" })
        .eq("stripe_payment_intent_id", intent.id)
        .eq("state", "pending");
      if (error) {
        // A pending row left standing reads as money on its way, to the
        // owner and to autopay. Ask Stripe to say it again.
        log.error("could not fail the pending payment", { err: error.message, intentId: intent.id });
        return retryLater(error.message);
      }
      break;
    }

    case "setup_intent.succeeded": {
      // The micro-deposits matched. The row loses its verifying mark and
      // becomes chargeable, by hand and by autopay.
      //
      // Stripe says this once. A read or a write that fails and is answered
      // with a 200 leaves the bank marked verifying for good: the owner did
      // everything right and can never pay with it. So a failure asks for
      // the event again. Clearing the mark twice is harmless, because a row
      // already cleared no longer matches the SetupIntent id.
      const intent = event.data.object;
      const admin = supabaseAdmin();
      const { data: rows, error: readError } = await admin
        .from("payment_instruments")
        .select("id, detail")
        .eq("detail->>setupIntentId", intent.id);
      if (readError) {
        log.error("could not read the verifying bank", { err: readError.message, setupIntentId: intent.id });
        return retryLater(readError.message);
      }
      for (const row of rows ?? []) {
        const detail = { ...((row.detail as Record<string, unknown>) ?? {}) };
        delete detail.status;
        delete detail.verifyUrl;
        delete detail.setupIntentId;
        const { error } = await admin.from("payment_instruments").update({ detail }).eq("id", row.id);
        if (error) {
          log.error("could not clear the verifying mark", { err: error.message, setupIntentId: intent.id, instrumentId: row.id });
          return retryLater(error.message);
        }
      }
      break;
    }

    case "setup_intent.setup_failed":
    case "setup_intent.canceled": {
      // Wrong amounts too many times, or the owner gave up. A bank that can
      // never be charged is not a payment method. A delete that fails is
      // asked for again, or the row sits on the pay screen as a bank still
      // verifying, with a link that no longer leads anywhere.
      const intent = event.data.object;
      const { error } = await supabaseAdmin()
        .from("payment_instruments")
        .delete()
        .eq("detail->>setupIntentId", intent.id);
      if (error) {
        log.error("could not remove the failed bank", { err: error.message, setupIntentId: intent.id });
        return retryLater(error.message);
      }
      break;
    }

    case "account.updated": {
      // Onboarding finished, or Stripe paused the account. The cached
      // answer on the associations row follows within the minute.
      const account = event.data.object;
      const admin = supabaseAdmin();
      const { data: row } = await admin
        .from("associations")
        .select("id")
        .eq("stripe_account_id", account.id)
        .maybeSingle();
      if (row) await syncAccountStatus(row.id, account.id);
      break;
    }

    case "charge.refunded": {
      // Issued from the Stripe dashboard. The books hear about it here: the
      // owner's statement gets back what came back, the same amount leaves
      // the ledger, and the payment reads refunded only once the whole of
      // it has been returned. A partial refund leaves it settled (migration
      // 0070). The amount passed is Stripe's running total on the charge,
      // and record_refund books the difference from the last one it saw,
      // so a redelivery is harmless.
      const charge = event.data.object;
      const intentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null);
      if (!intentId || !charge.amount_refunded) break;
      const { data: refundedPayment, error } = await supabaseAdmin().rpc("record_refund", {
        p_stripe_payment_intent_id: intentId,
        p_amount_cents: charge.amount_refunded,
      });
      if (error) {
        log.error("record_refund failed", { err: error.message, intentId });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!refundedPayment) {
        // No payment carries this intent, or the one that does is still
        // pending (migration 0078), so nothing was booked. Events arrive
        // out of order, and a refund issued moments after a payment can get
        // here before the payment is recorded. Answered with a 200, that
        // refund was lost: Stripe does not say it twice. So when the
        // intent is one of ours, on the account this event came from, ask
        // for the event again. An intent that is not ours is acknowledged
        // as before: every other charge on a connected account passes
        // through here too, and no retry will ever find a payment for it.
        let refundedIntent: Stripe.PaymentIntent;
        try {
          refundedIntent = await stripe().paymentIntents.retrieve(
            intentId,
            {},
            event.account ? { stripeAccount: event.account } : undefined,
          );
        } catch (problem) {
          // Not known to be ours or not. Asking again costs nothing.
          log.error("could not read the refunded intent", { err: problem, intentId });
          return retryLater("Could not look up the refunded payment");
        }
        const meta = intentMetadata(refundedIntent);
        const ours = meta ? await belongsToAccount(meta.unitId, event.account) : "no";
        if (ours === "error") {
          log.error("account lookup failed", { intentId, unitId: meta?.unitId });
          return retryLater("Could not look up the unit");
        }
        if (ours === "yes") {
          log.warn("refund arrived before its payment", { intentId, associationId: meta?.associationId });
          return retryLater("The refunded payment is not recorded yet");
        }
      }
      break;
    }

    case "charge.dispute.created":
    case "charge.dispute.closed": {
      // A chargeback. With losses_collector = stripe the association carries
      // it, and the treasurer needs to know today, not on the next
      // statement. The people who hold finances are emailed, with the day
      // evidence is due, and again when the bank decides. It also lands on
      // /admin as an error with the amounts. While it is open the payment
      // keeps its state: the money is contested, not gone. A lost dispute
      // is booked like a refund (migration 0093), so the owner's statement
      // and the ledger stop saying the money is here.
      const dispute = event.data.object;
      const intentId =
        typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : (dispute.payment_intent?.id ?? null);
      const admin = supabaseAdmin();
      const { data: payment, error: paymentError } = intentId
        ? await admin
            .from("payments")
            .select("association_id, unit_id, amount_cents")
            .eq("stripe_payment_intent_id", intentId)
            .maybeSingle()
        : { data: null, error: null };
      if (paymentError) {
        // Without the payment there is nobody to tell. Nothing has been
        // sent or recorded yet, so asking for the event again is safe.
        log.error("could not read the disputed payment", { err: paymentError.message, intentId, disputeId: dispute.id });
        return retryLater(paymentError.message);
      }

      const opened = event.type === "charge.dispute.created";
      const kind = opened ? "opened" : dispute.status === "won" ? "won" : dispute.status === "lost" ? "lost" : null;

      // Booked before anybody is told, so the email's "the statement shows
      // it as owed again" is true when it is read. A failure is answered
      // with a 500 and Stripe sends the event again; the dispute's id on
      // the payment makes the second booking a no-op.
      if (kind === "lost" && intentId) {
        const { data: booked, error: lossError } = await admin.rpc("record_dispute_loss", {
          p_stripe_payment_intent_id: intentId,
          p_dispute_id: dispute.id,
          p_amount_cents: dispute.amount,
        });
        if (lossError) {
          log.error("record_dispute_loss failed", { err: lossError.message, intentId, disputeId: dispute.id });
          return NextResponse.json({ error: lossError.message }, { status: 500 });
        }
        if (!booked && payment) {
          // The payment is ours but not settled here yet. Ask again.
          log.warn("a lost dispute arrived before its payment settled", { intentId, disputeId: dispute.id });
          return retryLater("The disputed payment is not recorded yet");
        }
      }
      // The email must never turn into a 500: Stripe would send the event
      // again for a problem that is ours. sendDisputeNotice does not throw,
      // and each send is keyed so a redelivery mails nobody twice.
      let emailed = { sent: 0, failed: 0 };
      if (kind && payment?.association_id) {
        const dueBy = dispute.evidence_details?.due_by;
        try {
          emailed = await sendDisputeNotice({
            associationId: payment.association_id,
            unitId: payment.unit_id ?? null,
            kind,
            disputeId: dispute.id,
            amountCents: dispute.amount,
            reason: dispute.reason ?? null,
            evidenceDueOn: opened && dueBy ? new Date(dueBy * 1000).toISOString().slice(0, 10) : null,
          });
        } catch (problem) {
          log.error("dispute email failed", { err: problem, disputeId: dispute.id });
        }
        if (emailed.sent === 0) {
          log.warn("nobody was emailed about the dispute", { disputeId: dispute.id, associationId: payment.association_id, failed: emailed.failed });
        }
      }
      await recordAppError({
        level: event.type === "charge.dispute.created" ? "error" : "warn",
        source: "server",
        route: "stripe/webhook",
        message:
          event.type === "charge.dispute.created"
            ? `Chargeback opened for $${(dispute.amount / 100).toFixed(2)} (${dispute.reason ?? "no reason given"})`
            : `Chargeback closed: ${dispute.status}`,
        associationId: payment?.association_id ?? null,
        extra: {
          disputeId: dispute.id,
          intentId,
          unitId: payment?.unit_id ?? null,
          account: event.account ?? null,
          // How many finance holders were told, so /admin shows a dispute
          // that reached nobody.
          emailed: emailed.sent,
          emailFailed: emailed.failed,
        },
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
