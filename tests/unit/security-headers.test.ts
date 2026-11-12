import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function globalHeaders() {
  const rules = await nextConfig.headers?.();
  const global = rules?.find((rule) => rule.source === "/:path*");
  expect(global, "Headers must also cover the landing page, APIs and public files").toBeDefined();
  return new Map(global?.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

describe("static-compatible security headers", () => {
  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("prevents type sniffing and embedding the app", async () => {
    const headers = await globalHeaders();
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("limits referrers and unused device access without blocking payment", async () => {
    const headers = await globalHeaders();
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers.get("permissions-policy")).not.toContain("payment");
  });

  it("uses a narrow policy that leaves static hydration and Stripe child frames intact", async () => {
    const policy = (await globalHeaders()).get("content-security-policy");
    expect(policy).toBe("base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
    expect(policy).not.toMatch(/(?:default|script|style|frame|child)-src|nonce/);
  });

  it("does not enable cross-origin isolation that can break hosted authentication", async () => {
    const headers = await globalHeaders();
    expect(headers.has("cross-origin-embedder-policy")).toBe(false);
    expect(headers.has("cross-origin-opener-policy")).toBe(false);
  });
});
