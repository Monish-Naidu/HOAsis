/**
 * The durable record of one "add the card" operation (0126), as the routes
 * read it. The row is written before Stripe is called and carries the exact
 * parameters and idempotency keys a retry must reuse, so a second officer, a
 * repeated click or a retry after a timeout continues the same operation
 * instead of opening a competing one.
 */

export interface BillingOperation {
  id: string;
  association_id: string;
  status: "open" | "completed" | "superseded";
  mode: "subscription" | "setup";
  quantity: number;
  /** The promised trial end, unix seconds; null when it had already passed. */
  trial_end_ts: number | null;
  customer_name: string;
  customer_email: string | null;
  /** The trusted origin the first caller came from, frozen for every retry. */
  return_origin: string;
  customer_id: string | null;
  customer_key: string;
  session_id: string | null;
  session_key: string;
  subscription_id: string | null;
  subscription_key: string;
  created_at: string;
}
