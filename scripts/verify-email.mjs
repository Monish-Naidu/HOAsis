/**
 * The email rules, against the real database.
 *
 * The one that matters: an owner cannot unsubscribe from being told they owe
 * money. That is not a checkbox somewhere in a form, it is a constraint, so it
 * holds even when a bug or a forged link tries to write the row directly.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "./env.mjs";
import { createHarness, day } from "./lib/harness.mjs";

const {
  env, admin, stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "mail-",
  strictSignIn: false,
});

try {
  const behindEmail = `behind-${stamp}@example.com`;
  const president = await makeUser("president");
  const { data: associationId } = await president.client.rpc("create_association", {
    p_name: "Mailer HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Dana", p_founder_unit: "1",
    p_households: [
      { name: "Behind Bob", email: behindEmail, unit: "2" },
      { name: "No Email Nan", email: "", unit: "3" },
    ],
  });
  cleanup.associations.push(associationId);
  // Books open on the founding day unless told otherwise (0056); this suite
  // bills periods that fell due before today.
  await admin.from("associations").update({ billing_starts_on: day(-60) }).eq("id", associationId);
  await president.client.rpc("issue_assessment", {
    p_association_id: associationId, p_label: "Assessment", p_due_on: day(-5),
  });

  // The president pays theirs; unit 2 stays behind; unit 3 has no address.
  const { data: presUnits } = await president.client.rpc("my_unit_ids");
  await president.client.rpc("record_payment", {
    p_unit_id: presUnits[0], p_amount_cents: 6000, p_rail: "ach",
  });

  const { data: everyone } = await president.client.rpc("email_recipients", {
    p_association_id: associationId, p_category: "assessment", p_only_past_due: false,
  });
  check("an assessment run reaches every household we can reach",
    (everyone ?? []).length === 2, `${(everyone ?? []).length} recipients`);
  check("a household with no address is left out rather than failing the run",
    !(everyone ?? []).some((r) => !r.email), JSON.stringify((everyone ?? []).map((r) => r.unit_label)));

  const { data: behind } = await president.client.rpc("email_recipients", {
    p_association_id: associationId, p_category: "delinquency", p_only_past_due: true,
  });
  check("a past due run reaches only homes that owe",
    (behind ?? []).length === 1 && behind[0].unit_label === "2",
    JSON.stringify((behind ?? []).map((r) => `${r.unit_label}:${r.balance_cents}`)));

  // The mailer itself runs under the service role, which is nobody as far as
  // a view scoped to "my homes" can tell. It read every balance as zero, so
  // a past due run reached no one and the assessment email said $0.00 (0062).
  const { data: asServer } = await admin.rpc("email_recipients", {
    p_association_id: associationId, p_category: "delinquency", p_only_past_due: true,
  });
  check("the mailer, as the server, reaches the home that owes with its real balance",
    (asServer ?? []).length === 1 && asServer[0].unit_label === "2" && asServer[0].balance_cents === 6000,
    JSON.stringify((asServer ?? []).map((r) => `${r.unit_label}:${r.balance_cents}`)));

  // Opting out.
  const behindUser = await makeUser("behind");
  const { error: optionalError } = await behindUser.client
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "newsletter" });
  check("an owner can unsubscribe from the newsletter", !optionalError, optionalError?.message ?? "");

  const { error: statutoryError } = await behindUser.client
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "delinquency" });
  check("and cannot unsubscribe from being told they owe money",
    Boolean(statutoryError), statutoryError?.code ?? "no error");

  // Even with the service role, which is what a forged link would reach.
  const { error: adminForced } = await admin
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "assessment" });
  check("not even a server side write can switch off a statutory notice",
    Boolean(adminForced), adminForced?.code ?? "no error");

  const other = await makeUser("other");
  const { error: crossError } = await other.client
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "community" });
  check("nobody can unsubscribe somebody else", Boolean(crossError), crossError?.code ?? "no error");

  // A resident cannot pull the roster's addresses.
  const { data: residentList } = await behindUser.client.rpc("email_recipients", {
    p_association_id: associationId, p_category: "assessment", p_only_past_due: false,
  });
  check("a resident cannot pull the association's address list",
    (residentList ?? []).length === 0, `${(residentList ?? []).length} rows`);

  // The two conversational categories added in 0045 are the owner's to decline.
  const { error: messageOptOut } = await behindUser.client
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "message" });
  const { error: requestOptOut } = await behindUser.client
    .from("email_optouts").insert({ profile_id: behindUser.id, category: "request" });
  check("an owner can turn off board messages and request updates",
    !messageOptOut && !requestOptOut, messageOptOut?.message ?? requestOptOut?.message ?? "");
  const { data: afterOptOut } = await president.client.rpc("email_recipients", {
    p_association_id: associationId, p_category: "message", p_only_past_due: false,
  });
  check("and a message run then leaves them out",
    !(afterOptOut ?? []).some((r) => r.profile_id === behindUser.id),
    `${(afterOptOut ?? []).length} recipients`);
  const { data: letterRun } = await president.client.rpc("email_recipients", {
    p_association_id: associationId, p_category: "delinquency", p_only_past_due: true,
  });
  check("but a dues letter still reaches them",
    (letterRun ?? []).length === 1, `${(letterRun ?? []).length} recipients`);

  // The switch for the daily bill email (0100). A settings holder writes it;
  // a resident has no write policy on the row, so the update changes nothing.
  const { data: billsDefault } = await admin.from("associations").select("bills_by_email").eq("id", associationId).single();
  check("bills_by_email is on for a new association", billsDefault?.bills_by_email === true, String(billsDefault?.bills_by_email));
  const { error: billsError } = await president.client.from("associations")
    .update({ bills_by_email: false }).eq("id", associationId);
  const { data: billsOff } = await admin.from("associations").select("bills_by_email").eq("id", associationId).single();
  check("bills_by_email: a settings holder can turn it off", !billsError && billsOff?.bills_by_email === false,
    billsError?.message ?? String(billsOff?.bills_by_email));
  await behindUser.client.from("associations").update({ bills_by_email: true }).eq("id", associationId);
  const { data: billsAfterResident } = await admin.from("associations").select("bills_by_email").eq("id", associationId).single();
  check("bills_by_email: a resident is refused", billsAfterResident?.bills_by_email === false,
    String(billsAfterResident?.bills_by_email));
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

/* ------------------------------------------------------------ deliverability */

