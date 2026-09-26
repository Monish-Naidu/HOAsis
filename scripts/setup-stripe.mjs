/**
 * Registers the two webhook endpoints Stripe has to know about, and writes
 * their signing secrets into .env.local.
 *
 * Two endpoints, because they are two different things:
 *
 *   /api/stripe/webhook   a CONNECT endpoint. Residents pay their association
 *                         on its own connected account, so the events come
 *                         from that account, and a plain endpoint hears nothing.
 *   /api/billing/webhook  a plain endpoint on our account, for the
 *                         association's subscription to us.
 *
 * Idempotent: an endpoint that already exists for the URL is left alone and
 * its secret is not re-issued (Stripe only shows a secret once), so an
 * existing secret in .env.local is kept. Delete the endpoint in the dashboard
 * to rotate it.
 *
 * Needs STRIPE_SECRET_KEY in .env.local. Pass the deployed origin as the one
 * argument; without it the endpoints point at yourhoasis.com. For local
 * development do not use this at all: `stripe listen` prints its own secret.
 *
 *   node scripts/setup-stripe.mjs
 *   node scripts/setup-stripe.mjs https://preview-branch.vercel.app
 */
import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const key = env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not in .env.local. Add the test key, then run this again.");
  process.exit(1);
}
const origin = (process.argv[2] ?? "https://yourhoasis.com").replace(/\/$/, "");
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live") ? "LIVE" : "test";

const WANTED = [
  {
    envKey: "STRIPE_WEBHOOK_SECRET",
    url: `${origin}/api/stripe/webhook`,
    connect: true,
    events: [
      "payment_intent.requires_action",
      "payment_intent.processing",
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "payment_intent.canceled",
      "setup_intent.succeeded",
      "setup_intent.setup_failed",
      "setup_intent.canceled",
      "account.updated",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.closed",
    ],
    description: "Your HOAsis: dues on connected accounts",
  },
  {
    envKey: "STRIPE_BILLING_WEBHOOK_SECRET",
    url: `${origin}/api/billing/webhook`,
    connect: false,
    events: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ],
    description: "Your HOAsis: platform subscriptions",
  },
];

const existing = await stripe.webhookEndpoints.list({ limit: 100 });
const envPath = path.join(process.cwd(), ".env.local");
let envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

function setEnv(name, value) {
  const line = `${name}=${value}`;
  if (new RegExp(`^${name}=`, "m").test(envText)) {
    envText = envText.replace(new RegExp(`^${name}=.*$`, "m"), line);
  } else {
    envText = `${envText.replace(/\n*$/, "\n")}${line}\n`;
  }
}

console.log(`Stripe ${mode} mode, endpoints at ${origin}\n`);
for (const wanted of WANTED) {
  const found = existing.data.find((e) => e.url === wanted.url);
  if (found) {
    const missing = wanted.events.filter((ev) => !found.enabled_events.includes(ev));
    if (missing.length) {
      await stripe.webhookEndpoints.update(found.id, {
        enabled_events: [...new Set([...found.enabled_events, ...wanted.events])],
      });
      console.log(`✓ ${wanted.url}\n  exists (${found.id}); added ${missing.join(", ")}`);
    } else {
      console.log(`✓ ${wanted.url}\n  exists (${found.id}); nothing to do`);
    }
    if (!env[wanted.envKey]) {
      console.log(
        `  ! ${wanted.envKey} is not in .env.local and Stripe will not show the secret again.\n    Delete the endpoint in the dashboard and re-run, or paste the secret by hand.`,
      );
    }
    continue;
  }
  const created = await stripe.webhookEndpoints.create({
    url: wanted.url,
    enabled_events: wanted.events,
    connect: wanted.connect,
    description: wanted.description,
  });
  setEnv(wanted.envKey, created.secret);
  console.log(`✓ ${wanted.url}\n  created ${created.id}${wanted.connect ? " (Connect)" : ""}; ${wanted.envKey} written to .env.local`);
}

fs.writeFileSync(envPath, envText);

