import type Stripe from "stripe";
import { PRICE_PER_HOME_CENTS } from "@/lib/pricing";

/**
 * The platform's own per-home price, found or made once.
 *
 * Checkout builds an ad-hoc price inline, which is fine for a hosted page,
 * but the subscriptions API will not take inline product data, so the
 * setup-mode completion (a trial with under 48 hours left) needs a standing
 * price to name. Looked up by its lookup key and remembered for the life of
 * the server instance, exactly like the portal configuration.
 */

const LOOKUP_KEY = "yourhoasis-platform-home-monthly";

let found: Promise<string> | null = null;

export function platformPriceId(stripe: Stripe): Promise<string> {
  found ??= (async () => {
    const existing = await stripe.prices.list({
      lookup_keys: [LOOKUP_KEY],
      active: true,
      limit: 1,
    });
    if (existing.data[0]) return existing.data[0].id;
    const created = await stripe.prices.create({
      currency: "usd",
      unit_amount: PRICE_PER_HOME_CENTS,
      recurring: { interval: "month" },
      lookup_key: LOOKUP_KEY,
      product_data: { name: "Your HOAsis, per home per month" },
      metadata: { app: "yourhoasis" },
    });
    return created.id;
  })().catch((error: unknown) => {
    // Asked again on the next event rather than remembered as missing.
    found = null;
    throw error;
  });
  return found;
}
