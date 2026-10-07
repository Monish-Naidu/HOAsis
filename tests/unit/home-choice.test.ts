import { describe, expect, it } from "vitest";
import { homesLine, pickSeat, voteCountLine } from "@/lib/home-choice";
import { caps } from "@/lib/data/accounts";
import type { Account } from "@/lib/types";

const seat = (homeId: string, unit: string): Account => ({
  id: "pat",
  homeId,
  name: "Pat",
  email: "pat@example.com",
  unit,
  role: "resident",
  capabilities: caps([]),
  views: caps([]),
});

describe("pickSeat", () => {
  const seats = [seat("u-42", "42"), seat("u-43", "43"), seat("u-44", "44")];

  it("takes the seat on the chosen home", () => {
    expect(pickSeat(seats, "u-43")?.unit).toBe("43");
  });

  it("falls back to the first seat when nothing is chosen", () => {
    expect(pickSeat(seats, "")?.unit).toBe("42");
    expect(pickSeat(seats, null)?.unit).toBe("42");
  });

  it("falls back when the chosen home is no longer theirs", () => {
    expect(pickSeat(seats, "u-sold")?.unit).toBe("42");
  });

  it("is null with no seats", () => {
    expect(pickSeat([], "u-42")).toBeNull();
  });
});

describe("the lines for an owner of several homes", () => {
  it("says how many homes and which is showing", () => {
    expect(homesLine(2, "Unit 42")).toBe("You own 2 homes here. Showing Unit 42.");
  });
  it("says a vote counts for each home", () => {
    expect(voteCountLine(3)).toBe("Counts once for each of your 3 homes.");
  });
});
