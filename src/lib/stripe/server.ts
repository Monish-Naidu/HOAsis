import Stripe from "stripe";
import {
  computePaymentCost,
  type InstrumentKind,
  type PaymentCost,
  type PlatformFeePolicy,
} from "@/lib/payments/instruments";
import type { Cents } from "@/lib/types";

/**
 * Server-side Stripe. Never imported from client code: the secret key has no
 * NEXT_PUBLIC_ prefix, so the bundler cannot ship it to a browser, and this
 * module throws rather than run with a missing key (mirroring serviceRoleKey
 * in src/lib/supabase/server.ts).
 */
let client: Stripe | undefined;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is missing. Payment routes cannot talk to Stripe without it.",
      );
    }
    client = new Stripe(key);
  }
  return client;
}

/** The subset of the associations row the fee policy is built from. */
export interface FeePolicyColumns {
  payment_fee_cents: number | null;
  payment_fee_paid_by: string | null;
  payment_fee_waived_on_ach: boolean | null;
}

/**
 * The association's fee policy, from its own columns.
 *
 * The pay screen and the PaymentIntent must price a payment from the same
 * function on the same rows, or the number confirmed is not the number shown.
 * The client's math is never trusted; the server re-derives it here and the
 * client re-renders from the server's answer.
 */
export function feePolicyFor(row: FeePolicyColumns): PlatformFeePolicy {
  return {
    flatCents: row.payment_fee_cents ?? 0,
    paidBy: row.payment_fee_paid_by === "association" ? "association" : "owner",
    waiveOnAch: row.payment_fee_waived_on_ach ?? false,
  };
}

/** Server-authoritative cost of a payment for one association. */
export function costFor(row: FeePolicyColumns, rail: InstrumentKind, amountCents: Cents): PaymentCost {
  return computePaymentCost(rail, amountCents, feePolicyFor(row));
}
