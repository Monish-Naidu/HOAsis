import { ballotPhase } from "@/lib/phases";
import {
  ROLE_LABEL,
  type Account,
  type AccountRole,
  type Ballot,
  type Home,
  type Office,
  type SeatedWinner,
} from "@/lib/types";
import { pastDueLabel, pluralize, todayIsoDate } from "@/lib/utils";
import { placeLabel } from "@/lib/wording";

/**
 * The rules of a vote at the annual meeting: quorum, votes the board enters
 * from paper ballots and proxies, dues that must be current, and seating the
 * winners of an election. The database keeps the same rules (0118); these
 * are what the screens say before anything is pressed, and what the demo
 * does in place of the database.
 *
 * Pure: no clock of its own, no fetch.
 */

/**
 * The offices an election can seat. The presidency is a handover between two
 * people (transfer_presidency), done in Settings, so it is not one of them.
 */
export const SEATABLE_OFFICES: readonly Office[] = ["vice-president", "treasurer", "secretary"];

type TallyFields = Pick<Ballot, "options" | "seats" | "homesVoted">;

/**
 * Homes that voted. Counted by the database for a real association; the
 * demo's fixtures predate that and divide the marks back down by the seats.
 */
export function ballotTurnout(ballot: TallyFields): number {
  if (ballot.homesVoted !== undefined) return ballot.homesVoted;
  const marks = ballot.options.reduce((total, option) => total + option.votes, 0);
  return Math.round(marks / Math.max(1, ballot.seats ?? 1));
}

export type QuorumUnit = "homes" | "percent";

/**
 * The quorum a board typed, as the number of homes the ballot keeps.
 *
 * Bylaws say it either way ("twenty percent of the total voting interests",
 * "27 homes"), so the form takes either and the ballot stores homes: a
 * percent is rounded up, because 17.6 homes is not a quorum until the
 * eighteenth votes. Empty or zero is no quorum.
 */
export function quorumFromInput(
  raw: string,
  unit: QuorumUnit,
  eligible: number,
): { count: number; problem: null } | { count: null; problem: string } {
  const text = raw.trim();
  if (text === "") return { count: 0, problem: null };
  if (unit === "homes") {
    if (!/^\d+$/.test(text)) return { count: null, problem: "Quorum is a whole number of homes." };
    const homes = Number(text);
    if (homes > eligible) {
      return { count: null, problem: `Only ${pluralize(eligible, "home")} can vote.` };
    }
    return { count: homes, problem: null };
  }
  if (!/^\d+(\.\d+)?$/.test(text) || Number(text) > 100) {
    return { count: null, problem: "Quorum is a percent from 0 to 100." };
  }
  // The small epsilon keeps 25% of 88 at 22 rather than 23 from float error.
  return { count: Math.max(0, Math.ceil((Number(text) * eligible) / 100 - 1e-9)), problem: null };
}

export interface QuorumState {
  required: number;
  voted: number;
  met: boolean;
  /** Homes still needed; zero once met. */
  short: number;
}

/** Where a ballot stands against its quorum, or null when it has none. */
export function quorumState(
  ballot: TallyFields & Pick<Ballot, "quorumRequired">,
): QuorumState | null {
  const required = Math.max(0, ballot.quorumRequired);
  if (required === 0) return null;
  const voted = ballotTurnout(ballot);
  return { required, voted, met: voted >= required, short: Math.max(0, required - voted) };
}

/**
 * One line on quorum, live while voting runs and final once it ends.
 * "Quorum missed by 1. 26 homes voted, 27 were needed."
 */
export function quorumLine(
  ballot: TallyFields & Pick<Ballot, "quorumRequired" | "status" | "closesDate">,
  today: string = todayIsoDate(),
): string | null {
  const q = quorumState(ballot);
  if (!q) return null;
  const phase = ballotPhase(ballot, today);
  const voted = pluralize(q.voted, "home");
  if (phase === "closed" || phase === "certified") {
    return q.met
      ? `Quorum met. ${voted} voted, ${q.required} were needed.`
      : `Quorum missed by ${q.short}. ${voted} voted, ${q.required} were needed.`;
  }
  return q.met
    ? `Quorum reached. ${voted} voted, ${q.required} needed.`
    : `Quorum: ${q.voted} of ${q.required} homes so far. ${q.short} more needed.`;
}

