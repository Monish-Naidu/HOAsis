import { describe, expect, it } from "vitest";
import { createLimiter } from "@/lib/rate-limit";

function clock(start = 0) {
  let at = start;
  return { now: () => at, tick: (ms: number) => (at += ms) };
}

describe("rate limiter", () => {
  it("allows the limit and refuses the next one with a retry hint", () => {
    const c = clock();
    const limiter = createLimiter({ limit: 3, windowMs: 60_000, now: c.now });
    expect(limiter.check("1.1.1.1")).toMatchObject({ ok: true, remaining: 2 });
    expect(limiter.check("1.1.1.1")).toMatchObject({ ok: true, remaining: 1 });
    expect(limiter.check("1.1.1.1")).toMatchObject({ ok: true, remaining: 0 });
    c.tick(10_000);
    expect(limiter.check("1.1.1.1")).toEqual({ ok: false, retryAfterSeconds: 50, remaining: 0 });
  });

  it("keeps addresses apart", () => {
    const c = clock();
    const limiter = createLimiter({ limit: 1, windowMs: 60_000, now: c.now });
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("a").ok).toBe(false);
    expect(limiter.check("b").ok).toBe(true);
  });

  it("opens again once the window has passed", () => {
    const c = clock();
    const limiter = createLimiter({ limit: 1, windowMs: 1_000, now: c.now });
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("a").ok).toBe(false);
    c.tick(1_000);
    expect(limiter.check("a").ok).toBe(true);
  });

  it("forgets expired windows rather than growing forever", () => {
    const c = clock();
    const limiter = createLimiter({ limit: 1, windowMs: 1_000, now: c.now });
    for (let i = 0; i < 1000; i++) limiter.check(`ip-${i}`);
    expect(limiter.size()).toBe(1000);
    c.tick(1_000);
    limiter.check("fresh");
    expect(limiter.size()).toBe(1);
  });
});
