import Stripe from "stripe";
import {
  computePaymentCost,
  type InstrumentKind,
  type PaymentCost,
  NO_PLATFORM_FEE,
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

/**
 * Server-authoritative cost of a payment.
 *
 * The pay screen and the PaymentIntent must price a payment from the same
 * function, or the number confirmed is not the number shown. The client's
 * math is never trusted; the server re-derives it here and the client
 * re-renders from the server's answer. We take no fee per payment, so the
 * owner is charged the amount owed and nothing is added to it.
 */
export function costFor(rail: InstrumentKind, amountCents: Cents): PaymentCost {
  return computePaymentCost(rail, amountCents, NO_PLATFORM_FEE);
}
