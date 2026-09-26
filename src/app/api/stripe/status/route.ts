import { NextResponse, type NextRequest } from "next/server";
import { syncAccountStatus } from "@/lib/stripe/account-status";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Whether this association can take a payment right now.
 *
 * For any signed-in member, not only the board: the pay screen asks this
 * when the cached column says "not yet" but an account exists, which is the
 * shape of an association whose treasurer finished onboarding an hour ago
 * and has not opened Settings since. RLS answers whether the caller may see
 * the association at all; the status itself is nothing secret.
 */
export async function GET(request: NextRequest) {
  const associationId = request.nextUrl.searchParams.get("associationId");
  if (!associationId) {
    return NextResponse.json({ error: "associationId is required" }, { status: 400 });
  }
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  const { data: row } = await supabase
    .from("associations")
    .select("stripe_account_id, stripe_charges_enabled")
    .eq("id", associationId)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "No such association" }, { status: 404 });
  }
  if (!row.stripe_account_id) {
    return NextResponse.json({ accountId: null, chargesEnabled: false });
  }
  if (row.stripe_charges_enabled) {
    return NextResponse.json({ accountId: row.stripe_account_id, chargesEnabled: true });
  }
  const status = await syncAccountStatus(associationId, row.stripe_account_id);
  return NextResponse.json({ accountId: status.accountId, chargesEnabled: status.chargesEnabled });
}
