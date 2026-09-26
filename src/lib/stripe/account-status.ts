import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { plainNeeds } from "@/lib/stripe/requirements";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * What Stripe says about an association's connected account, written down.
 *
 * Three facts, all Stripe's: whether it can take a payment at all, whether
 * the treasurer still has forms to fill, and which bank the dues are paid
 * out to. They are cached on the associations row so the resident pay
 * screen can read them like any other column, and refreshed from here
 * whenever the board opens Settings, a resident opens Pay with a stale
 * "not yet", or Stripe sends account.updated.
 *
 * The payout bank also fills the operating row in bank_accounts when the
 * board never typed one: the ledger's "where dues land" and Stripe's are
 * then the same account by construction.
 */
export interface AccountStatus {
  accountId: string;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  /**
   * What the treasurer still owes Stripe, as plain sentences from
   * src/lib/stripe/requirements.ts. Empty once every form is in, which with
   * chargesEnabled false means Stripe is verifying.
   */
  needs: string[];
  payout: { bank: string; last4: string } | null;
}

export async function syncAccountStatus(
  associationId: string,
  accountId: string,
): Promise<AccountStatus> {
  const account = await stripe().v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "requirements"],
  });
  const capabilities = account.configuration?.merchant?.capabilities;
  // Live means a resident can pay by at least one rail. Both are requested;
  // ACH is the one that matters for dues, cards usually clear first.
  const chargesEnabled =
    capabilities?.card_payments?.status === "active" ||
    capabilities?.ach_debit_payments?.status === "active";
  // Nothing left for the treasurer to type. Stripe may still be verifying.
  const entries = account.requirements?.entries ?? [];
  const detailsSubmitted = !entries.some((entry) => entry.awaiting_action_from === "user");
  const needs = plainNeeds(entries);

  let payout: AccountStatus["payout"] = null;
  try {
    const external = await stripe().accounts.listExternalAccounts(accountId, {
      object: "bank_account",
      limit: 10,
    });
    const banks = external.data.filter(
      (b): b is Stripe.BankAccount => b.object === "bank_account",
    );
    const chosen = banks.find((b) => b.default_for_currency) ?? banks[0];
    if (chosen) {
      payout = { bank: chosen.bank_name ?? "Bank", last4: chosen.last4 };
    }
  } catch {
    // An account mid-onboarding has no external account yet; not an error.
  }

  const admin = supabaseAdmin();
  await admin
    .from("associations")
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payout_bank: payout?.bank ?? null,
      stripe_payout_last4: payout?.last4 ?? null,
    })
    .eq("id", associationId);

  if (payout) {
    const { data: operating } = await admin
      .from("bank_accounts")
      .select("id, institution, mask")
      .eq("association_id", associationId)
      .eq("kind", "operating")
      .limit(1)
      .maybeSingle();
    if (!operating) {
      await admin.from("bank_accounts").insert({
        association_id: associationId,
        kind: "operating",
        institution: payout.bank,
        mask: payout.last4,
      });
    }
  }

  return { accountId, chargesEnabled, detailsSubmitted, needs, payout };
}

/** What Stripe says about one domain on one account, wallet by wallet. */
export interface PayDomainStatus {
  host: string;
  applePay: "active" | "inactive";
  googlePay: "active" | "inactive";
  /** Stripe's own reason when a wallet is inactive, e.g. the association file was not found. */
  reason: string | null;
}

/**
 * Hosts a wallet may be shown on: the request's own host, the production
 * domain, and NEXT_PUBLIC_SITE_HOST when it names another. localhost and
 * preview deploys are skipped: Stripe cannot fetch the association file
 * there, and the card form works without a wallet.
 */
export function payDomains(requestHost?: string | null): string[] {
  const hosts = new Set<string>();
  for (const h of [requestHost, process.env.NEXT_PUBLIC_SITE_HOST, "yourhoasis.com"]) {
    const host = (h ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
    if (!host || host.includes("localhost") || host.endsWith(".vercel.app") || host === "127.0.0.1") continue;
    hosts.add(host);
  }
  return [...hosts];
}

/**
 * Apple Pay and Google Pay need the domain registered on the account that
 * charges, which for direct charges is the association's. Stripe validates
 * against the file at /.well-known/apple-developer-merchantid-domain-association,
 * which this app serves from public/, so Apple Pay only goes active once
 * that path is live on the domain. Idempotent: creating a domain that is
 * already registered returns it, and validate() asks Stripe to look again.
 * Best effort for the caller; the card form works without a wallet.
 */
export async function registerPayDomain(
  accountId: string | null,
  host: string,
): Promise<PayDomainStatus> {
  const options = accountId ? { stripeAccount: accountId } : undefined;
  try {
    let domain = await stripe().paymentMethodDomains.create({ domain_name: host }, options);
    if (domain.apple_pay?.status !== "active" || domain.google_pay?.status !== "active") {
      domain = await stripe().paymentMethodDomains.validate(domain.id, {}, options);
    }
    const reason =
      domain.apple_pay?.status_details?.error_message ??
      domain.google_pay?.status_details?.error_message ??
      null;
    return {
      host,
      applePay: domain.apple_pay?.status === "active" ? "active" : "inactive",
      googlePay: domain.google_pay?.status === "active" ? "active" : "inactive",
      reason,
    };
  } catch (error) {
    return {
      host,
      applePay: "inactive",
      googlePay: "inactive",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Every host on one account. A skipped host (localhost, preview) returns nothing. */
export async function registerPayDomains(
  accountId: string | null,
  requestHost?: string | null,
): Promise<PayDomainStatus[]> {
  const results: PayDomainStatus[] = [];
  for (const host of payDomains(requestHost)) {
    results.push(await registerPayDomain(accountId, host));
  }
  return results;
}
