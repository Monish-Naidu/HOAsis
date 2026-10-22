import { describe, expect, it } from "vitest";
import { maskEmail, redactAttributes, redactSpan, scrubText, stripUrl } from "../../redact.mjs";

describe("scrubText", () => {
  it("masks emails and keeps the domain", () => {
    expect(scrubText("sent to monish@gmail.com")).toBe("sent to m***@gmail.com");
    expect(maskEmail("not an email")).toBe("not an email");
  });

  it("redacts tokens, keys and credentials embedded in a message", () => {
    const out = scrubText(
      "fetch https://user:pw@db.example.com/x?token=abc123&page=2 failed, Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig sk_live_abcdef123456 whsec_abcdef123456 password=hunter2",
    );
    for (const marker of [
      "user:pw",
      "abc123",
      "eyJhbGci",
      "sk_live_abcdef",
      "whsec_abcdef",
      "hunter2",
    ]) {
      expect(out).not.toContain(marker);
    }
    expect(out).toContain("https://db.example.com/x?token=[redacted]&page=[redacted]");
  });

  it("does not redact a value twice", () => {
    const once = scrubText("token=abc");
    expect(scrubText(once)).toBe(once);
  });
});

describe("stripUrl", () => {
  it("keeps origin and path only", () => {
    expect(stripUrl("https://a:b@x.test/p/q?code=1#f")).toBe("https://x.test/p/q");
    expect(stripUrl("/api/log?email=a@b.co")).toBe("/api/log");
  });

  it("cuts a malformed URL at its query", () => {
    expect(stripUrl("http://[bad/path?token=zzz")).not.toContain("zzz");
  });
});

describe("redactAttributes and redactSpan", () => {
  it("drops query, SQL and header attributes and strips URL attributes", () => {
    const attributes: Record<string, unknown> = {
      "url.full": "https://x.test/a?token=t1",
      "url.query": "token=t1",
      "db.statement": "select 'a@b.co'",
      "http.request.header.authorization": ["Bearer t2"],
      "http.request.method": "GET",
      "http.response.status_code": 200,
      "url.path": "/a",
      "user.api_key": "k",
    };
    redactAttributes(attributes);
    expect(attributes).toEqual({
      "url.full": "https://x.test/a",
      "http.request.method": "GET",
      "http.response.status_code": 200,
      "url.path": "/a",
      "user.api_key": "[redacted]",
    });
  });

  it("scrubs the name, events and status message", () => {
    const span = {
      name: "GET /x?code=c1",
      attributes: {},
      events: [{ attributes: { "exception.message": "bad a@b.co token=t3" } }],
      status: { code: 2, message: "Bearer t4" },
    };
    redactSpan(span);
    expect(JSON.stringify(span)).not.toMatch(/c1|a@b\.co|t3|t4/);
    expect(span.status.code).toBe(2);
  });
});
