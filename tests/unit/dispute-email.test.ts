import { describe, expect, it } from "vitest";
import { disputeDashboardUrl, disputeRecipients } from "@/lib/email/dispute";
import { disputeEmail } from "@/lib/email/templates";

/**
 * A dispute has a deadline, so the notice has to reach whoever holds
 * finances the day it opens, say when evidence is due, and point at the one
 * place it is answered.
 */

const input = {
  associationName: "Maple Court HOA",
  recipientName: "Dana Whitfield",
  unitLabel: "7",
  amountCents: 32500,
  reason: "product_not_received",
  evidenceDueOn: "2026-10-21",
  disputeUrl: disputeDashboardUrl("dp_1"),
};

function links(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

describe("who hears about a dispute", () => {
  const seat = { full_name: "Dana Whitfield", profile_id: "p-1", invited_email: "dana@old.example", capabilities: ["finances"] };

  it("is every current seat that holds finances, at the account's own address", () => {
    const people = disputeRecipients(
      [seat, { full_name: "Arya Mehr", profile_id: "p-2", invited_email: null, capabilities: ["finances", "settings"] }],
      new Map([["p-1", "dana@example.com"], ["p-2", "arya@example.com"]]),
    );
    expect(people).toEqual([
      { name: "Dana Whitfield", email: "dana@example.com", profileId: "p-1" },
      { name: "Arya Mehr", email: "arya@example.com", profileId: "p-2" },
    ]);
  });

  it("leaves out a seat without the finances capability", () => {
    const people = disputeRecipients(
      [{ ...seat, capabilities: ["communications"] }, { ...seat, capabilities: null }],
      new Map([["p-1", "dana@example.com"]]),
    );
    expect(people).toEqual([]);
  });

  it("falls back to the address on the roster, and skips a seat with none", () => {
    const people = disputeRecipients(
      [
        { full_name: "Lee Park", profile_id: null, invited_email: " lee@example.com ", capabilities: ["finances"] },
        { full_name: "No Address", profile_id: null, invited_email: null, capabilities: ["finances"] },
      ],
      new Map(),
    );
    expect(people).toEqual([{ name: "Lee Park", email: "lee@example.com", profileId: null }]);
  });

  it("writes to one address once, however many seats share it", () => {
    const people = disputeRecipients(
      [seat, { ...seat, full_name: "Dana W", profile_id: null, invited_email: "DANA@example.com" }],
      new Map([["p-1", "dana@example.com"]]),
    );
    expect(people).toHaveLength(1);
  });
});

describe("disputeEmail", () => {
  it("puts the amount and the home in the subject and the deadline in the body", () => {
    const built = disputeEmail("opened", input);
    expect(built.subject).toBe("Payment disputed: $325.00 · Unit 7 · Maple Court HOA");
    expect(built.html).toContain("A $325.00 payment was disputed");
    expect(built.html).toContain("Send your evidence by October 21, 2026.");
    expect(built.html).toContain("The reason given: product not received.");
    expect(built.text).toContain("October 21, 2026");
  });

  it("has one link, the dispute on the association's own Stripe dashboard", () => {
    const built = disputeEmail("opened", input);
    expect(links(built.html)).toEqual(["https://dashboard.stripe.com/disputes/dp_1"]);
    expect(built.html).toContain("Answer on Stripe");
    // Stripe has its own sign in; this link does not sign anybody in to ours.
    expect(built.html).not.toContain("This link signs you in");
  });

  it("still asks for evidence when Stripe gave no deadline", () => {
    const built = disputeEmail("opened", { ...input, evidenceDueOn: null, reason: null });
    expect(built.html).toContain("Send your evidence as soon as you can.");
    expect(built.html).not.toContain("The reason given");
  });

  it("says plainly that a lost dispute is not yet in the books", () => {
    const built = disputeEmail("lost", { ...input, evidenceDueOn: null });
    expect(built.subject).toBe("Dispute lost: $325.00 · Unit 7 · Maple Court HOA");
    expect(built.html).toContain("for the cardholder");
    expect(built.html).toContain("still shows the payment as paid");
  });

  it("says the money stays when the association wins", () => {
    const built = disputeEmail("won", { ...input, evidenceDueOn: null });
    expect(built.subject).toBe("Dispute won: $325.00 · Unit 7 · Maple Court HOA");
    expect(built.html).toContain("for the association");
  });

  it("escapes the names it was given and survives an unknown home", () => {
    const built = disputeEmail("opened", { ...input, associationName: "Smith & Sons <HOA>", unitLabel: "" });
    expect(built.subject).toBe("Payment disputed: $325.00 · Smith & Sons <HOA>");
    expect(built.html).toContain("Smith &amp; Sons &lt;HOA&gt;");
    expect(built.html).not.toContain("<HOA>");
  });
});
