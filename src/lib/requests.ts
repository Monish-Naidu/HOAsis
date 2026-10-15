import { pluralize } from "@/lib/utils";

/**
 * What the board is waiting on, worded once.
 *
 * "Needs you today" on the dashboard and the bell in the header list the same
 * items, and they used to name them two ways ("invoice awaiting approval" and
 * "vendor payment to approve"). A thing with two names reads as two things, so
 * both read the line from here.
 */

export function vendorPaymentsToApprove(count: number): string {
  return `${pluralize(count, "vendor payment")} to approve`;
}

export function transactionsToConfirm(count: number): string {
  return `${pluralize(count, "transaction")} to confirm`;
}
