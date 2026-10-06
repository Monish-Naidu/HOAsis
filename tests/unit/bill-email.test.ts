import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import { billPostedToday, dueABillEmail, type PostedCharge } from "@/lib/email/bill-run";
import { unsentDuesBill } from "@/lib/metrics";

/**
 * Which associations the daily bill email is due for, and the dashboard row
 * for a board that turned it off. The route itself needs Resend and cannot
 * run here; its dry run (?dry=1) lists who it would mail.
 */

const TODAY = "2026-10-01";
const bill = (over: Partial<PostedCharge> = {}): PostedCharge => ({
  category: "dues", kind: "charge", label: "October 2026 dues", due_on: "2026-10-01",
  created_at: "2026-10-01T13:00:04Z", ...over,
});

describe("billPostedToday", () => {
  it("finds a dues bill created today and gives its due date", () => {
    expect(billPostedToday([bill()], TODAY)).toEqual({ dueOn: "2026-10-01" });
  });
  it("ignores a bill created on another day", () => {
    expect(billPostedToday([bill({ created_at: "2026-09-30T13:00:04Z" })], TODAY)).toBeNull();
  });
  it("ignores a balance brought forward, a late fee, a payment and a credit", () => {
    const rows = [
      bill({ label: "Balance brought forward" }),
      bill({ category: "late_fee" }),
      bill({ kind: "payment" }),
      bill({ kind: "credit" }),
      bill({ category: null }),
    ];
    expect(billPostedToday(rows, TODAY)).toBeNull();
  });
  it("is not fooled by a brought forward line sitting next to a real bill", () => {
    expect(billPostedToday([bill({ label: "Balance brought forward" }), bill()], TODAY)).toEqual({ dueOn: "2026-10-01" });
  });
});

describe("dueABillEmail", () => {
  it("is due when opted in and a bill posted today", () => {
    expect(dueABillEmail({ bills_by_email: true }, [bill()], TODAY)).not.toBeNull();
  });
  it("counts an unset value as on, like the column default", () => {
    expect(dueABillEmail({}, [bill()], TODAY)).not.toBeNull();
  });
  it("is not due when the board turned it off", () => {
    expect(dueABillEmail({ bills_by_email: false }, [bill()], TODAY)).toBeNull();
  });
  it("is not due when nothing posted today", () => {
    expect(dueABillEmail({ bills_by_email: true }, [], TODAY)).toBeNull();
  });
});

describe("unsentDuesBill, the Needs you today row", () => {
  const signedIn = (over: Partial<Community> & { billsByEmail?: boolean }): Community => {
    const { billsByEmail, ...rest } = over;
    return {
      ...mehrMeadows,
      asOf: "2026-10-03",
      nextChargeDate: "2026-11-01",
      history: { from: "2024-11-01", ledgerCount: 0 } as Community["history"],
      emailLog: [],
      recentDuesBill: { postedOn: "2026-10-01", dueOn: "2026-10-01" },
      association: { ...mehrMeadows.association, billsByEmail },
      ...rest,
    };
  };

  it("shows for an opted out board with a recent bill and no email logged", () => {
    expect(unsentDuesBill(signedIn({ billsByEmail: false }))).toEqual({ label: "October dues posted" });
  });
  it("is quiet while the email is on, because the job sends it", () => {
    expect(unsentDuesBill(signedIn({ billsByEmail: true }))).toBeNull();
    expect(unsentDuesBill(signedIn({}))).toBeNull();
  });
  it("is quiet once an assessment email was logged since the bill posted", () => {
    const sent = { id: "e1", to: "a@example.com", category: "assessment", subject: "s", sentAt: "2026-10-02T09:00:00Z" };
    expect(unsentDuesBill(signedIn({ billsByEmail: false, emailLog: [sent] }))).toBeNull();
  });
  it("is not quieted by an email from before the bill, a failed one, or another category", () => {
    const before = { id: "e1", to: "a@example.com", category: "assessment", subject: "s", sentAt: "2026-09-30T09:00:00Z" };
    const failed = { id: "e2", to: "a@example.com", category: "assessment", subject: "s", sentAt: "2026-10-02T09:00:00Z", error: "bounced" };
    const other = { id: "e3", to: "a@example.com", category: "message", subject: "s", sentAt: "2026-10-02T09:00:00Z" };
    expect(unsentDuesBill(signedIn({ billsByEmail: false, emailLog: [before, failed, other] }))).not.toBeNull();
  });
  it("lapses after seven days and has nothing to say with no bill on the books", () => {
    expect(unsentDuesBill(signedIn({ billsByEmail: false, asOf: "2026-10-08" }))).not.toBeNull();
    expect(unsentDuesBill(signedIn({ billsByEmail: false, asOf: "2026-10-09" }))).toBeNull();
    expect(unsentDuesBill(signedIn({ billsByEmail: false, recentDuesBill: undefined }))).toBeNull();
  });
  it("shows in the demo, which has no email log or bills, only when the switch is off", () => {
    const demo = { ...mehrMeadows, history: undefined, recentDuesBill: undefined };
    expect(unsentDuesBill({ ...demo, association: { ...demo.association, billsByEmail: false } })).not.toBeNull();
    expect(unsentDuesBill(demo)).toBeNull();
  });
});
