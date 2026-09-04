import { describe, expect, it } from "vitest";
import {
  GRACE_DAYS,
  billingPhase,
  boardLocked,
  checkoutTrialEnd,
  statusFromStripe,
  subscriptionLine,
  trialEndsOn,
  trialNoticeDue,
  type BillingFacts,
} from "@/lib/billing";
import { PRICE_PER_HOME_CENTS, TRIAL_DAYS } from "@/lib/pricing";

/**
 * The trial is a promise on the front page ("90 days free, no card to
 * start") and these hold the arithmetic behind it to that promise: the clock
 * starts at founding, the banner and the sweep read the same phase, a card
 * added early is not charged early, and nobody is emailed twice.
 */

const facts = (over: Partial<BillingFacts> = {}): BillingFacts => ({
  status: "trialing",
  trialEndsOn: "2026-12-01",
  homes: 12,
  hasSubscription: false,
  ...over,
});

describe("trial length", () => {
  it("ends ninety days after founding", () => {
    expect(TRIAL_DAYS).toBe(90);
    expect(trialEndsOn("2026-09-04")).toBe("2026-12-03");
  });
});

describe("billingPhase", () => {
  it("counts the days left while trialing", () => {
    const phase = billingPhase(facts(), "2026-11-01");
    expect(phase).toEqual({ phase: "trialing", daysLeft: 30, endsOn: "2026-12-01", closing: false });
  });

  it("turns closing inside the last two weeks", () => {
    expect(billingPhase(facts(), "2026-11-17")).toMatchObject({ phase: "trialing", closing: true });
    expect(billingPhase(facts(), "2026-11-16")).toMatchObject({ phase: "trialing", closing: false });
  });

  it("is ended on the day itself, and locked only after the grace period", () => {
    expect(billingPhase(facts(), "2026-12-01")).toMatchObject({ phase: "ended", daysOver: 0, locked: false });
    const lastGraceDay = billingPhase(facts(), "2026-12-15");
    expect(lastGraceDay).toMatchObject({ phase: "ended", daysOver: GRACE_DAYS, locked: false });
    expect(boardLocked(lastGraceDay)).toBe(false);
    const locked = billingPhase(facts(), "2026-12-16");
    expect(locked).toMatchObject({ phase: "ended", locked: true });
    expect(boardLocked(locked)).toBe(true);
  });

  it("is active as soon as a subscription exists, whatever the date says", () => {
    expect(billingPhase(facts({ hasSubscription: true }), "2027-06-01")).toEqual({ phase: "active" });
    expect(billingPhase(facts({ status: "active" }), "2027-06-01")).toEqual({ phase: "active" });
  });

  it("lets Stripe's word win over the calendar", () => {
    expect(billingPhase(facts({ status: "past_due", hasSubscription: true }), "2026-10-01")).toEqual({
      phase: "past_due",
    });
    expect(billingPhase(facts({ status: "canceled" }), "2026-10-01")).toEqual({ phase: "canceled" });
  });

  it("never locks a paying, past due or canceled association", () => {
    for (const status of ["active", "past_due", "canceled"] as const) {
      expect(boardLocked(billingPhase(facts({ status }), "2028-01-01"))).toBe(false);
    }
  });
});

describe("trialNoticeDue", () => {
  const ends = "2026-12-01";

  it("sends nothing while the trial is far off", () => {
    expect(trialNoticeDue(ends, "2026-10-01", [])).toBeNull();
    expect(trialNoticeDue(ends, "2026-11-16", [])).toBeNull();
  });

  it("sends the fourteen day notice on the day, and marks it", () => {
    expect(trialNoticeDue(ends, "2026-11-17", [])).toEqual({ send: "14-days", markSent: ["14-days"] });
  });

  it("does not send the same notice twice", () => {
    expect(trialNoticeDue(ends, "2026-11-18", ["14-days"])).toBeNull();
  });

  it("collapses missed notices into the most urgent one", () => {
    // A sweep that did not run for a week owes one email, not two.
    expect(trialNoticeDue(ends, "2026-11-28", [])).toEqual({
      send: "3-days",
      markSent: ["14-days", "3-days"],
    });
  });

  it("sends the ended notice on the end date and never again", () => {
    expect(trialNoticeDue(ends, "2026-12-01", ["14-days", "3-days"])).toEqual({
      send: "ended",
      markSent: ["14-days", "3-days", "ended"],
    });
    expect(trialNoticeDue(ends, "2026-12-20", ["14-days", "3-days", "ended"])).toBeNull();
  });
});

describe("checkoutTrialEnd", () => {
  it("carries the remaining free days into Stripe", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(checkoutTrialEnd("2026-12-01", now)).toBe(Math.floor(Date.UTC(2026, 11, 1, 12) / 1000));
  });

  it("starts billing at once when under two days remain, which Stripe would refuse anyway", () => {
    expect(checkoutTrialEnd("2026-12-01", new Date("2026-11-30T12:00:00Z"))).toBeNull();
    expect(checkoutTrialEnd("2026-12-01", new Date("2026-12-09T12:00:00Z"))).toBeNull();
  });
});

describe("subscriptionLine", () => {
  it("bills the published price per home, monthly", () => {
    const line = subscriptionLine(88);
    expect(line.quantity).toBe(88);
    expect(line.price_data.unit_amount).toBe(PRICE_PER_HOME_CENTS);
    expect(line.price_data.recurring.interval).toBe("month");
  });

  it("never sends Stripe a zero quantity", () => {
    expect(subscriptionLine(0).quantity).toBe(1);
  });
});

describe("statusFromStripe", () => {
  it("folds Stripe's vocabulary into ours", () => {
    expect(statusFromStripe("trialing")).toBe("trialing");
    expect(statusFromStripe("active")).toBe("active");
    expect(statusFromStripe("past_due")).toBe("past_due");
    expect(statusFromStripe("unpaid")).toBe("past_due");
    expect(statusFromStripe("canceled")).toBe("canceled");
    expect(statusFromStripe("incomplete_expired")).toBe("canceled");
  });
});
