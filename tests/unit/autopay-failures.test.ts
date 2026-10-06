import { describe, expect, it } from "vitest";
import {
  failedThisMonth,
  failuresToShow,
  previousMonth,
  triedLine,
  type AutopayFailure,
} from "@/lib/payments/autopay-failures";

const row = (over: Partial<AutopayFailure>): AutopayFailure => ({
  unitId: "u1",
  month: "2026-08",
  amountCents: 15000,
  reason: "Card declined",
  attempts: 1,
  lastAttemptOn: "2026-08-12",
  ...over,
});

describe("previousMonth", () => {
  it("rolls January back to December", () => {
    expect(previousMonth("2026-01-15")).toBe("2025-12");
    expect(previousMonth("2026-08-20")).toBe("2026-07");
  });
});

describe("failuresToShow", () => {
  it("keeps this and last month, drops older, newest first", () => {
    const out = failuresToShow(
      [
        row({ unitId: "a", month: "2026-06" }),
        row({ unitId: "b", month: "2026-07", lastAttemptOn: "2026-07-30" }),
        row({ unitId: "c", month: "2026-08", lastAttemptOn: "2026-08-10" }),
      ],
      "2026-08-20",
    );
    expect(out.map((r) => r.unitId)).toEqual(["c", "b"]);
  });

  it("lists a home once, with its newest row", () => {
    const out = failuresToShow(
      [row({ month: "2026-07", attempts: 2 }), row({ month: "2026-08", attempts: 3 })],
      "2026-08-20",
    );
    expect(out).toHaveLength(1);
    expect(out[0].attempts).toBe(3);
  });
});

describe("failedThisMonth", () => {
  it("counts only the current month", () => {
    const set = failedThisMonth(
      [row({ unitId: "a" }), row({ unitId: "b", month: "2026-07" })],
      "2026-08-20",
    );
    expect([...set]).toEqual(["a"]);
  });
});

describe("triedLine", () => {
  const fmt = (iso: string) => `on ${iso}`.replace("on ", "");
  it("says once, then counts", () => {
    expect(triedLine({ attempts: 1, lastAttemptOn: "2026-08-12" }, fmt)).toBe(
      "Tried once, last on 2026-08-12",
    );
    expect(triedLine({ attempts: 3, lastAttemptOn: "2026-08-12" }, fmt)).toBe(
      "Tried 3 times, last on 2026-08-12",
    );
  });
  it("drops the date when none was recorded", () => {
    expect(triedLine({ attempts: 2, lastAttemptOn: null }, fmt)).toBe("Tried 2 times");
  });
});
