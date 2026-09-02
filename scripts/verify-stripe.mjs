/**
 * The webhook's settlement contract, against the real database.
 *
 * Stripe delivers events at least once and out of order, so record_payment
 * must be safe to call twice with one intent id, must settle a pending row in
 * place rather than inserting a second payment, and must never let a late
 * failure event downgrade money that settled. Pure Supabase, no Stripe
 * network: this proves our side of the contract deterministically.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const PASSWORD = "stripe-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };
const day = (o) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };

async function makeUser(who) {
  const email = `${who}-stripe-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: who },
  });
  if (error) throw new Error(`${who}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw new Error(`sign in ${who}: ${e2.message}`);
  return { client, id: data.user.id, email };
}

try {
  const president = await makeUser("president");
  const { data: associationId } = await president.client.rpc("create_association", {
    p_name: "Webhook Contract HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Dana Whitcomb", p_founder_unit: "1",
    p_households: [{ name: "Marcus Bell", email: `resident-stripe-${stamp}@example.com`, unit: "2" }],
  });
  cleanup.associations.push(associationId);

  await president.client.from("bank_accounts").insert({
    association_id: associationId, kind: "operating",
    institution: "Willow Creek CU", mask: "6789",
  });
  await president.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "Assessment", p_due_on: day(-3),
  });
  const { data: units } = await admin.from("units").select("id").eq("association_id", associationId);
  const unit = units[0].id;

  // 1. The same succeeded event delivered twice is one payment on the books.
  const intentA = `pi_verify_a_${stamp}`;
  const { data: firstId, error: firstError } = await admin.rpc("record_payment", {
    p_unit_id: unit, p_amount_cents: 6000, p_rail: "ach",
    p_processor_fee_cents: 48, p_stripe_payment_intent_id: intentA,
  });
  check("the webhook (service role, no auth.uid) can record a payment", !firstError, firstError?.message ?? "");

  const { data: secondId, error: secondError } = await admin.rpc("record_payment", {
    p_unit_id: unit, p_amount_cents: 6000, p_rail: "ach",
    p_processor_fee_cents: 48, p_stripe_payment_intent_id: intentA,
  });
  check("a redelivered event returns the same payment", !secondError && secondId === firstId,
    secondError?.message ?? `${firstId} vs ${secondId}`);

  const { data: paymentsA } = await admin.from("payments").select("id").eq("stripe_payment_intent_id", intentA);
  check("one intent is one payment row", (paymentsA ?? []).length === 1, String((paymentsA ?? []).length));

  const { data: chargeLines } = await admin.from("charges").select("id").eq("unit_id", unit).eq("kind", "payment");
  check("one intent is one statement line", (chargeLines ?? []).length === 1, String((chargeLines ?? []).length));

  const { data: ledgerA } = await admin.from("ledger_entries").select("id").eq("association_id", associationId).eq("category", "Assessments");
  check("one intent is one ledger entry", (ledgerA ?? []).length === 1, String((ledgerA ?? []).length));

  // 2. A pending row (the `processing` event) settles in place.
  const intentB = `pi_verify_b_${stamp}`;
  const { data: pendingRow } = await admin.from("payments").insert({
    association_id: associationId, unit_id: unit, amount_cents: 2500,
    rail: "ach", state: "pending", stripe_payment_intent_id: intentB,
  }).select("id").single();

  const { data: settledId, error: settleError } = await admin.rpc("record_payment", {
    p_unit_id: unit, p_amount_cents: 2500, p_rail: "ach",
    p_processor_fee_cents: 20, p_stripe_payment_intent_id: intentB,
  });
  check("a pending payment settles in place, not as a second row",
    !settleError && settledId === pendingRow.id, settleError?.message ?? `${pendingRow.id} vs ${settledId}`);

  const { data: settledRow } = await admin.from("payments").select("state, processor_fee_cents, settled_at").eq("id", pendingRow.id).single();
  check("the settled row carries the actual fee and a settled_at",
    settledRow?.state === "settled" && settledRow?.processor_fee_cents === 20 && Boolean(settledRow?.settled_at),
    JSON.stringify(settledRow));

  // 3. A late failure event never downgrades settled money. This is the
  // webhook's own guard (update ... where state = 'pending').
  const { data: downgraded } = await admin.from("payments")
    .update({ state: "failed" })
    .eq("stripe_payment_intent_id", intentB)
    .eq("state", "pending")
    .select("id");
  const { data: stillSettled } = await admin.from("payments").select("state").eq("id", pendingRow.id).single();
  check("a late payment_failed does not touch settled money",
    (downgraded ?? []).length === 0 && stillSettled?.state === "settled",
    `updated ${(downgraded ?? []).length}, state ${stillSettled?.state}`);
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) await admin.from("associations").delete().eq("id", id);
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
