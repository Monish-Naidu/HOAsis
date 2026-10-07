/**
 * Proves the three doors into an association, against the real database.
 *
 *   node scripts/verify-join-flow.mjs
 *
 * A founder sets up Willow Creek Estates with thirteen households: three
 * who will sit on the board and ten owners. Then:
 *
 *   - the founder names the three officers before any of them has an account,
 *     and the office is waiting when the treasurer signs up;
 *   - an owner the board added signs up with the same email and is seated;
 *   - a stranger creates an account through the join code, sees that they are
 *     waiting on the board, and is seated the moment the board lets them in.
 *
 * Accounts are created through the admin API with the address pre-confirmed,
 * because the built in mailer is capped; the trigger under test fires on the
 * insert either way.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  admin, anon, stamp, PASSWORD, check, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "join-",
});
const mail = (tag) => `willow-${tag}-${stamp}@example.com`;

async function signUp(email, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`signup ${email}: ${error.message}`);
  cleanup.users.push(data.user.id);
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw new Error(`sign in ${email}: ${signInError.message}`);
  return { client, userId: data.user.id, email };
}

const BOARD = [
  { name: "Grace Okafor", tag: "treasurer", role: "treasurer", address: "102 Willow Creek Dr" },
  { name: "Tomas Reyes", tag: "secretary", role: "secretary", address: "103 Willow Creek Dr" },
  { name: "June Park", tag: "vp", role: "vice-president", address: "104 Willow Creek Dr" },
];
const OWNERS = Array.from({ length: 10 }, (_, i) => ({
  name: `Owner ${i + 1}`,
  tag: `owner${i + 1}`,
  address: `${105 + i} Willow Creek Dr`,
}));

try {
  // 1. The founder signs up and founds the association with everybody on it.
  const founder = await signUp(mail("founder"), "Dana Whitcomb");
  const households = [...BOARD, ...OWNERS].map((h) => ({
    name: h.name, email: mail(h.tag), unit: h.address, address: h.address,
  }));
  const { data: associationId, error: createError } = await founder.client.rpc("create_association", {
    p_name: "Willow Creek Estates", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 9500, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Dana Whitcomb", p_founder_unit: "101 Willow Creek Dr",
    p_households: households,
  });
  check("the founder founds the association with 13 households", !createError && Boolean(associationId), createError?.message ?? "");
  if (associationId) cleanup.associations.push(associationId);

  const { data: units } = await founder.client.from("units").select("id,label").eq("association_id", associationId);
  check("fourteen homes are on the register", (units ?? []).length === 14, `${(units ?? []).length}`);
  const unitByLabel = Object.fromEntries((units ?? []).map((u) => [u.label, u.id]));

  const { data: assoc } = await founder.client.from("associations").select("join_code").eq("id", associationId).single();
  const code = assoc?.join_code;
  check("the association has a join code", typeof code === "string" && code.length === 6, code ?? "none");

  // 2. Officers are named by home, before they exist as people.
  for (const officer of BOARD) {
    const { error } = await founder.client
      .from("memberships")
      .update({ role: officer.role, capabilities: officer.role === "treasurer" ? ["finances", "vendors"] : ["communications", "documents"] })
      .eq("association_id", associationId)
      .eq("unit_id", unitByLabel[officer.address])
      .is("ends_on", null)
      .neq("role", "president");
    check(`the founder names ${officer.name} ${officer.role} before they sign up`, !error, error?.message ?? "");
  }

  // 3. The treasurer signs up with the email the founder used: seated, as treasurer.
  const treasurer = await signUp(mail("treasurer"), "Grace Okafor");
  const { data: tMine } = await treasurer.client.rpc("my_associations");
  const tRow = (tMine ?? []).find((m) => m.association_id === associationId);
  check("the treasurer lands in the association on sign up", Boolean(tRow), `${(tMine ?? []).length}`);
  check("and holds the treasurer's office", tRow?.role === "treasurer", tRow?.role ?? "none");
  check("with the treasurer's capabilities", (tRow?.capabilities ?? []).includes("finances"), String(tRow?.capabilities));

  // 4. An owner the board added signs up and is seated as a resident.
  const owner3 = await signUp(mail("owner3"), "Owner 3");
  const { data: oMine } = await owner3.client.rpc("my_associations");
  const oRow = (oMine ?? []).find((m) => m.association_id === associationId);
  check("an added owner lands in the association on sign up", oRow?.role === "resident", oRow?.role ?? "none");
  const { data: oUnits } = await owner3.client.rpc("my_unit_ids");
  check("and holds exactly their own home", (oUnits ?? []).length === 1 && oUnits[0] === unitByLabel["107 Willow Creek Dr"], String(oUnits));

  // 5. A stranger with the code: account first, then the ask, then the wait.
  const strangerEmail = mail("newcomer");
  const { data: lookedUp } = await anon().rpc("association_by_join_code", { p_code: code.toLowerCase() });
  check("the code names the association to a visitor", lookedUp?.[0]?.name === "Willow Creek Estates", JSON.stringify(lookedUp));
  const stranger = await signUp(strangerEmail, "Nadia Bell");
  const { data: asked, error: askError } = await stranger.client.rpc("request_to_join", {
    p_code: code, p_name: "Nadia Bell", p_email: strangerEmail, p_unit: "115 Willow Creek Dr", p_note: "Closed last week",
  });
  check("a signed in newcomer asks to join with the code", asked === "Willow Creek Estates" && !askError, askError?.message ?? String(asked));
  const { data: sMine } = await stranger.client.rpc("my_associations");
  check("they belong to nothing yet", (sMine ?? []).length === 0, String((sMine ?? []).length));
  const { data: waiting } = await stranger.client.rpc("my_join_requests");
  check("and can see they are waiting on the board", waiting?.[0]?.status === "pending" && waiting[0].name === "Willow Creek Estates", JSON.stringify(waiting));
  const { data: nobody } = await anon().rpc("my_join_requests");
  check("a visitor sees no requests", (nobody ?? []).length === 0, String((nobody ?? []).length));

  // 6. The board lets them in: the same add as any household, and the seat
  //    is claimed on the spot because the account already exists.
  const { data: pending } = await founder.client.from("join_requests").select("id,email,unit_label").eq("association_id", associationId).eq("status", "pending");
  const theirs = (pending ?? []).find((j) => j.email === strangerEmail);
  check("the founder sees the request", Boolean(theirs), String((pending ?? []).length));
  const { data: newUnit, error: addError } = await founder.client.rpc("add_household", {
    p_association_id: associationId, p_unit_id: null, p_name: "Nadia Bell", p_email: strangerEmail, p_unit: theirs?.unit_label ?? "115 Willow Creek Dr",
  });
  check("the founder adds the home", !addError && Boolean(newUnit), addError?.message ?? "");
  await founder.client.from("join_requests").update({ status: "approved", decided_on: new Date().toISOString().slice(0, 10), decided_by: "Dana Whitcomb" }).eq("id", theirs?.id);
  const { data: sNow } = await stranger.client.rpc("my_associations");
  check("the newcomer is seated the moment the board says yes", (sNow ?? []).some((m) => m.association_id === associationId && m.role === "resident"), JSON.stringify(sNow));
  const { data: decided } = await stranger.client.rpc("my_join_requests");
  check("and their request reads approved", decided?.[0]?.status === "approved", decided?.[0]?.status ?? "none");

  // 7. The wall: a resident cannot name officers.
  const { error: sneak, data: sneaked } = await owner3.client
    .from("memberships").update({ role: "treasurer" }).eq("association_id", associationId).eq("unit_id", unitByLabel["107 Willow Creek Dr"]).select();
  check("a resident cannot give themselves an office", Boolean(sneak) || (sneaked ?? []).length === 0, sneak?.message ?? `${(sneaked ?? []).length} rows`);

  // 8. A home that is already on the register (migration 0080). The board
  //    picks the home; nothing is created from what the person typed.
  const unitCount = async () =>
    (await admin.from("units").select("id", { count: "exact", head: true }).eq("association_id", associationId)).count;
  const openSeats = async (unitId) =>
    (await admin.from("memberships").select("id,full_name,profile_id,invited_email").eq("unit_id", unitId).is("ends_on", null)).data ?? [];
  const ask = async (tag, name, typed) => {
    const person = await signUp(mail(tag), name);
    await person.client.rpc("request_to_join", { p_code: code, p_name: name, p_email: mail(tag), p_unit: typed, p_note: "" });
    const { data } = await admin.from("join_requests").select("id").eq("association_id", associationId).eq("email", mail(tag)).single();
    return { ...person, requestId: data?.id };
  };
  const homes = Object.fromEntries(Object.entries(unitByLabel));
  const emptyHome = homes["110 Willow Creek Dr"];
  await admin.from("memberships").update({ full_name: "", invited_email: null }).eq("unit_id", emptyHome);
  await admin.from("memberships").update({ invited_email: null }).eq("unit_id", homes["111 Willow Creek Dr"]);
  await admin.from("memberships").update({ full_name: "", invited_email: null }).eq("unit_id", homes["113 Willow Creek Dr"]);
  const homesBefore = await unitCount();

  // 8a. An empty home takes the requester as its owner, on the spot.
  const pat = await ask("pat", "Pat Lind", "110");
  const seated = await founder.client.rpc("seat_join_request", { p_request_id: pat.requestId, p_unit_id: emptyHome });
  check("the board seats a requester on a home with no owner", !seated.error && seated.data === emptyHome, seated.error?.message ?? "");
  const { data: patMine } = await pat.client.rpc("my_associations");
  check("and they are in the association at once", (patMine ?? []).some((m) => m.association_id === associationId), JSON.stringify(patMine));
  const { data: patUnits } = await pat.client.rpc("my_unit_ids");
  check("on that home and no other", (patUnits ?? []).length === 1 && patUnits[0] === emptyHome, String(patUnits));
  check("no home was created from what they typed", (await unitCount()) === homesBefore, `${await unitCount()} vs ${homesBefore}`);
  const again = await founder.client.rpc("seat_join_request", { p_request_id: pat.requestId, p_unit_id: emptyHome });
  check("asking twice changes nothing", !again.error && (await openSeats(emptyHome)).length === 1, again.error?.message ?? "");

  // 8b. A home whose listed owner has not signed in, with no email on file.
  const sol = await ask("sol", "Sol Marsh", "111");
  const solSeat = await founder.client.rpc("seat_join_request", { p_request_id: sol.requestId, p_unit_id: homes["111 Willow Creek Dr"] });
  const solSeats = await openSeats(homes["111 Willow Creek Dr"]);
  check("a listed owner with no email hands the seat to the requester", !solSeat.error && solSeats.length === 1 && solSeats[0].full_name === "Sol Marsh" && Boolean(solSeats[0].profile_id), solSeat.error?.message ?? JSON.stringify(solSeats));

  // 8c. A different owner: refused as the only owner, allowed as a second.
  const rae = await ask("rae", "Rae Stone", "108");
  const unsignedOther = await founder.client.rpc("seat_join_request", { p_request_id: rae.requestId, p_unit_id: homes["108 Willow Creek Dr"] });
  check("an owner who has not signed in, with another email, is not replaced", /already has an owner/i.test(unsignedOther.error?.message ?? ""), unsignedOther.error?.message ?? "no error");
  const quinn = await ask("quinn", "Quinn Ross", "107");
  const signedOther = await founder.client.rpc("seat_join_request", { p_request_id: quinn.requestId, p_unit_id: homes["107 Willow Creek Dr"] });
  check("an owner who has signed in is not replaced", /already has an owner/i.test(signedOther.error?.message ?? ""), signedOther.error?.message ?? "no error");
  check("and nothing was seated or created", (await openSeats(homes["107 Willow Creek Dr"])).length === 1 && (await unitCount()) === homesBefore);
  const second = await founder.client.rpc("seat_join_request", { p_request_id: quinn.requestId, p_unit_id: homes["107 Willow Creek Dr"], p_as_second: true });
  const { data: quinnUnits } = await quinn.client.rpc("my_unit_ids");
  check("as a second owner they share the home", !second.error && (quinnUnits ?? []).includes(homes["107 Willow Creek Dr"]), second.error?.message ?? String(quinnUnits));
  const { data: ownerStill } = await owner3.client.rpc("my_unit_ids");
  check("and the first owner keeps theirs", (ownerStill ?? []).includes(homes["107 Willow Creek Dr"]), String(ownerStill));
  check("two seats, one home", (await openSeats(homes["107 Willow Creek Dr"])).length === 2 && (await unitCount()) === homesBefore);

  // 8d. Only a settings holder, and only on their own association.
  const raeByOwner = await owner3.client.rpc("seat_join_request", { p_request_id: rae.requestId, p_unit_id: homes["109 Willow Creek Dr"] });
  check("a resident cannot seat anybody", Boolean(raeByOwner.error), raeByOwner.error?.message ?? "no error");
  const byVisitor = await anon().rpc("seat_join_request", { p_request_id: rae.requestId, p_unit_id: homes["109 Willow Creek Dr"] });
  check("a visitor cannot seat anybody", Boolean(byVisitor.error), byVisitor.error?.message ?? "no error");

  // 8e. A second owner from the household card.
  const leeEmail = mail("lee");
  const added = await founder.client.rpc("add_second_owner", { p_unit_id: homes["112 Willow Creek Dr"], p_name: "Lee Two", p_email: leeEmail });
  check("the board adds a second owner to a home with one", !added.error && (await openSeats(homes["112 Willow Creek Dr"])).length === 2, added.error?.message ?? "");
  const lee = await signUp(leeEmail, "Lee Two");
  const { data: leeUnits } = await lee.client.rpc("my_unit_ids");
  check("who claims the seat by signing up with that email", (leeUnits ?? []).includes(homes["112 Willow Creek Dr"]), String(leeUnits));
  const twice = await founder.client.rpc("add_second_owner", { p_unit_id: homes["112 Willow Creek Dr"], p_name: "Lee Two", p_email: leeEmail });
  check("the same person is not added twice", Boolean(twice.error), twice.error?.message ?? "no error");
  const onEmpty = await founder.client.rpc("add_second_owner", { p_unit_id: homes["113 Willow Creek Dr"], p_name: "Nobody First", p_email: mail("nobody") });
  check("a home with no owner is not given a second one first", Boolean(onEmpty.error), onEmpty.error?.message ?? "no error");
  const byResident = await owner3.client.rpc("add_second_owner", { p_unit_id: homes["112 Willow Creek Dr"], p_name: "Sneak", p_email: mail("sneak") });
  check("a resident cannot add an owner", Boolean(byResident.error), byResident.error?.message ?? "no error");

  // 8f. Correcting the email an owner will claim their seat with.
  const home114 = homes["114 Willow Creek Dr"];
  const fixed = await founder.client.rpc("change_owner_email", { p_unit_id: home114, p_old_email: mail("owner10"), p_new_email: mail("owner10b") });
  const fixedSeats = await openSeats(home114);
  check("the board changes the email on a seat nobody has claimed", !fixed.error && fixedSeats[0]?.invited_email === mail("owner10b"), fixed.error?.message ?? JSON.stringify(fixedSeats));
  const owner10 = await signUp(mail("owner10b"), "Owner 10");
  const { data: o10Units } = await owner10.client.rpc("my_unit_ids");
  check("and the owner signing up with the new one claims it", (o10Units ?? []).includes(home114), String(o10Units));
  const wrongOld = await founder.client.rpc("change_owner_email", { p_unit_id: homes["109 Willow Creek Dr"], p_old_email: "nobody@example.com", p_new_email: mail("x") });
  check("an email no owner has is refused", Boolean(wrongOld.error), wrongOld.error?.message ?? "no error");
  const signedIn = await founder.client.rpc("change_owner_email", { p_unit_id: homes["107 Willow Creek Dr"], p_old_email: mail("owner3"), p_new_email: mail("owner3c") });
  check("an owner who has signed in keeps their own email", Boolean(signedIn.error), signedIn.error?.message ?? "no error");
  const byOwner = await owner3.client.rpc("change_owner_email", { p_unit_id: homes["109 Willow Creek Dr"], p_old_email: mail("owner5"), p_new_email: mail("owner5b") });
  check("a resident cannot change an email", Boolean(byOwner.error), byOwner.error?.message ?? "no error");

  // 8g. A sale (migration 0081) ends every owner's seat, not only the newest.
  const today = new Date().toISOString().slice(0, 10);
  const sold = await founder.client.rpc("transfer_home", { p_unit_id: homes["107 Willow Creek Dr"], p_new_name: "Bea Buyer", p_new_email: mail("buyer"), p_closing_date: today });
  check("the board records a sale of a home with two owners", !sold.error, sold.error?.message ?? "");
  const { data: sellerUnits } = await owner3.client.rpc("my_unit_ids");
  const { data: coUnits } = await quinn.client.rpc("my_unit_ids");
  check("neither seller keeps the home", !(sellerUnits ?? []).includes(homes["107 Willow Creek Dr"]) && !(coUnits ?? []).includes(homes["107 Willow Creek Dr"]), `${sellerUnits} / ${coUnits}`);
  check("one seat is open, the buyer's", (await openSeats(homes["107 Willow Creek Dr"])).length === 1);
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

report();
