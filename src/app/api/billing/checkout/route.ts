import { NextResponse, type NextRequest } from "next/server";
import { checkoutTrialEnd, subscriptionLine } from "@/lib/billing";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

/**
 * Adding a card, which is the whole of "after the trial".
 *
 * POST opens a hosted Stripe Checkout for a monthly subscription priced per
 * home, on the platform account (what the association pays us, not the
 * connected account residents pay into). The remaining free days ride along
 * as a Stripe trial, so a card added on day 20 is first charged on day 91,
 * which is what the front page promised. The webhook, not this route, writes
 * the result: Checkout can be abandoned after this returns.
 *
 * Authorization mirrors the connect route: the caller's own session answers
 * has_capability('settings'), so nobody adds a card to somebody else's board.
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

  const admin = supabaseAdmin();
  const { data: row, error } = await admin
    .from("associations")
    .select("id, name, trial_ends_at, billing_customer_id, billing_subscription_id")
    .eq("id", associationId)
    .single();
  if (error || !row) return NextResponse.json({ error: "No such association" }, { status: 404 });
  if (row.billing_subscription_id) {
    return NextResponse.json({ error: "A card is already on file" }, { status: 409 });
  }

  const { count } = await admin
    .from("units")
    .select("*", { count: "exact", head: true })
    .eq("association_id", associationId);
  const homes = count ?? 1;

  const client = stripe();

  // One Stripe customer per association, made on first use and kept.
  let customerId = row.billing_customer_id;
  if (!customerId) {
    const customer = await client.customers.create({
      name: row.name,
      email: auth.user.email ?? undefined,
      metadata: { association_id: associationId },
    });
    customerId = customer.id;
    await admin
      .from("associations")
      .update({ billing_customer_id: customerId, billing_email: auth.user.email ?? null })
      .eq("id", associationId);
  }

  const origin = request.nextUrl.origin;
  const trialEnd = checkoutTrialEnd(row.trial_ends_at.slice(0, 10), new Date());

  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [subscriptionLine(homes)],
    payment_method_collection: "always",
    subscription_data: {
      metadata: { association_id: associationId },
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    },
    success_url: `${origin}/board/settings?billing=added`,
    cancel_url: `${origin}/board/settings?billing=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
