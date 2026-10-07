/**
 * The monthly rollups (0108) agree with the rows, through every way a row
 * changes: a charge written by a function, a bank line held then confirmed,
 * a reversal, a service-role delete, a bank account deleted from under its
 * lines. Then association_overview reads the same sums the old query did,
 * and an owner's statement months stay their own.
 *
 * The check throughout is one invariant: the rollup equals a fresh group-by
 * over the rows. If it ever drifts, a report in June would disagree with the
 * same report run in March, which is the thing the rollups must never do.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  admin, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "rollups-",
  emailTag: "rollups",
  claimSeats: true,
});

const monthOf = (d) => `${d.slice(0, 7)}-01`;

/** The rollup rows and a group-by over the raw rows, both as sorted JSON. */
async function ledgerAgrees(associationId) {
  const { data: rolled } = await admin.from("ledger_months").select("month, bank_account_id, category, in_cents, out_cents, line_count").eq("association_id", associationId);
  const { data: rows } = await admin.from("ledger_entries").select("occurred_on, bank_account_id, category, amount_cents, confirmed_at").eq("association_id", associationId);
  const sums = new Map();
  for (const r of rows ?? []) {
    if (!r.confirmed_at) continue;
    const key = `${monthOf(r.occurred_on)}|${r.bank_account_id ?? ""}|${r.category}`;
    const s = sums.get(key) ?? { in_cents: 0, out_cents: 0, line_count: 0 };
    s.in_cents += Math.max(r.amount_cents, 0);
    s.out_cents += Math.max(-r.amount_cents, 0);
    s.line_count += 1;
    sums.set(key, s);
  }
  const fromRows = [...sums.entries()].map(([k, s]) => `${k}|${s.in_cents}|${s.out_cents}|${s.line_count}`).sort();
  const fromRollup = (rolled ?? []).map((m) => `${m.month}|${m.bank_account_id ?? ""}|${m.category}|${m.in_cents}|${m.out_cents}|${m.line_count}`).sort();
  const same = JSON.stringify(fromRows) === JSON.stringify(fromRollup);
  return { same, detail: same ? `${fromRollup.length} rows` : `rows ${JSON.stringify(fromRows)} rollup ${JSON.stringify(fromRollup)}` };
}

async function statementsAgree(associationId) {
  const { data: rolled } = await admin.from("statement_months").select("unit_id, month, kind, cents, line_count").eq("association_id", associationId);
  const { data: rows } = await admin.from("charges").select("unit_id, due_on, kind, amount_cents").eq("association_id", associationId);
  const sums = new Map();
  for (const r of rows ?? []) {
    const key = `${r.unit_id}|${monthOf(r.due_on)}|${r.kind}`;
    const s = sums.get(key) ?? { cents: 0, line_count: 0 };
    s.cents += r.amount_cents;
    s.line_count += 1;
    sums.set(key, s);
  }
  const fromRows = [...sums.entries()].map(([k, s]) => `${k}|${s.cents}|${s.line_count}`).sort();
  const fromRollup = (rolled ?? []).map((m) => `${m.unit_id}|${m.month}|${m.kind}|${m.cents}|${m.line_count}`).sort();
  const same = JSON.stringify(fromRows) === JSON.stringify(fromRollup);
  return { same, detail: same ? `${fromRollup.length} rows` : `rows ${JSON.stringify(fromRows)} rollup ${JSON.stringify(fromRollup)}` };
}

