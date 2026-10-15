import { describe, expect, it } from "vitest";
import type { Ballot } from "@/lib/types";
import {
  ballotTurnout,
  electionWinners,
  enteredCounts,
  enteredLine,
  homesBarredByDues,
  isPastDue,
  ownerVoteNotice,
  paperVoteProblem,
  proxyHolderProblem,
  quorumFromInput,
  quorumLine,
  quorumState,
  resultHeadline,
  resultsSummary,
  seatedWords,
  seatingBlocked,
  seatingChoiceProblem,
  seatingPlan,
} from "@/lib/voting";

/**
 * The rules of a vote at the annual meeting, as the screens say them and the
 * demo keeps them. enter_paper_vote, cast_votes and seat_election_winners
 * (0118) keep the same rules in the database; scripts/verify-voting.mjs
 * proves those.
 */

const TODAY = "2026-08-20";

function ballot(over: Partial<Ballot> = {}): Ballot {
  return {
    id: "b1",
    reference: "B1",
    title: "Election of two directors",
    body: [],
    kind: "election",
    audience: "owners",
    status: "open",
    opensDate: "2026-08-01",
    closesDate: "2026-08-31",
    eligible: 10,
    seats: 1,
    quorumRequired: 0,
    thresholdLabel: "Most votes wins",
    options: [
      { id: "a", label: "Arya Mehr", votes: 0, homeId: "h1" },
      { id: "b", label: "Sofia Bergman", votes: 0, homeId: "h2" },
    ],
    liveResultsVisible: false,
    ...over,
  };
}

const current = { id: "h1", unit: "12", balanceCents: 0, daysPastDue: 0 };
const dueToday = { id: "h2", unit: "14", balanceCents: 25_000, daysPastDue: 0 };
const dayLate = { id: "h3", unit: "16", balanceCents: 25_000, daysPastDue: 1 };

describe("ballotTurnout", () => {
  it("reads the database's count of homes when it has one", () => {
    expect(ballotTurnout(ballot({ homesVoted: 0 }))).toBe(0);
    expect(ballotTurnout(ballot({ homesVoted: 7 }))).toBe(7);
  });

  it("divides the demo's marks by the seats", () => {
    const b = ballot({
      seats: 2,
      options: [
        { id: "a", label: "A", votes: 3 },
        { id: "b", label: "B", votes: 3 },
      ],
    });
    expect(ballotTurnout(b)).toBe(3);
  });
});

describe("quorumFromInput", () => {
  it("is no quorum when empty or zero", () => {
    expect(quorumFromInput("", "homes", 88)).toEqual({ count: 0, problem: null });
    expect(quorumFromInput("0", "percent", 88)).toEqual({ count: 0, problem: null });
  });

  it("rounds a percent up to the next whole home", () => {
    expect(quorumFromInput("20", "percent", 88).count).toBe(18);
    // 25% of 88 is exactly 22; float error must not push it to 23.
    expect(quorumFromInput("25", "percent", 88).count).toBe(22);
    expect(quorumFromInput("100", "percent", 88).count).toBe(88);
  });

  it("refuses a negative, a fraction of a home, too many homes and a huge percent", () => {
    expect(quorumFromInput("-3", "homes", 88).problem).toBe("Quorum is a whole number of homes.");
    expect(quorumFromInput("2.5", "homes", 88).problem).toBe("Quorum is a whole number of homes.");
    expect(quorumFromInput("89", "homes", 88).problem).toBe("Only 88 homes can vote.");
    expect(quorumFromInput("101", "percent", 88).problem).toBe(
      "Quorum is a percent from 0 to 100.",
    );
  });
});

describe("quorumState and quorumLine", () => {
  it("is null with no quorum", () => {
    expect(quorumState(ballot({ quorumRequired: 0, homesVoted: 3 }))).toBeNull();
    expect(quorumLine(ballot({ quorumRequired: 0 }), TODAY)).toBeNull();
  });

  it("with zero votes, needs every home of the quorum", () => {
    const b = ballot({ quorumRequired: 3, homesVoted: 0 });
    expect(quorumState(b)).toEqual({ required: 3, voted: 0, met: false, short: 3 });
    expect(quorumLine(b, TODAY)).toBe("Quorum: 0 of 3 homes so far. 3 more needed.");
  });

  it("with one vote, is short by the rest", () => {
    const b = ballot({ quorumRequired: 3, homesVoted: 1 });
    expect(quorumLine(b, TODAY)).toBe("Quorum: 1 of 3 homes so far. 2 more needed.");
  });

  it("is met exactly at the threshold", () => {
    const b = ballot({ quorumRequired: 3, homesVoted: 3 });
    expect(quorumState(b)?.met).toBe(true);
    expect(quorumLine(b, TODAY)).toBe("Quorum reached. 3 homes voted, 3 needed.");
  });

  it("says met or missed once voting ends", () => {
    const closed = { status: "closed" as const, quorumRequired: 27 };
    expect(quorumLine(ballot({ ...closed, homesVoted: 26 }), TODAY)).toBe(
      "Quorum missed by 1. 26 homes voted, 27 were needed.",
    );
    expect(quorumLine(ballot({ ...closed, homesVoted: 27 }), TODAY)).toBe(
      "Quorum met. 27 homes voted, 27 were needed.",
    );
  });
});

