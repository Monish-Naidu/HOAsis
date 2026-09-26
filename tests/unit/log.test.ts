import { afterEach, describe, expect, it, vi } from "vitest";
import {
  errorBody,
  isRequestId,
  logger,
  maskEmail,
  newRequestId,
  referenceFor,
  requestIdFrom,
  REQUEST_ID_HEADER,
  scrubFields,
  setLogSink,
  type LogLine,
} from "@/lib/log";
import { shapeAppError } from "@/lib/app-errors";
import { isPlatformOwner, platformOwnerEmails } from "@/lib/platform-owner";

/**
 * The logger's promises: nothing secret reaches a line, every line carries
 * the request id, and the id helper keeps a sane incoming id and mints a
 * readable one otherwise.
 */

// shapeAppError is pure; the module also exports the writer, which needs a
// database this suite does not have.
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => {
    throw new Error("no database in unit tests");
  },
}));

afterEach(() => setLogSink(null));

function capture() {
  const lines: LogLine[] = [];
  setLogSink((line) => lines.push(line));
  return lines;
}

describe("request ids", () => {
  it("mints eight readable characters", () => {
    const id = newRequestId();
    expect(id).toMatch(/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
    expect(newRequestId()).not.toBe(id);
  });

  it("keeps a sane incoming header and drops a bad one", () => {
    const good = new Headers({ [REQUEST_ID_HEADER]: "K7QM2X4P" });
    expect(requestIdFrom(good)).toBe("K7QM2X4P");
    const vercel = new Headers({ [REQUEST_ID_HEADER]: "iad1::abc12-1700000000000-0123456789ab" });
    expect(requestIdFrom(vercel)).toMatch(/^[A-Z2-9]{8}$/);
    const bad = new Headers({ [REQUEST_ID_HEADER]: "<script>alert(1)</script>" });
    expect(requestIdFrom(bad)).toMatch(/^[A-Z2-9]{8}$/);
    expect(requestIdFrom(null)).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("recognises only printable ids", () => {
    expect(isRequestId("K7QM2X4P")).toBe(true);
    expect(isRequestId("abc")).toBe(false);
    expect(isRequestId("a b c d e f")).toBe(false);
    expect(isRequestId(42)).toBe(false);
  });

  it("uses the server digest as the reference when it is one, else one id per error", () => {
    const withDigest = Object.assign(new Error("x"), { digest: "1234567890" });
    expect(referenceFor(withDigest)).toBe("1234567890");
    const plain = new Error("y");
    const first = referenceFor(plain);
    expect(first).toMatch(/^[A-Z2-9]{8}$/);
    expect(referenceFor(plain)).toBe(first);
    expect(referenceFor(new Error("z"))).not.toBe(first);
  });
});

describe("masking", () => {
  it("keeps the first letter and the domain of an email", () => {
    expect(maskEmail("monish@gmail.com")).toBe("m***@gmail.com");
    expect(maskEmail("Sent to alice.b@example.org today")).toBe("Sent to a***@example.org today");
    expect(maskEmail("no address here")).toBe("no address here");
  });

  it("redacts keys that name a secret, wherever they sit", () => {
    const out = scrubFields({
      token: "pm_123",
      client_secret: "pi_1_secret_abc",
      nested: { password: "hunter2", apiKey: "k", card: { number: "4242" } },
      authorization: "Bearer x",
      fine: "kept",
    });
    expect(out).toEqual({
      token: "[redacted]",
      client_secret: "[redacted]",
      nested: { password: "[redacted]", apiKey: "[redacted]", card: "[redacted]" },
      authorization: "[redacted]",
      fine: "kept",
    });
  });

  it("redacts values that look like keys even under an innocent name", () => {
    const out = scrubFields({
      a: "sk_live_abcdefghijklmnop",
      b: "whsec_abcdef",
      c: "re_abcdef123",
      d: "pi_3_secret_xyz",
      e: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc",
      f: "pi_3ABC",
    });
    expect(out).toEqual({
      a: "[redacted]",
      b: "[redacted]",
      c: "[redacted]",
      d: "[redacted]",
      e: "[redacted]",
      f: "pi_3ABC",
    });
  });

  it("masks emails inside values and inside errors", () => {
    const out = scrubFields({ to: "bob@example.com", err: new Error("Could not send to carol@example.com") });
    expect(out.to).toBe("b***@example.com");
    expect(out.err).toMatchObject({ name: "Error", message: "Could not send to c***@example.com" });
    expect((out.err as { stack?: string }).stack).not.toContain("carol@");
  });

  it("cuts long strings and deep objects", () => {
    const out = scrubFields({ long: "x".repeat(1000), deep: { a: { b: { c: { d: { e: 1 } } } } } });
    expect((out.long as string).length).toBeLessThanOrEqual(301);
    expect(JSON.stringify(out.deep)).toContain("[…]");
  });
});

describe("logger", () => {
  it("prints one JSON line per call with the request id, route and duration", () => {
    const lines = capture();
    let at = 1_000;
    const request = { headers: new Headers({ [REQUEST_ID_HEADER]: "K7QM2X4P" }) };
    const log = logger("stripe/webhook", request, { now: () => at });
    at += 250;
    log.info("event", { type: "payment_intent.succeeded", to: "owner@example.com", token: "pm_1" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: "info",
      msg: "event",
      requestId: "K7QM2X4P",
      route: "stripe/webhook",
      durationMs: 250,
      type: "payment_intent.succeeded",
      to: "o***@example.com",
      token: "[redacted]",
    });
    expect(lines[0].ts).toBe(new Date(1_250).toISOString());
    expect(JSON.stringify(lines[0])).not.toContain("owner@");
  });

  it("carries the association once attached", () => {
    const lines = capture();
    const log = logger("autopay/run", null).forAssociation("assoc-1");
    log.warn("charge failed", { reason: "declined" });
    log.error("boom", { err: new Error("nope") });
    expect(lines.map((l) => l.level)).toEqual(["warn", "error"]);
    expect(lines[0].associationId).toBe("assoc-1");
    expect(lines[1].associationId).toBe("assoc-1");
  });

  it("answers an error body with the reference", () => {
    const log = logger("join/lookup", null, { requestId: "K7QM2X4P" });
    expect(errorBody(log, "No such code")).toEqual({ error: "No such code", reference: "K7QM2X4P" });
  });

  it("never throws when the sink does", () => {
    setLogSink(() => {
      throw new Error("sink is broken");
    });
    expect(() => logger("x", null).info("still fine")).not.toThrow();
  });
});

describe("app_errors row", () => {
  it("keeps a sane reference, cuts and masks the rest, and drops non-uuids", () => {
    const row = shapeAppError({
      reference: "K7QM2X4P",
      source: "client",
      route: "/resident/pay",
      message: "Failed for dan@example.com " + "y".repeat(600),
      stack: "at x\n".repeat(2000),
      associationId: "not-a-uuid",
      profileId: "8a4f2d3e-1b2c-4d5e-8f9a-0b1c2d3e4f5a",
      userAgent: "Mozilla/5.0",
      extra: { token: "pm_1", page: 2 },
    });
    expect(row.reference).toBe("K7QM2X4P");
    expect(row.message).toContain("d***@example.com");
    expect(row.message.length).toBeLessThanOrEqual(501);
    expect(row.stack!.length).toBeLessThanOrEqual(4001);
    expect(row.association_id).toBeNull();
    expect(row.profile_id).toBe("8a4f2d3e-1b2c-4d5e-8f9a-0b1c2d3e4f5a");
    expect(row.extra).toEqual({ token: "[redacted]", page: 2 });
  });

  it("mints a reference when none was sent", () => {
    expect(shapeAppError({ source: "server", message: "x" }).reference).toMatch(/^[A-Z2-9]{8}$/);
  });
});

describe("platform owner", () => {
  it("reads a comma separated list, case and space insensitive", () => {
    expect(platformOwnerEmails(" A@x.com, b@y.org ")).toEqual(["a@x.com", "b@y.org"]);
    expect(isPlatformOwner("A@X.COM", "a@x.com")).toBe(true);
    expect(isPlatformOwner("c@z.net", "a@x.com,b@y.org")).toBe(false);
    expect(isPlatformOwner(null, "a@x.com")).toBe(false);
    expect(isPlatformOwner("a@x.com", "")).toBe(false);
  });
});
