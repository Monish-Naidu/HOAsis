import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Listing and deleting associations, for testing.
 *
 * Deleting one properly is already a supported act with its own guards, and
 * this deliberately does not use it: the product flow is soft, reversible and
 * President only, which is right for a real board and useless for clearing up
 * after a test run. This is the hard version, gated the same way as the full
 * reset.
 */

function blocked(): string | null {
  return process.env.ALLOW_TEST_RESET === "true"
    ? null
    : "Test tools are switched off. Set ALLOW_TEST_RESET=true on the server.";
}

export async function GET() {
  const reason = blocked();
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
  const reason = blocked();
  if (reason) return NextResponse.json({ error: reason }, { status: 403 });


  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("associations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: id });
}