describe("electionWinners and resultHeadline", () => {
  const votes = (...n: number[]) =>
    n.map((v, i) => ({ id: `o${i}`, label: `Candidate ${i}`, votes: v }));

  it("has no winner and no headline when nobody voted", () => {
    const b = ballot({ options: votes(0, 0), homesVoted: 0 });
    expect(electionWinners(b)).toEqual({ winners: [], tied: false });
    expect(resultHeadline(b)).toBeNull();
  });

  it("names the one winner of a single seat", () => {
    const b = ballot({ options: votes(1, 0), homesVoted: 1 });
    expect(resultHeadline(b)).toBe("Candidate 0 won");
  });

  it("calls a tie for the last seat, and seats nobody", () => {
    const b = ballot({ seats: 2, options: votes(5, 3, 3), homesVoted: 6 });
    expect(electionWinners(b)).toEqual({ winners: [], tied: true });
    expect(resultHeadline(b)).toBe("Tied for the last place");
  });

  it("is not a tie when the tie is below the last seat", () => {
    const b = ballot({ seats: 2, options: votes(5, 4, 3, 3), homesVoted: 8 });
    expect(electionWinners(b).winners.map((w) => w.id)).toEqual(["o0", "o1"]);
    expect(resultHeadline(b)).toBe("Candidate 0 and Candidate 1 elected");
  });

  it("calls a single seat dead heat a tie", () => {
    expect(resultHeadline(ballot({ options: votes(2, 2), homesVoted: 4 }))).toBe("Tied");
  });
});

describe("the dues rule", () => {
  it("lets a home due today vote and stops one a day late", () => {
    expect(isPastDue(current)).toBe(false);
    expect(isPastDue(dueToday)).toBe(false);
    expect(isPastDue(dayLate)).toBe(true);
    // A credit with old dates is not past due.
    expect(isPastDue({ balanceCents: -500, daysPastDue: 40 })).toBe(false);
  });

  it("bars nobody while the rule is off", () => {
    expect(homesBarredByDues({ duesCurrentRequired: false }, [dayLate])).toEqual([]);
    expect(homesBarredByDues({ duesCurrentRequired: true }, [current, dayLate])).toEqual([dayLate]);
  });
});

describe("paperVoteProblem", () => {
  const open = ballot({ duesCurrentRequired: true });

  it("takes a vote for a home that has not voted", () => {
    expect(paperVoteProblem(open, current, TODAY)).toBeNull();
  });

  it("refuses a board vote and a ballot that has ended", () => {
    expect(paperVoteProblem(ballot({ audience: "board" }), current, TODAY)).toBe(
      "Paper votes are for ballots the owners vote on.",
    );
    expect(paperVoteProblem(ballot({ closesDate: "2026-08-19" }), current, TODAY)).toBe(
      "Voting on this ballot has ended.",
    );
  });

  it("asks for a home", () => {
    expect(paperVoteProblem(open, null, TODAY)).toBe("Pick the home the vote is for.");
  });

  it("refuses the same home entered twice", () => {
    const entered = ballot({
      entered: [
        { homeId: "h1", unit: "12", method: "paper", enteredBy: "Ana", enteredDate: TODAY },
      ],
    });
    expect(paperVoteProblem(entered, current, TODAY)).toBe(
      "Unit 12 already has a vote entered by the board.",
    );
  });

  it("refuses a home that voted online", () => {
    expect(paperVoteProblem(ballot({ votedHomeIds: ["h1"] }), current, TODAY)).toBe(
      "Unit 12 already voted online.",
    );
  });

  it("refuses a home a day late, and takes one due today", () => {
    expect(paperVoteProblem(open, dayLate, TODAY)).toBe(
      "Unit 16 is past due, and this ballot needs dues to be current.",
    );
    expect(paperVoteProblem(open, dueToday, TODAY)).toBeNull();
  });
});

