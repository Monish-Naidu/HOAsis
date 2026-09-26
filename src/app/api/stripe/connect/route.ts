import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { registerPayDomains, syncAccountStatus } from "@/lib/stripe/account-status";
import { accountPrefill } from "@/lib/stripe/onboarding";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { logger } from "@/lib/log";

/**
 * Connect onboarding for an association.
 *
 * POST creates the connected account on first call and returns a hosted
 * onboarding link either way; GET reports where onboarding stands. The
 * account is Accounts v2 (Stripe refuses v1 for new platforms since 2026)
 * with a merchant configuration and the "Stripe handles pricing" shape:
 * Stripe collects its own processing fees from the HOA, carries payment
 * losses, collects the onboarding requirements, and gives the treasurer the
 * full dashboard, which leaves the platform with no monthly per-account fee
 * and near-zero loss exposure. Dues settle to the association's own bank
 * account, never to us. The id is still acct_…, so every v1 call made on its
 * behalf (PaymentIntents, SetupIntents, Customers) is unchanged.
 *
 * The account is created with everything the association row already
 * knows (src/lib/stripe/onboarding.ts), so Stripe's form asks the treasurer
 * only for the EIN, the street address, a bank account, the representative
 * and the terms. The requirements that remain come back from GET as plain
 * sentences (`needs`), which is what the Settings row reads out.
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
    return NextResponse.json({
      accountId: null,
      chargesEnabled: false,
      detailsSubmitted: false,
      needs: [],
      payout: null,
    });
  }

  // Read live and written down, so the resident pay screen and this row
  // never disagree about whether money can move.
  const status = await syncAccountStatus(associationId!, row.stripe_account_id);
  return NextResponse.json(status);
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
  const log = logger("stripe/connect", request, { associationId });

  const { data: row } = await auth.supabase
    .from("associations")
    .select("name, ein, city, state, phone, slug, stripe_account_id")
    .eq("id", associationId!)
    .single();
  if (!row) {
    return NextResponse.json({ error: "No such association" }, { status: 404 });
  }

  const origin = request.nextUrl.origin;
  let accountId = row.stripe_account_id;
  if (!accountId) {
    // Stripe checks the business URL, so a localhost origin would fail it;
    // the public site is the address of record whichever host created it.
    const site =
      origin.includes("localhost") || origin.includes("127.0.0.1")
        ? `https://${process.env.NEXT_PUBLIC_SITE_HOST ?? "yourhoasis.com"}`
        : origin;
    const { data: me } = await auth.supabase.auth.getUser();
    const account = await stripe().v2.core.accounts.create({
      ...accountPrefill(row, site),
      contact_email: me.user?.email ?? undefined,
      dashboard: "full",
      metadata: { association_id: associationId! },
    });
    accountId = account.id;
    log.info("connected account created", { accountId });
    // The service role writes the id: the column is plumbing the browser has
    // no reason to be able to set, so no RLS policy allows it.
    const { error } = await supabaseAdmin()
      .from("associations")
      .update({ stripe_account_id: accountId })
      .eq("id", associationId!);
    if (error) {
      log.error("could not save the connected account", { err: error.message, accountId });
      return NextResponse.json({ error: "Could not save the account" }, { status: 500 });
    }
    const domains = await registerPayDomains(accountId, request.nextUrl.hostname);
    for (const d of domains) {
      log.info("pay domain", { accountId, host: d.host, applePay: d.applePay, googlePay: d.googlePay, reason: d.reason });
    }
  }

  const link = await stripe().v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant"],
        return_url: `${origin}/board/settings?stripe=return`,
        refresh_url: `${origin}/board/settings?stripe=refresh`,
      },
    },
  });
  return NextResponse.json({ url: link.url });
}
