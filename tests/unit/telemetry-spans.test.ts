import { execFile } from "node:child_process";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The spans the app really emits, scrubbed before they leave.
 *
 * tests/fixtures/telemetry-spans.mjs starts the production distro
 * configuration from telemetry.mjs in a plain Node process, takes a real
 * inbound request and makes real outbound `fetch` calls from inside it, with
 * planted secrets in the query, fragment, user info, headers, exception and
 * status. Every span, as the exporter would read it, must hold none of them,
 * and must still carry the trace ids, method, path, status and timing a
 * person needs to follow a request.
 */

const MARKERS = {
  email: "planted.person@example.org",
  token: "PLANTEDTOKEN1234567",
  password: "PLANTEDPASS9876",
  stripe: "sk_test_PLANTEDSTRIPEKEY42",
  jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwbGFudGVkIn0.c2lnbmF0dXJl",
  fragment: "PLANTEDFRAGMENT55",
};
const planted = [...Object.values(MARKERS), encodeURIComponent(MARKERS.email)];

interface Span {
  name: string;
  kind: number;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  attributes: Record<string, unknown>;
  events: { name: string; attributes: Record<string, unknown> }[];
  status: { code: number; message?: string };
  durationNs: number;
}

let result: { status: number; raw: Record<string, unknown>[]; ended: Span[] };

const SERVER = 1;
const CLIENT = 2;
const ERROR = 2;

beforeAll(async () => {
  const fixture = path.resolve(process.cwd(), "tests/fixtures/telemetry-spans.mjs");
  const stdout = await new Promise<string>((resolve, reject) =>
    execFile(
      process.execPath,
      [fixture, JSON.stringify(MARKERS)],
      { timeout: 30_000, env: { ...process.env, APPLICATIONINSIGHTS_CONNECTION_STRING: "" } },
      (error, out) => (error ? reject(error) : resolve(out)),
    ),
  );
  const line = stdout.split("\n").find((l) => l.startsWith("SPANS "));
  if (!line) throw new Error("the fixture printed no spans");
  result = JSON.parse(line.slice("SPANS ".length));
}, 40_000);

const inbound = () =>
  result.ended.find((s) => s.kind === SERVER && s.attributes["url.path"] === "/api/join/lookup")!;
const outbound = () =>
  result.ended.filter((s) => s.kind === CLIENT && s.parentSpanId === inbound().spanId);

describe("automatic HTTP and fetch spans", () => {
  it("really recorded the planted values before the scrubber ran", () => {
    expect(result.status).toBe(500);
    const before = JSON.stringify(result.raw);
    expect(before).toContain(MARKERS.token);
    expect(before).toContain(encodeURIComponent(MARKERS.email));
  });

  it("holds no planted value in any attribute, event, status or name", () => {
    // Every span: the inbound request, both fetches, and the test's own
    // outgoing request, whose URL carried the password and the query.
    expect(result.ended.length).toBeGreaterThanOrEqual(4);
    const after = JSON.stringify(result.ended);
    for (const marker of planted) expect(after).not.toContain(marker);
    for (const span of result.ended) {
      expect(span.attributes).not.toHaveProperty("url.query");
    }
  });

  it("keeps the inbound request's trace, method, path, status and timing", () => {
    const span = inbound();
    expect(span).toBeDefined();
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(span.attributes["http.request.method"]).toBe("GET");
    expect(span.attributes["url.path"]).toBe("/api/join/lookup");
    expect(span.attributes["http.response.status_code"]).toBe(500);
    expect(span.status.code).toBe(ERROR);
    expect(span.durationNs).toBeGreaterThan(0);
    const exception = span.events.find((e) => e.name === "exception");
    expect(exception?.attributes["exception.message"]).toMatch(
      /^could not reach p\*\*\*@example\.org with password=\[redacted\] from http:\/\/127\.0\.0\.1:\d+\/resident\/pay#\[redacted\]$/,
    );
    expect(exception?.attributes["exception.stacktrace"]).toMatch(
      /at pay \(http:\/\/127\.0\.0\.1:\d+\/resident\/pay#\[redacted\]\)$/,
    );
  });

  it("keeps each fetch in the same trace, under the request, with its path and status", () => {
    const fetches = outbound();
    expect(fetches).toHaveLength(2);
    for (const span of fetches) {
      expect(span.traceId).toBe(inbound().traceId);
      expect(span.attributes["http.request.method"]).toBe("GET");
      expect(span.attributes["url.full"]).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+\/(rest\/v1\/units|fail)$/,
      );
    }
    const units = fetches.find((s) => s.attributes["url.path"] === "/rest/v1/units")!;
    expect(units.attributes["http.response.status_code"]).toBe(200);
    const failed = fetches.find((s) => s.attributes["url.path"] === "/fail")!;
    expect(failed.attributes["http.response.status_code"]).toBe(502);
    expect(failed.status.code).toBe(ERROR);
  });
});
