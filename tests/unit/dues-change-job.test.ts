import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fake-supabase";

/**
 * The daily dues run is the only hand that applies a scheduled rate change
 * (apply_dues_change, 0117). These checks run the route against a fake admin
 * client: the rows it walks name a change whose day has come or has not, and
 * the calls it makes say whether the change was applied.
 */

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/cron-runs", () => ({ recordCronRun: vi.fn() }));

const fake = createFakeSupabase({ rpc: { data: 0, error: null } });
/** Answers each table with the rows a test names. */
function tables(rows: Record<string, unknown>) {
  for (const [table, data] of Object.entries(rows)) fake.on(table, { data, error: null });
}
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));

const billing = (status: string) => ({
  subscription_status: status,
  past_due_since: null,
  trial_ends_at: "2026-01-01T00:00:00+00:00",
  billing_subscription_id: "sub_1",
});
const request = (path: string) => {
  const url = new URL(`http://localhost${path}`);
  return {
    headers: new Headers({ authorization: "Bearer secret" }),
    nextUrl: url,
    url: url.toString(),
  } as never;
};
/** The route reads the clock; these match it, a day at a time. */
const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

beforeEach(() => {
  process.env.CRON_SECRET = "secret";
  fake.reset();
});

describe("the dues run applies a scheduled change", () => {
  // No dues rate and nothing due, so nothing is billed and the change is the
  // one thing the run does with this association.
  const association = (change_on: string | null) => ({
    id: "a1",
    name: "Cedar HOA",
    dues_cents: 0,
    dues_cadence: "monthly",
    due_day: 1,
    fiscal_year_start: "01-01",
    created_at: "2025-01-01T00:00:00Z",
    billing_starts_on: null,
    dues_change_on: change_on,
    ...billing("active"),
  });

  it("applies a change on its day, after billing", async () => {
    tables({ associations: [association(day(0))] });
    fake.on("rpc:apply_dues_change", { data: true, error: null });
    const { GET } = await import("@/app/api/assessments/run/route");
    const body = await (await GET(request("/api/assessments/run"))).json();
    expect(fake.callsTo("rpc:apply_dues_change")).toHaveLength(1);
    expect(body.applied).toEqual(["Cedar HOA: new dues rate applied"]);
  });

  it("applies a change the run missed, the day after or later", async () => {
    tables({ associations: [association(day(-3))] });
    fake.on("rpc:apply_dues_change", { data: true, error: null });
    const { GET } = await import("@/app/api/assessments/run/route");
    const body = await (await GET(request("/api/assessments/run"))).json();
    expect(body.applied).toEqual(["Cedar HOA: new dues rate applied"]);
  });

  it("leaves a change alone whose day has not come", async () => {
    tables({ associations: [association(day(1))] });
    const { GET } = await import("@/app/api/assessments/run/route");
    const body = await (await GET(request("/api/assessments/run"))).json();
    expect(fake.callsTo("rpc:apply_dues_change")).toHaveLength(0);
    expect(body.applied).toEqual([]);
  });

  it("says what a dry run would apply, and applies nothing", async () => {
    tables({ associations: [association(day(0))] });
    const { GET } = await import("@/app/api/assessments/run/route");
    const body = await (await GET(request("/api/assessments/run?dry=1"))).json();
    expect(body.applied).toEqual(["Cedar HOA: would apply the new dues rate"]);
    expect(fake.callsTo("rpc:apply_dues_change")).toHaveLength(0);
  });

  it("does not touch a locked board's change", async () => {
    tables({ associations: [association(day(0))] });
    fake.on("associations", {
      data: [{ ...association(day(0)), subscription_status: "canceled" }],
      error: null,
    });
    const { GET } = await import("@/app/api/assessments/run/route");
    const body = await (await GET(request("/api/assessments/run"))).json();
    expect(fake.callsTo("rpc:apply_dues_change")).toHaveLength(0);
    expect(body.quiet[0]).toContain("skipped");
  });

  it("says an apply failure without stopping the run", async () => {
    tables({ associations: [association(day(0))] });
    fake.on("rpc:apply_dues_change", { data: null, error: { message: "row is locked" } });
    const { GET } = await import("@/app/api/assessments/run/route");
    const body = await (await GET(request("/api/assessments/run"))).json();
    expect(body.errors).toEqual(["Cedar HOA: dues change: row is locked"]);
  });

  it("applies nothing when no change is waiting", async () => {
    tables({ associations: [association(null)] });
    const { GET } = await import("@/app/api/assessments/run/route");
    const body = await (await GET(request("/api/assessments/run"))).json();
    expect(fake.callsTo("rpc:apply_dues_change")).toHaveLength(0);
    expect(body.applied).toEqual([]);
  });
});