/**
 * The winners of a vote: as many as there are seats, ranked by votes. When
 * the last seat is tied there are none, because the tie is what decides who
 * sits and the board settles it before anybody is seated.
 */
export function electionWinners(ballot: Pick<Ballot, "options" | "seats">): {
  winners: Ballot["options"];
  tied: boolean;
} {
  const seats = Math.max(1, ballot.seats ?? 1);
  const ranked = [...ballot.options].sort((a, b) => b.votes - a.votes);
  const last = ranked[seats - 1];
  const next = ranked[seats];
  if (last && next && last.votes > 0 && last.votes === next.votes) {
    return { winners: [], tied: true };
  }
  return { winners: ranked.slice(0, seats).filter((o) => o.votes > 0), tied: false };
}

/** "Yes won", "Tied", "Arya Mehr and Sofia Bergman elected", or null when nobody voted. */
export function resultHeadline(ballot: TallyFields): string | null {
  if (ballotTurnout(ballot) === 0) return null;
  const seats = Math.max(1, ballot.seats ?? 1);
  const { winners, tied } = electionWinners(ballot);
  if (seats > 1) {
    if (tied) return "Tied for the last place";
    return `${winners.map((o) => o.label).join(" and ")} elected`;
  }
  if (tied || winners.length === 0) return "Tied";
  return `${winners[0].label} won`;
}

/** Past due: a balance that includes a bill whose due date has gone by. */
export function isPastDue(home: Pick<Home, "balanceCents" | "daysPastDue">): boolean {
  return home.balanceCents > 0 && home.daysPastDue > 0;
}

/** The homes a ballot's dues rule keeps from voting. None while the rule is off. */
export function homesBarredByDues<H extends Pick<Home, "balanceCents" | "daysPastDue">>(
  ballot: Pick<Ballot, "duesCurrentRequired">,
  homes: readonly H[],
): H[] {
  return ballot.duesCurrentRequired ? homes.filter(isPastDue) : [];
}

/** Homes whose vote the board entered, by how. */
export function enteredCounts(ballot: Pick<Ballot, "entered" | "paperHomes" | "proxyHomes">): {
  paper: number;
  proxy: number;
} {
  const entered = ballot.entered ?? [];
  return {
    paper: ballot.paperHomes ?? entered.filter((e) => e.method === "paper").length,
    proxy: ballot.proxyHomes ?? entered.filter((e) => e.method === "proxy").length,
  };
}

/** "3 on paper and 2 by proxy, entered by the board.", or null when the board entered none. */
export function enteredLine(
  ballot: Pick<Ballot, "entered" | "paperHomes" | "proxyHomes">,
): string | null {
  const { paper, proxy } = enteredCounts(ballot);
  const parts = [paper ? `${paper} on paper` : "", proxy ? `${proxy} by proxy` : ""].filter(
    Boolean,
  );
  return parts.length ? `${parts.join(" and ")}, entered by the board.` : null;
}

/**
 * Why the board cannot enter a vote for this home, or null when it can.
 * The same refusals as enter_paper_vote (0118), in the same order.
 */
export function paperVoteProblem(
  ballot: Pick<
    Ballot,
    "audience" | "status" | "closesDate" | "entered" | "votedHomeIds" | "duesCurrentRequired"
  >,
  home: Pick<Home, "id" | "unit" | "balanceCents" | "daysPastDue"> | null | undefined,
  today: string = todayIsoDate(),
): string | null {
  if (ballot.audience !== "owners") return "Paper votes are for ballots the owners vote on.";
  if (ballotPhase(ballot, today) !== "open") return "Voting on this ballot has ended.";
  if (!home) return "Pick the home the vote is for.";
  const where = placeLabel(home.unit);
  if ((ballot.entered ?? []).some((e) => e.homeId === home.id)) {
    return `${where} already has a vote entered by the board.`;
  }
  if ((ballot.votedHomeIds ?? []).includes(home.id)) return `${where} already voted online.`;
  if (ballot.duesCurrentRequired && isPastDue(home)) {
    return `${where} is past due, and this ballot needs dues to be current.`;
  }
  return null;
}

