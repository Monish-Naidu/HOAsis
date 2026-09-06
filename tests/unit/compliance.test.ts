import { describe, expect, it } from "vitest";
import { complianceRegister } from "@/lib/compliance";
import { CITED_STATES, GENERAL_OBLIGATIONS, STATE_OBLIGATIONS } from "@/lib/data/obligations";
import { libraryArticles } from "@/lib/data/library";
import { mehrMeadows } from "@/lib/data/communities";
import { testCommunityOne } from "@/lib/data/test-community-one";
import type { Community } from "@/lib/data/community";

/**
 * The register, and the line it does not cross.
 *
 * It computes deadlines, which is arithmetic on a fiscal year, and it does not
 * decide whether an association complied, which would be a claim about a filed
 * report nobody here has seen. The other thing under test is honesty about
 * coverage: a general row must not be able to pass itself off as a cited one.
 */

function withState(state: string, stateName: string): Community {
  return {
    ...mehrMeadows,
    association: { ...mehrMeadows.association, state, stateName },
  };
}

describe("the obligations behind it", () => {
  it("cites a section on every state row, and none on a general one", () => {
    // The old register printed plausible chapter numbers next to duties
    // nobody had checked. A row either carries a section or says it does not.
    for (const [code, rows] of Object.entries(STATE_OBLIGATIONS)) {
      for (const row of rows ?? []) {
        expect(row.citation, `${code} ${row.key} has no section`).toBeTruthy();
      }
    }
    for (const row of GENERAL_OBLIGATIONS) {
      expect(row.citation, `${row.key} invented a section`).toBeUndefined();
    }
  });

  it("points every obligation at a library article that exists", () => {
    const slugs = new Set(libraryArticles.map((a) => a.slug));
    const all = [...GENERAL_OBLIGATIONS, ...Object.values(STATE_OBLIGATIONS).flat()];
    for (const row of all) {
      if (!row?.article) continue;
      expect(slugs.has(row.article), `${row.key} points at ${row.article}`).toBe(true);
    }
  });

  it("gives every obligation something the board can actually produce", () => {
    const all = [...GENERAL_OBLIGATIONS, ...Object.values(STATE_OBLIGATIONS).flat()];
    for (const row of all) {
      expect(row!.evidence.length, `${row!.key} does not say what to show`).toBeGreaterThan(20);
    }
  });
});

describe("complianceRegister", () => {
  it("uses the state's own rows where they exist", () => {
    const register = complianceRegister(mehrMeadows);
    expect(register.cited).toBe(true);
    expect(register.items.some((i) => i.citation?.startsWith("RCW"))).toBe(true);
  });

  it("says plainly when a state has not been written yet", () => {
    // A board in Texas should know it is looking at general duties rather
    // than assume the same confidence as a cited row.
    const register = complianceRegister(withState("TX", "Texas"));
    expect(register.cited).toBe(false);
    expect(register.items.every((i) => !i.cited)).toBe(true);
    // The insurance renewal is the association's own date, not a state duty.
    const duties = register.items.filter((i) => i.key !== "insurance-renewal");
    expect(duties.length).toBe(GENERAL_OBLIGATIONS.length);
  });

  it("carries the insurance renewal as a deadline once Settings knows the date", () => {
    const register = complianceRegister(mehrMeadows);
    const renewal = register.items.find((i) => i.key === "insurance-renewal");
    expect(renewal?.dueDate).toBe(mehrMeadows.association.insuranceExpiresOn);
    expect(renewal?.href).toBe("/board/settings#insurance");
  });

  it("takes the board's word that a duty was met, for one period", () => {
    const first = complianceRegister(mehrMeadows).items.find((i) => i.dueDate && i.cadence === "annual")!;
    const marked = {
      ...mehrMeadows,
      settings: { ...mehrMeadows.settings, complianceDone: { [first.key]: mehrMeadows.asOf } },
    };
    const row = complianceRegister(marked).items.find((i) => i.key === first.key)!;
    expect(row.status).toBe("compliant");
    expect(row.doneOn).toBe(mehrMeadows.asOf);
    // A mark from two years ago no longer covers this year's due date.
    const stale = {
      ...mehrMeadows,
      settings: { ...mehrMeadows.settings, complianceDone: { [first.key]: "2024-01-15" } },
    };
    expect(complianceRegister(stale).items.find((i) => i.key === first.key)!.doneOn).toBeUndefined();
  });

  it("never shows a general row next to the state row that replaces it", () => {
    // Washington writes its own records duty with a section, so the vaguer
    // general one must not also appear.
    const register = complianceRegister(mehrMeadows);
    const records = register.items.filter((i) => /records/i.test(i.label));
    expect(records).toHaveLength(1);
    expect(records[0].citation).toContain("RCW 64.90.495");
  });

  it("puts every dated item in the future, or calls it overdue", () => {
    for (const community of [mehrMeadows, testCommunityOne]) {
      const register = complianceRegister(community);
      for (const item of register.items) {
        if (!item.dueDate) continue;
        if (item.status === "overdue") continue;
        expect(item.dueDate >= community.asOf, `${item.key} is dated in the past`).toBe(true);
      }
    }
  });

  it("gives a records request no date at all", () => {
    // It falls due when somebody asks. A date on it would be a deadline
    // nobody actually has.
    const register = complianceRegister(mehrMeadows);
    const records = register.items.find((i) => i.cadence === "on-request")!;
    expect(records.dueDate).toBeUndefined();
    expect(records.clockDays).toBeGreaterThan(0);
  });

  it("separates what binds from day one from what does not", () => {
    // The distinction a brand new community needs. Registering with the state
    // is a day one duty; an annual audit is not something a two month old
    // association is behind on.
    const register = complianceRegister(mehrMeadows);
    expect(register.dayOne.length).toBeGreaterThan(0);
    expect(register.dayOne.every((i) => i.fromDayOne)).toBe(true);
    expect(register.items.some((i) => !i.fromDayOne)).toBe(true);
  });

  it("names the soonest dated obligation and never a past one", () => {
    const register = complianceRegister(mehrMeadows);
    if (!register.next) return;
    for (const item of register.items) {
      if (!item.dueDate || item.status === "overdue") continue;
      expect(item.dueDate >= register.next.dueDate!).toBe(true);
    }
  });

  it("works for a community that has only just been founded", () => {
    // The failure this replaces: every new association inherited Mehr
    // Meadows' reserve consultant and its funding level as its own register.
    const register = complianceRegister(testCommunityOne);
    expect(register.items.length).toBeGreaterThan(0);
    expect(register.items.every((i) => i.label.length > 0)).toBe(true);
  });

  it("covers the four states written so far and admits to the rest", () => {
    expect(CITED_STATES.length).toBe(4);
    for (const code of CITED_STATES) {
      expect(STATE_OBLIGATIONS[code]!.length).toBeGreaterThan(0);
    }
  });
});
