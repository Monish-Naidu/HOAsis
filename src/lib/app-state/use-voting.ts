import { useCallback } from "react";
import { caps, DEFAULT_ROLE_CAPABILITIES, DEFAULT_ROLE_VIEWS } from "@/lib/data/accounts";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ROLE_LABEL, type Ballot, type Office, type SeatedWinner } from "@/lib/types";
import { todayIsoDate } from "@/lib/utils";
import {
  ballotTurnout,
  paperVoteProblem,
  proxyHolderProblem,
  seatedWords,
  seatingBlocked,
  seatingChoiceProblem,
  seatingPlan,
} from "@/lib/voting";
import { placeLabel } from "@/lib/wording";
import {
  type AppDeps,
  emailNotice,
  logDemoActivity,
  READ_ONLY_MESSAGE,
  remoteWrite,
  sliceStore,
  ValidationError,
} from "./core";

/**
 * The annual meeting's votes, after the owners have voted online: a paper
 * ballot or a proxy the board types in, seating the winners of an election,
 * and the results emailed to every home.
 *
 * Each signed in write is one SQL function (0118) that keeps the rules: one
 * vote per home whichever way it came, the dues rule, only the President
 * seats officers, and the results go once. The demo applies the same rules
 * to its own slices.
 */
export function useVotingActions(deps: AppDeps) {
  const { remote, communityId, account, can } = deps;

  const ballotsNow = useCallback(
    (): Ballot[] =>
      remote.community
        ? remote.community.ballots
        : sliceStore(communityId, "ballots").getSnapshot(),
    [remote.community, communityId],
  );

  /**
   * A vote the board enters for a home from a paper ballot or a proxy. Refused
   * for a home that already voted, either way, and for a past-due home when
   * the ballot needs dues to be current.
   */
  const enterPaperVote = useCallback(
    (input: {
      ballotId: string;
      homeId: string;
      optionIds: string[];
      method: "paper" | "proxy";
      proxyHolder?: string;
    }): Promise<boolean> => {
      if (!remote.community && !can("voting")) throw new ValidationError(READ_ONLY_MESSAGE, {});
      const ballot = ballotsNow().find((b) => b.id === input.ballotId);
      if (!ballot) return Promise.resolve(false);
      const homes = remote.community
        ? remote.community.homes
        : sliceStore(communityId, "homes").getSnapshot();
      const home = homes.find((h) => h.id === input.homeId);
      const holder = (input.proxyHolder ?? "").trim();
      const picks = [...new Set(input.optionIds)];
      const seats = Math.max(1, ballot.seats ?? 1);
      const problem =
        paperVoteProblem(ballot, home) ??
        proxyHolderProblem(input.method, holder) ??
        (picks.length === 0
          ? "Pick the choice on the ballot."
          : picks.length > seats
            ? `Pick at most ${seats}.`
            : picks.some((id) => !ballot.options.some((o) => o.id === id))
              ? "That choice is not on this ballot."
              : null);
      if (problem || !home) {
        throw new ValidationError(problem ?? "Pick the home the vote is for.", {
          ballotId: input.ballotId,
          homeId: input.homeId,
        });
      }
      if (remote.community) {
        return remoteWrite("Entering the vote", () =>
          supabaseBrowser().rpc("enter_paper_vote", {
            p_ballot_id: ballot.id,
            p_unit_id: home.id,
            p_option_ids: picks,
            p_method: input.method,
            p_proxy_holder: input.method === "proxy" ? holder : null,
          }),
        );
      }
      const today = todayIsoDate();
      const how = input.method === "proxy" ? "a proxy" : "a paper";
      logDemoActivity(
        communityId,
        "ballot",
        `Entered ${how} vote for ${placeLabel(home.unit)} on "${ballot.title}"`,
        { unit: home.unit, method: input.method },
      );
      sliceStore(communityId, "ballots").update((all) =>
        all.map((b) =>
          b.id === ballot.id
            ? {
                ...b,
                homesVoted: ballotTurnout(b) + 1,
                options: b.options.map((o) =>
                  picks.includes(o.id) ? { ...o, votes: o.votes + 1 } : o,
                ),
                entered: [
                  ...(b.entered ?? []),
                  {
                    homeId: home.id,
                    unit: home.unit,
                    method: input.method,
                    enteredBy: account?.name ?? "The board",
                    enteredDate: today,
                    proxyHolder: input.method === "proxy" ? holder : undefined,
                  },
                ],
              }
            : b,
        ),
      );
      return Promise.resolve(true);
    },
    [can, ballotsNow, remote.community, communityId, account],
  );

  /**
   * Seats each winner of a closed election in the office the board picked for
   * them. The sitting holder of that office goes back to being a resident.
   * Once per ballot: pressed again, nothing changes.
   */
  const seatWinners = useCallback(
    (ballotId: string, offices: Record<string, Office | "">): Promise<string | false> => {
      if (!remote.community && !can("voting")) throw new ValidationError(READ_ONLY_MESSAGE, {});
      const ballot = ballotsNow().find((b) => b.id === ballotId);
      if (!ballot) return Promise.resolve(false);
      if (ballot.winnersSeatedDate) return Promise.resolve(seatedWords(ballot.seated ?? []));
      const refuse = (message: string): never => {
        throw new ValidationError(message, { ballotId });
      };
      const blocked = seatingBlocked(ballot);
      if (blocked) refuse(blocked);

      if (remote.community) {
        const rc = remote.community;
        const plan = seatingPlan(ballot, rc.homes, rc.accounts);
        const problem = seatingChoiceProblem(plan, offices);
        if (problem) refuse(problem);
        let words = "";
        return remoteWrite("Seating the winners", async () => {
          const result = await supabaseBrowser().rpc("seat_election_winners", {
            p_ballot_id: ballotId,
            p_offices: Object.fromEntries(
              plan.filter((r) => !r.problem).map((r) => [r.optionId, offices[r.optionId]]),
            ),
          });
          if (!result.error) words = seatedWords(fromSeatedRows(result.data));
          return result;
        }).then((ok) => (ok ? words : false));
      }

      const accounts = sliceStore(communityId, "accounts").getSnapshot();
      const homes = sliceStore(communityId, "homes").getSnapshot();
      const plan = seatingPlan(ballot, homes, accounts);
      const problem = seatingChoiceProblem(plan, offices);
      if (problem) refuse(problem);

      const seated: SeatedWinner[] = plan.map((row) => ({
        optionId: row.optionId,
        name: row.name,
        unit: row.unit,
        office: offices[row.optionId] || undefined,
        seated: !row.problem,
        reason: row.problem ?? undefined,
      }));
      const toSeat = seated.filter((s) => s.seated);
      const winnerAccount = new Map(
        plan
          .filter((r) => !r.problem && r.accountId)
          .map((r) => [r.accountId, offices[r.optionId] as Office]),
      );
      const winnerHome = new Map(
        plan.filter((r) => !r.problem).map((r) => [r.homeId, offices[r.optionId] as Office]),
      );
      const takenOffices = new Set(toSeat.map((s) => s.office as Office));

      sliceStore(communityId, "accounts").update((all) =>
        all.map((a) => {
          const office = winnerAccount.get(a.id);
          if (office) {
            return {
              ...a,
              role: office,
              capabilities: caps(DEFAULT_ROLE_CAPABILITIES[office] ?? []),
              views: caps(DEFAULT_ROLE_VIEWS[office] ?? []),
            };
          }
          // The office's sitting holder steps down when a winner takes it.
          if (a.role !== "resident" && a.role !== "president" && takenOffices.has(a.role)) {
            return { ...a, role: "resident" as const, capabilities: caps([]), views: caps([]) };
          }
          return a;
        }),
      );
      const labels = new Set([...takenOffices].map((o) => ROLE_LABEL[o]));
      sliceStore(communityId, "homes").update((all) =>
        all.map((h) => {
          const office = winnerHome.get(h.id);
          if (office) return { ...h, boardRole: ROLE_LABEL[office] };
          return h.boardRole && labels.has(h.boardRole) ? { ...h, boardRole: undefined } : h;
        }),
      );
      const words = seatedWords(seated);
      logDemoActivity(communityId, "ballot", `Seated the winners of "${ballot.title}": ${words}`, {
        seated: toSeat.length,
        not_seated: seated.length - toSeat.length,
      });
      sliceStore(communityId, "ballots").update((all) =>
        all.map((b) =>
          b.id === ballotId
            ? {
                ...b,
                winnersSeatedDate: todayIsoDate(),
                winnersSeatedBy: account?.name ?? "The board",
                seated,
              }
            : b,
        ),
      );
      return Promise.resolve(words);
    },
    [can, ballotsNow, remote.community, communityId, account],
  );

  /**
   * The result of a closed owner vote to every home, once. Resolves with the
   * words for the toast, or false when nothing went.
   */
  const emailResults = useCallback(
    async (ballotId: string): Promise<string | false> => {
      if (!remote.community && !can("voting")) throw new ValidationError(READ_ONLY_MESSAGE, {});
      const ballot = ballotsNow().find((b) => b.id === ballotId);
      if (!ballot) return false;
      if (ballot.audience !== "owners") {
        throw new ValidationError("Board votes are not emailed to the homes.", { ballotId });
      }
      if (ballot.status !== "closed" && ballot.status !== "certified") {
        throw new ValidationError("Record the result first.", { ballotId });
      }
      if (ballot.resultsEmailedDate) return "The results already went to every home.";
      if (remote.community) {
        const rc = remote.community;
        let first = false;
        const begun = await remoteWrite("Emailing the results", async () => {
          const result = await supabaseBrowser().rpc("begin_results_email", {
            p_ballot_id: ballotId,
          });
          first = result.data === true;
          return result;
        });
        if (!begun) return false;
        if (!first) return "The results already went to every home.";
        const outcome = await emailNotice(rc.id, { kind: "results", id: ballotId }, true);
        if (!outcome.answered) return false;
        if (outcome.sent === 0) return outcome.reason ?? "No email went.";
        const short = outcome.failed + outcome.remaining;
        return short > 0
          ? `Results emailed to ${outcome.sent}. ${short} could not be reached.`
          : `Results emailed to ${outcome.sent}.`;
      }
      logDemoActivity(communityId, "ballot", `Emailed the results of "${ballot.title}"`, {});
      sliceStore(communityId, "ballots").update((all) =>
        all.map((b) => (b.id === ballotId ? { ...b, resultsEmailedDate: todayIsoDate() } : b)),
      );
      // The demo has nobody to email, so the results are only marked as sent.
      return "Results marked as sent. The demo emails nobody.";
    },
    [can, ballotsNow, remote.community, communityId],
  );

  return { enterPaperVote, seatWinners, emailResults };
}

/** The jsonb seat_election_winners returns, as the screens read it. */
function fromSeatedRows(data: unknown): SeatedWinner[] {
  if (!Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => ({
    optionId: String(row.option_id ?? ""),
    name: String(row.name ?? ""),
    unit: typeof row.unit === "string" ? row.unit : undefined,
    office: typeof row.office === "string" ? (row.office as Office) : undefined,
    seated: row.seated === true,
    reason: typeof row.reason === "string" ? row.reason : undefined,
  }));
}