/** The longest proxy holder's name kept, the same cap enter_paper_vote (0118) keeps. */
export const MAX_PROXY_HOLDER_LENGTH = 120;

/**
 * A proxy names who held it; a paper ballot needs nothing more. The holder
 * need not hold a seat on the home: a proxy is whoever the owner sent.
 */
export function proxyHolderProblem(method: "paper" | "proxy", holder: string): string | null {
  if (method !== "proxy") return null;
  const name = holder.trim();
  if (name.length < 2) return "Name who held the proxy.";
  if (name.length > MAX_PROXY_HOLDER_LENGTH) {
    return `Keep the name under ${MAX_PROXY_HOLDER_LENGTH} characters.`;
  }
  return null;
}

/**
 * What the owner's ballot says about their own homes: whether they can vote
 * at all, the one line that says why not or what counts, and the homes the
 * vote is cast for, as cast_votes (0118) picks them.
 */
export function ownerVoteNotice(
  ballot: Pick<Ballot, "duesCurrentRequired">,
  myHomes: readonly Pick<Home, "id" | "unit" | "balanceCents" | "daysPastDue">[],
  enteredForMine: readonly { homeId: string; method: "paper" | "proxy" }[] = [],
): { canVote: boolean; line: string | null; homeIds: string[] } {
  const entered = new Set(enteredForMine.map((e) => e.homeId));
  const barred = homesBarredByDues(ballot, myHomes).filter((h) => !entered.has(h.id));
  const able = myHomes.filter((h) => !entered.has(h.id) && !barred.includes(h));
  const homeIds = able.map((h) => h.id);
  if (myHomes.length > 0 && able.length === 0) {
    if (barred.length > 0) {
      const first = barred[0];
      return {
        canVote: false,
        homeIds,
        line: `Dues must be current to vote on this. ${placeLabel(first.unit)} is ${pastDueLabel(
          first.daysPastDue,
        ).toLowerCase()}. Pay the balance, then vote.`,
      };
    }
    const how = enteredForMine[0]?.method === "proxy" ? "a proxy" : "a paper ballot";
    return { canVote: false, homeIds, line: `The board entered your home's vote from ${how}.` };
  }
  const units = (homes: readonly { unit: string }[]) =>
    homes.map((h) => placeLabel(h.unit)).join(" and ");
  const rest =
    able.length === 1
      ? "your vote counts for your other home"
      : `your vote counts for your other ${pluralize(able.length, "home")}`;
  if (barred.length > 0) {
    const verb = barred.length === 1 ? "is" : "are";
    return { canVote: true, homeIds, line: `${units(barred)} ${verb} past due, so ${rest}.` };
  }
  const done = myHomes.filter((h) => entered.has(h.id));
  if (done.length > 0) {
    return {
      canVote: true,
      homeIds,
      line: `The board entered the vote for ${units(done)}, so ${rest}.`,
    };
  }
  return {
    canVote: true,
    homeIds,
    line: ballot.duesCurrentRequired ? "Homes behind on dues cannot vote on this." : null,
  };
}

export interface SeatingRow {
  optionId: string;
  name: string;
  homeId?: string;
  unit?: string;
  /** The account that will hold the office, in the demo. */
  accountId?: string;
  currentRole?: AccountRole;
  /** Why this winner cannot be seated from here, or null. */
  problem: string | null;
}

/**
 * Each winner of a closed election and whether they can be seated from the
 * result: their home must still be on the register, the seat must be told
 * apart from a co-owner's, and the President keeps the presidency until it
 * is handed over in Settings.
 */
