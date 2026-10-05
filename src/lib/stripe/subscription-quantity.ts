/**
 * Keeping the subscription's quantity equal to the number of homes.
 *
 * The price is per home per month, and Checkout fixes the quantity at the
 * moment the card is added. A founder who adds a card with three homes
 * entered and then imports a roster of 180 was billed for three from then
 * on, while Settings printed the price for 183. The reverse held as well: a
 * board that removed homes kept paying for them.
 *
 * The daily billing sweep calls this for every association with a
 * subscription. It reads the subscription once and writes only when the
 * number is wrong. The change carries no proration, so the new quantity
 * applies from the next invoice. Nobody gets a surprise charge in the middle
 * of a month for the day a roster was imported.
 *
 * The Stripe client is passed in, so the rule can be tested with no network.
 */

/** The two Stripe calls this needs, in the shape `stripe().subscriptions` has. */
export interface SubscriptionsClient {
  retrieve(id: string): Promise<{
    status: string;
    items: { data: { id: string; quantity?: number | null }[] };
  }>;
  update(
    id: string,
    params: {
      items: { id: string; quantity: number }[];
      proration_behavior: "none";
    },
  ): Promise<unknown>;
}

export type QuantitySync =
  /** Already right. Nothing was written. */
  | { outcome: "unchanged"; quantity: number }
  /** Was wrong and is now `to`, or would be on a real run. */
  | { outcome: "changed"; from: number | null; to: number }
  /** Over at Stripe, or with no line to change. Left alone. */
  | { outcome: "skipped"; why: string };

/** What Checkout would have charged for: every home, and never fewer than one. */
export function quantityFor(homes: number): number {
  return Math.max(1, Math.trunc(homes));
}

export async function syncSubscriptionQuantity(
  client: SubscriptionsClient,
  input: { subscriptionId: string; homes: number; dryRun?: boolean },
): Promise<QuantitySync> {
  const subscription = await client.retrieve(input.subscriptionId);
  // A subscription Stripe has ended cannot be changed, and the webhook is
  // what clears it from the row.
  if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
    return { outcome: "skipped", why: `subscription is ${subscription.status}` };
  }
  const line = subscription.items.data[0];
  if (!line) return { outcome: "skipped", why: "subscription has no line" };

  const want = quantityFor(input.homes);
  const have = line.quantity ?? null;
  if (have === want) return { outcome: "unchanged", quantity: want };

  if (!input.dryRun) {
    await client.update(input.subscriptionId, {
      items: [{ id: line.id, quantity: want }],
      proration_behavior: "none",
    });
  }
  return { outcome: "changed", from: have, to: want };
}

/**
 * The sweep's address for carrying the quantity pass on in a later call.
 *
 * The sweep makes two passes over two different sets of rows, trials first
 * and subscriptions second, and a bare `after` cannot say which pass it
 * belongs to. `walk=quantity` does. With nothing finished yet there is no id
 * to resume from, so `after` is dropped and the pass starts from the top.
 * Pure, so it can be tested.
 */
export function quantityWalkUrl(url: string, lastId: string | null): string {
  const next = new URL(url);
  next.searchParams.set("walk", "quantity");
  if (lastId) next.searchParams.set("after", lastId);
  else next.searchParams.delete("after");
  return next.toString();
}
