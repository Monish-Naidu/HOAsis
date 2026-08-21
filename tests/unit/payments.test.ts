import { describe, expect, it } from "vitest";
import {
  BRAND_LABEL,
  cheapestInstrument,
  cvcLengthFor,
  describeInstrument,
  detectBrand,
  feeForAmount,
  formatCardNumber,
  isExpired,
  isValidRoutingNumber,
  linkBankAccount,
  passesLuhn,
  tokenizeCard,
  validateCard,
  type PaymentInstrument,
} from "@/lib/payments/instruments";
import { ValidationError } from "@/lib/core/errors";

const NOW = { year: 2026, month: 8 };
const CONTEXT = { ownerId: "own-042", today: "2026-08-21", referenceDate: NOW };

/** Publicly documented test numbers. None of these is a real card. */
const TEST_CARDS = {
  visa: "4242424242424242",
  mastercard: "5555555555554444",
  amex: "378282246310005",
  discover: "6011111111111117",
};

describe("Luhn", () => {
  it("accepts every published test number", () => {
    for (const number of Object.values(TEST_CARDS)) expect(passesLuhn(number)).toBe(true);
  });

  it("rejects a single transposed digit, which is the common typo", () => {
    expect(passesLuhn("4242424242424243")).toBe(false);
  });

  it("rejects anything that is not digits", () => {
    expect(passesLuhn("4242-4242-4242-4242")).toBe(false);
    expect(passesLuhn("")).toBe(false);
  });
});

describe("brand detection", () => {
  it("reads the brand from the issuer prefix", () => {
    expect(detectBrand(TEST_CARDS.visa)).toBe("visa");
    expect(detectBrand(TEST_CARDS.mastercard)).toBe("mastercard");
    expect(detectBrand(TEST_CARDS.amex)).toBe("amex");
    expect(detectBrand(TEST_CARDS.discover)).toBe("discover");
    expect(detectBrand("9999999999999999")).toBe("unknown");
  });

  it("recognises the 2-series Mastercard range", () => {
    expect(detectBrand("2221000000000009")).toBe("mastercard");
  });

  it("knows Amex uses a four digit security code", () => {
    expect(cvcLengthFor("amex")).toBe(4);
    expect(cvcLengthFor("visa")).toBe(3);
  });

  it("groups digits the way the brand prints them", () => {
    expect(formatCardNumber(TEST_CARDS.visa)).toBe("4242 4242 4242 4242");
    expect(formatCardNumber(TEST_CARDS.amex)).toBe("3782 822463 10005");
  });
});

describe("card validation", () => {
  const valid = {
    number: TEST_CARDS.visa,
    expMonth: 12,
    expYear: 2028,
    cvc: "123",
    postalCode: "98036",
  };

  it("passes a well formed card", () => {
    expect(validateCard(valid, NOW)).toEqual([]);
  });

  it("reports every problem at once, so the form marks all of them in one pass", () => {
    const problems = validateCard(
      { number: "4242424242424243", expMonth: 13, cvc: "1", expYear: 2028, postalCode: "abc" },
      NOW,
    );
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects a card that expired last month", () => {
    expect(validateCard({ ...valid, expMonth: 7, expYear: 2026 }, NOW)).toContain(
      "That card has expired.",
    );
  });

  it("accepts a card expiring this month, because it is good until the last day", () => {
    expect(validateCard({ ...valid, expMonth: 8, expYear: 2026 }, NOW)).toEqual([]);
  });

  it("enforces the brand's digit count", () => {
    const problems = validateCard({ ...valid, number: "424242424242" }, NOW);
    expect(problems.some((p) => p.includes("digits"))).toBe(true);
  });
});

