"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock } from "lucide-react";
import { Badge, Card, Meter } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import type { Ballot } from "@/lib/types";
import { cn, daysFromToday, formatDate, relativeDays } from "@/lib/utils";

/**
 * A question and its choices. Tapping a choice is the vote.
 *
 * There is no separate submit step: one vote per home, changeable until the
 * ballot ends, and the card says what you chose. Receipts still exist on the
 * record for anyone who asks; they are no longer the first thing shown.
 */
export function BallotVote({ ballot }: { ballot: Ballot }) {
  const { settings, castVote } = useAppState();
  const [expanded, setExpanded] = useState(false);
  const mine = ballot.myVoteOptionId;
  const closed = ballot.status !== "open" || daysFromToday(ballot.closesDate) < 0;
  const votes = ballot.options.reduce((t, o) => t + o.votes, 0);
  const cast = Math.round(votes / Math.max(1, ballot.seats ?? 1));
  const showResults = closed || settings.showLiveVoteResults;
  const leading = [...ballot.options].sort((a, b) => b.votes - a.votes)[0];
  const tied = ballot.options.filter((o) => o.votes === leading?.votes).length > 1;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {closed ? (
            <Badge tone="neutral">Closed</Badge>
          ) : mine ? (
            <Badge tone="ok">
              <Check className="size-2.5" />
              You voted
            </Badge>
          ) : (
            <Badge tone="warn">Your vote is needed</Badge>
          )}
          <span className="inline-flex items-center gap-1 text-[13px] text-fg-subtle">
            <Clock className="size-3" />
            {closed
              ? `Ended ${formatDate(ballot.closesDate, "long")}`
              : `Ends ${relativeDays(ballot.closesDate)}`}
          </span>
        </div>
        <h3 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-fg">
          {ballot.title}
        </h3>
        {ballot.body.length ? (
          <>
            <div className="mt-2 space-y-2">
              {(expanded ? ballot.body : ballot.body.slice(0, 1)).map((p) => (
                <p key={p} className="text-[15px] leading-relaxed text-fg-muted">
                  {p}
                </p>
              ))}
            </div>
            {ballot.body.length > 1 ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-accent"
              >
                {expanded ? "Show less" : "Read more"}
                <ChevronDown
                  className={cn("size-3 transition-transform", expanded && "rotate-180")}
                />
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {!closed ? (
        <div className="space-y-2 border-t border-border px-4 py-3">
          {ballot.options.map((o) => {
            const picked = mine === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={picked}
                onClick={() => {
                  if (!picked) castVote(ballot.id, o.id);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
                  picked
                    ? "border-navy-700 bg-brand-soft dark:border-navy-300"
                    : "border-border hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    picked
                      ? "border-navy-700 bg-navy-700 text-navy-50 dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950"
                      : "border-border-2",
                  )}
                >
                  {picked ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-fg">{o.label}</span>
                  {o.detail ? (
                    <span className="block text-[13px] text-fg-muted">{o.detail}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
          <p className="pt-1 text-[13px] text-fg-subtle">
            {mine
              ? "Tap another choice to change your vote before it ends."
              : "Tap a choice to vote. One vote per home."}
          </p>
        </div>
      ) : null}

      {showResults && cast > 0 ? (
        <div className="space-y-2.5 border-t border-border bg-surface-2 px-4 py-3">
          <p className="text-[13px] font-semibold text-fg-muted">
            {closed
              ? tied
                ? `Tied · ${cast} of ${ballot.eligible} homes voted`
                : `${leading.label} won · ${cast} of ${ballot.eligible} homes voted`
              : `${cast} of ${ballot.eligible} homes have voted`}
          </p>
          {ballot.options.map((o) => {
            const share = votes ? o.votes / votes : 0;
            const yours = o.id === mine;
            return (
              <div key={o.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] text-fg">
                    {o.label}
                    {yours ? " · your vote" : ""}
                  </span>
                  <span className="tnum shrink-0 text-[13px] text-fg-muted">
                    {o.votes} · {Math.round(share * 100)}%
                  </span>
                </div>
                <Meter value={share} tone={yours ? "ok" : "neutral"} aria-label={o.label} />
              </div>
            );
          })}
        </div>
      ) : closed && cast === 0 ? (
        <p className="border-t border-border px-4 py-2.5 text-[13px] text-fg-muted">Nobody voted.</p>
      ) : null}
    </Card>
  );
}
