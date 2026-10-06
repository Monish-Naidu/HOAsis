/**
 * Onboarding at the sizes that actually exist.
 *
 * Two homes is a real association: several states set no floor at all, and a
 * duplex with shared roof and grounds is genuinely governed by CC&Rs. A
 * hundred and fifty is where reserve studies become statutory in several
 * states. Both ends have to work, and the middle is where every product is
 * already comfortable.
 *
 * Everything created here is deleted at the end, including on failure.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  admin, stamp, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "scale-",
  strictSignIn: false,
  demotePresident: true,
});

const SCALES = [
  { name: "a duplex", homes: 2, dues: 15_000 },
  { name: "a small association", homes: 24, dues: 6_000 },
  { name: "a large association", homes: 150, dues: 28_500 },
];

try {
  for (const scale of SCALES) {
    const founderEmail = `founder-${scale.homes}-${stamp}@example.com`;
    const founder = await makeUser("Founder", founderEmail);

    // Everyone except the founder, who is unit 1.
    const households = Array.from({ length: scale.homes - 1 }, (_, i) => ({
      name: `Household ${i + 2}`,
      email: `owner-${scale.homes}-${i + 2}-${stamp}@example.com`,
      unit: String(i + 2),
    }));

    const started = Date.now();
    const { data: associationId, error } = await founder.client.rpc("create_association", {
      p_name: `Scale ${scale.homes} HOA`,
      p_city: "Bothell",
      p_state: "WA",
      p_dues_cents: scale.dues,
      p_dues_cadence: "monthly",
      p_due_day: 1,
      p_founder_name: "Pat Founder",
      p_founder_unit: "1",
      p_households: households,
    });
    const elapsed = Date.now() - started;

    check(`${scale.name}: founding ${scale.homes} homes succeeds`, !error, error?.message ?? "");
    if (!associationId) continue;
    cleanup.associations.push(associationId);
    // Books open on the founding day unless told otherwise (0056); this suite
    // bills periods that fell due before today.
    await admin.from("associations").update({ billing_starts_on: "2000-01-01" }).eq("id", associationId);

    // Slow onboarding is abandoned onboarding, and this is one round trip.
    check(
      `${scale.name}: founding finishes quickly`,
      elapsed < 15_000,
      `${(elapsed / 1000).toFixed(1)}s`,
    );

    const { count: units } = await admin
      .from("units").select("*", { count: "exact", head: true })
      .eq("association_id", associationId);
    check(`${scale.name}: every home is on the register`, units === scale.homes, `${units}`);

    const { count: memberships } = await admin
      .from("memberships").select("*", { count: "exact", head: true })
      .eq("association_id", associationId);
    check(
      `${scale.name}: every home has a membership`,
      memberships === scale.homes,
      `${memberships}`,
    );

    // Billing everybody, which is the one bulk write a board does monthly.
    const billStarted = Date.now();
    const { data: billed } = await founder.client.rpc("issue_assessment", {
      p_association_id: associationId,
      p_label: "First assessment",
      p_due_on: new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10),
    });
    const billElapsed = Date.now() - billStarted;
    check(`${scale.name}: billing reaches every home`, billed === scale.homes, `${billed}`);
    check(
      `${scale.name}: billing finishes quickly`,
      billElapsed < 10_000,
      `${(billElapsed / 1000).toFixed(1)}s`,
    );

    // Reading the association back is what every screen does on load.
    const readStarted = Date.now();
    const [assoc, unitRows, charges, balances] = await Promise.all([
      founder.client.from("associations").select("*").eq("id", associationId).single(),
      founder.client.from("units").select("*").eq("association_id", associationId),
      founder.client.from("charges").select("*").eq("association_id", associationId),
      founder.client.from("unit_balances").select("*").eq("association_id", associationId),
    ]);
    const readElapsed = Date.now() - readStarted;

    check(
      `${scale.name}: the whole association loads in under two seconds`,
      readElapsed < 2_000,
      `${readElapsed}ms`,
    );
    // There is deliberately no stored unit count. It is derived from the rows,
    // so it cannot drift from the register the way a cached number would.
    check(
      `${scale.name}: the home count is derived rather than stored`,
      assoc.data !== null && !("unit_count" in assoc.data) && unitRows.data?.length === scale.homes,
      `${unitRows.data?.length} homes on the register`,
    );
    check(
      `${scale.name}: every home owes the assessment`,
      (balances.data ?? []).every((b) => b.balance_cents === scale.dues),
      `${(balances.data ?? []).filter((b) => b.balance_cents !== scale.dues).length} wrong`,
    );
    check(
      `${scale.name}: total owed is homes times dues`,
      (balances.data ?? []).reduce((t, b) => t + b.balance_cents, 0) ===
        scale.homes * scale.dues,
      `${(balances.data ?? []).reduce((t, b) => t + b.balance_cents, 0)}`,
    );
    check(`${scale.name}: one charge per home`, charges.data?.length === scale.homes, `${charges.data?.length}`);
  }

  // The floor. An association of one is a house, not an association, but the
  // product should not pretend to know better than a board that says otherwise.
  const soloEmail = `solo-${stamp}@example.com`;
  const solo = await makeUser("Solo", soloEmail);
  const { data: soloId, error: soloError } = await solo.client.rpc("create_association", {
    p_name: "Single Home HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 5_000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Solo Founder", p_founder_unit: "1", p_households: [],
  });
  if (soloId) cleanup.associations.push(soloId);
  check("an association of one home is allowed", !soloError && Boolean(soloId), soloError?.message ?? "");

  // Nonsense a form should refuse rather than store.
  const { error: noName } = await solo.client.rpc("create_association", {
    p_name: "   ", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 5_000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "X", p_founder_unit: "1",
  });
  check("an association with no name is refused", Boolean(noName), noName?.message?.slice(0, 40) ?? "no error");

  const { error: negative } = await solo.client.rpc("create_association", {
    p_name: "Negative HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: -100, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "X", p_founder_unit: "1",
  });
  check("negative dues are refused", Boolean(negative), negative?.message?.slice(0, 40) ?? "no error");

  // Duplicate units within one association would give a household two bills.
  const { data: dupId } = await solo.client.rpc("create_association", {
    p_name: "Duplicate Unit HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 5_000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "X", p_founder_unit: "1",
    p_households: [
      { name: "A", email: `a-${stamp}@example.com`, unit: "2" },
      { name: "B", email: `b-${stamp}@example.com`, unit: "2" },
    ],
  });
  if (dupId) cleanup.associations.push(dupId);
  const { count: dupUnits } = await admin
    .from("units").select("*", { count: "exact", head: true }).eq("association_id", dupId);
  check("a repeated unit number is collapsed rather than duplicated", dupUnits === 2, `${dupUnits} units`);
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
