"use client";

import { Check, Clock, Lock, Users } from "lucide-react";
import { Badge, Button, Card, Meter } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import type { Ballot } from "@/lib/types";
import { daysFromToday, formatDate, relativeDays } from "@/lib/utils";

/**
 * Where a ballot stands, for the board.
 *
 * Votes in, when it ends, the result once it has one. The tally is derived
 * from the ballot itself so a vote cast a second ago is already counted.
 */
export function tally(ballot: Ballot) {
  const votes = ballot.options.reduce((total, option) => total + option.votes, 0);
  // Quorum counts households that voted, not marks they made. A real
  // association counts them in the database; the demo's fixtures predate
  // that and divide the marks back down by the seats.
  const cast = ballot.homesVoted ?? Math.round(votes / Math.max(1, ballot.seats ?? 1));
  const leading = [...ballot.options].sort((a, b) => b.votes - a.votes)[0];
  const tied = ballot.options.filter((o) => o.votes === leading?.votes).length > 1;
  return {
    votes,
    cast,
    leading,
    tied,
    share: (optionVotes: number) => (votes ? optionVotes / votes : 0),
    daysLeft: daysFromToday(ballot.closesDate),
  };
}

/** "Yes won, 41 of 60 homes voted", or why there is no winner yet. */
export function resultLine(ballot: Ballot): string {
  const t = tally(ballot);
  const who = ballot.audience === "board" ? "directors" : "homes";
  if (t.cast === 0) return "Nobody voted";
  const seats = Math.max(1, ballot.seats ?? 1);
  if (seats > 1) {
    // As many winners as seats, and a tie only where it decides the last one.
    const ranked = [...ballot.options].sort((a, b) => b.votes - a.votes);
    const last = ranked[seats - 1];
    if (last && ranked[seats] && ranked[seats].votes === last.votes) {
      return `Tied for the last seat · ${t.cast} of ${ballot.eligible} ${who} voted`;
    }
    const elected = ranked.slice(0, seats).filter((o) => o.votes > 0).map((o) => o.label);
    return `${elected.join(" and ")} elected · ${t.cast} of ${ballot.eligible} ${who} voted`;
  }
  if (t.tied) return `Tied · ${t.cast} of ${ballot.eligible} ${who} voted`;
  return `${t.leading.label} won · ${t.cast} of ${ballot.eligible} ${who} voted`;
}

export function BallotCard({
  ballot,
  onClose,
  sealedNote = true,
}: {
  ballot: Ballot;
  /** Ends voting now. Absent on a closed ballot. */
  onClose?: (ballot: Ballot) => void;
  /**
   * The line saying results show when voting ends. Off where the page says
   * it once above a list of cards, rather than on every card.
   */
  sealedNote?: boolean;
}) {
  const { settings } = useAppState();
  const t = tally(ballot);
  const scheduled = ballot.status === "scheduled";
  const open = ballot.status === "open";
  const who = ballot.audience === "board" ? "directors" : "homes";
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
            const winning = !open && !t.tied && o.id === t.leading.id;
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

      {open && !showResults && sealedNote ? (
        <div className="flex items-start gap-2 border-t border-border px-5 py-3">
          <Lock className="mt-px size-3.5 shrink-0 text-fg-subtle" />
          <p className="text-footnote leading-snug text-fg-muted">
            Results show when voting ends. Turn on live results in Settings to see them now.
          </p>
        </div>
      ) : null}

      {open && onClose ? (
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 py-2.5">
          <span className="text-footnote text-fg-muted">
            Ends on its own {formatDate(ballot.closesDate, "long")}.
          </span>
          <Button variant="secondary" size="sm" onClick={() => onClose(ballot)}>
            Close now
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
