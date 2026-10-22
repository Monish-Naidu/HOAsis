import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fake-supabase";
import type { BillingOperation } from "@/lib/stripe/billing-operation";

/**
 * The checkout route's contract, with a fake database and a fake Stripe:
 * one durable operation per association, frozen parameters and idempotency
 * keys, reconciliation before replacement, active-home quantity, and the
 * sign-in, capability and tenant rules.
 */

const ASSOC = "assoc-1";

process.env.STRIPE_SECRET_KEY = "sk_test_unit";

/** The fake Stripe account: every object the route makes, and how. */
const stripeFake = {
  customers: { search: vi.fn(), create: vi.fn() },
  checkout: {
    sessions: { retrieve: vi.fn(), list: vi.fn(), create: vi.fn(), expire: vi.fn() },
  },
};

vi.mock("@/lib/stripe/server", () => ({ stripe: () => stripeFake }));

const adminFake = createFakeSupabase();
const userFake = createFakeSupabase();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => adminFake.client,
  supabaseServer: async () => userFake.client,
}));

const { POST } = await import("@/app/api/billing/checkout/route");

/** A request as Next hands it over: nextUrl has already folded 127.0.0.1 to localhost. */
function request(host = "localhost:3100") {
  const url = new URL(`http://localhost:3100/api/billing/checkout`);
  return {
    nextUrl: url,
    url: url.toString(),
    headers: new Headers({ host }),
    json: async () => ({ associationId: ASSOC }),
  } as never;
}

/** The durable row, played by hand: claim filters are actually checked. */
interface OpState {
  op: BillingOperation | null;
}

function opFrom(params: Record<string, unknown>): BillingOperation {
  return {
    id: "op-1",
    association_id: ASSOC,
    status: "open",
    mode: params.p_mode as BillingOperation["mode"],
    quantity: params.p_quantity as number,
    trial_end_ts: params.p_trial_end_ts as number | null,
    customer_name: params.p_customer_name as string,
    customer_email: params.p_customer_email as string | null,
    return_origin: params.p_return_origin as string,
    customer_id: null,
    customer_key: "bill-cus-op-1",
    session_id: null,
    session_key: "bill-sess-op-1",
    subscription_id: null,
    subscription_key: "bill-sub-op-1",
    created_at: "2026-10-22T00:00:00Z",
  };
}

/** Whether a conditional update's filters still hold against the row. */
function filtersHold(state: OpState, chain: [string, ...unknown[]][]): boolean {
  const op = state.op!;
  for (const step of chain) {
    if (step[0] === "eq" && step[1] === "status" && op.status !== step[2]) return false;
    if (step[0] === "is" && step[1] === "customer_id" && op.customer_id !== null) return false;
    if (step[0] === "is" && step[1] === "session_id" && op.session_id !== null) return false;
    if (step[0] === "eq" && step[1] === "session_id" && op.session_id !== step[2]) return false;
  }
  return true;
}

let state: OpState;

function setupAdmin({
  homes = 3,
  association = {},
}: {
  homes?: number;
  association?: Record<string, unknown>;
} = {}) {
  adminFake.on("auth.getUser", { data: { user: null } });
  adminFake.on("associations.select", {
    data: {
      id: ASSOC,
      name: "Test HOA",
      trial_ends_at: trialDate(90),
      billing_customer_id: null,
      billing_subscription_id: null,
      ...association,
    },
  });
  adminFake.on("units.select", { data: null, count: homes });
  adminFake.on("rpc:begin_billing_operation", (call) => {
    const params = call.args[1] as Record<string, unknown>;
    if (!state.op) state.op = opFrom(params);
    return { data: state.op };
  });
  adminFake.on("billing_operations.select", () => ({ data: state.op }));
  adminFake.on("billing_operations.update", (call) => {
    if (!filtersHold(state, call.chain)) return { data: [] };
    Object.assign(state.op!, call.argsOf("update")![0] as Record<string, unknown>);
    return { data: [state.op] };
  });
}

function trialDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

function signIn(capable = true) {
  userFake.on("auth.getUser", { data: { user: { id: "u-1", email: "president@example.com" } } });
  userFake.on("rpc:has_capability", { data: capable });
}

function stripeHappy() {
  stripeFake.customers.search.mockResolvedValue({ data: [] });
  stripeFake.customers.create.mockResolvedValue({ id: "cus_1" });
  stripeFake.checkout.sessions.list.mockResolvedValue({ data: [] });
  stripeFake.checkout.sessions.retrieve.mockResolvedValue({
    id: "cs_1",
    status: "open",
    url: "https://checkout.stripe.com/c/pay/cs_1",
  });
  stripeFake.checkout.sessions.create.mockResolvedValue({
    id: "cs_1",
    url: "https://checkout.stripe.com/c/pay/cs_1",
  });
  stripeFake.checkout.sessions.expire.mockResolvedValue({});
}

