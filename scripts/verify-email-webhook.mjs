/**
 * The delivery webhook's SQL half, against the real database.
 *
 * apply_email_delivery (0129) is the webhook's only write, and its contract
 * is what keeps a board's delivery record truthful when Resend does what
 * webhooks do: deliver twice, out of order, and at the same moment. These
 * checks exercise exactly that: duplicates, reversed events, simultaneous
 * events, a message nobody logged, a status the route would never send, and
 * a caller who is not the service role.
 */
import { createHarness } from "./lib/harness.mjs";

const { admin, stamp, check, makeUser, cleanup, cleanupAll, report } = createHarness({
  passwordPrefix: "hook-",
});

/** How far along a status is, mirroring the ladder 0129 applies. */
const RUNG = {
  sent: 1,
  delayed: 1,
  delivered: 2,
  opened: 3,
  clicked: 3,
  bounced: 4,
  failed: 4,
  complained: 4,
};

let associationId;

async function logRow(providerId) {
  const { data, error } = await admin
    .from("email_log")
    .insert({
      association_id: associationId,
      to_email: `neighbor-${stamp}@example.com`,
      category: "newsletter",
      subject: "Webhook suite notice",
      provider_id: providerId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`log row: ${error.message}`);
  return data.id;
}

async function apply(providerId, status, statusAt = "2026-10-22T10:15:00Z") {
  return admin.rpc("apply_email_delivery", {
    p_provider_id: providerId,
    p_status: status,
    p_status_at: statusAt,
  });
}

async function rowOf(id) {
  const { data, error } = await admin
    .from("email_log")
    .select("id, status, status_at")
    .eq("id", id)
    .single();
  if (error) throw new Error(`read back: ${error.message}`);
  return data;
}

try {
  const president = await makeUser("president");
  const { data: created } = await president.client.rpc("create_association", {
    p_name: "Webhook HOA",
    p_city: "Bothell",
    p_state: "WA",
    p_dues_cents: 6000,
    p_dues_cadence: "monthly",
    p_due_day: 1,
    p_founder_name: "Dana",
    p_founder_unit: "1",
  });
  associationId = created;
  cleanup.associations.push(associationId);

  // A fresh row has no status at all: the first event lands.
  const first = await logRow(`hook-${stamp}-first`);
  const sent = await apply(`hook-${stamp}-first`, "sent");
  check(
    "a first event on an unstatused row applies",
    sent.data === "applied" && !sent.error,
    JSON.stringify(sent),
  );
  const afterSent = await rowOf(first);
  check(
    "the row carries the status and the event's time",
    afterSent.status === "sent" && afterSent.status_at === "2026-10-22T10:15:00+00:00",
    JSON.stringify(afterSent),
  );

  // The same delivery twice: both apply, and the row says it once.
  const dup = await logRow(`hook-${stamp}-dup`);
  const dupFirst = await apply(`hook-${stamp}-dup`, "delivered", "2026-10-22T10:00:00Z");
  const dupAgain = await apply(`hook-${stamp}-dup`, "delivered", "2026-10-22T10:00:00Z");
  const dupRow = await rowOf(dup);
  check(
    "a duplicated event is idempotent",
    dupFirst.data === "applied" && dupAgain.data === "applied" && dupRow.status === "delivered",
    JSON.stringify({ first: dupFirst.data, again: dupAgain.data, row: dupRow }),
  );

  // Reversed: the earlier "sent" arrives after "delivered" and must not
  // pull the row backwards.
  const rev = await logRow(`hook-${stamp}-rev`);
  await apply(`hook-${stamp}-rev`, "delivered", "2026-10-22T10:05:00Z");
  const late = await apply(`hook-${stamp}-rev`, "sent", "2026-10-22T10:00:00Z");
  const revRow = await rowOf(rev);
  check(
    "an out-of-order earlier event is kept, not applied",
    late.data === "kept" && revRow.status === "delivered",
    JSON.stringify({ outcome: late.data, row: revRow }),
  );
  check(
    "the kept row still carries the delivered event's time",
    revRow.status_at === "2026-10-22T10:05:00+00:00",
    revRow.status_at,
  );

  // Peers share a rung and may replace each other: opened then clicked.
  const peer = await logRow(`hook-${stamp}-peer`);
  await apply(`hook-${stamp}-peer`, "opened");
  const clicked = await apply(`hook-${stamp}-peer`, "clicked");
  const peerRow = await rowOf(peer);
  check(
    "a peer rung may follow its peer",
    clicked.data === "applied" && peerRow.status === "clicked",
    JSON.stringify({ outcome: clicked.data, row: peerRow }),
  );

  // Simultaneous events for one message: however they interleave, the row
  // ends at the furthest rung and every caller got a straight answer.
  const race = await logRow(`hook-${stamp}-race`);
  const outcomes = await Promise.all([
    apply(`hook-${stamp}-race`, "sent", "2026-10-22T10:00:00Z"),
    apply(`hook-${stamp}-race`, "bounced", "2026-10-22T10:04:00Z"),
    apply(`hook-${stamp}-race`, "delivered", "2026-10-22T10:02:00Z"),
    apply(`hook-${stamp}-race`, "opened", "2026-10-22T10:03:00Z"),
    apply(`hook-${stamp}-race`, "delayed", "2026-10-22T10:01:00Z"),
  ]);
  const raceRow = await rowOf(race);
  check(
    "simultaneous events converge on the furthest rung",
    outcomes.every((o) => !o.error && (o.data === "applied" || o.data === "kept")) &&
      RUNG[raceRow.status] === 4,
    JSON.stringify({ outcomes: outcomes.map((o) => o.data ?? o.error?.message), row: raceRow }),
  );
  check(
    "the converged row is the terminal event's own record",
    raceRow.status === "bounced" && raceRow.status_at === "2026-10-22T10:04:00+00:00",
    JSON.stringify(raceRow),
  );

  // A message nobody logged answers for itself and moves no other row.
  const control = await logRow(`hook-${stamp}-control`);
  const unknown = await apply(`hook-${stamp}-nobody`, "bounced");
  const controlRow = await rowOf(control);
  check(
    "an unknown message id is named and changes no other row",
    unknown.data === "unknown-email" && controlRow.status === null,
    JSON.stringify({ outcome: unknown.data, control: controlRow }),
  );

  // A status outside the ladder is an error, not a write.
  const bad = await logRow(`hook-${stamp}-bad`);
  const invalid = await apply(`hook-${stamp}-bad`, "teleported");
  const badRow = await rowOf(bad);
  check(
    "an unknown status is refused with an error",
    Boolean(invalid.error) && badRow.status === null,
    JSON.stringify({ error: invalid.error?.message, row: badRow }),
  );

  // Nobody but the service role may move a delivery row.
  const denied = await president.client.rpc("apply_email_delivery", {
    p_provider_id: `hook-${stamp}-first`,
    p_status: "bounced",
    p_status_at: "2026-10-22T11:00:00Z",
  });
  const deniedRow = await rowOf(first);
  check(
    "a signed in user cannot apply a delivery event",
    Boolean(denied.error) && deniedRow.status === "sent",
    JSON.stringify({ error: denied.error?.message, row: deniedRow }),
  );
} catch (error) {
  check("suite ran to the end", false, error instanceof Error ? error.message : String(error));
} finally {
  await cleanupAll();
}

report();
