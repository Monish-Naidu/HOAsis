import { describe, expect, it } from "vitest";
import {
  CLOSING_DATE_MESSAGE,
  DUES_HIGH_MESSAGE,
  DUES_ZERO_MESSAGE,
  EMAIL_MESSAGE,
  MAX_ASSOCIATION_NAME,
  PHONE_MESSAGE,
  RANGE_END_MESSAGE,
  TIME_MESSAGE,
  addressKey,
  associationNameProblem,
  checkMeetingTime,
  checkPayAmount,
  checkPhone,
  closingDateProblem,
  duesProblem,
  duesTextProblem,
  emailProblem,
  lateFeeAmountProblem,
  lateFeeDaysProblem,
  overpayNote,
  pasteSummary,
  rangeEndProblem,
  sortPastedAddresses,
} from "@/lib/input-checks";
import { draftNameProblem, draftOwnDuesProblem, emptyDraft } from "@/lib/data/new-community";

describe("resident pay, other amount", () => {
  const balance = 28_500;
  it("refuses zero, a negative and text, and says why", () => {
    for (const raw of ["0", "-5", "", "abc", "$0.00"]) {
      const r = checkPayAmount(raw, balance);
      expect(r).toEqual({ ok: false, message: "Enter an amount above $0" });
    }
  });
  it("never reads a minus sign as a plus", () => {
    expect(checkPayAmount("-5", balance).ok).toBe(false);
  });
  it("accepts an amount up to the balance with no extra", () => {
    expect(checkPayAmount("100", balance)).toEqual({ ok: true, cents: 10_000, extraCents: 0 });
    expect(checkPayAmount("$285.00", balance)).toEqual({ ok: true, cents: 28_500, extraCents: 0 });
    expect(checkPayAmount("1,000.50", 200_000)).toEqual({ ok: true, cents: 100_050, extraCents: 0 });
  });
  it("allows more than the balance as credit, and says so", () => {
    const r = checkPayAmount("300", balance);
    expect(r).toEqual({ ok: true, cents: 30_000, extraCents: 1_500 });
    expect(overpayNote(1_500)).toBe("That is $15.00 more than you owe. The extra stays on your account as credit.");
    expect(overpayNote(0)).toBeNull();
  });
  it("refuses 99999 on a $285 balance: the ceiling is the balance plus $10,000", () => {
    expect(checkPayAmount("99999", balance).ok).toBe(false);
    expect(checkPayAmount("10285", balance).ok).toBe(true);
    expect(checkPayAmount("10285.01", balance).ok).toBe(false);
  });
  it("treats a credit balance as owing nothing", () => {
    expect(checkPayAmount("50", -2_000)).toEqual({ ok: true, cents: 5_000, extraCents: 5_000 });
  });
});

describe("resident phone", () => {
  it("lets empty clear the number", () => {
    expect(checkPhone("")).toEqual({ ok: true, phone: "" });
    expect(checkPhone("   ")).toEqual({ ok: true, phone: "" });
  });
  it("accepts ordinary numbers and extensions", () => {
    for (const raw of ["(425) 555-0142", "425.555.0142", "+1 425 555 0142", "555-0142", "(425) 555-0142 x12", "425-555-0142 ext. 7"]) {
      expect(checkPhone(raw).ok, raw).toBe(true);
    }
  });
  it("refuses abc, too few digits and stray characters", () => {
    for (const raw of ["abc", "12345", "555-01", "425-555-0142 call me", "425/555/0142", "x123"]) {
      expect(checkPhone(raw), raw).toEqual({ ok: false, message: PHONE_MESSAGE });
    }
  });
  it("does not count extension digits toward the seven", () => {
    expect(checkPhone("555 x1234567").ok).toBe(false);
  });
});

describe("setup wizard dues", () => {
  it("names zero and negative", () => {
    expect(duesProblem(0)).toBe(DUES_ZERO_MESSAGE);
    expect(duesProblem(-100)).toBe(DUES_ZERO_MESSAGE);
    expect(duesTextProblem("0")).toBe(DUES_ZERO_MESSAGE);
    expect(duesTextProblem("-4")).toBe(DUES_ZERO_MESSAGE);
  });
  it("caps at $100,000 per period", () => {
    expect(duesProblem(100_000_00)).toBeNull();
    expect(duesProblem(100_000_01)).toBe(DUES_HIGH_MESSAGE);
    expect(duesTextProblem("99999999999")).toBe(DUES_HIGH_MESSAGE);
  });
  it("accepts a normal amount and says nothing for a blank field", () => {
    expect(duesProblem(25_000)).toBeNull();
    expect(duesTextProblem("250")).toBeNull();
    expect(duesTextProblem("")).toBeNull();
  });
  it("holds amounts by home to the same limits", () => {
    const draft = emptyDraft();
    draft.duesByHome = true;
    expect(draftOwnDuesProblem(draft)).toBeNull();
    draft.phases = [{ id: "p", label: "Phase 1", from: 1, to: 3, duesCents: 0 }];
    expect(draftOwnDuesProblem(draft)).toBe(DUES_ZERO_MESSAGE);
    draft.phases = [{ id: "p", label: "Phase 1", from: 1, to: 3 }];
    draft.households = [{ name: "", email: "", unit: "4", duesCents: 99_999_999_999 }];
    expect(draftOwnDuesProblem(draft)).toBe(DUES_HIGH_MESSAGE);
    draft.households = [{ name: "", email: "", unit: "4" }];
    expect(draftOwnDuesProblem(draft)).toBeNull();
  });
});