beforeEach(() => {
  state = { op: null };
  adminFake.reset();
  userFake.reset();
  vi.clearAllMocks();
  stripeHappy();
});

describe("authorization", () => {
  it("answers 401 to a signed-out caller and touches nothing", async () => {
    userFake.on("auth.getUser", { data: { user: null } });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(adminFake.calls).toHaveLength(0);
  });

  it("answers 403 without the settings capability and reserves nothing", async () => {
    signIn(false);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(adminFake.callsTo("rpc:begin_billing_operation")).toHaveLength(0);
    expect(stripeFake.customers.create).not.toHaveBeenCalled();
  });

  it("cannot bill another tenant: the capability answers for the caller, not the id", async () => {
    // A resident of association B naming association A gets B's answer: no.
    signIn(false);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(userFake.callsTo("rpc:has_capability")[0].args[1]).toMatchObject({
      target: ASSOC,
      needed: "settings",
    });
  });

  it("answers 404 for an unknown association and 409 when a card is on file", async () => {
    signIn();
    setupAdmin();
    adminFake.on("associations.select", { data: null, error: { message: "0 rows" } });
    expect((await POST(request())).status).toBe(404);

    setupAdmin({ association: { billing_subscription_id: "sub_existing" } });
    expect((await POST(request())).status).toBe(409);
    expect(stripeFake.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("leaves the connected account alone: platform billing is a separate identity", async () => {
    signIn();
    setupAdmin({ association: { stripe_account_id: "acct_connect" } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    // The customer is created on the platform with no account reference.
    expect(stripeFake.customers.create.mock.calls[0][0]).not.toHaveProperty("stripe_account");
    const associationWrites = adminFake.writes().filter((c) => c.target === "associations");
    for (const write of associationWrites) {
      expect(write.argsOf("update")![0]).not.toHaveProperty("stripe_account_id");
    }
  });
});

describe("active-home quantity", () => {
  it("counts only homes on the register: retired ones are excluded", async () => {
    signIn();
    setupAdmin({ homes: 3 });
    const response = await POST(request());
    expect(response.status).toBe(200);
    const countCall = adminFake.callsTo("units")[0];
    expect(countCall.chain).toContainEqual(["is", "retired_on", null]);
    expect(stripeFake.checkout.sessions.create.mock.calls[0][0].line_items[0].quantity).toBe(3);
  });

  it("treats a failed count as an error, never as zero homes", async () => {
    signIn();
    setupAdmin();
    adminFake.on("units.select", { data: null, count: null });
    expect((await POST(request())).status).toBe(500);
    expect(stripeFake.checkout.sessions.create).not.toHaveBeenCalled();
  });
});

describe("one durable operation", () => {
  it("reserves the operation with the plan frozen, then creates with its keys", async () => {
    signIn();
    setupAdmin();
    const response = await POST(request());
    expect(response.status).toBe(200);

    const reserve = adminFake.callsTo("rpc:begin_billing_operation")[0].args[1] as Record<
      string,
      unknown
    >;
    expect(reserve).toMatchObject({
      p_association_id: ASSOC,
      p_mode: "subscription",
      p_quantity: 3,
    });
    expect(typeof reserve.p_trial_end_ts).toBe("number");

    expect(stripeFake.customers.create).toHaveBeenCalledTimes(1);
    expect(stripeFake.customers.create.mock.calls[0][0]).toMatchObject({
      name: "Test HOA",
      email: "president@example.com",
      metadata: { association_id: ASSOC },
    });
    expect(stripeFake.customers.create.mock.calls[0][1]).toEqual({
      idempotencyKey: "bill-cus-op-1",
    });

    expect(stripeFake.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const [params, options] = stripeFake.checkout.sessions.create.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: "bill-sess-op-1" });
    expect(params).toMatchObject({
      mode: "subscription",
      customer: "cus_1",
      client_reference_id: "op-1",
    });
    expect(params.subscription_data.trial_end).toBe(reserve.p_trial_end_ts);
    const body = await response.json();
    expect(body.url).toBe("https://checkout.stripe.com/c/pay/cs_1");
    expect(state.op?.session_id).toBe("cs_1");
  });

  it("converges two officers on the same operation, customer and session", async () => {
    signIn();
    setupAdmin();
    const [first, second] = await Promise.all([POST(request()), POST(request())]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // One reservation row answers both; every provider create carries the
    // operation's one key, so Stripe made one customer and one session.
    expect(adminFake.callsTo("rpc:begin_billing_operation")).toHaveLength(2);
    const customerKeys = stripeFake.customers.create.mock.calls.map((c) => c[1].idempotencyKey);
    expect(new Set(customerKeys)).toEqual(new Set(["bill-cus-op-1"]));
    const customerParams = stripeFake.customers.create.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(new Set(customerParams).size).toBeLessThanOrEqual(1);
    const keys = stripeFake.checkout.sessions.create.mock.calls.map((c) => c[1].idempotencyKey);
    expect(new Set(keys)).toEqual(new Set(["bill-sess-op-1"]));
    // An idempotent replay is the same session: nobody expired the winner.
    expect(stripeFake.checkout.sessions.expire).not.toHaveBeenCalled();
    expect(state.op?.customer_id).toBe("cus_1");
    expect(state.op?.session_id).toBe("cs_1");
  });

  it("a repeated click reuses the open session instead of opening another", async () => {
    signIn();
    setupAdmin();
    await POST(request());
    stripeFake.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_1",
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_1",
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(stripeFake.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect((await response.json()).url).toBe("https://checkout.stripe.com/c/pay/cs_1");
  });

  it("keeps frozen parameters after a restart: the row, not the caller, decides", async () => {
    signIn();
    setupAdmin();
    await POST(request());
    // The roster has doubled and a different officer retries; the operation's
    // frozen quantity, origin and keys still answer (the sweep moves the
    // quantity later, deliberately).
    setupAdmin({ homes: 6 });
    state.op!.customer_email = "president@example.com";
    stripeFake.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_1",
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_1",
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(stripeFake.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(adminFake.callsTo("rpc:begin_billing_operation")).toHaveLength(2);
  });
});

describe("uncertain provider answers", () => {
  it("retries a lost customer create with the same key and identical parameters", async () => {
    signIn();
    setupAdmin();
    stripeFake.customers.create.mockRejectedValueOnce(new Error("socket hangup"));
    expect((await POST(request())).status).toBe(500);
    expect(state.op?.customer_id).toBeNull();

    const response = await POST(request());
    expect(response.status).toBe(200);
    const calls = stripeFake.customers.create.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toEqual(calls[1][0]);
    expect(calls[0][1]).toEqual(calls[1][1]);
  });

  it("adopts a customer an uncertain earlier attempt left behind", async () => {
    signIn();
    setupAdmin();
    stripeFake.customers.search.mockResolvedValue({ data: [{ id: "cus_orphan" }] });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(stripeFake.customers.create).not.toHaveBeenCalled();
    expect(stripeFake.checkout.sessions.create.mock.calls[0][0].customer).toBe("cus_orphan");
    expect(stripeFake.customers.search.mock.calls[0][0].query).toContain(ASSOC);
  });

  it("adopts an open session an uncertain earlier attempt left behind", async () => {
    signIn();
    setupAdmin();
    stripeFake.checkout.sessions.list.mockResolvedValue({
      data: [
        {
          id: "cs_orphan",
          client_reference_id: "op-1",
          url: "https://checkout.stripe.com/c/pay/cs_orphan",
        },
      ],
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(stripeFake.checkout.sessions.create).not.toHaveBeenCalled();
    expect((await response.json()).url).toContain("cs_orphan");
  });

  it("a completed earlier attempt closes the operation instead of billing twice", async () => {
    signIn();
    setupAdmin();
    stripeFake.checkout.sessions.list.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
      data: [{ id: "cs_done", client_reference_id: "op-1", subscription: "sub_1" }],
    });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(stripeFake.checkout.sessions.create).not.toHaveBeenCalled();
    expect(state.op).toMatchObject({ status: "completed", subscription_id: "sub_1" });
  });
});

describe("replacement after expiry", () => {
  it("replaces an expired session with a new durable key, stored before the call", async () => {
    signIn();
    setupAdmin();
    state.op = {
      ...opFrom({
        p_mode: "subscription",
        p_quantity: 3,
        p_trial_end_ts: 1_900_000_000,
        p_customer_name: "Test HOA",
        p_customer_email: "president@example.com",
        p_return_origin: "http://localhost:3100",
      }),
      customer_id: "cus_1",
      session_id: "cs_old",
    };
    stripeFake.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_old", status: "expired" });
    stripeFake.checkout.sessions.create.mockResolvedValue({
      id: "cs_new",
      url: "https://checkout.stripe.com/c/pay/cs_new",
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).url).toContain("cs_new");
    // The replacement key names the operation and was on the row first.
    const options = stripeFake.checkout.sessions.create.mock.calls[0][1];
    expect(options.idempotencyKey).toMatch(/^bill-sess-op-1-r/);
    expect(state.op?.session_key).toBe(options.idempotencyKey);
    expect(state.op?.session_id).toBe("cs_new");
  });

  it("a losing replacer takes the winner's session and creates nothing", async () => {
    signIn();
    setupAdmin();
    state.op = {
      ...opFrom({
        p_mode: "subscription",
        p_quantity: 3,
        p_trial_end_ts: 1_900_000_000,
        p_customer_name: "Test HOA",
        p_customer_email: "p@example.com",
        p_return_origin: "http://localhost:3100",
      }),
      customer_id: "cus_1",
      session_id: "cs_old",
    };
    // The race is lost: by the time the conditional update runs, a winner has
    // already replaced the session.
    let raced = false;
    adminFake.on("billing_operations.update", (call) => {
      if (!raced && call.chain.some((s) => s[0] === "eq" && s[1] === "session_id")) {
        raced = true;
        state.op = { ...state.op!, session_id: "cs_winner", session_key: "bill-sess-op-1-rW" };
        return { data: [] };
      }
      if (!filtersHold(state, call.chain)) return { data: [] };
      Object.assign(state.op!, call.argsOf("update")![0] as Record<string, unknown>);
      return { data: [state.op] };
    });
    stripeFake.checkout.sessions.retrieve.mockImplementation(async (id: string) =>
      id === "cs_old"
        ? { id, status: "expired" }
        : { id, status: "open", url: "https://checkout.stripe.com/c/pay/cs_winner" },
    );

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).url).toContain("cs_winner");
    expect(stripeFake.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("expires its own duplicate session when the claim is lost", async () => {
    signIn();
    setupAdmin();
    // The claim fails after the create: the racer's session won the row.
    let lost = false;
    adminFake.on("billing_operations.update", (call) => {
      const values = call.argsOf("update")![0] as Record<string, unknown>;
      if (!lost && values.session_id === "cs_1") {
        lost = true;
        state.op = { ...state.op!, session_id: "cs_winner" };
        return { data: [] };
      }
      if (!filtersHold(state, call.chain)) return { data: [] };
      Object.assign(state.op!, call.argsOf("update")![0] as Record<string, unknown>);
      return { data: [state.op] };
    });
    stripeFake.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_winner",
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_winner",
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(stripeFake.checkout.sessions.expire).toHaveBeenCalledWith("cs_1");
    expect((await response.json()).url).toContain("cs_winner");
  });

  it("a completed stored session closes the operation, no new checkout", async () => {
    signIn();
    setupAdmin();
    state.op = {
      ...opFrom({
        p_mode: "subscription",
        p_quantity: 3,
        p_trial_end_ts: 1_900_000_000,
        p_customer_name: "Test HOA",
        p_customer_email: "p@example.com",
        p_return_origin: "http://localhost:3100",
      }),
      customer_id: "cus_1",
      session_id: "cs_done",
    };
    stripeFake.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_done",
      status: "complete",
      subscription: "sub_9",
    });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(stripeFake.checkout.sessions.create).not.toHaveBeenCalled();
    expect(state.op).toMatchObject({ status: "completed", subscription_id: "sub_9" });
  });
});

describe("trial boundaries", () => {
  it("takes the setup path with the exact end when under 48 hours remain", async () => {
    signIn();
    setupAdmin({ association: { trial_ends_at: trialDate(1) } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    const reserve = adminFake.callsTo("rpc:begin_billing_operation")[0].args[1] as Record<
      string,
      unknown
    >;
    expect(reserve.p_mode).toBe("setup");
    const end = Math.floor(new Date(`${trialDate(1)}T12:00:00Z`).getTime() / 1000);
    expect(reserve.p_trial_end_ts).toBe(end);
    const params = stripeFake.checkout.sessions.create.mock.calls[0][0];
    expect(params.mode).toBe("setup");
    expect(params.currency).toBe("usd");
    expect(params.line_items).toBeUndefined();
  });

  it("starts at once when the trial has already ended, with no new trial", async () => {
    signIn();
    setupAdmin({ association: { trial_ends_at: trialDate(-3) } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    const reserve = adminFake.callsTo("rpc:begin_billing_operation")[0].args[1] as Record<
      string,
      unknown
    >;
    expect(reserve).toMatchObject({ p_mode: "subscription", p_trial_end_ts: null });
    const params = stripeFake.checkout.sessions.create.mock.calls[0][0];
    expect(params.mode).toBe("subscription");
    expect(params.subscription_data.trial_end).toBeUndefined();
  });
});

describe("return origin", () => {
  it("returns to 127.0.0.1 when that is where the browser's session lives", async () => {
    signIn();
    setupAdmin();
    const response = await POST(request("127.0.0.1:3100"));
    expect(response.status).toBe(200);
    const params = stripeFake.checkout.sessions.create.mock.calls[0][0];
    expect(params.success_url).toBe("http://127.0.0.1:3100/board/settings?billing=added");
    expect(params.cancel_url).toBe("http://127.0.0.1:3100/board/settings?billing=cancelled");
    // And it is frozen on the operation, so a retry from the other loopback
    // name cannot split Stripe's idempotency parameters.
    expect(state.op?.return_origin).toBe("http://127.0.0.1:3100");
  });
});
