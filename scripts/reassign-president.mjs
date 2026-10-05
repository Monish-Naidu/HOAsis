/**
 * Seats a new President when the sitting one cannot be reached.
 *
 *   node scripts/reassign-president.mjs <association slug> <email of the new President>
 *
 * Support's tool, run by hand after hearing from the association (migration
 * 0095). The person must already hold a seat there. Reads the service key
 * from ../.env.local (or ENV_FILE), like every script here, and prints what
 * it did; it changes nothing without both arguments.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const [slug, email] = process.argv.slice(2);
if (!slug || !email) {
  console.error("usage: node scripts/reassign-president.mjs <association slug> <email>");
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(new URL(process.env.ENV_FILE ?? "../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: association } = await admin.from("associations").select("id, name").eq("slug", slug).is("deleted_at", null).maybeSingle();
if (!association) { console.error(`No association with the slug "${slug}".`); process.exit(1); }
const { data: profile } = await admin.from("profiles").select("id, full_name").ilike("email", email.trim()).maybeSingle();
if (!profile) { console.error(`Nobody has signed up with ${email}.`); process.exit(1); }

const { error } = await admin.rpc("reassign_presidency", { p_association_id: association.id, p_to_profile: profile.id });
if (error) { console.error(error.message); process.exit(1); }
console.log(`${profile.full_name ?? email} is now the President of ${association.name}.`);
