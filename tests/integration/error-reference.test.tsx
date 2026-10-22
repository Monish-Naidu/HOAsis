import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createFakeSupabase, type FakeCall } from "../helpers/fake-supabase";
import { setLogSink, type LogLine } from "@/lib/log";

/**
 * The reference a person reads off an error screen finds the operator's
 * record, and nothing secret is in that record.
 *
 * The real surfaces, end to end with a fake database: the route error page
 * (src/app/error.tsx) shows a reference and posts it; the real /api/log
 * route writes the row through recordAppError; loadOpsReport, which /admin
 * renders, reads it back by that reference. The server path is Next's
 * onRequestError hook in src/instrumentation.ts. Planted emails, query
 * tokens and keys sit in the message, the stack, the URL and nested extras.
 */

vi.mock("@/lib/supabase/env", () => ({ hasSupabase: true }));
vi.mock("@/lib/health", () => ({
  runHealthChecks: async () => ({ ok: true, at: "", checks: {} }),
}));
const fake = createFakeSupabase({ "auth.getUser": { data: { user: null }, error: null } });
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => fake.client,
  supabaseServer: async () => fake.client,
}));

const PLANTED = [
  "jane.doe@example.com",
  "PLANTEDINVITE77",
  "PLANTEDQUERY88",
  "sk_test_PLANTEDKEY99",
  "hunter2planted",
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwbGFudGVkIn0",
];

let stored: Record<string, unknown>[];
let lines: LogLine[];

beforeEach(() => {
  fake.reset();
  stored = [];
  lines = [];
  fake.on("app_errors.insert", (call: FakeCall) => {
    stored.push(call.argsOf("insert")![0] as Record<string, unknown>);
    return { data: null, error: null };
  });
  // The operator's read: newest first, as loadOpsReport asks.
  fake.on("app_errors.select", () => ({ data: [...stored].reverse(), error: null }));
  setLogSink((line) => lines.push(line));
});

afterEach(() => {
  setLogSink(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.pushState({}, "", "/");
});

function expectClean(value: unknown) {
  const text = JSON.stringify(value);
  for (const marker of PLANTED) expect(text).not.toContain(marker);
}

async function post(body: string) {
  const { POST } = await import("@/app/api/log/route");
  const request = {
    headers: new Headers({ "user-agent": "Mozilla/5.0", "x-forwarded-for": "198.51.100.7" }),
    json: async () => JSON.parse(body),
  } as never;
  return (await POST(request)).json();
}

describe("a client error's reference", () => {
  it("is shown, posted, stored scrubbed, and found by the operator's report", async () => {
    window.history.pushState({}, "", "/resident/pay?invite=PLANTEDINVITE77#token=PLANTEDQUERY88");
    const posted: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        posted.push(String(init.body));
        return new Response("{}");
      }),
    );
    const error = new Error(
      "Could not load https://api.example.com/units?token=PLANTEDQUERY88 for jane.doe@example.com (key sk_test_PLANTEDKEY99)",
    );
    error.stack = `Error: password=hunter2planted\n    at Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwbGFudGVkIn0.c2ln (pay.tsx:1)`;
    const { default: RouteError } = await import("@/app/error");
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<RouteError error={error} reset={() => {}} />);

    const shown = screen.getByText(/^[A-HJ-NP-Z2-9]{8}$/).textContent!;
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(JSON.parse(posted[0]).reference).toBe(shown);

    const answer = await post(posted[0]);
    expect(answer).toEqual({ reference: shown });
    expect(stored).toHaveLength(1);
    const row = stored[0];
    expect(row).toMatchObject({ reference: shown, source: "client", route: "/resident/pay" });
    expect(row.message).toBe(
      "Could not load https://api.example.com/units?token=[redacted] for j***@example.com (key [redacted])",
    );
    expect((row.extra as { href: string; boundary: string }).href).toBe(
      "http://localhost:3000/resident/pay?invite=[redacted]#token=[redacted]",
    );
    expect((row.extra as { boundary: string }).boundary).toBe("route");
    expectClean(row);
    expectClean(lines);

    const { loadOpsReport } = await import("@/lib/ops");
    const report = await loadOpsReport(new Date("2026-10-06T15:00:00Z"));
    const found = report.errors.filter((e) => e.reference === shown);
    expect(found).toHaveLength(1);
    expect(found[0].message).toBe(row.message);
  });
});

describe("a server error's reference", () => {
  it("is the request id, and the stored row and log line are scrubbed", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const { onRequestError } = await import("@/instrumentation");
    const error = Object.assign(
      new Error("lookup failed for jane.doe@example.com with apikey=sk_test_PLANTEDKEY99"),
      { digest: "2448117305" },
    );
    await onRequestError(
      error,
      {
        path: "/api/join/lookup?code=PLANTEDQUERY88&email=jane.doe%40example.com",
        method: "GET",
        headers: { "x-request-id": "K7QM2X4P", "user-agent": "Mozilla/5.0" },
      },
      {
        routerKind: "App Router",
        routePath: "/api/join/lookup",
        routeType: "route",
        renderSource: undefined,
      } as never,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      reference: "K7QM2X4P",
      source: "server",
      route: "/api/join/lookup",
    });
    expect((stored[0].extra as { path: string }).path).toBe(
      "/api/join/lookup?code=[redacted]&email=[redacted]",
    );
    expectClean(stored);
    const line = lines.find((l) => l.msg === "unhandled server error")!;
    expect(line.requestId).toBe("K7QM2X4P");
    expectClean(line);
    expect(JSON.stringify(stored)).not.toContain("jane.doe%40example.com");

    const { loadOpsReport } = await import("@/lib/ops");
    const report = await loadOpsReport(new Date("2026-10-06T15:00:00Z"));
    expect(report.errors.map((e) => e.reference)).toContain("K7QM2X4P");
  });
});

describe("an error row that cannot be written", () => {
  it("returns the reference, says so once on the log, scrubbed, and does not retry", async () => {
    fake.on("app_errors.insert", {
      error: { message: "permission denied for jane.doe@example.com" },
    });
    const { recordAppError } = await import("@/lib/app-errors");
    const result = await recordAppError({
      reference: "K7QM2X4P",
      source: "server",
      message: "boom",
    });
    expect(result).toEqual({ reference: "K7QM2X4P", stored: false });
    expect(fake.callsTo("app_errors")).toHaveLength(1);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: "error",
      msg: "app error not stored",
      reference: "K7QM2X4P",
    });
    expectClean(lines);
    expect(JSON.stringify(lines)).toContain("j***@example.com");
  });

  it("is handled the same when the client throws", async () => {
    fake.on("app_errors.insert", () => {
      throw new Error("fetch failed");
    });
    const { recordAppError } = await import("@/lib/app-errors");
    expect(await recordAppError({ source: "client", message: "x" })).toMatchObject({
      stored: false,
    });
    expect(lines.map((l) => l.msg)).toEqual(["app error not stored"]);
  });
});
