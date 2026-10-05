import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOG_PAGE,
  REPEAT_WINDOW_MS,
  SEND_BUDGET_MS,
  SEND_GAP_MS,
  createPacer,
  recentlySent,
  sentKey,
  stoppedLine,
} from "@/lib/email/pace";

/**
 * A roster send must stay under the provider's two a second and must stop
 * with an answer before the function's time limit. The clock and the sleep
 * are fakes: time moves only when a test moves it, or when the pacer sleeps.
 */
function fakeTime(start = 1_000_000) {
  let now = start;
  const slept: number[] = [];
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    sleep: async (ms: number) => {
      slept.push(ms);
      now += ms;
    },
    slept,
  };
}

describe("the pacer", () => {
  it("lets the first send go at once", async () => {
    const time = fakeTime();
    const pacer = createPacer({ now: time.now, sleep: time.sleep });
    await pacer.turn();
    expect(time.slept).toEqual([]);
  });

  it("holds the next send until the gap has passed, so no two start within it", async () => {
    const time = fakeTime();
    const pacer = createPacer({ now: time.now, sleep: time.sleep });
    await pacer.turn();
    await pacer.turn();
    await pacer.turn();
    expect(time.slept).toEqual([SEND_GAP_MS, SEND_GAP_MS]);
  });

  it("waits only for what is left of the gap when the work in between took time", async () => {
    const time = fakeTime();
    const pacer = createPacer({ now: time.now, sleep: time.sleep });
    await pacer.turn();
    time.advance(400); // minting a link, the send itself, the log row
    await pacer.turn();
    expect(time.slept).toEqual([SEND_GAP_MS - 400]);
    time.advance(900);
    await pacer.turn();
    // Already slower than the limit: no extra wait on top.
    expect(time.slept).toEqual([SEND_GAP_MS - 400]);
  });

  it("stays under two a second over a run", async () => {
    const time = fakeTime();
    const pacer = createPacer({ now: time.now, sleep: time.sleep });
    const starts: number[] = [];
    for (let i = 0; i < 10; i++) {
      await pacer.turn();
      starts.push(time.now());
      time.advance(50);
    }
    for (let i = 2; i < starts.length; i++) {
      // Any three starts span more than a second, so no second holds three.
      expect(starts[i] - starts[i - 2]).toBeGreaterThan(1000);
    }
  });

  it("says when the budget is spent, and not before", () => {
    const time = fakeTime();
    const pacer = createPacer({ now: time.now, sleep: time.sleep });
    expect(pacer.outOfTime()).toBe(false);
    time.advance(SEND_BUDGET_MS - 1);
    expect(pacer.outOfTime()).toBe(false);
    time.advance(1);
    expect(pacer.outOfTime()).toBe(true);
  });

  it("keeps its budget under the routes' sixty seconds", () => {
    expect(SEND_BUDGET_MS).toBeLessThan(60_000);
  });
});

describe("the line a board reads when a send stopped", () => {
  it("counts who was not reached and says sending again is safe when it is", () => {
    expect(stoppedLine(25, true)).toBe(
      "Stopped at the time limit. 25 people were not reached. Send again to reach them. Nobody who already got this is sent it twice.",
    );
    expect(stoppedLine(1, true)).toContain("1 person was not reached.");
  });

  it("does not tell the board to send again when a repeat cannot be told apart", () => {
    expect(stoppedLine(3, false)).toBe("Stopped at the time limit. 3 people were not reached.");
  });
});

describe("telling a repeat from a first send", () => {
  it("matches the same address whatever its case", () => {
    expect(sentKey(" Gwen@Example.com ", "$285.00 due", "unit-1")).toBe(sentKey("gwen@example.com", "$285.00 due", "unit-1"));
  });

  it("keeps two homes of one owner apart, and two subjects apart", () => {
    expect(sentKey("gwen@example.com", "$285.00 due", "unit-1")).not.toBe(sentKey("gwen@example.com", "$285.00 due", "unit-2"));
    expect(sentKey("gwen@example.com", "$285.00 due", "unit-1")).not.toBe(sentKey("gwen@example.com", "$300.00 due", "unit-1"));
  });
});

