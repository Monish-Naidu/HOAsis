import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { savedByCurrentMember } from "@/lib/stripe/saved-method-owner";

/**
 * A saved bank or card is shared by the home, but only among the people who
 * hold the home today. After a sale the seller's method is still on the
 * home's list, and nobody may charge it. No Stripe network and no database;
 * the tables answer what each test says.
 */

describe("whose saved method it is", () => {
  it("is good while the person who saved it holds the home", () => {
    expect(savedByCurrentMember("seller", ["seller"])).toBe(true);
  });

  it("is still good for a co-owner, who shares the home's methods", () => {
    expect(savedByCurrentMember("partner", ["owner", "partner"])).toBe(true);
  });

  it("is nobody's once the person who saved it has left", () => {
    // The sale: the seller's seat ended and the buyer's began.
    expect(savedByCurrentMember("seller", ["buyer"])).toBe(false);
    expect(savedByCurrentMember("seller", [])).toBe(false);
  });

  it("is nobody's when the saver's account is gone, or there never was one", () => {
    expect(savedByCurrentMember(null, ["buyer"])).toBe(false);
    expect(savedByCurrentMember(undefined, ["buyer", null])).toBe(false);
  });
});

process.env.STRIPE_SECRET_KEY = "sk_test_unit";

const rows: Record<string, unknown> = {};
/** Who holds the home today, as the service role would read it. */
let holders: { data: { profile_id: string | null }[] | null; error: { message: string } | null };

/** A query on one table: every filter chains, and the end answers the row. */
function query(table: string) {
  const chain: Record<string, unknown> = {};
  for (const step of ["select", "eq", "is", "order"]) chain[step] = () => chain;
  chain.single = async () => ({ data: rows[table] ?? null });
  chain.maybeSingle = async () => ({ data: rows[table] ?? null });
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "buyer", email: "buyer@example.com" } } }) },
    rpc: async () => ({ data: false }),
    from: (table: string) => query(table),
  }),
  // Only the membership list is read with the service role here.
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ is: async () => holders }) }) }),
  }),
}));

const payment = await import("@/app/api/stripe/payment-intent/route");
const { stripe } = await import("@/lib/stripe/server");

function pay(body: object) {
  return new NextRequest("http://localhost/api/stripe/payment-intent", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("paying with a saved method", () => {
  const body = { associationId: "assoc-a", unitId: "unit-7", amountCents: 32500, instrumentId: "inst-1" };

  beforeEach(() => {
    vi.restoreAllMocks();
    rows.memberships = { id: "m-buyer" };
    rows.associations = { stripe_account_id: "acct_a", dues_cents: 32500 };
    rows.units = { association_id: "assoc-a", stripe_customer_id: "cus_7" };
    rows.payment_instruments = {
      unit_id: "unit-7",
      profile_id: "seller",
      kind: "ach",
      detail: { token: "pm_seller_bank" },
    };
    holders = { data: [{ profile_id: "buyer" }], error: null };
  });

  it("refuses the seller's bank once the home has changed hands, before Stripe is asked", async () => {
    const create = vi.spyOn(stripe().paymentIntents, "create");
    const response = await payment.POST(pay(body));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/no longer at this home/);
    expect(create).not.toHaveBeenCalled();
  });

  it("charges a method saved by somebody who still holds the home", async () => {
    holders = { data: [{ profile_id: "buyer" }, { profile_id: "seller" }], error: null };
    const create = vi
      .spyOn(stripe().paymentIntents, "create")
      .mockResolvedValue({ id: "pi_1", client_secret: "secret" } as never);
    const response = await payment.POST(pay(body));
    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_7", payment_method: "pm_seller_bank" }),
      { stripeAccount: "acct_a" },
    );
  });

  it("does not charge, or call the method a stranger's, when the members cannot be read", async () => {
    holders = { data: null, error: { message: "fetch failed" } };
    const create = vi.spyOn(stripe().paymentIntents, "create");
    const response = await payment.POST(pay(body));
    expect(response.status).toBe(500);
    expect(create).not.toHaveBeenCalled();
  });
});
