import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "@/lib/core/circuit-breaker";
import { CircuitOpenError } from "@/lib/core/errors";

/** A controllable clock, so no test ever sleeps. */
function fakeClock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

const boom = () => {
  throw new Error("dependency exploded");
};

describe("CircuitBreaker", () => {
  it("stays closed while calls succeed", () => {
    const breaker = new CircuitBreaker("test");
    expect(breaker.run(() => "ok", "fallback")).toBe("ok");
    expect(breaker.status).toBe("closed");
    expect(breaker.failures).toBe(0);
  });

  it("counts consecutive failures without opening below the threshold", () => {
    const breaker = new CircuitBreaker("test", { failureThreshold: 3 });
    breaker.run(boom, null);
    breaker.run(boom, null);
    expect(breaker.status).toBe("closed");
    expect(breaker.failures).toBe(2);
  });

  it("opens once the threshold is crossed and then fails fast", () => {
    const clock = fakeClock();
    const breaker = new CircuitBreaker("test", { failureThreshold: 2, now: clock.now });
    breaker.run(boom, null);
    breaker.run(boom, null);
    expect(breaker.status).toBe("open");

    // The operation must not run at all while the circuit is open.
    const operation = vi.fn(() => "should not run");
    expect(breaker.run(operation, "fallback")).toBe("fallback");
    expect(operation).not.toHaveBeenCalled();
  });

  it("throws CircuitOpenError from execute while open", () => {
    const breaker = new CircuitBreaker("test", { failureThreshold: 1 });
    breaker.run(boom, null);
    expect(() => breaker.execute(() => "x")).toThrow(CircuitOpenError);
  });

  it("half-opens after the cooldown and closes on a successful probe", () => {
    const clock = fakeClock();
    const breaker = new CircuitBreaker("test", {
      failureThreshold: 1,
      cooldownMs: 1_000,
      now: clock.now,
    });
    breaker.run(boom, null);
    expect(breaker.status).toBe("open");

    clock.advance(1_000);
    expect(breaker.status).toBe("half-open");

    expect(breaker.run(() => "recovered", "fallback")).toBe("recovered");
    expect(breaker.status).toBe("closed");
    expect(breaker.failures).toBe(0);
  });

  it("reopens immediately when the half-open probe fails", () => {
    const clock = fakeClock();
    const breaker = new CircuitBreaker("test", {
      failureThreshold: 3,
      cooldownMs: 1_000,
      now: clock.now,
    });
    breaker.run(boom, null);
    breaker.run(boom, null);
    breaker.run(boom, null);
    clock.advance(1_000);
    expect(breaker.status).toBe("half-open");

    // One failure in half-open is enough, regardless of the threshold.
    breaker.run(boom, null);
    expect(breaker.status).toBe("open");
  });

  it("reports state transitions", () => {
    const seen: string[] = [];
    const clock = fakeClock();
    const breaker = new CircuitBreaker("test", {
      failureThreshold: 1,
      cooldownMs: 10,
      now: clock.now,
      onStateChange: (next) => seen.push(next),
    });
    breaker.run(boom, null);
    clock.advance(10);
    void breaker.status;
    breaker.run(() => "ok", null);
    expect(seen).toEqual(["open", "half-open", "closed"]);
  });

  it("keeps the failure that tripped it, for logs", () => {
    const breaker = new CircuitBreaker("test", { failureThreshold: 1 });
    breaker.run(boom, null);
    expect(breaker.lastFailure?.message).toBe("dependency exploded");
  });
});