describe("what was already sent in the last hour", () => {
  type Row = { to_email: string; subject: string; unit_id: string | null };
  const filters: [string, string, unknown][] = [];
  const ranges: [number, number][] = [];
  /** What the log holds, in order. A read gets the slice it asked for and no more than a page. */
  let rows: Row[] = [];
  /** Set to make the read of that page fail. */
  let failAtPage: number | null = null;
  const chain: Record<string, unknown> = {};
  for (const step of ["select", "eq", "is", "gte", "order"]) {
    chain[step] = (column: string, value: unknown) => {
      filters.push([step, column, value]);
      return chain;
    };
  }
  chain.range = async (from: number, to: number) => {
    ranges.push([from, to]);
    if (failAtPage === from / LOG_PAGE) return { data: null, error: { message: "fetch failed" } };
    // The server's own ceiling, whatever range was asked for.
    return { data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null };
  };
  const admin = { from: vi.fn(() => chain) } as never;

  const logged = (count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({ to_email: `owner${i + 1}@example.com`, subject: "$285.00 due", unit_id: `unit-${i + 1}` }));

  beforeEach(() => {
    filters.length = 0;
    ranges.length = 0;
    failAtPage = null;
    rows = [{ to_email: "Gwen@example.com", subject: "$285.00 due", unit_id: "unit-1" }];
  });

  it("reads this association's successes in this category since an hour ago", async () => {
    const now = Date.UTC(2026, 9, 4, 18, 0, 0);
    const seen = await recentlySent(admin, { associationId: "assoc-1", category: "assessment", now: () => now });
    expect(seen.has(sentKey("gwen@example.com", "$285.00 due", "unit-1"))).toBe(true);
    expect(filters).toContainEqual(["eq", "association_id", "assoc-1"]);
    expect(filters).toContainEqual(["eq", "category", "assessment"]);
    // A send that failed is not a send.
    expect(filters).toContainEqual(["is", "error", null]);
    expect(filters).toContainEqual(["gte", "sent_at", new Date(now - REPEAT_WINDOW_MS).toISOString()]);
    // One short page is the whole answer: no second read.
    expect(ranges).toEqual([[0, LOG_PAGE - 1]]);
  });

  it("answers nothing sent when the log cannot be read, so the notice still goes", async () => {
    failAtPage = 0;
    const seen = await recentlySent(admin, { associationId: "assoc-1", category: "assessment" });
    expect(seen.size).toBe(0);
  });

  it("reads past the thousandth row, a page at a time in a fixed order", async () => {
    // One read stops at a thousand rows and says nothing about the rest, so
    // number 1,001 onward looked unsent and would have been mailed twice.
    rows = logged(2300);
    const seen = await recentlySent(admin, { associationId: "assoc-1", category: "assessment" });
    expect(seen.size).toBe(2300);
    expect(seen.has(sentKey("owner2300@example.com", "$285.00 due", "unit-2300"))).toBe(true);
    expect(ranges).toEqual([
      [0, LOG_PAGE - 1],
      [LOG_PAGE, 2 * LOG_PAGE - 1],
      [2 * LOG_PAGE, 3 * LOG_PAGE - 1],
    ]);
    // Without an order, two pages can overlap and leave a row in neither.
    expect(filters).toContainEqual(["order", "sent_at", undefined]);
    expect(filters).toContainEqual(["order", "id", undefined]);
  });

  it("asks once more after a full page, in case the log ends exactly there", async () => {
    rows = logged(LOG_PAGE);
    const seen = await recentlySent(admin, { associationId: "assoc-1", category: "assessment" });
    expect(seen.size).toBe(LOG_PAGE);
    expect(ranges).toHaveLength(2);
  });

  it("keeps what it had read when a later page fails", async () => {
    rows = logged(1500);
    failAtPage = 1;
    const seen = await recentlySent(admin, { associationId: "assoc-1", category: "assessment" });
    expect(seen.size).toBe(LOG_PAGE);
  });
});
