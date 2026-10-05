import { describe, expect, it } from "vitest";
import { subscriptionExit } from "@/lib/stripe/subscription-exit";

/**
 * "Cancel the subscription" has to end the thing that bills. With a Stripe
 * subscription on file that is Stripe's own page; our RPC only marks a row.
 */
describe("which door a cancel goes through", () => {
  it("sends an association with a Stripe subscription to Stripe's billing page", () => {
    expect(subscriptionExit({ status: "active", subscriptionId: "sub_1" })).toBe("portal");
    expect(subscriptionExit({ status: "past_due", subscriptionId: "sub_1" })).toBe("portal");
    // A card added during the free period is a subscription all the same.
    expect(subscriptionExit({ status: "trialing", subscriptionId: "sub_1" })).toBe("portal");
  });

  it("keeps the RPC for an association on its free period with nothing at Stripe", () => {
    expect(subscriptionExit({ status: "trialing" })).toBe("rpc");
    expect(subscriptionExit({ status: "ended", subscriptionId: null })).toBe("rpc");
    expect(subscriptionExit({})).toBe("rpc");
  });

  it("offers a restart only when nothing is billing", () => {
    expect(subscriptionExit({ status: "canceled" })).toBe("restart");
  });

  it("does not call a row cancelled while Stripe still holds its subscription", () => {
    // What the old button left behind: our row says cancelled, Stripe bills on.
    expect(subscriptionExit({ status: "canceled", subscriptionId: "sub_1" })).toBe("portal");
  });
});
