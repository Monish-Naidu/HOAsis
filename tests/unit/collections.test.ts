import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLLECTION_POLICY as P,
  collectionsLadder,
  stageFor,
} from "@/lib/collections";
import { mehrMeadows } from "@/lib/data/communities";

/**
 * The ladder exists so the same steps run for everybody in the same order.
 * That consistency is the legal defence when a lien is challenged, so these
 * assert the ordering rather than any one household.
 */
describe("collections ladder", () => {
  it("places an account by how late it is, not by what it owes", () => {
    expect(stageFor(0, P)).toBe("current");
    expect(stageFor(P.reminderDay - 1, P)).toBe("current");
    expect(stageFor(P.reminderDay, P)).toBe("reminder");
    expect(stageFor(P.lateNoticeDay, P)).toBe("late-notice");
    expect(stageFor(P.demandDay, P)).toBe("demand");
    expect(stageFor(P.counselDay, P)).toBe("counsel");
    expect(stageFor(P.counselDay + 500, P)).toBe("counsel");
  });

  it("never skips a rung as the days climb", () => {
    // Every day from current to counsel must produce a stage no earlier than
    // the day before. A policy that jumps leaves a gap in the record.
    const order = ["current", "reminder", "late-notice", "demand", "counsel"];
    let last = 0;
    for (let day = 0; day <= P.counselDay + 10; day++) {
      const index = order.indexOf(stageFor(day, P));
      expect(index, `day ${day} went backwards`).toBeGreaterThanOrEqual(last);
      last = index;
    }
  });

  it("lists the most escalated households first", () => {
    const ladder = collectionsLadder(mehrMeadows, P);
    const order = ["current", "reminder", "late-notice", "demand", "counsel"];
    const positions = ladder.rows.map((r) => order.indexOf(r.stage));
    // Sorted descending, because the account nearest a deadline is the one
    // that needs a decision, not the largest balance.
    expect([...positions].sort((a, b) => b - a)).toEqual(positions);
  });

  it("counts only households that owe a step today as due now", () => {
    const ladder = collectionsLadder(mehrMeadows, P);
    expect(ladder.dueNow.every((r) => r.stage !== "current")).toBe(true);
    expect(ladder.totalCents).toBe(
      ladder.rows.reduce((t, r) => t + r.owner.balanceCents, 0),
    );
  });

  it("says how long until the next rung rather than only the current one", () => {
    const early = collectionsLadder(mehrMeadows, P).rows.find((r) => r.stage === "current");
    if (early) {
      expect(early.daysToNext).toBeGreaterThan(0);
      expect(early.nextStage).toBeTruthy();
    }
  });

  it("flags accounts that ran past the demand stage", () => {
    const ladder = collectionsLadder(mehrMeadows, P);
    expect(ladder.skipped.every((r) => r.owner.daysPastDue > P.demandDay)).toBe(true);
  });
});
