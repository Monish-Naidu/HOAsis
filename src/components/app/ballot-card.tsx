"use client";

import { Check, Clock, Lock, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button, Card, Meter } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { homeCount } from "@/lib/metrics";
import { ballotPhase } from "@/lib/phases";
import type { Ballot } from "@/lib/types";
import { daysFromToday, formatDate, relativeDays } from "@/lib/utils";
import { placeLabel } from "@/lib/wording";
import {
  ballotTurnout,
  electionWinners,
  enteredLine,
  quorumLine,
  resultHeadline,
} from "@/lib/voting";

/**
 * Where a ballot stands, for the board.
 *
 * Votes in, when it ends, the result once it has one. The tally is derived
 * from the ballot itself so a vote cast a second ago is already counted.
 */
function tally(ballot: Ballot) {
  const votes = ballot.options.reduce((total, option) => total + option.votes, 0);
  const { winners, tied } = electionWinners(ballot);
  const winnerIds = new Set(winners.map((w) => w.id));
  return {
    votes,
    cast: ballotTurnout(ballot),
    tied,
    winning: (id: string) => winnerIds.has(id),
    share: (optionVotes: number) => (votes ? optionVotes / votes : 0),
    daysLeft: daysFromToday(ballot.closesDate),
  };
}

/** "Yes won, 41 of 60 homes voted", or why there is no winner yet. */
export function resultLine(ballot: Ballot): string {
  if (ballotTurnout(ballot) === 0) return "Nobody voted";
  const who = ballot.audience === "board" ? "board members" : "homes";
  return `${resultHeadline(ballot) ?? "Tied"} · ${ballotTurnout(ballot)} of ${ballot.eligible} ${who} voted`;
}

export function BallotCard({
  ballot,
  onClose,
  sealedNote = true,
  children,
}: {
  ballot: Ballot;
  /** The board's own work on this ballot, inside the card above its footer. */
  children?: ReactNode;
  /** Ends voting now. Absent on a closed ballot. */
  onClose?: (ballot: Ballot) => void;
  /**
   * The line saying results show when voting ends. Off where the page says
   * it once above a list of cards, rather than on every card.
   */
  sealedNote?: boolean;
}) {
  const { settings, community } = useAppState();
  const t = tally(ballot);
  const quorum = quorumLine(ballot);
  // The phase, so a card never says Open, or offers Close now, on a ballot
  // whose closing date has passed.
  const phase = ballotPhase(ballot);
  const scheduled = phase === "scheduled";
  const open = phase === "open";
  const who = ballot.audience === "board" ? "board members" : "homes";
  // Sealed until close, unless the board turned live results on in Settings.
  const showResults = (!open && !scheduled) || settings.showLiveVoteResults || t.daysLeft < 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={open ? "ok" : "neutral"}>
            {open ? "Open" : scheduled ? "Scheduled" : "Closed"}
          </Badge>
          <span className="inline-flex items-center gap-1 text-footnote text-fg-subtle">
            <Clock className="size-3" />
            {open
              ? `Ends ${relativeDays(ballot.closesDate)}`
              : scheduled
                ? `Opens ${formatDate(ballot.opensDate, "long")}`
                : `Ended ${formatDate(ballot.closesDate, "long")}`}
          </span>
          {scheduled ? null : (
            <span className="inline-flex items-center gap-1 text-footnote text-fg-subtle">
              <Users className="size-3" />
              {t.cast} of {ballot.eligible} {who} voted
            </span>
          )}
        </div>
        {/* A ballot keeps the number of homes it opened with, so a vote from
            spring reads 50 of 88 beside one from autumn at 1 of 89. Said once
            here so the two do not read as a mistake. */}
        {!scheduled && ballot.audience !== "board" && ballot.eligible !== homeCount(community) ? (
          <p className="mt-1 text-caption text-fg-subtle">
            Counted against the {ballot.eligible} homes on the register when voting opened.
          </p>
        ) : null}
        {/* The quorum, live while homes vote and final once it ends. */}
        {quorum ? <p className="mt-1 text-caption text-fg-subtle">{quorum}</p> : null}
        <h3 className="mt-1.5 text-headline font-semibold leading-snug tracking-[-0.015em] text-fg">
          {ballot.title}
        </h3>
        {ballot.body[0] ? (
          <p className="mt-1.5 line-clamp-2 text-body leading-relaxed text-fg-muted">
            {ballot.body[0]}
          </p>
        ) : null}
      </div>

      {showResults && t.cast > 0 ? (
        <div className="space-y-2.5 border-t border-border px-5 py-4">
          {ballot.options.map((o) => {
            const share = t.share(o.votes);
            const winning = !open && !t.tied && t.winning(o.id);
            return (
              <div key={o.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-body text-fg">
                    <span className="min-w-0 break-words">{o.label}</span>
                    {winning ? <Check className="size-3.5 shrink-0 text-ok" /> : null}
                  </span>
                  <span className="tnum shrink-0 text-footnote font-medium text-fg-muted">
                    {o.votes} · {Math.round(share * 100)}%
                  </span>
                </div>
                <Meter
                  value={share}
                  tone={winning ? "ok" : "neutral"}
                  aria-label={`${o.label}: ${o.votes} votes`}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {/* What the board typed in, per home: how it arrived and who entered
          it. Which choice it was is the tally's business, not this list's. */}
      {(ballot.entered?.length ?? 0) > 0 ? (
        <div className="border-t border-border px-5 py-3">
          <details>
            <summary className="cursor-pointer text-footnote font-medium text-fg-muted">
              {enteredLine(ballot)}
            </summary>
            <ul className="mt-2 space-y-1">
              {(ballot.entered ?? []).map((e) => (
                <li key={e.homeId} className="text-footnote text-fg-muted">
                  {placeLabel(e.unit)},{" "}
                  {e.method === "proxy"
                    ? `proxy held by ${e.proxyHolder ?? "the board"}`
                    : "paper ballot"}
                  , entered by {e.enteredBy} on {formatDate(e.enteredDate)}.
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}

      {open && !showResults && sealedNote ? (
        <div className="flex items-start gap-2 border-t border-border px-5 py-3">
          <Lock className="mt-px size-3.5 shrink-0 text-fg-subtle" />
          <p className="text-footnote leading-snug text-fg-muted">
            Results show when voting ends. Turn on live results in Settings to see them now.
          </p>
        </div>
      ) : null}

      {children ? <div className="border-t border-border px-5 py-3">{children}</div> : null}

      {open && onClose ? (
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 py-2.5">
          <span className="text-footnote text-fg-muted">
            Ends on its own {formatDate(ballot.closesDate, "long")}.
          </span>
          <Button variant="secondary" size="sm" onClick={() => onClose(ballot)}>
            End voting now
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
