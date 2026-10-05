import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * A payment is created on the association's Stripe account and names a home.
 * The two have to agree before Stripe is asked for anything: the webhook
 * will not settle a home from an account that is not its own, so an intent
 * made with a mismatched pair is money taken that never reaches the books.
 * No Stripe network and no database; the tables answer what each test says.
 */

process.env.STRIPE_SECRET_KEY = "sk_test_unit";

const rows: Record<string, unknown> = {};

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
    auth: { getUser: async () => ({ data: { user: { id: "profile-1", email: "gwen@example.com" } } }) },
    rpc: async () => ({ data: false }),
    from: (table: string) => query(table),
  }),
  supabaseAdmin: () => ({ from: (table: string) => query(table) }),
}));

const payment = await import("@/app/api/stripe/payment-intent/route");
const setup = await import("@/app/api/stripe/setup-intent/route");
const { stripe } = await import("@/lib/stripe/server");

function post(path: string, body: object) {
  return new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  rows.memberships = { id: "m-1", full_name: "Gwen Okafor" };
  rows.associations = {
    stripe_account_id: "acct_a",
    dues_cents: 28500,
    payment_fee_cents: 0,
    payment_fee_paid_by: "owner",
    payment_fee_waived_on_ach: false,
  };
  rows.units = { association_id: "assoc-a", stripe_customer_id: "cus_1", label: "12B" };
});

describe("creating a payment intent", () => {
  const body = { associationId: "assoc-a", unitId: "unit-1", amountCents: 28500, rail: "card" };

  it("refuses a home that belongs to a different association, before Stripe is asked", async () => {
    rows.units = { association_id: "assoc-b", stripe_customer_id: "cus_1", label: "12B" };
    const create = vi.spyOn(stripe().paymentIntents, "create");
    const response = await payment.POST(post("/api/stripe/payment-intent", body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "That home is not part of this association" });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a home it cannot see at all", async () => {
    rows.units = null;
    const create = vi.spyOn(stripe().paymentIntents, "create");
    const response = await payment.POST(post("/api/stripe/payment-intent", body));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the intent on the association's account when the pair agrees", async () => {
    const create = vi
      .spyOn(stripe().paymentIntents, "create")
      .mockResolvedValue({ id: "pi_1", client_secret: "secret" } as never);
    const response = await payment.POST(post("/api/stripe/payment-intent", body));
    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ association_id: "assoc-a", unit_id: "unit-1", assessment_cents: "28500" }),
      }),
      { stripeAccount: "acct_a" },
    );
  });
});

describe("the largest amount a home may pay at once", () => {
  const big = { associationId: "assoc-a", unitId: "unit-1", amountCents: 1_000_000, rail: "ach" };

  it("is measured against two years of the home's own dues when they are larger", async () => {
    // $10,000 is over two years of $285 and under two years of $500.
    rows.associations = { ...(rows.associations as object), dues_cents: 28500 };
    rows.units = { association_id: "assoc-a", stripe_customer_id: "cus_1", label: "12B", dues_cents: 50_000 };
    vi.spyOn(stripe().paymentIntents, "create").mockResolvedValue({ id: "pi_1", client_secret: "secret" } as never);
    expect((await payment.POST(post("/api/stripe/payment-intent", big))).status).toBe(200);
  });

  it("is still refused for a home on the association's amount", async () => {
    rows.associations = { ...(rows.associations as object), dues_cents: 28500 };
    rows.units = { association_id: "assoc-a", stripe_customer_id: "cus_1", label: "12B", dues_cents: null };
    const create = vi.spyOn(stripe().paymentIntents, "create");
    create.mockClear();
    const response = await payment.POST(post("/api/stripe/payment-intent", big));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("the receipt for a payment made by hand", () => {
  it("asks Stripe to email the person paying when the money settles", async () => {
    const create = vi
      .spyOn(stripe().paymentIntents, "create")
      .mockResolvedValue({ id: "pi_1", client_secret: "secret" } as never);
    const response = await payment.POST(
      post("/api/stripe/payment-intent", { associationId: "assoc-a", unitId: "unit-1", amountCents: 28500, rail: "ach" }),
    );
    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ receipt_email: "gwen@example.com" }),
      { stripeAccount: "acct_a" },
    );
  });
});

describe("starting to save a payment method", () => {
  const body = { associationId: "assoc-a", unitId: "unit-1" };

  it("refuses a home that belongs to a different association, before Stripe is asked", async () => {
    rows.units = { association_id: "assoc-b", stripe_customer_id: null, label: "12B" };
    const customer = vi.spyOn(stripe().customers, "create");
    const intent = vi.spyOn(stripe().setupIntents, "create");
    const response = await setup.POST(post("/api/stripe/setup-intent", body));
    expect(response.status).toBe(400);
    expect(customer).not.toHaveBeenCalled();
    expect(intent).not.toHaveBeenCalled();
  });

  it("goes ahead when the pair agrees", async () => {
    const intent = vi
      .spyOn(stripe().setupIntents, "create")
      .mockResolvedValue({ id: "seti_1", client_secret: "secret" } as never);
    const response = await setup.POST(post("/api/stripe/setup-intent", body));
    expect(response.status).toBe(200);
    expect(intent).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1", metadata: { association_id: "assoc-a", unit_id: "unit-1" } }),
      { stripeAccount: "acct_a" },
    );
  });
});
