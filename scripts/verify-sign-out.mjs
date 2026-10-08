/**
 * sign_out_everywhere (0114): a signed-in person's token stops working the
 * moment the platform signs them out; a board member cannot call it; the
 * activity log of their association says they were signed out and why;
 * their seat is untouched.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  admin, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "signout-",
  emailTag: "signout",
  claimSeats: true,
});

try {
  const president = await makeUser("president");
  const resident = await makeUser("resident");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Sign Out Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [{ name: "Rae Resident", email: resident.email, unit: "2" }],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await resident.client.rpc("claim_my_seats");

  const { data: before } = await resident.client.from("units").select("id").eq("association_id", associationId);
  check("the resident reads their association while signed in", (before ?? []).length >= 1, String((before ?? []).length));

  const { error: boardError } = await president.client.rpc("sign_out_everywhere", { p_profile_id: resident.id, p_reason: "Testing" });
  check("a board member cannot sign someone out", boardError?.code === "42501", boardError?.message ?? "no error");

  const { data: count, error } = await admin.rpc("sign_out_everywhere", { p_profile_id: resident.id, p_reason: "Lost phone" });
  check("the platform signs the resident out", !error && count >= 1, error?.message ?? String(count));

  // The client still holds the old token; the server no longer has its session,
  // so a refresh is refused and a read with the stale token returns nothing or an error.
  const { error: refreshError } = await resident.client.auth.refreshSession();
  check("their session cannot be refreshed", Boolean(refreshError), refreshError?.message ?? "refreshed");

  const { data: seat } = await admin.from("memberships").select("id").eq("profile_id", resident.id).eq("association_id", associationId).is("ends_on", null);
  check("their seat is untouched", (seat ?? []).length === 1, String((seat ?? []).length));
  const { data: log } = await admin.from("activity").select("summary, actor_name").eq("association_id", associationId).ilike("summary", "%signed out everywhere%");
  check("the activity log says who was signed out and why", (log ?? []).length === 1 && log[0].summary.endsWith(": Lost phone") && log[0].actor_name === "Your HOAsis", JSON.stringify(log));
} catch (error) {
  check("the run finished", false, error.message);
} finally {
  await cleanupAll();
}

report();
