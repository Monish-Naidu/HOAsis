/**
 * The durable billing operation (0126): one open operation per association,
 * frozen parameters, service role only, and conditional updates that lose a
 * race instead of corrupting the row.
 *
 * A president founds an association. As the service role,
 * begin_billing_operation reserves the operation; a concurrent second call
 * returns the same row with the first call's parameters. A direct second
 * open row is refused by the index; once completed, a fresh operation can be
 * reserved. The president and an anonymous caller are both refused. Pure
 * Supabase; cleaned up at the end.
 */
import { randomUUID } from "node:crypto";
import { createHarness } from "./lib/harness.mjs";

const { admin, anon, check, makeUser, cleanup, cleanupAll, report } = createHarness({
  passwordPrefix: "billop-",
  emailTag: "billop",
});

const PARAMS = {
  p_quantity: 3,
  p_trial_end_ts: 1_900_000_000,
  p_mode: "subscription",
  p_customer_name: "Billing Operation Test HOA",
  p_customer_email: "president@example.com",
  p_return_origin: "http://127.0.0.1:3100",
};

try {
  const president = await makeUser("president");
  const { data: associationId, error: createError } = await president.client.rpc(
    "create_association",
    {
      p_name: "Billing Operation Test HOA",
      p_city: "Bothell",
      p_state: "WA",
      p_dues_cents: 10000,
      p_dues_cadence: "monthly",
      p_due_day: 1,
      p_founder_name: "Pat Founder",
      p_founder_unit: "1",
      p_households: [],
    },
  );
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);

  const begin = (client, params = PARAMS) =>
    client.rpc("begin_billing_operation", { p_association_id: associationId, ...params });

  // Only the service role may open an operation.
  const { error: presidentError } = await begin(president.client);
  check(
    "the president cannot open a billing operation",
    presidentError?.code === "42501",
    presidentError?.message ?? "",
  );
  const { error: anonError } = await begin(anon());
  check(
    "an anonymous caller cannot open a billing operation",
    anonError?.code === "42501",
    anonError?.message ?? "",
  );

  // Two officers at once: one row, the first call's frozen parameters.
  const [one, two] = await Promise.all([
    begin(admin),
    begin(admin, { ...PARAMS, p_quantity: 9, p_customer_email: "treasurer@example.com" }),
  ]);
  check(
    "both reservations succeeded",
    !one.error && !two.error,
    one.error?.message ?? two.error?.message ?? "",
  );
  const op = one.data;
  check(
    "concurrent officers receive the same operation",
    op?.id && two.data?.id === op.id,
    `${op?.id} vs ${two.data?.id}`,
  );
  check(
    "the first call's parameters stay frozen",
    two.data?.quantity === 3 && two.data?.customer_email === "president@example.com",
    `quantity ${two.data?.quantity}`,
  );
  check(
    "idempotency keys name the operation",
    op?.customer_key === `bill-cus-${op.id}` &&
      op?.session_key === `bill-sess-${op.id}` &&
      op?.subscription_key === `bill-sub-${op.id}`,
    op?.customer_key ?? "",
  );

  // The index refuses a second open operation outright.
  const { error: secondOpen } = await admin.from("billing_operations").insert({
    id: randomUUID(),
    association_id: associationId,
    mode: "subscription",
    quantity: 1,
    customer_name: "Duplicate",
    return_origin: "http://127.0.0.1:3100",
    customer_key: "bill-cus-duplicate",
    session_key: "bill-sess-duplicate",
    subscription_key: "bill-sub-duplicate",
  });
  check(
    "a second open operation cannot be inserted",
    Boolean(secondOpen) && secondOpen.message.includes("billing_operations_one_open"),
    secondOpen?.message ?? "",
  );

  // Conditional claims lose races instead of overwriting.
  const { data: lostClaim } = await admin
    .from("billing_operations")
    .update({ session_id: "cs_loser" })
    .eq("id", op.id)
    .eq("session_id", "cs_never_was")
    .select("id");
  check("a stale conditional claim matches no rows", (lostClaim ?? []).length === 0, "");
  const { data: wonClaim } = await admin
    .from("billing_operations")
    .update({ session_id: "cs_winner" })
    .eq("id", op.id)
    .is("session_id", null)
    .select("id");
  check("a valid conditional claim lands", (wonClaim ?? []).length === 1, "");
  const { data: doubleClaim } = await admin
    .from("billing_operations")
    .update({ session_id: "cs_second" })
    .eq("id", op.id)
    .is("session_id", null)
    .select("id");
  check("a second claim on a stored session matches nothing", (doubleClaim ?? []).length === 0, "");

  // Completion frees the association to reserve again (a legitimately
  // replaced or restarted checkout).
  const { error: completeError } = await admin
    .from("billing_operations")
    .update({ status: "completed", subscription_id: "sub_done" })
    .eq("id", op.id)
    .eq("status", "open");
  check("the operation completes", !completeError, completeError?.message ?? "");
  const again = await begin(admin, { ...PARAMS, p_mode: "setup", p_trial_end_ts: 1_900_000_100 });
  check(
    "a completed operation frees a fresh reservation",
    !again.error && again.data?.id !== op.id,
    again.error?.message ?? "",
  );
  check(
    "the fresh operation carries the new plan",
    again.data?.mode === "setup" && again.data?.trial_end_ts === 1_900_000_100,
    `mode ${again.data?.mode}`,
  );

  // Bad input and unknown associations are refused.
  const { error: deleteError } = await admin
    .from("billing_operations")
    .delete()
    .eq("association_id", associationId);
  if (deleteError) throw new Error(deleteError.message);
  const { error: badParams } = await begin(admin, { ...PARAMS, p_quantity: 0 });
  check(
    "a zero-home reservation is refused",
    badParams?.code === "22000",
    badParams?.message ?? "",
  );
  const { error: unknown } = await admin.rpc("begin_billing_operation", {
    ...PARAMS,
    p_association_id: "00000000-0000-0000-0000-000000000000",
  });
  check("an unknown association is refused", unknown?.code === "P0002", unknown?.message ?? "");
} finally {
  await cleanupAll();
}

report();
