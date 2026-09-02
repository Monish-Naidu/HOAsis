import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

/**
 * Connect onboarding for an association.
 *
 * POST creates the connected account on first call and returns a hosted
 * onboarding link either way; GET reports where onboarding stands. The
 * controller settings are the "Stripe handles pricing" shape on purpose:
 * Stripe bills the HOA its own processing fees, carries payment losses, and
 * gives the treasurer a full dashboard, which leaves the platform with no
 * monthly per-account fee and near-zero loss exposure. Dues settle to the
 * association's own bank account, never to us.
 *
 * Authorization matches the email route: the caller's own session answers
 * has_capability, so a crafted request from someone else's console gets a 403.
 */
async function authorize(request: NextRequest, associationId: string | null) {
  if (!associationId) {
    return { error: NextResponse.json({ error: "associationId is required" }, { status: 400 }) };
  }
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: NextResponse.json({ error: "Sign in first" }, { status: 401 }) };
  }
  const { data: allowed } = await supabase.rpc("has_capability", {
    target: associationId,
    needed: "finances",
  });
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: "You do not have the finances capability" },
        { status: 403 },
      ),
    };
  }
  return { supabase };
}

export async function GET(request: NextRequest) {
  const associationId = request.nextUrl.searchParams.get("associationId");
  const auth = await authorize(request, associationId);
  if (auth.error) return auth.error;

  const { data: row } = await auth.supabase
    .from("associations")
    .select("stripe_account_id")
    .eq("id", associationId!)
    .single();

  if (!row?.stripe_account_id) {
    return NextResponse.json({ accountId: null, chargesEnabled: false, detailsSubmitted: false });
  }

  const account = await stripe().accounts.retrieve(row.stripe_account_id);
  return NextResponse.json({
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
  });
}

export async function POST(request: NextRequest) {
  let body: { associationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const associationId = body.associationId ?? null;
  const auth = await authorize(request, associationId);
  if (auth.error) return auth.error;

  const { data: row } = await auth.supabase
    .from("associations")
    .select("name, ein, stripe_account_id")
    .eq("id", associationId!)
    .single();
  if (!row) {
    return NextResponse.json({ error: "No such association" }, { status: 404 });
  }

  let accountId = row.stripe_account_id;
  if (!accountId) {
    const account = await stripe().accounts.create({
      country: "US",
      controller: {
        fees: { payer: "account" },
        losses: { payments: "stripe" },
        stripe_dashboard: { type: "full" },
        requirement_collection: "stripe",
      },
      business_profile: { name: row.name },
      company: row.ein ? { tax_id: row.ein } : undefined,
      metadata: { association_id: associationId! },
    });
    accountId = account.id;
    // The service role writes the id: the column is plumbing the browser has
    // no reason to be able to set, so no RLS policy allows it.
    const { error } = await supabaseAdmin()
      .from("associations")
      .update({ stripe_account_id: accountId })
      .eq("id", associationId!);
    if (error) {
      return NextResponse.json({ error: "Could not save the account" }, { status: 500 });
    }
  }

  const origin = request.nextUrl.origin;
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${origin}/board/settings?stripe=return`,
    refresh_url: `${origin}/board/settings?stripe=refresh`,
  });
  return NextResponse.json({ url: link.url });
}
