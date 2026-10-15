import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({ after: vi.fn() }));

import { after } from "next/server";
import {
  continuationAllowed,
  continuationHosts,
  continuationUrl,
  cronPlan,
  scheduleContinuation,
  walkPages,
} from "@/lib/cron";

function request(url: string) {
  return { nextUrl: new URL(url) };
}

describe("cron batching", () => {
  it("reads the cursor and rewrites it on the continuation", () => {
    const plan = cronPlan(request("https://x.test/api/assessments/run?dry=1"), { now: () => 0 });
    expect(plan.after).toBeNull();
    expect(plan.continuation("abc")).toBe("https://x.test/api/assessments/run?dry=1&after=abc");
    expect(cronPlan(request("https://x.test/run?after=abc")).after).toBe("abc");
    expect(continuationUrl("https://x.test/run?after=old", "new")).toBe(
      "https://x.test/run?after=new",
    );
  });

  it("walks every page when there is time", async () => {
    const plan = cronPlan(request("https://x.test/run"), { now: () => 0, budgetMs: 1000 });
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}` }));
    const visited: string[] = [];
    const result = await walkPages(
      plan,
      async (after, limit) => {
        const start = after ? rows.findIndex((r) => r.id === after) + 1 : 0;
        return { data: rows.slice(start, start + limit), error: null };
      },
      async (row) => {
        visited.push(row.id);
      },
      3,
    );
    expect(visited).toEqual(rows.map((r) => r.id));
    expect(result).toEqual({ complete: true, last: "r6" });
  });

  it("stops at the budget and reports the last row finished", async () => {
    let t = 0;
    const plan = cronPlan(request("https://x.test/run"), { now: () => t, budgetMs: 25 });
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}` }));
    const visited: string[] = [];
    const result = await walkPages(
      plan,
      async () => ({ data: rows, error: null }),
      async (row) => {
        visited.push(row.id);
        t += 10;
      },
      100,
    );
    // r0 at t=0, r1 at 10, r2 at 20; at 30 the budget is spent before r3.
    expect(visited).toEqual(["r0", "r1", "r2"]);
    expect(result).toEqual({ complete: false, last: "r2" });
  });

  it("resumes after the cursor", async () => {
    const plan = cronPlan(request("https://x.test/run?after=r2"), { now: () => 0 });
    const seen: (string | null)[] = [];
    await walkPages(
      plan,
      async (after) => {
        seen.push(after);
        return { data: [], error: null };
      },
      async () => {},
    );
    expect(seen).toEqual(["r2"]);
  });

  it("surfaces a page error without pretending it finished", async () => {
    const plan = cronPlan(request("https://x.test/run"), { now: () => 0 });
    const result = await walkPages(
      plan,
      async () => ({ data: null, error: { message: "boom" } }),
      async () => {},
    );
    expect(result).toEqual({ complete: false, last: null, error: "boom" });
  });
});

describe("cron continuation hosts", () => {
  it("allows nothing with nothing set", () => {
    const hosts = continuationHosts(undefined);
    expect(hosts).toEqual([]);
    expect(continuationAllowed("https://yourhoasis.com/api/billing/sweep", hosts)).toBe(false);
  });

  it("reads the named hosts, trimmed and lowercased", () => {
    expect(continuationHosts(" App.Example.COM ,, hoasis.azurecontainerapps.io ")).toEqual([
      "app.example.com",
      "hoasis.azurecontainerapps.io",
    ]);
  });

  it("refuses another host until CRON_ALLOWED_HOSTS names it", () => {
    const url = "https://app.example.com/api/assessments/run";
    expect(continuationAllowed(url, continuationHosts(undefined))).toBe(false);
    expect(continuationAllowed(url, continuationHosts("app.example.com"))).toBe(true);
  });

  it("is not fooled by a host that only ends the same way", () => {
    const hosts = continuationHosts("hoasis.azurecontainerapps.io");
    expect(continuationAllowed("https://hoasis.azurecontainerapps.io/api/autopay/run", hosts)).toBe(
      true,
    );
    expect(
      continuationAllowed("https://a.hoasis.azurecontainerapps.io/api/autopay/run", hosts),
    ).toBe(true);
    expect(
      continuationAllowed("https://hoasis.azurecontainerapps.io.evil.test/api/autopay/run", hosts),
    ).toBe(false);
    expect(continuationAllowed("https://evil.test/?x=hoasis.azurecontainerapps.io", hosts)).toBe(
      false,
    );
    expect(
      continuationAllowed("https://nothoasis.azurecontainerapps.io/api/autopay/run", hosts),
    ).toBe(false);
  });

  it("refuses anything that is not a URL", () => {
    expect(continuationAllowed("not a url", continuationHosts(undefined))).toBe(false);
    expect(continuationAllowed("", continuationHosts(undefined))).toBe(false);
  });

  it("does not fire the continuation at a host it does not trust", () => {
    const request = {
      headers: { get: () => "Bearer secret" },
    } as unknown as NextRequest;
    scheduleContinuation(request, "https://evil.test/api/email/bills");
    expect(after).not.toHaveBeenCalled();
    vi.stubEnv("CRON_ALLOWED_HOSTS", "yourhoasis.com");
    try {
      scheduleContinuation(request, "https://yourhoasis.com/api/email/bills");
      expect(after).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
