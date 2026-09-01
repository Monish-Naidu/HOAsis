import { ValidationError } from "@/lib/core/errors";
import type { Cents } from "@/lib/types";

/**
 * Payment instruments.
 *
 * The governing rule in this file: a full card number ("PAN") is accepted,
 * checked, and thrown away in the same function call. Nothing downstream ever
 * receives it, so it cannot reach React state, a store, localStorage, or a log.
 * `tokenize` is the only door, and it returns a descriptor, never the digits.
 *
 * In production that check does not happen here at all. The number goes
 * straight from a Stripe Elements iframe to Stripe, and the app only ever sees
 * the token. This module exists so the prototype has the same shape, and so
 * the swap is a change of one function rather than a change of the data model.
 *
 * Instruments are plain serializable records rather than a class hierarchy on
 * purpose: they round trip through JSON in localStorage, and methods do not
 * survive that. Behavior that differs per kind lives in the strategy table
 * below instead.
 */

export type InstrumentKind = "ach" | "card" | "apple-pay";

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

export interface PaymentInstrument {
  id: string;
  ownerId: string;
  kind: InstrumentKind;
  /** What the resident sees. "BECU checking", "Visa". */
  label: string;
  /** Last four digits. The most identifying thing we are allowed to keep. */
  mask: string;
  isDefault: boolean;
  addedDate: string;
  /** Card only. */
  brand?: CardBrand;
  expMonth?: number;
  expYear?: number;
  /** Bank only. */
  institution?: string;
  accountType?: "checking" | "savings";
  /** Stands in for the processor token. Never a card number. */
  token: string;
}

/* -------------------------------------------------------------------------- */
/* Card validation                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The Luhn checksum. Catches the overwhelming majority of typos before a
 * request is ever made, which is the whole reason card forms feel responsive.
 */
export function passesLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = digits.charCodeAt(i) - 48;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

const BRAND_RULES: { brand: CardBrand; test: RegExp; lengths: number[]; cvcLength: number }[] = [
  { brand: "visa", test: /^4/, lengths: [13, 16, 19], cvcLength: 3 },
  { brand: "mastercard", test: /^(5[1-5]|2[2-7])/, lengths: [16], cvcLength: 3 },
  { brand: "amex", test: /^3[47]/, lengths: [15], cvcLength: 4 },
  { brand: "discover", test: /^(6011|64[4-9]|65)/, lengths: [16, 19], cvcLength: 3 },
];

export function detectBrand(digits: string): CardBrand {
  return BRAND_RULES.find((rule) => rule.test.test(digits))?.brand ?? "unknown";
}

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  unknown: "Card",
};

/** How many CVC digits this brand uses. Amex is the odd one at four. */
export function cvcLengthFor(brand: CardBrand): number {
  return BRAND_RULES.find((rule) => rule.brand === brand)?.cvcLength ?? 3;
}

/** Groups digits the way the brand prints them, so the field reads naturally. */
export function formatCardNumber(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 19);
  const groups = detectBrand(digits) === "amex" ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const parts: string[] = [];
  let index = 0;
  for (const size of groups) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  return parts.join(" ");
}

export interface CardInput {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  postalCode: string;
}

/**
 * Validates a card and returns every problem at once.
 *
 * Returning the whole list rather than the first failure means the form can
 * mark three fields in one pass instead of making someone submit three times.
 * `referenceDate` is injected so expiry tests do not depend on the wall clock.
 */
export function validateCard(
  input: CardInput,
  referenceDate: { year: number; month: number },
): string[] {
  const problems: string[] = [];
  const digits = input.number.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const rule = BRAND_RULES.find((r) => r.brand === brand);

  if (digits.length === 0) problems.push("Enter a card number.");
  else if (rule && !rule.lengths.includes(digits.length))
    problems.push(`A ${BRAND_LABEL[brand]} number has ${rule.lengths.join(" or ")} digits.`);
  else if (!passesLuhn(digits)) problems.push("That card number is not valid.");

  if (input.expMonth < 1 || input.expMonth > 12) problems.push("Expiry month must be 1 to 12.");
  else if (
    input.expYear < referenceDate.year ||
    (input.expYear === referenceDate.year && input.expMonth < referenceDate.month)
  )
    problems.push("That card has expired.");

  if (input.cvc.length !== cvcLengthFor(brand))
    problems.push(`The security code is ${cvcLengthFor(brand)} digits for ${BRAND_LABEL[brand]}.`);

  if (!/^\d{5}(-\d{4})?$/.test(input.postalCode)) problems.push("Enter a 5 digit ZIP code.");

  return problems;
}

