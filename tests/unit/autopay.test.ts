import { describe, expect, it } from "vitest";
import { decideAutopay, isChargeable } from "@/lib/payments/autopay";

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
});

describe("isChargeable", () => {
  it("accepts a verified Stripe method and nothing else", () => {
    expect(isChargeable({ token: "pm_123" })).toBe(true);
    expect(isChargeable({ token: "pm_123", status: "verifying" })).toBe(false);
    expect(isChargeable({ token: "tok_card_visa_20260820" })).toBe(false);
    expect(isChargeable({})).toBe(false);
  });
});
