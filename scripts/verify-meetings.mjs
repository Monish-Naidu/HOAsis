/**
 * Meetings after the notice (0112): the board moves one (the first date is
 * kept for the notice of the change), cancels one with a reason, records
 * minutes and attendance after it happened, and each act is in the
 * activity log; a resident can do none of it; the past, a cancelled
 * meeting and empty minutes are refused.
 */
import { createHarness, day } from "./lib/harness.mjs";

const {
  admin, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "meetings-",
  emailTag: "meetings",
  claimSeats: true,
});

try {
  const president = await makeUser("president");
  const resident = await makeUser("resident");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Meetings Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Rae Resident", email: resident.email, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await resident.client.rpc("claim_my_seats");

  const { data: meeting, error: insertError } = await president.client.from("meetings").insert({
    association_id: associationId, title: "October board meeting", held_on: day(10), held_at: "18:30", location: "Clubhouse",
  }).select("id, held_on").single();
  check("the president schedules a meeting", !insertError && Boolean(meeting), insertError?.message ?? "");

  // ------------------------------------------------------------- move it
  const { error: moveError } = await president.client.rpc("reschedule_meeting", { p_meeting_id: meeting.id, p_held_on: day(17), p_held_at: "19:00", p_location: "" });
  check("the president moves it a week", !moveError, moveError?.message ?? "");
  let { data: row } = await admin.from("meetings").select("held_on, held_at, location, rescheduled_from, status").eq("id", meeting.id).single();
  check("the new date, the new time, the old location, the first date kept", row.held_on === day(17) && row.held_at === "19:00" && row.location === "Clubhouse" && row.rescheduled_from === day(10) && row.status === "scheduled", JSON.stringify(row));
  await president.client.rpc("reschedule_meeting", { p_meeting_id: meeting.id, p_held_on: day(24), p_held_at: null, p_location: null });
  ({ data: row } = await admin.from("meetings").select("held_on, held_at, rescheduled_from").eq("id", meeting.id).single());
  check("a second move keeps the first noticed date", row.held_on === day(24) && row.held_at === "19:00" && row.rescheduled_from === day(10), JSON.stringify(row));
  const { error: pastError } = await president.client.rpc("reschedule_meeting", { p_meeting_id: meeting.id, p_held_on: day(-1), p_held_at: null, p_location: null });
  check("into the past is refused", pastError?.code === "22023", pastError?.message ?? "no error");
  const { error: residentMove } = await resident.client.rpc("reschedule_meeting", { p_meeting_id: meeting.id, p_held_on: day(30), p_held_at: null, p_location: null });
  check("a resident cannot move it", residentMove?.code === "42501", residentMove?.message ?? "no error");

  // --------------------------------------------------- minutes too early
  const { error: earlyMinutes } = await president.client.rpc("record_minutes", { p_meeting_id: meeting.id, p_minutes: "Called to order at 7pm. Adjourned.", p_attended: [] });
  check("minutes before the meeting are refused", earlyMinutes?.code === "22023", earlyMinutes?.message ?? "no error");

  // --------------------------------------------------------- minutes
  await admin.from("meetings").update({ held_on: day(-1) }).eq("id", meeting.id);
  const { error: emptyMinutes } = await president.client.rpc("record_minutes", { p_meeting_id: meeting.id, p_minutes: "ok", p_attended: [] });
  check("empty minutes are refused", emptyMinutes?.code === "22023", emptyMinutes?.message ?? "no error");
  const attended = [{ name: "Pat Founder", unit: "1", role: "president" }, { name: "Rae Resident", unit: "2" }];
  const { error: minutesError } = await president.client.rpc("record_minutes", {
    p_meeting_id: meeting.id, p_minutes: "Called to order at 7:02pm. Budget approved 3 to 0. Adjourned 7:40pm.", p_attended: attended,
  });
  check("the president records minutes and attendance", !minutesError, minutesError?.message ?? "");
  ({ data: row } = await admin.from("meetings").select("minutes, minutes_on, attended, status").eq("id", meeting.id).single());
  check("the minutes, the date, two attended, the meeting ended", row.minutes.startsWith("Called to order") && row.minutes_on === day(0) && row.attended.length === 2 && row.status === "ended", JSON.stringify([row.minutes_on, row.attended.length, row.status]));
  const { data: readBack } = await resident.client.from("meetings").select("minutes, attended").eq("id", meeting.id).single();
  check("a resident reads the minutes", readBack?.minutes?.length > 10 && readBack.attended.length === 2, JSON.stringify(readBack));
  const { error: residentMinutes } = await resident.client.rpc("record_minutes", { p_meeting_id: meeting.id, p_minutes: "I was there and it was fine.", p_attended: [] });
  check("a resident cannot write them", residentMinutes?.code === "42501", residentMinutes?.message ?? "no error");
  const { error: moveEnded } = await president.client.rpc("reschedule_meeting", { p_meeting_id: meeting.id, p_held_on: day(30), p_held_at: null, p_location: null });
  check("an ended meeting cannot be moved", moveEnded?.code === "22023", moveEnded?.message ?? "no error");

  // ---------------------------------------------------------- cancel
  const { data: second } = await president.client.from("meetings").insert({
    association_id: associationId, title: "Budget workshop", held_on: day(20), held_at: "18:00", location: "Online",
  }).select("id").single();
  const { error: noReason } = await president.client.rpc("cancel_meeting", { p_meeting_id: second.id, p_reason: " " });
  check("a cancel needs a reason", noReason?.code === "22023", noReason?.message ?? "no error");
  const { error: residentCancel } = await resident.client.rpc("cancel_meeting", { p_meeting_id: second.id, p_reason: "Nobody is coming" });
  check("a resident cannot cancel", residentCancel?.code === "42501", residentCancel?.message ?? "no error");
  const { error: cancelError } = await president.client.rpc("cancel_meeting", { p_meeting_id: second.id, p_reason: "No quorum expected" });
  check("the president cancels with a reason", !cancelError, cancelError?.message ?? "");
  ({ data: row } = await admin.from("meetings").select("status, cancelled_on, cancel_reason").eq("id", second.id).single());
  check("the meeting stays on the record as cancelled", row.status === "cancelled" && row.cancelled_on === day(0) && row.cancel_reason === "No quorum expected", JSON.stringify(row));
  await admin.from("meetings").update({ held_on: day(-1) }).eq("id", second.id);
  const { error: cancelledMinutes } = await president.client.rpc("record_minutes", { p_meeting_id: second.id, p_minutes: "There were no minutes because nobody came.", p_attended: [] });
  check("a cancelled meeting takes no minutes", cancelledMinutes?.code === "22023", cancelledMinutes?.message ?? "no error");

  // ------------------------------------------------------- the log
  const { data: log } = await admin.from("activity").select("summary").eq("association_id", associationId).eq("subject_kind", "meeting").order("at");
  const summaries = (log ?? []).map((a) => a.summary);
  check("the activity log has the moves, the minutes and the cancel",
    summaries.filter((s) => s.startsWith("Moved ")).length === 2 && summaries.some((s) => s.startsWith("Recorded minutes") && s.endsWith("2 attended")) && summaries.some((s) => s.startsWith("Cancelled Budget workshop")),
    JSON.stringify(summaries));
} catch (error) {
  check("the run finished", false, error.message);
} finally {
  await cleanupAll();
}

report();
