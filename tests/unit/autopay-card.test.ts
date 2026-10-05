import { describe, expect, it } from "vitest";
import { decideAutopay } from "@/lib/payments/autopay";
import { autopaySource, nextAutopayDate } from "@/lib/payments/autopay-card";

/**
 * The autopay card is a promise about the daily run, so each date here is
 * checked against `decideAutopay` itself: the run must be willing to charge
 * on the day the card names, and must not be waiting for a later month.
 */
describe("nextAutopayDate", () => {
  const willCharge = (plan: Parameters<typeof decideAutopay>[0]["plan"], today: string) =>
    decideAutopay({ plan, today, balanceCents: 28_500, duesCents: 28_500 }).action;

  it("names this month while the plan's day has not passed", () => {
    // Dues on the 1st, autopay on the 5th. On November 3 the next dues are
    // December 1, and the card used to say December 5.
    const plan = { day: 5, startMonth: "2026-10" };
    expect(nextAutopayDate({ plan, today: "2026-11-03" })).toBe("2026-11-05");
    expect(willCharge(plan, "2026-11-05")).toBe("charge");
  });

  it("names today when today is the day", () => {
    expect(nextAutopayDate({ plan: { day: 5 }, today: "2026-11-05" })).toBe("2026-11-05");
  });

  it("names next month once the day has passed, never a day already gone", () => {
    // Dues on the 15th, autopay on the 1st, today October 4. The card used
    // to say October 1, three days ago.
    const plan = { day: 1, startMonth: "2026-10" };
    expect(nextAutopayDate({ plan, today: "2026-10-04" })).toBe("2026-11-01");
    expect(willCharge(plan, "2026-11-01")).toBe("charge");
  });

  it("names the day dues post when that is later this month than the plan's day", () => {
    // Dues on the 15th, autopay on the 1st, today October 4. On the 1st
    // nothing was owed, so the run waited; it draws once the 15th is billed,
    // and the card used to say November 1.
    const plan = { day: 1, startMonth: "2026-10" };
    expect(nextAutopayDate({ plan, today: "2026-10-04", nextChargeDate: "2026-10-15" })).toBe(
      "2026-10-15",
    );
    // The run agrees: nothing to take today, the whole balance on the 15th.
    expect(
      decideAutopay({ plan, today: "2026-10-04", balanceCents: 0, duesCents: 28_500 }).action,
    ).toBe("wait");
    expect(willCharge(plan, "2026-10-15")).toBe("charge");
    // Once October's dues have posted the next charge is November's, and
    // the plan's own day comes first again.
    expect(nextAutopayDate({ plan, today: "2026-10-16", nextChargeDate: "2026-11-15" })).toBe(
      "2026-11-01",
    );
  });

  it("leaves the plan's day alone when dues post before it", () => {
    // Dues on the 1st, autopay on the 5th: the next charge is next month's
    // and has no say in when this month's balance is taken.
    const plan = { day: 5, startMonth: "2026-10" };
    expect(nextAutopayDate({ plan, today: "2026-11-03", nextChargeDate: "2026-12-01" })).toBe(
      "2026-11-05",
    );
    // Past the 5th with nothing more billed this month: next month's 5th.
    expect(nextAutopayDate({ plan, today: "2026-11-06", nextChargeDate: "2026-12-01" })).toBe(
      "2026-12-05",
    );
    // The plan's day still to come, dues later the same month: the run
    // takes what is owed on the plan's day first.
    expect(
      nextAutopayDate({ plan: { day: 10 }, today: "2026-10-04", nextChargeDate: "2026-10-15" }),
    ).toBe("2026-10-10");
  });

  it("does not name this month's charge for a plan that sits this month out", () => {
    const charge = { today: "2026-10-04", nextChargeDate: "2026-10-15" };
    // Skipped: the run takes nothing in October, whatever posts.
    const skipped = { day: 1, skipMonth: "2026-10" };
    expect(nextAutopayDate({ plan: skipped, ...charge })).toBe("2026-11-01");
    expect(willCharge(skipped, "2026-10-15")).toBe("skip");
    // Not started: the run waits for November.
    const later = { day: 1, startMonth: "2026-11" };
    expect(nextAutopayDate({ plan: later, ...charge })).toBe("2026-11-01");
    expect(willCharge(later, "2026-10-15")).toBe("wait");
  });

  it("rolls over the year", () => {
    expect(nextAutopayDate({ plan: { day: 3 }, today: "2026-12-10" })).toBe("2027-01-03");
  });

  it("waits for the month the plan starts in", () => {
    const plan = { day: 5, startMonth: "2026-12" };
    expect(nextAutopayDate({ plan, today: "2026-10-20" })).toBe("2026-12-05");
    expect(willCharge(plan, "2026-11-05")).toBe("wait");
    expect(willCharge(plan, "2026-12-05")).toBe("charge");
  });

  it("steps past the skipped month", () => {
    const plan = { day: 5, skipMonth: "2026-11" };
    expect(nextAutopayDate({ plan, today: "2026-11-03" })).toBe("2026-12-05");
    expect(nextAutopayDate({ plan, today: "2026-10-20" })).toBe("2026-12-05");
    expect(willCharge(plan, "2026-11-05")).toBe("skip");
    // A skip that names a month already behind us changes nothing.
    expect(nextAutopayDate({ plan: { day: 5, skipMonth: "2026-09" }, today: "2026-11-03" })).toBe(
      "2026-11-05",
    );
  });

  it("is always a real date, today or later", () => {
    for (const today of ["2026-01-31", "2026-02-28", "2028-02-29", "2026-06-30", "2026-12-31"]) {
      for (let day = 1; day <= 31; day += 1) {
        const date = nextAutopayDate({ plan: { day }, today });
        expect(date >= today, `${date} is before ${today}`).toBe(true);
        expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
        // A next charge date already behind today is never handed back.
        const stale = nextAutopayDate({ plan: { day }, today, nextChargeDate: `${today.slice(0, 8)}01` });
        expect(stale >= today, `${stale} is before ${today}`).toBe(true);
      }
    }
  });
});

