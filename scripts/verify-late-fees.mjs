/**
 * Late fees post once, only when owed, only past the policy's notice day.
 *
 * Founds a throwaway association, bills a period forty days ago, and runs
 * assess_late_fees the way the cron does. Then pays one home and runs it
 * again. A new association has no policy and so no late fee until the board
 * sets one (0079); the checks that expect a fee set $25 after 30 days first.
 * Pure Supabase; cleaned up at the end.
 */
import { createHarness, day } from "./lib/harness.mjs";

const {
  admin, stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "latefee-",
  emailTag: "latefee",
});

try {
  const president = await makeUser("president");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Late Fee Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Robin Owner", email: `robin-latefee-${stamp}@example.com`, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  // Books start early enough that a bill dated forty days ago is allowed.
  await admin.from("associations").update({ billing_starts_on: day(-60) }).eq("id", associationId);

  const { data: billed } = await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Test dues", p_due_on: day(-40) });
  check("two homes were billed forty days ago", billed === 2, String(billed));

  const { data: units } = await admin.from("units").select("id, label").eq("association_id", associationId).order("label");
  const unitA = units[0].id, unitB = units[1].id;

  // Before the notice day: nothing.
  const { data: early } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(-20) });
  check("no fee before the notice day", early === 0, String(early));

  // An association that has set no policy charges no fee, however late (0079).
  const { data: unset } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  const { data: unsetFees } = await admin.from("charges").select("id").eq("association_id", associationId).eq("category", "late_fee");
  check("an association with no policy set posts no fee", unset === 0 && (unsetFees ?? []).length === 0, `${unset}, ${(unsetFees ?? []).length} lines`);

  // The board sets $25 after 30 days, which is what the checks below expect.
  const { error: setError } = await admin.from("associations").update({ settings: { collectionPolicy: { lateNoticeDay: 30, lateFeeCents: 2500 } } }).eq("id", associationId);
  check("a fee of $25 after 30 days is set", !setError, setError?.message ?? "");

  // Past it: one fee per unpaid home, once.
  const { data: first, error: firstError } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("one fee per unpaid home past the notice day", !firstError && first === 2, firstError?.message ?? String(first));
  const { data: again } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("a second run the same day posts nothing", again === 0, String(again));
  const { data: fees } = await admin.from("charges").select("unit_id, label, amount_cents, category").eq("association_id", associationId).eq("category", "late_fee");
  check("fees are $25 lines labelled after the period", (fees ?? []).length === 2 && fees.every((f) => f.amount_cents === 2500 && f.label === "Late fee, Test dues"), JSON.stringify(fees));

  // A home that paid before the notice day gets no fee. Bill a fresh period
  // and pay one home in full, then run past the notice day.
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Second dues", p_due_on: day(-35) });
  await admin.rpc("record_payment", { p_unit_id: unitA, p_amount_cents: 22500, p_rail: "ach", p_processor_fee_cents: 0 });
  const { data: second } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  const { data: feesB } = await admin.from("charges").select("unit_id").eq("association_id", associationId).eq("category", "late_fee").eq("label", "Late fee, Second dues");
  check("only the unpaid home gets the second period's fee", second === 1 && (feesB ?? []).length === 1 && feesB[0].unit_id === unitB, `${second}, ${JSON.stringify(feesB)}`);

  // A home that paid ahead owes nothing when the bill arrives, and gets no
  // fee. The payment was made before the line existed, so nothing was ever
  // applied to it; reading "unpaid" off those rows fined a paid up home
  // every month its credit lasted (fixed in 0062).
  await admin.rpc("record_payment", { p_unit_id: unitA, p_amount_cents: 10000, p_rail: "ach", p_processor_fee_cents: 0 });
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Fourth dues", p_due_on: day(-31) });
  const { data: ahead } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  const { data: feesD } = await admin.from("charges").select("unit_id").eq("association_id", associationId).eq("category", "late_fee").eq("label", "Late fee, Fourth dues");
  check("a home that paid ahead gets no fee", ahead === 1 && (feesD ?? []).length === 1 && feesD[0].unit_id === unitB, `${ahead}, ${JSON.stringify(feesD)}`);

  // A bank payment still clearing holds the fee off until it lands or fails.
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Fifth dues", p_due_on: day(-30) });
  const { data: pendingRow } = await admin.from("payments").insert({
    association_id: associationId, unit_id: unitB, amount_cents: 47500, rail: "ach", state: "pending",
  }).select("id").single();
  const { data: held } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  const { data: feesE } = await admin.from("charges").select("unit_id").eq("association_id", associationId).eq("category", "late_fee").eq("label", "Late fee, Fifth dues");
  check("a payment still clearing holds the fee off", (feesE ?? []).every((f) => f.unit_id !== unitB), `${held}, ${JSON.stringify(feesE)}`);
  await admin.from("payments").update({ state: "failed" }).eq("id", pendingRow?.id ?? "");
  const { data: after } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("and it posts once that payment fails", after === 1, String(after));

  // A balance brought forward from another system never draws a fee (0087),
  // while dues billed here on the same home still do. A second association,
  // so the home's statement holds nothing but these two lines.
  const { data: movedId, error: movedError } = await president.client.rpc("create_association", {
    p_name: "Late Fee Moved-in HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [],
  });
  if (movedError) throw new Error(movedError.message);
  cleanup.associations.push(movedId);
  await admin.from("associations").update({
    billing_starts_on: day(-60),
    settings: { collectionPolicy: { lateNoticeDay: 30, lateFeeCents: 2500 } },
  }).eq("id", movedId);
  const { data: movedUnits } = await admin.from("units").select("id").eq("association_id", movedId);
  const { error: broughtError } = await admin.from("charges").insert({
    association_id: movedId, unit_id: movedUnits[0].id, kind: "charge", category: "dues",
    label: "Balance brought forward", amount_cents: 50000, due_on: day(-200),
  });
  check("a starting balance is on the statement", !broughtError, broughtError?.message ?? "");
  const { data: onOld } = await admin.rpc("assess_late_fees", { p_association_id: movedId, p_today: day(0) });
  check("a starting balance draws no late fee, however old", onOld === 0, String(onOld));
  await admin.rpc("issue_assessment", { p_association_id: movedId, p_label: "Moved-in dues", p_due_on: day(-40) });
  const { data: onDues } = await admin.rpc("assess_late_fees", { p_association_id: movedId, p_today: day(0) });
  const { data: movedFees } = await admin.from("charges").select("label").eq("association_id", movedId).eq("category", "late_fee");
  check(
    "dues billed here on the same home still draw one",
    onDues === 1 && (movedFees ?? []).length === 1 && movedFees[0].label === "Late fee, Moved-in dues",
    `${onDues}, ${JSON.stringify(movedFees)}`,
  );

  // A check that is reversed leaves the dues it paid unpaid, and late (0091).
  // A third association, so the statement is dues, the check and its reversal.
  const { data: bouncedId, error: bouncedError } = await president.client.rpc("create_association", {
    p_name: "Late Fee Bounced Check HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [],
  });
  if (bouncedError) throw new Error(bouncedError.message);
  cleanup.associations.push(bouncedId);
  await admin.from("associations").update({
    billing_starts_on: day(-60),
    settings: { collectionPolicy: { lateNoticeDay: 30, lateFeeCents: 2500 } },
  }).eq("id", bouncedId);
  const { data: bouncedUnits } = await admin.from("units").select("id").eq("association_id", bouncedId);
  await admin.rpc("issue_assessment", { p_association_id: bouncedId, p_label: "Bounced dues", p_due_on: day(-40) });
  const { data: checkId, error: checkError } = await president.client.rpc("record_manual_payment", {
    p_unit_id: bouncedUnits[0].id, p_amount_cents: 10000, p_method: "check", p_reference: "2201", p_received_on: day(-1),
  });
  check("a check pays the dues", !checkError && Boolean(checkId), checkError?.message ?? "");
  const { data: whilePaid } = await admin.rpc("assess_late_fees", { p_association_id: bouncedId, p_today: day(0) });
  check("paid dues draw no fee", whilePaid === 0, String(whilePaid));
  const { error: reverseError } = await president.client.rpc("reverse_manual_payment", { p_payment_id: checkId, p_reason: "Returned by the bank" });
  check("the check is reversed", !reverseError, reverseError?.message ?? "");
  const { data: afterBounce } = await admin.rpc("assess_late_fees", { p_association_id: bouncedId, p_today: day(0) });
  const { data: bouncedFees } = await admin.from("charges").select("label").eq("association_id", bouncedId).eq("category", "late_fee");
  check(
    "the dues it had paid are late again, once",
    afterBounce === 1 && (bouncedFees ?? []).length === 1 && bouncedFees[0].label === "Late fee, Bounced dues",
    `${afterBounce}, ${JSON.stringify(bouncedFees)}`,
  );

  // The board's own policy is honoured: no fee when it says zero.
  const { error: policyError } = await admin.from("associations").update({ settings: { collectionPolicy: { lateFeeCents: 0 } } }).eq("id", associationId);
  check("the policy change is saved", !policyError, policyError?.message ?? "");
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Third dues", p_due_on: day(-45) });
  const { data: none } = await admin.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("a policy with no fee posts none", none === 0, String(none));

  // A resident cannot run it.
  const resident = await makeUser("resident");
  const { error: refused } = await resident.client.rpc("assess_late_fees", { p_association_id: associationId, p_today: day(0) });
  check("someone without finances is refused", Boolean(refused), refused?.message ?? "allowed");
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
