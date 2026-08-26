import { describe, expect, it } from "vitest";
import {
  INSURED_LIMIT_CENTS,
  canReceivePayments,
  connectLinkedAccount,
  connectManualAccount,
} from "@/lib/payments/bank-accounts";
import { ValidationError } from "@/lib/core/errors";

const TODAY = "2026-08-26";
const BECU = { institution: "BECU", routingNumber: "325081403" };

describe("connecting an account from typed details", () => {
  it("keeps a mask and forgets everything that could move money", () => {
    const account = connectManualAccount(
      { ...BECU, accountNumber: "1234567890", kind: "operating" },
      TODAY,
    );
    expect(account.mask).toBe("7890");
    // A full account or routing number stored anywhere is a breach waiting to
    // be reported, and the mask is all any screen needs.
    const serialized = JSON.stringify(account);
    expect(serialized).not.toContain("1234567890");
    expect(serialized).not.toContain("325081403");
  });

  it("refuses a routing number that fails the checksum", () => {
    // Every ABA routing number carries a check digit. Catching a typo here
    // beats a failed transfer and a support conversation a week later.
    expect(() =>
      connectManualAccount(
        { ...BECU, routingNumber: "123456789", accountNumber: "1234567890", kind: "operating" },
        TODAY,
      ),
    ).toThrow(ValidationError);
  });

  it("refuses an account number of an impossible length", () => {
    for (const accountNumber of ["12", "123456789012345678"]) {
      expect(() =>
        connectManualAccount({ ...BECU, accountNumber, kind: "operating" }, TODAY),
      ).toThrow(ValidationError);
    }
  });

  it("refuses a bank with no name", () => {
    expect(() =>
      connectManualAccount(
        { institution: "   ", routingNumber: "325081403", accountNumber: "1234567890", kind: "operating" },
        TODAY,
      ),
    ).toThrow(ValidationError);
  });

  it("ignores the punctuation people paste in", () => {
    const account = connectManualAccount(
      { institution: "BECU", routingNumber: "325-081-403", accountNumber: "1234 5678 90", kind: "operating" },
      TODAY,
    );
    expect(account.mask).toBe("7890");
  });

  it("carries the deposit insurance ceiling", () => {
    const account = connectManualAccount(
      { ...BECU, accountNumber: "1234567890", kind: "reserve" },
      TODAY,
    );
    // The limit is per depositor per bank, and a funded association is
    // routinely over it, so the figure travels with the account.
    expect(account.insuredLimitCents).toBe(INSURED_LIMIT_CENTS);
  });
});

describe("whether dues can land anywhere", () => {
  const operating = connectManualAccount(
    { ...BECU, accountNumber: "4444555566", kind: "operating" },
    TODAY,
  );
  const reserve = connectManualAccount(
    { ...BECU, accountNumber: "1111222233", kind: "reserve" },
    TODAY,
  );

  it("needs an operating account, not just any account", () => {
    expect(canReceivePayments([])).toBe(false);
    // Reserve cash is not where dues land.
    expect(canReceivePayments([reserve])).toBe(false);
    expect(canReceivePayments([reserve, operating])).toBe(true);
  });

  it("does not count an account the bank has disconnected", () => {
    expect(canReceivePayments([{ ...operating, status: "disconnected" }])).toBe(false);
  });
});

describe("connecting through the institution", () => {
  it("takes the mask the bank gave, with no number typed here at all", () => {
    const account = connectLinkedAccount(
      { institution: "BECU", mask: "4471", kind: "operating" },
      TODAY,
    );
    expect(account.mask).toBe("4471");
    expect(canReceivePayments([account])).toBe(true);
  });
});
