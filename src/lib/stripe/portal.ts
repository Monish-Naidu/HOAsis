import type Stripe from "stripe";

/**
 * Which billing page a board is sent to.
 *
 * `scripts/setup-stripe-portal.mjs` creates one configuration on our Stripe
 * account and marks it. A configuration made through the API is never the
 * account's default, so a session has to name it; this finds it once and
 * remembers it for the life of the server instance. When there is none (the
 * script has not been run with this key) it answers undefined and Stripe
 * falls back to whatever default the dashboard holds.
 */
const APP = "yourhoasis";

let found: Promise<string | undefined> | null = null;

export function portalConfigurationId(stripe: Stripe): Promise<string | undefined> {
  found ??= stripe.billingPortal.configurations
    .list({ active: true, limit: 100 })
    .then((list) => list.data.find((c) => c.metadata?.app === APP)?.id)
    .catch(() => {
      // Asked again on the next press rather than remembered as missing.
      found = null;
      return undefined;
    });
  return found;
}
