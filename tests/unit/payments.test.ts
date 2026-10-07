import { describe, expect, it } from "vitest";
import {
  BRAND_LABEL,
  cheapestInstrument,
  cheapestRail,
  computePaymentCost,
  cvcLengthFor,
  describeInstrument,
  detectBrand,
  feeForAmount,
  formatCardNumber,
  isExpired,
  isValidRoutingNumber,
  linkBankAccount,
  manualPaymentLabel,
  RAIL_LABEL,
  ownerCostFor,
  passesLuhn,
  tokenizeCard,
  validateCard,
  type PaymentInstrument,
} from "@/lib/payments/instruments";
import { ValidationError } from "@/lib/core/errors";

const NOW = { year: 2026, month: 8 };
const CONTEXT = { homeId: "own-042", today: "2026-08-21", referenceDate: NOW };

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

describe("processor cost", () => {
  /** Isolates the processor's share from anything Your HOAsis adds. */
  const NO_PLATFORM_FEE = { flatCents: 0, paidBy: "owner" as const, waiveOnAch: false };

  it("charges ACH a percentage that stops at the cap", () => {
    // 0.8% of $285.00 is $2.28.
    expect(feeForAmount("ach", 28_500, NO_PLATFORM_FEE)).toBe(228);
    expect(feeForAmount("ach", 500_00, NO_PLATFORM_FEE)).toBe(400);
    // 0.8% of $1,000 would be $8; Stripe stops at $5.
    expect(feeForAmount("ach", 1_000_00, NO_PLATFORM_FEE)).toBe(500);
  });

  it("charges cards a percentage plus a flat cost", () => {
    // 2.9% of $285.00 is $8.265, which rounds to $8.27, plus $0.30.
    expect(feeForAmount("card", 28_500, NO_PLATFORM_FEE)).toBe(857);
  });

  it("prices Apple Pay the same as the card behind it", () => {
    expect(feeForAmount("apple-pay", 28_500, NO_PLATFORM_FEE)).toBe(
      feeForAmount("card", 28_500, NO_PLATFORM_FEE),
    );
  });

  it("returns whole cents, never a fraction", () => {
    for (const amount of [1, 99, 12_345, 999_99]) {
      expect(Number.isInteger(feeForAmount("card", amount, NO_PLATFORM_FEE))).toBe(true);
    }
  });

  it("picks the cheapest rail for the amount", () => {
    const instruments = [
      { kind: "card" } as PaymentInstrument,
      { kind: "ach" } as PaymentInstrument,
    ];
    expect(cheapestInstrument(instruments, 28_500, NO_PLATFORM_FEE)?.kind).toBe("ach");
  });
});

