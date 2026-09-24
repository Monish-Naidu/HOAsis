"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock } from "lucide-react";
import { Badge, Button, Card, Meter } from "@/components/ui/primitives";
import { resultLine } from "@/components/app/ballot-card";
import { useAppState } from "@/lib/app-state";
import type { Ballot } from "@/lib/types";
import { cn, daysFromToday, formatDate, relativeDays } from "@/lib/utils";

/**
 * A question and its choices. Tapping a choice is the vote.
 *
 * There is no separate submit step for a single choice: one vote per home,
 * changeable until the ballot ends, and the card says what you chose. An
 * election for several seats is the exception: a home marks up to one
 * candidate per seat, then casts them together. Receipts still exist on the
 * record for anyone who asks; they are no longer the first thing shown.
 */
export function BallotVote({ ballot }: { ballot: Ballot }) {
  const { settings, castVote } = useAppState();
  const [expanded, setExpanded] = useState(false);
  const seats = Math.max(1, ballot.seats ?? 1);
  const marked = ballot.myVoteOptionIds ?? (ballot.myVoteOptionId ? [ballot.myVoteOptionId] : []);
  const mine = marked[0];
  // Picks not yet cast, for a multi seat race. Starts from what was cast.
  const [draft, setDraft] = useState<string[]>(marked);
  const closed = ballot.status !== "open" || daysFromToday(ballot.closesDate) < 0;
  const votes = ballot.options.reduce((t, o) => t + o.votes, 0);
  const cast = ballot.homesVoted ?? Math.round(votes / seats);
  const showResults = closed || settings.showLiveVoteResults;
  const changed =
    draft.length !== marked.length || draft.some((id) => !marked.includes(id));

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
            const picked = seats > 1 ? draft.includes(o.id) : mine === o.id;
            const full = seats > 1 && !picked && draft.length >= seats;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={picked}
                disabled={full}
                onClick={() => {
                  if (seats > 1) {
                    setDraft(picked ? draft.filter((id) => id !== o.id) : [...draft, o.id]);
                    return;
                  }
                  if (!picked) castVote(ballot.id, o.id);
                }}
                className={cn(
                  "press flex min-h-12 w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors disabled:opacity-50",
                  picked
                    ? "border-primary bg-primary-soft ring-1 ring-inset ring-primary"
                    : "border-border hover:border-border-2 hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    picked ? "border-primary bg-primary text-primary-fg" : "border-border-2",
                  )}
                >
                  {picked ? <Check className="pop-in size-3" strokeWidth={3} /> : null}
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
          {seats > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[13px] text-fg-subtle">
                {`Choose up to ${seats}. ${draft.length} of ${seats} chosen.`}
              </p>
              <Button
                variant="primary"
                size="sm"
                disabled={!draft.length || !changed}
                onClick={() => castVote(ballot.id, draft)}
              >
                {mine ? "Update my vote" : "Cast my vote"}
              </Button>
            </div>
          ) : (
            <p className="pt-1 text-[13px] text-fg-subtle">
              {mine
                ? "Tap another choice to change your vote before it ends."
                : "Tap a choice to vote. One vote per home."}
            </p>
          )}
        </div>
      ) : null}

      {showResults && cast > 0 ? (
        <div className="space-y-2.5 border-t border-border bg-surface-2 px-4 py-3">
          <p className="text-[13px] font-semibold text-fg-muted">
            {closed ? resultLine(ballot) : `${cast} of ${ballot.eligible} homes have voted`}
          </p>
          {ballot.options.map((o) => {
            const share = votes ? o.votes / votes : 0;
            const yours = marked.includes(o.id);
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