/**
 * Turns a card into something safe to keep.
 *
 * Takes the number, validates it, derives brand and last four, and returns.
 * The digits are never assigned to anything that outlives this call. Callers
 * cannot get the number back, which is the point.
 */
export function tokenizeCard(
  input: CardInput,
  context: { ownerId: string; today: string; referenceDate: { year: number; month: number } },
): Omit<PaymentInstrument, "id" | "isDefault"> {
  const problems = validateCard(input, context.referenceDate);
  if (problems.length > 0) {
    throw new ValidationError("card details were rejected", { problems: problems.join(" ") });
  }
  const digits = input.number.replace(/\D/g, "");
  const brand = detectBrand(digits);
  return {
    ownerId: context.ownerId,
    kind: "card",
    label: BRAND_LABEL[brand],
    mask: digits.slice(-4),
    brand,
    expMonth: input.expMonth,
    expYear: input.expYear,
    addedDate: context.today,
    // A stand in for the processor token. Deliberately not derived from the
    // number, so nothing about the card can be recovered from it.
    token: `tok_card_${brand}_${context.today.replace(/-/g, "")}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Bank accounts                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The ABA routing number checksum. Nine digits, weighted 3-7-1 repeating.
 * Real algorithm, and the reason a mistyped routing number is caught before
 * an ACH file is ever built.
 */
export function isValidRoutingNumber(routing: string): boolean {
  const digits = routing.replace(/\D/g, "");
  if (digits.length !== 9) return false;
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const sum = digits
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  return sum % 10 === 0;
}

export interface LinkedBankAccount {
  institution: string;
  accountType: "checking" | "savings";
  mask: string;
}

/**
 * Completes a bank link.
 *
 * Shaped after Plaid Link on purpose: the resident authenticates with their
 * bank, and what comes back is an institution, an account type, a mask, and a
 * token. No routing or account number is ever typed into this app, which is
 * both safer and what an aggregator actually gives you.
 */
export function linkBankAccount(
  account: LinkedBankAccount,
  context: { ownerId: string; today: string },
): Omit<PaymentInstrument, "id" | "isDefault"> {
  return {
    ownerId: context.ownerId,
    kind: "ach",
    label: `${account.institution} ${account.accountType}`,
    mask: account.mask,
    institution: account.institution,
    accountType: account.accountType,
    addedDate: context.today,
    token: `tok_ach_${context.today.replace(/-/g, "")}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Fees                                                                        */
/* -------------------------------------------------------------------------- */

export interface FeeSchedule {
  /** What the processor charges. Passed through unchanged. */
  processorPercent: number;
  processorFlatCents: Cents;
  settlement: string;
}

/**
 * What each rail costs to run.
 *
 * These are the processor's numbers, not ours. They are kept separate from the
 * platform fee below so both can be shown as separate lines: a resident who can
 * see which part is the card network and which part is us has no reason to
 * suspect the difference.
 */
export const FEE_SCHEDULE: Record<InstrumentKind, FeeSchedule> = {
  ach: { processorPercent: 0, processorFlatCents: 35, settlement: "1 to 2 business days" },
  card: { processorPercent: 2.9, processorFlatCents: 30, settlement: "Same day" },
  "apple-pay": { processorPercent: 2.9, processorFlatCents: 30, settlement: "Same day" },
};

export interface PlatformFeePolicy {
  /** Flat fee per payment, in cents. Flat rather than a percentage on purpose. */
  flatCents: Cents;
  /** Who the flat fee lands on. */
  paidBy: "owner" | "association";
  /** Boards can waive it on the cheap rail to push volume there. */
  waiveOnAch: boolean;
}

export const DEFAULT_FEE_POLICY: PlatformFeePolicy = {
  flatCents: 150,
  paidBy: "owner",
  waiveOnAch: false,
};

export interface PaymentCost {
  amountCents: Cents;
  /** What the processor takes. Never ours. */
  processorCents: Cents;
  /** What ExpressHOA takes. */
  platformCents: Cents;
  /** What the resident is billed in total. */
  residentPaysCents: Cents;
  /** What the association nets after everything. */
  associationNetsCents: Cents;
}

/**
 * Splits a payment into who gets what.
 *
 * The processor's cut always comes out of the association's deposit, because
 * that is how settlement actually works. The platform fee is the only part
 * that moves: charge it to the owner and it is added on top; charge it to the
 * association and it comes out of the same deposit.
 *
 * Returning all four figures rather than one total is deliberate. A screen that
 * only knows the total cannot itemize, and an unexplained gap between what an
 * owner pays and what the association receives is the exact thing boards write
 * angry reviews about.
 */
export function computePaymentCost(
  kind: InstrumentKind,
  amountCents: Cents,
  policy: PlatformFeePolicy = DEFAULT_FEE_POLICY,
): PaymentCost {
  const schedule = FEE_SCHEDULE[kind];
  const processorCents =
    Math.round((amountCents * schedule.processorPercent) / 100) + schedule.processorFlatCents;

  const waived = policy.waiveOnAch && kind === "ach";
  const platformCents = waived ? 0 : policy.flatCents;

  return {
    amountCents,
    processorCents,
    platformCents,
    residentPaysCents: policy.paidBy === "owner" ? amountCents + platformCents : amountCents,
    associationNetsCents:
      amountCents - processorCents - (policy.paidBy === "association" ? platformCents : 0),
  };
}

/** Total cost of moving the money, whoever ends up carrying it. */
export function feeForAmount(
  kind: InstrumentKind,
  amountCents: Cents,
  policy: PlatformFeePolicy = DEFAULT_FEE_POLICY,
): Cents {
  const cost = computePaymentCost(kind, amountCents, policy);
  return cost.processorCents + cost.platformCents;
}

/**
 * What the owner pays out of pocket on top of the assessment.
 *
 * Distinct from the total cost of moving the money, because the association
 * absorbs the processor's cut. This is the number the pay screen prints.
 */
export function ownerCostFor(
  kind: InstrumentKind,
  amountCents: Cents,
  policy: PlatformFeePolicy = DEFAULT_FEE_POLICY,
): Cents {
  const cost = computePaymentCost(kind, amountCents, policy);
  return cost.residentPaysCents - amountCents;
}

/** Who is better off when a cheaper rail is used. */
export type Beneficiary = "owner" | "association";

export interface CheapestRail {
  instrument: PaymentInstrument;
  /**
   * Whose money this saves. Under a flat fee charged on every rail the owner
   * pays the same either way and the saving lands entirely on the association,
   * so the screen has to say so rather than claim the owner is saving.
   */
  saves: Beneficiary;
  savingCents: Cents;
}

/**
 * The method that costs strictly less, and who that helps.
 *
 * Undefined when nothing wins outright. Ranking is by what the owner pays
 * first, since that is what the screen shows them, and falls back to total
 * cost so a rail that saves the association money is still surfaced.
 */
export function cheapestRail(
  instruments: PaymentInstrument[],
  amountCents: Cents,
  policy: PlatformFeePolicy = DEFAULT_FEE_POLICY,
): CheapestRail | undefined {
  if (instruments.length < 2) return undefined;

  const rank = (measure: (i: PaymentInstrument) => Cents, saves: Beneficiary) => {
    const sorted = [...instruments].sort((a, b) => measure(a) - measure(b));
    const best = measure(sorted[0]);
    const runnerUp = measure(sorted[1]);
    return best < runnerUp
      ? { instrument: sorted[0], saves, savingCents: runnerUp - best }
      : undefined;
  };

  return (
    rank((i) => ownerCostFor(i.kind, amountCents, policy), "owner") ??
    rank((i) => feeForAmount(i.kind, amountCents, policy), "association")
  );
}

/** The instrument alone, for callers that do not care who benefits. */
export function cheapestInstrument(
  instruments: PaymentInstrument[],
  amountCents: Cents,
  policy: PlatformFeePolicy = DEFAULT_FEE_POLICY,
): PaymentInstrument | undefined {
  return cheapestRail(instruments, amountCents, policy)?.instrument;
}

export function describeInstrument(instrument: PaymentInstrument): string {
  if (instrument.kind === "card" && instrument.expMonth && instrument.expYear) {
    const month = String(instrument.expMonth).padStart(2, "0");
    return `${instrument.label} ••${instrument.mask}, expires ${month}/${String(instrument.expYear).slice(-2)}`;
  }
  return `${instrument.label} ••${instrument.mask}`;
}

/** True once the card is past the last day of its expiry month. */
export function isExpired(
  instrument: PaymentInstrument,
  reference: { year: number; month: number },
): boolean {
  if (instrument.kind !== "card" || !instrument.expMonth || !instrument.expYear) return false;
  return (
    instrument.expYear < reference.year ||
    (instrument.expYear === reference.year && instrument.expMonth < reference.month)
  );
}
