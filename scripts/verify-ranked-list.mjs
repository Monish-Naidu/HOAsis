/**
 * Proves migration 0029: autopay on the membership, an owner marking a notice
 * fixed, RSVPs, action items, and asking to join by code. Runs against the
 * seeded project as the Oakview president and one resident, and cleans up.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter(l=>l&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,"")]}));
const url = env.NEXT_PUBLIC_SUPABASE_URL, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PW = "Expresshoa-2026-xfpa8v";
async function as(email){ const c = createClient(url, anon, { auth: { persistSession: false } }); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(email+": "+error.message); return c; }
let pass=0, fail=0;
function ok(name, cond, detail=""){ if(cond){pass++; console.log("  ok ", name, detail)} else {fail++; console.log("  FAIL", name, detail)} }

const { data: oak } = await admin.from("associations").select("id,name,join_code").eq("name","Oakview Commons").single();
console.log("Oakview join code:", oak.join_code);
const pres = await as("monishnaidu18@gmail.com");
const jordan = await as("monishnaidu18+jordan@gmail.com");

// anon: association_by_join_code and request_to_join
const anonC = createClient(url, anon, { auth: { persistSession: false } });
const look = await anonC.rpc("association_by_join_code", { p_code: oak.join_code.toLowerCase() });
ok("anon can look up an association by code", look.data?.[0]?.name === "Oakview Commons", JSON.stringify(look.data));
const bad = await anonC.rpc("association_by_join_code", { p_code: "ZZZZZZ" });
ok("unknown code returns nothing", (bad.data ?? []).length === 0);
const req = await anonC.rpc("request_to_join", { p_code: oak.join_code, p_name: "Test Joiner", p_email: "joiner-0029@example.com", p_unit: "99", p_note: "verify" });
ok("anon can ask to join", req.data === "Oakview Commons", req.error?.message ?? "");
const again = await anonC.rpc("request_to_join", { p_code: oak.join_code, p_name: "Test Joiner", p_email: "joiner-0029@example.com", p_unit: "99", p_note: "verify" });
ok("asking twice is absorbed", again.data === "Oakview Commons" && !again.error);
const badMail = await anonC.rpc("request_to_join", { p_code: oak.join_code, p_name: "X", p_email: "nope", p_unit: "", p_note: "" });
ok("a bad email is refused", Boolean(badMail.error));
const anonRead = await anonC.from("join_requests").select("*");
ok("anon cannot read join requests", (anonRead.data ?? []).length === 0);
const jRead = await jordan.from("join_requests").select("*");
ok("a resident cannot read join requests", (jRead.data ?? []).length === 0);
const pRead = await pres.from("join_requests").select("*").eq("association_id", oak.id).eq("status","pending");
const mine = (pRead.data ?? []).filter(r => r.email === "joiner-0029@example.com");
ok("the president sees the request once", mine.length === 1, String((pRead.data??[]).length));
const decide = await pres.from("join_requests").update({ status: "declined", decided_on: "2026-09-05", decided_by: "Test" }).eq("id", mine[0]?.id).select();
ok("the president can decide it", decide.data?.[0]?.status === "declined", decide.error?.message ?? "");

// autopay
const ap = await jordan.rpc("set_my_autopay", { p_association_id: oak.id, p_autopay: { day: 3, capCents: 50000 } });
ok("a resident sets their own autopay", !ap.error, ap.error?.message ?? "");
const jordanId = (await jordan.auth.getUser()).data.user.id;
const { data: jm } = await admin.from("memberships").select("autopay, unit_id, profile_id").eq("association_id", oak.id).eq("profile_id", jordanId).is("ends_on", null).single();
ok("the plan is stored on the membership", jm?.autopay?.day === 3 && jm?.autopay?.capCents === 50000, JSON.stringify(jm?.autopay));
const apOff = await jordan.rpc("set_my_autopay", { p_association_id: oak.id, p_autopay: null });
ok("and can be turned off", !apOff.error);

// rsvp
let { data: mtgs } = await admin.from("meetings").select("id").eq("association_id", oak.id).limit(1);
let mtgId = mtgs?.[0]?.id;
let createdMtg = false;
if (!mtgId) { const ins = await admin.from("meetings").insert({ association_id: oak.id, title: "Verify 0029", held_on: "2026-10-01", held_at: "7:00 PM", location: "Clubhouse", status: "scheduled", kind: "board", agenda: [] }).select().single(); mtgId = ins.data.id; createdMtg = true; }
const r1 = await jordan.rpc("rsvp_meeting", { p_meeting_id: mtgId, p_response: "yes" });
ok("a resident can rsvp", !r1.error, r1.error?.message ?? "");
await jordan.rpc("rsvp_meeting", { p_meeting_id: mtgId, p_response: "no" });
const { data: m2 } = await admin.from("meetings").select("rsvps").eq("id", mtgId).single();
const entries = (m2.rsvps ?? []).filter(e => e.profileId === jm.profile_id);
ok("a second answer replaces the first", entries.length === 1 && entries[0].response === "no", JSON.stringify(m2.rsvps));
const rBad = await jordan.rpc("rsvp_meeting", { p_meeting_id: mtgId, p_response: "maybe" });
ok("maybe is refused", Boolean(rBad.error));
if (createdMtg) await admin.from("meetings").delete().eq("id", mtgId);

// violations: owner marks fixed
const { data: units } = await admin.from("units").select("id,label").eq("association_id", oak.id);
const jordanUnit = units.find(u => u.id === jm.unit_id);
const other = units.find(u => u.id !== jm.unit_id);
const v1 = await admin.from("violations").insert({ association_id: oak.id, unit_id: jordanUnit.id, unit_label: jordanUnit.label, owner_name: "Jordan", reference: "V-0029-A", rule: "verify", rule_citation: "Rules 1", stage: "courtesy", opened_on: "2026-09-01", next_action_on: "2026-09-15", photos: [], fine_cents: 0 }).select().single();
const v2 = await admin.from("violations").insert({ association_id: oak.id, unit_id: other.id, unit_label: other.label, owner_name: "Other", reference: "V-0029-B", rule: "verify", rule_citation: "Rules 1", stage: "courtesy", opened_on: "2026-09-01", next_action_on: "2026-09-15", photos: [], fine_cents: 0 }).select().single();
if (v1.error || v2.error) console.log("insert err", v1.error?.message, v2.error?.message);
const f1 = await jordan.rpc("mark_violation_fixed", { p_violation_id: v1.data?.id, p_note: "  cleared it up  " });
ok("an owner marks their own notice fixed", !f1.error, f1.error?.message ?? "");
const { data: vf } = await admin.from("violations").select("owner_fixed_on, owner_fixed_note").eq("id", v1.data?.id).single();
ok("the note is trimmed and dated", vf?.owner_fixed_note === "cleared it up" && Boolean(vf?.owner_fixed_on), JSON.stringify(vf));
const f2 = await jordan.rpc("mark_violation_fixed", { p_violation_id: v2.data?.id, p_note: "" });
ok("a neighbour's notice is refused", Boolean(f2.error), f2.error?.message ?? "");
await admin.from("violations").delete().in("id", [v1.data?.id, v2.data?.id]);

// action items
const ai = await pres.from("action_items").insert({ association_id: oak.id, title: "Verify item", owner_name: "Monish" }).select().single();
ok("the president adds an action item", !ai.error, ai.error?.message ?? "");
const aiJ = await jordan.from("action_items").select("*").eq("association_id", oak.id);
ok("a resident cannot see action items", (aiJ.data ?? []).length === 0);
const aiJw = await jordan.from("action_items").insert({ association_id: oak.id, title: "Sneak", owner_name: "J" });
ok("a resident cannot add one", Boolean(aiJw.error));
await admin.from("action_items").delete().eq("id", ai.data?.id);
await admin.from("join_requests").delete().eq("email", "joiner-0029@example.com");
console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail ? 1 : 0);
