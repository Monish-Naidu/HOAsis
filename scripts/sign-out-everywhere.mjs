/**
 * Signs a person out of every device at once (migration 0114).
 *
 *   node scripts/sign-out-everywhere.mjs <email> [reason]
 *
 * For a lost phone, a board member removed in a hurry, or a password that
 * leaked. Their seats are untouched: ending access is a separate act, done
 * in Settings. The activity log of every association they belong to gets
 * a line saying they were signed out and why.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

const [email, ...reasonWords] = process.argv.slice(2);
if (!email) {
  console.error("usage: node scripts/sign-out-everywhere.mjs <email> [reason]");
  process.exit(1);
}
const reason = reasonWords.join(" ") || null;
const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: profile } = await admin.from("profiles").select("id, full_name").ilike("email", email.trim()).maybeSingle();
if (!profile) { console.error(`Nobody has signed up with ${email}.`); process.exit(1); }

const { data: count, error } = await admin.rpc("sign_out_everywhere", { p_profile_id: profile.id, p_reason: reason });
if (error) { console.error(`Could not sign them out: ${error.message}`); process.exit(1); }
console.log(`${profile.full_name || email} signed out of ${count} ${count === 1 ? "session" : "sessions"}.`);