describe("setup wizard late fee", () => {
  it("says what is wrong with days", () => {
    for (const days of [-3, 0, 1, 366, 2.5, Number.NaN, undefined]) {
      expect(lateFeeDaysProblem(days), String(days)).toBe("Enter a number of days, 2 to 365");
    }
    expect(lateFeeDaysProblem(30)).toBeNull();
    expect(lateFeeDaysProblem(2)).toBeNull();
  });
  it("says what is wrong with the amount", () => {
    for (const cents of [0, -5, undefined]) {
      expect(lateFeeAmountProblem(cents)).toBe("Enter a fee above $0, or choose no late fee");
    }
    expect(lateFeeAmountProblem(25_00)).toBeNull();
    expect(lateFeeAmountProblem(100_000_01)).toBe(DUES_HIGH_MESSAGE);
  });
});

describe("setup wizard founder and name", () => {
  it("refuses notanemail with the shared check", () => {
    for (const raw of ["notanemail", "a@b", "a b@c.com", "", "@x.com"]) {
      expect(emailProblem(raw), raw).toBe(EMAIL_MESSAGE);
    }
    expect(emailProblem("pat@example.com")).toBeNull();
  });
  it("caps the association name at 80 characters", () => {
    expect(associationNameProblem("x".repeat(MAX_ASSOCIATION_NAME))).toBeNull();
    expect(associationNameProblem("x".repeat(174))).toMatch(/80 characters/);
    const draft = emptyDraft();
    draft.name = "x".repeat(81);
    expect(draftNameProblem(draft)).not.toBeNull();
    draft.name = "Oak Ridge Homeowners Association";
    expect(draftNameProblem(draft)).toBeNull();
  });
});

describe("setup wizard pasted addresses", () => {
  it("compares ignoring case and repeated spaces", () => {
    expect(addressKey("  3  Founder   Way ")).toBe(addressKey("3 founder way"));
  });
  it("skips the founder's own address and says so", () => {
    const r = sortPastedAddresses("3 Founder Way\n5 Oak Lane", ["3 founder way"]);
    expect(r).toEqual({ added: ["5 Oak Lane"], skipped: 1 });
    expect(pasteSummary(r)).toBe("Added 1. Skipped 1 already on the list.");
  });
  it("makes one home of two spellings in the same paste", () => {
    const r = sortPastedAddresses("3 Founder Way\n3  founder way\n\n  ", []);
    expect(r).toEqual({ added: ["3 Founder Way"], skipped: 1 });
  });
  it("omits the second sentence when nothing was skipped", () => {
    expect(pasteSummary(sortPastedAddresses("1 A St\n2 A St", []))).toBe("Added 2.");
  });
});

describe("setup wizard range", () => {
  it("asks for the last number when it is empty", () => {
    expect(rangeEndProblem({ from: 1, to: 0 })).toBe(RANGE_END_MESSAGE);
    expect(rangeEndProblem({ from: 1, to: Number.NaN })).toBe(RANGE_END_MESSAGE);
    expect(rangeEndProblem({ from: 1, to: 20 })).toBeNull();
  });
});

describe("meeting time", () => {
  it("accepts the usual ways to write a time and stores one style", () => {
    const cases: Record<string, string> = {
      "7:00 PM": "7:00 PM",
      "7 pm": "7:00 PM",
      "7:30pm": "7:30 PM",
      "19:00": "7:00 PM",
      "09:15": "9:15 AM",
      "0:30": "12:30 AM",
      "12 am": "12:00 AM",
    };
    for (const [raw, time] of Object.entries(cases)) {
      expect(checkMeetingTime(raw), raw).toEqual({ ok: true, time });
    }
  });
  it("refuses banana and impossible times", () => {
    for (const raw of ["banana", "", "25:00", "7:75 PM", "13 pm", "0 pm", "7"]) {
      expect(checkMeetingTime(raw), raw).toEqual({ ok: false, message: TIME_MESSAGE });
    }
  });
});

describe("ballot closing date", () => {
  it("needs a day after today", () => {
    expect(closingDateProblem("2026-08-20", "2026-08-20")).toBe(CLOSING_DATE_MESSAGE);
    expect(closingDateProblem("2026-08-01", "2026-08-20")).toBe(CLOSING_DATE_MESSAGE);
    expect(closingDateProblem("", "2026-08-20")).toBe(CLOSING_DATE_MESSAGE);
    expect(closingDateProblem("2026-08-21", "2026-08-20")).toBeNull();
  });
});
