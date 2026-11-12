import { test, expect } from "@playwright/test";
import { expectHealthy, seedSession, SEATS } from "./helpers";

test("security headers cover pages, public files and API refusals", async ({ request }) => {
  for (const path of ["/", "/signin", "/robots.txt", "/api/email/notify"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(path === "/api/email/notify" ? 405 : 200);
    const headers = response.headers();
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers["content-security-policy"], path).toBe(
      "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
    );
    expect(headers["x-powered-by"], path).toBeUndefined();
  }
});

test("the policy leaves the resident payment screen hydrated", async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    const errors: string[] = [];
    Object.assign(window, { securityPolicyViolations: errors });
    document.addEventListener("securitypolicyviolation", (event) => {
      errors.push(event.effectiveDirective);
    });
  });
  await seedSession(page, { seat: SEATS.resident, view: "resident" });
  await page.goto("/resident/pay");
  await expectHealthy(page, "resident payment under security headers");
  violations.push(
    ...(await page.evaluate(
      () =>
        (window as Window & { securityPolicyViolations?: string[] }).securityPolicyViolations ?? [],
    )),
  );
  expect(violations).toEqual([]);
});
