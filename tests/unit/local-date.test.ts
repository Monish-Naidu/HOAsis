import { describe, expect, it } from "vitest";
import { localIsoDate } from "@/lib/utils";

describe("localIsoDate", () => {
  it("is the calendar date where the person is, not the UTC one", () => {
    // 11pm local on the 7th. In any zone west of UTC the UTC date is the 8th.
    const late = new Date(2026, 9, 7, 23, 30);
    expect(localIsoDate(late)).toBe("2026-10-07");
  });
  it("pads the month and the day", () => {
    expect(localIsoDate(new Date(2026, 0, 3, 9))).toBe("2026-01-03");
  });
});
