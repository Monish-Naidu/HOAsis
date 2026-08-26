import { describe, expect, it } from "vitest";
import { parseRoster } from "@/app/start/setup-wizard";

/**
 * The roster file a board actually has.
 *
 * It came out of whatever their management company used, so it will not match
 * any format we specify. These are the shapes that turn up.
 */
describe("parseRoster", () => {
  it("reads plain comma rows", () => {
    expect(parseRoster("Marcus Bell, marcus@example.com, 2")).toEqual([
      { name: "Marcus Bell", email: "marcus@example.com", unit: "2" },
    ]);
  });

  it("keeps a name containing a comma together", () => {
    // The single most common export shape, and the one that used to produce a
    // household called Smith living in unit John.
    const rows = parseRoster('"Smith, John",john@example.com,14');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Smith, John");
    expect(rows[0].unit).toBe("14");
  });

  it("survives a header row that does not start with a name column", () => {
    const rows = parseRoster("Unit,Owner,Email\n7,Rhea Calloway,rhea@example.com");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Rhea Calloway");
    expect(rows[0].unit).toBe("7");
  });

  it("accepts tabs, which is what a spreadsheet paste produces", () => {
    const rows = parseRoster("Yuki Tanaka\tyuki@example.com\t3");
    expect(rows[0]).toEqual({ name: "Yuki Tanaka", email: "yuki@example.com", unit: "3" });
  });

  it("finds the unit whatever column it sits in", () => {
    const rows = parseRoster("12B, Dana Whitcomb, dana@example.com");
    expect(rows[0].unit).toBe("12B");
    expect(rows[0].name).toBe("Dana Whitcomb");
  });

  it("works without emails at all", () => {
    const rows = parseRoster("Owen Brady, 41\nGwen Halloran, 42");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ name: "Gwen Halloran", email: "", unit: "42" });
  });

  it("drops repeated units rather than billing a home twice", () => {
    const rows = parseRoster("A Person, 5\nAnother Person, 5");
    expect(rows).toHaveLength(1);
  });

  it("ignores blank lines and rows with nothing usable", () => {
    expect(parseRoster("\n\n   \nJustOneCell\n")).toEqual([]);
  });

  it("does not mistake a phone number for an email", () => {
    const rows = parseRoster("Lena Ortiz, 555-0142, 9");
    expect(rows[0].email).toBe("");
    expect(rows[0].unit).toBe("9");
  });
});
