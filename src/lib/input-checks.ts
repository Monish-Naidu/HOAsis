import { money } from "@/lib/utils";

/**
 * Small checks that a form and its test share.
 *
 * A form should never refuse in silence or accept nonsense, so each rule
 * here answers with the one short line the screen shows beside the control
 * (null, or ok, when the input is fine). They are pure on purpose: the
 * screen calls them while rendering and the unit test calls them directly.
 */

/**
 * Dollars in the text a person typed, as integer cents. NaN when it is not a
 * plain amount: a third decimal ("285.555") and exponent notation ("12e3",
 * which a number input accepts) are refused, not rounded, so what is saved is
 * what was typed.
 */
export function dollarsToCents(raw: string): number {
  const text = raw.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  if (!/^-?(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 100);
}

export const WHOLE_CENTS_MESSAGE = "Enter dollars and cents, like 285.00";
export const FRACTION_CENTS_MESSAGE = "Use whole cents, like 12.50";

/**
 * Why text that is not a plain amount was refused: a third decimal gets its
 * own line, anything else (letters, "12e3") the general one. Dues, a hand
 * payment and the pay screen all say it this way.
 */
export function amountFormatMessage(raw: string): string {
  const text = raw.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  return /^-?\d*\.\d{3,}$/.test(text) ? FRACTION_CENTS_MESSAGE : WHOLE_CENTS_MESSAGE;
}

/**
 * A payment the board records by hand: above zero, in whole cents, and no
 * more than the home owes plus what an owner may overpay online
 * (`MAX_EXTRA_PAYMENT_CENTS`), so a slipped key cannot book nine figures.
 * `extraCents` is how far past the balance it goes, which stays as credit.
 * record_manual_payment (0102) refuses the same ceiling.
 */
export function checkManualPayment(raw: string, balanceCents: number): PayAmountCheck {
  if (!raw.trim()) return { ok: false, message: "Enter an amount above $0" };
  const cents = dollarsToCents(raw);
  if (!Number.isFinite(cents)) return { ok: false, message: amountFormatMessage(raw) };
  if (cents <= 0) return { ok: false, message: "Enter an amount above $0" };
  const owed = Math.max(balanceCents, 0);
  const ceiling = owed + MAX_EXTRA_PAYMENT_CENTS;
  if (cents > ceiling) {
    return { ok: false, message: `The most you can record for this home is ${money(ceiling)}.` };
  }
  return { ok: true, cents, extraCents: Math.max(cents - owed, 0) };
}

/** The line shown beside a hand payment that is more than the home owes, or null. */
export function homeOverpayNote(extraCents: number): string | null {
  return extraCents > 0
    ? `That is ${money(extraCents)} more than the home owes. The extra stays as credit.`
    : null;
}

/* Resident payment */

/** What a resident may pay above what they owe, left as credit. */
export const MAX_EXTRA_PAYMENT_CENTS = 1_000_000;

export type PayAmountCheck =
  | { ok: true; cents: number; extraCents: number }
  | { ok: false; message: string };

/**
 * The "Other amount" a resident typed on the pay screen.
 *
 * It has to be above zero, and a minus sign is refused rather than read as
 * a plus (the money formatter prints absolute values, so -5 once showed up
 * as "Pay $5.00"). More than the balance is allowed, as credit, up to a
 * ceiling so a slipped key cannot charge a card for five figures.
 */
export function checkPayAmount(raw: string, balanceCents: number): PayAmountCheck {
  const none = { ok: false, message: "Enter an amount above $0" } as const;
  const cents = dollarsToCents(raw);
  // A third decimal is a different problem from letters or zero, and says so.
  if (!Number.isFinite(cents) && raw.trim() && amountFormatMessage(raw) === FRACTION_CENTS_MESSAGE) {
    return { ok: false, message: FRACTION_CENTS_MESSAGE };
  }
  if (!Number.isFinite(cents) || cents <= 0) return none;
  const owed = Math.max(balanceCents, 0);
  const ceiling = owed + MAX_EXTRA_PAYMENT_CENTS;
  if (cents > ceiling) {
    return { ok: false, message: `The most you can pay at once is ${money(ceiling)}. Enter a smaller amount.` };
  }
  return { ok: true, cents, extraCents: Math.max(cents - owed, 0) };
}

/** The line shown when a payment is more than the balance, or null. */
export function overpayNote(extraCents: number): string | null {
  return extraCents > 0
    ? `That is ${money(extraCents)} more than you owe. The extra stays on your account as credit.`
    : null;
}

/* Phone */

export const PHONE_MESSAGE = "Enter a phone number, like (425) 555-0142.";

export type PhoneCheck = { ok: true; phone: string } | { ok: false; message: string };

/**
 * A phone number a person gives for their own record. Empty clears it.
 * Otherwise at least seven digits, written with only digits, spaces,
 * parentheses, plus, dash and dot, and optionally an extension ("x12",
 * "ext 12") at the end. The extension's digits do not count toward the seven.
 */
export function checkPhone(raw: string): PhoneCheck {
  const phone = raw.trim();
  if (!phone) return { ok: true, phone: "" };
  const match = /^([\d\s().+-]+?)(?:\s*(?:x|ext\.?)\s*\d+)?$/i.exec(phone);
  if (!match) return { ok: false, message: PHONE_MESSAGE };
  const digits = match[1].replace(/\D/g, "");
  if (digits.length < 7) return { ok: false, message: PHONE_MESSAGE };
  return { ok: true, phone };
}

/* Setup wizard */

/** The most one home pays in one period, in cents. */
export const MAX_DUES_CENTS = 100_000_00;
export const DUES_ZERO_MESSAGE = "Enter dues above $0";
export const DUES_HIGH_MESSAGE = "That looks too high. Dues are per home, per period.";

/** What is wrong with a dues amount in cents, or null. Zero is wrong; the field being empty is not asked here. */
export function duesProblem(cents: number | undefined): string | null {
  if (cents === undefined || !Number.isFinite(cents)) return null;
  if (cents <= 0) return DUES_ZERO_MESSAGE;
  if (cents > MAX_DUES_CENTS) return DUES_HIGH_MESSAGE;
  return null;
}

/** The same, for the text of a dues field, so "0" and "-4" are caught where "" is not. */
export function duesTextProblem(raw: string): string | null {
  if (!raw.trim()) return null;
  const cents = dollarsToCents(raw);
  // "abc", a third decimal and "12e3" are a format problem, said as one.
  return Number.isFinite(cents) ? duesProblem(cents) : amountFormatMessage(raw);
}

export const LATE_FEE_MIN_DAYS = 2;
export const LATE_FEE_MAX_DAYS = 365;

/**
 * The late fee's days. The collections ladder puts the formal notice on this
 * day and needs a reminder before it, so one day is too few
 * (`policyWithLateFee`).
 */
export function lateFeeDaysProblem(days: number | undefined): string | null {
  if (days !== undefined && Number.isInteger(days) && days >= LATE_FEE_MIN_DAYS && days <= LATE_FEE_MAX_DAYS) {
    return null;
  }
  return `Enter a number of days, ${LATE_FEE_MIN_DAYS} to ${LATE_FEE_MAX_DAYS}`;
}

export function lateFeeAmountProblem(cents: number | undefined): string | null {
  if (cents !== undefined && Number.isFinite(cents) && cents > 0) {
    return cents > MAX_DUES_CENTS ? DUES_HIGH_MESSAGE : null;
  }
  return "Enter a fee above $0, or choose no late fee";
}

export const EMAIL_MESSAGE = "Enter an email address, like name@example.com";

/** The most an email address may hold (254 characters, the SMTP limit). */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Whether the text has the shape of an email address: exactly one @,
 * something on both sides, and a dot after it with something around the dot.
 * Does not trim; callers trim first when they mean to.
 */
export function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

/** The founder's email, with the same shape check the account email change uses. */
export function emailProblem(raw: string): string | null {
  const email = raw.trim();
  return email && email.length <= MAX_EMAIL_LENGTH && isEmail(email) ? null : EMAIL_MESSAGE;
}

export const MAX_ASSOCIATION_NAME = 80;

export function associationNameProblem(raw: string): string | null {
  const name = raw.trim();
  if (!name) return null;
  return name.length > MAX_ASSOCIATION_NAME
    ? `Keep the name to ${MAX_ASSOCIATION_NAME} characters or fewer.`
    : null;
}

export const HOME_NUMBER_MESSAGE = "Enter your home number";

export const RANGE_END_MESSAGE = "Enter the last number in the range.";

/** A range with a first number and no last one has not been finished. */
export function rangeEndProblem(phase: { from: number; to: number }): string | null {
  return Number.isFinite(phase.to) && phase.to > 0 ? null : RANGE_END_MESSAGE;
}

/** An address as it is compared: case and repeated spaces do not make a different home. */
export function addressKey(address: string): string {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

export type PastedAddresses = { added: string[]; skipped: number };

/**
 * Sorts a pasted list into new addresses and ones already on the list.
 * `existing` is every address already entered, the founder's own included.
 * A repeat inside the paste counts as skipped too, so "3 Founder Way" and
 * "3 founder way" in one paste make one home. Blank lines are not counted.
 */
export function sortPastedAddresses(pasted: string, existing: string[]): PastedAddresses {
  const seen = new Set(existing.map(addressKey).filter(Boolean));
  const added: string[] = [];
  let skipped = 0;
  for (const line of pasted.split(/\n+/)) {
    const address = line.trim().replace(/\s+/g, " ");
    if (!address) continue;
    const key = addressKey(address);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    added.push(address);
  }
  return { added, skipped };
}

/** "Added 2. Skipped 1 already on the list." with the second sentence left off when nothing was skipped. */
export function pasteSummary({ added, skipped }: PastedAddresses): string {
  const first = `Added ${added.length}.`;
  return skipped > 0 ? `${first} Skipped ${skipped} already on the list.` : first;
}

/* Meetings */

export const TIME_MESSAGE = "Enter a time, like 7:00 PM.";

export type TimeCheck = { ok: true; time: string } | { ok: false; message: string };

/**
 * A meeting time as a person types it: "7:00 PM", "7 pm", "7:30pm" or
 * "19:00". It is stored the way every other time reads, "7:00 PM", so a
 * notice never says "at banana" and the calendar shows one style.
 */
export function checkMeetingTime(raw: string): TimeCheck {
  const text = raw.trim();
  const bad = { ok: false, message: TIME_MESSAGE } as const;
  const twelve = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i.exec(text);
  if (twelve) {
    const hour = Number(twelve[1]);
    const minute = Number(twelve[2] ?? "0");
    if (hour < 1 || hour > 12 || minute > 59) return bad;
    return { ok: true, time: `${hour}:${String(minute).padStart(2, "0")} ${twelve[3].toUpperCase()}M` };
  }
  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59) return bad;
    return { ok: true, time: `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}` };
  }
  return bad;
}

/* Ballots */

export const CLOSING_DATE_MESSAGE = "Pick a closing date after today.";

export function closingDateProblem(closesOn: string, today: string): string | null {
  return closesOn > today ? null : CLOSING_DATE_MESSAGE;
}