/**
 * Who production sends as.
 *
 * Resend's shared onboarding@resend.dev sender delivers to the account owner
 * and nobody else, and an empty EMAIL_FROM is refused outright, so either
 * one in production means every resident's mail is silently lost. The value
 * is read from Vercel when the CLI is linked, and from this shell when
 * VERCEL_ENV says this already is production.
 */
function senderProblem(from) {
  const value = (from ?? "").trim();
  if (!value) return "EMAIL_FROM is empty";
  const address = value.match(/<([^>]+)>/)?.[1] ?? value;
  if (address.toLowerCase().endsWith("@resend.dev")) return `EMAIL_FROM is the shared sender ${address}`;
  return null;
}

function productionSender() {
  if (process.env.VERCEL_ENV === "production") return { from: process.env.EMAIL_FROM, source: "this environment" };
  const dir = mkdtempSync(join(tmpdir(), "hoasis-env-"));
  try {
    const file = join(dir, "prod.env");
    execFileSync("vercel", ["env", "pull", "--environment=production", "--yes", file], { stdio: "ignore", timeout: 60_000 });
    return { from: loadEnv(new URL(`file://${file}`)).EMAIL_FROM, source: "Vercel production" };
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const production = productionSender();
if (production) {
  const problem = senderProblem(production.from);
  check(`production sends from a verified domain (${production.source})`, !problem,
    problem ? `${problem}. Verify yourhoasis.com in Resend and set EMAIL_FROM; see docs/email.md` : production.from);
} else {
  console.log("  note  could not read Vercel's production EMAIL_FROM (vercel CLI not linked); local value is "
    + JSON.stringify(env.EMAIL_FROM ?? ""));
}
const localProblem = senderProblem(env.EMAIL_FROM);
if (localProblem) console.log(`  note  .env.local: ${localProblem}, so local sends reach only the Resend account owner`);

report();
