/**
 * A scheduled dues change bills the old rate before its day and the new one
 * from it, and the daily run is what moves it into the stored rate.
 *
 * Founds a throwaway association, schedules a change through
 * schedule_dues_change the way the Settings screen does, and checks the
 * bills on either side of the day: due before it bills the old rate, due on
 * or after it the new one, and a home's own amount (0084) travels across
 * the change untouched. Then apply_dues_change is run the way the cron does,
 * twice, so the second run finds nothing. Refusals are checked last.
 * Pure Supabase; cleaned up at the end.
 */
import { createHarness, day } from "./lib/harness.mjs";

const { admin, stamp, check, makeUser, cleanup, cleanupAll, report } = createHarness({
  passwordPrefix: "duesrate-",
  emailTag: "dueschange",
});

try {
  const president = await makeUser("president");
  const robinEmail = `robin-dueschange-${stamp}@example.com`;
  const { data: associationId, error: createError } = await president.client.rpc(
    "create_association",
    {
      p_name: "Dues Change Test HOA",
      p_city: "Bothell",
      p_state: "WA",
      p_dues_cents: 10000,
      p_dues_cadence: "monthly",
      p_due_day: 1,
      p_founder_name: "Pat Founder",
      p_founder_unit: "1",
      p_households: [{ name: "Robin Owner", email: robinEmail, unit: "2" }],
    },
  );
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  // Books start early enough that a bill dated a month ago is allowed.
  await admin
    .from("associations")
    .update({ billing_starts_on: day(-60) })
    .eq("id", associationId);

  const { data: units } = await admin
    .from("units")
    .select("id, label")
    .eq("association_id", associationId)
    .order("label");
  const unitA = units[0].id,
    unitB = units[1].id;

  const duesOf = async (dueOn) => {
    const { data } = await admin
      .from("charges")
      .select("unit_id, amount_cents")
      .eq("association_id", associationId)
      .eq("category", "dues")
      .eq("due_on", dueOn);
    return Object.fromEntries((data ?? []).map((c) => [c.unit_id, c.amount_cents]));
  };

  // The board schedules $120 from the 10th.
  const { error: scheduleError } = await president.client.rpc("schedule_dues_change", {
    p_association_id: associationId,
    p_dues_cents: 12000,
    p_dues_by_type: null,
    p_effective_on: day(10),
  });
  check("the board schedules a new rate with a day", !scheduleError, scheduleError?.message ?? "");
  const { data: waiting } = await admin
    .from("associations")
    .select("dues_cents, dues_change_cents, dues_change_on")
    .eq("id", associationId)
    .single();
  check(
    "the change waits and the current rate is untouched",
    waiting.dues_cents === 10000 &&
      waiting.dues_change_cents === 12000 &&
      waiting.dues_change_on === day(10),
    JSON.stringify(waiting),
  );

  // Old rate before the day, new rate from it, whatever day the run happens.
  await admin.rpc("issue_assessment", {
    p_association_id: associationId,
    p_label: "Dues",
    p_due_on: day(-30),
  });
  await admin.rpc("issue_assessment", {
    p_association_id: associationId,
    p_label: "Dues",
    p_due_on: day(10),
  });
  await admin.rpc("issue_assessment", {
    p_association_id: associationId,
    p_label: "Dues",
    p_due_on: day(20),
  });
  const before = await duesOf(day(-30));
  const onTheDay = await duesOf(day(10));
  const after = await duesOf(day(20));
  check(
    "a period due before the day bills the old rate",
    before[unitA] === 10000 && before[unitB] === 10000,
    JSON.stringify(before),
  );
  check(
    "a period due on the day bills the new rate",
    onTheDay[unitA] === 12000 && onTheDay[unitB] === 12000,
    JSON.stringify(onTheDay),
  );
  check(
    "a period due after the day bills the new rate",
    after[unitA] === 12000 && after[unitB] === 12000,
    JSON.stringify(after),
  );

  // The run does not apply a change whose day has not come.
  const { data: earlyApply } = await admin.rpc("apply_dues_change", {
    p_association_id: associationId,
  });
  const { data: stillWaiting } = await admin
    .from("associations")
    .select("dues_cents, dues_change_cents")
    .eq("id", associationId)
    .single();
  check(
    "a change whose day has not come is not applied",
    earlyApply === false &&
      stillWaiting.dues_cents === 10000 &&
      stillWaiting.dues_change_cents === 12000,
    `${earlyApply}, ${JSON.stringify(stillWaiting)}`,
  );

  // Scheduling again replaces the one waiting: nothing has billed at it yet.
  const { error: replaceError } = await president.client.rpc("schedule_dues_change", {
    p_association_id: associationId,
    p_dues_cents: 15000,
    p_dues_by_type: null,
    p_effective_on: day(0),
  });
  const { data: replaced } = await admin
    .from("associations")
    .select("dues_change_cents, dues_change_on")
    .eq("id", associationId)
    .single();
  check(
    "scheduling again replaces the change waiting",
    !replaceError && replaced.dues_change_cents === 15000 && replaced.dues_change_on === day(0),
    `${replaceError?.message ?? ""}, ${JSON.stringify(replaced)}`,
  );

  // The run of the day applies the change of the day, once.
  const { data: applied } = await admin.rpc("apply_dues_change", {
    p_association_id: associationId,
  });
  const { data: moved } = await admin
    .from("associations")
    .select("dues_cents, dues_change_cents, dues_change_by_type, dues_change_on")
    .eq("id", associationId)
    .single();
  check(
    "the run moves the waiting change into the rate",
    applied === true && moved.dues_cents === 15000 && moved.dues_change_cents === null,
    `${applied}, ${JSON.stringify(moved)}`,
  );
  const { data: appliedAgain } = await admin.rpc("apply_dues_change", {
    p_association_id: associationId,
  });
  const { data: stillMoved } = await admin
    .from("associations")
    .select("dues_cents")
    .eq("id", associationId)
    .single();
  check(
    "a second run the same day changes nothing",
    appliedAgain === false && stillMoved.dues_cents === 15000,
    `${appliedAgain}, ${stillMoved.dues_cents}`,
  );

  // A person cannot apply a change by hand: only the daily run does.
  const { error: byHand } = await president.client.rpc("apply_dues_change", {
    p_association_id: associationId,
  });
  check("a person cannot apply a change by hand", !!byHand, byHand?.message ?? "no error");

  // The settings audit trail holds both halves: the schedule and the move.
  const { data: activity } = await admin
    .from("activity")
    .select("summary, details")
    .eq("association_id", associationId)
    .order("at", { ascending: false });
  const summaries = (activity ?? []).map((a) => a.summary);
  check(
    "the schedule and the move are both in the activity log",
    summaries.some((s) => s.startsWith("Dues set to $150.00 monthly from")) &&
      summaries.some((s) => s.startsWith("Association dues set to $150.00 monthly")),
    JSON.stringify(summaries),
  );

  // A home with its own amount keeps it across the change, and a home with a
  // kind bills that kind's rate. A home with no kind bills the standard rate,
  // so the second home is given one here.
  await president.client.rpc("set_home_dues", { p_unit_id: unitA, p_dues_cents: 7000 });
  await admin.from("units").update({ home_type: "single-family" }).eq("id", unitB);
  const { error: kindSchedule } = await president.client.rpc("schedule_dues_change", {
    p_association_id: associationId,
    p_dues_cents: 13000,
    p_dues_by_type: { "single-family": 11000, townhomes: 14000 },
    p_effective_on: day(3),
  });
  await admin.rpc("issue_assessment", {
    p_association_id: associationId,
    p_label: "Dues",
    p_due_on: day(2),
  });
  await admin.rpc("issue_assessment", {
    p_association_id: associationId,
    p_label: "Dues",
    p_due_on: day(4),
  });
  const beforeKind = await duesOf(day(2));
  const afterKind = await duesOf(day(4));
  check(
    "before the day: the home's own amount and the old rates",
    !kindSchedule &&
      beforeKind[unitA] === 7000 &&
      beforeKind[unitB] === 15000 &&
      afterKind[unitA] === 7000 &&
      afterKind[unitB] === 11000,
    `${kindSchedule?.message ?? ""}, ${JSON.stringify(beforeKind)}, ${JSON.stringify(afterKind)}`,
  );

  // Cancel clears the change; cancelling again is refused.
  const { error: cancelError } = await president.client.rpc("schedule_dues_change", {
    p_association_id: associationId,
    p_dues_cents: null,
    p_dues_by_type: null,
    p_effective_on: null,
  });
  const { data: cancelled } = await admin
    .from("associations")
    .select("dues_cents, dues_change_cents, dues_change_on")
    .eq("id", associationId)
    .single();
  check(
    "cancelling clears the change and keeps the rate",
    !cancelError &&
      cancelled.dues_cents === 15000 &&
      cancelled.dues_change_cents === null &&
      cancelled.dues_change_on === null,
    `${cancelError?.message ?? ""}, ${JSON.stringify(cancelled)}`,
  );
  const { error: cancelAgain } = await president.client.rpc("schedule_dues_change", {
    p_association_id: associationId,
    p_dues_cents: null,
    p_dues_by_type: null,
    p_effective_on: null,
  });
  check(
    "cancelling with nothing waiting is refused",
    !!cancelAgain,
    cancelAgain?.message ?? "no error",
  );

  // A quarterly association bills the old rate for the period that closed
  // before the day and the new one from the next, on its own calendar.
  const { data: quarterlyId } = await president.client.rpc("create_association", {
    p_name: "Quarterly Dues Test HOA",
    p_city: "Bothell",
    p_state: "WA",
    p_dues_cents: 30000,
    p_dues_cadence: "quarterly",
    p_due_day: 1,
    p_founder_name: "Pat Founder",
    p_founder_unit: "1",
    p_households: [],
  });
  cleanup.associations.push(quarterlyId);
  await admin
    .from("associations")
    .update({ billing_starts_on: day(-90) })
    .eq("id", quarterlyId);
  const { error: quarterlySchedule } = await president.client.rpc("schedule_dues_change", {
    p_association_id: quarterlyId,
    p_dues_cents: 33000,
    p_dues_by_type: null,
    p_effective_on: day(15),
  });
  await admin.rpc("issue_assessment", {
    p_association_id: quarterlyId,
    p_label: "Quarterly dues",
    p_due_on: day(-89),
  });
  await admin.rpc("issue_assessment", {
    p_association_id: quarterlyId,
    p_label: "Quarterly dues",
    p_due_on: day(15),
  });
  const { data: quarterlyBills } = await admin
    .from("charges")
    .select("due_on, amount_cents")
    .eq("association_id", quarterlyId)
    .eq("category", "dues");
  const quarterlyBy = Object.fromEntries(
    (quarterlyBills ?? []).map((c) => [c.due_on, c.amount_cents]),
  );
  check(
    "a quarterly association bills old before the day and new from it",
    !quarterlySchedule && quarterlyBy[day(-89)] === 30000 && quarterlyBy[day(15)] === 33000,
    `${quarterlySchedule?.message ?? ""}, ${JSON.stringify(quarterlyBy)}`,
  );

  // Refusals: the past, zero, a slip of the key, too far out, no seat.
  const refuse = async (name, args) => {
    const { error } = await president.client.rpc("schedule_dues_change", args);
    check(name, !!error, error?.message ?? "no error");
  };
  await refuse("the past is refused", {
    p_association_id: associationId,
    p_dues_cents: 12000,
    p_dues_by_type: null,
    p_effective_on: day(-1),
  });
  await refuse("a zero rate is refused", {
    p_association_id: associationId,
    p_dues_cents: 0,
    p_dues_by_type: null,
    p_effective_on: day(5),
  });
  await refuse("a rate over $100,000 is refused", {
    p_association_id: associationId,
    p_dues_cents: 10000001,
    p_dues_by_type: null,
    p_effective_on: day(5),
  });
  await refuse("more than a year out is refused", {
    p_association_id: associationId,
    p_dues_cents: 12000,
    p_dues_by_type: null,
    p_effective_on: day(400),
  });
  await refuse("an unknown association is refused", {
    p_association_id: "00000000-0000-0000-0000-000000000000",
    p_dues_cents: 12000,
    p_dues_by_type: null,
    p_effective_on: day(5),
  });

  const robin = await makeUser("robin", robinEmail);
  await robin.client.rpc("claim_my_seats");
  const { error: residentError } = await robin.client.rpc("schedule_dues_change", {
    p_association_id: associationId,
    p_dues_cents: 12000,
    p_dues_by_type: null,
    p_effective_on: day(5),
  });
  check(
    "a resident cannot schedule a change",
    !!residentError,
    residentError?.message ?? "no error",
  );

  // A locked board cannot schedule anything (0105, 0107).
  await admin
    .from("associations")
    .update({ subscription_status: "canceled" })
    .eq("id", associationId);
  const { error: lockedError } = await president.client.rpc("schedule_dues_change", {
    p_association_id: associationId,
    p_dues_cents: 12000,
    p_dues_by_type: null,
    p_effective_on: day(5),
  });
  await admin
    .from("associations")
    .update({ subscription_status: "active" })
    .eq("id", associationId);
  check(
    "a locked board cannot schedule a change",
    !!lockedError,
    lockedError?.message ?? "no error",
  );
} catch (error) {
  check("the suite ran to the end", false, error.message);
} finally {
  await cleanupAll();
}

report();
