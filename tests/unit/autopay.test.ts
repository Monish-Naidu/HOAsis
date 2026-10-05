import { describe, expect, it } from "vitest";
import { decideAutopay, isChargeable, pendingSince } from "@/lib/payments/autopay";

/**
 * The cron's judgement, with no clock and no database. Every rule here is a
 * sentence on the pay screen; if one changes, the other must.
 */
const plan = { day: 5 };

describe("decideAutopay", () => {
  it("waits before the chosen day", () => {
    const d = decideAutopay({ plan, today: "2026-10-04", balanceCents: 28500, duesCents: 28500 });
    expect(d.action).toBe("wait");
  });

  it("charges the whole balance on the day with no cap", () => {
    const d = decideAutopay({ plan, today: "2026-10-05", balanceCents: 30000, duesCents: 28500 });
    expect(d).toMatchObject({ action: "charge", amountCents: 30000 });
  });

  it("still charges later in the month, so dues posted after the day are not missed", () => {
    const d = decideAutopay({ plan, today: "2026-10-20", balanceCents: 28500, duesCents: 28500 });
    expect(d).toMatchObject({ action: "charge", amountCents: 28500 });
  });

  it("writes no decision when nothing is due", () => {
    const d = decideAutopay({ plan, today: "2026-10-05", balanceCents: 0, duesCents: 28500 });
    expect(d).toEqual({ action: "wait", reason: "Nothing due" });
  });

  it("sits out the skipped month", () => {
    const d = decideAutopay({
      plan: { ...plan, skipMonth: "2026-10" },
      today: "2026-10-05",
      balanceCents: 28500,
      duesCents: 28500,
    });
    expect(d.action).toBe("skip");
  });

  it("does not start before the month it was switched on for", () => {
    const d = decideAutopay({
      plan: { ...plan, startMonth: "2026-11" },
      today: "2026-10-20",
      balanceCents: 28500,
      duesCents: 28500,
    });
    expect(d.action).toBe("wait");
    const next = decideAutopay({
      plan: { ...plan, startMonth: "2026-11" },
      today: "2026-11-05",
      balanceCents: 28500,
      duesCents: 28500,
    });
    expect(next.action).toBe("charge");
  });

  it("sends only regular dues when the balance is above the cap", () => {
    const d = decideAutopay({
      plan: { ...plan, capCents: 50000 },
      today: "2026-10-05",
      balanceCents: 128500,
      duesCents: 28500,
    });
    expect(d).toMatchObject({ action: "charge", amountCents: 28500 });
  });

  it("sends the balance when it is within the cap", () => {
    const d = decideAutopay({
      plan: { ...plan, capCents: 50000 },
      today: "2026-10-05",
      balanceCents: 31000,
      duesCents: 28500,
    });
    expect(d).toMatchObject({ action: "charge", amountCents: 31000 });
  });

  // September paid by bank on the 29th, still settling when October posts:
  // the charges say 600, the owner owes 300.
  it("takes only what a payment still processing does not already cover", () => {
    const d = decideAutopay({
      plan,
      today: "2026-10-05",
      balanceCents: 60000,
      pendingCents: 30000,
      duesCents: 30000,
    });
    expect(d).toMatchObject({ action: "charge", amountCents: 30000 });
  });

  it("waits, without deciding the month, when a processing payment covers the balance", () => {
    const d = decideAutopay({
      plan,
      today: "2026-10-05",
      balanceCents: 30000,
      pendingCents: 30000,
      duesCents: 30000,
    });
    expect(d).toEqual({ action: "wait", reason: "Payment processing" });
    const over = decideAutopay({
      plan,
      today: "2026-10-05",
      balanceCents: 30000,
      pendingCents: 45000,
      duesCents: 30000,
    });
    expect(over).toEqual({ action: "wait", reason: "Payment processing" });
  });

  it("measures the cap against what is left after the processing payment", () => {
    const d = decideAutopay({
      plan: { ...plan, capCents: 50000 },
      today: "2026-10-05",
      balanceCents: 60000,
      pendingCents: 30000,
      duesCents: 28500,
    });
    // 300 left is within the 500 cap, so the remainder goes out whole.
    expect(d).toMatchObject({ action: "charge", amountCents: 30000 });
  });

  it("still says nothing is due when nothing is, whatever is processing", () => {
    const d = decideAutopay({ plan, today: "2026-10-05", balanceCents: 0, pendingCents: 30000, duesCents: 28500 });
    expect(d).toEqual({ action: "wait", reason: "Nothing due" });
  });
});

describe("pendingSince", () => {
  it("looks back two weeks, across a month end", () => {
    expect(pendingSince("2026-10-05")).toBe("2026-09-21");
    expect(pendingSince("2026-03-10")).toBe("2026-02-24");
  });
});

describe("isChargeable", () => {
  it("accepts a verified Stripe method and nothing else", () => {
    expect(isChargeable({ token: "pm_123" })).toBe(true);
    expect(isChargeable({ token: "pm_123", status: "verifying" })).toBe(false);
    expect(isChargeable({ token: "tok_card_visa_20260820" })).toBe(false);
    expect(isChargeable({})).toBe(false);
  });
});
