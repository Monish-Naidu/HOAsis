import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeCall } from "../helpers/fake-supabase";
import { setLogSink, type LogLine } from "@/lib/log";
import { EXPECTED_JOBS } from "@/lib/job-health";

/**
 * The digest route records its own run, judges itself on the run before
 * this one, and says so on the log when its row cannot be written. The
 * cron_runs table is a list the fake answers from by job and outcome, the
 * way the per-job queries in loadOpsReport ask it.
 */

vi.mock("@/lib/supabase/env", () => ({ hasSupabase: true }));
vi.mock("@/lib/health", () => ({
  runHealthChecks: async () => ({ ok: true, at: "", checks: {} }),
}));

const fake = createFakeSupabase({ rpc: { data: 0, error: null } });
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));

type Row = {
  job: string;
  started_at: string;
  finished_at: string;
  ok: boolean;
  error: string | null;
  request_id: string | null;
  summary: Record<string, unknown>;
};
let table: Row[] = [];

function select(call: FakeCall) {
  const job = call.argsOf("eq")?.[1];
  const okOnly = call.chain.some((s) => s[0] === "eq" && s[1] === "ok");
  const rows = table
    .filter((r) => r.job === job && (!okOnly || r.ok))
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
    .slice(0, 1);
  return { data: rows, error: null };
}

/** Each expected job at its minute on 2026-10-06, the digest's own the day before. */
function healthyDay(): Row[] {
  return EXPECTED_JOBS.map((j) => {
    const date = j.job === "ops-digest" ? "2026-10-05" : "2026-10-06";
    const at = `${date}T${String(j.hourUtc).padStart(2, "0")}:${String(j.minuteUtc).padStart(2, "0")}:00.000Z`;
    return {
      job: j.job,
      started_at: at,
      finished_at: at,
      ok: true,
      error: null,
      request_id: null,
      summary: {},
    };
  });
}

const request = (path = "/api/ops/digest") => {
  const url = new URL(`http://localhost${path}`);
  return {
    headers: new Headers({ authorization: "Bearer secret" }),
    nextUrl: url,
    url: url.toString(),
  } as never;
};

const inserts = () => fake.callsTo("cron_runs").filter((c) => c.has("insert"));
const insertedRow = () => inserts()[0].argsOf("insert")![0] as Row;

let lines: LogLine[];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T15:00:05.000Z"));
  process.env.CRON_SECRET = "secret";
  process.env.PLATFORM_OWNER_EMAILS = "";
  fake.reset();
  fake.on("cron_runs.select", select);
  table = [];
  lines = [];
  setLogSink((line) => lines.push(line));
});

afterEach(() => {
  vi.useRealTimers();
  setLogSink(null);
  delete process.env.CRON_SECRET;
  delete process.env.PLATFORM_OWNER_EMAILS;
});

describe("the digest's own run", () => {
  it("records a successful run on its first day without calling itself missing", async () => {
    table = healthyDay().filter((r) => r.job !== "ops-digest");
    const { GET } = await import("@/app/api/ops/digest/route");
    const body = await (await GET(request())).json();
    expect(body.wouldSend).toBe(false);
    expect(body.text).not.toContain("ops-digest");
    expect(inserts()).toHaveLength(1);
    expect(insertedRow()).toMatchObject({
      job: "ops-digest",
      ok: true,
      error: null,
      started_at: "2026-10-06T15:00:05.000Z",
      summary: { sent: 0, wouldSend: false, recipients: 0 },
    });
  });

  it("puts a lost heartbeat in the digest, and records today's run that found it", async () => {
    table = [
      ...healthyDay().filter((r) => r.job !== "ops-digest"),
      { ...healthyDay()[4], started_at: "2026-10-03T15:00:00.000Z" },
    ];
    const { GET } = await import("@/app/api/ops/digest/route");
    const body = await (await GET(request())).json();
    expect(body.wouldSend).toBe(true);
    expect(body.text).toContain(
      "- ops-digest stale: last succeeded 2026-10-03 15:00 UTC; a run was due at 2026-10-05 15:00 UTC",
    );
    // Nobody to send it to is the digest failing at its one job, and is recorded as such.
    expect(insertedRow()).toMatchObject({
      job: "ops-digest",
      ok: false,
      error: "nobody to send to: PLATFORM_OWNER_EMAILS is empty",
    });
  });

  it("records nothing on a dry run", async () => {
    table = healthyDay();
    const { GET } = await import("@/app/api/ops/digest/route");
    await GET(request("/api/ops/digest?dry=1"));
    expect(inserts()).toHaveLength(0);
  });

  it("records a failed close of the books as a failed run", async () => {
    table = healthyDay();
    fake.on("rpc:close_ended_fiscal_years", {
      data: null,
      error: { message: "deadlock detected" },
    });
    const { GET } = await import("@/app/api/ops/digest/route");
    await GET(request());
    expect(insertedRow()).toMatchObject({
      ok: false,
      error: "fiscal years did not close: deadlock detected",
    });
  });
});

describe("a cron row that cannot be written", () => {
  it("is one scrubbed error line, written once, with no second attempt", async () => {
    table = healthyDay();
    fake.on("cron_runs.insert", {
      error: {
        message:
          "insert failed for ops@example.org at https://db.local/rest?apikey=sk_test_ABCDEFGHIJ&token=TOKEN123",
      },
    });
    const { GET } = await import("@/app/api/ops/digest/route");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(inserts()).toHaveLength(1);
    const failure = lines.filter((l) => l.msg === "cron run not recorded");
    expect(failure).toHaveLength(1);
    expect(failure[0]).toMatchObject({
      level: "error",
      route: "cron-runs",
      job: "ops-digest",
      ok: true,
    });
    const printed = JSON.stringify(failure[0]);
    expect(printed).toContain("o***@example.org");
    for (const secret of ["ops@example.org", "sk_test_ABCDEFGHIJ", "TOKEN123"]) {
      expect(printed).not.toContain(secret);
    }
  });

  it("is reported the same way when the client throws instead of answering", async () => {
    const { recordCronRun } = await import("@/lib/cron-runs");
    fake.on("cron_runs.insert", () => {
      throw new Error("fetch failed: password=hunter22 for ann@example.com");
    });
    const stored = await recordCronRun({
      job: "autopay",
      requestId: "K7QM2X4P",
      startedAt: 0,
      ok: true,
    });
    expect(stored).toBe(false);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ msg: "cron run not recorded", requestId: "K7QM2X4P" });
    expect(JSON.stringify(lines[0])).not.toMatch(/hunter22|ann@example\.com/);
  });

  it("is true when the row is written", async () => {
    const { recordCronRun } = await import("@/lib/cron-runs");
    expect(
      await recordCronRun({ job: "autopay", requestId: "K7QM2X4P", startedAt: 0, ok: true }),
    ).toBe(true);
    expect(lines).toHaveLength(0);
  });
});
