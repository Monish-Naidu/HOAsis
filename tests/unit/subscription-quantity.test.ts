import { describe, expect, it, vi } from "vitest";
import {
  quantityFor,
  quantityWalkUrl,
  syncSubscriptionQuantity,
  type SubscriptionsClient,
} from "@/lib/stripe/subscription-quantity";

/**
 * The subscription is priced per home, so its quantity has to follow the
 * roster. A fake Stripe client stands in: what matters is when a write is
 * made and what it says.
 */
function clientWith(subscription: { status?: string; items?: { id: string; quantity?: number | null }[] }) {
  const retrieve = vi.fn(async () => ({
    status: subscription.status ?? "active",
    items: { data: subscription.items ?? [{ id: "si_1", quantity: 3 }] },
  }));
  const update = vi.fn(async () => ({}));
  const client: SubscriptionsClient = { retrieve, update };
  return { client, retrieve, update };
}

describe("the quantity a subscription should carry", () => {
  it("is every home, and never fewer than one", () => {
    expect(quantityFor(183)).toBe(183);
    expect(quantityFor(1)).toBe(1);
    expect(quantityFor(0)).toBe(1);
  });
});

describe("syncing the quantity to the number of homes", () => {
  it("raises a subscription made with three homes once the roster has 183", async () => {
    const { client, update } = clientWith({ items: [{ id: "si_1", quantity: 3 }] });
    const result = await syncSubscriptionQuantity(client, { subscriptionId: "sub_1", homes: 183 });
    expect(result).toEqual({ outcome: "changed", from: 3, to: 183 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("sub_1", {
      items: [{ id: "si_1", quantity: 183 }],
      // From the next invoice. No charge in the middle of the month.
      proration_behavior: "none",
    });
  });

  it("lowers it when homes were removed", async () => {
    const { client, update } = clientWith({ items: [{ id: "si_1", quantity: 40 }] });
    const result = await syncSubscriptionQuantity(client, { subscriptionId: "sub_1", homes: 36 });
    expect(result).toEqual({ outcome: "changed", from: 40, to: 36 });
    expect(update).toHaveBeenCalledWith("sub_1", expect.objectContaining({ items: [{ id: "si_1", quantity: 36 }] }));
  });

  it("writes nothing when the quantity is already right", async () => {
    const { client, retrieve, update } = clientWith({ items: [{ id: "si_1", quantity: 24 }] });
    const result = await syncSubscriptionQuantity(client, { subscriptionId: "sub_1", homes: 24 });
    expect(result).toEqual({ outcome: "unchanged", quantity: 24 });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });

  it("says what would change on a dry run, and changes nothing", async () => {
    const { client, update } = clientWith({ items: [{ id: "si_1", quantity: 3 }] });
    const result = await syncSubscriptionQuantity(client, { subscriptionId: "sub_1", homes: 183, dryRun: true });
    expect(result).toEqual({ outcome: "changed", from: 3, to: 183 });
    expect(update).not.toHaveBeenCalled();
  });

  it("leaves a subscription Stripe has already ended alone", async () => {
    const { client, update } = clientWith({ status: "canceled" });
    const result = await syncSubscriptionQuantity(client, { subscriptionId: "sub_1", homes: 183 });
    expect(result.outcome).toBe("skipped");
    expect(update).not.toHaveBeenCalled();
  });

  it("leaves a subscription with no line alone", async () => {
    const { client, update } = clientWith({ items: [] });
    const result = await syncSubscriptionQuantity(client, { subscriptionId: "sub_1", homes: 12 });
    expect(result.outcome).toBe("skipped");
    expect(update).not.toHaveBeenCalled();
  });
});

describe("carrying the quantity pass on in a later call", () => {
  it("names the pass and where it stopped", () => {
    const next = new URL(quantityWalkUrl("https://yourhoasis.com/api/billing/sweep", "assoc-9"));
    expect(next.pathname).toBe("/api/billing/sweep");
    expect(next.searchParams.get("walk")).toBe("quantity");
    expect(next.searchParams.get("after")).toBe("assoc-9");
  });

  it("does not resume the quantity pass from where the trial pass stopped", () => {
    // The trial pass finished at assoc-5 and no time was left to start this one.
    const next = new URL(quantityWalkUrl("https://yourhoasis.com/api/billing/sweep?after=assoc-5", null));
    expect(next.searchParams.get("walk")).toBe("quantity");
    expect(next.searchParams.has("after")).toBe(false);
  });
});
