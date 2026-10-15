import { describe, expect, it } from "vitest";
import {
  creditProblem,
  handAmountCeiling,
  lateFeeCentsProblem,
  MAX_DUES_CENTS,
  MAX_OPENING_BALANCE_CENTS,
  openingBalanceProblem,
} from "@/lib/input-checks";
import {
  ballotChoicesProblem,
  ballotClosedOn,
  ballotResults,
  closedBallotSummary,
} from "@/lib/ballots";
import { roleChangeMessage, waitingRoleMessage } from "@/lib/app-state/role-change";
import { ledgerCategory } from "@/lib/data/ledger-category";

describe("the ceiling on a payment or a credit entered by hand", () => {
  it("is what the home owes plus ten thousand dollars, and never less than that", () => {
    expect(handAmountCeiling(50_000)).toBe(1_050_000);
    expect(handAmountCeiling(0)).toBe(1_000_000);
    expect(handAmountCeiling(-20_000)).toBe(1_000_000);
  });

  it("turns away a credit past it, a fraction of a cent, zero and a negative", () => {
    expect(creditProblem(1_050_000, 50_000)).toBeNull();
    expect(creditProblem(1_050_001, 50_000)).toBe(
      "The most you can credit this home is $10,500.00.",
    );
    expect(creditProblem(250.5, 0)).toBe("Use whole cents, like 12.50");
    expect(creditProblem(0, 0)).toBe("Enter an amount above $0");
    expect(creditProblem(-100, 0)).toBe("Enter an amount above $0");
    expect(creditProblem(99_999_999_999, 0)).not.toBeNull();
  });
});

describe("a late fee in cents", () => {
  it("allows none and anything up to a home's dues ceiling in whole cents", () => {
    expect(lateFeeCentsProblem(0)).toBeNull();
    expect(lateFeeCentsProblem(2_500)).toBeNull();
    expect(lateFeeCentsProblem(MAX_DUES_CENTS)).toBeNull();
  });

  it("turns away $1,000,000, $2.505 as 250.5 cents, a negative and not a number", () => {
    expect(lateFeeCentsProblem(100_000_000)).toBe(
      "That looks too high. Dues are per home, per period.",
    );
    expect(lateFeeCentsProblem(MAX_DUES_CENTS + 1)).not.toBeNull();
    expect(lateFeeCentsProblem(250.5)).toBe("Use whole cents, like 12.50");
    expect(lateFeeCentsProblem(-1)).toMatch(/cannot be negative/);
    expect(lateFeeCentsProblem(Number.NaN)).toBe("Use whole cents, like 12.50");
  });
});

describe("a home's opening balance", () => {
  it("allows up to two years of the highest dues, owed or in credit", () => {
    expect(MAX_OPENING_BALANCE_CENTS).toBe(MAX_DUES_CENTS * 24);
    expect(openingBalanceProblem(0)).toBeNull();
    expect(openingBalanceProblem(MAX_OPENING_BALANCE_CENTS)).toBeNull();
    expect(openingBalanceProblem(-MAX_OPENING_BALANCE_CENTS)).toBeNull();
  });

  it("turns away $99,999,999,999 either way, and a fraction of a cent", () => {
    expect(openingBalanceProblem(99_999_999_999)).toBe(
      "The most a home can start with is $2,400,000.",
    );
    expect(openingBalanceProblem(-99_999_999_999)).not.toBeNull();
    expect(openingBalanceProblem(MAX_OPENING_BALANCE_CENTS + 1)).not.toBeNull();
    expect(openingBalanceProblem(10.5)).toBe("Use whole cents, like 12.50");
  });
});

describe("the choices on a ballot", () => {
  it("accepts distinct names", () => {
    expect(ballotChoicesProblem([{ label: "For" }, { label: "Against" }])).toBeNull();
    expect(ballotChoicesProblem([])).toBeNull();
  });

  it("refuses two that read the same, in any case or spacing", () => {
    expect(ballotChoicesProblem([{ label: "Same" }, { label: "Same" }])).toBe(
      '"Same" is listed twice. Give each choice its own name.',
    );
    expect(ballotChoicesProblem([{ label: "Same" }, { label: "  sAme " }])).toMatch(/listed twice/);
    expect(ballotChoicesProblem([{ label: "Jo  Ann" }, { label: "jo ann" }])).toMatch(
      /listed twice/,
    );
  });

  it("refuses a blank choice", () => {
    expect(ballotChoicesProblem([{ label: "For" }, { label: "   " }])).toBe(
      "Give every choice a name.",
    );
  });

  const options = [
    { id: "a", label: "For", votes: 12 },
    { id: "b", label: "Against", votes: 0 },
  ];

  it("gives the count per choice in the ballot's order, zero included", () => {
    expect(ballotResults({ options })).toEqual([
      { optionId: "a", label: "For", votes: 12 },
      { optionId: "b", label: "Against", votes: 0 },
    ]);
  });

  it("names the day it closed only for a ballot that has closed and recorded it", () => {
    expect(ballotClosedOn({ status: "closed", closedDate: "2026-08-20" })).toBe("2026-08-20");
    expect(ballotClosedOn({ status: "certified", closedDate: "2026-08-20" })).toBe("2026-08-20");
    expect(ballotClosedOn({ status: "open", closedDate: "2026-08-20" })).toBeUndefined();
    expect(ballotClosedOn({ status: "closed" })).toBeUndefined();
    expect(closedBallotSummary({ options, status: "closed" })).toEqual({
      results: ballotResults({ options }),
      closedOn: undefined,
    });
  });
});

describe("what the board is told about a role", () => {
  it("says that access was reset to the office's defaults", () => {
    expect(roleChangeMessage("Dana Cole", "treasurer")).toBe(
      "Dana Cole is Treasurer. Access set to the Treasurer defaults; adjust it below.",
    );
    expect(roleChangeMessage("Ellis Wright", "vice-president")).toBe(
      "Ellis Wright is Vice President. Access set to the Vice President defaults; adjust it below.",
    );
  });

  it("says plainly when somebody leaves the board", () => {
    expect(roleChangeMessage("Dana Cole", "resident")).toBe(
      "Dana Cole is no longer on the board. Access set to the Resident defaults; adjust it below.",
    );
  });

  it("says the office waits for an owner who has not signed in", () => {
    expect(waitingRoleMessage("Dana Cole", "treasurer")).toBe(
      "Dana Cole is Treasurer. They get board access when they sign in.",
    );
  });
});

describe("a category as the ledger spells it", () => {
  it("fixes case and spacing", () => {
    expect(ledgerCategory("landscaping")).toBe("Landscaping");
    expect(ledgerCategory("  REPAIRS &  maintenance ")).toBe("Repairs & maintenance");
    expect(ledgerCategory("Landscaping")).toBe("Landscaping");
  });

  it("leaves a category the books do not know as it was", () => {
    expect(ledgerCategory("Pest control")).toBe("Pest control");
    expect(ledgerCategory("")).toBe("");
  });
});
