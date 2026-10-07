/**
 * Proves the row level security policies actually hold.
 *
 * The whole argument for moving off localStorage is that access stops being a
 * thing the client politely declines to do and becomes a thing the database
 * refuses. That claim is worth nothing until someone tries to break it, so
 * this signs in as real users and attempts the reads that must fail.
 *
 * Run against a development project. It creates data and deletes it after.
 */

import { createHarness } from "./lib/harness.mjs";

/* ------------------------------------------------------------------ setup */

const {
  admin, anon, stamp, PASSWORD, check, cleanup, cleanupAll, report,
} = createHarness({ passwordPrefix: "verify-rls-" });
const email = (who) => `rls-${who}-${stamp}@example.com`;

/** A client acting as a signed in person, subject to every policy. */
async function clientFor(address) {
  const client = anon();
  const { error } = await client.auth.signInWithPassword({
    email: address,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign in failed for ${address}: ${error.message}`);
  return client;
}

async function makeUser(who) {
  const address = email(who);
  const { data, error } = await admin.auth.admin.createUser({
    email: address,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`create user ${who}: ${error.message}`);
  await admin.from("profiles").insert({
    id: data.user.id,
    full_name: who,
    email: address,
  });
  return { id: data.user.id, email: address };
}

async function seed() {
  // Two associations, so cross-tenant leakage has somewhere to leak to.
  const [alpha, beta] = await Promise.all(
    ["Alpha Ridge", "Beta Hollow"].map(async (name) => {
      const { data, error } = await admin
        .from("associations")
        .insert({ name, city: "Bothell", state: "WA", dues_cents: 6000 })
        .select()
        .single();
      if (error) throw new Error(`association ${name}: ${error.message}`);
      cleanup.associations.push(data.id);
      return data;
    }),
  );

  const unit = async (associationId, label) => {
    const { data, error } = await admin
      .from("units")
      .insert({ association_id: associationId, label })
      .select()
      .single();
    if (error) throw new Error(`unit ${label}: ${error.message}`);
    return data;
  };

  const alphaUnit1 = await unit(alpha.id, "1");
  const alphaUnit2 = await unit(alpha.id, "2");
  const betaUnit1 = await unit(beta.id, "1");

  const [resident, neighbor, treasurer, outsider, chair] = await Promise.all([
    makeUser("resident"),
    makeUser("neighbor"),
    makeUser("treasurer"),
    makeUser("outsider"),
    makeUser("chair"),
  ]);
  cleanup.users.push(resident.id, neighbor.id, treasurer.id, outsider.id, chair.id);

  const member = async (associationId, unitId, profile, role, capabilities) => {
    const { error } = await admin.from("memberships").insert({
      association_id: associationId,
      unit_id: unitId,
      profile_id: profile.id,
      full_name: role,
      role,
      capabilities,
    });
    if (error) throw new Error(`membership ${role}: ${error.message}`);
  };

  // Every association has a sitting President, which the database insists on.
  // Building one by hand without one is not a state the product can reach.
  await member(alpha.id, alphaUnit1.id, chair, "president", ["finances", "permissions"]);
  await member(alpha.id, alphaUnit1.id, resident, "resident", []);
  await member(alpha.id, alphaUnit2.id, neighbor, "resident", []);
  await member(alpha.id, alphaUnit2.id, treasurer, "treasurer", ["finances"]);
  await member(beta.id, betaUnit1.id, outsider, "president", ["finances", "permissions"]);

  // A charge on each home, so "can I see my neighbor's balance" is answerable.
  // Dated relative to the database's own clock rather than a fixed day, so the
  // suite does not quietly start failing when the calendar moves past it.
  const day = (offset) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const past = day(-7);
  const future = day(30);

  for (const [associationId, unitId, label] of [
    [alpha.id, alphaUnit1.id, "Alpha unit 1 assessment"],
    [alpha.id, alphaUnit2.id, "Alpha unit 2 assessment"],
    [beta.id, betaUnit1.id, "Beta unit 1 assessment"],
  ]) {
    const { error } = await admin.from("charges").insert({
      association_id: associationId,
      unit_id: unitId,
      kind: "charge",
      label,
      amount_cents: 6000,
      due_on: past,
    });
    if (error) throw new Error(`charge ${label}: ${error.message}`);
  }

  // Billed but not yet owed. It must not appear in a balance.
  await admin.from("charges").insert({
    association_id: alpha.id,
    unit_id: alphaUnit1.id,
    kind: "charge",
    label: "Alpha unit 1 next assessment",
    amount_cents: 6000,
    due_on: future,
  });

  await admin.from("bank_accounts").insert({
    association_id: alpha.id,
    kind: "operating",
    institution: "Alpha Credit Union",
    mask: "1234",
  });

  return { alpha, beta, resident, neighbor, treasurer, outsider, alphaUnit1, alphaUnit2 };
}

/* ------------------------------------------------------------------ tests */

async function run() {
  const s = await seed();

  const asResident = await clientFor(s.resident.email);
  const asTreasurer = await clientFor(s.treasurer.email);
  const asOutsider = await clientFor(s.outsider.email);

  // A resident sees their own home's charges, and only those.
  {
    const { data } = await asResident.from("charges").select("label");
    const labels = (data ?? []).map((r) => r.label);
    check(
      "resident sees their own charge",
      labels.includes("Alpha unit 1 assessment"),
      labels.join(", "),
    );
    check(
      "resident cannot see a neighbor's charge",
      !labels.includes("Alpha unit 2 assessment"),
      labels.join(", "),
    );
  }

  // Cross tenant. This is the one that matters most.
  {
    const { data } = await asOutsider.from("charges").select("label");
    const labels = (data ?? []).map((r) => r.label);
    check(
      "another association's president sees none of our charges",
      !labels.some((l) => l.startsWith("Alpha")),
      labels.join(", "),
    );

    const { data: units } = await asOutsider.from("units").select("label, association_id");
    check(
      "another association's president sees none of our units",
      !(units ?? []).some((u) => u.association_id === s.alpha.id),
      String((units ?? []).length),
    );
  }

  // Capability gating, rather than mere membership.
  {
    const { data: residentSees } = await asResident.from("bank_accounts").select("institution");
    check(
      "a resident cannot read bank details",
      (residentSees ?? []).length === 0,
      String((residentSees ?? []).length),
    );

    const { data: treasurerSees } = await asTreasurer.from("bank_accounts").select("institution");
    check(
      "a treasurer with finances can read bank details",
      (treasurerSees ?? []).length === 1,
      String((treasurerSees ?? []).length),
    );

    const { data: allCharges } = await asTreasurer.from("charges").select("label");
    check(
      "a treasurer sees every charge in their association",
      (allCharges ?? []).filter((c) => c.label.startsWith("Alpha")).length === 3,
      String((allCharges ?? []).length),
    );
  }

  // Writes a browser has no business making.
  {
    const { error } = await asResident.from("payments").insert({
      association_id: s.alpha.id,
      unit_id: s.alphaUnit1.id,
      amount_cents: 1,
      rail: "ach",
    });
    check("a resident cannot insert a payment", Boolean(error), error?.code ?? "no error");

    const { error: chargeError } = await asResident.from("charges").insert({
      association_id: s.alpha.id,
      unit_id: s.alphaUnit1.id,
      kind: "charge",
      label: "self-issued credit",
      amount_cents: -100_00,
      due_on: "2026-09-01",
    });
    check(
      "a resident cannot write themselves a credit",
      Boolean(chargeError),
      chargeError?.code ?? "no error",
    );

    const { error: roleError } = await asResident
      .from("memberships")
      .update({ capabilities: ["finances", "permissions"] })
      .eq("profile_id", s.resident.id);
    const { data: after } = await admin
      .from("memberships")
      .select("capabilities")
      .eq("profile_id", s.resident.id)
      .single();
    check(
      "a resident cannot grant themselves capabilities",
      (after?.capabilities ?? []).length === 0,
      roleError?.code ?? JSON.stringify(after?.capabilities),
    );
  }

  // The derived balance view has to respect the same boundary as the table.
  {
    const { data } = await asResident.from("unit_balances").select("unit_id, balance_cents");
    const rows = data ?? [];
    const mine = rows.find((r) => r.unit_id === s.alphaUnit1.id);
    const neighbor = rows.find((r) => r.unit_id === s.alphaUnit2.id);
    check(
      "the balance view reports my own balance",
      mine?.balance_cents === 6000,
      String(mine?.balance_cents),
    );
    check(
      "a charge not yet due is not counted as owed",
      mine?.balance_cents === 6000,
      `${mine?.balance_cents} with a future charge also on the unit`,
    );
    // A row reporting zero would be worse than no row: it is a wrong number
    // rather than a visible gap.
    check(
      "the balance view returns no row for a neighbor, not a zero",
      neighbor === undefined,
      neighbor ? `leaked ${neighbor.balance_cents}` : "absent",
    );

    const { data: treasurerRows } = await asTreasurer
      .from("unit_balances")
      .select("unit_id, balance_cents");
    check(
      "a treasurer sees every home's balance",
      (treasurerRows ?? []).length === 2,
      String((treasurerRows ?? []).length),
    );
  }

  // The email on a profile is not the person's to set (0066). Two board
  // functions seat people by it, so writing a neighbour's address here was
  // a way to be handed their home at the next roster import.
  {
    const { error } = await asResident
      .from("profiles")
      .update({ email: s.neighbor.email })
      .eq("id", s.resident.id);
    const { data: after } = await admin
      .from("profiles")
      .select("email")
      .eq("id", s.resident.id)
      .single();
    check(
      "a person cannot change the email on their own profile",
      Boolean(error) && after?.email === s.resident.email,
      error?.message ?? `now ${after?.email}`,
    );

    const { error: nameError } = await asResident
      .from("profiles")
      .update({ full_name: "Renamed Resident", phone: "425 555 0100" })
      .eq("id", s.resident.id);
    check(
      "but can still change their own name and phone",
      !nameError,
      nameError?.message ?? "",
    );

    const { error: homeError } = await asResident
      .from("profiles")
      .update({ home_association_id: s.alpha.id })
      .eq("id", s.resident.id);
    const { data: home } = await admin
      .from("profiles")
      .select("home_association_id")
      .eq("id", s.resident.id)
      .single();
    check(
      "and choose the association they land in",
      !homeError && home?.home_association_id === s.alpha.id,
      homeError?.message ?? String(home?.home_association_id),
    );

    const { data: stolen } = await asResident
      .from("profiles")
      .update({ full_name: "Not me" })
      .eq("id", s.neighbor.id)
      .select("id");
    check(
      "nobody edits another person's profile",
      (stolen ?? []).length === 0,
      `${(stolen ?? []).length} rows`,
    );
  }
}

try {
  await run();
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