describe("display", () => {
  const card: PaymentInstrument = {
    id: "pm-1",
    homeId: "own-042",
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

describe("platform fee", () => {
  const AMOUNT = 285_00;
  const OWNER_PAYS = { flatCents: 150, paidBy: "owner" as const, waiveOnAch: false };
  const ASSOCIATION_PAYS = { flatCents: 150, paidBy: "association" as const, waiveOnAch: false };

  it("passes the processor's cost through untouched", () => {
    const ach = computePaymentCost("ach", AMOUNT, OWNER_PAYS);
    const card = computePaymentCost("card", AMOUNT, OWNER_PAYS);
    expect(ach.processorCents).toBe(228);
    // 2.9% of $285 is $8.265, rounding to $8.27, plus $0.30.
    expect(card.processorCents).toBe(857);
  });

  it("adds the fee on top when the owner carries it", () => {
    const cost = computePaymentCost("ach", AMOUNT, OWNER_PAYS);
    expect(cost.platformCents).toBe(150);
    expect(cost.residentPaysCents).toBe(286_50);
    // The processor still takes its cut out of the deposit either way.
    expect(cost.associationNetsCents).toBe(282_72);
  });

  it("takes it out of the deposit when the association carries it", () => {
    const cost = computePaymentCost("ach", AMOUNT, ASSOCIATION_PAYS);
    expect(cost.residentPaysCents).toBe(AMOUNT);
    expect(cost.associationNetsCents).toBe(281_22);
  });

  it("charges the same flat fee on every rail, unlike a percentage", () => {
    const ach = computePaymentCost("ach", AMOUNT, OWNER_PAYS);
    const card = computePaymentCost("card", AMOUNT, OWNER_PAYS);
    expect(ach.platformCents).toBe(card.platformCents);
  });

  it("does not scale the fee with the payment, which a percentage would", () => {
    const small = computePaymentCost("ach", 50_00, OWNER_PAYS);
    const large = computePaymentCost("ach", 5_000_00, OWNER_PAYS);
    expect(small.platformCents).toBe(large.platformCents);
  });

  it("waives it on ACH when the board wants volume on the cheap rail", () => {
    const policy = { ...OWNER_PAYS, waiveOnAch: true };
    expect(computePaymentCost("ach", AMOUNT, policy).platformCents).toBe(0);
    expect(computePaymentCost("card", AMOUNT, policy).platformCents).toBe(150);
  });

  it("still names ACH the cheapest rail with the fee applied", () => {
    const instruments = [
      { kind: "card" } as PaymentInstrument,
      { kind: "ach" } as PaymentInstrument,
    ];
    expect(cheapestInstrument(instruments, AMOUNT, OWNER_PAYS)?.kind).toBe("ach");
  });

  it("credits the association, not the owner, when a flat fee hits every rail", () => {
    // Willow Creek Estates' policy: $1.50, owner paid, not waived on ACH. Both rails
    // cost the owner the same, so a badge claiming the owner saves would
    // contradict the identical totals printed beside it. The association does
    // still save the card processing, so the rail is worth surfacing.
    const flat = { flatCents: 150, paidBy: "owner", waiveOnAch: false } as const;
    const instruments = [
      { kind: "ach" } as PaymentInstrument,
      { kind: "card" } as PaymentInstrument,
    ];
    const rail = cheapestRail(instruments, AMOUNT, flat);
    expect(rail?.instrument.kind).toBe("ach");
    expect(rail?.saves).toBe("association");
  });

  it("credits the owner when the fee is waived on the cheap rail", () => {
    const waived = { flatCents: 100, paidBy: "owner", waiveOnAch: true } as const;
    const instruments = [
      { kind: "ach" } as PaymentInstrument,
      { kind: "card" } as PaymentInstrument,
    ];
    const rail = cheapestRail(instruments, AMOUNT, waived);
    expect(rail?.saves).toBe("owner");
    expect(rail?.savingCents).toBe(100);
  });

  it("names nothing cheapest when there is only one method", () => {
    expect(cheapestInstrument([{ kind: "ach" } as PaymentInstrument], AMOUNT, OWNER_PAYS)).toBeUndefined();
  });

  it("undercuts the incumbent where the claim is actually true", () => {
    // PayHOA: $2.45 flat ACH, and 3.5% + $0.50 on cards. On cards we win
    // all-in. On ACH the honest 0.8% processor cost means the community's
    // total (378¢ at $285) exceeds their flat 245¢; what undercuts them is
    // the fee the owner sees when both products pass fees through. The
    // all-in ACH comparison flips only below ~$119 of dues, so no test
    // asserts it.
    const theirAch = 245;
    const theirCard = Math.round((AMOUNT * 3.5) / 100) + 50;

    expect(ownerCostFor("ach", AMOUNT, OWNER_PAYS)).toBeLessThan(theirAch);
    expect(feeForAmount("card", AMOUNT, OWNER_PAYS)).toBeLessThan(theirCard);
  });

  it("charges nothing when the board sets the fee to zero", () => {
    const free = { flatCents: 0, paidBy: "owner" as const, waiveOnAch: false };
    const cost = computePaymentCost("ach", AMOUNT, free);
    expect(cost.platformCents).toBe(0);
    expect(cost.residentPaysCents).toBe(AMOUNT);
  });

  it("keeps every figure in whole cents", () => {
    for (const amount of [1, 99, 12_345, 999_99]) {
      const cost = computePaymentCost("card", amount, OWNER_PAYS);
      for (const value of Object.values(cost)) expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("a payment the board enters by hand", () => {
  it("reads the way the database writes it: Check payment #1042, Cash payment, Payment", () => {
    expect(manualPaymentLabel("check", "1042")).toBe("Check payment #1042");
    expect(manualPaymentLabel("check", " 1042 ")).toBe("Check payment #1042");
    expect(manualPaymentLabel("cash")).toBe("Cash payment");
    expect(manualPaymentLabel("cash", "")).toBe("Cash payment");
    expect(manualPaymentLabel("other", "wire 9")).toBe("Payment #wire 9");
  });

  it("has a word for every rail", () => {
    expect(RAIL_LABEL.check).toBe("Check");
    expect(RAIL_LABEL.cash).toBe("Cash");
  });
});