try {
  const president = await makeUser("president");
  const neighbor = await makeUser("neighbor");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Rollups Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Nina Neighbor", email: neighbor.email, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await admin.from("associations").update({ billing_starts_on: "2024-01-01" }).eq("id", associationId);
  await neighbor.client.rpc("claim_my_seats");
  const { data: units } = await admin.from("units").select("id, label").eq("association_id", associationId).order("label");
  const unit1 = units.find((u) => u.label === "1").id;
  const unit2 = units.find((u) => u.label === "2").id;

  // ------------------------------------------------------ statement lines
  const { data: billed } = await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Dues", p_due_on: "2024-03-01" });
  check("both homes were billed in the past", billed === 2, String(billed));
  let s = await statementsAgree(associationId);
  check("statement months follow an assessment", s.same, s.detail);

  const { data: checkId, error: checkError } = await president.client.rpc("record_manual_payment", {
    p_unit_id: unit2, p_amount_cents: 6000, p_method: "check", p_reference: "3001", p_received_on: "2024-03-10",
  });
  check("a check is recorded", !checkError && Boolean(checkId), checkError?.message ?? "");
  s = await statementsAgree(associationId);
  check("statement months follow a payment", s.same, s.detail);

  const { error: reverseError } = await president.client.rpc("reverse_manual_payment", { p_payment_id: checkId, p_reason: "Bounced" });
  check("the check is reversed", !reverseError, reverseError?.message ?? "");
  s = await statementsAgree(associationId);
  check("statement months follow a reversal", s.same, s.detail);

  // The service role may still delete a row (a repair); the sum follows.
  const { data: fee } = await admin.from("charges").insert({
    association_id: associationId, unit_id: unit1, kind: "charge", category: "late_fee", label: "Late fee", amount_cents: 2500, due_on: "2024-04-01",
  }).select("id").single();
  const { error: deleteError } = await admin.from("charges").delete().eq("id", fee.id);
  check("a service-role delete is allowed", !deleteError, deleteError?.message ?? "");
  s = await statementsAgree(associationId);
  check("statement months follow a delete, and the empty month is gone", s.same, s.detail);
  const { data: aprilRows } = await admin.from("statement_months").select("month").eq("association_id", associationId).eq("month", "2024-04-01");
  check("no row is left at zero", (aprilRows ?? []).length === 0, String((aprilRows ?? []).length));

  // ---------------------------------------------------------- ledger lines
  const { data: bank } = await admin.from("bank_accounts").insert({ association_id: associationId, kind: "operating", institution: "Test Bank", mask: "0001" }).select("id").single();
  const { data: lines, error: linesError } = await admin.from("ledger_entries").insert([
    { association_id: associationId, bank_account_id: bank.id, occurred_on: "2024-02-15", description: "Held", counterparty: "", category: "Landscaping", amount_cents: -999 },
    { association_id: associationId, bank_account_id: bank.id, occurred_on: "2024-02-16", description: "Confirmed", counterparty: "", category: "Landscaping", amount_cents: -700, confirmed_at: new Date().toISOString() },
    { association_id: associationId, bank_account_id: bank.id, occurred_on: "2024-02-20", description: "Deposit", counterparty: "", category: "Assessments", amount_cents: 12000, confirmed_at: new Date().toISOString() },
    { association_id: associationId, bank_account_id: bank.id, occurred_on: "2024-05-03", description: "Interest", counterparty: "", category: "Interest income", amount_cents: 45, confirmed_at: new Date().toISOString() },
  ]).select("id, description");
  check("four bank lines are written", !linesError && lines.length === 4, linesError?.message ?? "");
  let l = await ledgerAgrees(associationId);
  // The check and its reversal wrote lines of their own; the held one is not in.
  check("ledger months hold confirmed lines only", l.same, l.detail);

  const held = lines.find((x) => x.description === "Held").id;
  const { error: confirmError } = await president.client.rpc("confirm_ledger_entry", { p_entry_id: held });
  check("the held line is confirmed", !confirmError, confirmError?.message ?? "");
  l = await ledgerAgrees(associationId);
  check("ledger months pick up the confirmation", l.same, l.detail);

  const { error: entryReverseError } = await president.client.rpc("reverse_ledger_entry", { p_entry_id: held, p_reason: "Duplicate" });
  check("the line is reversed", !entryReverseError, entryReverseError?.message ?? "");
  l = await ledgerAgrees(associationId);
  check("ledger months follow a reversal", l.same, l.detail);

  // ------------------------------------------- the overview reads the sums
  const { data: overview, error: overviewError } = await president.client.rpc("association_overview", { p_association_id: associationId, p_from: "2024-05-01" });
  check("the overview answers", !overviewError, overviewError?.message ?? "");
  const feb = (overview?.ledger?.months ?? []).find((m) => m.month === "2024-02" && m.category === "Landscaping");
  // Held (-999, confirmed) and Confirmed (-700) in February; the reversal
  // is dated today, so it lands in the loaded window, not here. The same
  // goes for the check's reversal under statements below.
  check("February landscaping is summed from the rollup", feb && Number(feb.in_cents) === 0 && Number(feb.out_cents) === 1699 && feb.count === 2,
    JSON.stringify(feb));
  const may = (overview?.ledger?.months ?? []).find((m) => m.month === "2024-05");
  check("the month the window starts in is left to the rows", !may, JSON.stringify(may));
  const account = (overview?.ledger?.accounts ?? [])[0];
  check("the account balance is the confirmed sum", account && Number(account.balance_cents) === 12000 - 700 - 999 + 999 + 45, JSON.stringify(account));
  const marchCharges = (overview?.statements?.months ?? []).find((m) => m.month === "2024-03" && m.kind === "charge");
  const marchPayments = (overview?.statements?.months ?? []).find((m) => m.month === "2024-03" && m.kind === "payment");
  check("March statements are summed from the rollup", marchCharges && Number(marchCharges.cents) === 12000 && marchCharges.count === 2
    && marchPayments && Number(marchPayments.cents) === -6000 && marchPayments.count === 1,
    JSON.stringify([marchCharges, marchPayments]));

  // A day in the middle of a month rounds down, so no month is counted twice.
  const { data: midOverview } = await president.client.rpc("association_overview", { p_association_id: associationId, p_from: "2024-02-18" });
  const midFeb = (midOverview?.ledger?.months ?? []).find((m) => m.month === "2024-02");
  check("a mid-month window start leaves that month to the rows", !midFeb, JSON.stringify(midFeb));

  // ------------------------------------------------- an owner's own months
  const { data: ownMonths } = await neighbor.client.from("statement_months").select("unit_id").eq("association_id", associationId);
  check("an owner reads their own statement months and no neighbour's",
    (ownMonths ?? []).length >= 1 && (ownMonths ?? []).every((m) => m.unit_id === unit2), JSON.stringify((ownMonths ?? []).map((m) => m.unit_id === unit2)));
  const { data: ownLedger } = await neighbor.client.from("ledger_months").select("month").eq("association_id", associationId);
  check("and no ledger months", (ownLedger ?? []).length === 0, String((ownLedger ?? []).length));
  const { error: writeError } = await neighbor.client.from("statement_months").insert({ association_id: associationId, unit_id: unit2, month: "2024-01-01", kind: "credit", cents: -5000, line_count: 1 });
  check("nobody writes a rollup by hand", Boolean(writeError), writeError?.message ?? "no error");

  // ------------------------------ a bank account deleted from under lines
  const { error: bankDeleteError } = await admin.from("bank_accounts").delete().eq("id", bank.id);
  check("the bank account is deleted", !bankDeleteError, bankDeleteError?.message ?? "");
  l = await ledgerAgrees(associationId);
  check("ledger months follow the lines to no account", l.same && (await admin.from("ledger_months").select("bank_account_id").eq("association_id", associationId)).data.every((m) => m.bank_account_id === null), l.detail);
} catch (error) {
  check("the run finished", false, error.message);
} finally {
  await cleanupAll();
}

report();
