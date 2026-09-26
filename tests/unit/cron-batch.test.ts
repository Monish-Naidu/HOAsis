import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: vi.fn() }));

import { continuationUrl, cronPlan, walkPages } from "@/lib/cron";

function request(url: string) {
  return { nextUrl: new URL(url) };
}

describe("cron batching", () => {
  it("reads the cursor and rewrites it on the continuation", () => {
    const plan = cronPlan(request("https://x.test/api/assessments/run?dry=1"), { now: () => 0 });
    expect(plan.after).toBeNull();
    expect(plan.continuation("abc")).toBe("https://x.test/api/assessments/run?dry=1&after=abc");
    expect(cronPlan(request("https://x.test/run?after=abc")).after).toBe("abc");
    expect(continuationUrl("https://x.test/run?after=old", "new")).toBe("https://x.test/run?after=new");
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
