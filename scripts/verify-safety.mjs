/**
 * The ways an association could destroy itself, attempted.
 *
 * The bug this covers: removing yourself as the only officer worked, and left
 * the association unreachable because nobody could grant capabilities back.
 * A dialog would not have prevented it. These are database rules, so they hold
 * against this client, the next one, and a mistaken script.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  admin, stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "safety-",
  strictSignIn: false,
  demotePresident: true,
});

try {
  const successorEmail = `successor-${stamp}@example.com`;
  const president = await makeUser("President", `president-${stamp}@example.com`);
  const { data: associationId } = await president.client.rpc("create_association", {
    p_name: "Safety HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat President", p_founder_unit: "1",
    p_households: [{ name: "Sam Successor", email: successorEmail, unit: "2" }],
  });
  cleanup.associations.push(associationId);
  const successor = await makeUser("Sam Successor", successorEmail);

  // The bug, attempted directly.
  const { data: mine } = await admin.from("memberships").select("id")
    .eq("association_id", associationId).eq("profile_id", president.id).single();

  const { error: deleteSelf } = await president.client
    .from("memberships").delete().eq("id", mine.id);
  const { data: stillThere } = await admin.from("memberships").select("role")
    .eq("id", mine.id).maybeSingle();
  check("the last President cannot delete their own membership",
    stillThere?.role === "president", deleteSelf?.message?.slice(0, 60) ?? "row survived");

  const { error: leaveError } = await president.client.rpc("leave_association", {
    p_association_id: associationId,
  });
  check("and cannot leave the association either",
    Boolean(leaveError), leaveError?.message?.slice(0, 50) ?? "no error");

  // Even the service role, which is what a bad migration or script would use.
  const { error: adminForce } = await admin.from("memberships").delete().eq("id", mine.id);
  check("not even a server side delete can remove the last President",
    Boolean(adminForce), adminForce?.message?.slice(0, 50) ?? "no error");

  // The supported path.
  const { error: transferError } = await president.client.rpc("transfer_presidency", {
    p_to_profile: successor.id,
  });
  check("the presidency can be handed over", !transferError, transferError?.message ?? "");

  const { data: roles } = await admin.from("memberships")
    .select("profile_id, role").eq("association_id", associationId).is("ends_on", null);
  const successorRole = roles.find((r) => r.profile_id === successor.id)?.role;
  const formerRole = roles.find((r) => r.profile_id === president.id)?.role;
  check("the successor is President", successorRole === "president", successorRole);
  check("the former President stays as a resident, because they still own a home",
    formerRole === "resident", formerRole);

  // Now leaving is allowed, and keeps the history.
  const { error: nowLeave } = await president.client.rpc("leave_association", {
    p_association_id: associationId,
  });
  check("the former President can now leave", !nowLeave, nowLeave?.message ?? "");
  const { data: ended } = await admin.from("memberships").select("ends_on")
    .eq("id", mine.id).single();
  check("and their record survives with an end date rather than vanishing",
    ended?.ends_on !== null, String(ended?.ends_on));

  // Deleting the association.
  const { error: wrongName } = await successor.client.rpc("request_association_deletion", {
    p_association_id: associationId, p_typed_name: "Wrong Name",
  });
  check("deleting needs the name typed correctly", Boolean(wrongName),
    wrongName?.message?.slice(0, 40) ?? "no error");

  const resident = await makeUser("Rita Resident", `resident-${stamp}@example.com`);
  await admin.from("memberships").insert({
    association_id: associationId, unit_id: (await admin.from("units").select("id")
      .eq("association_id", associationId).limit(1).single()).data.id,
    profile_id: resident.id, full_name: "Rita", role: "resident", capabilities: [],
  });
  const { error: residentDelete } = await resident.client.rpc("request_association_deletion", {
    p_association_id: associationId, p_typed_name: "Safety HOA",
  });
  check("only the President can delete an association", Boolean(residentDelete),
    residentDelete?.message?.slice(0, 40) ?? "no error");

  const { data: purgeAt, error: deleteError } = await successor.client
    .rpc("request_association_deletion", {
      p_association_id: associationId, p_typed_name: "Safety HOA",
    });
  check("the President can, with the name typed", !deleteError && Boolean(purgeAt),
    deleteError?.message ?? "");

  const { data: afterDelete } = await successor.client.rpc("my_associations");
  check("a deleted association disappears from their list",
    (afterDelete ?? []).length === 0, `${(afterDelete ?? []).length}`);

  // And is reversible.
  const { error: restoreError } = await successor.client.rpc("cancel_association_deletion", {
    p_association_id: associationId,
  });
  const { data: restored } = await successor.client.rpc("my_associations");
  check("and can be restored inside the window",
    !restoreError && (restored ?? []).length === 1, restoreError?.message ?? `${(restored ?? []).length}`);

  // Restoring goes back to where the association really is (0073). It used
  // to write 'active' whatever came before, so a trial that asked to be
  // deleted and changed its mind held a paid-up row with no subscription,
  // and the billing sweep never asked it for a card again.
  const { data: afterRestore } = await admin.from("associations")
    .select("subscription_status, deleted_at, canceled_at").eq("id", associationId).single();
  check("a restored trial is a trial again, not a free active",
    afterRestore?.subscription_status === "trialing" && afterRestore?.deleted_at === null && afterRestore?.canceled_at === null,
    JSON.stringify(afterRestore));

  // Cancelling billing changes nothing but the bill.
  await successor.client.rpc("cancel_subscription", {
    p_association_id: associationId, p_reason: "Trying it out",
  });
  const { data: afterCancel } = await successor.client
    .from("associations").select("subscription_status, name").eq("id", associationId).single();
  check("cancelling stops the subscription", afterCancel?.subscription_status === "canceled",
    afterCancel?.subscription_status);
  const { data: recordsIntact } = await successor.client
    .from("units").select("id").eq("association_id", associationId);
  check("and leaves every record readable", (recordsIntact ?? []).length === 2,
    `${(recordsIntact ?? []).length} homes`);

  // Restore undoes a deletion and nothing else (0073). On an association
  // that is not being deleted it must change nothing, or it is a second
  // way to restart billing.
  await successor.client.rpc("cancel_association_deletion", { p_association_id: associationId });
  const { data: notRestarted } = await admin.from("associations").select("subscription_status").eq("id", associationId).single();
  check("restoring an association that is not being deleted changes nothing",
    notRestarted?.subscription_status === "canceled", notRestarted?.subscription_status);

  // Restarting goes back to where the association really is: in its trial.
  const { error: resumeError } = await successor.client.rpc("resume_subscription", { p_association_id: associationId });
  const { data: afterResume } = await admin.from("associations").select("subscription_status").eq("id", associationId).single();
  check("restarting returns a trial to trialing", !resumeError && afterResume?.subscription_status === "trialing",
    resumeError?.message ?? afterResume?.subscription_status);

  // The plumbing columns (0065). The President holds settings, and the
  // policy on the row never said which columns that covers: from the
  // console they could extend their own trial, mark themselves paid, point
  // the dues at another Stripe account, or skip the deletion function.
  const { data: plumbing } = await admin.from("associations")
    .select("trial_ends_at, subscription_status, stripe_account_id, stripe_charges_enabled, deleted_at, join_code, slug, billing_subscription_id")
    .eq("id", associationId).single();
  const attempts = {
    trial_ends_at: "2099-01-01T00:00:00Z",
    subscription_status: "active",
    stripe_account_id: `acct_verify_${stamp}`,
    stripe_charges_enabled: true,
    deleted_at: new Date().toISOString(),
    join_code: "ZZZZZ9",
    slug: "admin",
    billing_subscription_id: `sub_verify_${stamp}`,
  };
  for (const [column, value] of Object.entries(attempts)) {
    const { error } = await successor.client.from("associations").update({ [column]: value }).eq("id", associationId);
    check(`a President cannot set ${column} from the browser`, error?.code === "42501", error?.message?.slice(0, 60) ?? "no error");
  }
  const { data: untouched } = await admin.from("associations")
    .select("trial_ends_at, subscription_status, stripe_account_id, stripe_charges_enabled, deleted_at, join_code, slug, billing_subscription_id")
    .eq("id", associationId).single();
  check("and none of it changed", JSON.stringify(untouched) === JSON.stringify(plumbing), JSON.stringify(untouched));

  // What Settings really saves still lands, alone or beside a guarded
  // column sent back unchanged.
  const { error: ordinaryError } = await successor.client.from("associations")
    .update({ name: "Safety HOA", dues_cents: 6100, payment_fee_paid_by: "association", settings: { forumEnabled: true }, slug: plumbing?.slug })
    .eq("id", associationId);
  const { data: afterOrdinary } = await admin.from("associations").select("dues_cents, payment_fee_paid_by").eq("id", associationId).single();
  check("an ordinary settings save still lands", !ordinaryError && afterOrdinary?.dues_cents === 6100 && afterOrdinary?.payment_fee_paid_by === "association",
    ordinaryError?.message ?? JSON.stringify(afterOrdinary));

  // A subscription on file is Stripe's to cancel (0071). The server writes
  // the id, as the billing webhook does, which also proves the guard lets
  // the service role through.
  const { error: serverWrite } = await admin.from("associations")
    .update({ billing_subscription_id: `sub_verify_${stamp}`, subscription_status: "active" }).eq("id", associationId);
  check("the server still writes the billing columns", !serverWrite, serverWrite?.message ?? "");
  const { error: cancelBilled } = await successor.client.rpc("cancel_subscription", {
    p_association_id: associationId, p_reason: "While a card is billed",
  });
  const { data: stillBilled } = await admin.from("associations").select("subscription_status, canceled_at").eq("id", associationId).single();
  check("cancelling is refused while Stripe is billing a card", Boolean(cancelBilled) && /Stripe/.test(cancelBilled.message ?? ""),
    cancelBilled?.message?.slice(0, 60) ?? "no error");
  check("and the row does not claim it was cancelled", stillBilled?.subscription_status === "active" && stillBilled?.canceled_at === null,
    JSON.stringify(stillBilled));

  // Nor can it be deleted while the card is billed (0073): deletion wrote
  // 'canceled' as well, and Stripe went on charging an association that
  // had been told it was gone.
  const { error: deleteBilled } = await successor.client.rpc("request_association_deletion", {
    p_association_id: associationId, p_typed_name: "Safety HOA",
  });
  const { data: notDeleted } = await admin.from("associations").select("deleted_at, subscription_status").eq("id", associationId).single();
  check("deleting is refused while Stripe is billing a card", Boolean(deleteBilled) && /Stripe/.test(deleteBilled.message ?? ""),
    deleteBilled?.message?.slice(0, 60) ?? "no error");
  check("and nothing is scheduled for deletion", notDeleted?.deleted_at === null && notDeleted?.subscription_status === "active",
    JSON.stringify(notDeleted));

  // A deletion asked for before 0073 could have a subscription behind it.
  // Restoring that one is 'active', because a card really is being billed.
  await admin.from("associations")
    .update({ deleted_at: new Date().toISOString(), subscription_status: "canceled" }).eq("id", associationId);
  await successor.client.rpc("cancel_association_deletion", { p_association_id: associationId });
  const { data: restoredBilled } = await admin.from("associations").select("deleted_at, subscription_status").eq("id", associationId).single();
  check("restoring with a subscription on file is active", restoredBilled?.deleted_at === null && restoredBilled?.subscription_status === "active",
    JSON.stringify(restoredBilled));

  // And one whose trial has run out comes back ended, to be asked for a card.
  await admin.from("associations")
    .update({ billing_subscription_id: null, subscription_status: "ended", trial_ends_at: new Date(Date.now() - 86_400_000).toISOString() })
    .eq("id", associationId);
  const { error: deleteEnded } = await successor.client.rpc("request_association_deletion", {
    p_association_id: associationId, p_typed_name: "Safety HOA",
  });
  await successor.client.rpc("cancel_association_deletion", { p_association_id: associationId });
  const { data: restoredEnded } = await admin.from("associations").select("deleted_at, subscription_status").eq("id", associationId).single();
  check("with no subscription the delete still goes through", !deleteEnded, deleteEnded?.message ?? "");
  check("restoring after the trial ran out is ended, not active", restoredEnded?.deleted_at === null && restoredEnded?.subscription_status === "ended",
    JSON.stringify(restoredEnded));
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
