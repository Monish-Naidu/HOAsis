import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLLECTION_POLICY as P,
  collectionsLadder,
  policyFor,
  policyProblems,
  stageFor,
} from "@/lib/collections";
import { mehrMeadows } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import type { MessageThread } from "@/lib/types";
import { addDays } from "@/lib/utils";

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

/**
 * A rung's letter is owed once. The ladder used to say a notice was owed
 * from the calendar alone, so the same homes read as owed the moment after
 * the letters went out and the next officer sent them again.
 */
describe("a notice that has already gone out", () => {
  const asOf = mehrMeadows.asOf;
  const home = { ...mehrMeadows.owners[0], id: "own-late", balanceCents: 30_000 };

  /** One home, `daysPastDue` days behind, with the threads given. */
  function community(daysPastDue: number, threads: MessageThread[]): Community {
    return { ...mehrMeadows, owners: [{ ...home, daysPastDue }], threads };
  }

  /** A thread to the home, with one message per `[days ago, who wrote it]`. */
  function thread(
    tag: MessageThread["tag"],
    messages: [daysAgo: number, direction: "outbound" | "inbound"][],
    ownerId = home.id,
  ): MessageThread {
    return {
      id: `t-${tag}-${messages.map(([d]) => d).join("-")}`,
      subject: "Your assessment is past due",
      participants: [home.displayName, "Board"],
      ownerId,
      updatedDate: addDays(asOf, -Math.min(...messages.map(([d]) => d))),
      unread: false,
      tag,
      messages: messages.map(([daysAgo, direction], index) => ({
        id: `m-${index}`,
        at: addDays(asOf, -daysAgo),
        from: direction === "outbound" ? "Board" : home.displayName,
        fromRole: direction === "outbound" ? "board" : "resident",
        direction,
        channel: direction === "outbound" ? "email" : "portal",
        body: "...",
      })),
    };
  }

  // Twenty days late on the default ladder: the reminder rung, reached five
  // days ago.
  const LATE = P.reminderDay + 5;

  it("is owed when nothing has been sent", () => {
    const ladder = collectionsLadder(community(LATE, []), P);
    expect(ladder.rows[0]).toMatchObject({ stage: "reminder", actionDue: true });
    expect(ladder.rows[0].sentOn).toBeUndefined();
    expect(ladder.dueNow).toHaveLength(1);
  });

  it("stops being owed once the letter for this rung is sent", () => {
    const ladder = collectionsLadder(community(LATE, [thread("Billing", [[2, "outbound"]])]), P);
    expect(ladder.rows[0]).toMatchObject({
      stage: "reminder",
      actionDue: false,
      sentOn: addDays(asOf, -2),
    });
    expect(ladder.dueNow).toEqual([]);
  });

  it("counts a letter sent on the very day the rung was reached", () => {
    const ladder = collectionsLadder(community(LATE, [thread("Billing", [[5, "outbound"]])]), P);
    expect(ladder.rows[0].actionDue).toBe(false);
  });

  it("is owed again at the next rung, whatever went out for the last one", () => {
    // Thirty one days late: the formal notice, reached yesterday. The
    // reminder went out twelve days ago, on the rung before.
    const ladder = collectionsLadder(
      community(P.lateNoticeDay + 1, [thread("Billing", [[12, "outbound"]])]),
      P,
    );
    expect(ladder.rows[0]).toMatchObject({ stage: "late-notice", actionDue: true });
  });

  it("does not take an owner's reply to an older letter for the new notice", () => {
    // The reply moves the thread's date to yesterday. It is not a letter.
    const replied = thread("Billing", [[12, "outbound"], [1, "inbound"]]);
    expect(replied.updatedDate).toBe(addDays(asOf, -1));
    const ladder = collectionsLadder(community(P.lateNoticeDay + 1, [replied]), P);
    expect(ladder.rows[0].actionDue).toBe(true);
  });

  it("looks only at dues letters to that home", () => {
    const ladder = collectionsLadder(
      community(LATE, [
        thread("Maintenance", [[1, "outbound"]]),
        thread("Billing", [[1, "outbound"]], "own-somebody-else"),
      ]),
      P,
    );
    expect(ladder.rows[0].actionDue).toBe(true);
  });

  it("reads the day off a message stamped with a time", () => {
    const stamped = thread("Billing", [[2, "outbound"]]);
    stamped.messages[0].at = `${addDays(asOf, -2)}T16:04:00.000Z`;
    const ladder = collectionsLadder(community(LATE, [stamped]), P);
    expect(ladder.rows[0]).toMatchObject({ actionDue: false, sentOn: addDays(asOf, -2) });
  });
});

/**
 * The board's own policy. Unset means the default, a partial one fills in
 * from the default, and a ladder whose rungs do not climb is refused with
 * a sentence the treasurer can act on.
 */
describe("the board's policy", () => {
  it("falls back to the default when the board has not set one", () => {
    expect(policyFor({})).toEqual(P);
    expect(policyFor({ collectionPolicy: undefined })).toEqual(P);
  });

  it("uses what the board set and fills the rest from the default", () => {
    const policy = policyFor({ collectionPolicy: { ...P, lateFeeCents: 50_00, counselDay: 120 } });
    expect(policy.lateFeeCents).toBe(50_00);
    expect(policy.counselDay).toBe(120);
    expect(policy.reminderDay).toBe(P.reminderDay);
  });

  it("accepts the default and a zero fee", () => {
    expect(policyProblems(P)).toEqual([]);
    expect(policyProblems({ ...P, lateFeeCents: 0 })).toEqual([]);
  });

  it("refuses rungs that do not climb, naming the pair", () => {
    expect(policyProblems({ ...P, demandDay: P.lateNoticeDay })).toContain(
      "The notice has to come before the demand.",
    );
    expect(policyProblems({ ...P, reminderDay: 40 })).toContain(
      "The reminder has to come before the notice.",
    );
    expect(policyProblems({ ...P, counselDay: 10 })).toContain(
      "The demand has to come before counsel.",
    );
  });

  it("refuses a negative fee and a plan with no months", () => {
    expect(policyProblems({ ...P, lateFeeCents: -1 })).toHaveLength(1);
    expect(policyProblems({ ...P, minimumPlanMonths: 0 })).toHaveLength(1);
    expect(policyProblems({ ...P, reminderDay: Number.NaN })).not.toHaveLength(0);
  });

  it("the ladder moves with the policy", () => {
    const strict = policyFor({ collectionPolicy: { ...P, reminderDay: 5, lateNoticeDay: 10 } });
    expect(stageFor(7, strict)).toBe("reminder");
    expect(stageFor(7, P)).toBe("current");
  });
});