describe("autopaySource", () => {
  const visa = { id: "visa", isDefault: true, token: "pm_visa" };
  const bank = { id: "bank", isDefault: false, token: "pm_bank" };
  const unconfirmed = { id: "new-bank", isDefault: false, token: "pm_new", status: "verifying" };

  it("keeps a saved plan on its own method whatever is picked in the pay panel", () => {
    // Paying once with the card must not move autopay off the bank.
    const from = autopaySource({
      isRemote: true,
      instruments: [visa, bank],
      planInstrumentId: "bank",
      panelSelection: "visa",
    });
    expect(from?.id).toBe("bank");
  });

  it("starts a new plan on the method picked in the pay panel", () => {
    const from = autopaySource({ isRemote: true, instruments: [visa, bank], panelSelection: "bank" });
    expect(from?.id).toBe("bank");
  });

  it("falls back to the default, then to anything that can be charged", () => {
    expect(
      autopaySource({ isRemote: true, instruments: [bank, visa], panelSelection: "new-card" })?.id,
    ).toBe("visa");
    expect(
      autopaySource({ isRemote: true, instruments: [unconfirmed, bank], panelSelection: "new-bank" })?.id,
    ).toBe("bank");
    // The plan's method was removed: the next best, not nothing.
    expect(
      autopaySource({ isRemote: true, instruments: [visa], planInstrumentId: "gone" })?.id,
    ).toBe("visa");
  });

  it("has nothing to offer when the only method is a bank not yet confirmed", () => {
    // The switch is gated on this, so it stays off until the bank is confirmed.
    expect(
      autopaySource({ isRemote: true, instruments: [unconfirmed], panelSelection: "new-bank" }),
    ).toBeUndefined();
    expect(
      autopaySource({ isRemote: true, instruments: [unconfirmed], planInstrumentId: "new-bank" }),
    ).toBeUndefined();
  });

  it("uses whatever is selected in the demo, which has no processor", () => {
    const demo = { id: "demo", isDefault: false, token: "tok_demo" };
    expect(autopaySource({ isRemote: false, instruments: [demo], selected: demo })).toBe(demo);
  });
});