describe("proxyHolderProblem", () => {
  it("needs nothing for paper", () => {
    expect(proxyHolderProblem("paper", "")).toBeNull();
  });

  it("needs a name for a proxy, of anybody, within the cap", () => {
    expect(proxyHolderProblem("proxy", " ")).toBe("Name who held the proxy.");
    expect(proxyHolderProblem("proxy", "Jo Neighbour")).toBeNull();
    expect(proxyHolderProblem("proxy", "x".repeat(121))).toBe(
      "Keep the name under 120 characters.",
    );
  });
});

describe("enteredCounts and enteredLine", () => {
  it("is null when the board entered nothing", () => {
    expect(enteredCounts(ballot())).toEqual({ paper: 0, proxy: 0 });
    expect(enteredLine(ballot())).toBeNull();
  });

  it("prefers the database's counts", () => {
    expect(enteredLine(ballot({ paperHomes: 3, proxyHomes: 2 }))).toBe(
      "3 on paper and 2 by proxy, entered by the board.",
    );
  });
});

describe("ownerVoteNotice", () => {
  const rule = { duesCurrentRequired: true };

  it("lets a current home vote, for that home", () => {
    expect(ownerVoteNotice(rule, [current])).toEqual({
      canVote: true,
      homeIds: ["h1"],
      line: "Homes behind on dues cannot vote on this.",
    });
  });

  it("stops a home a day late", () => {
    const n = ownerVoteNotice(rule, [dayLate]);
    expect(n.canVote).toBe(false);
    expect(n.homeIds).toEqual([]);
    expect(n.line).toBe(
      "Dues must be current to vote on this. Unit 16 is 1 day past due. Pay the balance, then vote.",
    );
  });

  it("lets one person with two homes vote for the current one", () => {
    const n = ownerVoteNotice(rule, [current, dayLate]);
    expect(n).toEqual({
      canVote: true,
      homeIds: ["h1"],
      line: "Unit 16 is past due, so your vote counts for your other home.",
    });
  });

  it("stops a home whose vote the board entered", () => {
    const n = ownerVoteNotice({}, [current], [{ homeId: "h1", method: "proxy" }]);
    expect(n).toEqual({
      canVote: false,
      homeIds: [],
      line: "The board entered your home's vote from a proxy.",
    });
  });

  it("says nothing with no rule and no entry", () => {
    expect(ownerVoteNotice({}, [current, dayLate])).toEqual({
      canVote: true,
      homeIds: ["h1", "h3"],
      line: null,
    });
  });
});

describe("seatingPlan", () => {
  const closed = ballot({
    status: "closed",
    seats: 2,
    homesVoted: 4,
    options: [
      { id: "a", label: "Arya Mehr", votes: 4, homeId: "h1" },
      { id: "b", label: "Sofia Bergman", votes: 3, homeId: "h2" },
      { id: "c", label: "Owen Brady", votes: 1, homeId: "h3" },
    ],
  });
  const homes = [
    { id: "h1", unit: "12", members: ["Arya Mehr"] },
    { id: "h2", unit: "14", members: ["Sofia Bergman"] },
    { id: "h3", unit: "16", members: ["Owen Brady"] },
  ];
  const accounts = [
    { id: "p1", homeId: "h1", name: "Arya Mehr", role: "resident" as const },
    { id: "p2", homeId: "h2", name: "Sofia Bergman", role: "treasurer" as const },
  ];

  it("plans a seat for each winner", () => {
    const plan = seatingPlan(closed, homes, accounts);
    expect(plan.map((r) => [r.name, r.accountId, r.problem])).toEqual([
      ["Arya Mehr", "p1", null],
      ["Sofia Bergman", "p2", null],
    ]);
  });

  it("passes over a winner not on the register, retired, or with nobody holding the home", () => {
    const b = ballot({
      ...closed,
      options: [
        { id: "a", label: "Arya Mehr", votes: 4 },
        { id: "b", label: "Sofia Bergman", votes: 3, homeId: "gone" },
      ],
    });
    expect(seatingPlan(b, homes, accounts).map((r) => r.problem)).toEqual([
      "Not linked to a home on the register. Seat them in Settings.",
      "No longer on the register.",
    ]);
    expect(seatingPlan(closed, homes, [accounts[1]])[0].problem).toBe(
      "Nobody holds that home. Seat them in Settings.",
    );
  });

  it("passes over two owners it cannot tell apart, and the President", () => {
    const twoOwners = [{ ...homes[0], members: ["Ana Mehr", "Ravi Mehr"] }, ...homes.slice(1)];
    expect(seatingPlan(closed, twoOwners, accounts)[0].problem).toBe(
      "Two owners on that home. Seat the right one in Settings.",
    );
    const president = [{ ...accounts[0], role: "president" as const }, accounts[1]];
    expect(seatingPlan(closed, homes, president)[0].problem).toBe(
      "Holds the presidency. Hand it over in Settings first.",
    );
  });
});

