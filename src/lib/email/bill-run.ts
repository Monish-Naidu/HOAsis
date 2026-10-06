/**
 * Which associations the daily bill email is due for.
 *
 * Pure, so the rules can be tested without a database or Resend. The route
 * (src/app/api/email/bills/route.ts) reads the rows and asks these.
 *
 * The label the opening balance import gives its one line per home. A
 * balance brought forward is a number carried over, not a bill that posted,
 * so it never triggers an email.
 */
export const BROUGHT_FORWARD_LABEL = "Balance brought forward";

export interface PostedCharge {
  category?: string | null;
  kind: string;
  label: string;
  due_on: string;
  /** A full timestamp, as the database writes it. */
  created_at: string;
}

/** Is this row a dues bill that posted, as opposed to a fee, a payment or a carried balance? */
export function isPostedDuesBill(row: PostedCharge): boolean {
  return row.category === "dues" && row.kind === "charge" && row.label !== BROUGHT_FORWARD_LABEL;
}

/**
 * The due date to put on today's email, or null when no dues bill posted
 * today. `today` is a YYYY-MM-DD in UTC, the same day the other crons use,
 * and a row posted today is one whose created_at starts with it.
 */
export function billPostedToday(rows: PostedCharge[], today: string): { dueOn: string } | null {
  const dueDates = rows
    .filter((row) => isPostedDuesBill(row) && row.created_at.slice(0, 10) === today)
    .map((row) => row.due_on);
  if (dueDates.length === 0) return null;
  // One run posts one period, so these agree. If two ever differ, the later
  // one is the bill the owner is about to be asked for.
  return { dueOn: dueDates.reduce((a, b) => (a > b ? a : b)) };
}

/**
 * Should the job email this association today? Yes when the board has not
 * turned it off and a dues bill posted today. Anything that is not an
 * explicit `false` counts as on, matching the column's default.
 */
export function dueABillEmail(
  association: { bills_by_email?: boolean | null },
  rows: PostedCharge[],
  today: string,
): { dueOn: string } | null {
  if (association.bills_by_email === false) return null;
  return billPostedToday(rows, today);
}
