import type { AccountKind, BankAccount, Cents, ISODate } from "@/lib/types";
import { ValidationError } from "@/lib/core/errors";
import { isValidRoutingNumber } from "./instruments";

/**
 * The association's own bank accounts.
 *
 * Distinct from `instruments.ts`, which is how a resident *sends* money. This
 * is where the association *receives* it, and it is the one thing an HOA
 * genuinely cannot operate without: dues have to land somewhere held in the
 * association's name rather than in a board member's personal account.
 *
 * Two rules carry over from the card handling next door. The account number is
 * validated and discarded inside this module and never reaches state, and the
 * routing number is checked against the real ABA checksum so a typo is caught
 * here rather than by a failed deposit three days later.
 */

/** What a board tells us when they connect an account by hand. */
export interface ManualAccountInput {
  institution: string;
  routingNumber: string;
  accountNumber: string;
  kind: AccountKind;
}

/** What comes back from a bank handshake, where we never see the number. */
export interface LinkedAccountInput {
  institution: string;
  mask: string;
  kind: AccountKind;
}

/** Standard FDIC and NCUA coverage per depositor, per institution. */
export const INSURED_LIMIT_CENTS: Cents = 250_000_00;

const KIND_LABEL: Record<AccountKind, string> = {
  operating: "Operating",
  reserve: "Reserve",
  cd: "Certificate",
};

function base(
  institution: string,
  mask: string,
  kind: AccountKind,
  today: ISODate,
): BankAccount {
  return {
    id: `bank-${kind}-${mask}`,
    name: `${KIND_LABEL[kind]} account`,
    institution,
    mask,
    kind,
    // A newly connected account starts at whatever the board tells us it
    // holds, which is nothing until they say otherwise. Inventing an opening
    // balance would put a number in the books that no statement backs.
    balanceCents: 0,
    syncedMinutesAgo: 0,
    status: "live",
    reconciledThroughDate: today,
    unreconciledCount: 0,
    apy: 0,
    interestYtdCents: 0,
    insuredLimitCents: INSURED_LIMIT_CENTS,
  };
}

/**
 * Connects an account from typed details.
 *
 * The account number is used to derive a mask and is then gone. Nothing that
 * could move money out of the account is kept.
 */
export function connectManualAccount(
  input: ManualAccountInput,
  today: ISODate,
): BankAccount {
  const institution = input.institution.trim();
  if (!institution) {
    throw new ValidationError("Enter the name of the bank or credit union");
  }

  const routing = input.routingNumber.replace(/\D/g, "");
  if (!isValidRoutingNumber(routing)) {
    throw new ValidationError("That routing number is not valid", {
      length: routing.length,
    });
  }

  const account = input.accountNumber.replace(/\D/g, "");
  if (account.length < 4 || account.length > 17) {
    throw new ValidationError("An account number is between 4 and 17 digits", {
      length: account.length,
    });
  }

  // The only part of the number that survives this function.
  const mask = account.slice(-4);
  return base(institution, mask, input.kind, today);
}

/** Connects an account handed over by the bank, where no number was typed here. */
export function connectLinkedAccount(
  input: LinkedAccountInput,
  today: ISODate,
): BankAccount {
  return base(input.institution, input.mask, input.kind, today);
}

/** True when this association can receive dues at all. */
export function canReceivePayments(accounts: BankAccount[]): boolean {
  return accounts.some((a) => a.kind === "operating" && a.status !== "disconnected");
}
