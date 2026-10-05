/**
 * The billing page a board is sent to: change the card, see invoices, cancel.
 *
 * Stripe hosts it, and what it offers is a configuration on our account. None
 * existed until 2026-10-04, so "Manage billing" had nothing to open, and
 * since migrations 0071 and 0073 a paying board is sent here to cancel. This
 * creates the configuration, or brings an existing one up to date. Safe to
 * run again, and run once more with the live key when the live keys go in.
 *
 * Cancelling takes effect at the end of the month already paid for: the fee
 * is monthly with no proration, so the board keeps what it paid for. Changing
 * the plan is off, because the number of homes is ours to count.
 *
 *   node scripts/setup-stripe-portal.mjs
 *   node scripts/setup-stripe-portal.mjs https://preview-branch.vercel.app
 */
import Stripe from "stripe";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const key = env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not in .env.local.");
  process.exit(1);
}
const origin = (process.argv[2] ?? "https://yourhoasis.com").replace(/\/$/, "");
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live") ? "LIVE" : "test";

/** The mark the app looks for (src/lib/stripe/portal.ts). */
const APP = "yourhoasis";

const wanted = {
  business_profile: {
    headline: "Your HOAsis: the association's subscription",
    privacy_policy_url: `${origin}/privacy`,
    terms_of_service_url: `${origin}/terms`,
  },
  default_return_url: `${origin}/board/settings`,
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "name", "address"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: {
        enabled: true,
        options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
      },
    },
    subscription_update: { enabled: false },
  },
  metadata: { app: APP },
};

const existing = (await stripe.billingPortal.configurations.list({ limit: 100 })).data.find(
  (c) => c.metadata?.app === APP,
);
const saved = existing
  ? await stripe.billingPortal.configurations.update(existing.id, { ...wanted, active: true })
  : await stripe.billingPortal.configurations.create(wanted);

console.log(
  `Stripe ${mode} mode: billing page ${existing ? "updated" : "created"} (${saved.id}). ` +
    `Cancel: ${saved.features.subscription_cancel.enabled ? `on, ${saved.features.subscription_cancel.mode}` : "off"}.`,
);
