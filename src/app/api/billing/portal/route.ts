import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

/**
 * Stripe's hosted billing page: change the card, see invoices, cancel.
 *
 * We do not rebuild any of that. A board that wants a receipt gets Stripe's
 * receipt, which is the one their accountant already recognises.
 */
export async function POST(request: NextRequest) {
  let body: { associationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const associationId = body.associationId;
  if (!associationId) {
    return NextResponse.json({ error: "associationId is required" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_capability", {
    target: associationId,
    needed: "settings",
  });
  if (!allowed) {
    return NextResponse.json({ error: "You do not have the settings capability" }, { status: 403 });
  }

  const { data: row } = await supabaseAdmin()
    .from("associations")
    .select("billing_customer_id")
    .eq("id", associationId)
    .single();
  if (!row?.billing_customer_id) {
    return NextResponse.json({ error: "No card on file yet" }, { status: 404 });
  }

  const session = await stripe().billingPortal.sessions.create({
    customer: row.billing_customer_id,
    return_url: `${request.nextUrl.origin}/board/settings`,
  });
  return NextResponse.json({ url: session.url });
}
