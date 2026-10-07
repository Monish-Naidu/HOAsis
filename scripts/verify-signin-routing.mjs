/**
 * Where each kind of person lands after confirming their email.
 *
 * Three states, three destinations, and the one that matters most is the
 * resident whose board already added them: they should arrive at their own
 * balance without anyone explaining anything to them.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "route-",
  strictSignIn: false,
});

/** The same decision the callback route makes, so the test covers the rule. */
function destinationFor(memberships) {
  if (!memberships.length) return "/start";
  return memberships.some((m) => m.role !== "resident") ? "/board" : "/resident";
}

try {
  // 1. Somebody brand new, belonging to nothing.
  const founder = await makeUser("Founder", `founder-${stamp}@example.com`);
  let { data: mine } = await founder.client.rpc("my_associations");
  check("a new signup with no association goes to setup",
    destinationFor(mine ?? []) === "/start", destinationFor(mine ?? []));

  // 2. They found one, so now they run a board.
  const residentEmail = `resident-${stamp}@example.com`;
  const { data: associationId } = await founder.client.rpc("create_association", {
    p_name: "Routing HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Founder", p_founder_unit: "1",
    p_households: [{ name: "Pre Added Pat", email: residentEmail, unit: "2" }],
  });
  cleanup.associations.push(associationId);

  ({ data: mine } = await founder.client.rpc("my_associations"));
  check("the founder then goes to the board workspace",
    destinationFor(mine ?? []) === "/board", destinationFor(mine ?? []));

  // 3. The household the board pre-added, signing up for the first time.
  const resident = await makeUser("Pre Added Pat", residentEmail);
  const { data: theirs } = await resident.client.rpc("my_associations");
  check("a pre-added household is already in the association on first signup",
    (theirs ?? []).length === 1, `${(theirs ?? []).length} associations`);
  check("and lands on the resident side, not on setup",
    destinationFor(theirs ?? []) === "/resident", destinationFor(theirs ?? []));

  // 4. They can see their own home immediately, with nothing to configure.
  const { data: units } = await resident.client.rpc("my_unit_ids");
  check("with their own home attached", (units ?? []).length === 1, `${(units ?? []).length} homes`);

  const { data: association } = await resident.client
    .from("associations").select("name").eq("id", associationId).single();
  check("and can see the association they belong to",
    association?.name === "Routing HOA", association?.name ?? "none");

  // 5. Somebody who signs up with an address nobody invited stays unattached.
  const stranger = await makeUser("Stranger", `stranger-${stamp}@example.com`);
  const { data: none } = await stranger.client.rpc("my_associations");
  check("an uninvited signup joins nothing", (none ?? []).length === 0, `${(none ?? []).length}`);
  check("and is sent to found their own",
    destinationFor(none ?? []) === "/start", destinationFor(none ?? []));
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