describe("tokenizeCard", () => {
  it("keeps only what is safe to keep", () => {
    const instrument = tokenizeCard(
      { number: TEST_CARDS.visa, expMonth: 12, expYear: 2028, cvc: "123", postalCode: "98036" },
      CONTEXT,
    );
    expect(instrument.mask).toBe("4242");
    expect(instrument.brand).toBe("visa");
    expect(instrument.label).toBe(BRAND_LABEL.visa);
  });

  it("never returns the number, in any field", () => {
    const instrument = tokenizeCard(
      { number: TEST_CARDS.visa, expMonth: 12, expYear: 2028, cvc: "123", postalCode: "98036" },
      CONTEXT,
    );
    const serialized = JSON.stringify(instrument);
    expect(serialized).not.toContain(TEST_CARDS.visa);
    // The first twelve digits must be gone entirely, not merely reformatted.
    expect(serialized).not.toContain(TEST_CARDS.visa.slice(0, 12));
    expect(serialized).not.toContain("123"); // the security code
  });

  it("refuses to tokenize a card that failed validation", () => {
    expect(() =>
      tokenizeCard(
        { number: "4242424242424243", expMonth: 12, expYear: 2028, cvc: "123", postalCode: "98036" },
        CONTEXT,
      ),
    ).toThrow(ValidationError);
  });
});

describe("bank accounts", () => {
  it("validates the ABA checksum", () => {
    // Real, published routing numbers.
    expect(isValidRoutingNumber("021000021")).toBe(true); // JPMorgan Chase
    expect(isValidRoutingNumber("125000024")).toBe(true); // Bank of America, WA
    expect(isValidRoutingNumber("021000022")).toBe(false);
    expect(isValidRoutingNumber("12345")).toBe(false);
  });

  it("stores only what the aggregator hands back", () => {
    const instrument = linkBankAccount(
      { institution: "BECU", accountType: "checking", mask: "2288" },
      CONTEXT,
    );
    expect(instrument.kind).toBe("ach");
    expect(instrument.mask).toBe("2288");
    expect(instrument.label).toBe("BECU checking");
    expect(JSON.stringify(instrument)).not.toMatch(/\d{9,}/);
  });
});

describe("fees", () => {
  it("charges ACH a flat cost with no percentage", () => {
    expect(feeForAmount("ach", 28_500)).toBe(35);
    expect(feeForAmount("ach", 500_00)).toBe(35);
  });

  it("charges cards a percentage plus a flat cost", () => {
    // 2.9% of $285.00 is $8.265, which rounds to $8.27, plus $0.30.
    expect(feeForAmount("card", 28_500)).toBe(857);
  });

  it("prices Apple Pay the same as the card behind it", () => {
    expect(feeForAmount("apple-pay", 28_500)).toBe(feeForAmount("card", 28_500));
  });

  it("returns whole cents, never a fraction", () => {
    for (const amount of [1, 99, 12_345, 999_99]) {
      expect(Number.isInteger(feeForAmount("card", amount))).toBe(true);
    }
  });

  it("picks the cheapest rail for the amount", () => {
    const instruments = [
      { kind: "card" } as PaymentInstrument,
      { kind: "ach" } as PaymentInstrument,
    ];
    expect(cheapestInstrument(instruments, 28_500)?.kind).toBe("ach");
  });
});

describe("display", () => {
  const card: PaymentInstrument = {
    id: "pm-1",
    ownerId: "own-042",
    kind: "card",
    label: "Visa",
    mask: "4242",
    isDefault: false,
    addedDate: "2026-08-21",
    brand: "visa",
    expMonth: 3,
    expYear: 2028,
    token: "tok_card",
  };

  it("shows the expiry with a padded month", () => {
    expect(describeInstrument(card)).toBe("Visa ••4242, expires 03/28");
  });

  it("flags a card whose expiry month has passed", () => {
    expect(isExpired(card, { year: 2026, month: 8 })).toBe(false);
    expect(isExpired({ ...card, expYear: 2026, expMonth: 7 }, { year: 2026, month: 8 })).toBe(true);
  });

  it("never calls a bank account expired", () => {
    expect(isExpired({ ...card, kind: "ach" }, { year: 2030, month: 1 })).toBe(false);
  });
});
