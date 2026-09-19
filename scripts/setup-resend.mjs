/**
 * Points Supabase Auth at Resend, and checks it actually works.
 *
 * Two different email paths exist and people conflate them constantly.
 *
 *   Supabase sends the account emails: signup confirmation, password reset,
 *   magic links. Those come from Supabase's own service, not from our code,
 *   so pointing them at Resend is a project setting rather than a code change.
 *
 *   Our app sends the dues notices, through `src/lib/email/send.ts`. That path
 *   only needs RESEND_API_KEY in the environment and is already written.
 *
 * Without custom SMTP, Supabase's built in sender is capped at two emails an
 * hour and is explicitly not for production. That cap is what makes testing an
 * onboarding flow impossible, because the second signup silently sends nothing.
 *
 * The key is read from .env.local and never printed.
 */
import { loadEnv } from "./env.mjs";

const env = loadEnv();

const key = env.RESEND_API_KEY;
const accessToken = env.SUPABASE_ACCESS_TOKEN;
const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .replace("https://", "")
  .replace(".supabase.co", "");

if (!key) {
  console.error("RESEND_API_KEY is not in .env.local. Add it, then run this again.");
  process.exit(1);
}
if (!accessToken || !projectRef) {
  console.error("SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL is missing.");
  process.exit(1);
}

/**
 * Who the mail comes from.
 *
 * Resend's shared `onboarding@resend.dev` sender needs no DNS and is the right
 * default on day one, but it only delivers to the address that owns the Resend
 * account. Every other recipient is accepted and dropped, which looks exactly
 * like success. A verified domain in EMAIL_FROM is what lifts that.
 */
const from = env.EMAIL_FROM ?? "Your HOAsis <hello@yourhoasis.com>";
const fromAddress = from.match(/<([^>]+)>/)?.[1] ?? from;
const usingSharedSender = fromAddress.endsWith("@resend.dev");

console.log(`Project:  ${projectRef}`);
console.log(`Sender:   ${from}${usingSharedSender ? "  (shared, owner only)" : ""}`);

/* ------------------------------------------- 1. does the key work at all */

/**
 * Resend keys come in two strengths, and the weaker one is the right choice.
 *
 * A restricted "sending access" key can post to /emails and nothing else. It
 * returns 401 on /domains and /api-keys, which is not a broken key, it is the
 * key doing its job. Validating against /domains would reject exactly the key
 * a careful person would have created, so capability is probed by asking what
 * the key is actually for.
 */
const probe = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${key}` },
});

let domainNote = "";
if (probe.ok) {
  const { data: domainList = [] } = await probe.json();
  const verified = domainList.filter((d) => d.status === "verified").map((d) => d.name);
  domainNote = verified.length ? verified.join(", ") : "none verified yet";
} else if (probe.status === 401 || probe.status === 403) {
  // Confirm it can send, which is the only permission this setup needs.
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      // Resend's sink address. Accepted and discarded, so this costs nothing
      // and reaches nobody.
      to: "delivered@resend.dev",
      subject: "Your HOAsis SMTP check",
      text: "Capability probe from scripts/setup-resend.mjs.",
    }),
  });
  if (!send.ok) {
    const detail = await send.text();
    console.error(`\nThe key cannot send either (${send.status}).`);
    console.error(detail);
    process.exit(1);
  }
  domainNote = "not readable with a sending-only key, which is fine";
} else {
  console.error(`\nResend returned ${probe.status}. Check the key and try again.`);
  process.exit(1);
}

console.log(`\nResend key works. Domains: ${domainNote}`);

/* ------------------------------------- 2. point Supabase Auth at Resend */

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      smtp_host: "smtp.resend.com",
      // 465 is implicit TLS. Supabase connects from its own network, so the
      // submission port choice is about their client rather than about us.
      // The API takes this as a string, not a number.
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: key,
      smtp_admin_email: fromAddress,
      smtp_sender_name: from.replace(/\s*<[^>]+>/, "").trim() || "Your HOAsis",
      // The built in cap was two an hour, which is what made onboarding
      // untestable. Resend's own limits apply beyond this.
      rate_limit_email_sent: 100,
    }),
  },
);

if (!response.ok) {
  console.error(`\nSupabase rejected the SMTP settings (${response.status})`);
  console.error(await response.text());
  process.exit(1);
}

/* -------------------------------------------------- 3. read it back */

const check = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
const config = await check.json();

console.log("\nSupabase Auth now sends through:");
console.log(`  host          ${config.smtp_host}:${config.smtp_port}`);
console.log(`  user          ${config.smtp_user}`);
console.log(`  from          ${config.smtp_sender_name} <${config.smtp_admin_email}>`);
console.log(`  rate limit    ${config.rate_limit_email_sent} an hour`);
console.log(`  confirmation  ${config.mailer_autoconfirm ? "OFF, signups auto confirm" : "ON, a link is emailed"}`);

if (usingSharedSender) {
  console.log(
    "\nNote: the shared resend.dev sender only delivers to the address that owns\n" +
    "the Resend account. Other recipients are accepted and dropped. Verify a\n" +
    "domain and set EMAIL_FROM before inviting real residents.",
  );
}
