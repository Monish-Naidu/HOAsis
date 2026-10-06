/**
 * Money records are append-only for people (0106).
 *
 * Founds a throwaway association, bills it, and takes a check, then as the
 * President (a finance holder): tries to UPDATE and DELETE a row of charges,
 * ledger_entries, payments and payment_allocations and is refused, with the
 * rows read back unchanged by the service role. Inserts a charge and a ledger
 * line, which still works. Then checks the paths that must keep working
 * because they go through a function: reverse_manual_payment, record_refund
 * (the service role, as the Stripe webhook calls it), reverse_ledger_entry and
 * confirm_ledger_entry. A second reversal of one line is refused, so is a
 * reversal of a reversal, a bare reason, a line that belongs to a payment and
 * a caller with no session. The activity record names the reason. Finally
 * remove_household still refuses a home that has a statement. Pure Supabase;
 * cleaned up at the end.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL(process.env.ENV_FILE ?? "../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const PASSWORD = "appendonly-" + Math.random().toString(36).slice(2) + "A1";
const results = []; let failures = 0;
const check = (n, p, d = "") => { results.push({ n, p, d }); if (!p) failures++; };
const cleanup = { users: [], associations: [] };
const day = (o) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10); };

async function makeUser(who) {
  const email = `${who}-appendonly-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: who } });
  if (error) throw new Error(`${who}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw new Error(`sign in ${who}: ${e2.message}`);
  await client.rpc("claim_my_seats");
  return { client, id: data.user.id };
}

// A direct write is refused when it errors or changes no row. Either way the
// row is read back by the service role and must be what it was.
async function refusedUpdate(client, table, key, id, patch) {
  const { data, error } = await client.from(table).update(patch).match({ [key]: id }).select();
  return Boolean(error) || (data ?? []).length === 0;
}
async function refusedDelete(client, table, key, id) {
  const { data, error } = await client.from(table).delete().match({ [key]: id }).select();
  return Boolean(error) || (data ?? []).length === 0;
}

try {
  const president = await makeUser("president");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Append Only Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Nina Neighbor", email: `neighbor-appendonly-${stamp}@example.com`, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await admin.from("associations").update({ billing_starts_on: day(-60) }).eq("id", associationId);

  const { data: units } = await admin.from("units").select("id, label").eq("association_id", associationId).order("label");
  const unit2 = units.find((u) => u.label === "2").id;

  const { data: billed } = await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Dues", p_due_on: day(-5) });
  check("both homes were billed", billed === 2, String(billed));
  const { data: checkId, error: checkError } = await president.client.rpc("record_manual_payment", {
    p_unit_id: unit2, p_amount_cents: 6000, p_method: "check", p_reference: "2001", p_received_on: day(-1),
  });
  check("a finance holder records a check", !checkError && Boolean(checkId), checkError?.message ?? "");

  // ------------------------------------------------ direct writes refused
  const { data: charge } = await admin.from("charges").select("*").eq("unit_id", unit2).eq("kind", "charge").limit(1).single();
  const { data: allocation } = await admin.from("payment_allocations").select("*").eq("payment_id", checkId).limit(1).single();
  const { data: payment } = await admin.from("payments").select("*").eq("id", checkId).single();
  const { data: bankLine, error: lineError } = await president.client.from("ledger_entries").insert({
    association_id: associationId, occurred_on: day(-2), description: "Copy paper", counterparty: "Office Mart",
    category: "Office", amount_cents: -2500,
  }).select().single();
  check("a finance holder can still insert a ledger line", !lineError && Boolean(bankLine?.id), lineError?.message ?? "");
  const { data: extraCharge, error: chargeError } = await president.client.from("charges").insert({
    association_id: associationId, unit_id: unit2, kind: "charge", label: "Key fob", amount_cents: 2000, due_on: day(0),
  }).select().single();
  check("and can still insert a charge", !chargeError && Boolean(extraCharge?.id), chargeError?.message ?? "");

  check("charges: an update is refused", await refusedUpdate(president.client, "charges", "id", charge.id, { amount_cents: 1 }));
  check("charges: a delete is refused", await refusedDelete(president.client, "charges", "id", charge.id));
  check("charges: the new line cannot be edited or removed either",
    (await refusedUpdate(president.client, "charges", "id", extraCharge.id, { label: "Changed" })) &&
    (await refusedDelete(president.client, "charges", "id", extraCharge.id)));
  check("ledger_entries: an update is refused", await refusedUpdate(president.client, "ledger_entries", "id", bankLine.id, { amount_cents: -1 }));
  check("ledger_entries: confirming by hand is refused", await refusedUpdate(president.client, "ledger_entries", "id", bankLine.id, { confirmed_at: new Date().toISOString() }));
  check("ledger_entries: a delete is refused", await refusedDelete(president.client, "ledger_entries", "id", bankLine.id));
  check("payments: an update is refused", await refusedUpdate(president.client, "payments", "id", payment.id, { amount_cents: 1 }));
  check("payments: a delete is refused", await refusedDelete(president.client, "payments", "id", payment.id));
  check("payment_allocations: an update is refused", await refusedUpdate(president.client, "payment_allocations", "payment_id", allocation.payment_id, { amount_cents: 1 }));
  check("payment_allocations: a delete is refused", await refusedDelete(president.client, "payment_allocations", "payment_id", allocation.payment_id));

  const { data: chargeNow } = await admin.from("charges").select("amount_cents, label").eq("id", charge.id).single();
  const { data: extraNow } = await admin.from("charges").select("label").eq("id", extraCharge.id).single();
  const { data: lineNow } = await admin.from("ledger_entries").select("amount_cents, confirmed_at").eq("id", bankLine.id).single();
  const { data: paymentNow } = await admin.from("payments").select("amount_cents").eq("id", payment.id).single();
  const { data: allocationNow } = await admin.from("payment_allocations").select("amount_cents").eq("payment_id", allocation.payment_id).single();
  check("every row reads back unchanged",
    chargeNow?.amount_cents === charge.amount_cents && extraNow?.label === "Key fob" &&
      lineNow?.amount_cents === -2500 && lineNow?.confirmed_at === null &&
      paymentNow?.amount_cents === payment.amount_cents && allocationNow?.amount_cents === allocation.amount_cents,
    JSON.stringify({ chargeNow, extraNow, lineNow, paymentNow, allocationNow }));

  // A home that has a statement still cannot be removed, so no delete path is left.
  const { error: removeError } = await president.client.rpc("remove_household", { p_unit_id: unit2 });
  check("remove_household still refuses a home with a statement", Boolean(removeError), removeError?.message ?? "");

  // ------------------------------------------- functions that still write
  const { error: reverseCheckError } = await president.client.rpc("reverse_manual_payment", { p_payment_id: checkId, p_reason: "Bounced at the bank" });
  check("reverse_manual_payment still works for a finance holder", !reverseCheckError, reverseCheckError?.message ?? "");
  const { data: reversedPayment } = await admin.from("payments").select("state, refunded_cents").eq("id", checkId).single();
  check("and marked the payment refunded", reversedPayment?.state === "refunded" && reversedPayment?.refunded_cents === 6000, JSON.stringify(reversedPayment));

  const intent = `pi_appendonly_${stamp}`;
  const { data: stripePaymentId, error: stripeError } = await admin.rpc("record_payment", {
    p_unit_id: unit2, p_amount_cents: 5000, p_rail: "card", p_stripe_payment_intent_id: intent,
  });
  check("the service role records a card payment", !stripeError && Boolean(stripePaymentId), stripeError?.message ?? "");
  const { error: refundError } = await admin.rpc("record_refund", { p_stripe_payment_intent_id: intent, p_amount_cents: 2000 });
  check("record_refund still works for the service role", !refundError, refundError?.message ?? "");
  const { data: refunded } = await admin.from("payments").select("refunded_cents").eq("id", stripePaymentId).single();
  check("and the payment shows what was refunded", refunded?.refunded_cents === 2000, JSON.stringify(refunded));

  // ---------------------------------------------------- reverse a ledger line
  const { error: shortReason } = await president.client.rpc("reverse_ledger_entry", { p_entry_id: bankLine.id, p_reason: "x" });
  check("reverse_ledger_entry wants a reason of three characters or more", Boolean(shortReason), shortReason?.message ?? "");
  const { error: signedOut } = await anon().rpc("reverse_ledger_entry", { p_entry_id: bankLine.id, p_reason: "Entered twice" });
  check("and refuses a caller with no session", Boolean(signedOut), signedOut?.message ?? "");

  const { data: reversalId, error: reverseError } = await president.client.rpc("reverse_ledger_entry", { p_entry_id: bankLine.id, p_reason: "Entered twice" });
  check("a finance holder reverses a ledger line", !reverseError && Boolean(reversalId), reverseError?.message ?? "");
  const { data: reversal } = await admin.from("ledger_entries").select("*").eq("id", reversalId).single();
  check("the reversal is the opposite amount, confirmed, and points at the line",
    reversal?.amount_cents === 2500 && reversal?.reversed_entry_id === bankLine.id && reversal?.confirmed_at !== null &&
      reversal?.description === "Reversal: Copy paper" && reversal?.category === "Office",
    JSON.stringify(reversal));
  const { data: originalNow } = await admin.from("ledger_entries").select("amount_cents, confirmed_at, description").eq("id", bankLine.id).single();
  check("the original is left exactly as it was", originalNow?.amount_cents === -2500 && originalNow?.confirmed_at === null && originalNow?.description === "Copy paper", JSON.stringify(originalNow));

  const { error: twice } = await president.client.rpc("reverse_ledger_entry", { p_entry_id: bankLine.id, p_reason: "Again" });
  check("a second reversal of the same line is refused", Boolean(twice), twice?.message ?? "");
  const { error: ofReversal } = await president.client.rpc("reverse_ledger_entry", { p_entry_id: reversalId, p_reason: "Undo it" });
  check("a reversal of a reversal is refused", Boolean(ofReversal), ofReversal?.message ?? "");
  const { data: paymentLine } = await admin.from("ledger_entries").select("id").eq("payment_id", stripePaymentId).limit(1).single();
  const { error: paymentLineError } = await president.client.rpc("reverse_ledger_entry", { p_entry_id: paymentLine.id, p_reason: "Wrong line" });
  check("a line that belongs to a payment is refused", Boolean(paymentLineError), paymentLineError?.message ?? "");
  const { count: reversalCount } = await admin.from("ledger_entries").select("id", { count: "exact", head: true }).eq("reversed_entry_id", bankLine.id);
  check("one reversal exists for the line", reversalCount === 1, String(reversalCount));

  const { data: reverseActivity } = await admin.from("activity").select("summary, actor_id").eq("subject_id", reversalId);
  check("the activity record carries the reason and names the person",
    (reverseActivity ?? []).some((a) => a.summary.includes("Entered twice") && a.actor_id === president.id),
    JSON.stringify(reverseActivity));

  // ------------------------------------------------------- confirm a bank line
  const { data: waiting } = await president.client.from("ledger_entries").insert({
    association_id: associationId, occurred_on: day(-1), description: "Feed line", counterparty: "Water Dept",
    category: "Misc", amount_cents: -9000,
  }).select().single();
  const { error: signedOutConfirm } = await anon().rpc("confirm_ledger_entry", { p_entry_id: waiting.id });
  check("confirm_ledger_entry refuses a caller with no session", Boolean(signedOutConfirm), signedOutConfirm?.message ?? "");
  const { error: confirmError } = await president.client.rpc("confirm_ledger_entry", { p_entry_id: waiting.id, p_category: "Utilities" });
  check("a finance holder confirms a bank line", !confirmError, confirmError?.message ?? "");
  const { data: confirmed } = await admin.from("ledger_entries").select("confirmed_at, category, amount_cents").eq("id", waiting.id).single();
  check("it is confirmed, in the category chosen, for the same amount",
    confirmed?.confirmed_at !== null && confirmed?.category === "Utilities" && confirmed?.amount_cents === -9000, JSON.stringify(confirmed));
  const { error: confirmAgain } = await president.client.rpc("confirm_ledger_entry", { p_entry_id: waiting.id });
  check("confirming twice is refused", Boolean(confirmAgain), confirmAgain?.message ?? "");
  const { data: confirmActivity } = await admin.from("activity").select("summary, actor_id").eq("subject_id", waiting.id);
  check("the confirmation is in the activity record", (confirmActivity ?? []).some((a) => a.summary.includes("confirmed") && a.actor_id === president.id), JSON.stringify(confirmActivity));
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  for (const id of cleanup.associations) {
    // A cleanup that fails leaves this association in the live project,
    // where the dues cron goes on billing it. So it fails the run. The
    // service role passes the append-only trigger, so the cascade is allowed.
    const { error } = await admin.from("associations").delete().eq("id", id);
    if (error) check("cleanup removed the association", false, error.message);
  }
  for (const id of cleanup.users) await admin.auth.admin.deleteUser(id).catch(() => {});
}

for (const r of results) console.log(`${r.p ? "  ok  " : "FAIL  "}${r.n}${r.d ? `  (${r.d})` : ""}`);
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
