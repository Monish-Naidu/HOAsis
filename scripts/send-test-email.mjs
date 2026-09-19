/**
 * Sends one real email through Resend and says what happened.
 *
 * Worth having as its own script because "the signup email never arrived" has
 * at least four causes that look identical from the outside: a bad key, an
 * unverified sender, Supabase not actually using the SMTP settings, and the
 * recipient not being the Resend account owner. This isolates the first two.
 *
 *   node scripts/send-test-email.mjs you@example.com
 */
import { loadEnv } from "./env.mjs";

const env = loadEnv();

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/send-test-email.mjs you@example.com");
  process.exit(1);
}

const from = env.EMAIL_FROM ?? "Your HOAsis <hello@yourhoasis.com>";

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to,
    subject: "Your HOAsis email is wired up",
    text:
      "If you are reading this, Resend is connected and Supabase Auth will use " +
      "the same route for signup confirmations.\n\n" +
      "Sent by scripts/send-test-email.mjs.",
  }),
});

const body = await response.json();
if (!response.ok) {
  console.error(`Failed (${response.status}): ${body.message ?? JSON.stringify(body)}`);
  if (String(body.message ?? "").includes("verify a domain")) {
    console.error(
      "\nThe shared resend.dev sender only reaches the Resend account owner.\n" +
      "Either send to that address, or verify a domain and set EMAIL_FROM.",
    );
  }
  process.exit(1);
}

console.log(`Sent to ${to}. Resend id ${body.id}`);
console.log("Check the inbox, and spam. Delivery shows in the Resend dashboard under Emails.");
