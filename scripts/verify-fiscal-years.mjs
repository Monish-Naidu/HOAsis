/**
 * The fiscal year closes (0109). An association with two years of money
 * and a July fiscal year: the daily job closes every year that ended and
 * none that has not; the row's figures match the rollups; a second run
 * closes nothing; a late-dated line does not move a closed year; a finance
 * holder reopens with a reason and closes again with the new figures; a
 * resident can do neither; the activity log has all three.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  admin, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "fiscal-",
  emailTag: "fiscal",
  claimSeats: true,
});

const thisYear = new Date().getUTCFullYear();

try {
  const president = await makeUser("president");
  const neighbor = await makeUser("neighbor");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Fiscal Years Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 10000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Nina Neighbor", email: neighbor.email, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await neighbor.client.rpc("claim_my_seats");
  // Fiscal year from July 1, and billing far enough back for two full years.
  const y0 = thisYear - 3;
  await admin.from("associations").update({ billing_starts_on: `${y0}-07-01`, fiscal_year_start: "07-01" }).eq("id", associationId);
  const { data: bank } = await admin.from("bank_accounts").insert({ association_id: associationId, kind: "operating", institution: "Test Bank", mask: "0002" }).select("id").single();

  // Year A: y0-07-01 to y0+1-06-30. Year B: y0+1-07-01 to y0+2-06-30.
  // Both ended; the year after B is the one we are in, or has ended too
  // if today is past June 30, which is why the counts below are "at least".
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Dues", p_due_on: `${y0}-08-01` });
  await admin.rpc("issue_assessment", { p_association_id: associationId, p_label: "Dues", p_due_on: `${y0 + 1}-09-01` });
  await admin.from("ledger_entries").insert([
    { association_id: associationId, bank_account_id: bank.id, occurred_on: `${y0}-08-05`, description: "Dues deposit", counterparty: "", category: "Assessments", amount_cents: 20000, confirmed_at: new Date().toISOString() },
    { association_id: associationId, bank_account_id: bank.id, occurred_on: `${y0 + 1}-03-10`, description: "Mowing", counterparty: "Cascade Grounds", category: "Landscaping", amount_cents: -4500, confirmed_at: new Date().toISOString() },
    { association_id: associationId, bank_account_id: bank.id, occurred_on: `${y0 + 1}-09-05`, description: "Dues deposit", counterparty: "", category: "Assessments", amount_cents: 10000, confirmed_at: new Date().toISOString() },
    { association_id: associationId, bank_account_id: bank.id, occurred_on: `${y0 + 1}-09-06`, description: "Held", counterparty: "", category: "Landscaping", amount_cents: -100 },
  ]);

  const { data: firstStart } = await admin.rpc("fiscal_year_start_for", { p_association_id: associationId, p_day: `${y0}-08-01` });
  check("the fiscal year containing August starts the July before", firstStart === `${y0}-07-01`, String(firstStart));
  const { data: juneStart } = await admin.rpc("fiscal_year_start_for", { p_association_id: associationId, p_day: `${y0 + 1}-06-30` });
  check("and June 30 is still that year", juneStart === `${y0}-07-01`, String(juneStart));

  // ------------------------------------------------------ the daily job
  const { error: residentCloseError } = await president.client.rpc("close_ended_fiscal_years");
  check("a person cannot run the job", residentCloseError?.code === "42501", residentCloseError?.message ?? "no error");

  const { data: closedCount, error: jobError } = await admin.rpc("close_ended_fiscal_years");
  check("the job closes the ended years", !jobError && closedCount >= 2, jobError?.message ?? String(closedCount));
  const { data: years } = await admin.from("fiscal_years").select("*").eq("association_id", associationId).order("starts_on");
  const yearA = (years ?? []).find((y) => y.starts_on === `${y0}-07-01`);
  const yearB = (years ?? []).find((y) => y.starts_on === `${y0 + 1}-07-01`);
  check("year A is closed with its dates", yearA && yearA.ends_on === `${y0 + 1}-06-30` && yearA.closed_by === null, JSON.stringify(yearA && [yearA.starts_on, yearA.ends_on]));
  check("year A: in, out, billed, collected", yearA && Number(yearA.in_cents) === 20000 && Number(yearA.out_cents) === 4500
    && Number(yearA.billed_cents) === 20000 && Number(yearA.collected_cents) === 0,
    JSON.stringify(yearA && [yearA.in_cents, yearA.out_cents, yearA.billed_cents, yearA.collected_cents]));
  const accountA = yearA?.accounts?.[0];
  check("year A: the account opened at zero and closed at the net", accountA && Number(accountA.opening_cents) === 0 && Number(accountA.closing_cents) === 15500, JSON.stringify(yearA?.accounts));
  const accountB = yearB?.accounts?.[0];
  check("year B: opened where A closed, the held line not counted", accountB && Number(accountB.opening_cents) === 15500 && Number(accountB.closing_cents) === 25500, JSON.stringify(yearB?.accounts));
  check("year B: categories carry the assessments only", yearB && yearB.categories.length === 1 && yearB.categories[0].category === "Assessments" && Number(yearB.categories[0].in_cents) === 10000,
    JSON.stringify(yearB?.categories));
  const { data: noYearBefore } = await admin.from("fiscal_years").select("starts_on").eq("association_id", associationId).lt("starts_on", `${y0}-07-01`);
  check("no year before the first money row is closed", (noYearBefore ?? []).length === 0, String((noYearBefore ?? []).length));
  const { data: currentStart } = await admin.rpc("fiscal_year_start_for", { p_association_id: associationId, p_day: new Date().toISOString().slice(0, 10) });
  const { data: openYear } = await admin.from("fiscal_years").select("starts_on").eq("association_id", associationId).eq("starts_on", currentStart);
  check("the year we are in is not closed", (openYear ?? []).length === 0, String(currentStart));

  const { data: secondRun } = await admin.rpc("close_ended_fiscal_years");
  const { data: othersClosed } = await admin.from("fiscal_years").select("association_id").eq("association_id", associationId);
  check("a second run closes nothing more here", (othersClosed ?? []).length === (years ?? []).length, `${secondRun} closed in all, ${(othersClosed ?? []).length} rows here`);

  // --------------------------------------- a closed year does not move
  await admin.from("ledger_entries").insert({ association_id: associationId, bank_account_id: bank.id, occurred_on: `${y0 + 1}-02-01`, description: "Late-found receipt", counterparty: "", category: "Repairs", amount_cents: -1000, confirmed_at: new Date().toISOString() });
  const { data: yearAAgain } = await admin.from("fiscal_years").select("out_cents").eq("association_id", associationId).eq("starts_on", `${y0}-07-01`).single();
  check("a line dated into a closed year leaves the row as it was", Number(yearAAgain.out_cents) === 4500, String(yearAAgain.out_cents));
  const { data: afterLine } = await admin.rpc("close_ended_fiscal_years");
  const { data: yearAStill } = await admin.from("fiscal_years").select("out_cents").eq("association_id", associationId).eq("starts_on", `${y0}-07-01`).single();
  check("and the job does not re-close it", Number(yearAStill.out_cents) === 4500, `${afterLine} closed, out ${yearAStill.out_cents}`);

  // ------------------------------------------------- reopen and re-close
  const { error: residentReopen } = await neighbor.client.rpc("reopen_fiscal_year", { p_association_id: associationId, p_starts_on: `${y0}-07-01`, p_reason: "Curious" });
  check("a resident cannot reopen a year", residentReopen?.code === "42501", residentReopen?.message ?? "no error");
  const { error: noReason } = await president.client.rpc("reopen_fiscal_year", { p_association_id: associationId, p_starts_on: `${y0}-07-01`, p_reason: " " });
  check("a reopen needs a reason", Boolean(noReason), noReason?.message ?? "no error");
  const { error: notClosed } = await president.client.rpc("reopen_fiscal_year", { p_association_id: associationId, p_starts_on: `${y0 - 1}-07-01`, p_reason: "Found a receipt" });
  check("a year that is not closed cannot be reopened", Boolean(notClosed), notClosed?.message ?? "no error");
  const { error: reopenError } = await president.client.rpc("reopen_fiscal_year", { p_association_id: associationId, p_starts_on: `${y0}-07-01`, p_reason: "Found a receipt" });
  check("a finance holder reopens with a reason", !reopenError, reopenError?.message ?? "");
  const { data: reopened } = await admin.from("fiscal_years").select("reopened_at, reopened_by, reopen_reason, out_cents").eq("association_id", associationId).eq("starts_on", `${y0}-07-01`).single();
  check("the row says who reopened it and why", reopened.reopened_at && reopened.reopened_by === president.id && reopened.reopen_reason === "Found a receipt" && Number(reopened.out_cents) === 4500,
    JSON.stringify(reopened));

  const { error: earlyClose } = await president.client.rpc("close_fiscal_year", { p_association_id: associationId, p_starts_on: currentStart });
  check("the year we are in cannot be closed", Boolean(earlyClose), earlyClose?.message ?? "no error");
  const { error: wrongDay } = await president.client.rpc("close_fiscal_year", { p_association_id: associationId, p_starts_on: `${y0}-08-01` });
  check("a day that is not the start of a year is refused", Boolean(wrongDay), wrongDay?.message ?? "no error");
  const { error: closeError } = await president.client.rpc("close_fiscal_year", { p_association_id: associationId, p_starts_on: `${y0}-07-01` });
  check("a finance holder closes it again by hand", !closeError, closeError?.message ?? "");
  const { data: reclosed } = await admin.from("fiscal_years").select("reopened_at, closed_by, out_cents, categories").eq("association_id", associationId).eq("starts_on", `${y0}-07-01`).single();
  check("the re-closed year carries the correction and names who closed it", reclosed.reopened_at === null && reclosed.closed_by === president.id && Number(reclosed.out_cents) === 5500
    && reclosed.categories.some((c) => c.category === "Repairs"), JSON.stringify(reclosed));

  const { data: ownYears } = await neighbor.client.from("fiscal_years").select("starts_on").eq("association_id", associationId);
  check("a resident reads no fiscal years", (ownYears ?? []).length === 0, String((ownYears ?? []).length));
  const { data: boardYears } = await president.client.from("fiscal_years").select("starts_on").eq("association_id", associationId);
  check("the board reads them", (boardYears ?? []).length === (years ?? []).length, String((boardYears ?? []).length));

  const { data: log } = await admin.from("activity").select("summary, actor_name").eq("association_id", associationId).eq("subject_kind", "fiscal_year").order("at");
  const summaries = (log ?? []).map((a) => a.summary);
  check("the activity log has the closes and the reopen",
    summaries.filter((s) => s.startsWith("Closed the fiscal year")).length >= 3 && summaries.filter((s) => s.startsWith("Reopened the fiscal year")).length === 1,
    JSON.stringify(summaries));
  check("the job's closes are the platform's, the hand close is the president's",
    (log ?? []).some((a) => a.actor_name === "Your HOAsis") && (log ?? []).some((a) => a.actor_name === "Pat Founder" || a.actor_name === "president"),
    JSON.stringify((log ?? []).map((a) => a.actor_name)));
} catch (error) {
  check("the run finished", false, error.message);
} finally {
  await cleanupAll();
}

report();
