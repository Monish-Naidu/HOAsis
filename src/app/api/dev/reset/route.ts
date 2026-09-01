import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Emptying the database, for testing.
 *
 * This deletes other people's data. Not "data belonging to the caller", all of
 * it, which is why the gate is a server side environment variable rather than
 * a hidden route or a flag the browser can set. A page can be found; an
 * environment variable that is absent in production cannot be talked into
 * existing.
 *
 * Three separate protections, and all three have to hold:
 *
 * The gate is deliberately only that variable. Requiring a session as well
 * sounds safer and is not: clearing every account is the point, and a tool
 * that then refuses to run because nobody is signed in has locked you out of
 * the mess it just made.
 *
 * If this ever needs to run against real data, delete it and let somebody
 * rewrite it who has thought about the problem again.
 */

/** Order matters: children before parents, so nothing is orphaned mid-run. */
const TABLES = [
  "payment_allocations",
  "payments",
  "ledger_entries",
  "charges",
  "bank_accounts",
  "votes",
  "ballot_options",
  "ballots",
  "meetings",
  "requests",
  "documents",
  "posts",
  "announcements",
  "vendors",
  "amenities",
  "email_log",
  "email_optouts",
  "setup_dismissals",
  "memberships",
  "units",
  "associations",
] as const;

function allowed(): string | null {
  if (process.env.ALLOW_TEST_RESET !== "true") {
    return "Test reset is switched off. Set ALLOW_TEST_RESET=true on the server to enable it, and never in production.";
  }
  return null;
}

export async function GET() {
  const blocked = allowed();
  if (blocked) return NextResponse.json({ enabled: false, reason: blocked }, { status: 200 });

  const admin = supabaseAdmin();
  const counts: Record<string, number> = {};
  for (const table of ["associations", "units", "memberships", "payments", "charges"]) {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true });
    counts[table] = count ?? 0;
  }
  const { data: users } = await admin.auth.admin.listUsers();
  counts.accounts = users?.users.length ?? 0;

  return NextResponse.json({ enabled: true, counts });
}

export async function POST(request: NextRequest) {
  const blocked = allowed();
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });


  let body: { confirm?: string; keepEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  if (body.confirm !== "DELETE EVERYTHING") {
    return NextResponse.json(
      { error: 'Type DELETE EVERYTHING exactly to confirm.' },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();
  const removed: Record<string, number> = {};

  // The president invariant is a deferred constraint, and wiping the whole
  // table trips it. Associations go first so their memberships cascade away
  // rather than being deleted out from under a live association.
  const { data: associations } = await admin.from("associations").select("id");
  for (const association of associations ?? []) {
    await admin.from("associations").delete().eq("id", association.id);
  }
  removed.associations = (associations ?? []).length;

  // Anything an association did not own, such as a row left behind by a
  // half finished test. Failures are ignored on purpose: a table that is
  // already empty, or has no id column, is not a problem worth stopping for.
  for (const table of TABLES) {
    if (table === "associations") continue;
    await admin.from(table).delete().not("id", "is", null);
  }

  // Accounts, so a re-run of a signup test is not blocked by an address that
  // already exists.
  const { data: users } = await admin.auth.admin.listUsers();
  const keep = body.keepEmail?.trim().toLowerCase();
  let deletedUsers = 0;
  for (const user of users?.users ?? []) {
    if (keep && user.email?.toLowerCase() === keep) continue;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (!error) deletedUsers++;
  }
  removed.accounts = deletedUsers;

  // Uploaded cover photographs, which outlive their association otherwise.
  const { data: folders } = await admin.storage.from("community").list();
  for (const folder of folders ?? []) {
    const { data: files } = await admin.storage.from("community").list(folder.name);
    if (files?.length) {
      await admin.storage
        .from("community")
        .remove(files.map((f) => `${folder.name}/${f.name}`));
    }
  }

  return NextResponse.json({ removed });
}