describe("seatingBlocked", () => {
  const closed = {
    status: "closed" as const,
    homesVoted: 2,
    options: [
      { id: "a", label: "A", votes: 2 },
      { id: "b", label: "B", votes: 1 },
    ],
  };

  it("lets a closed election with a winner through", () => {
    expect(seatingBlocked(ballot(closed))).toBeNull();
  });

  it("refuses anything but a closed election", () => {
    expect(seatingBlocked(ballot({ ...closed, kind: "poll" }))).toBe(
      "Only an election seats anybody.",
    );
    expect(seatingBlocked(ballot({ ...closed, status: "open" }))).toBe("Record the result first.");
  });

  it("refuses zero votes, a tie and a missed quorum", () => {
    expect(seatingBlocked(ballot({ ...closed, homesVoted: 0 }))).toBe(
      "Nobody was elected from this vote.",
    );
    expect(
      seatingBlocked(
        ballot({
          ...closed,
          options: [
            { id: "a", label: "A", votes: 1 },
            { id: "b", label: "B", votes: 1 },
          ],
        }),
      ),
    ).toBe("The last seat is tied. Settle the tie before seating anybody.");
    expect(seatingBlocked(ballot({ ...closed, quorumRequired: 3 }))).toBe(
      "The election missed quorum, so nobody is seated from it.",
    );
    expect(seatingBlocked(ballot({ ...closed, quorumRequired: 2 }))).toBeNull();
  });
});

describe("seatingChoiceProblem and seatedWords", () => {
  const plan = [
    { optionId: "a", name: "Arya Mehr", problem: null },
    { optionId: "b", name: "Sofia Bergman", problem: null },
  ];

  it("needs somebody seatable, an office each, and no office twice", () => {
    expect(seatingChoiceProblem([{ ...plan[0], problem: "No longer on the register." }], {})).toBe(
      "Nobody here can be seated from the result.",
    );
    expect(seatingChoiceProblem(plan, { a: "treasurer" })).toBe("Pick an office for each winner.");
    expect(seatingChoiceProblem(plan, { a: "treasurer", b: "treasurer" })).toBe(
      "Two winners cannot hold one office.",
    );
    expect(seatingChoiceProblem(plan, { a: "treasurer", b: "secretary" })).toBeNull();
  });

  it("words who was seated", () => {
    expect(seatedWords([])).toBe("Nobody was seated");
    expect(
      seatedWords([
        { optionId: "a", name: "Arya Mehr", office: "treasurer", seated: true },
        {
          optionId: "b",
          name: "Sofia Bergman",
          seated: false,
          reason: "No longer on the register.",
        },
        { optionId: "c", name: "Owen Brady", office: "secretary", seated: true },
      ]),
    ).toBe("Arya Mehr as Treasurer and Owen Brady as Secretary");
  });
});

describe("resultsSummary", () => {
  it("says nobody voted on an empty ballot", () => {
    const s = resultsSummary(ballot({ status: "closed", homesVoted: 0, quorumRequired: 2 }));
    expect(s).toEqual({
      headline: "Nobody voted",
      turnout: "0 of 10 homes voted.",
      entered: null,
      quorum:
        "Quorum was 2 homes, and it was missed by 2, so this vote does not decide the question.",
    });
  });

  it("counts paper and proxy, and a quorum met", () => {
    const s = resultsSummary(
      ballot({
        status: "closed",
        homesVoted: 3,
        paperHomes: 1,
        proxyHomes: 1,
        quorumRequired: 3,
        options: [
          { id: "a", label: "Arya Mehr", votes: 2 },
          { id: "b", label: "Sofia Bergman", votes: 1 },
        ],
      }),
    );
    expect(s).toEqual({
      headline: "Arya Mehr won",
      turnout: "3 of 10 homes voted.",
      entered: "Of those, 1 on paper and 1 by proxy, entered by the board.",
      quorum: "Quorum was 3 homes, and it was met.",
    });
  });
});
