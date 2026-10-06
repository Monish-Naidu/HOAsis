import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fake-supabase";

/**
 * A board that stopped paying is passed over by the daily jobs (0105). The
 * routes run against a fake admin client whose tables answer from a map; a
 * cancelled association is locked on any date, so the test needs no clock.
 */

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/cron-runs", () => ({ recordCronRun: vi.fn() }));

const fake = createFakeSupabase({ rpc: { data: 0, error: null } });
/** Answers each table with the rows a test names, the way the old map did. */
function tables(rows: Record<string, unknown>) {
  for (const [table, data] of Object.entries(rows)) fake.on(table, { data, error: null });
}
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));

const rpcCalls = () => fake.calls.filter((call) => call.target.startsWith("rpc:"));
const inserted = (table: string) => fake.callsTo(table).some((call) => call.has("insert"));

const billing = (status: string) => ({
  subscription_status: status,
  past_due_since: null,
  trial_ends_at: "2026-01-01T00:00:00+00:00",
  billing_subscription_id: "sub_1",
});
const request = (path: string) => {
  const url = new URL(`http://localhost${path}`);
  return { headers: new Headers({ authorization: "Bearer secret" }), nextUrl: url, url: url.toString() } as never;
};

beforeEach(() => {
  process.env.CRON_SECRET = "secret";
  fake.reset();
});

describe("assessments run", () => {
  const association = (status: string) => ({
    id: "a1", name: "Cedar HOA", dues_cents: 10000, dues_cadence: "monthly", due_day: 1,
    fiscal_year_start: "01-01", created_at: "2025-01-01T00:00:00Z", billing_starts_on: null, ...billing(status),
  });

  it("bills nothing and adds no late fees for a cancelled association, and says why", async () => {
    tables({ associations: [association("canceled")] });
    const { GET } = await import("@/app/api/assessments/run/route");
    const body = await (await GET(request("/api/assessments/run"))).json();
    expect(rpcCalls()).toHaveLength(0);
    expect(body.quiet).toEqual(["Cedar HOA: skipped, the association's subscription is not paid"]);
  });

  it("still runs late fees for a paid association", async () => {
    tables({ associations: [association("active")] });
    const { GET } = await import("@/app/api/assessments/run/route");
    await GET(request("/api/assessments/run"));
    expect(fake.callsTo("rpc:assess_late_fees")[0].args).toEqual(["assess_late_fees", expect.anything()]);
  });
});

describe("bill emails", () => {
  it("sends nothing for a cancelled association, and says why", async () => {
    tables({
      associations: [{ id: "a1", name: "Cedar HOA", bills_by_email: true, ...billing("canceled") }],
      charges: [],
    });
    const { GET } = await import("@/app/api/email/bills/route");
    const body = await (await GET(request("/api/email/bills"))).json();
    expect(body.mailed).toEqual([]);
    expect(body.quiet).toEqual(["Cedar HOA: skipped, the association's subscription is not paid"]);
  });
});

describe("autopay run", () => {
  const member = { id: "m1", unit_id: "u1", association_id: "a1", profile_id: "p1", full_name: "Rae", invited_email: null, autopay: { day: 1, rail: "card" } };
  const association = (status: string) => ({
    id: "a1", name: "Cedar HOA", slug: "cedar", stripe_account_id: "acct_1", stripe_charges_enabled: true,
    dues_cents: 10000, dues_by_type: {}, deleted_at: null, ...billing(status),
  });

  it("charges nobody whose board is locked, and says why", async () => {
    tables({ memberships: [member], associations: [association("canceled")], units: [{ label: "2" }], charges: [], autopay_runs: null, payments: [] });
    const { GET } = await import("@/app/api/autopay/run/route");
    const body = await (await GET(request("/api/autopay/run"))).json();
    expect(body.charged).toEqual([]);
    expect(body.waiting).toEqual([expect.stringContaining("the association's subscription is not paid")]);
    expect(inserted("autopay_runs")).toBe(false);
  });
});
