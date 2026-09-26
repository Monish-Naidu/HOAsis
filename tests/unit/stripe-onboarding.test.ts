import { describe, expect, it } from "vitest";
import {
  accountPrefill,
  associationUrl,
  e164,
  statementDescriptor,
  statementPrefix,
} from "@/lib/stripe/onboarding";

describe("e164", () => {
  it("accepts the ways people type a US number", () => {
    expect(e164("(425) 555-0100")).toBe("+14255550100");
    expect(e164("425.555.0100")).toBe("+14255550100");
    expect(e164("1-425-555-0100")).toBe("+14255550100");
  });
  it("refuses anything else rather than guess", () => {
    expect(e164("")).toBeNull();
    expect(e164(undefined)).toBeNull();
    expect(e164("555-0100")).toBeNull();
  });
});

describe("statementDescriptor", () => {
  it("uppercases and adds HOA when it fits", () => {
    expect(statementDescriptor("Oakview Commons")).toBe("OAKVIEW COMMONS HOA");
  });
  it("keeps a name that already says HOA", () => {
    expect(statementDescriptor("Mehr Meadows HOA")).toBe("MEHR MEADOWS HOA");
  });
  it("stays within 22 characters", () => {
    const d = statementDescriptor("The Willows at Lake Sammamish Homeowners Association")!;
    expect(d.length).toBeLessThanOrEqual(22);
    expect(d).toBe("THE WILLOWS AT LAKE SA");
  });
  it("drops the characters card networks refuse", () => {
    expect(statementDescriptor(`Bob's "Place" <HOA>`)).toBe("BOBS PLACE HOA");
  });
  it("gives up on a name with no letters, and pads a short one with HOA", () => {
    expect(statementDescriptor("12")).toBeNull();
    expect(statementDescriptor("A")).toBe("A HOA");
  });
  it("prefix is at most ten characters", () => {
    expect(statementPrefix("OAKVIEW COMMONS HOA")).toBe("OAKVIEW CO");
    expect(statementPrefix("MEHR MEADOWS HOA")).toBe("MEHR MEADO");
  });
});

describe("accountPrefill", () => {
  const full = accountPrefill(
    { name: "Mehr Meadows", ein: "12-3456789", city: "Bothell", state: "wa", phone: "425 555 0100", slug: "mehr-meadows" },
    "https://yourhoasis.com/",
  );

  it("fills every field Stripe would otherwise ask for", () => {
    expect(full.display_name).toBe("Mehr Meadows");
    expect(full.identity.business_details).toEqual({
      registered_name: "Mehr Meadows",
      id_numbers: [{ type: "us_ein", value: "123456789" }],
      address: { country: "us", city: "Bothell", state: "WA" },
      phone: "+14255550100",
    });
    expect(full.configuration.merchant.mcc).toBe("8641");
    expect(full.configuration.merchant.statement_descriptor).toEqual({
      descriptor: "MEHR MEADOWS HOA",
      prefix: "MEHR MEADO",
    });
    expect(full.configuration.merchant.support).toEqual({
      url: "https://yourhoasis.com/c/mehr-meadows",
      phone: "+14255550100",
    });
    expect(full.defaults.profile).toEqual({
      business_url: "https://yourhoasis.com/c/mehr-meadows",
      doing_business_as: "Mehr Meadows",
      product_description: "Homeowners association dues",
    });
    expect(full.defaults.responsibilities).toEqual({ fees_collector: "stripe", losses_collector: "stripe" });
  });

  it("leaves out what it does not know instead of sending blanks", () => {
    const bare = accountPrefill({ name: "Zz" }, "https://yourhoasis.com");
    expect(bare.identity.business_details.id_numbers).toBeUndefined();
    expect(bare.identity.business_details.address).toBeUndefined();
    expect(bare.identity.business_details.phone).toBeUndefined();
    expect(bare.configuration.merchant.statement_descriptor).toEqual({ descriptor: "ZZ HOA", prefix: "ZZ HOA" });
    expect(bare.configuration.merchant.support).toEqual({ url: "https://yourhoasis.com", phone: undefined });
  });

  it("ignores an EIN that is not nine digits", () => {
    const p = accountPrefill({ name: "Oakview Commons", ein: "12-34" }, "https://yourhoasis.com");
    expect(p.identity.business_details.id_numbers).toBeUndefined();
  });

  it("builds the community URL from the slug", () => {
    expect(associationUrl("https://yourhoasis.com", "oakview-commons")).toBe(
      "https://yourhoasis.com/c/oakview-commons",
    );
    expect(associationUrl("https://yourhoasis.com", null)).toBe("https://yourhoasis.com");
  });
});
