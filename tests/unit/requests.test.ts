import { describe, expect, it } from "vitest";
import { transactionsToConfirm, vendorPaymentsToApprove } from "@/lib/requests";

describe("what the board is waiting on", () => {
  it("words a vendor payment waiting for approval one way, singular and plural", () => {
    expect(vendorPaymentsToApprove(1)).toBe("1 vendor payment to approve");
    expect(vendorPaymentsToApprove(3)).toBe("3 vendor payments to approve");
  });

  it("words a transaction waiting to be confirmed one way", () => {
    expect(transactionsToConfirm(1)).toBe("1 transaction to confirm");
    expect(transactionsToConfirm(2)).toBe("2 transactions to confirm");
  });
});
