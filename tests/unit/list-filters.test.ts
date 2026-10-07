import { describe, expect, it } from "vitest";
import { homeFilterCounts, matchesHomeFilter } from "@/lib/roster-filters";
import { ladderFilterCounts, matchesLadderFilter } from "@/lib/collections";
import { applyRequestFilters, requestFilterCounts } from "@/lib/request-filters";

const home = (over: Partial<{ daysPastDue: number; placeholder: boolean; autopay: boolean; email: string }>) => ({
  daysPastDue: 0,
  placeholder: false,
  autopay: false,
  email: "a@b.co",
  ...over,
});

describe("homeowner chips", () => {
  const homes = [
    home({}),
    home({ autopay: true }),
    home({ daysPastDue: 20, email: "" }),
    home({ placeholder: true, email: "" }),
  ];

  it("counts each chip with the same rule that filters the list", () => {
    expect(homeFilterCounts(homes)).toEqual({ all: 4, "paid-up": 2, "past-due": 1, autopay: 1, "no-email": 1 });
    for (const f of ["paid-up", "past-due", "autopay", "no-email"] as const) {
      expect(homes.filter((o) => matchesHomeFilter(o, f))).toHaveLength(homeFilterCounts(homes)[f]);
    }
  });

  it("does not call a home with nobody on record paid up, on autopay or missing an email", () => {
    const vacant = home({ placeholder: true, email: "", autopay: true });
    expect(matchesHomeFilter(vacant, "paid-up")).toBe(false);
    expect(matchesHomeFilter(vacant, "autopay")).toBe(false);
    expect(matchesHomeFilter(vacant, "no-email")).toBe(false);
  });

  it("treats a blank email as none", () => {
    expect(matchesHomeFilter(home({ email: "   " }), "no-email")).toBe(true);
  });
});

describe("past due chips", () => {
  const rows = [
    { stage: "reminder" as const, home: { id: "a" } },
    { stage: "reminder" as const, home: { id: "b" } },
    { stage: "demand" as const, home: { id: "c" } },
  ];

  it("counts a rung and the homes whose autopay failed", () => {
    const counts = ladderFilterCounts(rows, new Set(["b", "c"]));
    expect(counts).toMatchObject({ all: 3, reminder: 2, demand: 1, counsel: 0, "autopay-failed": 2 });
  });

  it("filters by rung and by autopay", () => {
    expect(rows.filter((r) => matchesLadderFilter(r, "demand"))).toHaveLength(1);
    expect(rows.filter((r) => matchesLadderFilter(r, "autopay-failed", new Set(["a"])))).toHaveLength(1);
    expect(rows.filter((r) => matchesLadderFilter(r, "autopay-failed"))).toHaveLength(0);
  });
});

describe("request chips", () => {
  const grouped = {
    decision: [{ kind: "architectural" }, { kind: "maintenance" }],
    scheduling: [{ kind: "maintenance" }],
    progress: [],
    done: [{ kind: "architectural" }],
    older: [{ kind: "maintenance" }],
  };

  it("counts a step within the kind chosen and a kind within the step chosen", () => {
    const counts = requestFilterCounts(grouped, "all", "maintenance");
    expect(counts.steps).toMatchObject({ all: 2, decision: 1, scheduling: 1, done: 0 });
    const inDecision = requestFilterCounts(grouped, "decision", "all");
    expect(inDecision.types).toMatchObject({ all: 2, architectural: 1, maintenance: 1 });
  });

  it("narrows the lists, and the history follows the Done chip", () => {
    const decision = applyRequestFilters(grouped, "decision", "all");
    expect(decision.decision).toHaveLength(2);
    expect(decision.scheduling).toHaveLength(0);
    expect(decision.older).toHaveLength(0);
    const done = applyRequestFilters(grouped, "done", "maintenance");
    expect(done.done).toHaveLength(0);
    expect(done.older).toHaveLength(1);
  });
});