if (!env.CRON_SECRET) {
  const { randomBytes } = await import("node:crypto");
  setEnv("CRON_SECRET", randomBytes(24).toString("base64url"));
  fs.writeFileSync(envPath, envText);
  console.log("✓ CRON_SECRET generated and written to .env.local");
}

/* ------------------------------------ Apple Pay and Google Pay domains */

/**
 * Wallets need the domain registered on the account that charges. Direct
 * charges run on each association's connected account, so every one of them
 * gets the domain, and the platform account too so anything charged on our
 * own account (the subscription) can show a wallet as well. Stripe checks
 * the file this app serves at /.well-known/apple-developer-merchantid-domain-association,
 * so Apple Pay only goes active once that path is live on the domain; Google
 * Pay needs only the registration. Idempotent: a domain already registered
 * comes back as-is, and validate() asks Stripe to look at the file again.
 *
 * Hosts: the origin given on the command line, NEXT_PUBLIC_SITE_HOST when
 * set, and yourhoasis.com. localhost and *.vercel.app are skipped.
 */
const hosts = [...new Set(
  [new URL(origin).hostname, env.NEXT_PUBLIC_SITE_HOST, "yourhoasis.com"]
    .map((h) => (h ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter((h) => h && !h.includes("localhost") && !h.endsWith(".vercel.app")),
)];

async function registerDomain(host, accountId) {
  const options = accountId ? { stripeAccount: accountId } : undefined;
  let domain = await stripe.paymentMethodDomains.create({ domain_name: host }, options);
  if (domain.apple_pay?.status !== "active" || domain.google_pay?.status !== "active") {
    domain = await stripe.paymentMethodDomains.validate(domain.id, {}, options);
  }
  return domain;
}

function walletLine(domain) {
  const apple = domain.apple_pay?.status ?? "?";
  const google = domain.google_pay?.status ?? "?";
  const reasons = [
    apple !== "active" && domain.apple_pay?.status_details?.error_message
      ? `Apple: ${domain.apple_pay.status_details.error_message}`
      : null,
    google !== "active" && domain.google_pay?.status_details?.error_message
      ? `Google: ${domain.google_pay.status_details.error_message}`
      : null,
  ].filter(Boolean);
  return `Apple Pay ${apple}, Google Pay ${google}${reasons.length ? `\n    ${reasons.join("\n    ")}` : ""}`;
}

if (hosts.length) {
  console.log(`\nWallet domains: ${hosts.join(", ")}\n`);
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: rows } = await admin
    .from("associations")
    .select("name, stripe_account_id")
    .not("stripe_account_id", "is", null)
    .is("deleted_at", null);
  const accounts = [{ name: "platform (Your HOAsis)", stripe_account_id: null }, ...(rows ?? [])];
  let inactive = 0;
  for (const host of hosts) {
    for (const account of accounts) {
      try {
        const domain = await registerDomain(host, account.stripe_account_id);
        const ok = domain.apple_pay?.status === "active" && domain.google_pay?.status === "active";
        if (!ok) inactive++;
        console.log(`${ok ? "✓" : "!"} ${host} on ${account.name}${account.stripe_account_id ? ` (${account.stripe_account_id})` : ""}: ${walletLine(domain)}`);
      } catch (error) {
        inactive++;
        console.log(`! ${host} on ${account.name}: ${error.message}`);
      }
    }
  }
  if (inactive) {
    console.log(`
Apple Pay goes active once https://${hosts[0]}/.well-known/apple-developer-merchantid-domain-association
is served by the deployed site (the file is in public/). Deploy, then run this script again;
it only re-validates, nothing is registered twice.`);
  }
}

console.log(`
Next, the same values in Vercel (Production and Preview):
  vercel env add STRIPE_SECRET_KEY
  vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  vercel env add STRIPE_WEBHOOK_SECRET
  vercel env add STRIPE_BILLING_WEBHOOK_SECRET
  vercel env add CRON_SECRET
Then redeploy. Local development uses the CLI instead of these endpoints:
  stripe listen --forward-connect-to localhost:3000/api/stripe/webhook --forward-to localhost:3000/api/billing/webhook
`);
