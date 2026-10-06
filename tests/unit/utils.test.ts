import { describe, expect, it } from "vitest";
import { DAY_MS, daysBetween } from "@/lib/utils";

describe("daysBetween", () => {
  it("counts whole days from one date to another", () => {
    expect(daysBetween("2026-08-20", "2026-08-27")).toBe(7);
    expect(daysBetween("2026-08-20", "2026-08-20")).toBe(0);
  });

  it("is negative when the second date is earlier", () => {
    expect(daysBetween("2026-08-27", "2026-08-20")).toBe(-7);
  });

  it("is not thrown off by a daylight saving change or a leap day", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("agrees with DAY_MS", () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});