export function seatingPlan(
  ballot: Pick<Ballot, "options" | "seats">,
  homes: readonly Pick<Home, "id" | "unit" | "members">[],
  accounts: readonly Pick<Account, "id" | "homeId" | "name" | "role">[],
): SeatingRow[] {
  return electionWinners(ballot).winners.map((option) => {
    const base = { optionId: option.id, name: option.label };
    if (!option.homeId) {
      return { ...base, problem: "Not linked to a home on the register. Seat them in Settings." };
    }
    const home = homes.find((h) => h.id === option.homeId);
    if (!home) return { ...base, problem: "No longer on the register." };
    const sameName = (name: string) =>
      name.trim().toLowerCase() === option.label.trim().toLowerCase();
    const onHome = accounts.filter((a) => a.homeId === home.id);
    const account =
      onHome.find((a) => sameName(a.name)) ?? (onHome.length === 1 ? onHome[0] : undefined);
    const row = {
      ...base,
      homeId: home.id,
      unit: home.unit,
      accountId: account?.id,
      currentRole: account?.role,
    };
    if (home.members.length > 1 && !home.members.some(sameName)) {
      return { ...row, problem: "Two owners on that home. Seat the right one in Settings." };
    }
    if (!account) return { ...row, problem: "Nobody holds that home. Seat them in Settings." };
    if (account.role === "president") {
      return { ...row, problem: "Holds the presidency. Hand it over in Settings first." };
    }
    return { ...row, problem: null };
  });
}

/**
 * Why nobody can be seated from this ballot at all, or null. The same
 * refusals seat_election_winners (0118) raises before it looks at anybody.
 */
export function seatingBlocked(
  ballot: TallyFields & Pick<Ballot, "kind" | "status" | "quorumRequired">,
): string | null {
  if (ballot.kind !== "election") return "Only an election seats anybody.";
  if (ballot.status !== "closed" && ballot.status !== "certified") {
    return "Record the result first.";
  }
  if (ballotTurnout(ballot) === 0) return "Nobody was elected from this vote.";
  if (electionWinners(ballot).tied) {
    return "The last seat is tied. Settle the tie before seating anybody.";
  }
  const quorum = quorumState(ballot);
  if (quorum && !quorum.met) return "The election missed quorum, so nobody is seated from it.";
  return null;
}

/** Why the offices picked cannot be seated, or null. */
export function seatingChoiceProblem(
  plan: readonly SeatingRow[],
  offices: Readonly<Record<string, Office | "">>,
): string | null {
  const seatable = plan.filter((row) => !row.problem);
  if (seatable.length === 0) return "Nobody here can be seated from the result.";
  const picked = seatable.map((row) => offices[row.optionId]);
  if (picked.some((office) => !office || !SEATABLE_OFFICES.includes(office))) {
    return "Pick an office for each winner.";
  }
  if (new Set(picked).size !== picked.length) return "Two winners cannot hold one office.";
  return null;
}

/** "Monish Naidu as Treasurer and Owen Brady as Secretary", for the toast and Activity. */
export function seatedWords(seated: readonly SeatedWinner[]): string {
  const done = seated.filter((s) => s.seated && s.office);
  if (done.length === 0) return "Nobody was seated";
  return done.map((s) => `${s.name} as ${ROLE_LABEL[s.office as Office]}`).join(" and ");
}

/** The words of a results email: what won, who voted, and whether it counted. */
export function resultsSummary(
  ballot: TallyFields &
    Pick<
      Ballot,
      | "eligible"
      | "quorumRequired"
      | "status"
      | "closesDate"
      | "entered"
      | "paperHomes"
      | "proxyHomes"
    >,
): { headline: string; turnout: string; quorum: string | null; entered: string | null } {
  const voted = ballotTurnout(ballot);
  const { paper, proxy } = enteredCounts(ballot);
  const how = [paper ? `${paper} on paper` : "", proxy ? `${proxy} by proxy` : ""].filter(Boolean);
  const q = quorumState(ballot);
  return {
    headline: resultHeadline(ballot) ?? "Nobody voted",
    turnout: `${voted} of ${ballot.eligible} homes voted.`,
    entered: how.length ? `Of those, ${how.join(" and ")}, entered by the board.` : null,
    quorum: !q
      ? null
      : q.met
        ? `Quorum was ${pluralize(q.required, "home")}, and it was met.`
        : `Quorum was ${pluralize(q.required, "home")}, and it was missed by ${q.short}, so this vote does not decide the question.`,
  };
}
