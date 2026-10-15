import { describe, expect, it } from "vitest";
import { amenityNameProblem, bookingLimitProblem, duplicateHolderNote } from "@/lib/amenity-checks";

describe("amenityNameProblem", () => {
  it("refuses a second amenity with the same name, ignoring case and spaces", () => {
    expect(amenityNameProblem("Pool", ["Pool", "Clubhouse"])).toBe("Pool is already on the list.");
    expect(amenityNameProblem("  pool ", ["Pool"])).toBe("pool is already on the list.");
    expect(amenityNameProblem("Tennis  Court", ["tennis court"])).not.toBeNull();
  });
  it("lets a different name and an empty one through", () => {
    expect(amenityNameProblem("Pool house", ["Pool"])).toBeNull();
    expect(amenityNameProblem("", ["Pool"])).toBeNull();
  });
});

describe("bookingLimitProblem", () => {
  it("accepts whole numbers from 1 to the maximum", () => {
    expect(bookingLimitProblem("1", 20)).toBeNull();
    expect(bookingLimitProblem("20", 20)).toBeNull();
    expect(bookingLimitProblem(" 3 ", 20)).toBeNull();
  });
  it("refuses 0, negatives, fractions, huge numbers and text, with a reason", () => {
    for (const bad of ["0", "-3", "2.5", "999999", "21", "", "two", "1e1"]) {
      expect(bookingLimitProblem(bad, 20), bad).toBe("Use a whole number from 1 to 20.");
    }
  });
});

describe("duplicateHolderNote", () => {
  const holders = [
    { name: "Pat Lee", role: "treasurer" },
    { name: "Sam Ro", role: "secretary" },
  ];
  it("warns when a seat already has a holder", () => {
    expect(duplicateHolderNote("treasurer", "Treasurer", holders)).toBe(
      "Pat Lee already holds Treasurer. A seat can have two people; check that is what you meant.",
    );
  });
  it("says nothing for an empty seat or for residents", () => {
    expect(duplicateHolderNote("vice-president", "Vice President", holders)).toBeNull();
    expect(
      duplicateHolderNote("resident", "Resident", [{ name: "A", role: "resident" }]),
    ).toBeNull();
  });
});
