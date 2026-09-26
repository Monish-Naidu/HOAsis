import { describe, expect, it } from "vitest";
import { describeRequirement, joinNeeds, plainNeeds } from "@/lib/stripe/requirements";

/**
 * Stripe's requirement paths, as a bare test account listed them on
 * 2026-09-26, turned into the sentences Settings shows. The v1 names Stripe
 * used to send are covered too, so a webhook from either shape reads the same.
 */
describe("describeRequirement", () => {
  it("maps the EIN and SSN paths to the number sentence", () => {
    expect(describeRequirement("identity.business_details.id_numbers.us_ein")).toBe(
      "the EIN or a Social Security number",
    );
    expect(describeRequirement("representative.id_numbers.us_ssn_last_4")).toBe(
      "the EIN or a Social Security number",
    );
    expect(describeRequirement("id_numbers")).toBe("the EIN or a Social Security number");
    expect(describeRequirement("company.tax_id")).toBe("the EIN or a Social Security number");
  });

  it("maps the bank account", () => {
    expect(describeRequirement("external_account")).toBe("a bank account for payouts");
  });

  it("maps every representative field to the person, whatever it asks for", () => {
    for (const path of [
      "representative",
      "representative.date_of_birth.day",
      "representative.address.postal_code",
      "representative.phone",
      "representative.relationship.title",
    ]) {
      expect(describeRequirement(path)).toBe("the person who represents the association");
    }
  });

  it("maps owners and the persons attestation to the board", () => {
    expect(describeRequirement("owners.given_name")).toBe("who serves on the board");
    expect(describeRequirement("identity.attestations.persons_provided.owners")).toBe(
      "who serves on the board",
    );
  });

  it("maps the association's own address, phone, URL and description", () => {
    expect(describeRequirement("identity.business_details.address.line1")).toBe(
      "the association's mailing address",
    );
    expect(describeRequirement("identity.business_details.phone")).toBe("a phone number");
    expect(describeRequirement("configuration.merchant.support.phone")).toBe("a phone number");
    expect(describeRequirement("defaults.profile.business_url")).toBe(
      "the association's web address",
    );
    expect(describeRequirement("configuration.merchant.mcc")).toBe(
      "a short description of what residents pay for",
    );
    expect(describeRequirement("configuration.merchant.statement_descriptor.descriptor")).toBe(
      "a short description of what residents pay for",
    );
  });

  it("maps the terms of service", () => {
    expect(describeRequirement("identity.attestations.terms_of_service.account.date")).toBe(
      "agreement to Stripe's terms",
    );
    expect(describeRequirement("tos_acceptance.date")).toBe("agreement to Stripe's terms");
  });

  it("returns null for something it has no words for", () => {
    expect(describeRequirement("some.new.thing")).toBeNull();
    expect(describeRequirement("")).toBeNull();
  });
});

describe("plainNeeds", () => {
  it("dedupes thirty paths into a few sentences in a fixed order", () => {
    const entries = [
      "representative.surname",
      "owners.email",
      "external_account",
      "representative.date_of_birth.year",
      "identity.business_details.id_numbers.us_ein",
      "identity.business_details.address.line1",
      "identity.business_details.address.postal_code",
      "identity.attestations.terms_of_service.account.date",
    ].map((description) => ({ description, awaiting_action_from: "user" }));
    expect(plainNeeds(entries)).toEqual([
      "the EIN or a Social Security number",
      "a bank account for payouts",
      "agreement to Stripe's terms",
      "the person who represents the association",
      "who serves on the board",
      "the association's mailing address",
    ]);
  });

  it("ignores what Stripe itself is working on", () => {
    expect(
      plainNeeds([
        { description: "defaults.profile.business_url", awaiting_action_from: "stripe" },
        { description: "external_account", awaiting_action_from: "user" },
      ]),
    ).toEqual(["a bank account for payouts"]);
  });

  it("never says nothing when it does not know the word", () => {
    expect(plainNeeds([{ description: "brand.new.requirement" }])).toEqual(["a few more details"]);
  });

  it("is empty when there is nothing left", () => {
    expect(plainNeeds([])).toEqual([]);
  });
});

describe("joinNeeds", () => {
  it("reads as one sentence", () => {
    expect(joinNeeds([])).toBe("");
    expect(joinNeeds(["a"])).toBe("a");
    expect(joinNeeds(["a", "b"])).toBe("a and b");
    expect(joinNeeds(["a", "b", "c"])).toBe("a, b, and c");
  });
});
