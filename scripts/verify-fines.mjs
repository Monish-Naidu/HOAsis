/**
 * A fine is a charge on the home (0113): only after a hearing, by the
 * compliance capability, once per notice; the home's balance rises by the
 * fine, the notice says fined with the amount, the activity log names it;
 * a resident cannot fine; a credit reverses it the way any charge is.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  admin, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "fines-",
  emailTag: "fines",
  claimSeats: true,
});

try {
  const president = await makeUser("president");
  const resident = await makeUser("resident");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Fines Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Rae Resident", email: resident.email, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await resident.client.rpc("claim_my_seats");
  const { data: units } = await admin.from("units").select("id, label").eq("association_id", associationId);
  const unit2 = units.find((u) => u.label === "2").id;

  const balance = async () => {
    const { data } = await admin.from("charges").select("amount_cents").eq("unit_id", unit2);
    return (data ?? []).reduce((sum, c) => sum + c.amount_cents, 0);
  };
  const before = await balance();

  const { data: notice } = await admin.from("violations").insert({
    association_id: associationId, unit_id: unit2, unit_label: "2", reference: "V-FINE-1", rule: "Trash cans at the curb", stage: "courtesy",
  }).select("id").single();

  const { error: early } = await president.client.rpc("fine_violation", { p_violation_id: notice.id, p_amount_cents: 5000, p_note: "" });
  check("a fine before a hearing is refused", early?.code === "22023", early?.message ?? "no error");
  await admin.from("violations").update({ stage: "hearing" }).eq("id", notice.id);
  const { error: residentFine } = await resident.client.rpc("fine_violation", { p_violation_id: notice.id, p_amount_cents: 5000, p_note: "" });
  check("a resident cannot fine", residentFine?.code === "42501", residentFine?.message ?? "no error");
  const { error: tooSmall } = await president.client.rpc("fine_violation", { p_violation_id: notice.id, p_amount_cents: 50, p_note: "" });
  check("under a dollar is refused", tooSmall?.code === "22000", tooSmall?.message ?? "no error");

  const { data: chargeId, error: fineError } = await president.client.rpc("fine_violation", { p_violation_id: notice.id, p_amount_cents: 5000, p_note: "Second time this month" });
  check("the president fines $50 after the hearing", !fineError && Boolean(chargeId), fineError?.message ?? "");
  check("the home's balance rises by the fine", (await balance()) === before + 5000, String(await balance()));
  const { data: charge } = await admin.from("charges").select("category, label, kind").eq("id", chargeId).single();
  check("the charge is a fine with the rule in its label", charge.category === "fine" && charge.kind === "charge" && charge.label === "Fine: Trash cans at the curb", JSON.stringify(charge));
  const { data: row } = await admin.from("violations").select("stage, fine_cents, next_action_on").eq("id", notice.id).single();
  check("the notice says fined, with the amount and a next date", row.stage === "fined" && row.fine_cents === 5000 && Boolean(row.next_action_on), JSON.stringify(row));
  const { error: twice } = await president.client.rpc("fine_violation", { p_violation_id: notice.id, p_amount_cents: 5000, p_note: "" });
  check("a second fine on the same notice is refused", twice?.code === "22023", twice?.message ?? "no error");

  const { data: own } = await resident.client.from("charges").select("label, amount_cents").eq("unit_id", unit2).eq("category", "fine");
  check("the owner sees the fine on their statement", (own ?? []).length === 1 && own[0].amount_cents === 5000, JSON.stringify(own));

  const { data: log } = await admin.from("activity").select("summary, details").eq("association_id", associationId).eq("subject_kind", "violation").order("at");
  const fined = (log ?? []).find((a) => a.summary.startsWith("Fined "));
  check("the activity log names the fine and keeps the note", Boolean(fined) && fined.summary === "Fined 2 $50.00: Trash cans at the curb" && fined.details.note === "Second time this month", JSON.stringify(fined));

  const { error: creditError } = await president.client.rpc("add_credit", { p_unit_id: unit2, p_amount_cents: 5000, p_label: "Fine waived after appeal" });
  check("a credit reverses it like any charge", !creditError && (await balance()) === before, creditError?.message ?? String(await balance()));
} catch (error) {
  check("the run finished", false, error.message);
} finally {
  await cleanupAll();
}

report();
