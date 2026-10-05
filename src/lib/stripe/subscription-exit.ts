/**
 * Which door "Cancel the subscription" goes through.
 *
 * Cancelling used to flip a column on our own row and nothing else. With a
 * card on file that stopped nothing: Stripe kept charging, the next paid
 * invoice set the row back to active, and a board that had been told the
 * bill was stopped was billed every month after.
 *
 * So the rule follows where the bill actually lives. A Stripe subscription
 * on file can only be ended by Stripe, on its own billing page, and the
 * billing webhook writes the result when Stripe says it is over. An
 * association still on its free period has nothing at Stripe to end, and
 * the cancel_subscription RPC remains the whole of it.
 *
 * A row marked cancelled that still has a subscription id is one the old
 * button left behind. Stripe is still billing it, so it is offered the real
 * cancel and not a restart.
 */
export type SubscriptionExit = "portal" | "rpc" | "restart";

export function subscriptionExit(input: {
  status?: string | null;
  subscriptionId?: string | null;
}): SubscriptionExit {
  if (input.subscriptionId) return "portal";
  if (input.status === "canceled") return "restart";
  return "rpc";
}
