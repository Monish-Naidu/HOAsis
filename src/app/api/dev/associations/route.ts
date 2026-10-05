import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { testToolsBlocked } from "../guard";

/**
 * Listing and deleting associations, for testing.
 *
 * Deleting one properly is already a supported act with its own guards, and
 * this deliberately does not use it: the product flow is soft, reversible and
 * President only, which is right for a real board and useless for clearing up
 * after a test run. This is the hard version, behind the same locks as the
 * full reset (./guard.ts): never in production, only with the flag, only on
 * the project named as safe to empty, and never next to an association that
 * looks live.
 */

export async function GET() {
  // 200 with the reason, not a 404: the test tools page reads the body to
  // say why the tools are off.
  const reason = await testToolsBlocked(supabaseAdmin);
  if (reason) return NextResponse.json({ enabled: false, reason });

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("associations")
    .select("id, name, city, state, created_at, deleted_at")
    .order("created_at", { ascending: false });

  // How big each one is, so somebody can tell a real association from a test
  // one before deleting it.
  const rows = [];
  for (const association of data ?? []) {
    const { count: homes } = await admin
      .from("units")
      .select("*", { count: "exact", head: true })
      .eq("association_id", association.id);
    const { count: payments } = await admin
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("association_id", association.id);
    rows.push({ ...association, homes: homes ?? 0, payments: payments ?? 0 });
  }

  return NextResponse.json({ enabled: true, associations: rows });
}

export async function DELETE(request: NextRequest) {
  const reason = await testToolsBlocked(supabaseAdmin);
  if (reason) return NextResponse.json({ error: reason }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("associations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: id });
}
