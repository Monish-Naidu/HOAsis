import { describe, expect, it } from "vitest";
import { billingStatus, goLiveChecklist } from "@/lib/go-live";
import { buildCommunity, emptyDraft, type CommunityDraft } from "@/lib/data/new-community";
import type { Community } from "@/lib/data/community";

const TODAY = "2026-09-26";

function draft(): CommunityDraft {
  return {
    ...emptyDraft(),
    name: "Alder Creek",
    city: "Bothell",
    state: "WA",
    stateName: "Washington",
    duesCents: 5000,
    duesCadence: "monthly",
    dueDay: 1,
    propertyType: "single-family",
    origin: "existing",
    previously: "platform",
    founder: { name: "Pat Founder", email: "pat@example.com", unit: "1" },
    households: [
      { name: "Marcus Bell", email: "marcus@example.com", unit: "2" },
      { name: "", email: "", unit: "3" },
    ],
  };
}

function community(patch: (c: Community) => void = () => {}): Community {
  const c = buildCommunity(draft(), TODAY);
  c.association.trialEndsOn = "2026-12-20";
  c.association.subscriptionStatus = "trialing";
  // The browser copy seats everyone it names; a real association seats only
  // the founder until the others sign up.
  c.accounts = c.accounts.filter((a) => a.role !== "resident");
  patch(c);
  return c;
}

const item = (c: Community, key: string) => goLiveChecklist(c, TODAY).items.find((i) => i.key === key)!;

describe("goLiveChecklist", () => {
  it("reads the roster and dues off the records", () => {
    const c = community();
    expect(item(c, "roster").done).toBe(true);
    expect(item(c, "roster").detail).toMatch(/3 homes/);
    expect(item(c, "dues").done).toBe(true);

    const alone = community((x) => {
      x.owners = x.owners.slice(0, 1);
      x.association.duesCents = 0;
    });
    expect(item(alone, "roster").done).toBe(false);
    expect(item(alone, "dues").done).toBe(false);
  });

  it("calls Stripe live only when charges are enabled, and links to the finish", () => {
    const none = community();
    expect(item(none, "stripe").done).toBe(false);
    expect(item(none, "stripe").action).toBe("Connect Stripe");

    const started = community((x) => {
      x.association.stripeAccountId = "acct_1";
    });
    expect(item(started, "stripe").done).toBe(false);
    expect(item(started, "stripe").action).toBe("Finish with Stripe");

    const live = community((x) => {
      x.association.stripeAccountId = "acct_1";
      x.association.stripeChargesEnabled = true;
      x.association.stripePayout = { bank: "STRIPE TEST BANK", last4: "6789" };
    });
    expect(item(live, "stripe").done).toBe(true);
    expect(item(live, "stripe").detail).toMatch(/6789/);
  });

  it("knows a bill is scheduled from the next due date, and issued from the statements", () => {
    const scheduled = community();
    expect(item(scheduled, "first-bill").done).toBe(true);
    expect(item(scheduled, "first-bill").detail).toMatch(/First bill goes out/);

    const issued = community((x) => {
      x.ownerCharges[x.owners[1].id] = [
        { id: "c1", date: "2026-09-01", label: "September 2026 dues", kind: "charge", amountCents: 5000, balanceAfterCents: 5000 },
      ];
    });
    expect(item(issued, "first-bill").detail).toMatch(/have been billed/);

    const opening = community((x) => {
      x.association.duesCents = 0;
      x.ownerCharges[x.owners[1].id] = [
        { id: "c1", date: "2026-09-01", label: "Balance brought forward", kind: "charge", amountCents: 5000, balanceAfterCents: 5000 },
      ];
    });
    expect(item(opening, "first-bill").done).toBe(false);
  });

  it("counts invitations from the email log, or from everyone reachable having signed in", () => {
    const none = community();
    expect(item(none, "invites").done).toBe(false);
    expect(item(none, "invites").detail).toMatch(/1 households have an email/);

    const sent = community((x) => {
      x.emailLog = [{ id: "e1", to: "marcus@example.com", category: "invite", subject: "x", sentAt: "2026-09-25T10:00:00Z" }];
    });
    expect(item(sent, "invites").done).toBe(true);

    const joined = community((x) => {
      x.accounts = [
        ...x.accounts,
        { id: "p2", ownerId: x.owners[1].id, name: "Marcus Bell", email: "marcus@example.com", unit: "2", role: "resident", capabilities: x.accounts[0].capabilities, views: x.accounts[0].views },
      ];
    });
    expect(item(joined, "invites").done).toBe(true);
    expect(item(joined, "joined").done).toBe(true);
    expect(item(none, "joined").done).toBe(false);
  });

  it("wants a card before the free days end, and says so louder near the end", () => {
    const early = community();
    expect(item(early, "billing").done).toBe(false);
    expect(item(early, "billing").urgent).toBe(false);
    expect(item(early, "billing").detail).toMatch(/Free until/);

    const closing = community((x) => {
      x.association.trialEndsOn = "2026-10-03";
    });
    expect(item(closing, "billing").urgent).toBe(true);

    const carded = community((x) => {
      x.association.billing = { subscriptionId: "sub_1", brand: "Visa", last4: "4242" };
      x.association.subscriptionStatus = "active";
    });
    expect(item(carded, "billing").done).toBe(true);
    expect(item(carded, "billing").detail).toMatch(/Visa ••4242/);
  });

  it("says money can move once the first four are done", () => {
    const c = community((x) => {
      x.association.stripeChargesEnabled = true;
    });
    const live = goLiveChecklist(c, TODAY);
    expect(live.canCollect).toBe(true);
    expect(live.allDone).toBe(false);
    expect(live.total).toBe(7);
  });
});

describe("what the go-live list shares with the setup list", () => {
  it("answers the card question the same way in both places", () => {
    const c = community();
    const status = billingStatus(c, TODAY);
    expect(status.done).toBe(item(c, "billing").done);
    expect(status.detail).toBe(item(c, "billing").detail);
    expect(status.urgent).toBe(item(c, "billing").urgent);
  });

  it("sends the Stripe row to a Settings section that exists", () => {
    // `#payments` named nothing; the Payments card sits inside #money.
    expect(item(community(), "stripe").href).toBe("/board/settings#money");
  });
});
